import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { describe, expect, it } from 'vitest';
import { parseGoogleClient, readGoogleClient } from './google-client.js';
import { createGoogleSignIn, SignInError } from './google-sign-in.js';
import { applyNamingConvention, ownDomainGroups } from './naming-convention.js';
import { createWorkspace } from './workspace.js';

const DOMAIN = 'thenextimmoscoop.be';
const CLIENT_ID = 'client.apps.googleusercontent.com';

/** Google as the token endpoint: it returns an ID token signed with a key the test controls. */
async function googleWith(claims: JWTPayload) {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'google', alg: 'RS256' };
  const idToken = await new SignJWT({
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: '108234567890',
    email: `jan@${DOMAIN}`,
    email_verified: true,
    name: 'Jan Peeters',
    hd: DOMAIN,
    nonce: 'nonce-1',
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'google' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
  const requests: URLSearchParams[] = [];
  const signIn = createGoogleSignIn({
    clientId: CLIENT_ID,
    clientSecret: 'secret',
    redirectUri: 'https://identity.test/callback',
    domain: DOMAIN,
    keys: createLocalJWKSet({ keys: [jwk] }),
    fetch: async (_url, init) => {
      requests.push(init?.body as URLSearchParams);
      return Response.json({ id_token: idToken });
    },
  });
  return { signIn, requests };
}

describe('createGoogleSignIn', () => {
  it('sends the User to Google with PKCE, a nonce and the own domain', async () => {
    const { signIn } = await googleWith({});
    const url = new URL(signIn.authorizationUrl({ state: 's', nonce: 'n', codeChallenge: 'c' }));
    expect(url.origin).toBe('https://accounts.google.com');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: CLIENT_ID,
      redirect_uri: 'https://identity.test/callback',
      scope: 'openid email profile',
      state: 's',
      nonce: 'n',
      code_challenge: 'c',
      code_challenge_method: 'S256',
      hd: DOMAIN,
    });
  });

  it('returns who signed in, after exchanging the code with the verifier', async () => {
    const { signIn, requests } = await googleWith({});
    await expect(signIn.identity({ code: 'code', codeVerifier: 'verifier', nonce: 'nonce-1' })).resolves.toEqual({
      sub: '108234567890',
      email: `jan@${DOMAIN}`,
      name: 'Jan Peeters',
    });
    expect(requests[0]?.get('code_verifier')).toBe('verifier');
  });

  it.each([
    ['another Workspace domain', { hd: 'other.be' }],
    ['a personal Gmail account', { hd: undefined, email: 'jan@gmail.com' }],
    ['an unverified email', { email_verified: false }],
    ['another sign-in', { nonce: 'nonce-2' }],
    ['another OAuth client', { aud: 'someone-else' }],
    ['another issuer', { iss: 'https://evil.test' }],
  ])('refuses %s', async (_case, claims) => {
    const { signIn } = await googleWith(claims);
    await expect(signIn.identity({ code: 'code', codeVerifier: 'v', nonce: 'nonce-1' })).rejects.toThrow(SignInError);
  });
});

describe('createWorkspace', () => {
  const token = async () => 'token';

  it('tells active, suspended and removed accounts apart', async () => {
    const answers: Record<string, Response> = {
      active: Response.json({ suspended: false }),
      suspended: Response.json({ suspended: true }),
      removed: new Response(null, { status: 404 }),
    };
    const workspace = createWorkspace(token, async (url) => {
      const id = new URL(url as string).pathname.split('/').pop() ?? '';
      return answers[id] ?? new Response(null, { status: 500 });
    });
    await expect(workspace.isActive('active')).resolves.toBe(true);
    await expect(workspace.isActive('suspended')).resolves.toBe(false);
    await expect(workspace.isActive('removed')).resolves.toBe(false);
    await expect(workspace.isActive('broken')).rejects.toThrow();
    const disabled = createWorkspace(token, async () =>
      Response.json({ error: { message: 'Admin SDK API has not been used in project 1 before or it is disabled.' } }, { status: 403 }),
    );
    await expect(disabled.isActive('someone')).rejects.toThrow(/403 Admin SDK API has not been used/);
  });

  it('collects the groups of a User over every page, and the groups those groups are in', async () => {
    // The direct groups of each member, one list per page: Jan is in a and, on the second page, in
    // b; a is a member of c, and c of a again, which must not loop.
    const parents: Record<string, string[][]> = {
      [`jan@${DOMAIN}`]: [['a'], ['b']],
      [`a@${DOMAIN}`]: [['c']],
      [`c@${DOMAIN}`]: [['a']],
    };
    const asked: string[] = [];
    const workspace = createWorkspace(token, async (url) => {
      const { pathname, searchParams } = new URL(url as string);
      expect(pathname).toBe('/v1/groups/-/memberships:searchDirectGroups');
      const query = searchParams.get('query') ?? '';
      asked.push(query);
      const pages = parents[/member_key_id == '([^']+)'/.exec(query)?.[1] ?? ''] ?? [[]];
      const page = Number(searchParams.get('pageToken') ?? 0);
      return Response.json({
        memberships: (pages[page] ?? []).map((id) => ({
          group: `groups/${id}`,
          groupKey: { id: `${id}@${DOMAIN}` },
          ...(id === 'a' ? { displayName: ' Team A ' } : {}),
        })),
        nextPageToken: page + 1 < pages.length ? String(page + 1) : undefined,
      });
    });
    await expect(workspace.groups(`jan@${DOMAIN}`)).resolves.toEqual([
      // The name Workspace shows, or else the address.
      { id: 'a', email: `a@${DOMAIN}`, name: 'Team A' },
      { id: 'b', email: `b@${DOMAIN}`, name: `b@${DOMAIN}` },
      { id: 'c', email: `c@${DOMAIN}`, name: `c@${DOMAIN}` },
    ]);
    expect(asked[0]).toBe(`member_key_id == 'jan@${DOMAIN}'`);
    expect(asked).toHaveLength(5);
  });

  it('fails with the reason Google gives when the groups cannot be read, and the argument it refused', async () => {
    const workspace = createWorkspace(token, async () =>
      Response.json({ error: { message: 'The caller does not have permission' } }, { status: 403 }),
    );
    await expect(workspace.groups(`jan@${DOMAIN}`)).rejects.toThrow(/403 The caller does not have permission/);
    const refused = createWorkspace(token, async () =>
      Response.json(
        {
          error: {
            message: 'Request contains an invalid argument.',
            details: [{ '@type': 'type.googleapis.com/google.rpc.BadRequest', fieldViolations: [{ field: 'query', description: 'Unsupported filter' }] }],
          },
        },
        { status: 400 },
      ),
    );
    await expect(refused.groups(`jan@${DOMAIN}`)).rejects.toThrow('400 Request contains an invalid argument. · query: Unsupported filter');
  });
});

describe('the groups of a User', () => {
  const groups = [
    { id: '1', email: `datahub-datateam@${DOMAIN}`, name: 'Data Team' },
    { id: '2', email: `datahub-owner-digikom@${DOMAIN}`, name: 'DigiKom' },
    { id: '3', email: `sales@${DOMAIN}`, name: 'Sales' },
    { id: '4', email: 'datahub-datateam@other.be', name: 'Data Team elsewhere' },
    { id: '5', email: `DataHub-Admins@${DOMAIN.toUpperCase()}`, name: 'admins' },
  ];

  it('keeps every group of the own domain, and turns only Role Groups into roles (FR-UM-11)', () => {
    expect(applyNamingConvention(groups, DOMAIN)).toEqual({ groups: ['1', '2', '3', '5'], roles: ['admins', 'datateam'] });
  });

  it('offers the groups of the own domain by name, each once, to choose an Owner Unit from', () => {
    expect(ownDomainGroups([...groups, groups[2]!], DOMAIN).map((group) => group.id)).toEqual(['5', '1', '2', '3']);
  });
});

describe('the OAuth client secret', () => {
  it('reads the file the Google console downloads, or its fields at the top', () => {
    expect(parseGoogleClient(JSON.stringify({ web: { client_id: 'id', client_secret: 'secret' } }))).toEqual({ clientId: 'id', clientSecret: 'secret' });
    expect(parseGoogleClient(JSON.stringify({ client_id: 'id', client_secret: 'secret' }))).toEqual({ clientId: 'id', clientSecret: 'secret' });
    expect(() => parseGoogleClient('{}')).toThrow(/client_id/);
    expect(() => parseGoogleClient('not json')).toThrow(/JSON/);
  });

  it('comes from Secret Manager', async () => {
    const data = Buffer.from(JSON.stringify({ web: { client_id: 'id', client_secret: 'secret' } })).toString('base64');
    let asked = '';
    const client = await readGoogleClient('projects/p/secrets/s/versions/latest', async () => 'token', async (url) => {
      asked = url as string;
      return Response.json({ payload: { data } });
    });
    expect(asked).toBe('https://secretmanager.googleapis.com/v1/projects/p/secrets/s/versions/latest:access');
    expect(client.clientId).toBe('id');
  });
});

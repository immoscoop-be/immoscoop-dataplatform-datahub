import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { describe, expect, it } from 'vitest';
import { parseGoogleClient, readGoogleClient } from './google-client.js';
import { createGoogleSignIn, SignInError } from './google-sign-in.js';
import { createWorkspace } from './workspace.js';

const DOMAIN = 'thenextimmoscoop.be';
const CLIENT_ID = 'client.apps.googleusercontent.com';

/** Google as the token endpoint: it returns an ID token signed with a key the test controls. */
async function googleWith(claims: JWTPayload, domains = [DOMAIN]) {
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
    domains,
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

  it('offers the accounts of any domain when two domains get in (DEC-UM-09)', async () => {
    const { signIn } = await googleWith({}, [DOMAIN, 'immoscoop.be']);
    const url = new URL(signIn.authorizationUrl({ state: 's', nonce: 'n', codeChallenge: 'c' }));
    expect(url.searchParams.get('hd')).toBe('*');
    expect(url.searchParams.has('prompt')).toBe(false);
    const choosing = new URL(signIn.authorizationUrl({ state: 's', nonce: 'n', codeChallenge: 'c', chooseAccount: true }));
    expect(choosing.searchParams.get('prompt')).toBe('select_account');
  });

  it('lets in the accounts of both domains, and names a refused account (DEC-UM-09)', async () => {
    const both = [DOMAIN, 'immoscoop.be'];
    const { signIn } = await googleWith({ hd: 'immoscoop.be', email: 'an@immoscoop.be' }, both);
    await expect(signIn.identity({ code: 'code', codeVerifier: 'v', nonce: 'nonce-1' })).resolves.toMatchObject({ email: 'an@immoscoop.be' });
    const { signIn: gmail } = await googleWith({ hd: undefined, email: 'an.claes@gmail.com' }, both);
    const refused = await gmail.identity({ code: 'code', codeVerifier: 'v', nonce: 'nonce-1' }).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(SignInError);
    expect((refused as SignInError).account).toBe('an.claes@gmail.com');
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

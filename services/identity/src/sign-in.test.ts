import { randomBytes } from 'node:crypto';
import { createVerifier } from '@datahub/auth';
import { createTestIssuer } from '@datahub/auth/testing';
import { createDatabase, migrate, type Database } from '@datahub/db';
import type { FastifyInstance } from 'fastify';
import { createLocalJWKSet } from 'jose';
import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { IdentityDatabase } from './database.js';
import { SignInError, type GoogleIdentity, type GoogleSignIn } from './google-sign-in.js';
import { migrations } from './migrations/index.js';
import { challengeOf } from './sign-in.js';
import { createStore, randomToken } from './store.js';
import { createLocalKeyService } from './testing.js';
import { createTokenIssuer } from './tokens.js';
import type { Workspace } from './workspace.js';

// A Postgres to run against: CI starts one; locally, set DATAHUB_TEST_DATABASE_URL.
const url = process.env.DATAHUB_TEST_DATABASE_URL;
if (!url && process.env.CI) {
  throw new Error('DATAHUB_TEST_DATABASE_URL must be set in CI');
}

const ISSUER = 'https://identity.test';
const DOMAIN = 'thenextimmoscoop.be';
const CLAUDE = 'https://claude.ai/api/mcp/auth_callback';
const WEB = { clientId: 'datahub-web', redirectUri: 'https://web.test/auth/callback' };
const JAN: GoogleIdentity = { sub: '108234567890', email: `jan@${DOMAIN}`, name: 'Jan Peeters' };

/** Google, as far as identity sees it: it checks the code and the nonce, or refuses the account. */
function fakeGoogle() {
  const google = {
    nonce: '',
    refuse: false,
    authorizationUrl({ state, nonce, chooseAccount }: { state: string; nonce: string; chooseAccount?: boolean }) {
      google.nonce = nonce;
      return `https://google.test/auth?state=${state}${chooseAccount ? '&prompt=select_account' : ''}`;
    },
    async identity({ code, nonce }: { code: string; nonce: string }) {
      if (google.refuse) {
        throw new SignInError(`Only accounts of ${DOMAIN} get in`, { account: 'an.claes@gmail.com' });
      }
      if (code !== 'google-code' || nonce !== google.nonce) {
        throw new SignInError('Wrong code or nonce');
      }
      return JAN;
    },
  };
  return google satisfies GoogleSignIn;
}

/** Workspace: Jan is in a Role Group, a group in the old form of an Owner Unit, an ordinary group and a group of another domain. */
function fakeWorkspace() {
  const workspace = {
    active: true,
    down: false,
    async isActive() {
      if (workspace.down) {
        throw new Error('Workspace did not say whether the account is active: 403 Admin SDK API has not been used');
      }
      return workspace.active;
    },
    async groups() {
      if (workspace.down) {
        throw new Error('Workspace did not return the groups: 503 Service Unavailable');
      }
      return [
        { id: 'g-datateam', email: `datahub-datateam@${DOMAIN}`, name: 'Data Hub · Data Team' },
        { id: 'g-digikom', email: `datahub-owner-digikom@${DOMAIN}`, name: 'DigiKom' },
        { id: 'g-sales', email: `sales@${DOMAIN}`, name: 'Sales' },
        { id: 'g-partner', email: 'team@partner.be', name: 'Partner team' },
      ];
    },
    domainGroups: async (googleId: string) => {
      if (workspace.down) {
        throw new Error('Workspace did not list the groups of the domain: 503 Service Unavailable');
      }
      workspace.askedBy = googleId;
      return [
        { id: 'g-sales', email: `sales@${DOMAIN}`, name: 'Sales' },
        { id: 'g-credit', email: `credit@${DOMAIN}`, name: 'Credit team' },
        { id: 'g-partner', email: 'team@partner.be', name: 'Partner team' },
      ];
    },
    askedBy: '',
  };
  return workspace satisfies Workspace;
}

const form = (fields: Record<string, string>) => ({
  method: 'POST' as const,
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  payload: new URLSearchParams(fields).toString(),
});

describe.skipIf(!url)('signing in', () => {
  const schema = `identity_sign_in_${randomBytes(4).toString('hex')}`;
  let database: Database<IdentityDatabase>;
  let app: FastifyInstance;
  let google: ReturnType<typeof fakeGoogle>;
  let workspace: ReturnType<typeof fakeWorkspace>;
  let clock = Date.now();
  let caller: Awaited<ReturnType<typeof createTestIssuer>>;
  const tokens = createTokenIssuer({
    keys: createLocalKeyService(['v1']),
    signingKey: 'v1',
    publicKeys: ['v1'],
    issuer: ISSUER,
    audience: 'datahub',
  });

  beforeAll(async () => {
    database = createDatabase<IdentityDatabase>({ connectionString: url }, schema);
    await migrate({ db: database.db as Kysely<unknown>, schema, migrations, serviceUser: 'postgres' });
  });

  beforeEach(async () => {
    clock = Date.now();
    google = fakeGoogle();
    workspace = fakeWorkspace();
    caller = await createTestIssuer();
    app = await buildApp({
      verifier: caller.verifier,
      tokens,
      logger: false,
      signIn: {
        store: createStore(database.db, () => new Date(clock)),
        google: async () => google,
        workspace,
        tokens,
        issuer: ISSUER,
        domains: [DOMAIN],
        webClient: WEB,
        mcpRedirectUris: [CLAUDE],
      },
    });
  });

  afterAll(async () => {
    await app?.close();
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(database.db);
    await database.close();
  });

  async function registerClaude(): Promise<string> {
    const response = await app.inject({ method: 'POST', url: '/register', payload: { client_name: 'Claude', redirect_uris: [CLAUDE] } });
    expect(response.statusCode).toBe(201);
    return response.json().client_id;
  }

  /** Signs Jan in, as a client does, up to the code it gets back. */
  async function authorize(clientId: string, redirectUri: string) {
    const verifier = randomToken();
    const start = await app.inject({
      url: `/authorize?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        code_challenge: challengeOf(verifier),
        code_challenge_method: 'S256',
        state: 'client-state',
      })}`,
    });
    expect(start.statusCode).toBe(302);
    const atGoogle = new URL(start.headers.location as string);
    expect(atGoogle.origin).toBe('https://google.test');

    const back = await app.inject({ url: `/callback?state=${atGoogle.searchParams.get('state')}&code=google-code` });
    expect(back.statusCode).toBe(302);
    return { back: new URL(back.headers.location as string), verifier };
  }

  async function signIn(clientId: string, redirectUri: string) {
    const { back, verifier } = await authorize(clientId, redirectUri);
    const response = await app.inject({
      url: '/token',
      ...form({ grant_type: 'authorization_code', code: back.searchParams.get('code') ?? '', redirect_uri: redirectUri, client_id: clientId, code_verifier: verifier }),
    });
    expect(response.statusCode).toBe(200);
    return response.json() as { access_token: string; refresh_token: string; expires_in: number };
  }

  function renew(clientId: string, refreshToken: string) {
    return app.inject({ url: '/token', ...form({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId }) });
  }

  it('tells clients where its endpoints are', async () => {
    const metadata = (await app.inject({ url: '/.well-known/oauth-authorization-server' })).json();
    expect(metadata).toMatchObject({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/authorize`,
      token_endpoint: `${ISSUER}/token`,
      code_challenge_methods_supported: ['S256'],
    });
  });

  it('lets Claude register itself, and no client with another callback', async () => {
    await registerClaude();
    const withSecret = await app.inject({
      method: 'POST',
      url: '/register',
      payload: { redirect_uris: [CLAUDE], token_endpoint_auth_method: 'client_secret_post' },
    });
    expect(withSecret.statusCode).toBe(201);
    expect(withSecret.json().token_endpoint_auth_method).toBe('none');
    const other = await app.inject({ method: 'POST', url: '/register', payload: { redirect_uris: ['https://evil.test/cb'] } });
    expect(other.statusCode).toBe(400);
    expect(other.json().error).toBe('invalid_redirect_uri');
  });

  it('signs a User in with Google and hands out an Access Token every service accepts', async () => {
    const clientId = await registerClaude();
    const { back } = await authorize(clientId, CLAUDE);
    expect(back.searchParams.get('state')).toBe('client-state');
    expect(back.searchParams.get('iss')).toBe(ISSUER);

    const pair = await signIn(clientId, CLAUDE);
    expect(pair.expires_in).toBe(900);
    const verifier = createVerifier({ issuer: ISSUER, audience: 'datahub', keys: createLocalJWKSet(await tokens.jwks()) });
    const claims = await verifier.verify(pair.access_token);
    expect(claims).toMatchObject({ sub: JAN.sub, email: JAN.email, name: JAN.name });
    // Every group of the own domain (FR-UM-11); only the Role Group gives a role.
    expect(claims.groups).toEqual(['g-datateam', 'g-digikom', 'g-sales']);
    expect(claims.roles).toEqual(['datateam']);

    const user = await database.db.selectFrom('users').selectAll().where('googleId', '=', JAN.sub).executeTakeFirst();
    expect(user?.email).toBe(JAN.email);
    // identity keeps them, so that catalogue knows whom of an Owner Unit to notify (DEC-LN-07).
    expect(user).toMatchObject({ groups: ['g-datateam', 'g-digikom', 'g-sales'], roles: ['datateam'] });
  });

  it('renews with a Refresh Token that works once, and ends the session when one is used again', async () => {
    const clientId = await registerClaude();
    const first = await signIn(clientId, CLAUDE);
    const renewed = await renew(clientId, first.refresh_token);
    expect(renewed.statusCode).toBe(200);
    const second = renewed.json();
    expect(second.refresh_token).not.toBe(first.refresh_token);

    clock += 60_000;
    expect((await renew(clientId, first.refresh_token)).json().error).toBe('invalid_grant');
    // The copy gave itself away: the newest Refresh Token of that session stops working too.
    expect((await renew(clientId, second.refresh_token)).statusCode).toBe(400);
  });

  it('does not end the session when two tabs renew at the same moment', async () => {
    const clientId = await registerClaude();
    const first = await signIn(clientId, CLAUDE);
    const winner = (await renew(clientId, first.refresh_token)).json();
    expect((await renew(clientId, first.refresh_token)).statusCode).toBe(400);
    expect((await renew(clientId, winner.refresh_token)).statusCode).toBe(200);
  });

  it('refuses a code twice, with a wrong verifier, from another client, or after a minute', async () => {
    const clientId = await registerClaude();
    const exchange = (code: string, verifier: string, client = clientId) =>
      app.inject({ url: '/token', ...form({ grant_type: 'authorization_code', code, redirect_uri: CLAUDE, client_id: client, code_verifier: verifier }) });

    const used = await authorize(clientId, CLAUDE);
    expect((await exchange(used.back.searchParams.get('code') ?? '', used.verifier)).statusCode).toBe(200);
    expect((await exchange(used.back.searchParams.get('code') ?? '', used.verifier)).statusCode).toBe(400);

    const wrong = await authorize(clientId, CLAUDE);
    expect((await exchange(wrong.back.searchParams.get('code') ?? '', randomToken())).statusCode).toBe(400);

    const stolen = await authorize(clientId, CLAUDE);
    const otherClient = await registerClaude();
    expect((await exchange(stolen.back.searchParams.get('code') ?? '', stolen.verifier, otherClient)).statusCode).toBe(400);

    const late = await authorize(clientId, CLAUDE);
    clock += 61_000;
    expect((await exchange(late.back.searchParams.get('code') ?? '', late.verifier)).statusCode).toBe(400);
  });

  it('ends every session of an account that is suspended in Workspace', async () => {
    const clientId = await registerClaude();
    const pair = await signIn(clientId, CLAUDE);
    workspace.active = false;
    expect((await renew(clientId, pair.refresh_token)).json().error).toBe('invalid_grant');

    workspace.active = true;
    const ended = await database.db.selectFrom('sessions').select('endReason').where('googleId', '=', JAN.sub).where('endReason', '=', 'account-inactive').execute();
    expect(ended.length).toBeGreaterThan(0);
    // Nobody notifies them through their Groups any more.
    expect(await database.db.selectFrom('users').select(['groups', 'roles']).where('googleId', '=', JAN.sub).executeTakeFirst()).toEqual({ groups: [], roles: [] });
  });

  it('sends the User back without a code when Google or Workspace refuses them', async () => {
    const clientId = await registerClaude();
    google.refuse = true;
    const refused = await authorize(clientId, CLAUDE);
    expect(refused.back.searchParams.get('error')).toBe('access_denied');
    expect(refused.back.searchParams.has('code')).toBe(false);
    // The refused account is named in the fragment, which no server receives (DEC-UX-35).
    expect(new URLSearchParams(refused.back.hash.slice(1)).get('account')).toBe('an.claes@gmail.com');

    google.refuse = false;
    workspace.active = false;
    const suspended = await authorize(clientId, CLAUDE);
    expect(suspended.back.searchParams.get('error')).toBe('access_denied');
  });

  it('lets Google ask which account to use when the client asks, as after a refused one', async () => {
    const start = (prompt?: string) =>
      app.inject({
        url: `/authorize?${new URLSearchParams({
          client_id: WEB.clientId,
          redirect_uri: WEB.redirectUri,
          response_type: 'code',
          code_challenge: challengeOf(randomToken()),
          code_challenge_method: 'S256',
          ...(prompt ? { prompt } : {}),
        })}`,
      });
    const choosing = new URL((await start('select_account')).headers.location as string);
    expect(choosing.searchParams.get('prompt')).toBe('select_account');
    const plain = new URL((await start()).headers.location as string);
    expect(plain.searchParams.has('prompt')).toBe(false);
  });

  it('never sends a User to a callback it does not know, and requires PKCE', async () => {
    const clientId = await registerClaude();
    const unknown = await app.inject({ url: `/authorize?client_id=${clientId}&redirect_uri=https://evil.test/cb&response_type=code` });
    expect(unknown.statusCode).toBe(400);
    expect(unknown.headers.location).toBeUndefined();

    const withoutPkce = await app.inject({ url: `/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(CLAUDE)}&response_type=code` });
    expect(new URL(withoutPkce.headers.location as string).searchParams.get('error')).toBe('invalid_request');
  });

  it('does not accept the answer of Google twice', async () => {
    const clientId = await registerClaude();
    const start = await app.inject({
      url: `/authorize?${new URLSearchParams({ client_id: clientId, redirect_uri: CLAUDE, response_type: 'code', code_challenge: 'x', code_challenge_method: 'S256' })}`,
    });
    const state = new URL(start.headers.location as string).searchParams.get('state');
    expect((await app.inject({ url: `/callback?state=${state}&code=google-code` })).statusCode).toBe(302);
    expect((await app.inject({ url: `/callback?state=${state}&code=google-code` })).statusCode).toBe(400);
  });

  it('logs out: the session of a revoked Refresh Token ends', async () => {
    const clientId = await registerClaude();
    const pair = await signIn(clientId, CLAUDE);
    expect((await app.inject({ url: '/revoke', ...form({ token: pair.refresh_token }) })).statusCode).toBe(200);
    expect((await renew(clientId, pair.refresh_token)).statusCode).toBe(400);
  });

  it('keeps the web app signed in for a working day, and Claude for 30 days from the last renewal', async () => {
    const expiry = async () =>
      (await database.db.selectFrom('sessions').select(['clientId', 'expiresAt']).orderBy('createdAt', 'desc').executeTakeFirstOrThrow()).expiresAt.getTime();

    const web = await signIn(WEB.clientId, WEB.redirectUri);
    const webExpiry = await expiry();
    expect(webExpiry - clock).toBeCloseTo(12 * 3600 * 1000, -4);
    clock += 3600 * 1000;
    expect((await renew(WEB.clientId, web.refresh_token)).statusCode).toBe(200);
    expect(await expiry()).toBe(webExpiry);

    const clientId = await registerClaude();
    const claude = await signIn(clientId, CLAUDE);
    const claudeExpiry = await expiry();
    clock += 24 * 3600 * 1000;
    expect((await renew(clientId, claude.refresh_token)).statusCode).toBe(200);
    expect((await expiry()) - claudeExpiry).toBeCloseTo(24 * 3600 * 1000, -4);
  });

  it('lets the Data Team, and no one else, end every session of a User', async () => {
    const clientId = await registerClaude();
    const pair = await signIn(clientId, CLAUDE);
    const end = async (roles: string[]) =>
      app.inject({
        method: 'DELETE',
        url: `/users/${JAN.sub}/sessions`,
        headers: { authorization: `Bearer ${await caller.sign({ roles })}` },
      });

    expect((await app.inject({ method: 'DELETE', url: `/users/${JAN.sub}/sessions` })).statusCode).toBe(401);
    expect((await end([])).statusCode).toBe(403);
    expect((await renew(clientId, pair.refresh_token)).statusCode).toBe(200);

    const second = await signIn(clientId, CLAUDE);
    expect((await end(['datateam'])).statusCode).toBe(204);
    expect((await renew(clientId, second.refresh_token)).statusCode).toBe(400);
  });

  it('sends the User back with server_error, not a raw error, when Workspace does not answer', async () => {
    const clientId = await registerClaude();
    workspace.down = true;
    const { back } = await authorize(clientId, CLAUDE);
    expect(back.searchParams.get('error')).toBe('server_error');
    expect(back.searchParams.has('code')).toBe(false);
  });

  it('lists the groups of the User of the own domain, by name, to choose an Owner Unit from', async () => {
    const token = await caller.sign({ sub: JAN.sub, email: JAN.email });
    const response = await app.inject({ url: '/me/groups', headers: { authorization: `Bearer ${token}` } });
    expect(response.json()).toEqual({
      groups: [
        { id: 'g-datateam', email: `datahub-datateam@${DOMAIN}`, name: 'Data Hub · Data Team' },
        { id: 'g-digikom', email: `datahub-owner-digikom@${DOMAIN}`, name: 'DigiKom' },
        { id: 'g-sales', email: `sales@${DOMAIN}`, name: 'Sales' },
      ],
    });
    expect((await app.inject({ url: '/me/groups' })).statusCode).toBe(401);

    workspace.down = true;
    const down = await app.inject({ url: '/me/groups', headers: { authorization: `Bearer ${token}` } });
    expect(down.statusCode).toBe(503);
    expect(down.json().error).toBe('temporarily_unavailable');
  });

  it('lists every group of the own domains to the Data Team, by name, to hand a Collection to (FR-CO-35)', async () => {
    const dataTeam = await caller.sign({ sub: JAN.sub, email: JAN.email, roles: ['datateam'] });
    const response = await app.inject({ url: '/groups', headers: { authorization: `Bearer ${dataTeam}` } });
    expect(response.json()).toEqual({
      groups: [
        { id: 'g-credit', email: `credit@${DOMAIN}`, name: 'Credit team' },
        { id: 'g-sales', email: `sales@${DOMAIN}`, name: 'Sales' },
      ],
    });
    // The Workspace it lists is that of whoever asks.
    expect(workspace.askedBy).toBe(JAN.sub);
    const someone = await caller.sign({ sub: JAN.sub, email: JAN.email, roles: [] });
    expect((await app.inject({ url: '/groups', headers: { authorization: `Bearer ${someone}` } })).statusCode).toBe(403);

    workspace.down = true;
    const down = await app.inject({ url: '/groups', headers: { authorization: `Bearer ${dataTeam}` } });
    expect(down.statusCode).toBe(503);
  });

  it('keeps the session, and the Refresh Token, when Workspace does not answer a renewal', async () => {
    const clientId = await registerClaude();
    const pair = await signIn(clientId, CLAUDE);
    workspace.down = true;
    const failed = await renew(clientId, pair.refresh_token);
    expect(failed.statusCode).toBe(503);
    expect(failed.json().error).toBe('temporarily_unavailable');

    workspace.down = false;
    clock += 60_000;
    expect((await renew(clientId, pair.refresh_token)).statusCode).toBe(200);
  });
});

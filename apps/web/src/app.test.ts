import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestIssuer } from '@datahub/auth/testing';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, CLIENT_ID } from './app.js';

const WEB = 'https://web.test';
const IDENTITY = 'https://identity.test';
const CATALOGUE = 'https://catalogue.test';
const REGISTRY = 'https://registry.test';
const SEMGRAPH = 'https://semgraph.test';
const QUERY = 'https://query.test';

/** identity as far as the web app's server sees it: its token and revocation endpoints. */
function fakeIdentity() {
  const calls: { path: string; fields: Record<string, string> }[] = [];
  let challenge = '';
  let refreshCount = 0;
  const identity = {
    calls,
    refuse: false,
    unavailable: false,
    rememberChallenge(value: string) {
      challenge = value;
    },
    fetch: (async (url: string | URL, init?: RequestInit) => {
      const path = new URL(url).pathname;
      const fields = Object.fromEntries(new URLSearchParams(init?.body as URLSearchParams));
      calls.push({ path, fields });
      if (path === '/revoke') {
        return Response.json({});
      }
      if (identity.refuse) {
        return Response.json({ error: 'invalid_grant' }, { status: 400 });
      }
      if (identity.unavailable) {
        return Response.json({ error: 'temporarily_unavailable' }, { status: 503 });
      }
      if (fields.grant_type === 'authorization_code') {
        const proven = createHash('sha256').update(fields.code_verifier ?? '').digest('base64url') === challenge;
        return proven ? Response.json({ access_token: 'access-1', expires_in: 900, refresh_token: 'refresh-1' }) : Response.json({ error: 'invalid_grant' }, { status: 400 });
      }
      refreshCount++;
      return Response.json({ access_token: `access-${refreshCount + 1}`, expires_in: 900, refresh_token: `refresh-${refreshCount + 1}` });
    }) as typeof fetch,
  };
  return identity;
}

/** The Set-Cookie headers of a response, by cookie name. */
function cookies(headers: Record<string, unknown>): Record<string, string> {
  const raw = headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return Object.fromEntries(list.map((cookie: string) => [cookie.split('=')[0], cookie]));
}

/** A page as Vite builds it from client/index.html, with one script, a picture and the favicon. */
async function builtClient(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'datahub-web-'));
  await mkdir(join(dir, 'assets'));
  await writeFile(
    join(dir, 'index.html'),
    '<!doctype html>\n<html lang="nl">\n  <head>\n    <script type="module" crossorigin src="/assets/index-a1b2.js"></script>\n  </head>\n  <body><div id="app"></div></body>\n</html>\n',
  );
  await writeFile(join(dir, 'assets', 'index-a1b2.js'), 'console.log("Data Hub");');
  await writeFile(join(dir, 'assets', 'alpenglow-c3d4.jpg'), 'jpg');
  await writeFile(join(dir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  return dir;
}

describe('the server of the web app', () => {
  let app: FastifyInstance;
  let identity: ReturnType<typeof fakeIdentity>;
  let clientDir: string;

  beforeAll(async () => {
    clientDir = await builtClient();
  });

  afterAll(() => rm(clientDir, { recursive: true, force: true }));

  beforeEach(async () => {
    identity = fakeIdentity();
    app = await buildApp({ verifier: (await createTestIssuer()).verifier, webUrl: WEB, identityUrl: IDENTITY, catalogueUrl: CATALOGUE, registryUrl: REGISTRY, queryUrl: QUERY, semgraphUrl: SEMGRAPH, clientDir, fetch: identity.fetch, logger: false });
  });

  afterEach(() => app.close());

  /** Signs in up to identity and back, as the browser would; returns the session cookie. */
  async function signIn(next = '/'): Promise<string> {
    const login = await app.inject({ url: `/auth/login?next=${encodeURIComponent(next)}` });
    const authorize = new URL(login.headers.location as string);
    identity.rememberChallenge(authorize.searchParams.get('code_challenge') ?? '');
    const signInCookie = cookies(login.headers)['datahub_sign_in']?.split(';')[0] ?? '';

    const callback = await app.inject({
      url: `/auth/callback?code=code-1&state=${authorize.searchParams.get('state')}`,
      headers: { cookie: signInCookie },
    });
    expect(callback.headers.location).toBe(next);
    expect(cookies(callback.headers)['datahub_sign_in']).toMatch(/Max-Age=0/);
    return cookies(callback.headers)['datahub_session'] ?? '';
  }

  it('serves the page, which may only talk to itself, identity, catalogue, registry, query and semgraph', async () => {
    const page = await app.inject({ url: '/' });
    expect(page.statusCode).toBe(200);
    expect(page.headers['cache-control']).toBe('no-store');
    expect(page.body).toContain(`<html lang="nl" data-identity="${IDENTITY}" data-catalogue="${CATALOGUE}" data-registry="${REGISTRY}" data-query="${QUERY}" data-semgraph="${SEMGRAPH}" data-nonce="`);
    const policy = page.headers['content-security-policy'] as string;
    expect(policy).toContain("default-src 'self';");
    // The editor of Query adds styles of its own, allowed by a nonce that is new for every page.
    const nonce = /data-nonce="([^"]+)"/.exec(page.body)?.[1] ?? '';
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{24}$/);
    expect(policy).toContain(`style-src 'self' 'nonce-${nonce}';`);
    expect((await app.inject({ url: '/' })).body).not.toContain(nonce);
    expect(policy).toContain(`connect-src 'self' ${IDENTITY} ${CATALOGUE} ${REGISTRY} ${QUERY} ${SEMGRAPH};`);
    // Charts are pictures from semgraph, and the grain of a background is a small picture of its own.
    expect(policy).toContain(`img-src 'self' data: ${SEMGRAPH};`);
    expect(policy).not.toContain('unsafe');
    expect(policy).not.toContain('script-src');
  });

  it('serves the same page at every address of a page, which shows what it asks or that nothing is there (DEC-UX-32)', async () => {
    for (const url of ['/collections', '/me/background', '/collections/c-1/resources/r-1', '/anything']) {
      const page = await app.inject({ url });
      expect([url, page.statusCode]).toEqual([url, 200]);
      expect(page.body).toContain('<html lang="nl" data-identity=');
      expect(page.headers['content-security-policy']).toContain("default-src 'self';");
    }
  });

  it('serves the built files, the ones named after their content for good', async () => {
    const script = await app.inject({ url: '/assets/index-a1b2.js' });
    expect(script.headers['content-type']).toContain('text/javascript');
    expect(script.headers['cache-control']).toContain('immutable');
    expect(script.headers['x-content-type-options']).toBe('nosniff');
    expect(script.body).toBe('console.log("Data Hub");');
    const picture = await app.inject({ url: '/assets/alpenglow-c3d4.jpg' });
    expect(picture.headers['content-type']).toBe('image/jpeg');
    const icon = await app.inject({ url: '/favicon.svg' });
    expect(icon.headers['content-type']).toBe('image/svg+xml');
    expect(icon.headers['cache-control']).not.toContain('immutable');
    // Only the built files are files; the address of any other file is not found.
    for (const url of ['/index.html', '/assets/../index.html', '/assets/missing.js', '/icons/home.svg', '/auth/missing']) {
      expect([url, (await app.inject({ url })).statusCode]).toEqual([url, 404]);
    }
  });

  it('refuses to start without the built page', async () => {
    await expect(
      buildApp({ verifier: (await createTestIssuer()).verifier, webUrl: WEB, identityUrl: IDENTITY, catalogueUrl: CATALOGUE, registryUrl: REGISTRY, queryUrl: QUERY, semgraphUrl: SEMGRAPH, clientDir: join(clientDir, 'missing'), logger: false }),
    ).rejects.toThrow(/index\.html/);
  });

  it('sends the User to identity with PKCE, as the client datahub-web', async () => {
    const login = await app.inject({ url: '/auth/login' });
    expect(login.statusCode).toBe(302);
    const authorize = new URL(login.headers.location as string);
    expect(authorize.origin + authorize.pathname).toBe(`${IDENTITY}/authorize`);
    expect(Object.fromEntries(authorize.searchParams)).toMatchObject({
      client_id: CLIENT_ID,
      redirect_uri: `${WEB}/auth/callback`,
      response_type: 'code',
      code_challenge_method: 'S256',
    });
    expect(cookies(login.headers)['datahub_sign_in']).toMatch(/HttpOnly; Secure; SameSite=Lax/);
  });

  it('asks Google for another account after a refused one', async () => {
    const plain = new URL((await app.inject({ url: '/auth/login' })).headers.location as string);
    expect(plain.searchParams.has('prompt')).toBe(false);
    const choose = new URL((await app.inject({ url: '/auth/login?choose=account' })).headers.location as string);
    expect(choose.searchParams.get('prompt')).toBe('select_account');
  });

  it('returns to the page the User signed in from, and never to another site', async () => {
    await signIn('/me/background');
    for (const next of ['https://evil.test/', '//evil.test/', '/\\evil.test', '/auth/logout']) {
      const login = await app.inject({ url: `/auth/login?next=${encodeURIComponent(next)}` });
      const authorize = new URL(login.headers.location as string);
      identity.rememberChallenge(authorize.searchParams.get('code_challenge') ?? '');
      const callback = await app.inject({
        url: `/auth/callback?code=code-1&state=${authorize.searchParams.get('state')}`,
        headers: { cookie: cookies(login.headers)['datahub_sign_in']?.split(';')[0] ?? '' },
      });
      expect([next, callback.headers.location]).toEqual([next, '/']);
    }
  });

  it('keeps the Refresh Token in a cookie no script can read and no other site can send', async () => {
    const session = await signIn();
    expect(session).toMatch(/^datahub_session=refresh-1; Path=\/auth; Max-Age=43200; HttpOnly; Secure; SameSite=Strict$/);
    expect(identity.calls.at(-1)?.fields).toMatchObject({ grant_type: 'authorization_code', client_id: CLIENT_ID, code: 'code-1' });
  });

  it('refuses a return from identity that it did not start', async () => {
    const callback = await app.inject({ url: '/auth/callback?code=stolen&state=guess' });
    expect(callback.headers.location).toBe('/?error=expired');
    expect(cookies(callback.headers)['datahub_session']).toBeUndefined();
  });

  it('passes on a refusal by identity, such as an account of another domain', async () => {
    const login = await app.inject({ url: '/auth/login' });
    const state = new URL(login.headers.location as string).searchParams.get('state');
    const callback = await app.inject({
      url: `/auth/callback?error=access_denied&state=${state}`,
      headers: { cookie: cookies(login.headers)['datahub_sign_in']?.split(';')[0] ?? '' },
    });
    expect(callback.headers.location).toBe('/?error=access_denied');
  });

  it('gives the page an Access Token for the Refresh Token, and a new Refresh Token', async () => {
    const session = (await signIn()).split(';')[0] ?? '';
    const token = await app.inject({ method: 'POST', url: '/auth/token', headers: { cookie: session, origin: WEB } });
    expect(token.json()).toEqual({ access_token: 'access-2', expires_in: 900 });
    expect(token.headers['cache-control']).toBe('no-store');
    expect(cookies(token.headers)['datahub_session']).toMatch(/^datahub_session=refresh-2;/);
  });

  it('gives no Access Token without a session, or to a page of another site', async () => {
    const none = await app.inject({ method: 'POST', url: '/auth/token' });
    expect(none.statusCode).toBe(401);
    expect(none.json().error).toBe('signed_out');
    const session = (await signIn()).split(';')[0] ?? '';
    expect((await app.inject({ method: 'POST', url: '/auth/token', headers: { cookie: session, origin: 'https://evil.test' } })).statusCode).toBe(403);
    identity.refuse = true;
    const refused = await app.inject({ method: 'POST', url: '/auth/token', headers: { cookie: session } });
    expect(refused.statusCode).toBe(401);
    expect(refused.json().error).toBe('renewal_refused');
    identity.refuse = false;
    identity.unavailable = true;
    const unavailable = await app.inject({ method: 'POST', url: '/auth/token', headers: { cookie: session } });
    expect(unavailable.statusCode).toBe(503);
    expect(cookies(unavailable.headers)['datahub_session']).toBeUndefined();
  });

  it('signs out at identity too, and forgets the session', async () => {
    const session = (await signIn()).split(';')[0] ?? '';
    const out = await app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie: session, origin: WEB } });
    expect(out.statusCode).toBe(204);
    expect(identity.calls.at(-1)).toEqual({ path: '/revoke', fields: { client_id: CLIENT_ID, token: 'refresh-1' } });
    expect(cookies(out.headers)['datahub_session']).toMatch(/Max-Age=0/);
  });
});

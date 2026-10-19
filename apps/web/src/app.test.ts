import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestIssuer } from '@datahub/auth/testing';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, CLIENT_ID } from './app.js';
import { loadClient } from './page.js';

const WEB = 'https://web.test';
const IDENTITY = 'https://identity.test';
const CATALOGUE = 'https://catalogue.test';
const REGISTRY = 'https://registry.test';
const SEMGRAPH = 'https://semgraph.test';

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

/** A page as Vite builds it from client/index.html, with one script, the favicon and the drawing of one icon. */
async function builtClient(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'datahub-web-'));
  await mkdir(join(dir, 'assets'));
  await writeFile(
    join(dir, 'index.html'),
    '<!doctype html>\n<html lang="en">\n  <head>\n    <script type="module" crossorigin src="/assets/index-a1b2.js"></script>\n  </head>\n  <body><div id="root"></div></body>\n</html>\n',
  );
  await writeFile(join(dir, 'assets', 'index-a1b2.js'), 'console.log("Data Hub");');
  await writeFile(join(dir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await mkdir(join(dir, 'icons'));
  await writeFile(join(dir, 'icons', 'home.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><path d="M5 12l-2 0l9 -9l9 9l-2 0"/></svg>');
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
    app = await buildApp({ verifier: (await createTestIssuer()).verifier, webUrl: WEB, identityUrl: IDENTITY, catalogueUrl: CATALOGUE, registryUrl: REGISTRY, semgraphUrl: SEMGRAPH, clientDir, fetch: identity.fetch, logger: false });
  });

  afterEach(() => app.close());

  /** Signs in up to identity and back, as the browser would; returns the session cookie. */
  async function signIn(): Promise<string> {
    const login = await app.inject({ url: '/auth/login' });
    const authorize = new URL(login.headers.location as string);
    identity.rememberChallenge(authorize.searchParams.get('code_challenge') ?? '');
    const signInCookie = cookies(login.headers)['datahub_sign_in']?.split(';')[0] ?? '';

    const callback = await app.inject({
      url: `/auth/callback?code=code-1&state=${authorize.searchParams.get('state')}`,
      headers: { cookie: signInCookie },
    });
    expect(callback.headers.location).toBe('/');
    expect(cookies(callback.headers)['datahub_sign_in']).toMatch(/Max-Age=0/);
    return cookies(callback.headers)['datahub_session'] ?? '';
  }

  it('serves the page, which may only talk to itself, identity, registry and semgraph', async () => {
    const page = await app.inject({ url: '/' });
    expect(page.statusCode).toBe(200);
    expect(page.headers['cache-control']).toBe('no-store');
    expect(page.body).toContain(`<html lang="en" data-identity="${IDENTITY}" data-catalogue="${CATALOGUE}" data-registry="${REGISTRY}" data-semgraph="${SEMGRAPH}">`);
    const policy = page.headers['content-security-policy'] as string;
    expect(policy).toContain("default-src 'self';");
    expect(policy).toContain(`connect-src 'self' ${IDENTITY} ${CATALOGUE} ${REGISTRY} ${SEMGRAPH};`);
    // Charts are pictures from semgraph; nothing else is loaded from another address.
    expect(policy).toContain(`img-src 'self' ${SEMGRAPH};`);
    expect(policy).not.toContain('unsafe');
  });

  it('gives every page its own nonce, which only lets styles in', async () => {
    const nonces = await Promise.all(
      [1, 2].map(async () => {
        const page = await app.inject({ url: '/' });
        const nonce = /<meta property="csp-nonce" nonce="([^"]+)" \/>/.exec(page.body)?.[1];
        expect(page.headers['content-security-policy']).toContain(`style-src 'self' 'nonce-${nonce}';`);
        expect(page.headers['content-security-policy']).not.toContain('script-src');
        return nonce;
      }),
    );
    expect(nonces[0]).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(nonces[0]).not.toBe(nonces[1]);
  });

  it('serves the built files, the ones named after their content for good', async () => {
    const script = await app.inject({ url: '/assets/index-a1b2.js' });
    expect(script.headers['content-type']).toContain('text/javascript');
    expect(script.headers['cache-control']).toContain('immutable');
    expect(script.headers['x-content-type-options']).toBe('nosniff');
    expect(script.body).toBe('console.log("Data Hub");');
    const icon = await app.inject({ url: '/favicon.svg' });
    expect(icon.headers['content-type']).toBe('image/svg+xml');
    expect(icon.headers['cache-control']).not.toContain('immutable');
    // Only the built files are routes; anything else meets the token check of every service.
    for (const url of ['/index.html', '/assets/../index.html', '/assets/missing.js']) {
      expect((await app.inject({ url })).statusCode).toBe(401);
    }
  });

  it('serves the drawing of an icon through one route, reading it only when it is asked for (DEC-CO-14)', async () => {
    const client = await loadClient(clientDir, { identityUrl: IDENTITY, catalogueUrl: CATALOGUE, registryUrl: REGISTRY, semgraphUrl: SEMGRAPH });
    expect([...client.files.keys()].filter((path) => path.startsWith('/icons/'))).toEqual([]);

    const home = await app.inject({ url: '/icons/home.svg' });
    expect(home.statusCode).toBe(200);
    expect(home.headers['content-type']).toBe('image/svg+xml');
    expect(home.headers['cache-control']).toBe('public, max-age=3600');
    expect(home.headers['x-content-type-options']).toBe('nosniff');
    expect(home.body).toContain('M5 12l-2 0l9 -9l9 9l-2 0');
    for (const url of ['/icons/rocket.svg', '/icons/Home.svg', '/icons/home.js', '/icons/..%2Findex.html', '/icons/..%2F..%2Fpackage.json']) {
      expect((await app.inject({ url })).statusCode).toBe(404);
    }
  });

  it('refuses to start without the built page', async () => {
    await expect(
      buildApp({ verifier: (await createTestIssuer()).verifier, webUrl: WEB, identityUrl: IDENTITY, catalogueUrl: CATALOGUE, registryUrl: REGISTRY, semgraphUrl: SEMGRAPH, clientDir: join(clientDir, 'missing'), logger: false }),
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

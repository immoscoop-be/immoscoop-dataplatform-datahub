import { createHash, randomBytes } from 'node:crypto';
import type { TokenVerifier } from '@datahub/auth';
import { createServer, type ServerOptions } from '@datahub/server';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { readCookie, serializeCookie } from './cookies.js';
import { loadClient, NONCE } from './page.js';

/** The web app is an OAuth client of identity, known there by this ID (TR-PF-27). */
export const CLIENT_ID = 'datahub-web';
/** Holds the Refresh Token: only sent to the sign-in routes, never readable by JavaScript. */
const SESSION_COOKIE = 'datahub_session';
/** Holds the state and PKCE verifier while the User signs in at Google. */
const SIGN_IN_COOKIE = 'datahub_sign_in';
/** The session of the web app lasts a working day (TR-PF-25). */
const SESSION_SECONDS = 12 * 60 * 60;

export interface AppOptions {
  verifier: TokenVerifier;
  /** The web app's own address (DATAHUB_WEB_URL); its sign-in callback is there. */
  webUrl: string;
  /** identity's address (DATAHUB_TOKEN_ISSUER). */
  identityUrl: string;
  /** registry's address (DATAHUB_REGISTRY_URL), which the page calls to search the dbt projects. */
  registryUrl: string;
  /** catalogue's address (DATAHUB_CATALOGUE_URL), which the page calls for the Collections. */
  catalogueUrl: string;
  /** query's address (DATAHUB_QUERY_URL), which the page calls to write and run queries. */
  queryUrl: string;
  /** semgraph's address (DATAHUB_SEMGRAPH_URL): the page shows its charts. */
  semgraphUrl: string;
  /** The page as Vite built it: `dist/client` next to the server. */
  clientDir: string;
  /** Calls to identity; tests pass a stand-in. */
  fetch?: typeof fetch;
  logger?: ServerOptions['logger'];
}

/**
 * The server of the web app (DEC-PF-19, TR-PF-27): it serves the app, signs the User in through
 * identity, and keeps the Refresh Token in a cookie of its own address. The browser only ever gets
 * the Access Token, with which the app calls the services itself. No business logic, no data.
 */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const client = await loadClient(options.clientDir, options);
  const app = await createServer({ name: 'web', verifier: options.verifier, logger: options.logger });
  const request = options.fetch ?? fetch;
  const redirectUri = `${options.webUrl}/auth/callback`;
  const open = { config: { public: true } };

  /** Calls identity's token endpoint (or revocation endpoint) from the server, never the browser. */
  async function identity(path: '/token' | '/revoke', fields: Record<string, string>) {
    return request(`${options.identityUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT_ID, ...fields }),
    });
  }

  /** A page of this web app to return to after signing in; anything else, such as another site, is the start. */
  function ownPage(path: string | undefined): string {
    return path && /^\/(?![/\\])/.test(path) && !path.startsWith('/auth/') && !/[\s\\]/.test(path) ? path : '/';
  }

  function keepSession(reply: FastifyReply, refreshToken: string) {
    reply.header('set-cookie', serializeCookie(SESSION_COOKIE, refreshToken, { maxAge: SESSION_SECONDS, sameSite: 'Strict' }));
  }

  /** The sign-in routes only take requests from the web app's own pages. */
  function fromOwnPage(incoming: FastifyRequest): boolean {
    const origin = incoming.headers.origin;
    return origin === undefined || origin === new URL(options.webUrl).origin;
  }

  // The page loads scripts, styles, fonts and pictures only from its own address, and charts from
  // semgraph; the grain over a flowing background is a small picture in its stylesheet. The editor of
  // Query adds its own styles, allowed by a nonce new for every page. It talks only to its own server,
  // identity, catalogue, registry, query and semgraph.
  const policy = (nonce: string) => [
    "default-src 'self'",
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: ${options.semgraphUrl}`,
    `connect-src 'self' ${options.identityUrl} ${options.catalogueUrl} ${options.registryUrl} ${options.queryUrl} ${options.semgraphUrl}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  const sendPage = (reply: FastifyReply) => {
    const nonce = randomBytes(18).toString('base64');
    return reply
      .type('text/html; charset=utf-8')
      .header('content-security-policy', policy(nonce))
      .header('cache-control', 'no-store')
      .send(client.page.replace(NONCE, nonce));
  };
  app.get('/', open, async (_incoming, reply) => sendPage(reply));
  for (const [path, file] of client.files) {
    app.get(path, open, async (_incoming, reply) =>
      reply
        .type(file.type)
        .header('x-content-type-options', 'nosniff')
        .header('cache-control', file.immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600')
        .send(file.body),
    );
  }

  // Every address of a page of Data Hub is the same page, which shows what the address asks, or the
  // page for what does not exist (DEC-UX-32). An address of a file that was not built is not found.
  app.get<{ Params: { '*': string } }>('/*', open, async (incoming, reply) => {
    const path = `/${incoming.params['*']}`;
    if (/\.[A-Za-z0-9]+$/.test(path) || path.startsWith('/auth/') || path.startsWith('/assets/')) {
      return reply.code(404).send({ error: 'not_found' });
    }
    return sendPage(reply);
  });

  // The start of signing in: off to identity, with PKCE, remembering what to check on return and the
  // page to return to. After a refused account, Google is asked to let the User choose another.
  app.get<{ Querystring: { next?: string; choose?: string } }>('/auth/login', open, async (incoming, reply) => {
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const next = Buffer.from(ownPage(incoming.query.next)).toString('base64url');
    const authorize = new URL(`${options.identityUrl}/authorize`);
    authorize.search = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      state,
      ...(incoming.query.choose === 'account' ? { prompt: 'select_account' } : {}),
    }).toString();
    return reply
      .header('set-cookie', serializeCookie(SIGN_IN_COOKIE, `${state}.${verifier}.${next}`, { maxAge: 600, sameSite: 'Lax' }))
      .redirect(authorize.toString());
  });

  // Back from identity: the code becomes an Access Token and a Refresh Token.
  app.get<{ Querystring: Record<string, string | undefined> }>('/auth/callback', open, async (incoming, reply) => {
    const [state, verifier, next] = (readCookie(incoming.headers.cookie, SIGN_IN_COOKIE) ?? '').split('.');
    reply.header('set-cookie', serializeCookie(SIGN_IN_COOKIE, '', { maxAge: 0, sameSite: 'Lax' }));
    const failed = (reason: string) => {
      incoming.log.warn({ reason }, 'sign-in did not complete');
      return reply.redirect(`/?error=${encodeURIComponent(reason)}`);
    };
    if (incoming.query.error) {
      return failed(incoming.query.error);
    }
    if (!state || !verifier || incoming.query.state !== state || !incoming.query.code) {
      return failed('expired');
    }
    const response = await identity('/token', {
      grant_type: 'authorization_code',
      code: incoming.query.code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });
    if (!response.ok) {
      return failed('refused');
    }
    const { refresh_token: refreshToken } = (await response.json()) as { refresh_token: string };
    keepSession(reply, refreshToken);
    return reply.redirect(ownPage(next ? Buffer.from(next, 'base64url').toString('utf8') : undefined));
  });

  // The page asks for an Access Token; the Refresh Token in the cookie pays for it.
  app.post('/auth/token', open, async (incoming, reply) => {
    reply.header('cache-control', 'no-store');
    if (!fromOwnPage(incoming)) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const refreshToken = readCookie(incoming.headers.cookie, SESSION_COOKIE);
    if (!refreshToken) {
      return reply.code(401).send({ error: 'signed_out' });
    }
    const response = await identity('/token', { grant_type: 'refresh_token', refresh_token: refreshToken });
    if (response.status === 503) {
      // Google did not answer identity; the session is still good.
      return reply.code(503).send({ error: 'temporarily_unavailable' });
    }
    if (!response.ok) {
      // The cookie is left alone: another tab may just have replaced it with a newer one.
      return reply.code(401).send({ error: 'renewal_refused' });
    }
    const pair = (await response.json()) as { access_token: string; expires_in: number; refresh_token: string };
    keepSession(reply, pair.refresh_token);
    return { access_token: pair.access_token, expires_in: pair.expires_in };
  });

  // Signing out ends the session at identity too.
  app.post('/auth/logout', open, async (incoming, reply) => {
    if (!fromOwnPage(incoming)) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const refreshToken = readCookie(incoming.headers.cookie, SESSION_COOKIE);
    if (refreshToken) {
      await identity('/revoke', { token: refreshToken });
    }
    return reply.header('set-cookie', serializeCookie(SESSION_COOKIE, '', { maxAge: 0, sameSite: 'Strict' })).code(204).send();
  });

  return app;
}

import { createHash, randomBytes } from 'node:crypto';
import type { TokenVerifier } from '@datahub/auth';
import { createServer, type ServerOptions } from '@datahub/server';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { readCookie, serializeCookie } from './cookies.js';
import { pageHtml, pageScript, pageStyle } from './page.js';

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

  function keepSession(reply: FastifyReply, refreshToken: string) {
    reply.header('set-cookie', serializeCookie(SESSION_COOKIE, refreshToken, { maxAge: SESSION_SECONDS, sameSite: 'Strict' }));
  }

  /** The sign-in routes only take requests from the web app's own pages. */
  function fromOwnPage(incoming: FastifyRequest): boolean {
    const origin = incoming.headers.origin;
    return origin === undefined || origin === new URL(options.webUrl).origin;
  }

  app.get('/', open, async (_incoming, reply) =>
    reply
      .type('text/html; charset=utf-8')
      .header(
        'content-security-policy',
        `default-src 'self'; connect-src 'self' ${options.identityUrl}; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
      )
      .header('cache-control', 'no-store')
      .send(pageHtml(options.identityUrl)),
  );
  app.get('/app.js', open, async (_incoming, reply) => reply.type('text/javascript; charset=utf-8').send(pageScript));
  app.get('/app.css', open, async (_incoming, reply) => reply.type('text/css; charset=utf-8').send(pageStyle));

  // The start of signing in: off to identity, with PKCE, remembering what to check on return.
  app.get('/auth/login', open, async (_incoming, reply) => {
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const authorize = new URL(`${options.identityUrl}/authorize`);
    authorize.search = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      state,
    }).toString();
    return reply
      .header('set-cookie', serializeCookie(SIGN_IN_COOKIE, `${state}.${verifier}`, { maxAge: 600, sameSite: 'Lax' }))
      .redirect(authorize.toString());
  });

  // Back from identity: the code becomes an Access Token and a Refresh Token.
  app.get<{ Querystring: Record<string, string | undefined> }>('/auth/callback', open, async (incoming, reply) => {
    const [state, verifier] = (readCookie(incoming.headers.cookie, SIGN_IN_COOKIE) ?? '').split('.');
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
    return reply.redirect('/');
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

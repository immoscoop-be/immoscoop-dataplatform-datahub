import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { SignInError, type GoogleIdentity, type GoogleSignIn } from './google-sign-in.js';
import { applyNamingConvention } from './naming-convention.js';
import { randomToken, type Store } from './store.js';
import type { TokenIssuer, TokenSubject } from './tokens.js';
import type { Workspace } from './workspace.js';

/** The session of the web app lasts a working day; a renewal does not extend it (TR-PF-25). */
export const WEB_SESSION_SECONDS = 12 * 60 * 60;
/** The session of an MCP client lasts 30 days, counted again from every renewal (TR-PF-25). */
export const MCP_SESSION_SECONDS = 30 * 24 * 60 * 60;
const ACCESS_TOKEN_SECONDS = 15 * 60;

export interface SignInOptions {
  store: Store;
  /** Sign in with Google; loaded on first use, so a missing OAuth client never blocks a deploy (TR-PF-23). */
  google: () => Promise<GoogleSignIn>;
  workspace: Workspace;
  tokens: TokenIssuer;
  /** identity's own address: the issuer of the Access Tokens and the base of its endpoints. */
  issuer: string;
  /** The only Workspace domain that gets in (DEC-UM-06). */
  domain: string;
  /** The server of the web app, an OAuth client known in advance (TR-PF-27); absent until it exists. */
  webClient?: { clientId: string; redirectUri: string };
  /** The only addresses an MCP client may register as its callback, such as Claude's. */
  mcpRedirectUris: string[];
}

interface Client {
  clientId: string;
  redirectUris: string[];
  web: boolean;
}

/**
 * identity as the OAuth 2.1 authorisation server of Data Hub (TR-PF-06, TR-PF-25, TR-PF-26), for
 * the server of the web app and for MCP clients such as Claude. The User signs in at Google; the
 * client gets an Access Token and a Refresh Token. All of these endpoints are public: they are
 * where a login starts.
 */
export async function signInRoutes(app: FastifyInstance, options: SignInOptions): Promise<void> {
  const { store, workspace, tokens, issuer } = options;
  const open = { config: { public: true } };

  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_request, body, done) => {
    done(null, Object.fromEntries(new URLSearchParams(body as string)));
  });

  async function findClient(clientId: string | undefined): Promise<Client | undefined> {
    if (!clientId) {
      return undefined;
    }
    if (options.webClient && clientId === options.webClient.clientId) {
      return { clientId, redirectUris: [options.webClient.redirectUri], web: true };
    }
    const registered = await store.client(clientId);
    return registered && { clientId, redirectUris: registered.redirectUris, web: false };
  }

  /** Reads the Groups and roles of a User again, as at every login and renewal (FR-UM-04, TR-PF-26). */
  async function subject(user: { googleId: string; email: string; name: string }): Promise<TokenSubject> {
    const { groups, roles } = applyNamingConvention(await workspace.groups(user.email), options.domain);
    return { sub: user.googleId, email: user.email, name: user.name, groups, roles };
  }

  async function issuePair(reply: FastifyReply, claims: TokenSubject, refreshToken: string) {
    reply.header('cache-control', 'no-store');
    return {
      access_token: await tokens.issue(claims),
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_SECONDS,
      refresh_token: refreshToken,
    };
  }

  function refuse(reply: FastifyReply, error: string, description: string) {
    reply.code(400).header('cache-control', 'no-store');
    return { error, error_description: description };
  }

  // Where clients find the endpoints (RFC 8414), as the MCP authorisation specification asks.
  app.get('/.well-known/oauth-authorization-server', open, async () => ({
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    revocation_endpoint: `${issuer}/revoke`,
    registration_endpoint: `${issuer}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
  }));

  // MCP clients register themselves (RFC 7591), but only with a callback on the list.
  app.post<{ Body: Record<string, unknown> }>('/register', open, async (request, reply) => {
    const body = request.body ?? {};
    const redirectUris = body.redirect_uris;
    if (
      !Array.isArray(redirectUris) ||
      redirectUris.length === 0 ||
      !redirectUris.every((uri) => typeof uri === 'string' && options.mcpRedirectUris.includes(uri))
    ) {
      return refuse(reply, 'invalid_redirect_uri', 'Only known MCP clients, such as Claude, may register');
    }
    // Every client is public and proves itself with PKCE; a client that asks for a secret is told
    // so in the answer, as RFC 7591 allows, rather than refused.
    const name = typeof body.client_name === 'string' ? body.client_name.slice(0, 200) : 'MCP client';
    const clientId = await store.registerClient({ name, redirectUris: redirectUris as string[] });
    reply.code(201);
    return {
      client_id: clientId,
      client_name: name,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
  });

  // The start of a login: identity remembers the client's request and sends the User to Google.
  app.get<{ Querystring: Record<string, string | undefined> }>('/authorize', open, async (request, reply) => {
    const query = request.query;
    const client = await findClient(query.client_id);
    // Without a known client and callback, there is nowhere safe to send the User back to.
    if (!client || !query.redirect_uri || !client.redirectUris.includes(query.redirect_uri)) {
      reply.code(400).type('text/plain');
      return 'This sign-in link is not valid: unknown client or callback.';
    }
    const back = new URL(query.redirect_uri);
    if (query.state) {
      back.searchParams.set('state', query.state);
    }
    if (query.response_type !== 'code') {
      back.searchParams.set('error', 'unsupported_response_type');
      return reply.redirect(back.toString());
    }
    if (!query.code_challenge || query.code_challenge_method !== 'S256') {
      back.searchParams.set('error', 'invalid_request');
      back.searchParams.set('error_description', 'PKCE with S256 is required');
      return reply.redirect(back.toString());
    }

    const googleCodeVerifier = randomToken();
    const pending = await store.startAuthorization({
      clientId: client.clientId,
      redirectUri: query.redirect_uri,
      codeChallenge: query.code_challenge,
      clientState: query.state ?? null,
      nonce: randomToken(),
      googleCodeVerifier,
    });
    const google = await options.google();
    return reply.redirect(
      google.authorizationUrl({ state: pending.id, nonce: pending.nonce, codeChallenge: challengeOf(googleCodeVerifier) }),
    );
  });

  // Google sends the User back here; identity checks who they are and hands the client a code.
  app.get<{ Querystring: Record<string, string | undefined> }>('/callback', open, async (request, reply) => {
    const pending = request.query.state ? await store.takeAuthorization(request.query.state) : undefined;
    if (!pending) {
      reply.code(400).type('text/plain');
      return 'This sign-in has expired or was already used. Please start again.';
    }
    const back = new URL(pending.redirectUri);
    if (pending.clientState) {
      back.searchParams.set('state', pending.clientState);
    }
    back.searchParams.set('iss', issuer);
    const deny = (reason: string) => {
      request.log.warn({ reason }, 'sign-in refused');
      back.searchParams.set('error', 'access_denied');
      return reply.redirect(back.toString());
    };

    if (!request.query.code) {
      return deny(`Google returned no code: ${request.query.error ?? 'unknown'}`);
    }
    let identity: GoogleIdentity;
    try {
      const google = await options.google();
      identity = await google.identity({ code: request.query.code, codeVerifier: pending.googleCodeVerifier, nonce: pending.nonce });
    } catch (error) {
      if (error instanceof SignInError) {
        return deny(error.message);
      }
      throw error;
    }
    if (!(await workspace.isActive(identity.sub))) {
      return deny('The account is suspended or removed in Workspace');
    }

    const user = { googleId: identity.sub, email: identity.email, name: identity.name };
    const claims = await subject(user);
    await store.saveUser(identity);
    const code = await store.createCode({
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      codeChallenge: pending.codeChallenge,
      claims,
    });
    back.searchParams.set('code', code);
    return reply.redirect(back.toString());
  });

  app.post<{ Body: Record<string, string | undefined> }>('/token', open, async (request, reply) => {
    const body = request.body ?? {};
    const client = await findClient(body.client_id);
    if (!client) {
      reply.code(401).header('cache-control', 'no-store');
      return { error: 'invalid_client', error_description: 'Unknown client' };
    }

    if (body.grant_type === 'authorization_code') {
      const code = body.code ? await store.takeCode(body.code) : undefined;
      if (
        !code ||
        code.clientId !== client.clientId ||
        code.redirectUri !== body.redirect_uri ||
        !body.code_verifier ||
        challengeOf(body.code_verifier) !== code.codeChallenge
      ) {
        return refuse(reply, 'invalid_grant', 'The code is not valid');
      }
      const { refreshToken } = await store.startSession({
        googleId: code.googleId,
        clientId: client.clientId,
        lifetimeSeconds: client.web ? WEB_SESSION_SECONDS : MCP_SESSION_SECONDS,
      });
      return issuePair(reply, code.claims, refreshToken);
    }

    if (body.grant_type === 'refresh_token') {
      const session = body.refresh_token ? await store.useRefreshToken(body.refresh_token, client.clientId) : 'unknown';
      if (typeof session === 'string') {
        if (session === 'reused') {
          request.log.warn({ clientId: client.clientId }, 'a Refresh Token was used twice; its session is ended');
        }
        return refuse(reply, 'invalid_grant', 'The Refresh Token is not valid');
      }
      const user = await store.user(session.googleId);
      if (!user || !(await workspace.isActive(user.googleId))) {
        await store.endSessionsOf(session.googleId, 'account-inactive');
        return refuse(reply, 'invalid_grant', 'The account is no longer active');
      }
      const claims = await subject(user);
      if (!client.web) {
        await store.extendSession(session.id, MCP_SESSION_SECONDS);
      }
      return issuePair(reply, claims, await store.addRefreshToken(session.id));
    }

    return refuse(reply, 'unsupported_grant_type', 'Use authorization_code or refresh_token');
  });

  // The Data Team ends every session of a User at once (TR-PF-25), such as after a lost laptop.
  // Not public: it needs an Access Token with the role of the Data Team.
  app.delete<{ Params: { googleId: string } }>('/users/:googleId/sessions', async (request, reply) => {
    if (!request.user?.roles.includes('datateam')) {
      return reply.code(403).send({ error: 'forbidden', message: 'Only the Data Team may end the sessions of a User.' });
    }
    await store.endSessionsOf(request.params.googleId, 'ended-by-data-team');
    request.log.info({ googleId: request.params.googleId, by: request.user.sub }, 'all sessions of a User ended');
    return reply.code(204).send();
  });

  // Logging out (RFC 7009): ends the session of a Refresh Token. Always answers 200.
  app.post<{ Body: Record<string, string | undefined> }>('/revoke', open, async (request, reply) => {
    if (request.body?.token) {
      await store.endSessionOf(request.body.token, 'logged-out');
    }
    reply.code(200).header('cache-control', 'no-store');
    return {};
  });
}

/** The PKCE challenge of a verifier: base64url(SHA-256(verifier)) (RFC 7636, S256). */
export function challengeOf(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

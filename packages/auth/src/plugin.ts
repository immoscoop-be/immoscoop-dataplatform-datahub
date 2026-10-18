import type { AccessTokenClaims } from '@datahub/contracts';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { TokenError, type TokenVerifier } from './verifier.js';

declare module 'fastify' {
  interface FastifyContextConfig {
    /** Marks a route as reachable without an access token, such as a health check or a login. */
    public?: boolean;
  }
  interface FastifyRequest {
    /** The validated claims of the caller; set on every route that is not public. */
    user: AccessTokenClaims | null;
  }
}

export interface AuthPluginOptions {
  verifier: TokenVerifier;
  /**
   * The WWW-Authenticate header of every 401, telling a client where to sign in. mcp points MCP
   * clients such as Claude to its protected resource metadata (RFC 9728).
   */
  challenge?: string;
}

/**
 * Requires a valid access token on every route, unless the route is marked public
 * (TR-PF-03, TR-PF-14). Routes are protected by default, so a forgotten check fails closed,
 * and an unknown route answers 401 rather than revealing that it does not exist.
 */
const plugin: FastifyPluginAsync<AuthPluginOptions> = async (app, { verifier, challenge }) => {
  app.decorateRequest('user', null);

  app.addHook('onRequest', async (request, reply) => {
    if (request.routeOptions.config?.public) {
      return;
    }
    const deny = (message: string) => {
      if (challenge) {
        reply.header('www-authenticate', challenge);
      }
      return reply.code(401).send({ error: 'unauthorized', message });
    };
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    if (!token) {
      return deny('An access token is required.');
    }
    try {
      request.user = await verifier.verify(token);
    } catch (error) {
      if (!(error instanceof TokenError)) {
        throw error;
      }
      request.log.info({ reason: error.message }, 'access token rejected');
      return deny('The access token is not valid.');
    }
  });
};

export const authPlugin = fp(plugin, { name: '@datahub/auth', fastify: '5.x' });

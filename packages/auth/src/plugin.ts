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
}

/**
 * Requires a valid access token on every route, unless the route is marked public
 * (TR-PF-03, TR-PF-14). Routes are protected by default, so a forgotten check fails closed,
 * and an unknown route answers 401 rather than revealing that it does not exist.
 */
const plugin: FastifyPluginAsync<AuthPluginOptions> = async (app, { verifier }) => {
  app.decorateRequest('user', null);

  app.addHook('onRequest', async (request, reply) => {
    if (request.routeOptions.config?.public) {
      return;
    }
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    if (!token) {
      return reply.code(401).send({ error: 'unauthorized', message: 'An access token is required.' });
    }
    try {
      request.user = await verifier.verify(token);
    } catch (error) {
      if (!(error instanceof TokenError)) {
        throw error;
      }
      request.log.info({ reason: error.message }, 'access token rejected');
      return reply.code(401).send({ error: 'unauthorized', message: 'The access token is not valid.' });
    }
  });
};

export const authPlugin = fp(plugin, { name: '@datahub/auth', fastify: '5.x' });

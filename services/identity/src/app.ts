import type { TokenVerifier } from '@datahub/auth';
import { createServer, type ServerOptions } from '@datahub/server';
import type { FastifyInstance } from 'fastify';
import { signInRoutes, type SignInOptions } from './sign-in.js';
import type { TokenIssuer } from './tokens.js';

export interface AppOptions {
  verifier: TokenVerifier;
  tokens: TokenIssuer;
  /** Signing in through Google, for the web app and MCP clients; needs the database. */
  signIn?: SignInOptions;
  logger?: ServerOptions['logger'];
}

/** The identity service: sign in with Google, groups from Workspace, library cards and access tokens. See docs/architecture/services/identity.md. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = await createServer({ name: 'identity', verifier: options.verifier, logger: options.logger });

  // Every service validates Access Tokens against these keys (TR-PF-02, TR-PF-03).
  app.get('/.well-known/jwks.json', { config: { public: true } }, async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=300');
    return options.tokens.jwks();
  });

  if (options.signIn) {
    await app.register(signInRoutes, options.signIn);
  }

  return app;
}

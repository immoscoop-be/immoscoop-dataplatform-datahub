import type { TokenVerifier } from '@datahub/auth';
import { createServer, type ServerOptions } from '@datahub/server';
import type { FastifyInstance } from 'fastify';

export interface AppOptions {
  verifier: TokenVerifier;
  logger?: ServerOptions['logger'];
}

/** The identity service: sign in with Google, groups from Workspace, library cards and access tokens. See docs/architecture/services/identity.md. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = await createServer({ name: 'identity', ...options });
  return app;
}

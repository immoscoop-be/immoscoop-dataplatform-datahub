import type { TokenVerifier } from '@datahub/auth';
import { createServer, type ServerOptions } from '@datahub/server';
import type { FastifyInstance } from 'fastify';

export interface AppOptions {
  verifier: TokenVerifier;
  logger?: ServerOptions['logger'];
}

/** The catalogue service: resources, collections, maturity, the resource card, the log, search and conversations. See docs/architecture/services/catalogue.md. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = await createServer({ name: 'catalogue', ...options });
  return app;
}

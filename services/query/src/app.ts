import type { TokenVerifier } from '@datahub/auth';
import { createServer, type ServerOptions } from '@datahub/server';
import type { FastifyInstance } from 'fastify';

export interface AppOptions {
  verifier: TokenVerifier;
  logger?: ServerOptions['logger'];
}

/** The query service: running queries on the stacks: previews, free SQL for Claude, feeds for Excel. See docs/architecture/services/query.md. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = await createServer({ name: 'query', ...options });
  return app;
}

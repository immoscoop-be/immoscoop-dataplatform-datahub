import type { TokenVerifier } from '@datahub/auth';
import { createServer, type ServerOptions } from '@datahub/server';
import type { FastifyInstance } from 'fastify';

export interface AppOptions {
  verifier: TokenVerifier;
  logger?: ServerOptions['logger'];
}

/** The registry service: fetching, storing and processing the dbt artifacts: nodes, lineage and changes. See docs/architecture/services/registry.md. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = await createServer({ name: 'registry', ...options });
  return app;
}

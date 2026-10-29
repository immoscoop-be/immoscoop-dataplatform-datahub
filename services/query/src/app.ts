import type { TokenVerifier } from '@datahub/auth';
import { createServer, type ServerOptions } from '@datahub/server';
import type { FastifyInstance } from 'fastify';
import { type ApiOptions, apiRoutes } from './api.js';

export interface AppOptions {
  verifier: TokenVerifier;
  logger?: ServerOptions['logger'];
  /** Queries, catalogue and BigQuery; left out in tests that do not need them. */
  api?: ApiOptions;
}

/** The query service: queries on the Resources, their Pre-flight, their runs and the Query Log. See docs/architecture/services/query.md. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = await createServer({ name: 'query', ...options });
  if (options.api) {
    await app.register(apiRoutes, options.api);
  }
  return app;
}

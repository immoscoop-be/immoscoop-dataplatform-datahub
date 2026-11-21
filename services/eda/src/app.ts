import type { TokenVerifier } from '@datahub/auth';
import { createServer, type ServerOptions } from '@datahub/server';
import type { FastifyInstance } from 'fastify';
import { type ApiOptions, apiRoutes } from './api.js';

export interface AppOptions {
  verifier: TokenVerifier;
  logger?: ServerOptions['logger'];
  /** The EDAs, catalogue and query; left out in tests that do not need them. */
  api?: ApiOptions;
}

/** The eda service: the EDA of each Resource, its EDA-Probes, runs and readings. See docs/architecture/services/eda.md. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = await createServer({ name: 'eda', ...options });
  if (options.api) {
    await app.register(apiRoutes, options.api);
  }
  return app;
}

import type { TokenVerifier } from '@datahub/auth';
import { createServer, type ServerOptions } from '@datahub/server';
import type { FastifyInstance } from 'fastify';
import { type WebhookOptions, webhookRoutes } from './webhook.js';

export interface AppOptions {
  verifier: TokenVerifier;
  logger?: ServerOptions['logger'];
  /** The webhook of dbt Cloud; left out in tests that do not need it. */
  webhook?: WebhookOptions;
}

/** The registry service: fetching, storing and processing the dbt artifacts: nodes, lineage and changes. See docs/architecture/services/registry.md. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = await createServer({ name: 'registry', ...options });
  if (options.webhook) {
    await app.register(webhookRoutes, options.webhook);
  }
  return app;
}

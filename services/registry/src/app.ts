import type { TokenVerifier } from '@datahub/auth';
import { createServer, type ServerOptions } from '@datahub/server';
import type { FastifyInstance } from 'fastify';
import { type AdminOptions, adminRoutes } from './admin-api.js';
import { type ApiOptions, apiRoutes } from './api.js';
import { type InternalOptions, internalRoutes } from './internal.js';
import { type WebhookOptions, webhookRoutes } from './webhook.js';

export interface AppOptions {
  verifier: TokenVerifier;
  logger?: ServerOptions['logger'];
  /** The webhook of dbt Cloud; left out in tests that do not need it. */
  webhook?: WebhookOptions;
  /** Reading the registry and processing a run again; left out in tests that do not need it. */
  api?: ApiOptions;
  /** What other services ask as themselves; left out in tests that do not need it. */
  internal?: InternalOptions;
  /** The page Webhooks of Admin, for the Data Team (FR-AR-18, FR-AR-19); left out in tests that do not need it. */
  admin?: AdminOptions;
}

/** The registry service: fetching, storing and processing the dbt artifacts: nodes, lineage and changes. See docs/architecture/services/registry.md. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = await createServer({ name: 'registry', ...options });
  if (options.webhook) {
    await app.register(webhookRoutes, options.webhook);
  }
  if (options.api) {
    await app.register(apiRoutes, options.api);
  }
  if (options.internal) {
    await app.register(internalRoutes, options.internal);
  }
  if (options.admin) {
    await app.register(adminRoutes, options.admin);
  }
  return app;
}

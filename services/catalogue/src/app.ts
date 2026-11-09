import type { TokenVerifier } from '@datahub/auth';
import { createServer, type ServerOptions } from '@datahub/server';
import type { FastifyInstance } from 'fastify';
import { type ApiOptions, apiRoutes } from './api.js';
import { type NotificationRouteOptions, notificationRoutes } from './notification-api.js';

export interface AppOptions {
  verifier: TokenVerifier;
  logger?: ServerOptions['logger'];
  /** Collections and the groups of the User; left out in tests that do not need them. */
  api?: ApiOptions;
  /** Notifications by e-mail and in Slack (DEC-LN-02); left out in tests that do not need them. */
  notifications?: NotificationRouteOptions;
}

/** The catalogue service: resources, collections, maturity, the resource card, the log, search and conversations. See docs/architecture/services/catalogue.md. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = await createServer({ name: 'catalogue', ...options });
  // First, so that its hook covers every route that writes a Message.
  if (options.notifications) {
    await notificationRoutes(app, options.notifications);
  }
  if (options.api) {
    await app.register(apiRoutes, options.api);
  }
  return app;
}

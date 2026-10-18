import { authPlugin, type TokenVerifier } from '@datahub/auth';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

export interface ServerOptions {
  /** The name of the service, as it appears in logs and in the health check. */
  name: string;
  /** Validates the access token on every request that is not public. */
  verifier: TokenVerifier;
  /** The WWW-Authenticate header of every 401 (see AuthPluginOptions). */
  challenge?: string;
  /** Overrides the logger; tests pass `false`. */
  logger?: FastifyServerOptions['logger'];
}

/** Cloud Logging reads `severity`; pino levels are mapped onto its names. */
const severity: Record<string, string> = {
  trace: 'DEBUG',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL',
};

/**
 * The common shape of every Data Hub service: structured logs for Cloud Logging, a public
 * health check, and the access token required on every other route (TR-PF-03).
 */
export async function createServer(options: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? {
      level: process.env.LOG_LEVEL ?? 'info',
      messageKey: 'message',
      base: { service: options.name },
      formatters: { level: (label) => ({ severity: severity[label] ?? 'DEFAULT' }) },
    },
  });

  await app.register(authPlugin, { verifier: options.verifier, challenge: options.challenge });

  app.get('/health', { config: { public: true } }, async () => ({ status: 'ok', service: options.name }));

  return app;
}

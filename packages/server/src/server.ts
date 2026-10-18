import { authPlugin, type TokenVerifier } from '@datahub/auth';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

export interface ServerOptions {
  /** The name of the service, as it appears in logs and in the health check. */
  name: string;
  /** Validates the access token on every request that is not public. */
  verifier: TokenVerifier;
  /** The WWW-Authenticate header of every 401 (see AuthPluginOptions). */
  challenge?: string;
  /**
   * The web addresses whose pages may call this service from the browser (CORS), such as the web
   * app's. Defaults to DATAHUB_ALLOWED_ORIGINS, comma-separated.
   */
  allowedOrigins?: string[];
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

  allowOrigins(app, options.allowedOrigins ?? (process.env.DATAHUB_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean));
  await app.register(authPlugin, { verifier: options.verifier, challenge: options.challenge });

  app.get('/health', { config: { public: true } }, async () => ({ status: 'ok', service: options.name }));

  return app;
}

/**
 * Lets pages on the listed origins call this service from the browser (CORS). The browser asks
 * first (the preflight), without a token; that question is answered before the token check. The
 * services take the Access Token in a header, never a cookie, so no credentials are allowed.
 */
function allowOrigins(app: FastifyInstance, origins: string[]): void {
  if (origins.length === 0) {
    return;
  }
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (!origin || !origins.includes(origin)) {
      return;
    }
    reply.header('access-control-allow-origin', origin).header('vary', 'Origin');
    if (request.method === 'OPTIONS' && request.headers['access-control-request-method']) {
      return reply
        .code(204)
        .header('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE')
        .header('access-control-allow-headers', 'authorization, content-type')
        .header('access-control-max-age', '600')
        .send();
    }
  });
}

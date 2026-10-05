import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { createTranslator, BASE_LOCALE } from './core/i18n.ts';
import { localizeIssue, type IssueSpec } from './core/issues.ts';
import { loadRegistry, type Registry } from './core/registry.ts';
import { docsRoutes } from './routes/docs.ts';
import { galleryRoutes } from './routes/gallery.ts';
import { healthRoutes } from './routes/health.ts';
import { renderRoutes } from './routes/render.ts';
import { semgraphRoutes } from './routes/semgraphs.ts';

export interface AppOptions {
  registry?: Registry;
  /** The clock; tests pin it so "today" is fixed. */
  now?: () => Date;
  logger?: FastifyServerOptions['logger'];
}

export interface Dependencies {
  registry: Registry;
  now: () => Date;
}

/** 1 MB: 1100 days of data fit many times over. */
const BODY_LIMIT = 1024 * 1024;

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const registry = options.registry ?? (await loadRegistry());
  const dependencies: Dependencies = { registry, now: options.now ?? (() => new Date()) };
  const app = Fastify({
    logger: options.logger ?? { level: process.env.LOG_LEVEL ?? 'info' },
    bodyLimit: BODY_LIMIT,
  });

  // Requests are JSON only; anything else gets 415.
  app.removeContentTypeParser('text/plain');

  const t = createTranslator(registry.locales, BASE_LOCALE);
  const problem = (spec: IssueSpec) => ({
    outcome: 'invalid',
    locale: BASE_LOCALE,
    issues: [localizeIssue(t, spec)],
  });

  // Fastify's own errors (bad JSON, too large, wrong content type) get the same issue format.
  app.setErrorHandler((error: { statusCode?: number; code?: string; message: string }, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status === 413) return reply.code(413).send(problem({ level: 'inputError', code: 'payloadTooLarge' }));
    if (status === 415) return reply.code(415).send(problem({ level: 'inputError', code: 'unsupportedMediaType' }));
    if (status >= 400 && status < 500) {
      return reply
        .code(status)
        .send(problem({ level: 'inputError', code: 'badRequest', params: { detail: error.message } }));
    }
    request.log.error({ err: error }, 'unexpected error');
    return reply.code(500).send({
      outcome: 'error',
      locale: BASE_LOCALE,
      issues: [{ level: 'error', code: 'internalError', message: t('issues.internalError.message'), alternative: t('issues.internalError.alternative') }],
    });
  });
  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send(problem({ level: 'inputError', code: 'notFound', params: { path: request.url.split('?')[0]! } })),
  );

  healthRoutes(app, dependencies);
  semgraphRoutes(app, dependencies);
  renderRoutes(app, dependencies);
  galleryRoutes(app, dependencies);
  await docsRoutes(app, dependencies);
  return app;
}

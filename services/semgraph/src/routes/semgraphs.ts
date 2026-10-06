import type { FastifyInstance } from 'fastify';
import type { Dependencies } from '../app.ts';
import { describe, overview, translatorFor, unknownSemgraph } from '../core/catalog.ts';

interface LocaleQuery {
  Querystring: { locale?: string };
}

export function semgraphRoutes(app: FastifyInstance, { registry }: Dependencies): void {
  app.get<LocaleQuery>('/semgraphs', async (request) => overview(registry, translatorFor(registry, request.query.locale)));

  app.get<LocaleQuery & { Params: { id: string } }>('/semgraphs/:id', async (request, reply) => {
    const t = translatorFor(registry, request.query.locale);
    const loaded = registry.semgraphs.get(request.params.id);
    if (!loaded) {
      return reply.code(404).send({ outcome: 'invalid', locale: t.locale, issues: [unknownSemgraph(registry, request.params.id, t)] });
    }
    return describe(loaded, t);
  });
}

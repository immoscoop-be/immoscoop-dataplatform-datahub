import type { FastifyInstance } from 'fastify';
import type { Dependencies } from '../app.ts';
import { describe, overview, translatorFor, unknownSemgraph } from '../core/catalog.ts';
import { ICON_SIZE } from '../core/icon.ts';

/** An icon from this service may be opened directly in a browser: no scripts, no external loads. */
const ICON_HEADERS = {
  'content-type': 'image/svg+xml; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'",
};

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

  // REQ-060: the icon of a semgraph as a picture of its own, in currentColor, so a page can show it in the colour
  // of its text, as a mask; Charts in Data Hub does (TR-PF-34 of Data Hub).
  app.get<LocaleQuery & { Params: { id: string } }>('/semgraphs/:id/icon', async (request, reply) => {
    const loaded = registry.semgraphs.get(request.params.id);
    if (!loaded) {
      const t = translatorFor(registry, request.query.locale);
      return reply.code(404).send({ outcome: 'invalid', locale: t.locale, issues: [unknownSemgraph(registry, request.params.id, t)] });
    }
    const size = String(ICON_SIZE);
    return reply
      .headers(ICON_HEADERS)
      .send(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">${loaded.icon}</svg>`);
  });
}

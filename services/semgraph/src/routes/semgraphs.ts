import type { FastifyInstance } from 'fastify';
import type { Dependencies } from '../app.ts';
import { createTranslator, resolveLocale } from '../core/i18n.ts';
import { localizeIssue } from '../core/issues.ts';

interface LocaleQuery {
  Querystring: { locale?: string };
}

export function semgraphRoutes(app: FastifyInstance, { registry }: Dependencies): void {
  const translator = (requested: string | undefined) =>
    createTranslator(registry.locales, resolveLocale(requested, registry.locales.keys()).locale);

  app.get<LocaleQuery>('/semgraphs', async (request) => {
    const t = translator(request.query.locale);
    return {
      locale: t.locale,
      semgraphs: [...registry.semgraphs.values()].map(({ id, metadata }) => ({
        id,
        title: t(metadata.title),
        answers: t(metadata.answers),
        href: `/semgraphs/${id}`,
      })),
      planned: registry.catalog.filter((entry) => entry.status === 'planned').map((entry) => entry.id),
    };
  });

  app.get<LocaleQuery & { Params: { id: string } }>('/semgraphs/:id', async (request, reply) => {
    const t = translator(request.query.locale);
    const loaded = registry.semgraphs.get(request.params.id);
    if (!loaded) {
      const planned = registry.catalog.some((entry) => entry.id === request.params.id && entry.status === 'planned');
      const issue = localizeIssue(t, {
        level: 'inputError',
        code: planned ? 'plannedSemgraph' : 'unknownSemgraph',
        params: { value: request.params.id, available: [...registry.semgraphs.keys()].join(', ') },
      });
      return reply.code(404).send({ outcome: 'invalid', locale: t.locale, issues: [issue] });
    }
    const { id, metadata, schema, examples } = loaded;
    return {
      id,
      locale: t.locale,
      title: t(metadata.title),
      answers: t(metadata.answers),
      exampleQuestions: metadata.exampleQuestions.map((key) => t(key)),
      attributes: metadata.attributes,
      doNotUseWhen: metadata.doNotUseWhen,
      data: metadata.data,
      links: metadata.links,
      examples: [...examples.keys()].map((name) => ({ name, href: `/semgraphs/${id}/examples/${name}` })),
      schema,
    };
  });
}

import type { FastifyInstance } from 'fastify';
import type { Dependencies } from '../app.ts';
import { createTranslator, resolveLocale } from '../core/i18n.ts';
import { localizeIssue } from '../core/issues.ts';
import type { LoadedSemgraph } from '../core/registry.ts';

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
      // REQ-074: the overview of every chart on offer, each with links to its examples.
      semgraphs: [...registry.semgraphs.values()].map((loaded) => ({
        id: loaded.id,
        title: t(loaded.metadata.title),
        answers: t(loaded.metadata.answers),
        href: `/semgraphs/${loaded.id}`,
        links: loaded.metadata.links,
        examples: exampleLinks(loaded),
      })),
      planned: registry.catalog.filter((entry) => entry.status === 'planned').map((entry) => entry.id),
      gallery: '/gallery',
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
    const { id, metadata, schema } = loaded;
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
      examples: exampleLinks(loaded),
      schema,
    };
  });
}

/** The examples of a semgraph: their name, their title as the chart shows it, and where to see them drawn. */
export function exampleLinks({ id, examples }: LoadedSemgraph): { name: string; title: string; href: string }[] {
  return [...examples].map(([name, request]) => {
    const title = (request as { title?: unknown }).title;
    return { name, title: typeof title === 'string' ? title : name, href: `/semgraphs/${id}/examples/${name}` };
  });
}

import { createTranslator, resolveLocale, type Translator } from './i18n.ts';
import { localizeIssue, type Issue } from './issues.ts';
import { DOCS_PATH, OPENAPI_PATH } from './openapi.ts';
import type { LoadedSemgraph, Registry } from './registry.ts';

/**
 * What the service offers, as REST (GET /semgraphs) and MCP (list_semgraphs, describe_semgraph) show it.
 * Both access layers give the same content: it is built here once.
 */

export function translatorFor(registry: Registry, requested: string | undefined): Translator {
  return createTranslator(registry.locales, resolveLocale(requested, registry.locales.keys()).locale);
}

/** REQ-083: the overview of every chart on offer, each with links to its examples. */
export function overview(registry: Registry, t: Translator) {
  return {
    locale: t.locale,
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
    // REQ-084: the API itself, for a program or an agent, and to read it in Swagger UI.
    openapi: OPENAPI_PATH,
    docs: DOCS_PATH,
  };
}

/** One semgraph: when to use it and when not, its attributes, its contract and its examples. */
export function describe(loaded: LoadedSemgraph, t: Translator) {
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
}

/** The issue for an id that is not on offer: unknown, or planned but not built yet. */
export function unknownSemgraph(registry: Registry, id: string, t: Translator): Issue {
  const planned = registry.catalog.some((entry) => entry.id === id && entry.status === 'planned');
  return localizeIssue(t, {
    level: 'inputError',
    code: planned ? 'plannedSemgraph' : 'unknownSemgraph',
    params: { value: id, available: [...registry.semgraphs.keys()].join(', ') },
  });
}

/** The examples of a semgraph: their name, their title as the chart shows it, and where to see them drawn. */
export function exampleLinks({ id, examples }: LoadedSemgraph): { name: string; title: string; href: string }[] {
  return [...examples].map(([name, request]) => {
    const title = (request as { title?: unknown }).title;
    return { name, title: typeof title === 'string' ? title : name, href: `/semgraphs/${id}/examples/${name}` };
  });
}

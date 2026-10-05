import { currentDay, localizeDay, parseDay } from './days.ts';
import type { Translator } from './i18n.ts';
import type { IssueSpec } from './issues.ts';
import { isWebLink } from './render/escape.ts';
import type { MetaItem, PanelBlock } from './render/meta.ts';

/** The metadata a caller may give with a chart (REQ-010). */
export interface ChartMeta {
  question?: string;
  askedBy?: string;
  builtBy?: string;
  references?: { label?: string; url: string }[];
  query?: string;
  compiledOn?: string;
}

/** The meta object of every contract. */
export const META_SCHEMA = {
  description:
    'Metadata of the chart (REQ-010): the question that started it, references, the query, who asked and who built it, and the day it was compiled. Only what is given is shown (REQ-020).',
  type: 'object',
  additionalProperties: false,
  properties: {
    question: { description: 'The question that started the chart.', type: 'string', minLength: 1, maxLength: 1000 },
    askedBy: { description: 'Who asked the question.', type: 'string', minLength: 1, maxLength: 80 },
    builtBy: { description: 'Who built the chart.', type: 'string', minLength: 1, maxLength: 80 },
    references: {
      description: 'Links to Jira, Slack or anything else.',
      type: 'array',
      minItems: 1,
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['url'],
        properties: {
          label: { type: 'string', minLength: 1, maxLength: 120 },
          url: { type: 'string', minLength: 1, maxLength: 500 },
        },
      },
    },
    query: { description: 'The query behind the data, shown as written.', type: 'string', minLength: 1, maxLength: 10000 },
    compiledOn: {
      description: 'The day the chart was compiled. When absent, the day it is drawn, in Brussels.',
      type: 'string',
      pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
    },
  },
} as const;

/** What the schema cannot check: web links only, an existing day. */
export function checkMeta(meta: ChartMeta | undefined): IssueSpec[] {
  if (!meta) return [];
  const issues: IssueSpec[] = [];
  meta.references?.forEach(({ url }, index) => {
    if (!isWebLink(url)) issues.push({ level: 'inputError', code: 'invalidUrl', field: `/meta/references/${index}/url` });
  });
  if (meta.compiledOn !== undefined && parseDay(meta.compiledOn) === undefined) {
    issues.push({ level: 'inputError', code: 'invalidDate', field: '/meta/compiledOn', params: { value: meta.compiledOn } });
  }
  return issues;
}

/** REQ-011: the day the chart was compiled; without one, the day it is drawn. */
export function compiledDay(meta: ChartMeta | undefined, now: Date): number {
  return (meta?.compiledOn === undefined ? undefined : parseDay(meta.compiledOn)) ?? currentDay(now);
}

/**
 * The labels in the footer, one topic each (REQ-012, REQ-018): Question, References, Query and
 * Metadata. What is not there is not shown (REQ-020); Metadata always has the semgraph and version.
 */
export function metaItems(
  t: Translator,
  meta: ChartMeta | undefined,
  about: { semgraph: string; compiled: number; serviceVersion: string },
): MetaItem[] {
  const items: MetaItem[] = [];
  const question: PanelBlock[] = [
    ...(meta?.question ? [{ kind: 'text', text: meta.question } as const] : []),
    ...(meta?.askedBy ? [{ kind: 'text', text: t('meta.askedBy', { name: meta.askedBy }), muted: true } as const] : []),
  ];
  if (question.length > 0) items.push({ label: t('meta.question'), blocks: question });
  if (meta?.references?.length) {
    items.push({
      label: t('meta.references'),
      blocks: meta.references.map((reference) => ({ kind: 'link', text: reference.label ?? reference.url, href: reference.url })),
    });
  }
  if (meta?.query) items.push({ label: t('meta.query'), blocks: [{ kind: 'code', text: meta.query }] });
  items.push({
    label: t('meta.metadata'),
    blocks: [
      ...(meta?.builtBy ? [{ kind: 'field', name: t('meta.builtBy'), value: meta.builtBy } as const] : []),
      { kind: 'field', name: t('meta.compiledOn'), value: localizeDay(t, about.compiled, 'long') },
      { kind: 'field', name: t('meta.semgraph'), value: about.semgraph },
      // The version of the service that drew it; the version label of the chart language says something else: that it conforms.
      { kind: 'field', name: t('meta.version'), value: about.serviceVersion },
    ],
  });
  return items;
}

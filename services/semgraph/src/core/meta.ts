import { currentDay, localizeDay, parseDay } from './days.ts';
import type { Translator } from './i18n.ts';
import type { IssueSpec } from './issues.ts';
import { isWebLink } from './render/escape.ts';
import type { CardSection, Field, MetaCards, MetaItem, MetaKind, PanelBlock } from './render/meta.ts';
import type { RequestContext, SignSample } from './semgraph.ts';

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

/** What the cards of one chart are about, besides the metadata itself. */
export interface CardInput {
  /** The request as it came in: the parameters are read from it, nothing is computed (REQ-104). */
  request: Record<string, unknown> & { context?: RequestContext; meta?: ChartMeta };
  semgraph: string;
  /** The title of the chart, the title of every card but Learn (REQ-099). */
  title: string;
  compiled: number;
  asOf: number;
  serviceVersion: string;
  /** REQ-102, REQ-103: the lesson of this kind of chart, if one is written, and the reading card. */
  lesson?: { title: string; whatYouSee: string; watchOut: string };
  learning: string;
  /** REQ-102: the signs the chart really drew. */
  signs: readonly SignSample[];
}

/** REQ-104: the parameters of a request, in this order, as they were given; the type comes first. */
const PARAMETERS = ['metric', 'window', 'unit', 'statistic', 'comparison', 'period', 'day'] as const;

/**
 * The labels in the footer, one topic each (REQ-012, REQ-018, REQ-102): Question, References, Query, Metadata
 * and Learn, and the card each one opens (REQ-099). What is not there is not shown (REQ-020): Metadata always
 * has content; Learn only when a lesson is written for this kind of chart (REQ-103).
 */
export function metaCards(t: Translator, input: CardInput): MetaCards {
  const { request, title } = input;
  const meta = request.meta;
  const items: MetaItem[] = [];
  const item = (kind: MetaKind, sections: MetaItem['sections'], cardTitle = title): MetaItem => ({
    kind,
    label: t(`meta.${kind}`),
    eyebrow: t(`meta.eyebrow.${kind}`),
    title: cardTitle,
    sections,
  });

  const question: PanelBlock[] = [
    ...(meta?.question ? [{ kind: 'text', text: meta.question } as const] : []),
    ...(meta?.askedBy ? [{ kind: 'text', text: t('meta.askedBy', { name: meta.askedBy }), muted: true } as const] : []),
  ];
  if (question.length > 0) items.push(item('question', [{ label: t('meta.section.question'), blocks: question }]));
  if (meta?.references?.length) {
    const links = meta.references.map((reference) => ({ kind: 'link', text: reference.label ?? reference.url, href: reference.url }) as const);
    items.push(item('references', [{ label: t('meta.section.links'), blocks: links }]));
  }
  // REQ-100: the Query card shows only the title of the chart and the SQL.
  if (meta?.query) items.push(item('query', [{ label: t('meta.section.sql'), blocks: [{ kind: 'code', text: meta.query }] }]));
  items.push(item('metadata', metadataSections(t, input)));
  if (input.lesson) items.push(item('learn', lessonSections(t, input, input.lesson), t(input.lesson.title)));

  return {
    items,
    compiled: t('footer.compiled', { date: localizeDay(t, input.compiled, 'numeric') }),
    close: { mouse: t('meta.close.mouse'), touch: t('meta.close.touch') },
  };
}

/**
 * REQ-101, REQ-104: Parameters (what was asked of the chart server, straight from the request), Data
 * (dataset, as-of date, reliability label), and Made (by whom, compiled) next to Service (the version).
 */
function metadataSections(t: Translator, input: CardInput): MetaItem['sections'] {
  const field = (key: string, value: string, wide = false): Field => ({ name: t(`meta.field.${key}`), value, ...(wide ? { wide } : {}) });
  const parameters: Field[] = [field('type', input.semgraph, true)];
  for (const key of PARAMETERS) {
    const value = input.request[key];
    if (key === 'window' && typeof value === 'number') parameters.push(field(key, value === 1 ? t('meta.oneDay') : t('meta.days', { n: value })));
    // A unit is a calendar unit here; the unit of a value (a prefix or suffix) is no parameter of the chart.
    else if (typeof value === 'string' || typeof value === 'number') parameters.push(field(key, String(value)));
  }
  const context = input.request.context ?? {};
  const dataset = [context.domain, context.dataset].filter(Boolean).join(' › ');
  const data: Field[] = [
    ...(dataset ? [field('dataset', dataset, true)] : []),
    field('asOf', localizeDay(t, input.asOf, 'full')),
    ...(context.reliability ? [field('reliability', context.reliability)] : []),
  ];
  const builtBy = input.request.meta?.builtBy;
  const made: Field[] = [...(builtBy ? [field('builtBy', builtBy)] : []), field('compiled', localizeDay(t, input.compiled, 'full'))];
  // The version of the service that drew it; the version label of the chart language says something else: that it conforms.
  const service: Field[] = [field('semgraph', t('meta.version', { version: input.serviceVersion }))];
  const section = (key: string, fields: Field[]): CardSection => ({ label: t(`meta.section.${key}`), blocks: [{ kind: 'fields', fields }] });
  return [section('parameters', parameters), section('data', data), [section('made', made), section('service', service)]];
}

/**
 * REQ-102: the lesson of this kind of chart: what you see, the signs this chart really drew, what to watch
 * out for, and the full reading card in the course.
 */
function lessonSections(t: Translator, input: CardInput, lesson: NonNullable<CardInput['lesson']>): CardSection[] {
  return [
    { label: t('meta.section.whatYouSee'), blocks: [{ kind: 'text', text: t(lesson.whatYouSee) }] },
    ...(input.signs.length > 0
      ? [{ label: t('meta.section.signs'), blocks: [{ kind: 'signs', signs: input.signs.map(({ sign, markup }) => ({ markup, text: t(`meta.signs.${sign}`) })) } as const] }]
      : []),
    {
      label: t('meta.section.watchOut'),
      blocks: [
        { kind: 'text', text: t(lesson.watchOut) },
        { kind: 'link', text: t('meta.readingCard'), href: input.learning },
      ],
    },
  ];
}

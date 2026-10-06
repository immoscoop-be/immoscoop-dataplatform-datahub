import { localizeDay } from './days.ts';
import { createTranslator, resolveLocale, type Translator } from './i18n.ts';
import { localizeIssue, localizeParams, outcomeOf, type Issue, type IssueSpec, type Outcome } from './issues.ts';
import { checkMeta, compiledDay, metaCards, type ChartMeta } from './meta.ts';
import type { LoadedSemgraph, Registry } from './registry.ts';
import { hasIllegalXmlCharacters, isWebLink } from './render/escape.ts';
import { HoverLayer, RowHoverLayer } from './render/hover.ts';
import { composeSvg, type Footer, type Segment } from './render/template.ts';
import { renderVegaLite } from './render/vega.ts';
import { schemaIssues } from './schema.ts';
import { sizeOf } from './size.ts';
import { themeOf, tokensFor } from './tokens.ts';
import type { RequestContext } from './semgraph.ts';

export interface Report {
  outcome: Outcome;
  semgraph?: string;
  locale: string;
  issues: Issue[];
}

export interface PipelineResult {
  report: Report;
  /** Codes of the tolerated deviations, also sent in the Semgraph-Deviations header. */
  deviations: string[];
  /** Only for render, and only when the outcome is ok or deviation. */
  svg?: string;
  /** Warnings from Vega-Lite or Vega while drawing. */
  warnings: string[];
}

export interface PipelineOptions {
  now?: Date;
  /** false for /validate: run every check and the computation, but draw nothing. */
  draw?: boolean;
}

/** Only svg exists in v0; the other formats are part of the contract already. */
const AVAILABLE_FORMATS = new Set(['svg']);

/**
 * The core, shared by every access layer: specification (JSON Schema) -> input checks ->
 * computation -> chart-language rules -> drawing (Vega-Lite) -> template around the chart.
 */
export async function runPipeline(registry: Registry, body: unknown, options: PipelineOptions = {}): Promise<PipelineResult> {
  const now = options.now ?? new Date();
  const requestedLocale = isObject(body) && typeof body.locale === 'string' ? body.locale : undefined;
  const { locale, matched } = resolveLocale(requestedLocale, registry.locales.keys());
  const t = createTranslator(registry.locales, locale);
  const issues: IssueSpec[] = [];
  if (!matched) issues.push({ level: 'info', code: 'localeFallback', params: { locale: requestedLocale ?? '' } });

  const finish = (semgraph?: string, extra: Partial<PipelineResult> = {}): PipelineResult => ({
    report: {
      outcome: outcomeOf(issues),
      ...(semgraph === undefined ? {} : { semgraph }),
      locale,
      issues: issues.map((issue) => localizeIssue(t, issue)),
    },
    deviations: issues.filter((issue) => issue.level === 'deviation').map((issue) => issue.code),
    warnings: [],
    ...extra,
  });

  const loaded = findSemgraph(registry, body, issues);
  if (!loaded) return finish();
  const { id, implementation, metadata } = loaded;

  if (!loaded.validate(body)) {
    issues.push(...schemaIssues(loaded.validate.errors, id));
    return finish(id);
  }
  const request = body as Record<string, unknown> & { format?: string; context?: RequestContext; meta?: ChartMeta };
  issues.push(...genericChecks(request));
  issues.push(...implementation.check(request));
  if (outcomeOf(issues) === 'invalid') return finish(id);

  const computed = implementation.compute(request, { now });
  issues.push(...implementation.rules(request, computed, { metadata }));
  const outcome = outcomeOf(issues);
  if (options.draw === false || (outcome !== 'ok' && outcome !== 'deviation')) return finish(id);

  // REQ-094: a dark chart is the same chart with the colours of the mode Dark.
  const theme = themeOf(request);
  const tokens = tokensFor(registry.tokens, theme);
  const drawing = implementation.draw(request, computed, { t, tokens, metadata });
  const plot = await renderVegaLite(drawing.vegaLite);
  const deviations = issues.filter((issue) => issue.level === 'deviation');
  // Every tolerated deviation is allowed, but discouraged: a red alert between the title and the chart
  // (REQ-038). A caution gets the same alert, but keeps the version label (REQ-047).
  const alerts = issues
    .filter((issue) => issue.level === 'deviation' || issue.level === 'caution')
    .map((issue) => t(`issues.${issue.code}.alert`, localizeParams(t, issue.params)));
  const compiled = compiledDay(request.meta, now);
  const meta = metaCards(t, {
    request,
    semgraph: id,
    title: drawing.title,
    compiled,
    asOf: drawing.asOf,
    serviceVersion: registry.version,
    ...(metadata.lesson ? { lesson: metadata.lesson } : {}),
    learning: metadata.links.learning,
    signs: drawing.signs ?? [],
  });
  const svg = composeSvg({
    width: drawing.width,
    // REQ-085: a slide and a big screen get the chart enlarged; the tile has no size and stays as it is.
    scale: sizeOf(request).scale,
    title: drawing.title,
    readingCue: drawing.readingCue,
    // REQ-060: the icon links to the reading card, like the learn line in the footer; with a lesson it opens
    // the Learn card, which links to the reading card (REQ-103).
    icon: {
      markup: loaded.icon,
      href: metadata.links.learning,
      label: t('footer.readingCard', { name: t(metadata.readingCard) }),
      opensLearn: meta.items.some((item) => item.kind === 'learn'),
    },
    alerts,
    defs: drawing.defs,
    description: drawing.description,
    plot: {
      svg: plot.svg,
      height: drawing.height,
      area: drawing.plotArea,
      overlay: new (drawing.hoverRows ? RowHoverLayer : HoverLayer)(tokens, drawing.plotArea, plot.scales).render(drawing.hover),
    },
    footer: footer(t, request.context ?? {}, { asOf: drawing.asOf, compiled }, loaded, deviations, registry.tokens.languageVersion),
    meta,
    tokens,
    data: {
      semgraph: id,
      'language-version': registry.tokens.languageVersion,
      'tokens-version': registry.tokens.version,
      ...(theme === 'dark' ? { theme } : {}),
    },
  });
  return finish(id, { svg: theme === 'dark' ? darkIds(svg) : svg, warnings: plot.warnings });
}

/**
 * The ids of the patterns are the same for the same chart, so several charts can share a page (REQ-036). The
 * light and the dark version of one chart are two charts there: on one page, the dark one would otherwise fill
 * with the patterns of the light one (REQ-094).
 */
function darkIds(svg: string): string {
  return svg.replace(/\bsemgraph-([a-z]+)-([0-9a-f]{8})\b/g, 'semgraph-$1-$2-dark');
}

function findSemgraph(registry: Registry, body: unknown, issues: IssueSpec[]): LoadedSemgraph | undefined {
  const available = [...registry.semgraphs.keys()].join(', ');
  if (!isObject(body)) {
    issues.push({ level: 'inputError', code: 'notAnObject' });
    return undefined;
  }
  if (typeof body.semgraph !== 'string') {
    issues.push({ level: 'inputError', code: 'missingSemgraph', field: '/semgraph', params: { available } });
    return undefined;
  }
  const loaded = registry.semgraphs.get(body.semgraph);
  if (loaded) return loaded;
  const planned = registry.catalog.some((entry) => entry.id === body.semgraph && entry.status === 'planned');
  issues.push({
    level: 'inputError',
    code: planned ? 'plannedSemgraph' : 'unknownSemgraph',
    field: '/semgraph',
    params: { value: body.semgraph, available },
  });
  return undefined;
}

/** Checks that hold for every semgraph: showable text, web links only, an available format. */
function genericChecks(request: Record<string, unknown> & { format?: string; context?: RequestContext; meta?: ChartMeta }): IssueSpec[] {
  const issues: IssueSpec[] = [];
  walkStrings(request, '', (value, pointer) => {
    if (hasIllegalXmlCharacters(value)) issues.push({ level: 'inputError', code: 'invalidCharacters', field: pointer });
  });
  const url = request.context?.definitionUrl;
  if (url !== undefined && !isWebLink(url)) {
    issues.push({ level: 'inputError', code: 'invalidUrl', field: '/context/definitionUrl' });
  }
  issues.push(...checkMeta(request.meta));
  const format = request.format ?? 'svg';
  if (!AVAILABLE_FORMATS.has(format)) {
    issues.push({ level: 'inputError', code: 'formatNotAvailable', field: '/format', params: { format } });
  }
  return issues;
}

function footer(
  t: Translator,
  context: RequestContext,
  days: { asOf: number; compiled: number },
  loaded: LoadedSemgraph,
  deviations: IssueSpec[],
  languageVersion: string,
): Footer {
  const separator = (text: string): Segment => ({ text: ` ${text} ` });
  const definition: Segment = context.definitionUrl
    ? { text: t('footer.definition'), href: context.definitionUrl }
    : { text: t('footer.definitionUnknown') };
  return {
    // Absence is never polished away: missing context is printed as unknown.
    origin: [
      { text: context.domain ?? t('footer.unknownDomain') },
      separator('›'),
      { text: context.dataset ?? t('footer.unknownDataset') },
      separator('·'),
      { text: context.owner ?? t('footer.unknownOwner') },
    ],
    status: [
      { text: context.reliability ?? t('footer.unknownReliability') },
      separator('·'),
      { text: t('footer.asOf', { date: localizeDay(t, days.asOf, 'numeric') }) },
      separator('·'),
      // REQ-011: the day the chart was compiled is always there, bold, next to the as-of date of the data.
      { text: t('footer.compiled', { date: localizeDay(t, days.compiled, 'numeric') }), strong: true },
      separator('·'),
      definition,
    ],
    learn: [
      { text: `${t('footer.howToRead')}  ` },
      { text: t('footer.readingCard', { name: t(loaded.metadata.readingCard) }), href: loaded.metadata.links.learning, accent: true },
    ],
    // REQ-042: no footer note for a deviation; the red block says enough. The version label stays away.
    ...(deviations.length === 0 ? { versionLabel: t('footer.languageVersion', { version: languageVersion }) } : {}),
  };
}

function walkStrings(value: unknown, pointer: string, visit: (value: string, pointer: string) => void): void {
  if (typeof value === 'string') visit(value, pointer);
  else if (Array.isArray(value)) value.forEach((item, index) => walkStrings(item, `${pointer}/${index}`, visit));
  else if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) walkStrings(item, `${pointer}/${key}`, visit);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

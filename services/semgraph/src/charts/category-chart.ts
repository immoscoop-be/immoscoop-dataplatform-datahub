import type { TopLevelSpec } from 'vega-lite';
import { currentDay, formatDay, localizeDay, localizeRange, parseDay } from '../core/days.ts';
import type { Translator } from '../core/i18n.ts';
import type { IssueSpec } from '../core/issues.ts';
import { META_SCHEMA, type ChartMeta } from '../core/meta.ts';
import type { HoverSpec } from '../core/render/hover.ts';
import { textWidth, wrap } from '../core/render/text.ts';
import type { DrawContext, Drawing, RequestContext, SemgraphImplementation, SemgraphMetadata } from '../core/semgraph.ts';
import { color, vegaLiteConfig, type Tokens } from '../core/tokens.ts';
import { anyPeriodFromName, isoWeek, parts, type CalendarUnit } from './calendar.ts';
import { hatchPattern, patternId } from './comparison.ts';
import { CONTEXT, DAY, FORMAT, LOCALE, MEASURE_TYPE, METRIC, TITLE, UNIQUE_AGGREGATION } from './contract.ts';
import { stateColumns, statePattern, type DataState } from './data-states.ts';
import { measureRules, type MeasureRequest } from './measure.ts';
import { CompactFormat, UNIT_SCHEMA, type ValueUnit } from './number-format.ts';
import { lookup, numberFormat, valueScale, ZIGZAG, ZIGZAG_MASK, zoomedLabelWeight, type ValueAxisMode } from './scales.ts';
import { markerSize } from './signatures.ts';
import { Average, Median, Sum, type BlockRow, type NumberFormatter, type Statistic, type Summary } from './statistics.ts';
import { PLOT_HEIGHT, WIDTH } from './time-axis-chart.ts';

/** One category as the warehouse delivers it, with the fields of its statistic (REQ-058). */
export interface CategoryRow extends BlockRow {
  category: string;
}

export interface CategoryRequest extends MeasureRequest {
  semgraph: string;
  metric: string;
  title?: string;
  statistic: 'sum' | 'mean' | 'median';
  /** Categories with an order (price ranges) stand upright in that order; without order they lie down, sorted by value. */
  ordered?: boolean;
  /** The time the values cover: a rolling window of days, an ISO calendar period, or one day (a snapshot). */
  window?: number;
  period?: string;
  day?: string;
  asOf?: string;
  /** REQ-073: a mean or median per category may zoom; an amount always starts at zero. */
  valueAxis?: ValueAxisMode;
  /** REQ-066, REQ-067: what each row's previous value is; the default follows Figma. */
  comparison?: ComparisonKind;
  unit?: ValueUnit;
  format?: string;
  locale?: string;
  context?: RequestContext;
  meta?: ChartMeta;
  points: CategoryRow[];
}

/** The period just before the scope, or the same scope a year earlier: neither is on the screen (REQ-037, REQ-067). */
export type ComparisonKind = 'previousPeriod' | 'lastYear';
const COMPARISONS: readonly ComparisonKind[] = ['previousPeriod', 'lastYear'];

type Scope =
  | { kind: 'window'; window: number; first: number; last: number }
  | { kind: 'period'; unit: CalendarUnit; first: number; last: number; name: string }
  | { kind: 'day'; first: number; last: number };

export interface CategoryPoint {
  /** Position in the drawing: 0 is the first row (top) or column (left). */
  key: number;
  category: string;
  summary: Summary | null;
  /** The value to compare with; null without data, absent without a comparison. */
  previous?: number | null;
}

export interface CategoryComputed {
  reference: number;
  referenceIsYesterday: boolean;
  orientation: 'horizontal' | 'vertical';
  scope: Scope;
  /** The scope ends after the last complete day: its values are not final. */
  scopeAfterReference: boolean;
  rows: CategoryPoint[];
  withSpread: boolean;
  spreadOmitted: boolean;
  nMissing: boolean;
  /** Keys of the categories that rest on few observations (REQ-044, REQ-053). */
  few: number[];
  /** Keys of the categories without a value: drawn as empty, never as zero (REQ-051). */
  missing: number[];
  /** The comparison inside each bar (REQ-066, REQ-067), and whether the request chose it. */
  comparison: { kind: ComparisonKind; given: boolean } | null;
  /** REQ-073: zoom was asked for an amount, whose bar starts at zero anyway. */
  zoomIgnored: boolean;
}

const STATISTICS = { sum: new Sum(), mean: new Average(), median: new Median() } as const;
/** Upright bars stay readable up to this many categories. */
const MAX_ORDERED = 16;
/** Horizontal geometry: the height of a row and the thickness of an amount bar, as in Figma. */
const ROW = 26;
const BAR = 12;
/** Vertical geometry: the widest bar, and the share of its column a bar takes. */
const MAX_BAR = 46;
const BAR_SHARE = 0.56;
const LABEL_GAP = 6;
const LABEL_LINE = 12;
/** The comparison bar of Figma: a taller row, a thicker bar, a cap for now that sticks out on both sides. */
const COMPARE_ROW = 38;
const COMPARE_BAR = 22;
const CAP = { thickness: 3, overhang: 4 };
/** The value and its difference stacked next to (or above) the bar: offsets of both lines in pixels. */
const STACK = { value: -5, difference: 8, gap: 3, line: 14 };

/**
 * Categories as bars (REQ-002: bars are for categories, never on a date axis), after Figma's
 * Chart/Bar: without order they lie down, sorted by value; with an order they stand upright in that
 * order. An amount is a bar from zero; a median is a dot in a wide rounded bar (P25–P75), a mean a
 * diamond over a thin bar (±1 sd), always from zero (REQ-006, REQ-008). The value stands next to its
 * shape. The warehouse computes each category (REQ-058); the chart checks and draws.
 */
export class CategoryChart implements SemgraphImplementation<CategoryRequest, CategoryComputed> {
  readonly id: string;

  constructor(id: string) {
    this.id = id;
  }

  protected statisticOf(request: CategoryRequest): Statistic {
    return STATISTICS[request.statistic];
  }

  schema(): object {
    const fields = Object.assign({}, ...Object.values(STATISTICS).map((statistic) => statistic.pointProperties()));
    return {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: `semgraph:${this.id}/request`,
      title: `${this.id} request`,
      description:
        'Categories as bars: without order they lie down, sorted by value; with an order they stand upright in that order. One row per category, computed in the warehouse (REQ-058): sum (a bar from zero), mean with sd (a diamond over a thin bar) or median with p25 and p75 (a dot in a wide bar). Give the time the values cover: window, period or day. A sum can carry the previous value of every category: the comparison then lives inside one bar (REQ-066, REQ-067).',
      type: 'object',
      additionalProperties: false,
      required: ['semgraph', 'metric', 'measureType', 'statistic', 'points'],
      properties: {
        semgraph: { const: this.id },
        metric: METRIC,
        title: TITLE,
        measureType: MEASURE_TYPE,
        uniqueAggregation: UNIQUE_AGGREGATION,
        statistic: {
          description: 'The value per category: sum (an amount, a bar from zero), mean (a diamond with ±1 sd) or median (a dot with P25–P75). A row carries only the fields of this statistic.',
          enum: Object.keys(STATISTICS),
        },
        ordered: {
          description: 'true for categories with an order, such as price ranges: upright bars in the order given. false (the default) for categories without order, such as provinces: lying bars, sorted by value. Never dates: a date axis is a line (REQ-001, REQ-002).',
          type: 'boolean',
          default: false,
        },
        window: { description: 'The values cover the window of this many days that ends on the last complete day.', type: 'integer', minimum: 1, maximum: 364 },
        period: { description: 'The values cover this ISO calendar period: 2026-W40, 2026-09, 2026-Q3 or 2026. It must be over.', type: 'string', pattern: '^[0-9]{4}(-W[0-9]{2}|-[0-9]{2}|-Q[1-4])?$' },
        day: { description: 'The values are a snapshot on this day, such as the listings online.', ...DAY },
        asOf: { description: 'The last complete day of the data. Yesterday in Brussels when absent.', ...DAY },
        valueAxis: {
          description: 'zero: the value axis starts at zero. zoom: for a mean or median it may start at a round value just below the data, with a zigzag at the start of the baseline and a bold first value (REQ-073). An amount is a bar, so it always starts at zero.',
          enum: ['zero', 'zoom'],
          default: 'zero',
        },
        comparison: {
          description: 'What the previous value of every row is: previousPeriod (the period just before, as long) or lastYear (the same period a year earlier). Neither is on the screen (REQ-037, REQ-067). For a sum only, drawn inside one bar. Default: the period before for a window of up to 14 days, last year for longer windows, calendar periods and a day.',
          enum: [...COMPARISONS],
        },
        unit: UNIT_SCHEMA,
        format: FORMAT,
        locale: LOCALE,
        context: CONTEXT,
        meta: META_SCHEMA,
        points: {
          description: 'One row per category, computed in the warehouse (REQ-058). A category without data has null: it is drawn as empty, never as zero.',
          type: 'array',
          minItems: 1,
          maxItems: 40,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['category'],
            properties: {
              category: { description: 'The name of the category, as the reader should see it.', type: 'string', minLength: 1, maxLength: 60 },
              ...fields,
              previous: {
                description: 'The sum of this category in the period it is compared with (see comparison); null when it has no data. Every row carries it, or none.',
                type: ['object', 'null'],
                additionalProperties: false,
                minProperties: 1,
                properties: Object.fromEntries(Object.keys(STATISTICS).map((id) => [id, { type: ['number', 'null'], minimum: 0 }])),
              },
            },
          },
        },
      },
    };
  }

  check(request: CategoryRequest): IssueSpec[] {
    const issues: IssueSpec[] = [];
    const scopes = (['window', 'period', 'day'] as const).filter((field) => request[field] !== undefined);
    if (scopes.length !== 1) issues.push({ level: 'inputError', code: 'scopeRequired', field: scopes.length ? `/${scopes[1]}` : '/window' });
    if (request.period !== undefined && anyPeriodFromName(request.period) === undefined) {
      issues.push({ level: 'inputError', code: 'invalidPeriod', field: '/period', params: { value: request.period, unit: { t: 'calendar.unit.period' } } });
    }
    for (const field of ['day', 'asOf'] as const) {
      const value = request[field];
      if (value !== undefined && parseDay(value) === undefined) issues.push({ level: 'inputError', code: 'invalidDate', field: `/${field}`, params: { value } });
    }
    const statistic = this.statisticOf(request);
    issues.push(...statistic.checkFields(request.points));
    const seen = new Set<string>();
    const comparing = compares(request);
    request.points.forEach((row, index) => {
      // Every row carries the value of the statistic, or null for a category without data.
      if (!(statistic.id in row)) issues.push({ level: 'inputError', code: 'missingField', field: `/points/${index}/${statistic.id}`, params: { name: statistic.id } });
      // With a comparison, every row carries its previous value too: a row without one would look like no change.
      if (comparing && !('previous' in row)) issues.push({ level: 'inputError', code: 'missingField', field: `/points/${index}/previous`, params: { name: 'previous' } });
      if (row.previous && Object.keys(row.previous).some((field) => field !== statistic.id)) {
        issues.push({ level: 'inputError', code: 'fieldNotForStatistic', field: `/points/${index}/previous`, params: { statistic: statistic.id } });
      }
      const field = `/points/${index}/category`;
      if (seen.has(row.category)) issues.push({ level: 'inputError', code: 'duplicateBlock', field, params: { block: row.category } });
      seen.add(row.category);
      // REQ-001, REQ-002: a date axis is always a line, so dates are no categories.
      if (parseDay(row.category) !== undefined || anyPeriodFromName(row.category) !== undefined) {
        issues.push({ level: 'inputError', code: 'categoryIsDate', field, params: { value: row.category } });
      }
    });
    if (request.ordered && request.points.length > MAX_ORDERED) {
      issues.push({ level: 'inputError', code: 'tooManyCategories', field: '/points', params: { count: request.points.length, max: MAX_ORDERED } });
    }
    return issues;
  }

  compute(request: CategoryRequest, { now }: { now: Date }): CategoryComputed {
    const yesterday = currentDay(now) - 1;
    const reference = request.asOf === undefined ? yesterday : parseDay(request.asOf)!;
    const scope = scopeOf(request, reference);
    const statistic = this.statisticOf(request);
    const comparing = compares(request);
    const read = request.points.map((row) => ({
      category: row.category,
      summary: statistic.read(row),
      ...(comparing ? { previous: row.previous?.[statistic.id] ?? null } : {}),
    }));
    // Without order, sorted by value, the largest on top; categories without a value at the bottom.
    const ordered = request.ordered
      ? read
      : read.map((row, index) => ({ row, index })).sort((a, b) => (b.row.summary?.centre ?? -Infinity) - (a.row.summary?.centre ?? -Infinity) || a.index - b.index).map(({ row }) => row);
    const rows = ordered.map((row, key) => ({ key, ...row }));
    const withValue = rows.filter((row) => row.summary !== null);
    const withSpread = withValue.some((row) => row.summary!.spread !== null);
    const observations = statistic.countsObservations(request.measureType);
    return {
      reference,
      referenceIsYesterday: reference === yesterday,
      orientation: request.ordered ? 'vertical' : 'horizontal',
      scope,
      scopeAfterReference: scope.last > reference,
      rows,
      withSpread,
      spreadOmitted: statistic.hasSpread && withValue.length > 0 && !withSpread,
      nMissing: observations && withValue.some((row) => row.summary!.n === undefined),
      few: observations ? statistic.fewObservations(withValue.map((row) => ({ key: row.key, ...(row.summary!.n === undefined ? {} : { n: row.summary!.n }) }))) : [],
      missing: rows.filter((row) => row.summary === null).map((row) => row.key),
      comparison: comparing ? { kind: request.comparison ?? defaultComparison(scope), given: request.comparison !== undefined } : null,
      zoomIgnored: statistic.kind === 'amount' && request.valueAxis === 'zoom',
    };
  }

  rules(request: CategoryRequest, computed: CategoryComputed, { metadata }: { metadata: SemgraphMetadata }): IssueSpec[] {
    const statistic = this.statisticOf(request);
    const issues = measureRules(request, statistic, metadata);
    const values = computed.rows.length - computed.missing.length;
    if (computed.scopeAfterReference) {
      issues.push({ level: 'refusal', code: 'blockAfterReference', field: `/${computed.scope.kind}`, params: { block: scopeName(request), day: formatDay(computed.reference) } });
    } else if (values === 0) {
      issues.push({ level: 'refusal', code: 'noData', field: '/points' });
    } else if (values < metadata.data.minimumPoints) {
      issues.push({ level: 'refusal', code: 'tooFewCategories', field: '/points', params: { count: values, minimumPoints: metadata.data.minimumPoints } });
    }
    if (computed.comparison) {
      // REQ-066, REQ-067: the comparison lives inside one bar, so only an amount has one.
      if (statistic.kind !== 'amount') issues.push({ level: 'refusal', code: 'comparisonOnlyForSum', field: computed.comparison.given ? '/comparison' : '/points', params: { statistic: { t: `hover.centre.category.${statistic.id}` } } });
      else if (!computed.rows.some((row) => typeof row.previous === 'number')) {
        issues.push({ level: 'refusal', code: 'noPreviousValues', field: '/points', params: { label: comparisonLabel(computed.comparison.kind, computed.scope) } });
      }
    }
    if (computed.zoomIgnored) issues.push({ level: 'info', code: 'valueAxisZoomIgnored', field: '/valueAxis' });
    if (computed.spreadOmitted) issues.push({ level: 'deviation', code: statistic.withoutSpreadCode, field: '/points' });
    if (computed.nMissing) issues.push({ level: 'deviation', code: `nMissing.${statistic.id}`, field: '/points' });
    if (computed.few.length > 0) {
      issues.push({ level: 'caution', code: `fewObservations.${statistic.id}`, field: '/points', params: { count: computed.few.length, total: values, blocks: { t: 'blocks.category' } } });
    }
    return issues;
  }

  draw(request: CategoryRequest, computed: CategoryComputed, context: DrawContext): Drawing {
    const statistic = this.statisticOf(request);
    const { t, tokens } = context;
    const vertical = computed.orientation === 'vertical';
    // REQ-066, REQ-067: only an amount compares, inside its bar (a mean or median with one is refused).
    const label = computed.comparison && statistic.kind === 'amount' ? translate(t, comparisonLabel(computed.comparison.kind, computed.scope)) : undefined;
    const drawn = vertical ? this.vertical(request, computed, statistic, t, tokens, label) : this.horizontal(request, computed, statistic, t, tokens, label);

    const title = request.title ?? request.metric;
    const cue = [
      statistic.id === 'sum' ? '' : t(`cue.category.${statistic.id}`),
      computed.withSpread ? t(`cue.spread.${statistic.id}`) : '',
      scopeCue(computed.scope, t),
      label ? t('cue.comparison', { label }) : '',
    ].filter(Boolean).join(' · ');
    const unique = request.uniqueAggregation === 'overPeriod' ? t('cue.uniqueOverPeriod', { block: scopeSingular(computed.scope, t) }) : t('cue.unique');
    const readingCue = request.measureType === 'unique' ? `${unique} · ${cue}` : cue;
    const description = [
      t('desc.base', { title, cue: readingCue, date: localizeDay(t, computed.reference, 'long') }),
      t('desc.categories', { count: computed.rows.length }),
    ].join(' ');
    return { ...drawn, title, readingCue, description, asOf: computed.reference, hoverRows: !vertical };
  }

  /** Labels of the values, the hover lines, the patterns and the comparison: the same in both orientations. */
  private common(request: CategoryRequest, computed: CategoryComputed, statistic: Statistic, t: Translator, tokens: Tokens, format: CompactFormat, label: string | undefined) {
    const formatter: NumberFormatter = { format: (value) => format.value(value) };
    const centreLabel = t(`hover.centre.category.${statistic.id}`);
    const comparisonLines = (row: CategoryPoint) => {
      if (label === undefined || row.previous === undefined) return [];
      if (row.previous === null) return [{ text: t('hover.categoryComparisonMissing', { label }) }];
      return [
        { text: t('hover.categoryComparison', { label, value: format.value(row.previous) }) },
        ...(row.summary ? [{ text: t('hover.difference', { value: format.difference(row.summary.centre - row.previous) }) }] : []),
      ];
    };
    const hover: HoverSpec[] = computed.rows.map((row) => {
      const name = { text: row.category, bold: true };
      if (!row.summary) return { x: row.key, lines: [name, { text: t('chart.noData') }, ...comparisonLines(row)] };
      const spread = statistic.spreadLine(t, formatter, row.summary);
      // With a comparison, the guides reach the previous value too.
      const previous = label !== undefined && typeof row.previous === 'number' ? row.previous : null;
      return {
        x: row.key,
        point: { y: row.summary.centre, lo: row.summary.spread?.lo ?? null, hi: row.summary.spread?.hi ?? previous },
        lines: [
          name,
          { text: `${centreLabel}: ${format.value(row.summary.centre)}` },
          ...comparisonLines(row),
          ...(spread ? [{ text: spread }] : []),
          ...(row.summary.n === undefined ? [] : [{ text: t('hover.n', { n: numberFormat(t.locale, 0).format(row.summary.n) }) }]),
        ],
      };
    });

    // REQ-066, REQ-067: the comparison inside one bar. The bar from zero to now is light (shared with
    // the earlier period); what was gained since is in the focus colour on top of it, what was lost is
    // hatched from now up to the earlier value (REQ-004, REQ-055), and a dark cap marks now.
    const compared = label === undefined ? [] : computed.rows.flatMap((row) => (row.summary && typeof row.previous === 'number' ? [{ key: row.key, now: row.summary.centre, previous: row.previous }] : []));
    const gained = compared.filter((row) => row.now > row.previous).map((row) => ({ key: row.key, from: row.previous, to: row.now }));
    const lost = compared.filter((row) => row.now < row.previous).map((row) => ({ key: row.key, from: row.now, to: row.previous }));
    const hatchId = lost.length > 0 ? patternId(JSON.stringify([request.metric, lost])) : undefined;

    // REQ-049, REQ-051, REQ-053: the state of a category is a pattern behind its whole row or column.
    const states = new Map<number, DataState>([...computed.few.map((key) => [key, 'few'] as const), ...computed.missing.map((key) => [key, 'empty'] as const)]);
    const columns = stateColumns(states);
    const patternIds = Object.fromEntries(
      [...new Set(columns.map((column) => column.state))].map((state) => [state, patternId(JSON.stringify([request.metric, state, columns]), state)]),
    ) as Partial<Record<DataState, string>>;
    const defs = [
      ...Object.entries(patternIds).map(([state, id]) => statePattern(id!, state as DataState, tokens)),
      ...(hatchId ? [hatchPattern(hatchId, tokens)] : []),
    ].join('');
    const fewSet = new Set(computed.few);
    const nLabels = computed.rows.filter((row) => fewSet.has(row.key)).map((row) => ({ rel: row.key, text: t('axis.n', { n: row.summary!.n! }) }));
    const fill = {
      field: 'state',
      type: 'nominal' as const,
      scale: { domain: Object.keys(patternIds), range: Object.values(patternIds).map((id) => `url(#${id})`) },
      legend: null,
    };
    const lostFill = hatchId ? `url(#${hatchId})` : color(tokens, 'surface');
    // The cap marks now on every bar of a comparison, also where the earlier value is missing.
    const now = label === undefined ? [] : computed.rows.flatMap((row) => (row.summary ? [{ key: row.key, now: row.summary.centre }] : []));
    return { hover, columns, defs, fill, nLabels, fewSet, gained, lost, lostFill, now };
  }

  /** Lying bars: categories without order, sorted by value, the label left of the baseline and the value after the shape. */
  private horizontal(request: CategoryRequest, computed: CategoryComputed, statistic: Statistic, t: Translator, tokens: Tokens, label: string | undefined) {
    const rows = computed.rows;
    const count = rows.length;
    const comparing = label !== undefined;
    const rowHeight = comparing ? COMPARE_ROW : ROW;
    const barHeight = comparing ? COMPARE_BAR : BAR;
    const plotHeight = count * rowHeight;
    const { lowest, highest } = extent(rows, comparing);
    const scale = valueScale(lowest, highest, axisMode(request, statistic));
    const format = new CompactFormat(t.locale, scale.max, request.unit);
    const labelSize = tokens.size.axisLabel;
    const labels = rows.map((row) => ({ rel: row.key, label: fit(row.category, labelSize, 190) }));
    const left = Math.min(200, Math.max(60, Math.max(...labels.map((label) => textWidth(label.label, labelSize))) + 16));
    const texts = rows.map((row) => valueTexts(row, statistic, format, comparing ? t('chart.noComparison') : undefined));
    // The value stands after the shape, after the hatching of a loss, and clear of the cap.
    const end = (row: CategoryPoint) => Math.max(row.summary!.spread?.hi ?? row.summary!.centre, comparing ? row.previous ?? 0 : 0);
    const gap = comparing ? LABEL_GAP + CAP.thickness / 2 + 1 : LABEL_GAP;
    const textsWidth = (index: number) => {
      const { strong, detail } = texts[index]!;
      if (!detail) return boldWidth(strong, tokens.size.value);
      // With a comparison the difference stands under the value; a spread stands after it.
      return comparing
        ? Math.max(boldWidth(strong, tokens.size.value), textWidth(detail, tokens.size.detail))
        : boldWidth(strong, tokens.size.value) + 4 + textWidth(detail, tokens.size.detail);
    };
    const textRight = (row: CategoryPoint, index: number, perPixel: number) => (row.summary ? (end(row) - scale.min) / perPixel + gap + textsWidth(index) : 0);
    const firstWidth = WIDTH - left - 28;
    const overflow = Math.max(0, ...rows.map((row, index) => textRight(row, index, (scale.max - scale.min) / firstWidth) - firstWidth));
    const padding = { left, right: 28 + Math.ceil(overflow), top: 8, bottom: 24 };
    const plotWidth = WIDTH - padding.left - padding.right;
    const perPixel = (scale.max - scale.min) / plotWidth;
    const common = this.common(request, computed, statistic, t, tokens, format, label);
    const fewSet = common.fewSet;

    const x = { field: 'x', type: 'quantitative' as const, scale: { domain: [scale.min, scale.max], nice: false, zero: false } };
    const y = { field: 'rel', type: 'quantitative' as const, scale: { domain: [count - 0.5, -0.5], nice: false, zero: false } };
    const barWidth = statistic.barWidth(tokens);
    const capPad = (barWidth / 2) * perPixel;
    const half = barHeight / 2 / rowHeight;
    const capHalf = half + CAP.overhang / rowHeight;
    const withValue = rows.filter((row) => row.summary);
    const strong = rows.flatMap((row, index) => {
      if (!row.summary) return [];
      return [{ rel: !comparing && fewSet.has(row.key) ? row.key - 0.15 : row.key, x: end(row) + gap * perPixel, text: texts[index]!.strong }];
    });
    const details = rows.flatMap((row, index) => {
      const { strong: value, detail } = texts[index]!;
      if (!row.summary || !detail) return [];
      return [{ rel: row.key, x: end(row) + (comparing ? gap : LABEL_GAP + boldWidth(value, tokens.size.value) + 4) * perPixel, text: detail }];
    });
    // REQ-073: a zoomed axis gets a zigzag at the start of the baseline, here at its foot.
    const zigzag = scale.zoomed ? ZIGZAG.map(([along, across], order) => ({ rel: count - 0.5 - along / rowHeight, x: scale.min + across * perPixel, order })) : [];
    const mask = scale.zoomed ? [{ x: scale.min, rel: count - 0.5, rel2: count - 0.5 - ZIGZAG_MASK / rowHeight }] : [];
    const band = (key: number) => ({ y1: key - half, y2: key + half });

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      width: plotWidth,
      height: plotHeight,
      autosize: { type: 'none' },
      padding,
      background: 'transparent',
      config: vegaLiteConfig(tokens),
      datasets: {
        frame: [{ x: scale.min, rel: 0 }],
        columns: common.columns.map((column) => ({ ...column, x: scale.min, x2: scale.max })),
        baseline: [{ x: scale.min, rel: -0.5, rel2: count - 0.5 }],
        mask,
        zigzag,
        bars: statistic.kind === 'amount' ? withValue.map((row) => ({ rel: row.key, x: 0, x2: row.summary!.centre, ...band(row.key) })) : [],
        gained: common.gained.map((row) => ({ x: row.from, x2: row.to, ...band(row.key) })),
        lost: common.lost.map((row) => ({ x: row.from, x2: row.to, ...band(row.key) })),
        caps: common.now.map((row) => ({ x: row.now, rel: row.key - capHalf, rel2: row.key + capHalf })),
        spread: withValue.flatMap((row) => (row.summary!.spread ? [{ rel: row.key, x: Math.max(0, row.summary!.spread.lo) + capPad, x2: Math.max(row.summary!.spread.hi - capPad, row.summary!.centre) }] : [])),
        points: statistic.kind === 'amount' ? [] : withValue.map((row) => ({ rel: row.key, x: row.summary!.centre })),
        categories: labels.map((label) => ({ ...label, rel: fewSet.has(label.rel) ? label.rel - 0.15 : label.rel })),
        nLabels: common.nLabels.map((label) => ({ ...label, rel: label.rel + 0.25 })),
        valuesStrong: strong,
        valuesDetail: details,
      },
      layer: [
        {
          data: { name: 'frame' },
          mark: { type: 'point', opacity: 0 },
          encoding: {
            x: { ...x, axis: { values: scale.ticks, labelExpr: lookup(format.ticks(scale.ticks)), grid: true, domain: false, ticks: false, labelPadding: 6, ...zoomedLabelWeight(scale) } },
            y: { ...y, axis: null },
          },
        },
        {
          data: { name: 'columns' },
          mark: { type: 'rect', opacity: 1 },
          encoding: { x, x2: { field: 'x2' }, y: { ...y, field: 'from' }, y2: { field: 'to' }, fill: common.fill },
        },
        {
          data: { name: 'baseline' },
          mark: { type: 'rule', color: color(tokens, 'baseline'), strokeWidth: tokens.stroke.baseline },
          encoding: { x, y, y2: { field: 'rel2' } },
        },
        ...(scale.zoomed ? zoomLayers(tokens, x, y, { x, y, y2: { field: 'rel2' } }) : []),
        {
          // With a comparison the bar up to now is light: shared with the earlier period (REQ-066).
          data: { name: 'bars' },
          mark: { type: 'rect', color: color(tokens, comparing ? 'focus/light' : 'focus'), opacity: 1 },
          encoding: { x, x2: { field: 'x2' }, y: { ...y, field: 'y1' }, y2: { field: 'y2' } },
        },
        // REQ-066, REQ-067: the comparison, only on a chart that compares.
        ...(comparing
          ? [
              {
                data: { name: 'gained' },
                mark: { type: 'rect', color: color(tokens, 'focus'), opacity: 1 },
                encoding: { x, x2: { field: 'x2' }, y: { ...y, field: 'y1' }, y2: { field: 'y2' } },
              },
              {
                data: { name: 'lost' },
                mark: { type: 'rect', fill: common.lostFill, opacity: 1 },
                encoding: { x, x2: { field: 'x2' }, y: { ...y, field: 'y1' }, y2: { field: 'y2' } },
              },
              {
                data: { name: 'caps' },
                mark: { type: 'rule', color: color(tokens, 'text'), strokeWidth: CAP.thickness },
                encoding: { x, y, y2: { field: 'rel2' } },
              },
            ]
          : []),
        {
          data: { name: 'spread' },
          mark: { type: 'rule', strokeWidth: barWidth, strokeCap: 'round', color: color(tokens, 'focus/light') },
          encoding: { x, x2: { field: 'x2' }, y },
        },
        pointLayer(statistic, tokens, x, y),
        {
          data: { name: 'categories' },
          mark: { type: 'text', align: 'right', baseline: 'middle', dx: -10, fontSize: labelSize, color: color(tokens, 'text') },
          encoding: { x: { value: 0 }, y, text: { field: 'label' } },
        },
        {
          data: { name: 'nLabels' },
          mark: { type: 'text', align: 'right', baseline: 'middle', dx: -10, fontSize: tokens.size.detail, color: color(tokens, 'text/muted'), opacity: 0.7 },
          encoding: { x: { value: 0 }, y, text: { field: 'text' } },
        },
        {
          data: { name: 'valuesStrong' },
          mark: { type: 'text', align: 'left', baseline: 'middle', dy: comparing ? STACK.value : 0, fontSize: tokens.size.value, fontWeight: 'bold', color: color(tokens, 'text') },
          encoding: { x, y, text: { field: 'text' } },
        },
        {
          data: { name: 'valuesDetail' },
          mark: { type: 'text', align: 'left', baseline: 'middle', dy: comparing ? STACK.difference : 0, fontSize: tokens.size.detail, color: color(tokens, 'text/muted') },
          encoding: { x, y, text: { field: 'text' } },
        },
      ],
    } as TopLevelSpec;

    return {
      vegaLite: spec,
      width: WIDTH,
      height: padding.top + plotHeight + padding.bottom,
      plotArea: { x: padding.left, y: padding.top, width: plotWidth, height: plotHeight },
      ...(common.defs ? { defs: common.defs } : {}),
      hover: common.hover,
    };
  }

  /** Upright bars: ordered categories in their order, an amount in the ordinal ramp, the value above or next to the shape. */
  private vertical(request: CategoryRequest, computed: CategoryComputed, statistic: Statistic, t: Translator, tokens: Tokens, label: string | undefined) {
    const rows = computed.rows;
    const count = rows.length;
    const comparing = label !== undefined;
    const padding0 = { left: 52, right: 28, top: 14 };
    const plotWidth = WIDTH - padding0.left - padding0.right;
    const slot = plotWidth / count;
    const labelLines = rows.map((row) => wrap(row.category, tokens.size.axisLabel, slot - 6, 2));
    const lines = Math.max(...labelLines.map((label) => label.length));
    const hasN = computed.few.length > 0;
    const amount = statistic.kind === 'amount';

    // The value axis grows until every label above its shape fits. The value with its difference under
    // it is taller: as in Figma, it may rise above the top value, into the margin above the plot.
    const { lowest, highest } = extent(rows, comparing);
    const mode = axisMode(request, statistic);
    const room = comparing ? STACK.gap + CAP.thickness / 2 + 2 * STACK.line : amount ? tokens.size.value + LABEL_GAP + 2 : tokens.size.detail + 6;
    let scale = valueScale(lowest, highest, mode);
    for (let attempt = 0; attempt < 4 && !comparing; attempt++) {
      const needed = highest + room * ((scale.max - scale.min) / PLOT_HEIGHT);
      if (needed <= scale.max) break;
      scale = valueScale(lowest, needed, mode);
    }
    const rise = comparing ? Math.max(0, room - PLOT_HEIGHT * (1 - (highest - scale.min) / (scale.max - scale.min))) : 0;
    const padding = { ...padding0, top: padding0.top + Math.ceil(rise), bottom: 10 + lines * LABEL_LINE + (hasN ? LABEL_LINE + 2 : 0) + 4 };
    const format = new CompactFormat(t.locale, scale.max, request.unit);
    const common = this.common(request, computed, statistic, t, tokens, format, label);
    const perPixelX = 1 / slot;
    const perPixelY = (scale.max - scale.min) / PLOT_HEIGHT;

    const x = { field: 'rel', type: 'quantitative' as const, scale: { domain: [-0.5, count - 0.5], nice: false, zero: false } };
    const y = { field: 'v', type: 'quantitative' as const, scale: { domain: [scale.min, scale.max], nice: false, zero: false } };
    const barWidth = statistic.barWidth(tokens);
    const capPad = (barWidth / 2) * perPixelY;
    const halfBar = Math.min(MAX_BAR, slot * BAR_SHARE) / 2 / slot;
    const capHalf = halfBar + CAP.overhang * perPixelX;
    const withValue = rows.filter((row) => row.summary);
    const ramp = ordinalRamp(tokens, count);
    const markerRoom = (markerSize(tokens, statistic.kind) ** 0.5) / 2 + LABEL_GAP;
    const texts = rows.map((row) => valueTexts(row, statistic, format, comparing ? t('chart.noComparison') : undefined));
    // With a comparison the value and its difference stand above the bar or the hatching of a loss, whichever is higher.
    const top = (row: CategoryPoint) => Math.max(row.summary!.centre, comparing ? row.previous ?? 0 : 0);
    const zigzag = scale.zoomed ? ZIGZAG.map(([along, across], order) => ({ rel: -0.5 + along * perPixelX, v: scale.min + across * perPixelY, order })) : [];
    const mask = scale.zoomed ? [{ rel: -0.5, rel2: -0.5 + ZIGZAG_MASK * perPixelX, v: scale.min }] : [];
    const band = (key: number) => ({ rel: key - halfBar, rel2: key + halfBar });

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      width: plotWidth,
      height: PLOT_HEIGHT,
      autosize: { type: 'none' },
      padding,
      background: 'transparent',
      config: vegaLiteConfig(tokens),
      datasets: {
        frame: [{ rel: 0, v: scale.min }],
        columns: common.columns,
        mask,
        zigzag,
        bars: amount ? withValue.map((row) => ({ ...band(row.key), v: 0, v2: row.summary!.centre, fill: comparing ? color(tokens, 'focus/light') : ramp[row.key]! })) : [],
        gained: common.gained.map((row) => ({ ...band(row.key), v: row.from, v2: row.to })),
        lost: common.lost.map((row) => ({ ...band(row.key), v: row.from, v2: row.to })),
        caps: common.now.map((row) => ({ rel: row.key - capHalf, rel2: row.key + capHalf, v: row.now })),
        spread: withValue.flatMap((row) => (row.summary!.spread ? [{ rel: row.key, v: Math.max(0, row.summary!.spread.lo) + capPad, v2: Math.max(row.summary!.spread.hi - capPad, row.summary!.centre) }] : [])),
        points: amount ? [] : withValue.map((row) => ({ rel: row.key, v: row.summary!.centre })),
        categories: rows.map((row, index) => ({ rel: row.key, lines: labelLines[index]! })),
        nLabels: common.nLabels,
        valuesAbove: amount ? withValue.map((row) => ({ rel: row.key, v: top(row), text: format.value(row.summary!.centre) })) : [],
        valuesBeside: amount ? [] : withValue.map((row) => ({ rel: row.key + markerRoom * perPixelX, v: row.summary!.centre, text: format.value(row.summary!.centre) })),
        detailAbove: rows.flatMap((row, index) => {
          const detail = texts[index]!.detail;
          if (!row.summary || !detail) return [];
          if (comparing) return [{ rel: row.key, v: top(row), text: detail }];
          const spread = row.summary.spread!;
          return [{ rel: row.key, v: spread.hi, text: statistic.id === 'mean' ? detail : format.value(spread.hi) }];
        }),
        detailBelow: statistic.id === 'median' ? withValue.flatMap((row) => (row.summary!.spread ? [{ rel: row.key, v: Math.max(0, row.summary!.spread.lo), text: format.value(row.summary!.spread.lo) }] : [])) : [],
      },
      layer: [
        {
          // The baseline is the domain of the x axis; the value axis on the left.
          data: { name: 'frame' },
          mark: { type: 'point', opacity: 0 },
          encoding: {
            x: { ...x, axis: { values: [], ticks: false, labels: false, title: null } },
            y: { ...y, axis: { values: scale.ticks, labelExpr: lookup(format.ticks(scale.ticks)), title: null, ...zoomedLabelWeight(scale) } },
          },
        },
        {
          data: { name: 'columns' },
          mark: { type: 'rect', opacity: 1 },
          encoding: { x: { ...x, field: 'from' }, x2: { field: 'to' }, y: { value: 0 }, y2: { value: PLOT_HEIGHT - tokens.stroke.baseline }, fill: common.fill },
        },
        ...(scale.zoomed ? zoomLayers(tokens, x, y, { x, x2: { field: 'rel2' }, y }) : []),
        {
          data: { name: 'bars' },
          mark: { type: 'rect', opacity: 1 },
          encoding: { x, x2: { field: 'rel2' }, y, y2: { field: 'v2' }, fill: { field: 'fill', type: 'nominal', scale: null } },
        },
        // REQ-066, REQ-067: the comparison, only on a chart that compares.
        ...(comparing
          ? [
              {
                data: { name: 'gained' },
                mark: { type: 'rect', color: color(tokens, 'focus'), opacity: 1 },
                encoding: { x, x2: { field: 'rel2' }, y, y2: { field: 'v2' } },
              },
              {
                data: { name: 'lost' },
                mark: { type: 'rect', fill: common.lostFill, opacity: 1 },
                encoding: { x, x2: { field: 'rel2' }, y, y2: { field: 'v2' } },
              },
              {
                data: { name: 'caps' },
                mark: { type: 'rule', color: color(tokens, 'text'), strokeWidth: CAP.thickness },
                encoding: { x, x2: { field: 'rel2' }, y },
              },
            ]
          : []),
        {
          data: { name: 'spread' },
          mark: { type: 'rule', strokeWidth: barWidth, strokeCap: 'round', color: color(tokens, 'focus/light') },
          encoding: { x, y, y2: { field: 'v2' } },
        },
        pointLayer(statistic, tokens, x, y),
        {
          data: { name: 'categories' },
          mark: { type: 'text', align: 'center', baseline: 'top', fontSize: tokens.size.axisLabel, lineHeight: LABEL_LINE, color: color(tokens, 'text/muted') },
          encoding: { x, y: { value: PLOT_HEIGHT + 10 }, text: { field: 'lines' } },
        },
        {
          data: { name: 'nLabels' },
          mark: { type: 'text', align: 'center', baseline: 'top', fontSize: tokens.size.axisLabel, color: color(tokens, 'text/muted'), opacity: 0.7 },
          encoding: { x, y: { value: PLOT_HEIGHT + 10 + lines * LABEL_LINE + 2 }, text: { field: 'text' } },
        },
        {
          data: { name: 'valuesAbove' },
          mark: {
            type: 'text',
            align: 'center',
            baseline: 'bottom',
            dy: comparing ? -(STACK.gap + CAP.thickness / 2 + STACK.line) : -LABEL_GAP,
            fontSize: tokens.size.value,
            fontWeight: 'bold',
            color: color(tokens, 'text'),
          },
          encoding: { x, y, text: { field: 'text' } },
        },
        {
          data: { name: 'valuesBeside' },
          mark: { type: 'text', align: 'left', baseline: 'middle', fontSize: tokens.size.value, fontWeight: 'bold', color: color(tokens, 'text') },
          encoding: { x, y, text: { field: 'text' } },
        },
        {
          data: { name: 'detailAbove' },
          mark: { type: 'text', align: 'center', baseline: 'bottom', dy: comparing ? -(STACK.gap + CAP.thickness / 2) : -4, fontSize: tokens.size.detail, color: color(tokens, 'text/muted') },
          encoding: { x, y, text: { field: 'text' } },
        },
        {
          data: { name: 'detailBelow' },
          mark: { type: 'text', align: 'center', baseline: 'top', dy: 4, fontSize: tokens.size.detail, color: color(tokens, 'text/muted') },
          encoding: { x, y, text: { field: 'text' } },
        },
      ],
    } as TopLevelSpec;

    return {
      vegaLite: spec,
      width: WIDTH,
      height: padding.top + PLOT_HEIGHT + padding.bottom,
      plotArea: { x: padding.left, y: padding.top, width: plotWidth, height: PLOT_HEIGHT },
      ...(common.defs ? { defs: common.defs } : {}),
      hover: common.hover,
    };
  }
}

/**
 * REQ-073: a zoomed axis, as on the time axis (REQ-026): the baseline gives way to a zigzag at its start.
 * `along` encodes the stretch of baseline the mask covers.
 */
function zoomLayers(tokens: Tokens, x: object, y: object, along: object) {
  return [
    {
      data: { name: 'mask' },
      mark: { type: 'rule', color: color(tokens, 'surface'), strokeWidth: tokens.stroke.baseline + 2 },
      encoding: along,
    },
    {
      data: { name: 'zigzag' },
      mark: { type: 'line', color: color(tokens, 'baseline'), strokeWidth: tokens.stroke.baseline, strokeJoin: 'miter' },
      encoding: { x, y, order: { field: 'order' } },
    },
  ];
}

/** REQ-073: an amount is a length, so its bar starts at zero; a mean or median is a position and may zoom. */
function axisMode(request: CategoryRequest, statistic: Statistic): ValueAxisMode {
  return statistic.kind === 'amount' ? 'zero' : request.valueAxis ?? 'zero';
}

/** The lowest and highest value the axis must show: the spread, and with a comparison the earlier value. */
function extent(rows: readonly CategoryPoint[], comparing: boolean): { lowest: number; highest: number } {
  const valued = rows.filter((row) => row.summary);
  const highest = Math.max(0, ...valued.map((row) => Math.max(row.summary!.spread?.hi ?? row.summary!.centre, comparing ? row.previous ?? 0 : 0)));
  const lowest = Math.min(...valued.map((row) => Math.min(Math.max(0, row.summary!.spread?.lo ?? row.summary!.centre), comparing ? row.previous ?? Infinity : Infinity)));
  return { lowest: Number.isFinite(lowest) ? lowest : 0, highest };
}

/** The centre in the shape of its statistic, always filled (REQ-006, REQ-008, REQ-052). */
function pointLayer(statistic: Statistic, tokens: Tokens, x: object, y: object) {
  return {
    data: { name: 'points' },
    mark: {
      type: 'point',
      shape: statistic.shape,
      filled: true,
      size: markerSize(tokens, statistic.kind),
      opacity: 1,
      fill: color(tokens, 'focus'),
      stroke: color(tokens, 'surface'),
      strokeWidth: 1,
    },
    encoding: { x, y },
  };
}

/**
 * The value next to a shape, bold, and its detail: the spread after it ("€ 390k" "300–510k", "€ 420k"
 * "± 170k"), or with a comparison the difference under it ("1,8k" "▲ 0,2k"; REQ-066).
 */
function valueTexts(row: CategoryPoint, statistic: Statistic, format: CompactFormat, noComparison?: string): { strong: string; detail: string } {
  const summary = row.summary;
  if (!summary) return { strong: '', detail: '' };
  const strong = format.value(summary.centre);
  if (noComparison !== undefined) return { strong, detail: typeof row.previous === 'number' ? format.difference(summary.centre - row.previous) : noComparison };
  if (!summary.spread) return { strong, detail: '' };
  const detail = statistic.id === 'mean' ? format.plusMinus(summary.spread.hi - summary.centre) : format.range(summary.spread.lo, summary.spread.hi);
  return { strong, detail };
}

/** Figma's ordinal ramp, light to dark, along the order of the categories: spread over the five steps. */
function ordinalRamp(tokens: Tokens, count: number): string[] {
  return Array.from({ length: count }, (_, index) => color(tokens, `ordinal/${count === 1 ? 5 : Math.round((index * 4) / (count - 1)) + 1}`));
}

/** Bold text is a little wider than regular text. */
function boldWidth(content: string, size: number): number {
  return textWidth(content, size) * 1.06;
}

/** A label that fits, cut with an ellipsis. */
function fit(label: string, size: number, width: number): string {
  if (textWidth(label, size) <= width) return label;
  let cut = label;
  while (cut.length > 1 && textWidth(`${cut}…`, size) > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

function scopeOf(request: CategoryRequest, reference: number): Scope {
  if (request.window !== undefined) return { kind: 'window', window: request.window, first: reference - request.window + 1, last: reference };
  if (request.period !== undefined) {
    const period = anyPeriodFromName(request.period)!;
    return { kind: 'period', unit: period.unit, first: period.first, last: period.last, name: request.period };
  }
  const day = parseDay(request.day!)!;
  return { kind: 'day', first: day, last: day };
}

function translate(t: Translator, label: { t: string; params?: Record<string, number> }): string {
  return t(label.t, label.params);
}

/** A comparison is asked for, or delivered: then every row carries its previous value. */
function compares(request: CategoryRequest): boolean {
  return request.comparison !== undefined || request.points.some((row) => 'previous' in row);
}

/** REQ-067, as in Figma: 7 and 14 days against the period before, 28 and 91 days and calendar periods against last year. */
function defaultComparison(scope: Scope): ComparisonKind {
  return scope.kind === 'window' && scope.window <= 14 ? 'previousPeriod' : 'lastYear';
}

/** What the bar is compared with, as the label says it: "vorig jaar", "vorige 7 dagen", "vorige maand", "de dag ervoor". */
function comparisonLabel(kind: ComparisonKind, scope: Scope): { t: string; params?: Record<string, number> } {
  if (kind === 'lastYear') return { t: 'comparison.year' };
  switch (scope.kind) {
    case 'window':
      return scope.window === 1 ? { t: 'comparison.previous.day' } : { t: 'comparison.days', params: { n: scope.window } };
    case 'day':
      return { t: 'comparison.previous.day' };
    case 'period':
      return scope.unit === 'year' ? { t: 'comparison.year' } : { t: `comparison.previous.${scope.unit}` };
  }
}

function scopeName(request: CategoryRequest): string {
  return request.period ?? request.day ?? `${request.window}d`;
}

/** "voortschrijdend 28d", "sep 2026", "op 25/09". */
function scopeCue(scope: Scope, t: Translator): string {
  switch (scope.kind) {
    case 'window':
      return t('cue.scope.window', { window: scope.window });
    case 'day':
      return t('cue.scope.day', { date: localizeDay(t, scope.first, 'numeric') });
    case 'period': {
      const { year, month, quarter } = parts(scope.first);
      switch (scope.unit) {
        case 'week':
          return t('calendar.hover.week', { week: isoWeek(scope.first).week, range: localizeRange(t, scope.first, scope.last) });
        case 'month':
          return t('calendar.hover.month', { month: t(`date.month.${month}`), year });
        case 'quarter':
          return t('calendar.hover.quarter', { quarter, year });
        case 'year':
          return String(year);
      }
    }
  }
}

/** What the uniques were counted over, for the reading cue: "venster van 28 dagen", "maand", "dag". */
function scopeSingular(scope: Scope, t: Translator): string {
  if (scope.kind === 'window') return scope.window === 1 ? t('blocks.oneDay') : t('blocks.oneWindow', { window: scope.window });
  if (scope.kind === 'period') return t(`calendar.unit.${scope.unit}`);
  return t('blocks.oneDay');
}

import type { TopLevelSpec } from 'vega-lite';
import { checkDailySeries, currentDay, formatDay, localizeDay, parseDay } from '../core/days.ts';
import type { Translator } from '../core/i18n.ts';
import type { IssueParam, IssueSpec } from '../core/issues.ts';
import { META_SCHEMA, type ChartMeta } from '../core/meta.ts';
import type { HoverSpec } from '../core/render/hover.ts';
import type {
  DrawContext,
  Drawing,
  RequestContext,
  SemgraphImplementation,
  SemgraphMetadata,
} from '../core/semgraph.ts';
import { color, vegaLiteConfig } from '../core/tokens.ts';
import { endLabels, hatchPattern, patternId, SECOND_LINE, shortfall } from './comparison.ts';
import { decimalsOf, lookup, numberFormat, runs, ticksEvery, valueScale, type ValueAxisMode } from './scales.ts';
import { markerSize } from './signatures.ts';
import type { Statistic, Summary } from './statistics.ts';
import { AXIS_HEIGHT, timeAxis } from './time-axis.ts';
import { headroom, labelsFor, MIN_WIDTH_FOR_ALL, VALUES_MODES, valueLabels, type ValuesMode } from './value-labels.ts';

/** What every time-axis request carries, whatever its periods or statistic. */
export interface TimeAxisRequest {
  semgraph: string;
  metric: string;
  title?: string;
  measureType: 'additive' | 'unique' | 'ratio';
  uniqueAggregation?: 'daily' | 'overPeriod';
  horizon: number;
  spread?: string;
  valueAxis?: ValueAxisMode;
  values?: ValuesMode;
  format?: string;
  locale?: string;
  context?: RequestContext;
  meta?: ChartMeta;
  data: { day: string; value: number | null }[];
}

/** The days one position on the time axis summarizes. */
export interface Slot {
  /** 0 is the last slot, the one with the reference day; -1 the one before, ... */
  rel: number;
  first: number;
  /** Last day used; never after the reference day. */
  last: number;
  /** Last day of the whole period; after `last` while the period is still running. */
  fullLast: number;
  /** A period that is not over yet: drawn hollow, because its value is not final. */
  running: boolean;
}

export interface SlotPoint extends Slot, Summary {
  /** Number of days summarized. */
  days: number;
}

export interface TimeAxisComputed {
  /** The last complete day in the data ("today"), as a day number. */
  reference: number;
  /** True when the reference day is yesterday, so it may be called "today". */
  referenceIsYesterday: boolean;
  /** Days in the data after the reference day (the running day, or later). */
  ignoredAfterReference: number;
  /** First and number of days the chart uses, up to the reference day. */
  rangeStart: number;
  rangeDays: number;
  /** Days with a value in that range. */
  valuesInRange: number;
  withSpread: boolean;
  /** The caller left out a spread that belongs to the statistic: a tolerated deviation. */
  spreadOmitted: boolean;
  /** Which values are written on the chart, and whether "all" fell back because they do not fit. */
  values: ValuesMode;
  valuesFallback: boolean;
  slots: Slot[];
  /** Slots whose days all have a value. */
  points: SlotPoint[];
  /** Slots with a missing day: drawn as missing, never as zero, never interpolated. */
  missing: number[];
  /** Days in the range without a value, in order. */
  absentDays: number[];
  /**
   * The same value for the period just before the screen, one block per block on the screen, at the
   * same position (`periodComparison`, REQ-037); null for a chart without comparison.
   */
  comparison: { slots: Slot[]; points: SlotPoint[] } | null;
}

export interface LabelContext {
  t: Translator;
  computed: TimeAxisComputed;
  /** The leftmost labelled tick, which names the year where that helps. */
  isFirst: boolean;
}

export const WIDTH = 640;
export const PLOT_HEIGHT = 200;
/** Fixed geometry (autosize none): room for the y labels left, half a value label right, the time axis below. */
export const PADDING = { left: 52, right: 28, top: 14, bottom: AXIS_HEIGHT };
export const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
/** A comparison writes the last value and the name of the comparison right of the lines (REQ-003). */
const COMPARISON_PADDING = { ...PADDING, right: 84 };
/** At most this many labels on the time axis. */
export const MAX_TICKS = 8;
/** A "no data" label is only written in a missing stretch at least this wide. */
const MIN_LABEL_WIDTH = 44;

/**
 * How the spread is drawn under the line (REQ-001): a bar under every point, or a band along the
 * line when the points are too close together for their bars.
 */
export type Form = 'bars' | 'band';

/** Bars while each slot has room for its bar plus some air, a band beyond that (REQ-022). */
export function formFor(slots: number, barWidth: number, plotWidth = PLOT_WIDTH): Form {
  return plotWidth / slots >= Math.max(8, barWidth + 4) ? 'bars' : 'band';
}

/** Master-leerplan, level 1: unique counts (1.2.2), rolling periods (1.4.2), centre and spread (1.5.4). */
export const LEARNING_PLAN_LEVEL_1 = 'https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1354629146';

/**
 * Base class of every chart with a time axis of daily data. It owns everything the families share:
 * the contract, the reference day, the strict handling of missing days, the chart-language rules,
 * the value axis (from zero or zoomed), the drawing and the hover labels. A family decides which
 * days each slot summarizes and how slots are labelled; the statistic decides centre and spread.
 * Nothing is written twice (REQ-025).
 */
export abstract class TimeAxisChart<Request extends TimeAxisRequest>
  implements SemgraphImplementation<Request, TimeAxisComputed>
{
  readonly id: string;
  readonly statistic: Statistic;
  /** Whether the chart compares with the period just before the screen (`periodComparison`). */
  protected readonly compares: boolean = false;

  constructor(id: string, statistic: Statistic) {
    this.id = id;
    this.statistic = statistic;
  }

  protected get padding() {
    return this.compares ? COMPARISON_PADDING : PADDING;
  }

  protected get plotWidth(): number {
    return WIDTH - this.padding.left - this.padding.right;
  }

  // ----- What a family adds -----

  protected abstract readonly periodDescription: string;
  /** Which values the family writes on the chart by default (REQ-033). */
  protected abstract readonly defaultValues: ValuesMode;
  /** Contract properties of the family, such as window or unit, and its horizon. */
  protected abstract periodSchema(): { properties: Record<string, object>; required: string[] };
  /** The slots, oldest first, ending with the one that contains the reference day. */
  protected abstract slots(reference: number, request: Request): Slot[];
  /** Number of slots between two labelled ticks. */
  protected abstract tickStep(request: Request, slots: number, slotWidth: number): number;
  /** The label of a block on the time axis; a second line names the year. */
  protected abstract tickLabel(slot: Slot, context: LabelContext, request: Request): string[];
  /** What a slot is on hover, e.g. "23 sep (−7d)" or "week 39 (21–27 sep)". */
  protected abstract slotLabel(slot: Slot, context: LabelContext, request: Request): string;
  /** The reading cue of the family, e.g. "rolling 7d average". */
  protected abstract periodCue(request: Request, t: Translator): string;
  /** What the centre is called on hover, e.g. "gemiddelde 7d" or "mediaan per dag". */
  protected abstract centreLabel(request: Request, t: Translator): string;
  /** The period a count would have to be unique over, e.g. "a 7-day window" or "a month". */
  protected abstract periodNoun(request: Request): IssueParam;
  /** The refusal when not a single slot is complete. */
  protected abstract noPointIssue(request: Request): IssueSpec;
  /**
   * The blocks of the period just before the screen, as long as what the screen shows, each at the
   * position of the block it is compared with (REQ-037). A running period is compared with the same
   * number of days.
   */
  protected abstract previousSpan(slots: Slot[], request: Request): Slot[];
  /** The name of that period at the end of its line, e.g. "vorige 12 weken" or "vorig jaar". */
  protected abstract comparisonLabel(request: Request, t: Translator): string;

  /** Rules that only hold for the family, e.g. a window in multiples of 7. */
  protected periodRules(_request: Request): IssueSpec[] {
    return [];
  }

  /** Whether the statistic has a spread at all; a single day has none (REQ-031). */
  protected spreadApplies(_request: Request): boolean {
    return true;
  }

  /** Whether a block starts a new year: a calendar axis marks that with a longer, darker tick. */
  protected startsYear(_slot: Slot, _request: Request): boolean {
    return false;
  }

  /** Extra facts on hover; by default how far a running period is. */
  protected slotExtras(slot: Slot, { t }: LabelContext, _request: Request): string[] {
    if (!slot.running) return [];
    return [t('chart.running', { count: slot.last - slot.first + 1, total: slot.fullLast - slot.first + 1 })];
  }

  // ----- The contract -----

  schema(): object {
    const period = this.periodSchema();
    return {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: `semgraph:${this.id}/request`,
      title: `${this.id} request`,
      description: `${this.periodDescription} ${this.statistic.description} The caller sends raw daily values; the service computes periods, statistics, axes and labels.`,
      type: 'object',
      additionalProperties: false,
      required: ['semgraph', 'metric', 'measureType', ...period.required, 'horizon', 'data'],
      properties: {
        semgraph: { const: this.id },
        metric: {
          description: 'Identifier of the metric, e.g. creditLeads. Used as title when no title is given.',
          type: 'string',
          pattern: '^[A-Za-z][A-Za-z0-9_]{0,63}$',
        },
        title: {
          description: 'Title above the chart. States what is shown, not a conclusion.',
          type: 'string',
          minLength: 1,
          maxLength: 120,
        },
        measureType: {
          description: 'Kind of number. Required until Domain Hub or the dbt YAML supplies it.',
          enum: ['additive', 'unique', 'ratio'],
        },
        uniqueAggregation: {
          description: 'Required for unique counts: daily shows the daily uniques; overPeriod (unique over the whole period) cannot be derived from daily values.',
          enum: ['daily', 'overPeriod'],
        },
        ...period.properties,
        spread: this.statistic.spreadSchema(),
        values: {
          description: 'Which values are written on the chart: off, last (the last value), lastAndPrevious (the last final value in bold, a running one next to it in grey) or all (only with few points; otherwise the default is used).',
          enum: [...VALUES_MODES],
          default: this.defaultValues,
        },
        valueAxis: {
          description: 'zero: the value axis starts at zero. zoom: it may start at a round value just below the data, marked with a zigzag at the start of the baseline and a bold first value; allowed for positions such as averages and medians.',
          enum: ['zero', 'zoom'],
          default: 'zero',
        },
        format: {
          description: 'Output format. Only svg is available in v0.',
          enum: ['svg', 'png', 'html', 'widget'],
          default: 'svg',
        },
        locale: {
          description: 'Language of titles, labels and messages, e.g. en or nl-BE. Unknown locales fall back to English.',
          type: 'string',
          pattern: '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$',
        },
        context: {
          description: 'Provenance and status for the footer. Missing values are shown as unknown.',
          type: 'object',
          additionalProperties: false,
          properties: {
            domain: { type: 'string', minLength: 1, maxLength: 80 },
            dataset: { type: 'string', minLength: 1, maxLength: 80 },
            owner: { type: 'string', minLength: 1, maxLength: 80 },
            reliability: { type: 'string', minLength: 1, maxLength: 80 },
            definitionUrl: { type: 'string', minLength: 1, maxLength: 500 },
          },
        },
        meta: META_SCHEMA,
        data: {
          description: 'Daily values. 0 is a measured zero; null or an absent day means no data. Send zeros explicitly.',
          type: 'array',
          minItems: 1,
          maxItems: 4000,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['day', 'value'],
            properties: {
              day: { type: 'string', pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' },
              value: { type: ['number', 'null'], minimum: 0 },
            },
          },
        },
      },
    };
  }

  check(request: Request): IssueSpec[] {
    return checkDailySeries(request.data);
  }

  // ----- Computation -----

  compute(request: Request, { now }: { now: Date }): TimeAxisComputed {
    const values = new Map<number, number | null>();
    for (const { day, value } of request.data) values.set(parseDay(day)!, value);

    // "Today" is the last day in the data, but never the running day in Brussels: it is not complete yet.
    const yesterday = currentDay(now) - 1;
    const reference = Math.min(Math.max(...values.keys()), yesterday);
    const ignoredAfterReference = [...values.keys()].filter((day) => day > reference).length;

    const slots = this.slots(reference, request);
    const rangeStart = slots[0]!.first;
    const rangeDays = reference - rangeStart + 1;
    const absentDays: number[] = [];
    for (let day = rangeStart; day <= reference; day++) {
      if (typeof values.get(day) !== 'number') absentDays.push(day);
    }

    const spreadApplies = this.statistic.hasSpread && this.spreadApplies(request);
    const spreadAsked = (request.spread ?? this.statistic.spreadName) !== 'none';
    const withSpread = spreadApplies && spreadAsked;
    const { points, missing } = this.summarize(slots, values, withSpread);
    // REQ-005: the comparison line never has a band, so its spread is not computed.
    const comparison = this.compares ? this.summarize(this.previousSpan(slots, request), values, false) : null;

    // "all" only while every value has room above its point; otherwise the family's default. A
    // comparison labels the ends of its lines instead (REQ-003).
    const asked = this.compares ? 'off' : (request.values ?? this.defaultValues);
    const valuesFallback = asked === 'all' && this.plotWidth / slots.length < MIN_WIDTH_FOR_ALL;

    return {
      reference,
      referenceIsYesterday: reference === yesterday,
      ignoredAfterReference,
      rangeStart,
      rangeDays,
      valuesInRange: rangeDays - absentDays.length,
      withSpread,
      spreadOmitted: spreadApplies && !spreadAsked,
      values: valuesFallback ? this.defaultValues : asked,
      valuesFallback,
      slots,
      points,
      missing,
      absentDays,
      comparison: comparison && { slots: this.previousSpan(slots, request), points: comparison.points },
    };
  }

  /** Strict: a slot with a missing day has no value; missing days are never zero or interpolated. */
  private summarize(slots: Slot[], values: Map<number, number | null>, withSpread: boolean) {
    const points: SlotPoint[] = [];
    const missing: number[] = [];
    for (const slot of slots) {
      const slotValues: number[] = [];
      for (let day = slot.first; day <= slot.last; day++) {
        const value = values.get(day);
        if (typeof value === 'number') slotValues.push(value);
      }
      if (slotValues.length < slot.last - slot.first + 1) missing.push(slot.rel);
      else points.push({ ...slot, ...this.statistic.summarize(slotValues, withSpread), days: slotValues.length });
    }
    return { points, missing };
  }

  // ----- The chart-language rules -----

  rules(request: Request, computed: TimeAxisComputed, { metadata }: { metadata: SemgraphMetadata }): IssueSpec[] {
    const issues: IssueSpec[] = [];

    const allowed = metadata.attributes.measureType ?? 'any';
    if (allowed !== 'any' && !allowed.includes(request.measureType)) {
      issues.push({
        level: 'refusal',
        code: 'measureTypeNotAllowed',
        field: '/measureType',
        params: { measureType: request.measureType, allowed: allowed.join(', ') },
      });
    }

    // Daily uniques and the uniques over a whole period are two different metrics.
    if (request.measureType === 'unique') {
      if (request.uniqueAggregation === undefined) {
        issues.push({ level: 'refusal', code: 'uniqueAggregationRequired', field: '/uniqueAggregation', learnMore: LEARNING_PLAN_LEVEL_1 });
      } else if (request.uniqueAggregation === 'overPeriod' || this.statistic.kind === 'amount') {
        // A total of daily uniques counts someone who comes back on several days several times.
        issues.push({
          level: 'refusal',
          code: 'uniquesOverPeriodNotDerivable',
          field: request.uniqueAggregation === 'overPeriod' ? '/uniqueAggregation' : '/statistic',
          params: { period: this.periodNoun(request) },
          learnMore: LEARNING_PLAN_LEVEL_1,
        });
      }
    } else if (request.uniqueAggregation !== undefined) {
      issues.push({ level: 'info', code: 'uniqueAggregationIgnored', field: '/uniqueAggregation' });
    }

    const { minimumPoints } = metadata.data;
    if (computed.valuesInRange < minimumPoints) {
      issues.push({
        level: 'refusal',
        code: 'insufficientData',
        field: '/data',
        params: {
          count: computed.valuesInRange,
          days: computed.rangeDays,
          from: formatDay(computed.rangeStart),
          to: formatDay(computed.reference),
          minimumPoints,
        },
        learnMore: metadata.links.learning,
      });
    } else if (computed.points.length === 0) {
      issues.push({ ...this.noPointIssue(request), learnMore: metadata.links.learning });
    } else if (computed.comparison && computed.comparison.points.length === 0) {
      // Nothing to compare with: the data does not reach back to the period before the screen.
      issues.push({
        level: 'refusal',
        code: 'noComparisonData',
        field: '/data',
        params: { from: formatDay(computed.comparison.slots[0]!.first), to: formatDay(computed.comparison.slots.at(-1)!.fullLast) },
      });
    }

    issues.push(...this.periodRules(request));
    // REQ-032: allowed, but discouraged with a red alert between the title and the chart.
    if (computed.spreadOmitted) {
      issues.push({ level: 'deviation', code: this.statistic.withoutSpreadCode, field: '/spread', learnMore: LEARNING_PLAN_LEVEL_1 });
    }
    if (computed.valuesFallback) {
      issues.push({ level: 'info', code: 'valuesAllTooDense', field: '/values', params: { values: computed.values } });
    }
    if (computed.ignoredAfterReference > 0) {
      issues.push({
        level: 'info',
        code: 'daysAfterReferenceIgnored',
        field: '/data',
        params: { count: computed.ignoredAfterReference, day: formatDay(computed.reference) },
      });
    }
    return issues;
  }

  // ----- Drawing: everything is decided here; Vega-Lite only draws what it gets -----

  draw(request: Request, computed: TimeAxisComputed, { t, tokens }: DrawContext): Drawing {
    const { slots, points } = computed;
    const previous = computed.comparison?.points ?? [];
    const count = slots.length;
    const plotWidth = this.plotWidth;
    const padding = this.padding;
    const slotWidth = plotWidth / count;
    const barWidth = this.statistic.barWidth(tokens);
    // REQ-005: with a comparison, the spread of the focus series is always a light band.
    const form = this.compares ? 'band' : formFor(count, barWidth, plotWidth);
    const surface = color(tokens, 'surface');
    const focus = color(tokens, 'focus');
    const labels = labelsFor(points, computed.values);

    // Value axis: from zero, or zoomed with a zigzag and a bold first value; high enough that every
    // value label fits above its point, and the comparison line fits too.
    const highest = Math.max(...points.map((point) => point.spread?.hi ?? point.centre), ...previous.map((point) => point.centre));
    const lowest = Math.min(...points.map((point) => Math.max(0, point.spread?.lo ?? point.centre)), ...previous.map((point) => point.centre));
    const mode = request.valueAxis ?? 'zero';
    let scale = valueScale(lowest, highest, mode);
    for (let attempt = 0; attempt < 4; attempt++) {
      const needed = headroom(labels, highest, (scale.max - scale.min) / PLOT_HEIGHT);
      if (needed <= scale.max) break;
      scale = valueScale(lowest, needed, mode);
    }
    const tickFormat = numberFormat(t.locale, decimalsOf(scale.ticks[1]! - scale.ticks[0]!));
    const yLabels = Object.fromEntries(scale.ticks.map((tick) => [String(tick), tickFormat.format(tick)]));
    // Whole numbers stay whole (daily counts); otherwise one decimal below 100.
    const whole = points.every((point) => [point.centre, point.spread?.lo ?? 0, point.spread?.hi ?? 0].every(Number.isInteger));
    const valueFormat = numberFormat(t.locale, highest >= 100 || whole ? 0 : 1);
    const perPixel = { x: count / plotWidth, y: (scale.max - scale.min) / PLOT_HEIGHT };

    const x = {
      field: 'rel',
      type: 'quantitative' as const,
      scale: { domain: [-(count - 1) - 0.5, 0.5], nice: false, zero: false },
    };
    const y = (field: string) => ({
      field,
      type: 'quantitative' as const,
      scale: { domain: [scale.min, scale.max], nice: false, zero: false },
    });

    // Time axis: the family chooses the step, the labels and where a year starts.
    const bySlot = new Map(slots.map((slot) => [slot.rel, slot]));
    const axis = timeAxis({
      count,
      slotWidth,
      labels: ticksEvery(this.tickStep(request, count, slotWidth), count).map((rel, index) => ({
        rel,
        lines: this.tickLabel(bySlot.get(rel)!, { t, computed, isFirst: index === 0 }, request),
      })),
      yearStarts: slots.filter((slot) => this.startsYear(slot, request)).map((slot) => slot.rel),
      x,
      plotHeight: PLOT_HEIGHT,
      tokens,
    });

    // REQ-001: a time axis is always a line through the points, in both forms, also up to a running
    // period. Missing data breaks the line; it is never bridged.
    const line = withSegments(points);
    // The band covers the final points only (REQ-009: a light area is spread, nothing else).
    const settled = withSegments(points.filter((point) => !point.running));
    const alone = new Set(settled.filter((point) => point.segmentLength === 1).map((point) => point.rel));
    const ownBar = (point: SlotPoint) => form === 'bars' || point.running || alone.has(point.rel);
    // Spread: a bar per point (shortened by half its width, so the round caps end exactly at the
    // spread), or a band under the line; a point that is not part of the band keeps its own bar.
    const capPad = (barWidth / 2) * perPixel.y;
    const bar = (point: SlotPoint) => {
      if (!point.spread) return [];
      const lo = Math.max(0, point.spread.lo) + capPad;
      const hi = point.spread.hi - capPad;
      return [{ rel: point.rel, lo: Math.min(lo, point.centre), hi: Math.max(hi, point.centre) }];
    };
    const bars = points.filter(ownBar).flatMap(bar);
    const band = form === 'band'
      ? settled
          .filter((point) => point.segmentLength > 1)
          .flatMap((point) => (point.spread ? [{ rel: point.rel, segment: point.segment, lo: Math.max(0, point.spread.lo), hi: point.spread.hi }] : []))
      : [];
    // Markers: every point while there is room; on a dense line only the points with their own bar
    // and the last one, so the signature (REQ-006, REQ-008) stays visible (REQ-028). A comparison
    // marks every point of the focus series while they fit, as in Figma.
    const marked = this.compares && slotWidth >= 8 ? points : points.filter((point) => ownBar(point) || point.rel === 0);

    // The comparison (REQ-003, REQ-004): a grey line, the shortfall hatched, both ends labelled.
    const comparisonLine = withSegments(previous).map(({ rel, centre, segment }) => ({ rel, centre, segment }));
    const hatch = shortfall(points, previous);
    const hatchId = hatch.length > 0 ? patternId(JSON.stringify([request.metric, hatch])) : undefined;
    const pixelY = (value: number) => PLOT_HEIGHT * (1 - (value - scale.min) / (scale.max - scale.min));
    const lastFocus = this.compares ? points.find((point) => point.rel === 0) : undefined;
    const lastPrevious = previous.at(-1);
    const ends = endLabels(lastFocus && pixelY(lastFocus.centre), lastPrevious && pixelY(lastPrevious.centre), lastFocus?.running);
    const endValue = lastFocus ? [{ rel: lastFocus.rel, py: ends.focus, text: valueFormat.format(lastFocus.centre) }] : [];
    // With a comparison, "lopend" goes under the value at the end instead of under the point.
    const endRunning = lastFocus?.running ? [{ rel: lastFocus.rel, py: ends.focus! + SECOND_LINE, text: t('chart.runningShort') }] : [];
    const endComparison = this.compares && lastPrevious ? [{ rel: lastPrevious.rel, py: ends.comparison, text: this.comparisonLabel(request, t) }] : [];

    const missing = runs(computed.missing).map(([from, to]) => ({ from: from - 0.5, to: to + 0.5, center: (from + to) / 2, slots: to - from + 1 }));
    const missingLabels = missing
      .filter((stretch) => stretch.slots * slotWidth >= MIN_LABEL_WIDTH)
      .map((stretch) => ({ rel: stretch.center, label: t('chart.noData') }));

    const values = valueLabels({
      labels,
      running: this.compares ? [] : points.filter((point) => point.running),
      statistic: this.statistic,
      format: valueFormat,
      t,
      tokens,
      x,
      y,
      perPixel: perPixel.y,
      min: scale.min,
    });

    // A zigzag at the start of the baseline: the value axis does not start at zero.
    const left = -(count - 1) - 0.5;
    const zigzag = scale.zoomed
      ? [[0, 0], [2, 3], [5, -3], [8, 3], [10, 0]].map(([px, py], order) => ({
          rel: left + px! * perPixel.x,
          value: scale.min + py! * perPixel.y,
          order,
        }))
      : [];
    const mask = scale.zoomed ? [{ rel: left, rel2: left + 11 * perPixel.x, value: scale.min }] : [];

    const fillByState = { condition: { test: 'datum.running', value: surface }, value: focus };
    const strokeByState = { condition: { test: 'datum.running', value: focus }, value: surface };

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      width: plotWidth,
      height: PLOT_HEIGHT,
      autosize: { type: 'none' },
      padding,
      background: 'transparent',
      config: vegaLiteConfig(tokens),
      datasets: {
        frame: [{ rel: left + 0.5, value: scale.min }],
        ...axis.datasets,
        missing,
        missingLabels,
        bars,
        band,
        line,
        points: marked,
        mask,
        zigzag,
        comparisonLine,
        hatch,
        endValue,
        endRunning,
        endComparison,
        ...values.datasets,
      },
      layer: [
        {
          // The baseline and the value axis, on a layer that always exists; the time axis has its own layers.
          data: { name: 'frame' },
          mark: { type: 'point', opacity: 0 },
          encoding: {
            x: { ...x, axis: { values: [], ticks: false, labels: false, title: null } },
            y: {
              ...y('value'),
              axis: {
                values: scale.ticks,
                labelExpr: lookup(yLabels),
                title: null,
                ...(scale.zoomed ? { labelFontWeight: { condition: { test: `datum.value === ${scale.min}`, value: 'bold' }, value: 'normal' } } : {}),
              },
            },
          },
        },
        ...axis.layers,
        {
          // Missing data is an outlined area, never a zero and never interpolated.
          data: { name: 'missing' },
          mark: { type: 'rect', fill: null, stroke: color(tokens, 'context/dark'), strokeWidth: tokens.stroke.missing },
          encoding: { x: { ...x, field: 'from' }, x2: { field: 'to' } },
        },
        {
          data: { name: 'missingLabels' },
          mark: { type: 'text', align: 'center', baseline: 'top', fontSize: tokens.size.detail, color: color(tokens, 'text/muted') },
          encoding: { x, y: { value: 6 }, text: { field: 'label' } },
        },
        {
          data: { name: 'band' },
          mark: { type: 'area', color: color(tokens, 'focus/light'), opacity: 1 },
          encoding: { x, y: y('lo'), y2: { field: 'hi' }, detail: { field: 'segment' } },
        },
        {
          // REQ-004: only a shortfall against the comparison is hatched; a gain gets no fill.
          data: { name: 'hatch' },
          mark: { type: 'area', fill: hatchId ? `url(#${hatchId})` : surface, opacity: 1 },
          encoding: { x, y: y('lo'), y2: { field: 'hi' }, detail: { field: 'piece' } },
        },
        {
          data: { name: 'bars' },
          mark: { type: 'rule', strokeWidth: barWidth, strokeCap: 'round', color: color(tokens, 'focus/light') },
          encoding: { x, y: y('lo'), y2: { field: 'hi' } },
        },
        {
          // REQ-003: the period before the screen as a grey line, never with a band (REQ-005).
          data: { name: 'comparisonLine' },
          mark: { type: 'line', color: color(tokens, 'context'), strokeWidth: tokens.stroke.line },
          encoding: { x, y: y('centre'), detail: { field: 'segment' } },
        },
        {
          data: { name: 'line' },
          mark: { type: 'line', color: focus, strokeWidth: tokens.stroke.line },
          encoding: { x, y: y('centre'), detail: { field: 'segment' } },
        },
        {
          // The centre has the shape of its statistic: filled when final, hollow while its period is
          // still running (REQ-006, REQ-008).
          data: { name: 'points' },
          mark: { type: 'point', shape: this.statistic.shape, filled: true, size: markerSize(tokens, this.statistic.kind), opacity: 1 },
          encoding: {
            x,
            y: y('centre'),
            fill: fillByState,
            stroke: strokeByState,
            strokeWidth: { condition: { test: 'datum.running', value: 1.5 }, value: 1 },
          },
        },
        {
          data: { name: 'mask' },
          mark: { type: 'rule', color: surface, strokeWidth: tokens.stroke.baseline + 2 },
          encoding: { x: { ...x, field: 'rel' }, x2: { field: 'rel2' }, y: y('value') },
        },
        {
          data: { name: 'zigzag' },
          mark: { type: 'line', color: color(tokens, 'baseline'), strokeWidth: tokens.stroke.baseline, strokeJoin: 'miter' },
          encoding: { x, y: y('value'), order: { field: 'order' } },
        },
        ...values.layers,
        {
          data: { name: 'endValue' },
          mark: { type: 'text', align: 'left', baseline: 'middle', dx: 8, fontSize: tokens.size.value, fontWeight: 'bold', color: color(tokens, 'text') },
          encoding: { x, y: { field: 'py', type: 'quantitative', scale: null }, text: { field: 'text' } },
        },
        {
          data: { name: 'endRunning' },
          mark: { type: 'text', align: 'left', baseline: 'middle', dx: 8, fontSize: tokens.size.detail, color: color(tokens, 'text/muted') },
          encoding: { x, y: { field: 'py', type: 'quantitative', scale: null }, text: { field: 'text' } },
        },
        {
          data: { name: 'endComparison' },
          mark: { type: 'text', align: 'left', baseline: 'middle', dx: 8, fontSize: tokens.size.detail, color: color(tokens, 'text/muted') },
          encoding: { x, y: { field: 'py', type: 'quantitative', scale: null }, text: { field: 'text' } },
        },
      ],
    } as TopLevelSpec;

    const hover = this.hoverSpecs(request, computed, t, valueFormat);

    const title = request.title ?? request.metric;
    const cue = [
      this.periodCue(request, t),
      computed.withSpread ? t(`cue.spread.${this.statistic.id}`) : '',
      this.compares ? t('cue.comparison', { label: this.comparisonLabel(request, t) }) : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const readingCue = request.measureType === 'unique' ? `${t('cue.unique')} · ${cue}` : cue;
    const last = points.find((point) => point.rel === 0);
    const description = [
      t('desc.base', { title, cue: readingCue, date: localizeDay(t, computed.reference, 'long') }),
      last ? t('desc.latest', { stats: this.statistic.formatStats(t, valueFormat, last) }) : t('desc.latestMissing'),
    ].join(' ');

    return {
      vegaLite: spec,
      width: WIDTH,
      height: padding.top + PLOT_HEIGHT + padding.bottom,
      plotArea: { x: padding.left, y: padding.top, width: plotWidth, height: PLOT_HEIGHT },
      ...(hatchId ? { defs: hatchPattern(hatchId, tokens) } : {}),
      hover,
      title,
      readingCue,
      description,
      asOf: computed.reference,
    };
  }

  /**
   * What each slot shows on hover, also a slot without data: its name (bold), the centre, the spread
   * and the family's extras, e.g. "23 sep (−7d)", "gemiddelde 7d: 43,7", "±1 sd: 12,2", "venster 17–23 sep";
   * or why it has no value, e.g. "geen data: 15 sep ontbreekt".
   */
  protected hoverSpecs(request: Request, computed: TimeAxisComputed, t: Translator, format: Intl.NumberFormat): HoverSpec[] {
    const absent = new Set(computed.absentDays);
    const byRel = new Map(computed.points.map((point) => [point.rel, point]));
    const previousSlots = new Map(computed.comparison?.slots.map((slot) => [slot.rel, slot]));
    const previousPoints = new Map(computed.comparison?.points.map((point) => [point.rel, point]));
    return computed.slots.map((slot) => {
      const context = { t, computed, isFirst: false };
      const name = { text: this.slotLabel(slot, context, request), bold: true };
      const point = byRel.get(slot.rel);
      // With a comparison: the value of the block it is compared with, e.g. "vorige periode, week 28 (6–12 jul): 41,0".
      const previousSlot = previousSlots.get(slot.rel);
      const previous = previousSlot ? previousPoints.get(slot.rel) : undefined;
      const comparison = previousSlot
        ? [{
            text: previous
              ? t('hover.comparison', { name: this.slotLabel(previousSlot, context, request), value: format.format(previous.centre) })
              : t('hover.comparisonMissing', { name: this.slotLabel(previousSlot, context, request) }),
          }]
        : [];
      if (!point) {
        const gaps = [];
        for (let day = slot.first; day <= slot.last; day++) if (absent.has(day)) gaps.push(day);
        const first = localizeDay(t, gaps[0] ?? slot.first, 'short');
        const text = gaps.length === 1 ? t('chart.missing.one', { absent: first }) : t('chart.missing.many', { count: gaps.length, absent: first });
        return { x: slot.rel, lines: [name, { text }, ...comparison] };
      }
      const spread = this.statistic.spreadLine(t, format, point);
      return {
        x: slot.rel,
        point: { y: point.centre, lo: point.spread?.lo ?? null, hi: point.spread?.hi ?? null },
        lines: [
          name,
          { text: `${this.centreLabel(request, t)}: ${format.format(point.centre)}` },
          ...(spread ? [{ text: spread }] : []),
          ...this.slotExtras(slot, context, request).map((text) => ({ text })),
          ...comparison,
        ],
      };
    });
  }
}

/** Numbers each run of consecutive slots, so a line or band never bridges a gap. */
function withSegments<Point extends { rel: number }>(points: readonly Point[]) {
  let segment = 0;
  const segmentOf = points.map((point, index) => {
    if (index > 0 && point.rel !== points[index - 1]!.rel + 1) segment++;
    return segment;
  });
  const lengths = new Map<number, number>();
  for (const id of segmentOf) lengths.set(id, (lengths.get(id) ?? 0) + 1);
  return points.map((point, index) => ({ ...point, segment: segmentOf[index]!, segmentLength: lengths.get(segmentOf[index]!)! }));
}

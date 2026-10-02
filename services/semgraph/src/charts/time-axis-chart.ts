import type { TopLevelSpec } from 'vega-lite';
import { checkDailySeries, currentDay, formatDay, localizeDay, parseDay } from '../core/days.ts';
import type { Translator } from '../core/i18n.ts';
import type { IssueParam, IssueSpec } from '../core/issues.ts';
import type {
  DrawContext,
  Drawing,
  HoverTarget,
  RequestContext,
  SemgraphImplementation,
  SemgraphMetadata,
} from '../core/semgraph.ts';
import { color, vegaLiteConfig } from '../core/tokens.ts';
import { decimalsOf, lookup, numberFormat, runs, ticksEvery, valueScale, type ValueAxisMode } from './scales.ts';
import type { Statistic, Summary } from './statistics.ts';

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
  format?: string;
  locale?: string;
  context?: RequestContext;
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
  slots: Slot[];
  /** Slots whose days all have a value. */
  points: SlotPoint[];
  /** Slots with a missing day: drawn as missing, never as zero, never interpolated. */
  missing: number[];
  /** Days in the range without a value, in order. */
  absentDays: number[];
}

export interface LabelContext {
  t: Translator;
  computed: TimeAxisComputed;
  /** The leftmost labelled tick, which names the year where that helps. */
  isFirst: boolean;
}

export const WIDTH = 640;
export const PLOT_HEIGHT = 200;
/** Fixed geometry (autosize none): room for the y labels left and the last value's label right. */
export const PADDING = { left: 52, right: 64, top: 14, bottom: 30 };
export const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
/** At most this many labels on the time axis. */
export const MAX_TICKS = 8;
/** A "no data" label is only written in a missing stretch at least this wide. */
const MIN_LABEL_WIDTH = 44;

/** Whether each slot is drawn on its own (a dot with its bar), or the slots as a line with a band. */
export type Form = 'dots' | 'line';

/** Dots while each slot has room for its bar plus some air, a line with a band beyond that. */
export function formFor(slots: number, barWidth: number): Form {
  return PLOT_WIDTH / slots >= Math.max(8, barWidth + 4) ? 'dots' : 'line';
}

/** Master-leerplan, level 1: unique counts (1.2.2), rolling periods (1.4.2), centre and spread (1.5.4). */
export const LEARNING_PLAN_LEVEL_1 = 'https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1354629146';

/**
 * Base class of every chart with a time axis of daily data. It owns everything the families share:
 * the contract, the reference day, the strict handling of missing days, the chart-language rules,
 * the value axis (from zero or zoomed), the drawing and the hover labels. A family decides which
 * days each slot summarizes and how slots are labelled; the statistic decides centre and spread.
 */
export abstract class TimeAxisChart<Request extends TimeAxisRequest>
  implements SemgraphImplementation<Request, TimeAxisComputed>
{
  readonly id: string;
  readonly statistic: Statistic;

  constructor(id: string, statistic: Statistic) {
    this.id = id;
    this.statistic = statistic;
  }

  // ----- What a family adds -----

  protected abstract readonly periodDescription: string;
  /** Contract properties of the family, such as window or unit, and its horizon. */
  protected abstract periodSchema(): { properties: Record<string, object>; required: string[] };
  /** The slots, oldest first, ending with the one that contains the reference day. */
  protected abstract slots(reference: number, request: Request): Slot[];
  /** Number of slots between two labelled ticks. */
  protected abstract tickStep(request: Request, slots: number, slotWidth: number): number;
  protected abstract tickLabel(slot: Slot, context: LabelContext, request: Request): string;
  /** What a slot is on hover, e.g. "23 sep (−7d)" or "week 39 (21–27 sep)". */
  protected abstract slotLabel(slot: Slot, context: LabelContext, request: Request): string;
  /** The reading cue of the family, e.g. "rolling 7d average". */
  protected abstract periodCue(request: Request, t: Translator): string;
  /** The period a count would have to be unique over, e.g. "a 7-day window" or "a month". */
  protected abstract periodNoun(request: Request): IssueParam;
  /** The refusal when not a single slot is complete. */
  protected abstract noPointIssue(request: Request): IssueSpec;

  /** Rules that only hold for the family, e.g. a window in multiples of 7. */
  protected periodRules(_request: Request): IssueSpec[] {
    return [];
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

    const withSpread = (request.spread ?? this.statistic.spreadName) !== 'none';
    const points: SlotPoint[] = [];
    const missing: number[] = [];
    for (const slot of slots) {
      const slotValues: number[] = [];
      for (let day = slot.first; day <= slot.last; day++) {
        const value = values.get(day);
        if (typeof value === 'number') slotValues.push(value);
      }
      // Strict: a slot with a missing day has no value; missing days are never zero or interpolated.
      if (slotValues.length < slot.last - slot.first + 1) missing.push(slot.rel);
      else points.push({ ...slot, ...this.statistic.summarize(slotValues, withSpread), days: slotValues.length });
    }

    return {
      reference,
      referenceIsYesterday: reference === yesterday,
      ignoredAfterReference,
      rangeStart,
      rangeDays,
      valuesInRange: rangeDays - absentDays.length,
      withSpread,
      slots,
      points,
      missing,
      absentDays,
    };
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
      } else if (request.uniqueAggregation === 'overPeriod') {
        issues.push({
          level: 'refusal',
          code: 'uniquesOverPeriodNotDerivable',
          field: '/uniqueAggregation',
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
    }

    issues.push(...this.periodRules(request));
    if (!computed.withSpread) {
      issues.push({ level: 'deviation', code: this.statistic.withoutSpreadCode, field: '/spread', learnMore: LEARNING_PLAN_LEVEL_1 });
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
    const count = slots.length;
    const slotWidth = PLOT_WIDTH / count;
    const barWidth = this.statistic.barWidth(tokens);
    const form = formFor(count, barWidth);
    const surface = color(tokens, 'surface');
    const focus = color(tokens, 'focus');

    // Value axis: from zero, or zoomed with a zigzag and a bold first value.
    const highest = Math.max(...points.map((point) => point.spread?.hi ?? point.centre));
    const lowest = Math.min(...points.map((point) => Math.max(0, point.spread?.lo ?? point.centre)));
    const scale = valueScale(lowest, highest, request.valueAxis ?? 'zero');
    const tickFormat = numberFormat(t.locale, decimalsOf(scale.ticks[1]! - scale.ticks[0]!));
    const yLabels = Object.fromEntries(scale.ticks.map((tick) => [String(tick), tickFormat.format(tick)]));
    const valueFormat = numberFormat(t.locale, highest >= 100 ? 0 : 1);

    // Time axis: the family chooses the step and the labels.
    const bySlot = new Map(slots.map((slot) => [slot.rel, slot]));
    const xTicks = ticksEvery(this.tickStep(request, count, slotWidth), count);
    const xLabels = Object.fromEntries(
      xTicks.map((rel, index) => [String(rel), this.tickLabel(bySlot.get(rel)!, { t, computed, isFirst: index === 0 }, request)]),
    );

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

    // Spread: a bar per slot (shortened by half its width, so the round caps end exactly at the
    // spread), or a band under the line; a running period always keeps its own bar.
    const capPad = (barWidth / 2) * ((scale.max - scale.min) / PLOT_HEIGHT);
    const bar = (point: SlotPoint) => {
      if (!point.spread) return [];
      const lo = Math.max(0, point.spread.lo) + capPad;
      const hi = point.spread.hi - capPad;
      return [{ rel: point.rel, lo: Math.min(lo, point.centre), hi: Math.max(hi, point.centre) }];
    };
    const settled = withSegments(points.filter((point) => !point.running));
    const running = points.filter((point) => point.running);
    const dotted = form === 'dots' ? points : [...settled.filter((point) => point.segmentLength === 1), ...running];
    const bars = (form === 'dots' ? points : running).flatMap(bar);
    const band = form === 'line'
      ? settled.flatMap((point) => (point.spread ? [{ rel: point.rel, segment: point.segment, lo: Math.max(0, point.spread.lo), hi: point.spread.hi }] : []))
      : [];

    const missing = runs(computed.missing).map(([from, to]) => ({ from: from - 0.5, to: to + 0.5, center: (from + to) / 2, slots: to - from + 1 }));
    const missingLabels = missing
      .filter((stretch) => stretch.slots * slotWidth >= MIN_LABEL_WIDTH)
      .map((stretch) => ({ rel: stretch.center, label: t('chart.noData') }));

    const last = points.find((point) => point.rel === 0);
    const latest = last
      ? [{
          rel: 0,
          centre: last.centre,
          value: valueFormat.format(last.centre),
          detail: [this.statistic.formatDetail(valueFormat, last), last.running ? t('chart.runningShort') : '']
            .filter(Boolean)
            .join(' · '),
        }]
      : [];

    // A zigzag at the start of the baseline: the value axis does not start at zero.
    const perPixel = { x: count / PLOT_WIDTH, y: (scale.max - scale.min) / PLOT_HEIGHT };
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
    const textMark = { type: 'text', align: 'left', baseline: 'middle', dx: 10 } as const;

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      width: PLOT_WIDTH,
      height: PLOT_HEIGHT,
      autosize: { type: 'none' },
      padding: PADDING,
      background: 'transparent',
      config: vegaLiteConfig(tokens),
      datasets: {
        frame: [{ rel: left + 0.5, value: scale.min }],
        missing,
        missingLabels,
        bars,
        band,
        line: settled,
        dots: dotted,
        latest,
        mask,
        zigzag,
      },
      layer: [
        {
          // Both axes, with the ticks and labels computed above, on a layer that always exists.
          data: { name: 'frame' },
          mark: { type: 'point', opacity: 0 },
          encoding: {
            x: { ...x, axis: { values: xTicks, labelExpr: lookup(xLabels), title: null } },
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
        {
          // Missing data is an outlined area, never a zero and never interpolated.
          data: { name: 'missing' },
          mark: { type: 'rect', fill: null, stroke: color(tokens, 'context'), strokeWidth: tokens.stroke.missing },
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
          data: { name: 'bars' },
          mark: { type: 'rule', strokeWidth: barWidth, strokeCap: 'round', color: color(tokens, 'focus/light') },
          encoding: { x, y: y('lo'), y2: { field: 'hi' } },
        },
        ...(form === 'line'
          ? [{
              data: { name: 'line' },
              mark: { type: 'line', color: focus, strokeWidth: tokens.stroke.line },
              encoding: { x, y: y('centre'), detail: { field: 'segment' } },
            }]
          : []),
        {
          // The centre is a dot: filled when final, hollow while its period is still running.
          data: { name: 'dots' },
          mark: { type: 'point', filled: true, size: tokens.mark.meanSize, opacity: 1 },
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
        {
          // The last value (10, bold) and its spread as a detail (8, muted).
          data: { name: 'latest' },
          mark: { ...textMark, dy: -6, fontSize: tokens.size.value, fontWeight: 'bold', color: color(tokens, 'text') },
          encoding: { x, y: y('centre'), text: { field: 'value' } },
        },
        {
          data: { name: 'latest' },
          mark: { ...textMark, dy: 6, fontSize: tokens.size.detail, color: color(tokens, 'text/muted') },
          encoding: { x, y: y('centre'), text: { field: 'detail' } },
        },
      ],
    } as TopLevelSpec;

    // On hover, every slot says what it shows, or why it has no value.
    const absent = new Set(computed.absentDays);
    const byRel = new Map(points.map((point) => [point.rel, point]));
    const hover: HoverTarget[] = slots.map((slot) => {
      const context = { t, computed, isFirst: false };
      const point = byRel.get(slot.rel);
      let facts: string;
      if (point) {
        facts = this.statistic.formatStats(t, valueFormat, point);
      } else {
        const gaps = [];
        for (let day = slot.first; day <= slot.last; day++) if (absent.has(day)) gaps.push(day);
        const first = localizeDay(t, gaps[0] ?? slot.first, 'short');
        facts = gaps.length === 1
          ? t('chart.missing.one', { absent: first })
          : t('chart.missing.many', { count: gaps.length, absent: first });
      }
      const label = [this.slotLabel(slot, context, request), facts, ...this.slotExtras(slot, context, request)].join(' · ');
      return { x: (slot.rel + count - 1) * slotWidth, width: slotWidth, label };
    });

    const title = request.title ?? request.metric;
    const cue = [this.periodCue(request, t), computed.withSpread ? t(`cue.spread.${this.statistic.id}`) : '']
      .filter(Boolean)
      .join(' · ');
    const readingCue = request.measureType === 'unique' ? `${t('cue.unique')} · ${cue}` : cue;
    const description = [
      t('desc.base', { title, cue: readingCue, date: localizeDay(t, computed.reference, 'long') }),
      last ? t('desc.latest', { stats: this.statistic.formatStats(t, valueFormat, last) }) : t('desc.latestMissing'),
    ].join(' ');

    return {
      vegaLite: spec,
      width: WIDTH,
      height: PADDING.top + PLOT_HEIGHT + PADDING.bottom,
      plotArea: { x: PADDING.left, y: PADDING.top, width: PLOT_WIDTH, height: PLOT_HEIGHT },
      hover,
      title,
      readingCue,
      description,
      asOf: computed.reference,
    };
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

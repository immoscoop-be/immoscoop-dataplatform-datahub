import type { TopLevelSpec } from 'vega-lite';
import { currentDay, formatDay, localizeDay, parseDay } from '../core/days.ts';
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
import { stateColumns, statePattern, type DataState } from './data-states.ts';
import { lookup, numberFormat, ticksEvery, valueScale, ZIGZAG, ZIGZAG_MASK, zoomedLabelWeight, type ValueAxisMode } from './scales.ts';
import { sizeOf } from '../core/size.ts';
import { CONTEXT, DAY, FORMAT, LOCALE, MEASURE_TYPE, METRIC, SIZE, THEME, TITLE, UNIQUE_AGGREGATION } from './contract.ts';
import { LEARNING_PLAN_LEVEL_1, measureRules } from './measure.ts';
import { markerSize } from './signatures.ts';
import { baseLayers, denominatorAxis, RIGHT_AXIS } from './ratio.ts';
import { Ratio, type BlockRow, type NumberFormatter, type Statistic, type Summary } from './statistics.ts';
import { AXIS_HEIGHT, timeAxis } from './time-axis.ts';
import { alsoLabelled, headroom, labelsFor, MIN_WIDTH_FOR_ALL, VALUES_MODES, valueLabels, type ValuesMode } from './value-labels.ts';

/** What every time-axis request carries, whatever its periods or statistic. */
export interface TimeAxisRequest {
  semgraph: string;
  metric: string;
  title?: string;
  measureType: 'additive' | 'unique' | 'perUnit' | 'ratio';
  uniqueAggregation?: 'daily' | 'overPeriod';
  /** The last complete day of the data; yesterday in Brussels when absent. */
  asOf?: string;
  valueAxis?: ValueAxisMode;
  values?: ValuesMode;
  /** card, default, large or xl (REQ-085). */
  size?: string;
  format?: string;
  locale?: string;
  context?: RequestContext;
  meta?: ChartMeta;
  /** A ratio: what the numerator and the denominator count, as the reading cue names them (REQ-076). */
  numeratorName?: string;
  denominatorName?: string;
  /** One row per block, computed in the warehouse (REQ-058). */
  points: BlockRow[];
}

/** The days one position on the time axis stands for. */
export interface Slot {
  /** 0 is the last slot, the one with the reference day; -1 the one before, ... */
  rel: number;
  first: number;
  /** Last day covered; never after the reference day. */
  last: number;
  /** Last day of the whole period; after `last` while the period is still running. */
  fullLast: number;
  /** A period that is not over yet: its column gets the running pattern, because its value is not final (REQ-052). */
  running: boolean;
}

export interface SlotPoint extends Slot, Summary {
  /** Number of days the block covers. */
  days: number;
}

export interface TimeAxisComputed {
  /** The last complete day the chart shows ("today"), as a day number. */
  reference: number;
  /** True when the reference day is yesterday, so it may be called "today". */
  referenceIsYesterday: boolean;
  /** Blocks that end after the last complete day: not final, so refused for a rolling window. */
  blocksAfterReference: string[];
  /** Days covered by the blocks with a value. */
  daysWithData: number;
  withSpread: boolean;
  /** The caller left out a spread that belongs to the statistic: a tolerated deviation. */
  spreadOmitted: boolean;
  /** A mean or median of observations without its n on every point (REQ-062). */
  nMissing: boolean;
  /** Points of the current period that rest on few observations (REQ-044), never a running one (REQ-054). */
  few: number[];
  /** A ratio: why its points rest on few observations, statistically thin or an unusual base (REQ-080). */
  fewKinds?: ('thin' | 'base')[];
  /** Which values are written on the chart, and whether "all" fell back because they do not fit. */
  values: ValuesMode;
  valuesFallback: boolean;
  slots: Slot[];
  /** Slots with a value. */
  points: SlotPoint[];
  /** Slots without a value: drawn as empty, never as zero, never interpolated. */
  missing: number[];
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

/** The width of a chart in the default size; another size builds it at another width (REQ-085). */
export const WIDTH = 640;
export const PLOT_HEIGHT = 200;
/** Fixed geometry (autosize none): room for the y labels left, half a value label right, the time axis below. */
export const PADDING = { left: 52, right: 28, top: 14, bottom: AXIS_HEIGHT };
export const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
/** The square in a square of a ratio (REQ-075), as in Figma: 10 px around 3.5 px on a 620 px chart. */
const RATIO_MARK = 8;
const RATIO_INNER = 0.4;
/** A comparison writes the last value and the name of the comparison right of the lines (REQ-003). */
const COMPARISON_PADDING = { ...PADDING, right: 84 };
/** A ratio has the axis of its denominator on the right (REQ-076, REQ-079). */
const RATIO_PADDING = { ...PADDING, right: RIGHT_AXIS };
/** The n of a point with few observations sits under the time axis, on a line of its own (REQ-046). */
const N_LINE = 14;
/** At most this many labels on the time axis in the default size. */
export const MAX_TICKS = 8;

/** REQ-085: the labels of the time axis follow the width of the chart: 8 by default, 5 on a card, 12 and 16 on a slide and a big screen. */
export function maxTicks(layout: number): number {
  return Math.max(3, Math.round((layout / WIDTH) * MAX_TICKS));
}
/** At most this many blocks from the first to the last, gaps included: a chart, not a data dump. */
export const MAX_SLOTS = 1000;

/**
 * How the spread is drawn under the line (REQ-001): a bar under every point, or a band along the
 * line when the points are too close together for their bars.
 */
export type Form = 'bars' | 'band';

/** Bars while each slot has room for its bar plus some air, a band beyond that (REQ-022). */
export function formFor(slots: number, barWidth: number, plotWidth = PLOT_WIDTH): Form {
  return plotWidth / slots >= Math.max(8, barWidth + 4) ? 'bars' : 'band';
}


/**
 * Base class of every chart with a time axis. The warehouse delivers one row per block (REQ-058);
 * this class owns everything the families share: the contract, turning blocks into slots, the
 * chart-language rules, the value axis (from zero or zoomed), the drawing and the hover labels. A
 * family decides how a block is named and how slots are labelled; the statistic decides which
 * fields a block carries. Nothing is written twice (REQ-025).
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
    return this.compares ? COMPARISON_PADDING : this.statistic.kind === 'ratio' ? RATIO_PADDING : PADDING;
  }

  /** The width of the plot in the size the request asks for (REQ-085). */
  protected plotWidth(request: Request): number {
    return sizeOf(request).layout - this.padding.left - this.padding.right;
  }

  // ----- What a family adds -----

  protected abstract readonly periodDescription: string;
  /** Which values the family writes on the chart by default (REQ-033). */
  protected abstract readonly defaultValues: ValuesMode;
  /** The field that names a block: `end` for a rolling window, `period` for a calendar period (REQ-062). */
  protected abstract readonly blockField: 'end' | 'period';
  /** Whether the last block may still be running: a calendar period may, a rolling window never. */
  protected abstract readonly mayRun: boolean;
  /** Contract properties of the family, such as window or unit, and the schema of a block name. */
  protected abstract periodSchema(): { properties: Record<string, object>; required: string[]; blockName: object };
  /** The day that identifies a block (its end day, or the first day of its period); undefined when the name is not valid. */
  protected abstract blockKey(name: string, request: Request): number | undefined;
  /** The same day for a slot. */
  protected abstract slotKey(slot: Slot): number;
  /** The input error for a block name that is not valid. */
  protected abstract invalidBlock(name: string, pointer: string, request: Request): IssueSpec;
  /** Checks on the names of the blocks together, such as windows that do not line up. */
  protected blockChecks(_keys: { key: number; pointer: string; name: string }[], _request: Request): IssueSpec[] {
    return [];
  }
  /** All slots from the first block to the last, gaps included, oldest first. */
  protected abstract slotsBetween(first: number, last: number, asOf: number, request: Request): Slot[];
  /** How many slots that is, without making them: checked before anything is computed. */
  protected abstract slotCount(first: number, last: number, request: Request): number;
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
  /** What one block is called in the reading cue, e.g. "week" or "venster van 7 dagen". */
  protected abstract blockSingular(request: Request, t: Translator): string;
  /** What the blocks are called in a message, plural, e.g. "weken" or "vensters". */
  protected abstract blockNoun(request: Request): IssueParam;
  /**
   * The blocks of the period just before the screen, as long as what the screen shows, each at the
   * position of the block it is compared with (REQ-037).
   */
  protected abstract previousSpan(slots: Slot[], request: Request): Slot[];
  /** The name of that period at the end of its line, e.g. "vorige 12 weken" or "vorig jaar". */
  protected abstract comparisonLabel(request: Request, t: Translator, blocks: number): string;

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

  /** The schema of one block: its name and the fields of the statistic, and the earlier block when comparing. */
  protected pointSchema(): object {
    const period = this.periodSchema();
    const centre = this.statistic.id;
    return {
      type: 'object',
      additionalProperties: false,
      required: [this.blockField, ...this.statistic.required],
      properties: {
        [this.blockField]: period.blockName,
        ...this.statistic.pointProperties(),
        ...(this.compares
          ? {
              previous: {
                description: `The ${centre} of the block just before the screen at this position (REQ-037); null when it has no data.`,
                type: ['object', 'null'],
                additionalProperties: false,
                required: [centre],
                properties: { [centre]: { type: ['number', 'null'], minimum: 0 } },
              },
            }
          : {}),
      },
    };
  }

  schema(): object {
    const period = this.periodSchema();
    return {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: `semgraph:${this.id}/request`,
      title: `${this.id} request`,
      description: `${this.periodDescription} ${this.statistic.description} The warehouse computes the blocks; the service checks them against the chart language and draws (REQ-058).`,
      type: 'object',
      additionalProperties: false,
      required: ['semgraph', 'metric', 'measureType', ...period.required, ...(this.statistic.kind === 'ratio' ? ['numeratorName', 'denominatorName'] : []), 'points'],
      properties: {
        semgraph: { const: this.id },
        metric: METRIC,
        title: TITLE,
        measureType: MEASURE_TYPE,
        uniqueAggregation: UNIQUE_AGGREGATION,
        ...period.properties,
        asOf: {
          description: 'The last complete day of the data. A calendar period that ends after it is still running. Yesterday in Brussels when absent.',
          ...DAY,
        },
        values: {
          description: 'Which values are written on the chart: off, last (the last value), lastAndPrevious (the last final value in bold, a running one next to it in grey) or all (only with few points; otherwise the default is used).',
          enum: [...VALUES_MODES],
          default: this.defaultValues,
        },
        // REQ-079: the axes of a ratio start at zero, so it has no valueAxis; it names what it counts.
        ...(this.statistic.kind === 'ratio'
          ? {
              numeratorName: { description: 'What the numerator counts, as the reading cue names it: "leads".', type: 'string', minLength: 1, maxLength: 40 },
              denominatorName: { description: 'What the denominator counts: "bezoekers".', type: 'string', minLength: 1, maxLength: 40 },
            }
          : {
              valueAxis: {
                description: 'zero: the value axis starts at zero. zoom: it may start at a round value just below the data, marked with a zigzag at the start of the baseline and a bold first value; allowed for positions such as averages and medians.',
                enum: ['zero', 'zoom'],
                default: 'zero',
              },
            }),
        size: SIZE,
        theme: THEME,
        format: FORMAT,
        locale: LOCALE,
        context: CONTEXT,
        meta: META_SCHEMA,
        points: {
          description: 'One row per block, computed in the warehouse (REQ-058). A block without data is null or left out; it is drawn as empty, never as zero.',
          type: 'array',
          minItems: 1,
          maxItems: 1000,
          items: this.pointSchema(),
        },
      },
    };
  }

  /** Valid and unique block names, only the fields of the statistic, and a spread on every block or on none. */
  check(request: Request): IssueSpec[] {
    const issues: IssueSpec[] = [];
    if (request.asOf !== undefined && parseDay(request.asOf) === undefined) {
      issues.push({ level: 'inputError', code: 'invalidDate', field: '/asOf', params: { value: request.asOf } });
    }
    // periodComparison accepts the fields of every statistic in its schema; only the chosen one belongs.
    issues.push(...this.statistic.checkFields(request.points));
    const keys: { key: number; pointer: string; name: string }[] = [];
    const seen = new Set<number>();
    request.points.forEach((row, index) => {
      const pointer = `/points/${index}`;
      const name = row[this.blockField];
      const other = this.blockField === 'end' ? 'period' : 'end';
      if (row[other] !== undefined) issues.push({ level: 'inputError', code: 'unexpectedField', field: `${pointer}/${other}` });
      if (row.previous && Object.keys(row.previous).some((field) => field !== this.statistic.id)) {
        issues.push({ level: 'inputError', code: 'fieldNotForStatistic', field: `${pointer}/previous`, params: { statistic: this.statistic.id } });
      }
      if (name === undefined) return;
      const key = this.blockKey(name, request);
      if (key === undefined) {
        issues.push(this.invalidBlock(name, `${pointer}/${this.blockField}`, request));
      } else if (seen.has(key)) {
        issues.push({ level: 'inputError', code: 'duplicateBlock', field: `${pointer}/${this.blockField}`, params: { block: name } });
      } else {
        seen.add(key);
        keys.push({ key, pointer: `${pointer}/${this.blockField}`, name });
      }
    });
    issues.push(...this.blockChecks(keys, request));
    if (keys.length > 0) {
      const count = this.slotCount(Math.min(...keys.map(({ key }) => key)), Math.max(...keys.map(({ key }) => key)), request);
      if (count > MAX_SLOTS) issues.push({ level: 'inputError', code: 'tooManyBlocks', field: '/points', params: { count, max: MAX_SLOTS } });
    }
    return issues;
  }

  // ----- From blocks to slots: no computing over days (REQ-058) -----

  compute(request: Request, { now }: { now: Date }): TimeAxisComputed {
    const yesterday = currentDay(now) - 1;
    const asOf = request.asOf === undefined ? yesterday : parseDay(request.asOf)!;
    const rows = new Map<number, BlockRow>();
    for (const row of request.points) rows.set(this.blockKey(row[this.blockField]!, request)!, row);
    const keys = [...rows.keys()].sort((a, b) => a - b);
    const slots = this.slotsBetween(keys[0]!, keys.at(-1)!, asOf, request);
    const reference = Math.min(asOf, slots.at(-1)!.fullLast);
    // A block that ends after the last complete day is not final; a calendar period may still run.
    const after = (slot: Slot) => slot.first > asOf || (!this.mayRun && slot.fullLast > asOf);
    const blocksAfterReference = slots.filter((slot) => after(slot) && rows.has(this.slotKey(slot))).map((slot) => rows.get(this.slotKey(slot))![this.blockField]!);

    const spreadApplies = this.statistic.hasSpread && this.spreadApplies(request);
    const points: SlotPoint[] = [];
    const missing: number[] = [];
    for (const slot of slots) {
      const row = rows.get(this.slotKey(slot));
      const summary = row && this.statistic.read(row);
      if (!summary) missing.push(slot.rel);
      else points.push({ ...slot, ...summary, spread: spreadApplies ? summary.spread : null, days: slot.last - slot.first + 1 });
    }
    const withSpread = points.some((point) => point.spread !== null);

    // REQ-005: the comparison line never has a band, so it only carries the centre.
    let comparison: TimeAxisComputed['comparison'] = null;
    if (this.compares) {
      const previousSlots = this.previousSpan(slots, request);
      const previousPoints = slots.flatMap((slot, index) => {
        const value = rows.get(this.slotKey(slot))?.previous?.[this.statistic.id];
        const previous = previousSlots[index]!;
        return typeof value === 'number' ? [{ ...previous, centre: value, spread: null, days: previous.last - previous.first + 1 }] : [];
      });
      comparison = { slots: previousSlots, points: previousPoints };
    }

    // Few observations (REQ-044), only where n counts observations (REQ-057, REQ-063). Running wins (REQ-054).
    const observations = this.statistic.countsObservations(request.measureType);
    const keyed = points.map((point) => ({ ...point, key: point.rel }));
    const few = observations ? this.statistic.fewObservations(keyed) : [];
    const fewKinds = this.statistic instanceof Ratio && observations ? [...new Set(this.statistic.fewReasons(keyed).values())].sort() : undefined;

    // "all" only while every value has room above its point; otherwise the family's default. A
    // comparison labels the ends of its lines instead (REQ-003).
    const asked = this.compares ? 'off' : (request.values ?? this.defaultValues);
    const valuesFallback = asked === 'all' && this.plotWidth(request) / slots.length < MIN_WIDTH_FOR_ALL;

    return {
      reference,
      referenceIsYesterday: reference === yesterday,
      blocksAfterReference,
      daysWithData: points.reduce((sum, point) => sum + point.days, 0),
      withSpread,
      spreadOmitted: spreadApplies && points.length > 0 && !withSpread,
      nMissing: this.statistic.wantsN(request.measureType) && points.some((point) => point.n === undefined),
      few,
      ...(fewKinds ? { fewKinds } : {}),
      values: valuesFallback ? this.defaultValues : asked,
      valuesFallback,
      slots,
      points,
      missing,
      comparison,
    };
  }

  // ----- The chart-language rules -----

  rules(request: Request, computed: TimeAxisComputed, { metadata }: { metadata: SemgraphMetadata }): IssueSpec[] {
    const issues: IssueSpec[] = [];

    issues.push(...measureRules(request, this.statistic, metadata));

    const { minimumPoints } = metadata.data;
    if (computed.blocksAfterReference.length > 0) {
      issues.push({
        level: 'refusal',
        code: 'blockAfterReference',
        field: '/points',
        params: { block: computed.blocksAfterReference[0]!, day: formatDay(computed.reference) },
      });
    } else if (computed.points.length === 0) {
      issues.push({ level: 'refusal', code: 'noData', field: '/points' });
    } else if (computed.daysWithData < minimumPoints) {
      issues.push({
        level: 'refusal',
        code: 'insufficientData',
        field: '/points',
        params: { count: computed.daysWithData, minimumPoints },
        learnMore: metadata.links.learning,
      });
    } else if (computed.comparison && computed.comparison.points.length === 0) {
      // Nothing to compare with: no block carries the value of the period before the screen.
      issues.push({ level: 'refusal', code: 'noComparisonData', field: '/points' });
    }

    issues.push(...this.periodRules(request));
    // REQ-074: a ratio per unit, whose numerator can exceed its denominator, waits on how it is shown (open point).
    if (this.statistic.kind === 'ratio' && computed.points.some((point) => point.parts && point.parts.numerator > point.parts.denominator)) {
      issues.push({ level: 'refusal', code: 'ratioPerUnitOpen', field: '/points' });
    }
    // REQ-032: allowed, but discouraged with a red alert between the title and the chart.
    if (computed.spreadOmitted) {
      issues.push({ level: 'deviation', code: this.statistic.withoutSpreadCode, field: '/points', learnMore: LEARNING_PLAN_LEVEL_1 });
    }
    // REQ-062: n is not required, but without it the reader cannot see which points rest on few observations.
    if (computed.nMissing) {
      issues.push({ level: 'deviation', code: `nMissing.${this.statistic.id}`, field: '/points' });
    }
    // REQ-047: a red block for the reader, but not a deviation: the version label stays.
    if (computed.few.length > 0) {
      // REQ-080: for a ratio the caution says which it is: statistically thin, an unusual base, or both.
      const kinds = computed.fewKinds ?? [];
      issues.push({
        level: 'caution',
        code: this.statistic.kind === 'ratio' ? `fewObservations.ratio.${kinds.length === 1 ? kinds[0] : 'both'}` : `fewObservations.${this.statistic.id}`,
        field: '/points',
        params: {
          count: computed.few.length,
          total: computed.points.length,
          blocks: this.blockNoun(request),
          ...(this.statistic.kind === 'ratio' ? { numerator: request.numeratorName ?? '', denominator: request.denominatorName ?? '' } : {}),
        },
      });
    }
    if (computed.valuesFallback) {
      issues.push({ level: 'info', code: 'valuesAllTooDense', field: '/values', params: { values: computed.values } });
    }
    return issues;
  }

  // ----- Drawing: everything is decided here; Vega-Lite only draws what it gets -----

  draw(request: Request, computed: TimeAxisComputed, { t, tokens }: DrawContext): Drawing {
    const { slots, points } = computed;
    const previous = computed.comparison?.points ?? [];
    const count = slots.length;
    const plotWidth = this.plotWidth(request);
    const ratio = this.statistic.kind === 'ratio';
    // REQ-046: the n of a point with few observations, under the time axis, right below the point. A
    // ratio writes its counts at the point instead, as in Figma (REQ-080).
    const fewSet = new Set(computed.few);
    const nLabels = ratio ? [] : points.filter((point) => fewSet.has(point.rel)).map((point) => ({ rel: point.rel, text: t('axis.n', { n: point.n! }) }));
    const padding = nLabels.length > 0 ? { ...this.padding, bottom: this.padding.bottom + N_LINE } : this.padding;
    const slotWidth = plotWidth / count;
    const barWidth = this.statistic.barWidth(tokens);
    // REQ-005: with a comparison, the spread of the focus series is always a light band.
    const form = this.compares ? 'band' : formFor(count, barWidth, plotWidth);
    const surface = color(tokens, 'surface');
    const focus = color(tokens, 'focus');
    const shown = labelsFor(points, computed.values, slotWidth);
    const labels = ratio ? alsoLabelled(shown, points.filter((point) => fewSet.has(point.rel))) : shown;

    // Value axis: from zero, or zoomed with a zigzag and a bold first value; high enough that every
    // value label fits above its point, and the comparison line fits too.
    const highest = Math.max(...points.map((point) => point.spread?.hi ?? point.centre), ...previous.map((point) => point.centre));
    const lowest = Math.min(...points.map((point) => Math.max(0, point.spread?.lo ?? point.centre)), ...previous.map((point) => point.centre));
    // REQ-079: the axes of a ratio start at zero.
    const mode = ratio ? 'zero' : (request.valueAxis ?? 'zero');
    let scale = valueScale(lowest, highest, mode);
    for (let attempt = 0; attempt < 4; attempt++) {
      const needed = headroom(labels, highest, (scale.max - scale.min) / PLOT_HEIGHT);
      if (needed <= scale.max) break;
      scale = valueScale(lowest, needed, mode);
    }
    const yLabels = this.statistic.tickLabels(t.locale, scale.ticks);
    // Whole numbers stay whole (daily counts); otherwise one decimal below 100; a share in percent.
    const whole = points.every((point) => [point.centre, point.spread?.lo ?? 0, point.spread?.hi ?? 0].every(Number.isInteger));
    const valueFormat = this.statistic.valueFormat(t.locale, highest, whole);
    const denominator = ratio ? denominatorAxis(points, scale, PLOT_HEIGHT) : undefined;
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
    const endComparison = this.compares && lastPrevious ? [{ rel: lastPrevious.rel, py: ends.comparison, text: this.comparisonLabel(request, t, computed.slots.length) }] : [];

    // REQ-049: the state of the data in a period is a pattern behind its whole column. Empty is a
    // checkerboard (REQ-051), never an outline over the chart; a running period gets fine vertical lines
    // and keeps its filled shape (REQ-052); few observations sparse dots, the shape filled too (REQ-053).
    // Only the current period: the comparison line never.
    const states = new Map<number, DataState>([
      ...points.filter((point) => point.running).map((point) => [point.rel, 'running'] as const),
      ...computed.few.map((rel) => [rel, 'few'] as const),
      ...computed.missing.map((rel) => [rel, 'empty'] as const),
    ]);
    const columns = stateColumns(states);
    const patternIds = Object.fromEntries(
      [...new Set(columns.map((column) => column.state))].map((state) => [state, patternId(JSON.stringify([request.metric, state, columns]), state)]),
    ) as Partial<Record<DataState, string>>;
    const defs = [
      ...Object.entries(patternIds).map(([state, id]) => statePattern(id!, state as DataState, tokens)),
      ...(hatchId ? [hatchPattern(hatchId, tokens)] : []),
    ].join('');

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
      ? ZIGZAG.map(([along, across], order) => ({
          rel: left + along * perPixel.x,
          value: scale.min + across * perPixel.y,
          order,
        }))
      : [];
    const mask = scale.zoomed ? [{ rel: left, rel2: left + ZIGZAG_MASK * perPixel.x, value: scale.min }] : [];
    // REQ-076: the denominator of a ratio behind the data, with its own axis on the right.
    const base = denominator
      ? baseLayers({ points, axis: denominator, labelled: new Set(labels.map((label) => label.point.rel)), scale, x, y, plotWidth, locale: t.locale, tokens })
      : undefined;

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
        columns,
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
        nLabels,
        ...values.datasets,
        ...(base?.datasets ?? {}),
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
                ...zoomedLabelWeight(scale),
              },
            },
          },
        },
        {
          // REQ-049: behind everything that is data, over the full height of the plot, above the baseline.
          data: { name: 'columns' },
          mark: { type: 'rect', opacity: 1 },
          encoding: {
            x: { ...x, field: 'from' },
            x2: { field: 'to' },
            y: { value: 0 },
            y2: { value: PLOT_HEIGHT - tokens.stroke.baseline },
            fill: {
              field: 'state',
              type: 'nominal',
              scale: { domain: Object.keys(patternIds), range: Object.values(patternIds).map((id) => `url(#${id})`) },
              legend: null,
            },
          },
        },
        ...axis.layers,
        ...(base?.layers ?? []),
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
          // The centre has the shape of its statistic (REQ-006, REQ-007, REQ-008), always filled: the
          // pattern behind the column tells whether its period still runs (REQ-052). A ratio is a square
          // in a square: the open square of the denominator, white inside, around the numerator (REQ-075).
          data: { name: 'points' },
          mark: ratio
            ? { type: 'point', shape: 'square', filled: true, size: RATIO_MARK ** 2, opacity: 1, fill: surface, stroke: focus, strokeWidth: 1.3 }
            : {
                type: 'point',
                shape: this.statistic.shape,
                filled: true,
                size: markerSize(tokens, this.statistic.kind),
                opacity: 1,
                fill: focus,
                stroke: surface,
                strokeWidth: 1,
              },
          encoding: { x, y: y('centre') },
        },
        ...(ratio
          ? [
              {
                data: { name: 'points' },
                mark: { type: 'point', shape: 'square', filled: true, size: (RATIO_MARK * RATIO_INNER) ** 2, opacity: 1, fill: focus, strokeWidth: 0 },
                encoding: { x, y: y('centre') },
              },
            ]
          : []),
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
          data: { name: 'nLabels' },
          // As in Figma: the axis style in the muted grey, a little lighter than the labels above it.
          mark: { type: 'text', align: 'center', baseline: 'top', fontSize: tokens.size.axisLabel, color: color(tokens, 'text/muted'), opacity: 0.7 },
          encoding: { x, y: { value: PLOT_HEIGHT + AXIS_HEIGHT + 1 }, text: { field: 'text' } },
        },
        {
          data: { name: 'endComparison' },
          mark: { type: 'text', align: 'left', baseline: 'middle', dx: 8, fontSize: tokens.size.detail, color: color(tokens, 'text/muted') },
          encoding: { x, y: { field: 'py', type: 'quantitative', scale: null }, text: { field: 'text' } },
        },
      ],
    } as TopLevelSpec;

    // A ratio: a guide from its denominator to the right axis, where the denominator is read (REQ-079).
    const parts = new Map(points.map((point) => [point.rel, point.parts]));
    const hover = this.hoverSpecs(request, computed, t, valueFormat).map((spec) => {
      const counts = parts.get(spec.x);
      return denominator && spec.point && counts ? { ...spec, point: { ...spec.point, right: denominator.toRatio(counts.denominator) } } : spec;
    });

    const title = request.title ?? request.metric;
    const cue = [
      this.periodCue(request, t),
      // REQ-076: a ratio names what it divides, as in Figma: "leads / bezoekers".
      ratio ? this.ratioOf(request, t) : '',
      computed.withSpread ? t(`cue.spread.${this.statistic.id}`) : '',
      this.compares ? t('cue.comparison', { label: this.comparisonLabel(request, t, computed.slots.length) }) : '',
    ]
      .filter(Boolean)
      .join(' · ');
    // Unique counts say how they were counted: per day, or over each block (in the warehouse).
    const unique = request.uniqueAggregation === 'overPeriod' ? t('cue.uniqueOverPeriod', { block: this.blockSingular(request, t) }) : t('cue.unique');
    const readingCue = request.measureType === 'unique' ? `${unique} · ${cue}` : cue;
    const last = points.find((point) => point.rel === 0);
    const description = [
      t('desc.base', { title, cue: readingCue, date: localizeDay(t, computed.reference, 'long') }),
      last ? t('desc.latest', { stats: this.statistic.formatStats(t, valueFormat, last) }) : t('desc.latestMissing'),
    ].join(' ');

    return {
      vegaLite: spec,
      width: sizeOf(request).layout,
      height: padding.top + PLOT_HEIGHT + padding.bottom,
      plotArea: { x: padding.left, y: padding.top, width: plotWidth, height: PLOT_HEIGHT },
      ...(defs ? { defs } : {}),
      hover,
      title,
      readingCue,
      description,
      asOf: computed.reference,
    };
  }

  /** What a ratio divides, as in Figma: "leads / bezoekers" (REQ-076). */
  private ratioOf(request: Request, t: Translator): string {
    return t('cue.ratioOf', { numerator: request.numeratorName ?? '', denominator: request.denominatorName ?? '' });
  }

  /** How the family names its blocks, for another drawing of the same blocks, such as the KPI tile (REQ-065). */
  names(request: Request, computed: TimeAxisComputed, t: Translator) {
    const context = { t, computed, isFirst: false };
    return {
      cue: this.periodCue(request, t),
      centre: this.centreLabel(request, t),
      block: this.blockSingular(request, t),
      slot: (slot: Slot) => this.slotLabel(slot, context, request),
      tick: (slot: Slot, isFirst: boolean) => this.tickLabel(slot, { ...context, isFirst }, request),
    };
  }

  /**
   * What each slot shows on hover, also a slot without data: its name (bold), the centre, the spread,
   * n (REQ-043) and the family's extras, e.g. "23 sep (−7d)", "gemiddelde 7d: 43,7", "±1 sd: 12,2",
   * "venster 17–23 sep"; or "geen data".
   */
  protected hoverSpecs(request: Request, computed: TimeAxisComputed, t: Translator, format: NumberFormatter): HoverSpec[] {
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
      if (!point) return { x: slot.rel, lines: [name, { text: t('chart.noData') }, ...comparison] };
      // A ratio names its counts: "leads / bezoekers: 27 / 640" (REQ-076).
      const spreadLine = this.statistic.spreadLine(t, format, point);
      const spread = spreadLine && this.statistic.kind === 'ratio' ? `${this.ratioOf(request, t)}: ${spreadLine}` : spreadLine;
      return {
        x: slot.rel,
        point: { y: point.centre, lo: point.spread?.lo ?? null, hi: point.spread?.hi ?? null },
        lines: [
          name,
          { text: `${this.centreLabel(request, t)}: ${format.format(point.centre)}` },
          ...(spread ? [{ text: spread }] : []),
          ...(point.n === undefined ? [] : [{ text: t('hover.n', { n: numberFormat(t.locale, 0).format(point.n) }) }]),
          ...this.slotExtras(slot, context, request).map((text) => ({ text })),
          ...comparison,
        ],
      };
    });
  }
}

/** Numbers each run of consecutive slots, so a line or band never bridges a gap. */
export function withSegments<Point extends { rel: number }>(points: readonly Point[]) {
  let segment = 0;
  const segmentOf = points.map((point, index) => {
    if (index > 0 && point.rel !== points[index - 1]!.rel + 1) segment++;
    return segment;
  });
  const lengths = new Map<number, number>();
  for (const id of segmentOf) lengths.set(id, (lengths.get(id) ?? 0) + 1);
  return points.map((point, index) => ({ ...point, segment: segmentOf[index]!, segmentLength: lengths.get(segmentOf[index]!)! }));
}

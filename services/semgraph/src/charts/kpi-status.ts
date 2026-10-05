import type { TopLevelSpec } from 'vega-lite';
import { currentDay, formatDay, localizeDay, parseDay } from '../core/days.ts';
import type { IssueSpec } from '../core/issues.ts';
import { META_SCHEMA, type ChartMeta } from '../core/meta.ts';
import type { HoverLine, HoverSpec } from '../core/render/hover.ts';
import { textWidth } from '../core/render/text.ts';
import type { DrawContext, Drawing, RequestContext, SemgraphImplementation, SemgraphMetadata } from '../core/semgraph.ts';
import { color, vegaLiteConfig } from '../core/tokens.ts';
import { periodFromName, periodName, shiftPeriod, type CalendarUnit } from './calendar.ts';
import { calendarTickStep, periodLabel, periodTick, startsYear } from './calendar-chart.ts';
import { hatchPattern, patternId, toWinPattern } from './comparison.ts';
import { sizeOf } from '../core/size.ts';
import { CONTEXT, DAY, FORMAT, LOCALE, MEASURE_TYPE, METRIC, SIZE, TITLE, UNIQUE_AGGREGATION } from './contract.ts';
import { measureRules, type MeasureRequest } from './measure.ts';
import { CompactFormat } from './number-format.ts';
import { lookup, valueScale, ZIGZAG, ZIGZAG_MASK, zoomedLabelWeight, zoomLayers } from './scales.ts';
import { Sum } from './statistics.ts';
import { PADDING, PLOT_HEIGHT } from './time-axis-chart.ts';
import { timeAxis } from './time-axis.ts';

/** One period as the warehouse delivers it: the cumulative levels at its end (REQ-069). */
export interface KpiStatusRow {
  period: string;
  /** What was really reached since the start, at the end of the period; only for periods that are over. */
  actual?: number | null;
  /** The level the path planned for the end of the period, from the period in which it was set. */
  path?: number | null;
}

export interface KpiStatusRequest extends MeasureRequest {
  semgraph: string;
  metric: string;
  title?: string;
  unit: 'week' | 'month' | 'quarter';
  /** Where the KPI counts from: its first day and the level on it. */
  start: { day: string; value: number };
  /** The level to reach, and by when. */
  target: { day: string; value: number };
  /** The day the path was set; it never moves after that. */
  pathSet: string;
  asOf?: string;
  /** card, default, large or xl (REQ-085). */
  size?: string;
  format?: string;
  locale?: string;
  context?: RequestContext;
  meta?: ChartMeta;
  points: KpiStatusRow[];
}

export interface KpiPeriod {
  index: number;
  first: number;
  last: number;
  actual: number | null;
  path: number | null;
}

export interface KpiStatusComputed {
  reference: number;
  referenceIsYesterday: boolean;
  /** Every period from the one with the start to the one with the target. */
  periods: KpiPeriod[];
  /** The last period with a real level, -1 before the first one is over. */
  last: number;
  /** The period in which the path was set. */
  plan: number;
  /** Periods with a real level that are not over yet: not final. */
  afterReference: string[];
  /** A period without a real level before the last one that has one. */
  gap: boolean;
  /** The periods from the plan to the target that have no planned level. */
  pathMissing: string[];
}

const UNITS = ['week', 'month', 'quarter'] as const;
const SUM = new Sum();
const MAX_PERIODS = 120;
/** The target and its label stand above the top of the axis. */
const KPI_PADDING = { ...PADDING, top: 30 };
const RISER = 4;
const TARGET_RING = 13;
const BOX = { x: 6, y: 2, padding: 10, height: 46 };
const SMALL = 10;
/** Bold text runs wider than the estimate of regular text. */
const BOLD = 1.08;

/**
 * Where a KPI stands against its target (REQ-065, after Figma's Chart/KPI status): the real level as
 * a magenta staircase, the path to the target as a teal dotted staircase that was set at planning and
 * never moves, what is lost against the path so far hatched (REQ-004, REQ-055), and what is still to
 * be won in touching dots (REQ-068). The first future step includes the catch-up; after that the path
 * goes on as planned. The box top left says what is still needed, and how.
 *
 * The warehouse delivers the levels, real and planned (REQ-069); the chart only takes differences:
 * what each period added, the shortfall, the catch-up and the pace.
 */
export class KpiStatusChart implements SemgraphImplementation<KpiStatusRequest, KpiStatusComputed> {
  readonly id: string;
  /** A level since the start is a total: the rules of an amount hold (REQ-064). */
  readonly statistic = SUM;

  constructor(id: string) {
    this.id = id;
  }

  schema(): object {
    const level = { type: ['number', 'null'], minimum: 0 };
    const moment = (what: string) => ({
      type: 'object',
      additionalProperties: false,
      required: ['day', 'value'],
      properties: { day: { description: `The day of the ${what}.`, ...DAY }, value: { description: `The level at the ${what}.`, type: 'number', minimum: 0 } },
    });
    return {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: `semgraph:${this.id}/request`,
      title: `${this.id} request`,
      description:
        'Where a cumulative KPI stands against its target: the real level per period, and the path to the target that was set at planning and never moves. The warehouse delivers both as levels at the end of each period (REQ-069); the chart takes the differences: what each period added, the shortfall against the path, the catch-up in the next period and the pace after it.',
      type: 'object',
      additionalProperties: false,
      required: ['semgraph', 'metric', 'measureType', 'unit', 'start', 'target', 'pathSet', 'points'],
      properties: {
        semgraph: { const: this.id },
        metric: METRIC,
        title: TITLE,
        measureType: MEASURE_TYPE,
        uniqueAggregation: UNIQUE_AGGREGATION,
        unit: { description: 'The periods of the path: week (ISO), month or quarter.', enum: [...UNITS] },
        start: { description: 'Where the KPI counts from: its first day and the level on it.', ...moment('start') },
        target: { description: 'The level to reach, and the last day to reach it.', ...moment('target') },
        pathSet: { description: 'The day the path was set. It never moves afterwards: a path that is redrawn every month can never be missed.', ...DAY },
        asOf: { description: 'The last complete day of the data. Yesterday in Brussels when absent.', ...DAY },
        size: SIZE,
        format: FORMAT,
        locale: LOCALE,
        context: CONTEXT,
        meta: META_SCHEMA,
        points: {
          description: 'One row per period, from the period with the start to the one with the target, computed in the warehouse (REQ-069).',
          type: 'array',
          minItems: 1,
          maxItems: MAX_PERIODS,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['period'],
            properties: {
              period: { description: 'The ISO name of the period: 2026-W40, 2026-09 or 2026-Q3.', type: 'string', pattern: '^[0-9]{4}(-W[0-9]{2}|-[0-9]{2}|-Q[1-4])$' },
              actual: { description: 'The real level since the start at the end of the period; only for periods that are over. Leave out or null for the future.', ...level },
              path: { description: 'The planned level at the end of the period, from the period in which the path was set up to the target.', ...level },
            },
          },
        },
      },
    };
  }

  check(request: KpiStatusRequest): IssueSpec[] {
    const issues: IssueSpec[] = [];
    const days: Record<string, number | undefined> = {};
    for (const [field, value] of [['start/day', request.start.day], ['target/day', request.target.day], ['pathSet', request.pathSet], ['asOf', request.asOf]] as const) {
      if (value === undefined) continue;
      days[field] = parseDay(value);
      if (days[field] === undefined) issues.push({ level: 'inputError', code: 'invalidDate', field: `/${field}`, params: { value } });
    }
    const [start, target, pathSet] = [days['start/day'], days['target/day'], days.pathSet];
    if (start !== undefined && target !== undefined && target <= start) issues.push({ level: 'inputError', code: 'targetBeforeStart', field: '/target/day' });
    const planInside = pathSet !== undefined && start !== undefined && target !== undefined && pathSet >= start && pathSet <= target;
    if (pathSet !== undefined && start !== undefined && target !== undefined && !planInside) {
      issues.push({ level: 'inputError', code: 'pathSetOutsideKpi', field: '/pathSet' });
    }
    const first = start === undefined ? undefined : periodStart(start, request.unit);
    const end = target === undefined ? undefined : periodStart(target, request.unit);
    const seen = new Set<number>();
    const rows: { key: number; row: KpiStatusRow; index: number }[] = [];
    request.points.forEach((row, index) => {
      const field = `/points/${index}/period`;
      const key = periodFromName(row.period, request.unit);
      if (key === undefined) issues.push({ level: 'inputError', code: 'invalidPeriod', field, params: { value: row.period, unit: { t: `calendar.unit.${request.unit}` } } });
      else if (seen.has(key)) issues.push({ level: 'inputError', code: 'duplicateBlock', field, params: { block: row.period } });
      else if ((first !== undefined && key < first) || (end !== undefined && key > end)) issues.push({ level: 'inputError', code: 'periodOutsideKpi', field, params: { block: row.period } });
      else {
        seen.add(key);
        rows.push({ key, row, index });
      }
    });
    if (first !== undefined && end !== undefined && periodCount(first, end, request.unit) > MAX_PERIODS) {
      issues.push({ level: 'inputError', code: 'tooManyBlocks', field: '/points', params: { count: periodCount(first, end, request.unit), max: MAX_PERIODS } });
    }
    // A cumulative level never goes down; the real one starts at the start value.
    rows.sort((a, b) => a.key - b.key);
    for (const field of ['actual', 'path'] as const) {
      let previous = field === 'actual' ? request.start.value : -Infinity;
      for (const { row, index } of rows) {
        const value = row[field];
        if (typeof value !== 'number') continue;
        if (value < previous) issues.push({ level: 'inputError', code: 'cumulativeDecreases', field: `/points/${index}/${field}`, params: { block: row.period } });
        previous = value;
      }
    }
    if (planInside) {
      const plan = periodStart(pathSet!, request.unit);
      for (const { key, row, index } of rows) {
        if (key < plan && typeof row.path === 'number') issues.push({ level: 'inputError', code: 'pathBeforeSet', field: `/points/${index}/path`, params: { block: row.period, date: request.pathSet } });
      }
    }
    return issues;
  }

  compute(request: KpiStatusRequest, { now }: { now: Date }): KpiStatusComputed {
    const yesterday = currentDay(now) - 1;
    const reference = request.asOf === undefined ? yesterday : parseDay(request.asOf)!;
    const { unit } = request;
    const first = periodStart(parseDay(request.start.day)!, unit);
    const end = periodStart(parseDay(request.target.day)!, unit);
    const rows = new Map(request.points.map((row) => [periodFromName(row.period, unit)!, row]));
    const periods: KpiPeriod[] = [];
    for (let key = first, index = 0; key <= end; key = shiftPeriod(key, unit, 1), index++) {
      const row = rows.get(key);
      periods.push({ index, first: key, last: shiftPeriod(key, unit, 1) - 1, actual: typeof row?.actual === 'number' ? row.actual : null, path: typeof row?.path === 'number' ? row.path : null });
    }
    const last = periods.reduce((found, period) => (period.actual === null ? found : period.index), -1);
    const plan = Math.max(0, periods.findIndex((period) => period.last >= parseDay(request.pathSet)!));
    return {
      reference,
      referenceIsYesterday: reference === yesterday,
      periods,
      last,
      plan,
      afterReference: periods.filter((period) => period.actual !== null && period.last > reference).map((period) => periodName(period.first, unit)),
      gap: periods.slice(0, last + 1).some((period) => period.actual === null),
      pathMissing: periods.slice(plan).filter((period) => period.path === null).map((period) => periodName(period.first, unit)),
    };
  }

  rules(request: KpiStatusRequest, computed: KpiStatusComputed, { metadata }: { metadata: SemgraphMetadata }): IssueSpec[] {
    const issues = measureRules(request, this.statistic, metadata);
    if (computed.afterReference.length > 0) {
      issues.push({ level: 'refusal', code: 'blockAfterReference', field: '/points', params: { block: computed.afterReference[0]!, day: formatDay(computed.reference) } });
    } else if (computed.last < 0) {
      issues.push({ level: 'refusal', code: 'noData', field: '/points' });
    } else if (computed.gap) {
      // A cumulative level cannot skip a period: what happened in it is unknown, so is every level after it.
      issues.push({ level: 'refusal', code: 'cumulativeGap', field: '/points' });
    }
    // Pacing only works against a path, from the moment it was set up to the target.
    if (computed.pathMissing.length > 0) issues.push({ level: 'refusal', code: 'pathIncomplete', field: '/points', params: { block: computed.pathMissing[0]!, date: request.pathSet } });
    return issues;
  }

  draw(request: KpiStatusRequest, computed: KpiStatusComputed, { t, tokens }: DrawContext): Drawing {
    const { periods, last, plan } = computed;
    const unit = request.unit as CalendarUnit;
    const count = periods.length;
    const end = count - 1;
    // Positions: rel 0 is the period with the target, as on every time axis.
    const rel = (index: number) => index - end;
    const actual = (index: number) => (index < 0 ? request.start.value : periods[index]!.actual!);
    const path = (index: number) => periods[index]!.path!;
    const now = actual(last);
    const padding = KPI_PADDING;
    const width = sizeOf(request).layout;
    const plotWidth = width - padding.left - padding.right;
    const slotWidth = plotWidth / count;

    // The axis starts at the KPI start, with a zigzag when that is not zero (Figma, KPI status; REQ-026).
    const levels = [request.start.value, request.target.value, ...periods.flatMap((period) => [period.actual, period.path]).filter((value): value is number => value !== null)];
    const scale = valueScale(request.start.value, Math.max(...levels), 'zoom');
    const perPixel = { x: count / plotWidth, y: (scale.max - scale.min) / PLOT_HEIGHT };
    const x = { field: 'rel', type: 'quantitative' as const, scale: { domain: [-(count - 1) - 0.5, 0.5], nice: false, zero: false } };
    const y = { field: 'value', type: 'quantitative' as const, scale: { domain: [scale.min, scale.max], nice: false, zero: false } };
    const axisFormat = new CompactFormat(t.locale, scale.max);
    // Every step in the same precision, enough for the smallest one: "2,4k", "115,6k", "+14,4k".
    const steps = periods.slice(0, last + 1).map((period) => period.actual! - actual(period.index - 1)).filter((step) => step > 0);
    const smallest = Math.min(...steps, Math.abs(request.target.value - now) || Infinity);
    const precise = new CompactFormat(t.locale, scale.max, {}, axisFormat.divisor > 1 && smallest / axisFormat.divisor < 10 ? 1 : 0);
    const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${precise.value(Math.abs(value))}`;

    // The real level: a magenta staircase, a riser for what each period added and a tread through the
    // period, on a light area that is what has been done.
    const today = last + 0.5;
    const done = [{ rel: rel(-0.5), value: request.start.value }];
    const treads: { rel: number; rel2: number; value: number }[] = [];
    const risers: { rel: number; value: number; value2: number }[] = [];
    const added: { rel: number; value: number; text: string }[] = [];
    for (let index = 0; index <= last; index++) {
      const [before, after] = [actual(index - 1), actual(index)];
      done.push({ rel: rel(index), value: after });
      treads.push({ rel: rel(index), rel2: rel(Math.min(index + 1, today)), value: after });
      risers.push({ rel: rel(index), value: before, value2: after });
      // Next to the middle of its riser, as in Figma.
      added.push({ rel: rel(index), value: (before + after) / 2, text: precise.value(after - before) });
    }
    done.push({ rel: rel(today), value: now });

    // The path: from the level at planning, step by step to the target. Up to today it shows what was
    // planned; from today it starts at the real level, so its first step includes the catch-up.
    const pastPath: { rel: number; value: number; order: number }[] = [];
    const lost: { rel: number; rel2: number; value: number; value2: number }[] = [];
    const deltas: { rel: number; value: number; text: string }[] = [];
    if (last > plan) {
      pastPath.push({ rel: rel(plan + 0.5), value: path(plan), order: 0 });
      for (let index = plan + 1; index <= last; index++) {
        pastPath.push({ rel: rel(index), value: path(index - 1), order: pastPath.length }, { rel: rel(index), value: path(index), order: pastPath.length + 1 });
        // REQ-004: only a shortfall is hatched; the label is the step against the planned step.
        if (path(index) > actual(index)) lost.push({ rel: rel(index), rel2: rel(Math.min(index + 1, today)), value: actual(index), value2: path(index) });
        // Above both lines of the period before, so it never sits on the real staircase.
        deltas.push({ rel: rel(index), value: Math.max(path(index), actual(index - 1)), text: precise.signed(actual(index) - actual(index - 1) - (path(index) - path(index - 1))) });
      }
      pastPath.push({ rel: rel(today), value: path(last), order: pastPath.length });
    }
    const futurePath: { rel: number; value: number; order: number }[] = [];
    const toWin: { rel: number; rel2: number; value: number; value2: number }[] = [];
    if (last < end) {
      let level = now;
      futurePath.push({ rel: rel(today), value: level, order: 0 });
      for (let index = last + 1; index <= end; index++) {
        const planned = periods[index]!.path ?? level;
        futurePath.push({ rel: rel(index), value: level, order: futurePath.length }, { rel: rel(index), value: planned, order: futurePath.length + 1 });
        if (planned > now) toWin.push({ rel: rel(index), rel2: rel(Math.min(index + 1, end + 0.5)), value: now, value2: planned });
        level = planned;
      }
      futurePath.push({ rel: rel(end + 0.5), value: level, order: futurePath.length });
    }

    // What is still needed, and how: the catch-up in the next period, then the pace of the path.
    const needed = request.target.value - now;
    const catchUp = last < end ? path(last + 1) - now : null;
    const pace = periods.slice(last + 2).map((period) => period.path! - path(period.index - 1));
    const linear = pace.length > 0 && pace.every((step) => precise.value(step) === precise.value(pace[0]!));
    const paceText = (step: number) => t('chart.kpiStatus.pace', { value: precise.value(step), unit: t(`chart.kpiStatus.per.${unit}`) });
    const futureLabels = [
      ...(catchUp === null ? [] : [{ rel: rel(last + 1), value: path(last + 1), text: precise.value(catchUp), note: last >= plan && catchUp > path(last + 1) - path(last) + 1e-9 ? t('chart.kpiStatus.catchUp') : '' }]),
    ];
    const paceLabels = linear
      ? [{ rel: rel(last + 2), value: path(last + 2), text: paceText(pace[0]!) }]
      : pace.map((step, offset) => ({ rel: rel(last + 2 + offset), value: path(last + 2 + offset), text: precise.value(step) }));
    const nextName = last < end ? periodTick(t, unit, periods[last + 1]!.first, false)[0]! : '';
    const boxTitle = needed > 0 ? `Δ ${signed(needed)}` : t('chart.kpiStatus.reached');
    const boxDetail =
      needed <= 0 ? t('chart.kpiStatus.above', { value: precise.value(-needed) })
      : catchUp === null ? t('chart.kpiStatus.missed')
      : pace.length === 0 ? t('chart.kpiStatus.lastStep', { catchUp: precise.value(catchUp), period: nextName })
      : linear ? t('chart.kpiStatus.plan', { catchUp: precise.value(catchUp), period: nextName, pace: paceText(pace[0]!) })
      : t('chart.kpiStatus.planWeighted', { catchUp: precise.value(catchUp), period: nextName });
    const boxWidth = Math.max(textWidth(boxTitle, tokens.size.delta) * BOLD, textWidth(boxDetail, SMALL)) + 2 * BOX.padding;

    const targetDay = parseDay(request.target.day)!;
    const targetLabel = t('chart.kpiStatus.target', { value: axisFormat.value(request.target.value), date: localizeDay(t, targetDay, 'numeric') });
    const pathSetLabel = t('chart.kpiStatus.pathSet', { date: localizeDay(t, parseDay(request.pathSet)!, 'numeric') });

    const axis = timeAxis({
      count,
      slotWidth,
      // A label for every period while they fit, otherwise every so many, as on a calendar axis (REQ-085).
      labels: periods
        .filter((period) => period.index % calendarTickStep(unit, slotWidth) === 0)
        .map((period) => ({ rel: rel(period.index), lines: periodTick(t, unit, period.first, period.index === 0) })),
      yearStarts: periods.filter((period) => startsYear(unit, period.first)).map((period) => rel(period.index)),
      x,
      plotHeight: PLOT_HEIGHT,
      tokens,
    });
    const left = -(count - 1) - 0.5;
    const zigzag = scale.zoomed ? ZIGZAG.map(([along, across], order) => ({ rel: left + along * perPixel.x, value: scale.min + across * perPixel.y, order })) : [];
    const mask = scale.zoomed ? [{ rel: left, rel2: left + ZIGZAG_MASK * perPixel.x, value: scale.min }] : [];
    const hatchId = lost.length > 0 ? patternId(JSON.stringify([request.metric, 'lost', lost])) : undefined;
    const toWinId = toWin.length > 0 ? patternId(JSON.stringify([request.metric, 'toWin', toWin]), 'towin') : undefined;
    const defs = [...(hatchId ? [hatchPattern(hatchId, tokens)] : []), ...(toWinId ? [toWinPattern(toWinId, tokens)] : [])].join('');
    const target = color(tokens, 'target');
    const targetDark = color(tokens, 'target/dark');
    const dotted = { type: 'line', color: target, strokeWidth: 1.5, strokeDash: [2, 2], strokeCap: 'butt' };
    const band = (fill: string) => ({ type: 'rect', fill, opacity: 1 });
    const text = (style: Record<string, unknown>) => ({ type: 'text', fontSize: SMALL, color: color(tokens, 'text'), ...style });
    const fits = (labels: readonly { text: string }[]) => labels.every((label) => textWidth(label.text, SMALL) * BOLD + 6 <= slotWidth);

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
        mask,
        zigzag,
        done,
        lost,
        toWin,
        pastPath,
        futurePath,
        treads,
        risers,
        // What each period added and its step against the plan stand next to the steps while they fit;
        // on a narrow chart they are only on hover (REQ-085).
        added: fits(added) ? added : [],
        deltas: fits(deltas) ? deltas : [],
        futureLabels,
        paceLabels,
        current: [{ rel: rel(today), value: now, text: precise.value(now) }],
        pathSet: pastPath.length > 0 || futurePath.length > 0 ? [{ rel: rel(Math.min(plan, Math.max(last, plan)) + 0.5), value: plan <= last ? path(plan) : now, text: pathSetLabel }] : [],
        target: [{ rel: rel(end + 0.5), value: request.target.value, text: targetLabel }],
        box: [{ rel: 0 }],
      },
      layer: [
        {
          // The baseline is the domain of the time axis; the value axis on the left, its first value bold.
          data: { name: 'frame' },
          mark: { type: 'point', opacity: 0 },
          encoding: {
            x: { ...x, axis: { values: [], ticks: false, labels: false, title: null } },
            y: { ...y, axis: { values: scale.ticks, labelExpr: lookup(axisFormat.ticks(scale.ticks)), title: null, ...zoomedLabelWeight(scale) } },
          },
        },
        ...axis.layers,
        {
          // What has been done: the area under the real staircase.
          data: { name: 'done' },
          mark: { type: 'area', interpolate: 'step-after', color: color(tokens, 'focus/subtle'), opacity: 1 },
          encoding: { x, y, y2: { datum: scale.min } },
        },
        {
          // REQ-004, REQ-055: dense hatching is what is lost against the path so far.
          data: { name: 'lost' },
          mark: band(hatchId ? `url(#${hatchId})` : color(tokens, 'surface')),
          encoding: { x, x2: { field: 'rel2' }, y, y2: { field: 'value2' } },
        },
        {
          // REQ-068: touching dots are what is still to be won.
          data: { name: 'toWin' },
          mark: band(toWinId ? `url(#${toWinId})` : color(tokens, 'surface')),
          encoding: { x, x2: { field: 'rel2' }, y, y2: { field: 'value2' } },
        },
        ...zoomLayers(tokens, x, y, { x, x2: { field: 'rel2' }, y }),
        {
          // The path to the target, a teal dotted staircase, set at planning and never moved.
          data: { name: 'pastPath' },
          mark: dotted,
          encoding: { x, y, order: { field: 'order' } },
        },
        {
          data: { name: 'futurePath' },
          mark: dotted,
          encoding: { x, y, order: { field: 'order' } },
        },
        {
          data: { name: 'treads' },
          mark: { type: 'rule', color: color(tokens, 'focus'), strokeWidth: tokens.stroke.line },
          encoding: { x, x2: { field: 'rel2' }, y },
        },
        {
          data: { name: 'risers' },
          mark: { type: 'rule', color: color(tokens, 'focus'), strokeWidth: RISER },
          encoding: { x, y, y2: { field: 'value2' } },
        },
        {
          // What each period added, next to its step.
          data: { name: 'added' },
          mark: text({ align: 'left', baseline: 'middle', dx: RISER / 2 + 3 }),
          encoding: { x, y, text: { field: 'text' } },
        },
        {
          // The step against the planned step, left of each planned step.
          data: { name: 'deltas' },
          mark: text({ align: 'right', baseline: 'bottom', dx: -5, dy: -2, fontWeight: 'bold' }),
          encoding: { x, y, text: { field: 'text' } },
        },
        {
          data: { name: 'futureLabels' },
          mark: text({ align: 'left', baseline: 'top', dx: 5, dy: 6, fontWeight: 'bold', color: targetDark }),
          encoding: { x, y, text: { field: 'text' } },
        },
        {
          data: { name: 'futureLabels' },
          mark: text({ align: 'left', baseline: 'top', dx: 5, dy: 6 + SMALL + 1, color: targetDark }),
          encoding: { x, y, text: { field: 'note' } },
        },
        {
          data: { name: 'paceLabels' },
          mark: text({ align: 'right', baseline: 'top', dx: -5, dy: 1, color: targetDark }),
          encoding: { x, y, text: { field: 'text' } },
        },
        {
          // The end value bold, at the end of the real staircase.
          data: { name: 'current' },
          mark: text({ align: 'left', baseline: 'top', dx: 4, dy: 7, fontWeight: 'bold' }),
          encoding: { x, y, text: { field: 'text' } },
        },
        {
          data: { name: 'pathSet' },
          mark: text({ align: 'left', baseline: 'top', dx: 2, dy: 8, color: targetDark }),
          encoding: { x, y, text: { field: 'text' } },
        },
        {
          // The target mark, with "target · date".
          data: { name: 'target' },
          mark: { type: 'point', shape: 'circle', filled: false, size: TARGET_RING ** 2, stroke: target, strokeWidth: 1.5, opacity: 1 },
          encoding: { x, y },
        },
        {
          data: { name: 'target' },
          mark: { type: 'point', shape: 'circle', filled: true, size: 16, fill: target, opacity: 1 },
          encoding: { x, y },
        },
        {
          data: { name: 'target' },
          mark: text({ align: 'right', baseline: 'bottom', dx: -TARGET_RING / 2 - 2, dy: -TARGET_RING / 2, fontWeight: 'bold', color: targetDark }),
          encoding: { x, y, text: { field: 'text' } },
        },
        {
          // Top left, which the rising staircase always leaves free: what is still needed, and how.
          data: { name: 'box' },
          mark: { type: 'rect', fill: color(tokens, 'target/light'), cornerRadius: 4, opacity: 1 },
          encoding: { x: { value: BOX.x }, x2: { value: BOX.x + boxWidth }, y: { value: BOX.y }, y2: { value: BOX.y + BOX.height } },
        },
        {
          data: { name: 'box' },
          mark: text({ align: 'left', baseline: 'alphabetic', fontSize: tokens.size.delta, fontWeight: 'bold', color: targetDark }),
          encoding: { x: { value: BOX.x + BOX.padding }, y: { value: BOX.y + 6 + tokens.size.delta }, text: { value: boxTitle } },
        },
        {
          data: { name: 'box' },
          mark: text({ align: 'left', baseline: 'alphabetic', color: targetDark }),
          encoding: { x: { value: BOX.x + BOX.padding }, y: { value: BOX.y + BOX.height - 9 }, text: { value: boxDetail } },
        },
      ],
    } as TopLevelSpec;

    // Hover per period: the real level and what it added, the planned level and the step against it.
    const hover: HoverSpec[] = periods.map((period) => {
      const lines: HoverLine[] = [{ text: periodLabel(t, unit, period.first, period.last), bold: true }];
      const index = period.index;
      if (period.actual !== null) {
        lines.push({ text: t('hover.kpiStatus.level', { value: precise.value(period.actual) }) }, { text: t('hover.kpiStatus.added', { value: signed(period.actual - actual(index - 1)) }) });
      }
      if (period.path !== null) lines.push({ text: t('hover.kpiStatus.path', { value: precise.value(period.path) }) });
      if (period.actual !== null && period.path !== null && index > plan) {
        lines.push({ text: t('hover.kpiStatus.difference', { value: signed(period.actual - actual(index - 1) - (period.path - path(index - 1))) }) });
      }
      if (period.actual === null && period.path !== null && index > last) {
        lines.push({ text: t('hover.kpiStatus.planned', { value: signed(index === last + 1 ? period.path - now : period.path - path(index - 1)) }) });
      }
      return {
        x: rel(index),
        ...(period.actual === null ? {} : { point: { y: period.actual, lo: null, hi: period.path } }),
        lines,
      };
    });

    const title = request.title ?? request.metric;
    const cue = t('cue.kpiStatus', {
      start: axisFormat.value(request.start.value),
      date: localizeDay(t, parseDay(request.start.day)!, 'short'),
      target: axisFormat.value(request.target.value),
    });
    const readingCue = request.measureType === 'unique' ? `${t('cue.uniqueOverPeriod', { block: t('blocks.sinceStart') })} · ${cue}` : cue;
    const description = [
      t('desc.base', { title, cue: readingCue, date: localizeDay(t, computed.reference, 'long') }),
      t('desc.kpiStatus', { current: precise.value(now), target: axisFormat.value(request.target.value), date: localizeDay(t, targetDay, 'long'), needed: precise.value(Math.max(0, needed)) }),
    ].join(' ');

    return {
      vegaLite: spec,
      width,
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
}

/** The first day of the period that contains a day. */
function periodStart(day: number, unit: CalendarUnit): number {
  return periodFromName(periodName(day, unit), unit)!;
}

function periodCount(first: number, end: number, unit: CalendarUnit): number {
  let count = 0;
  for (let key = first; key <= end && count <= MAX_PERIODS; key = shiftPeriod(key, unit, 1)) count++;
  return count;
}

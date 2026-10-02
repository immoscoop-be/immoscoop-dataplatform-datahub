import type { TopLevelSpec } from 'vega-lite';
import { localizeDay, localizeRange } from '../../src/core/days.ts';
import type { DrawContext, Drawing, HoverTarget } from '../../src/core/semgraph.ts';
import { color, vegaLiteConfig } from '../../src/core/tokens.ts';
import type { MovingWindowAverageComputed, MovingWindowAverageRequest, WindowPoint } from './types.ts';

const WIDTH = 640;
const PLOT_HEIGHT = 200;
/** Fixed geometry (autosize none): room for the y labels left and the last day's label right. */
const PADDING = { left: 52, right: 64, top: 14, bottom: 30 };
/** A "no data" label is only written in a missing stretch at least this wide. */
const MIN_LABEL_WIDTH = 44;
/** Below this many pixels per day, dots and bars overlap: the mean becomes a line, the spread a band. */
const MIN_DOT_SLOT = 8;
/** At most this many labels on the time axis. */
const MAX_TICKS = 8;

/** Whether the days are drawn one by one (a dot over a bar), or as a line with a band. */
export type Form = 'dots' | 'line';

export function formFor(horizon: number): Form {
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  return plotWidth / horizon >= MIN_DOT_SLOT ? 'dots' : 'line';
}

/**
 * Builds what Vega-Lite draws. All decisions are made here: the form, the axis ticks and labels,
 * which value is labelled, the hover labels, how the spread is drawn. Vega-Lite only draws what it gets.
 */
export function draw(
  request: MovingWindowAverageRequest,
  computed: MovingWindowAverageComputed,
  { t, tokens }: DrawContext,
): Drawing {
  const { horizon, window, points, spread, reference } = computed;
  const key = 'semgraphs.movingWindowAverage';
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const slotWidth = plotWidth / horizon;
  const form = formFor(horizon);

  // Value axis: always from zero in v0, so the baseline is a real zero and no zigzag is needed.
  const top = Math.max(0, ...points.map((point) => point.mean + (point.sd ?? 0)));
  const yTicks = niceTicks(top);
  const yMax = yTicks.at(-1)!;
  const tickFormat = numberFormat(t.locale, decimalsOf(yTicks[1]! - yTicks[0]!));
  const yLabels = Object.fromEntries(yTicks.map((tick) => [String(tick), tickFormat.format(tick)]));
  const valueFormat = numberFormat(t.locale, top >= 100 ? 0 : 1);

  // Time axis: relative days in steps of the window (or a multiple of it); 0 is the reference day.
  const relativeLabel = (rel: number) =>
    rel !== 0
      ? t('axis.daysAgo', { n: -rel })
      : computed.referenceIsYesterday
        ? t('axis.today')
        : localizeDay(t, reference, 'short');
  const xTicks = relativeTicks(horizon, window);
  const xLabels = Object.fromEntries(xTicks.map((tick) => [String(tick), relativeLabel(tick)]));

  const missing = runs(computed.missing).map(([from, to]) => ({ from: from - 0.5, to: to + 0.5, center: (from + to) / 2, days: to - from + 1 }));
  const missingLabels = missing
    .filter((stretch) => stretch.days * slotWidth >= MIN_LABEL_WIDTH)
    .map((stretch) => ({ rel: stretch.center, label: t('chart.noData') }));

  const latest = points.find((point) => point.rel === 0);
  const latestData = latest
    ? [{
        rel: 0,
        mean: latest.mean,
        value: valueFormat.format(latest.mean),
        detail: latest.sd === null ? '' : `± ${valueFormat.format(latest.sd)}`,
      }]
    : [];

  const x = {
    field: 'rel',
    type: 'quantitative' as const,
    scale: { domain: [-(horizon - 1) - 0.5, 0.5], nice: false, zero: false },
  };
  const y = (field: string) => ({
    field,
    type: 'quantitative' as const,
    scale: { domain: [0, yMax], nice: false, zero: true },
  });
  const axes = {
    x: { ...x, axis: { values: xTicks, labelExpr: lookup(xLabels), title: null } },
    y: { ...y('mean'), axis: { values: yTicks, labelExpr: lookup(yLabels), title: null } },
  };
  const textMark = { type: 'text', align: 'left', baseline: 'middle', dx: 10 } as const;
  const dot = {
    type: 'point',
    filled: true,
    size: tokens.mark.meanSize,
    color: color(tokens, 'focus'),
    opacity: 1,
    stroke: color(tokens, 'surface'),
    strokeWidth: 1,
  } as const;

  // The spread in the light tint of the focus colour: a thin bar per day, or a band under the line.
  const segments = withSegments(points);
  const capPad = form === 'dots' ? (tokens.stroke.spread / 2) * (yMax / PLOT_HEIGHT) : 0;
  const spreadData = segments.flatMap((point) => {
    if (point.sd === null) return [];
    const lo = Math.max(0, point.mean - point.sd) + capPad;
    const hi = point.mean + point.sd - capPad;
    return [{ rel: point.rel, segment: point.segment, lo: Math.min(lo, point.mean), hi: Math.max(hi, point.mean) }];
  });
  // A day between two gaps has no line to sit on, so it keeps its dot.
  const lonePoints = segments.filter((point) => point.segmentLength === 1);

  const dayLayers =
    form === 'dots'
      ? [
          {
            data: { name: 'spread' },
            mark: { type: 'rule', strokeWidth: tokens.stroke.spread, strokeCap: 'round', color: color(tokens, 'focus/light') },
            encoding: { x, y: y('lo'), y2: { field: 'hi' } },
          },
          // The mean: a dot. Both axes are defined here, with the ticks and labels computed above.
          { mark: dot, encoding: axes },
        ]
      : [
          {
            data: { name: 'spread' },
            mark: { type: 'area', color: color(tokens, 'focus/light'), opacity: 1 },
            encoding: { x, y: y('lo'), y2: { field: 'hi' }, detail: { field: 'segment' } },
          },
          {
            mark: { type: 'line', color: color(tokens, 'focus'), strokeWidth: tokens.stroke.line },
            encoding: { ...axes, detail: { field: 'segment' } },
          },
          { data: { name: 'lone' }, mark: dot, encoding: { x, y: y('mean') } },
        ];

  const spec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    width: plotWidth,
    height: PLOT_HEIGHT,
    autosize: { type: 'none' },
    padding: PADDING,
    background: 'transparent',
    config: vegaLiteConfig(tokens),
    datasets: { spread: spreadData, points: segments, lone: lonePoints, missing, missingLabels, latest: latestData },
    data: { name: 'points' },
    layer: [
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
      ...dayLayers,
      {
        // The last day's value (10, bold) and its spread as a detail (8, muted).
        data: { name: 'latest' },
        mark: { ...textMark, dy: -6, fontSize: tokens.size.value, fontWeight: 'bold', color: color(tokens, 'text') },
        encoding: { x, y: y('mean'), text: { field: 'value' } },
      },
      {
        data: { name: 'latest' },
        mark: { ...textMark, dy: 6, fontSize: tokens.size.detail, color: color(tokens, 'text/muted') },
        encoding: { x, y: y('mean'), text: { field: 'detail' } },
      },
    ],
  } as TopLevelSpec;

  // On hover, every day says what it shows: its value and window, or why it has none.
  const absent = new Set(computed.absentDays);
  const byRel = new Map(points.map((point) => [point.rel, point]));
  const hover: HoverTarget[] = [];
  for (let rel = -(horizon - 1); rel <= 0; rel++) {
    const day = reference + rel;
    const params = {
      day: rel === 0 && !computed.referenceIsYesterday ? localizeDay(t, day, 'short') : `${localizeDay(t, day, 'short')} (${relativeLabel(rel)})`,
      range: localizeRange(t, day - window + 1, day),
    };
    const point = byRel.get(rel);
    let label: string;
    if (point) {
      label = point.sd === null
        ? t('chart.hover.pointNoSpread', { ...params, value: valueFormat.format(point.mean) })
        : t('chart.hover.point', { ...params, value: valueFormat.format(point.mean), sd: valueFormat.format(point.sd) });
    } else {
      const missingDays = [];
      for (let other = day - window + 1; other <= day; other++) if (absent.has(other)) missingDays.push(other);
      const first = localizeDay(t, missingDays[0] ?? day, 'short');
      label = missingDays.length === 1
        ? t('chart.hover.missingOne', { ...params, absent: first })
        : t('chart.hover.missingMany', { ...params, count: missingDays.length, absent: first });
    }
    hover.push({ x: (rel + horizon - 1) * slotWidth, width: slotWidth, label });
  }

  const title = request.title ?? request.metric;
  const cue = spread === 'none' ? t(`${key}.readingCueNoSpread`, { window }) : t(`${key}.readingCue`, { window });
  const readingCue = request.measureType === 'unique' ? `${t(`${key}.readingCueUnique`)} · ${cue}` : cue;
  const latestText = !latest
    ? t(`${key}.descLatestMissing`)
    : latest.sd === null
      ? t(`${key}.descLatestNoSpread`, { value: valueFormat.format(latest.mean) })
      : t(`${key}.descLatest`, { value: valueFormat.format(latest.mean), sd: valueFormat.format(latest.sd) });
  const description = `${t(`${key}.desc`, {
    title,
    window,
    horizon,
    date: localizeDay(t, reference, 'long'),
  })} ${latestText}`;

  return {
    vegaLite: spec,
    width: WIDTH,
    height: PADDING.top + PLOT_HEIGHT + PADDING.bottom,
    plotArea: { x: PADDING.left, y: PADDING.top, width: plotWidth, height: PLOT_HEIGHT },
    hover,
    title,
    readingCue,
    description,
    asOf: reference,
  };
}

/**
 * Ticks at 0, -step, -2 step, ... The step is the window (7 when the horizon is shorter than two
 * windows), multiplied by 2, 4, 13, 26 or 52 when that would give more than eight labels.
 */
export function relativeTicks(horizon: number, window: number): number[] {
  const base = horizon >= 2 * window ? window : 7;
  const count = (step: number) => Math.floor((horizon - 1) / step) + 1;
  const step = [1, 2, 4, 13, 26, 52].map((multiple) => multiple * base).find((candidate) => count(candidate) <= MAX_TICKS) ?? 52 * base;
  const ticks: number[] = [];
  for (let rel = 0; rel >= -(horizon - 1); rel -= step) ticks.push(rel);
  if (ticks.length < 2) ticks.push(-(horizon - 1));
  return ticks.sort((a, b) => a - b);
}

/** Round ticks from zero to at least `top`: steps of 1, 2, 2.5 or 5 times a power of ten. */
export function niceTicks(top: number, count = 4): number[] {
  if (!(top > 0)) return [0, 1];
  const raw = top / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((multiple) => multiple * magnitude).find((candidate) => candidate >= raw)!;
  const steps = Math.ceil(top / step - 1e-9);
  return Array.from({ length: steps + 1 }, (_, index) => Number((index * step).toPrecision(12)));
}

/** Numbers each run of consecutive days, so a line or band never bridges a gap. */
function withSegments(points: readonly WindowPoint[]) {
  let segment = 0;
  const segmentOf = points.map((point, index) => {
    if (index > 0 && point.rel !== points[index - 1]!.rel + 1) segment++;
    return segment;
  });
  const lengths = new Map<number, number>();
  for (const id of segmentOf) lengths.set(id, (lengths.get(id) ?? 0) + 1);
  return points.map((point, index) => ({ ...point, segment: segmentOf[index]!, segmentLength: lengths.get(segmentOf[index]!)! }));
}

function decimalsOf(value: number): number {
  for (let digits = 0; digits < 6; digits++) {
    const scaled = value * 10 ** digits;
    if (Math.abs(Math.round(scaled) - scaled) < 1e-6) return digits;
  }
  return 6;
}

function numberFormat(locale: string, digits: number): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Consecutive runs in a sorted list of whole numbers: [-27,-26,-20] -> [[-27,-26],[-20,-20]]. */
function runs(values: readonly number[]): [number, number][] {
  const result: [number, number][] = [];
  for (const value of values) {
    const last = result.at(-1);
    if (last && value === last[1] + 1) last[1] = value;
    else result.push([value, value]);
  }
  return result;
}

/** A Vega expression that looks up a precomputed label; built from our own labels, never from caller text. */
function lookup(labels: Record<string, string>): string {
  return `${JSON.stringify(labels)}[datum.value]`;
}

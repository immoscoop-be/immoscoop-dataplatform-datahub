import type { TopLevelSpec } from 'vega-lite';
import { localizeDay } from '../../src/core/days.ts';
import type { DrawContext, Drawing } from '../../src/core/semgraph.ts';
import { color, vegaLiteConfig } from '../../src/core/tokens.ts';
import type { MovingWindowAverageComputed, MovingWindowAverageRequest } from './types.ts';

const WIDTH = 640;
const PLOT_HEIGHT = 200;
/** Fixed geometry (autosize none): room for the y labels left and the last day's label right. */
const PADDING = { left: 52, right: 64, top: 14, bottom: 30 };
/** A "no data" label is only written in a missing stretch at least this wide. */
const MIN_LABEL_WIDTH = 44;

/**
 * Builds what Vega-Lite draws. All decisions are made here: the axis ticks and labels, which value
 * is labelled, how the spread is drawn. Vega-Lite only draws what it gets.
 */
export function draw(
  request: MovingWindowAverageRequest,
  computed: MovingWindowAverageComputed,
  { t, tokens }: DrawContext,
): Drawing {
  const { horizon, window, points, spread } = computed;
  const key = 'semgraphs.movingWindowAverage';
  const plotWidth = WIDTH - PADDING.left - PADDING.right;

  // Value axis: always from zero in v0, so the baseline is a real zero and no zigzag is needed.
  const top = Math.max(0, ...points.map((point) => point.mean + (point.sd ?? 0)));
  const yTicks = niceTicks(top);
  const yMax = yTicks.at(-1)!;
  const tickFormat = numberFormat(t.locale, decimalsOf(yTicks[1]! - yTicks[0]!));
  const yLabels = Object.fromEntries(yTicks.map((tick) => [String(tick), tickFormat.format(tick)]));

  // Time axis: relative days, labelled in steps of the window; 0 is the reference day.
  const xTicks = relativeTicks(horizon, window);
  const referenceLabel = computed.referenceIsYesterday
    ? t('axis.today')
    : localizeDay(t, computed.reference, 'short');
  const xLabels = Object.fromEntries(
    xTicks.map((tick) => [String(tick), tick === 0 ? referenceLabel : t('axis.daysAgo', { n: -tick })]),
  );

  // A round cap reaches half the stroke width past the end of a rule: shorten it, so ±1 sd stays exact.
  const capPad = (tokens.stroke.spread / 2) * (yMax / PLOT_HEIGHT);
  const spreadData = points.flatMap((point) => {
    if (point.sd === null) return [];
    const lo = Math.max(0, point.mean - point.sd) + capPad;
    const hi = point.mean + point.sd - capPad;
    return [{ rel: point.rel, lo: Math.min(lo, point.mean), hi: Math.max(hi, point.mean) }];
  });

  const slotWidth = plotWidth / horizon;
  const missing = runs(computed.missing).map(([from, to]) => ({ from: from - 0.5, to: to + 0.5, center: (from + to) / 2, days: to - from + 1 }));
  const missingLabels = missing
    .filter((stretch) => stretch.days * slotWidth >= MIN_LABEL_WIDTH)
    .map((stretch) => ({ rel: stretch.center, label: t('chart.noData') }));

  const latest = points.find((point) => point.rel === 0);
  const valueFormat = numberFormat(t.locale, latest && latest.mean >= 100 ? 0 : 1);
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
  const textMark = { type: 'text', align: 'left', baseline: 'middle', dx: 10 } as const;

  const spec: TopLevelSpec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    width: plotWidth,
    height: PLOT_HEIGHT,
    autosize: { type: 'none' },
    padding: PADDING,
    background: 'transparent',
    config: vegaLiteConfig(tokens),
    datasets: { spread: spreadData, points, missing, missingLabels, latest: latestData },
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
      {
        // The spread: a thin bar from -1 to +1 sd, in the light tint of the focus colour.
        data: { name: 'spread' },
        mark: { type: 'rule', strokeWidth: tokens.stroke.spread, strokeCap: 'round', color: color(tokens, 'focus/light') },
        encoding: { x, y: y('lo'), y2: { field: 'hi' } },
      },
      {
        // The mean: a dot. Both axes are defined here, with the ticks and labels computed above.
        mark: {
          type: 'point',
          filled: true,
          size: tokens.mark.meanSize,
          color: color(tokens, 'focus'),
          opacity: 1,
          stroke: color(tokens, 'surface'),
          strokeWidth: 1,
        },
        encoding: {
          x: { ...x, axis: { values: xTicks, labelExpr: lookup(xLabels), title: null } },
          y: { ...y('mean'), axis: { values: yTicks, labelExpr: lookup(yLabels), title: null } },
        },
      },
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
  };

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
    date: localizeDay(t, computed.reference, 'long'),
  })} ${latestText}`;

  return {
    vegaLite: spec,
    width: WIDTH,
    height: PADDING.top + PLOT_HEIGHT + PADDING.bottom,
    title,
    readingCue,
    description,
    asOf: computed.reference,
  };
}

/** Ticks at 0, -step, -2 step, ...; the step is the window, or 7 when the horizon is short. */
export function relativeTicks(horizon: number, window: number): number[] {
  const step = horizon >= 2 * window ? window : 7;
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

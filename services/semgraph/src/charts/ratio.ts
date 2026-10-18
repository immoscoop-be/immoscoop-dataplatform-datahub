import { color, type Tokens } from '../core/tokens.ts';
import { CompactFormat } from './number-format.ts';
import { niceStep, numberFormat, type ValueScale } from './scales.ts';

/** A point of a ratio: its position, the ratio, and the counts it rests on. */
export interface RatioPoint {
  rel: number;
  centre: number;
  parts?: { numerator: number; denominator: number };
}

/** Pixels between the top of the denominator and the ratio point above it, so the two never touch. */
const GAP = 24;
/** Room the right axis needs for its labels. */
export const RIGHT_AXIS = 40;

/** The axis of the denominator on the right, in step with the ratio axis on the left. */
export interface DenominatorAxis {
  max: number;
  ticks: number[];
  /** A denominator in the units of the ratio axis, so both share one scale and one set of gridlines. */
  toRatio(value: number): number;
}

/**
 * REQ-079: both axes start at zero and share their gridlines; the denominator axis is as tall as it
 * must be for every denominator to stay below its ratio, so the two never cross. A ratio of zero sits
 * on the baseline and cannot have its base below it; it does not count (open point).
 */
export function denominatorAxis(points: readonly RatioPoint[], scale: ValueScale, plotHeight: number): DenominatorAxis {
  const steps = scale.ticks.length - 1;
  let needed = Math.max(1, ...points.map((point) => point.parts?.denominator ?? 0));
  for (const point of points) {
    if (!point.parts || !(point.centre > 0)) continue;
    const height = point.centre / scale.max;
    const room = height - GAP / plotHeight;
    needed = Math.max(needed, point.parts.denominator / (room > height / 2 ? room : height / 2));
  }
  const step = niceStep(needed / steps);
  const max = step * steps;
  return { max, ticks: scale.ticks.map((_, index) => index * step), toRatio: (value) => (value / max) * scale.max };
}

/**
 * The denominator behind the data (REQ-076, REQ-077, REQ-078): a filled step line in neutral grey, one
 * flat block per period, broken where a period has no data; and the quieter right axis with its labels.
 */
export function baseLayers({ points, axis, labelled, scale, x, y, plotWidth, locale, tokens }: {
  points: readonly RatioPoint[];
  axis: DenominatorAxis;
  /** The points whose denominator is written above its block: the labelled values. */
  labelled: ReadonlySet<number>;
  scale: ValueScale;
  x: object;
  y: (field: string) => object;
  plotWidth: number;
  locale: string;
  tokens: Tokens;
}) {
  // Every run of neighbouring periods is one step line, padded half a period on both sides.
  const steps: { rel: number; value: number; segment: number }[] = [];
  let segment = 0;
  points.forEach((point, index) => {
    if (!point.parts) return;
    const value = axis.toRatio(point.parts.denominator);
    const previous = points[index - 1];
    if (index === 0 || !previous?.parts || previous.rel !== point.rel - 1) {
      if (steps.length > 0) {
        const last = steps.at(-1)!;
        steps.push({ rel: last.rel + 0.5, value: last.value, segment });
      }
      segment++;
      steps.push({ rel: point.rel - 0.5, value, segment });
    }
    steps.push({ rel: point.rel, value, segment });
  });
  if (steps.length > 0) {
    const last = steps.at(-1)!;
    steps.push({ rel: last.rel + 0.5, value: last.value, segment });
  }
  const count = numberFormat(locale, 0);
  const ticks = new CompactFormat(locale, axis.max).ticks(axis.ticks);
  return {
    datasets: {
      base: steps,
      baseLabels: points.filter((point) => point.parts && labelled.has(point.rel)).map((point) => ({ rel: point.rel, value: axis.toRatio(point.parts!.denominator), text: count.format(point.parts!.denominator) })),
      rightAxis: scale.ticks.map((tick, index) => ({ value: tick, text: ticks[String(axis.ticks[index])]! })),
    },
    layers: [
      {
        data: { name: 'base' },
        mark: { type: 'area', interpolate: 'step', color: color(tokens, 'axis'), opacity: 1 },
        encoding: { x, y: y('value'), y2: { datum: 0 }, detail: { field: 'segment' } },
      },
      {
        data: { name: 'base' },
        mark: { type: 'line', interpolate: 'step', color: color(tokens, 'context'), strokeWidth: tokens.stroke.axis },
        encoding: { x, y: y('value'), detail: { field: 'segment' } },
      },
      {
        data: { name: 'baseLabels' },
        mark: { type: 'text', align: 'center', baseline: 'bottom', dy: -4, fontSize: tokens.size.axisLabel, color: color(tokens, 'text/muted') },
        encoding: { x, y: y('value'), text: { field: 'text' } },
      },
      {
        // REQ-079: the right axis is quieter: lighter labels, no shapes.
        data: { name: 'rightAxis' },
        mark: { type: 'text', align: 'left', baseline: 'middle', dx: 8, fontSize: tokens.size.axisLabel, color: color(tokens, 'context') },
        encoding: { x: { value: plotWidth }, y: y('value'), text: { field: 'text' } },
      },
    ],
  };
}

import { color, type Tokens } from '../core/tokens.ts';

/** A value axis as the chart draws it: its ticks, and whether it starts above zero. */
export interface ValueScale {
  ticks: number[];
  min: number;
  max: number;
  /** True when the axis does not start at zero: shown with a zigzag and a bold first value. */
  zoomed: boolean;
}

export type ValueAxisMode = 'zero' | 'zoom';

/**
 * From zero by default. "zoom" lets the axis start at a round value just below the data; that is
 * allowed for positions such as averages and medians, never for bars. When the round start is zero
 * anyway, the axis simply starts at zero (REQ-026).
 */
export function valueScale(lowest: number, highest: number, mode: ValueAxisMode): ValueScale {
  const ticks = mode === 'zoom' && lowest > 0 ? niceRange(lowest, highest) : niceTicks(highest);
  const min = ticks[0]!;
  return { ticks, min, max: ticks.at(-1)!, zoomed: min > 0 };
}

/**
 * The zigzag at the start of the baseline of a zoomed axis, in pixels: along the baseline, and across
 * it. Every chart that zooms draws the same one (REQ-026, REQ-073); MASK is the stretch of baseline it replaces.
 */
export const ZIGZAG: readonly (readonly [number, number])[] = [[0, 0], [2, 3], [5, -3], [8, 3], [10, 0]];
export const ZIGZAG_MASK = 11;

/**
 * The layers of a zoomed axis (REQ-026, REQ-073): the baseline gives way to a zigzag at its start. The
 * data sets `mask` and `zigzag` hold their points; `along` encodes the stretch of baseline the mask covers.
 */
export function zoomLayers(tokens: Tokens, x: object, y: object, along: object) {
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

/** The first value of a zoomed axis is bold. */
export function zoomedLabelWeight(scale: ValueScale): object {
  return scale.zoomed ? { labelFontWeight: { condition: { test: `datum.value === ${scale.min}`, value: 'bold' }, value: 'normal' } } : {};
}

/** Round ticks from zero to at least `top`: steps of 1, 2, 2.5 or 5 times a power of ten. */
export function niceTicks(top: number, count = 4): number[] {
  if (!(top > 0)) return [0, 1];
  return niceRange(0, top, count);
}

/** Round ticks from just below `lowest` to just above `highest`. */
export function niceRange(lowest: number, highest: number, count = 4): number[] {
  if (!(highest > lowest)) return niceTicks(Math.max(highest, 0) || 1, count);
  const step = niceStep((highest - lowest) / count);
  const first = Math.floor(lowest / step + 1e-9);
  const last = Math.ceil(highest / step - 1e-9);
  return Array.from({ length: last - first + 1 }, (_, index) => Number(((first + index) * step).toPrecision(12)));
}

/** The smallest round step of at least `raw`: 1, 2, 2.5 or 5 times a power of ten. */
export function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((multiple) => multiple * magnitude).find((candidate) => candidate >= raw)!;
}

/** The number of decimals a tick step needs: 2.5 needs one, 20 none. */
export function decimalsOf(value: number): number {
  for (let digits = 0; digits < 6; digits++) {
    const scaled = value * 10 ** digits;
    if (Math.abs(Math.round(scaled) - scaled) < 1e-6) return digits;
  }
  return 6;
}

export function numberFormat(locale: string, digits: number): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Consecutive runs in a sorted list of whole numbers: [-27,-26,-20] -> [[-27,-26],[-20,-20]]. */
export function runs(values: readonly number[]): [number, number][] {
  const result: [number, number][] = [];
  for (const value of values) {
    const last = result.at(-1);
    if (last && value === last[1] + 1) last[1] = value;
    else result.push([value, value]);
  }
  return result;
}

/** Ticks at 0, -step, -2 step, ... back to the first slot; at least two. */
export function ticksEvery(step: number, slots: number): number[] {
  const ticks: number[] = [];
  for (let rel = 0; rel >= -(slots - 1); rel -= step) ticks.push(rel);
  if (ticks.length < 2) ticks.push(-(slots - 1));
  return ticks.sort((a, b) => a - b);
}

/** A Vega expression that looks up a precomputed label; built from our own labels, never from caller text. */
export function lookup(labels: Record<string, string>): string {
  return `${JSON.stringify(labels)}[datum.value]`;
}

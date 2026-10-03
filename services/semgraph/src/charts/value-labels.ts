import type { Translator } from '../core/i18n.ts';
import { color, type Tokens } from '../core/tokens.ts';
import type { Statistic, Summary } from './statistics.ts';

/**
 * Which values are written on the chart (REQ-022, after Figma): none, the last one, the last final
 * one plus the running one (in grey), or all of them, which only fits with few points.
 */
export const VALUES_MODES = ['off', 'last', 'lastAndPrevious', 'all'] as const;
export type ValuesMode = (typeof VALUES_MODES)[number];

/** All values only while every label has room: this many pixels per point. */
export const MIN_WIDTH_FOR_ALL = 40;

/** Pixels between the top of a point's spread and its labels, and the height of a value and a detail line. */
const GAP = 6;
const VALUE_LINE = 11;
const DETAIL_LINE = 9;
/** "lopend" goes under a running point when there is this much room above the baseline. */
const RUNNING_ROOM = 14;

export interface LabelledPoint extends Summary {
  rel: number;
  running: boolean;
}

interface LabelRow {
  rel: number;
  y: number;
  text: string;
}

interface Label {
  point: LabelledPoint;
  /** strong: bold, in the text colour; muted: the running value next to the last final one. */
  style: 'strong' | 'muted';
  detail: boolean;
}

const top = (point: Summary) => point.spread?.hi ?? point.centre;
const bottom = (point: Summary) => Math.max(0, point.spread?.lo ?? point.centre);

/** The points that get a label, and how. */
export function labelsFor(points: readonly LabelledPoint[], mode: ValuesMode): Label[] {
  const last = points.find((point) => point.rel === 0);
  const lastFinal = [...points].reverse().find((point) => !point.running);
  switch (mode) {
    case 'off':
      return [];
    case 'last':
      return last ? [{ point: last, style: 'strong', detail: true }] : [];
    case 'lastAndPrevious':
      // Previous = the last final value, bold; the running value next to it in grey.
      if (last && !last.running) return [{ point: last, style: 'strong', detail: true }];
      return [
        ...(lastFinal ? [{ point: lastFinal, style: 'strong' as const, detail: true }] : []),
        ...(last ? [{ point: last, style: 'muted' as const, detail: false }] : []),
      ];
    case 'all':
      return points.map((point) => (point.running ? { point, style: 'muted', detail: false } : { point, style: 'strong', detail: true }));
  }
}

/** The highest value the value axis must reach so that every label fits above its point. */
export function headroom(labels: readonly Label[], highest: number, perPixel: number): number {
  return Math.max(highest, ...labels.map(({ point, detail }) => top(point) + (GAP + VALUE_LINE + (detail ? DETAIL_LINE : 0)) * perPixel));
}

interface DrawInput {
  labels: readonly Label[];
  /** Running points, which get "lopend" ("current") under them. */
  running: readonly LabelledPoint[];
  statistic: Statistic;
  format: Intl.NumberFormat;
  t: Translator;
  tokens: Tokens;
  x: object;
  y: (field: string) => object;
  /** Data units per pixel on the value axis, and where it starts. */
  perPixel: number;
  min: number;
}

/**
 * The value labels as Figma draws them: centred above the point and its spread, the value with the
 * spread as a detail under it. A running period says "lopend" under its point (REQ-000), or above
 * its label when there is no room down to the baseline. Positions are computed here, in data units.
 */
export function valueLabels({ labels, running, statistic, format, t, tokens, x, y, perPixel, min }: DrawInput) {
  const row = (rel: number, at: number, text: string): LabelRow => ({ rel, y: at, text });
  const strong: LabelRow[] = [];
  const muted: LabelRow[] = [];
  const details: LabelRow[] = [];
  const stackTop = new Map<number, number>();
  for (const { point, style, detail } of labels) {
    const detailText = detail ? statistic.formatDetail(format, point) : '';
    let at = top(point) + GAP * perPixel;
    if (detailText) {
      details.push(row(point.rel, at, detailText));
      at += DETAIL_LINE * perPixel;
    }
    (style === 'strong' ? strong : muted).push(row(point.rel, at, format.format(point.centre)));
    stackTop.set(point.rel, at + VALUE_LINE * perPixel);
  }
  const below: LabelRow[] = [];
  const above: LabelRow[] = [];
  for (const point of running) {
    const text = t('chart.runningShort');
    if ((bottom(point) - min) / perPixel >= RUNNING_ROOM) below.push(row(point.rel, bottom(point) - 4 * perPixel, text));
    else above.push(row(point.rel, (stackTop.get(point.rel) ?? top(point) + GAP * perPixel) + 2 * perPixel, text));
  }

  const text = (name: string, mark: object) => ({
    data: { name },
    mark: { type: 'text', align: 'center', baseline: 'bottom', ...mark },
    encoding: { x, y: y('y'), text: { field: 'text' } },
  });
  const detailStyle = { fontSize: tokens.size.detail, color: color(tokens, 'text/muted') };
  return {
    datasets: { valuesStrong: strong, valuesMuted: muted, valuesDetail: details, runningBelow: below, runningAbove: above },
    layers: [
      text('valuesStrong', { fontSize: tokens.size.value, fontWeight: 'bold', color: color(tokens, 'text') }),
      text('valuesMuted', { fontSize: tokens.size.value, color: color(tokens, 'text/muted') }),
      text('valuesDetail', detailStyle),
      text('runningBelow', { ...detailStyle, baseline: 'top' }),
      text('runningAbove', detailStyle),
    ],
  };
}

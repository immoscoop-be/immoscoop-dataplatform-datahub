import { color, type Tokens } from '../core/tokens.ts';

/**
 * The comparison of `periodComparison`: the same value for the period just before the screen, as a
 * grey line (REQ-003). What is on the screen can be compared by eye; what is not, the chart brings
 * in (REQ-037). Only a shortfall against it is hatched; a gain gets no fill (REQ-004).
 */

export interface LinePoint {
  rel: number;
  centre: number;
}

/** Spacing of the hatch lines in pixels. */
const HATCH_SPACING = 4;

/**
 * The hatched areas: between the two lines wherever the focus series is below the comparison, cut
 * at the crossings, and never across a gap in either line. Every piece is its own area.
 */
export function shortfall(focus: readonly LinePoint[], comparison: readonly LinePoint[]) {
  const previous = new Map(comparison.map((point) => [point.rel, point.centre]));
  const byRel = new Map(focus.map((point) => [point.rel, point.centre]));
  const rows: { rel: number; lo: number; hi: number; piece: number }[] = [];
  let piece = 0;
  for (const point of focus) {
    const next = point.rel + 1;
    const [f0, f1, c0, c1] = [point.centre, byRel.get(next), previous.get(point.rel), previous.get(next)];
    if (f1 === undefined || c0 === undefined || c1 === undefined) continue;
    const [d0, d1] = [c0 - f0, c1 - f1];
    if (d0 <= 0 && d1 <= 0) continue;
    const at = (t: number) => ({ rel: point.rel + t, value: f0 + t * (f1 - f0) });
    piece++;
    if (d0 > 0 && d1 > 0) {
      rows.push({ rel: point.rel, lo: f0, hi: c0, piece }, { rel: next, lo: f1, hi: c1, piece });
    } else {
      const crossing = at(d0 / (d0 - d1));
      if (d0 > 0) rows.push({ rel: point.rel, lo: f0, hi: c0, piece }, { rel: crossing.rel, lo: crossing.value, hi: crossing.value, piece });
      else rows.push({ rel: crossing.rel, lo: crossing.value, hi: crossing.value, piece }, { rel: next, lo: f1, hi: c1, piece });
    }
  }
  return rows;
}

/**
 * A pattern id that is the same for the same chart and differs between charts, so several charts can
 * share a page. Technical ids like this one are allowed (REQ-036).
 */
export function patternId(seed: string, kind = 'hatch'): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `semgraph-${kind}-${hash.toString(16).padStart(8, '0')}`;
}

/**
 * Diagonal lines on the surface colour: the hatching that means a loss against a reference. As in Figma
 * (REQ-055): falling from top left to bottom right, so it reads as a decline; thin and soft; and on the
 * surface colour, so it covers any pattern of a data state below it.
 */
export function hatchPattern(id: string, tokens: Tokens): string {
  return [
    `<pattern id="${id}" width="${HATCH_SPACING}" height="${HATCH_SPACING}" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">`,
    `<rect width="${HATCH_SPACING}" height="${HATCH_SPACING}" fill="${color(tokens, 'surface')}"/>`,
    `<line x1="0" y1="0" x2="0" y2="${HATCH_SPACING}" stroke="${color(tokens, 'loss')}" stroke-width="1" stroke-opacity="0.75"/>`,
    '</pattern>',
  ].join('');
}

/** Two labels at the right end, at least this many pixels apart; a second line under the value adds this much. */
const LABEL_GAP = 12;
export const SECOND_LINE = 10;

/**
 * The labels at the end of the lines (REQ-003): the last value of the focus series, with "lopend"
 * under it while its period runs, and the name of the comparison, each next to the end of its own
 * line and pushed apart when they would overlap. Positions in pixels from the top of the plot.
 */
export function endLabels(
  focusY: number | undefined,
  comparisonY: number | undefined,
  running = false,
): { focus?: number; comparison?: number } {
  if (focusY === undefined || comparisonY === undefined) return { focus: focusY, comparison: comparisonY };
  // The focus label goes on the side where its line is; on a tie it goes above.
  const above = focusY <= comparisonY;
  const needed = LABEL_GAP + (above && running ? SECOND_LINE : 0);
  const gap = Math.abs(focusY - comparisonY);
  if (gap >= needed) return { focus: focusY, comparison: comparisonY };
  const push = (needed - gap) / 2;
  return above ? { focus: focusY - push, comparison: comparisonY + push } : { focus: focusY + push, comparison: comparisonY - push };
}

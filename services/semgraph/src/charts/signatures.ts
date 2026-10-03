import type { Tokens } from '../core/tokens.ts';

/** What kind of number a point is. */
export type Kind = 'amount' | 'mean' | 'median';
export type Shape = 'square' | 'diamond' | 'circle';

/**
 * The signature of a point: its shape tells the reader what kind of number it is, before any label
 * is read. A period that is still running keeps its shape, hollow, because its value is not final.
 *
 * - REQ-006: a mean is a diamond, over a thin bar or with a band for ±1 sd.
 * - REQ-007: an amount (volume) is a square. No semgraph shows amounts as points yet.
 * - REQ-008: a median is a dot, in a wide bar or with a band for P25–P75.
 */
export const SHAPES: Record<Kind, Shape> = { amount: 'square', mean: 'diamond', median: 'circle' };

/** Vega's symbol size of a point; for these shapes it is the square of the width in pixels. */
export function markerSize(tokens: Tokens, kind: Kind): number {
  return tokens.mark[SHAPES[kind]] ** 2;
}

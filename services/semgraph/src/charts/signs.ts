import type { Sign, SignSample } from '../core/semgraph.ts';
import { color, type Tokens } from '../core/tokens.ts';
import type { DataState } from './data-states.ts';
import { ZIGZAG } from './scales.ts';
import type { Shape } from './signatures.ts';

/** What a chart drew, in the terms of its own drawing: the pattern ids are the ones in its defs. */
export interface DrawnSigns {
  /** The shape of the points of the series, when it drew any. */
  shape?: Shape | 'squareInSquare';
  /** The pattern of every data state it drew. */
  patterns?: Partial<Record<DataState, string>>;
  /** The hatch pattern of a loss, when it drew one. */
  hatch?: string;
  zigzag?: boolean;
}

/** The order of the lesson, as in Figma: the series first, then the states, the loss and the axis. */
const ORDER: readonly Sign[] = ['square', 'circle', 'diamond', 'squareInSquare', 'running', 'few', 'empty', 'loss', 'zigzag'];
const STATE_ORDER: readonly DataState[] = ['running', 'few', 'empty'];
/** The sample is 16 × 16, its centre at 8. */
const CENTRE = 8;

/**
 * REQ-102: "Signs in this chart" shows only the signs the chart really drew, each as a sample of 16 × 16. A
 * pattern refers to the chart's own pattern, so the sample is exactly what the chart shows.
 */
export function signSamples(drawn: DrawnSigns, tokens: Tokens): SignSample[] {
  const focus = color(tokens, 'focus');
  const surface = color(tokens, 'surface');
  const filled = (id: string) => `<rect width="16" height="16" fill="url(#${id})"/>`;
  const samples = new Map<Sign, string>();
  switch (drawn.shape) {
    case 'square': {
      const half = tokens.mark.square / 2;
      samples.set('square', `<rect x="${CENTRE - half}" y="${CENTRE - half}" width="${2 * half}" height="${2 * half}" fill="${focus}"/>`);
      break;
    }
    case 'circle':
      samples.set('circle', `<circle cx="${CENTRE}" cy="${CENTRE}" r="${tokens.mark.circle / 2}" fill="${focus}"/>`);
      break;
    case 'diamond': {
      const half = tokens.mark.diamond / 2;
      samples.set('diamond', `<path d="M${CENTRE},${CENTRE - half}L${CENTRE + half},${CENTRE}L${CENTRE},${CENTRE + half}L${CENTRE - half},${CENTRE}Z" fill="${focus}"/>`);
      break;
    }
    case 'squareInSquare':
      // REQ-075: the open square of the denominator, white inside, around the numerator.
      samples.set(
        'squareInSquare',
        `<rect x="4" y="4" width="8" height="8" fill="${surface}" stroke="${focus}" stroke-width="1.3"/><rect x="6.4" y="6.4" width="3.2" height="3.2" fill="${focus}"/>`,
      );
      break;
  }
  for (const state of STATE_ORDER) {
    const id = drawn.patterns?.[state];
    if (id) samples.set(state, filled(id));
  }
  if (drawn.hatch) samples.set('loss', filled(drawn.hatch));
  if (drawn.zigzag) {
    // The zigzag at the start of the baseline: up is a higher value, so up on the screen.
    const points = ZIGZAG.map(([along, across]) => `${3 + along},${CENTRE - across}`).join(' ');
    samples.set(
      'zigzag',
      `<polyline points="${points}" fill="none" stroke="${color(tokens, 'baseline')}" stroke-width="${tokens.stroke.baseline}" stroke-linejoin="miter"/>`,
    );
  }
  return ORDER.flatMap((sign) => (samples.has(sign) ? [{ sign, markup: samples.get(sign)! }] : []));
}

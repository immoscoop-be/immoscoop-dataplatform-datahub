import { color, type Tokens } from '../core/tokens.ts';
import { runs } from './scales.ts';

/**
 * The state of the data in a period, as a pattern behind its whole column (REQ-049): a checkerboard
 * for empty (REQ-051) and fine vertical lines for a period that is still running (REQ-052). The
 * pattern for few observations (REQ-053) waits for the question what n is.
 */
export type DataState = 'empty' | 'running';

export const DATA_STATES: readonly DataState[] = ['empty', 'running'];

/** A stretch of neighbouring slots in the same state, from the left edge of the first to the right edge of the last. */
export interface StateColumn {
  from: number;
  to: number;
  state: DataState;
}

/** Neighbouring columns in the same state become one area; the tiles run on seamlessly anyway (REQ-050). */
export function stateColumns(states: ReadonlyMap<number, DataState>): StateColumn[] {
  return DATA_STATES.flatMap((state) =>
    runs([...states].filter(([, value]) => value === state).map(([rel]) => rel).sort((a, b) => a - b)).map(([from, to]) => ({ from: from - 0.5, to: to + 0.5, state })),
  );
}

/**
 * The tiles of Figma's Pattern masters, on the surface colour. They use the user space of the plot, so
 * they are anchored to its origin and not to the column (REQ-050): mosaic 8 px, lines 4 px.
 */
export function statePattern(id: string, state: DataState, tokens: Tokens): string {
  const surface = color(tokens, 'surface');
  switch (state) {
    case 'empty': {
      const tile = color(tokens, 'pattern/empty');
      return [
        `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse">`,
        `<rect width="8" height="8" fill="${surface}"/>`,
        `<rect width="4" height="4" fill="${tile}"/><rect x="4" y="4" width="4" height="4" fill="${tile}"/>`,
        '</pattern>',
      ].join('');
    }
    case 'running':
      return [
        `<pattern id="${id}" width="4" height="4" patternUnits="userSpaceOnUse">`,
        `<rect width="4" height="4" fill="${surface}"/>`,
        `<line x1="0.5" y1="0" x2="0.5" y2="4" stroke="${color(tokens, 'pattern/running')}" stroke-width="1"/>`,
        '</pattern>',
      ].join('');
  }
}

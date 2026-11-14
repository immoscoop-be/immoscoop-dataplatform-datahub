import { describe, expect, it } from 'vitest';
import { digitOf, flag, markOf, MOST_FLAGGED, moveFlag, placeOf, unflag, withMod } from './flags.js';

describe('flagged queries (DEC-UX-236)', () => {
  it('gives the first nine the keys 1 to 9 and the tenth 0', () => {
    expect(Array.from({ length: MOST_FLAGGED }, (_, at) => digitOf(at)).join('')).toBe('1234567890');
    expect(['1', '9', '0'].map(placeOf)).toEqual([0, 8, 9]);
  });

  it('flags a query at the end of the row, once, and at most ten (OP-UX-84)', () => {
    expect(flag(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(flag(['a', 'b'], 'a')).toEqual(['a', 'b']);
    const ten = Array.from({ length: 10 }, (_, at) => `q${at}`);
    expect(flag(ten, 'eleventh')).toEqual(ten);
    expect(unflag(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });

  it('moves a tab to another place, the others shifting with their keys', () => {
    expect(moveFlag(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveFlag(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveFlag(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
  });

  it('marks a run going, Broken, and a result or failure not seen yet', () => {
    const quiet = { running: false, failed: false, broken: false };
    expect(markOf(undefined, true)).toBeNull();
    expect(markOf({ ...quiet, running: true }, false)).toBe('running');
    expect(markOf({ ...quiet, broken: true }, false)).toBe('broken');
    expect(markOf(quiet, true)).toBe('new');
    expect(markOf({ ...quiet, failed: true }, true)).toBe('failed');
    expect(markOf({ ...quiet, failed: true }, false)).toBeNull();
  });

  it('takes Cmd on a Mac and Ctrl elsewhere, never both', () => {
    const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', { key: '1', ...init });
    expect(withMod(key({ metaKey: true }), true)).toBe(true);
    expect(withMod(key({ ctrlKey: true }), true)).toBe(false);
    expect(withMod(key({ ctrlKey: true }), false)).toBe(true);
    expect(withMod(key({ metaKey: true, ctrlKey: true }), false)).toBe(false);
  });
});

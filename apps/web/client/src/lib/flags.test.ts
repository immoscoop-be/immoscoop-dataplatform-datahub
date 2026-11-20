import { describe, expect, it } from 'vitest';
import { digitOf, KEYED, keyed, markOf, placeOf, withMod } from './flags.js';

describe('the row of the active Project (DEC-UX-317)', () => {
  it('gives the first nine the keys 1 to 9 and the tenth 0, and any further one none (DEC-UX-283)', () => {
    expect(Array.from({ length: KEYED }, (_, at) => digitOf(at)).join('')).toBe('1234567890');
    expect([0, 9, 10, 49].map(keyed)).toEqual([true, true, false, false]);
    expect(['1', '9', '0'].map(placeOf)).toEqual([0, 8, 9]);
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

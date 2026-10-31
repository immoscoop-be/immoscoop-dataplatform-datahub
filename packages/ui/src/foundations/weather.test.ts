import { describe, expect, it } from 'vitest';
import { breath, gusts } from './weather.js';

/** A fixed series of numbers in place of Math.random, so that a test sees the same wind each time. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

describe('the wind of Spindrift (DEC-UX-153)', () => {
  it('breathes between -1 and 1, slowly', () => {
    const wind = breath(seeded(7), 3, 1 / 90, 1 / 35);
    const values = Array.from({ length: 2000 }, (_, i) => wind(i * 0.5));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(-1);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
    // A breath does not jump: half a second later it has barely moved.
    expect(Math.max(...values.slice(1).map((value, i) => Math.abs(value - values[i]!)))).toBeLessThan(0.1);
  });

  it('never comes back to where it was: it differs each time Data Hub starts, and in time', () => {
    const first = breath(seeded(7), 3, 1 / 90, 1 / 35);
    const second = breath(seeded(11), 3, 1 / 90, 1 / 35);
    expect(first(0)).not.toBeCloseTo(second(0), 3);
    // No period of the slowest or fastest wave brings it back.
    for (const later of [35, 90, 180, 630]) {
      expect(first(later)).not.toBeCloseTo(first(0), 3);
    }
  });

  it('comes in gusts: mostly calm, now and then up to a strong one, never below calm', () => {
    const gust = gusts(seeded(3));
    const values = Array.from({ length: 6000 }, (_, i) => gust(i * 0.25));
    expect(Math.min(...values)).toBe(0);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
    expect(Math.max(...values)).toBeGreaterThan(0.3);
    const calm = values.filter((value) => value === 0).length / values.length;
    expect(calm).toBeGreaterThan(0.3);
    expect(calm).toBeLessThan(0.9);
  });
});

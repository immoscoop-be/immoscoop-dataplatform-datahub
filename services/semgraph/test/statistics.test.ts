import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Average, Median, percentile, sampleStandardDeviation } from '../src/charts/statistics.ts';

const close = (actual: number | undefined, expected: number) =>
  assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

describe('statistics', () => {
  it('average: mean with ±1 sample standard deviation (n − 1, like STDDEV)', () => {
    const { centre, spread } = new Average().summarize([8, 10, 12], true);
    close(centre, 10);
    close(spread?.lo, 8);
    close(spread?.hi, 12);
    close(sampleStandardDeviation([2, 4, 4, 4, 5, 5, 7, 9]), Math.sqrt(32 / 7));
  });

  it('median: P25, P50 and P75 with linear interpolation, like PERCENTILE_CONT', () => {
    const { centre, spread } = new Median().summarize([50, 30, 30, 49, 56, 52, 49], true);
    // Sorted: 30 30 49 49 50 52 56. P25 sits halfway between ranks 1 and 2, P75 between 4 and 5.
    close(centre, 49);
    close(spread?.lo, 39.5);
    close(spread?.hi, 51);
    close(percentile([1, 2, 3, 4], 0.25), 1.75);
  });

  it('leaves the spread out when asked, or when one value cannot have a spread', () => {
    assert.equal(new Average().summarize([1, 2, 3], false).spread, null);
    assert.equal(new Average().summarize([5], true).spread, null);
    assert.equal(new Median().summarize([5], true).spread, null);
  });

  it('a mean has a thin bar, a median a wide one', () => {
    const tokens = { stroke: { spread: 4, spreadWide: 9 } } as never;
    assert.ok(new Average().barWidth(tokens) < new Median().barWidth(tokens));
  });
});

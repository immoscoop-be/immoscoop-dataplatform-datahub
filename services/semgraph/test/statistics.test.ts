import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Average, Median, Sum } from '../src/charts/statistics.ts';

describe('statistics', () => {
  it('average: reads the mean with ±1 sd and n from the block, as the warehouse computed them (REQ-058)', () => {
    assert.deepEqual(new Average().read({ end: '2026-09-30', mean: 10, sd: 2, n: 41 }), { centre: 10, spread: { lo: 8, hi: 12 }, n: 41 });
    assert.deepEqual(new Average().read({ end: '2026-09-30', mean: 10 }), { centre: 10, spread: null });
  });

  it('median: reads P25, the median and P75', () => {
    assert.deepEqual(new Median().read({ period: '2026-W40', median: 49, p25: 39.5, p75: 51 }), { centre: 49, spread: { lo: 39.5, hi: 51 } });
  });

  it('a block without a value, or with null, has no point: never zero', () => {
    assert.equal(new Average().read({ end: '2026-09-30', mean: null }), null);
    assert.equal(new Median().read({ end: '2026-09-30' }), null);
    assert.equal(new Sum().read({ period: '2026-09', sum: null }), null);
    assert.deepEqual(new Sum().read({ period: '2026-09', sum: 0 }), { centre: 0, spread: null });
  });

  it('a total has no spread and no n (REQ-043)', () => {
    const sum = new Sum();
    assert.equal(sum.hasSpread, false);
    assert.equal(sum.fewBelow, null);
    assert.deepEqual(Object.keys(sum.pointProperties()), ['sum']);
  });

  it('a mean has a thin bar, a median a wide one', () => {
    const tokens = { stroke: { spread: 4, spreadWide: 9 } } as never;
    assert.ok(new Average().barWidth(tokens) < new Median().barWidth(tokens));
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { Average, Median, Ratio, Sum } from '../src/charts/statistics.ts';

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

  it('REQ-081: on a time axis, few observations against the period before and after, so a trend does not trigger it', () => {
    const median = new Median();
    const points = (ns: number[]) => ns.map((n, key) => ({ key, n }));
    // A steady rise: every point is more than half of its neighbours, also the first ones.
    assert.deepEqual(median.fewObservations(points([20, 30, 45, 70, 110, 170, 260])), []);
    // REQ-044 compared with the median of all n's (70) and flagged the start of the trend.
    assert.deepEqual(median.fewObservations(points([20, 30, 45, 70, 110, 170, 260]), 'median'), [0, 1]);
    // A dip against both neighbours; at the edges only the neighbour there is.
    assert.deepEqual(median.fewObservations(points([200, 210, 90, 205, 200])), [2]);
    assert.deepEqual(median.fewObservations(points([60, 200, 210, 205, 70])), [0, 4]);
    // A gap leaves only one neighbour; a running period is no neighbour and is never flagged itself.
    assert.deepEqual(median.fewObservations([{ key: 0, n: 200 }, { key: 2, n: 80 }, { key: 3, n: 200 }]), [2]);
    assert.deepEqual(median.fewObservations([{ key: 0, n: 200 }, { key: 1, n: 90 }, { key: 2, n: 15, running: true }]), [1]);
    assert.deepEqual(median.fewObservations([{ key: 0, n: 30 }, { key: 1, n: 200 }, { key: 2, n: 15, running: true }]), [0]);
    // The fixed thresholds stay: n < 10 for a median, n < 30 for a mean.
    assert.deepEqual(median.fewObservations(points([9, 9, 9])), [0, 1, 2]);
    assert.deepEqual(new Average().fewObservations(points([29, 31, 31])), [0]);
  });

  it('REQ-076: a ratio only divides the numerator by the denominator, both from the warehouse; no denominator, no point', () => {
    const ratio = new Ratio();
    assert.deepEqual(ratio.read({ period: '2026-W31', numerator: 27, denominator: 640 }), { centre: 27 / 640, spread: null, parts: { numerator: 27, denominator: 640 } });
    assert.deepEqual(ratio.read({ period: '2026-W31', numerator: 0, denominator: 640 })?.centre, 0);
    assert.equal(ratio.read({ period: '2026-W31', numerator: 0, denominator: 0 }), null);
    assert.equal(ratio.read({ period: '2026-W31', numerator: null, denominator: 640 }), null);
    assert.deepEqual(ratio.required, ['numerator', 'denominator']);
    assert.equal(ratio.hasSpread, false);
    // A ratio has no n: it rests on its own counts (REQ-080).
    assert.equal(ratio.wantsN(), false);
    assert.equal(ratio.formatDetail(ratio.valueFormat('nl-BE'), { centre: 0.042, spread: null, parts: { numerator: 27, denominator: 1640 } }, 'nl-BE'), '27 / 1.640');
    assert.equal(ratio.valueFormat('nl-BE').format(27 / 640), '4,2%');
    assert.deepEqual(ratio.tickLabels('en', [0, 0.02, 0.04, 0.06]), { 0: '0%', 0.02: '2%', 0.04: '4%', 0.06: '6%' });
    assert.deepEqual(ratio.tickLabels('nl-BE', [0, 0.025, 0.05]), { 0: '0,0%', 0.025: '2,5%', 0.05: '5,0%' });
  });

  it('REQ-080: a ratio rests on few observations when it is statistically thin or its base is unusual; one is enough, running never', () => {
    const ratio = new Ratio();
    const points = (counts: [number, number][]) => counts.map(([numerator, denominator], key) => ({ key, parts: { numerator, denominator } }));
    // Thin: fewer than 10 in the numerator, or fewer than 10 in the denominator without the numerator.
    assert.deepEqual([...ratio.fewReasons(points([[24, 71], [8, 64], [23, 70]]))], [[1, 'thin']]);
    assert.deepEqual([...ratio.fewReasons(points([[62, 71], [58, 64], [61, 70]]))], [[0, 'thin'], [1, 'thin'], [2, 'thin']]);
    // An unusual base: the denominator below half the mean of the period before and after.
    assert.deepEqual([...ratio.fewReasons(points([[88, 2100], [27, 640], [82, 1950]]))], [[1, 'base']]);
    // At the edges only the neighbour there is; a steady rise is no unusual base.
    assert.deepEqual([...ratio.fewReasons(points([[30, 900], [80, 2000], [84, 2100]]))], [[0, 'base']]);
    assert.deepEqual([...ratio.fewReasons(points([[40, 1000], [60, 1500], [90, 2200], [130, 3300]]))], []);
    // A running period is never flagged, and is no neighbour.
    assert.deepEqual(ratio.fewObservations([{ key: 0, parts: { numerator: 80, denominator: 2000 } }, { key: 1, running: true, parts: { numerator: 5, denominator: 300 } }] as never), []);
    assert.deepEqual(ratio.fewObservations([{ key: 0, parts: { numerator: 80, denominator: 2000 } }, { key: 1, parts: { numerator: 40, denominator: 900 } }, { key: 2, running: true, parts: { numerator: 5, denominator: 300 } }] as never), [1]);
  });
});

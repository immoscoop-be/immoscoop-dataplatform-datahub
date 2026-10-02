import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatDay } from '../src/core/days.ts';
import { formFor, niceTicks, relativeTicks } from '../semgraphs/movingWindowAverage/chart.ts';
import { compute, sampleStandardDeviation } from '../semgraphs/movingWindowAverage/compute.ts';
import type { MovingWindowAverageRequest } from '../semgraphs/movingWindowAverage/types.ts';
import { NOW, series } from './helpers.ts';

function request(overrides: Partial<MovingWindowAverageRequest>): MovingWindowAverageRequest {
  return {
    semgraph: 'movingWindowAverage',
    metric: 'test',
    measureType: 'additive',
    window: 7,
    horizon: 3,
    data: [],
    ...overrides,
  };
}

const close = (actual: number | null, expected: number) =>
  assert.ok(actual !== null && Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

describe('movingWindowAverage compute', () => {
  it('computes mean and sample sd over the window that ends on each day', () => {
    const result = compute(
      request({ window: 3, horizon: 3, data: series('2026-09-30', [1, 2, 3, 4, 5, 6, 8, 10, 12]) }),
      { now: NOW },
    );
    const [first, second, last] = result.points;
    close(first!.mean, (5 + 6 + 8) / 3);
    close(second!.mean, (6 + 8 + 10) / 3);
    close(last!.mean, (8 + 10 + 12) / 3);
    close(last!.sd, 2); // values 8, 10, 12: mean 10, squares 4 + 0 + 4, n - 1 = 2
  });

  it('uses n - 1, like STDDEV in BigQuery', () => {
    close(sampleStandardDeviation([2, 4, 4, 4, 5, 5, 7, 9]), Math.sqrt(32 / 7));
  });

  it('is strict: one missing day removes every window that contains it', () => {
    const values = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
    values[10] = null as unknown as number;
    const result = compute(request({ window: 3, horizon: 7, data: series('2026-09-30', values) }), { now: NOW });
    // Day index 10 is rel -3; the windows ending at rel -3, -2 and -1 contain it.
    assert.deepEqual(result.missing, [-3, -2, -1]);
    assert.deepEqual(result.points.map((point) => point.rel), [-6, -5, -4, 0]);
  });

  it('treats an absent day like a null, never as zero', () => {
    const data = series('2026-09-30', [5, 5, 5, 5, 5, 5, 5]).filter((point) => point.day !== '2026-09-28');
    const result = compute(request({ window: 2, horizon: 4, data }), { now: NOW });
    assert.deepEqual(result.missing, [-2, -1]);
    for (const point of result.points) close(point.mean, 5);
  });

  it('never uses the running day in Brussels as "today"', () => {
    // Data up to and including 1 October, while it is 1 October: the reference day is 30 September.
    const result = compute(request({ window: 2, horizon: 2, data: series('2026-10-01', [1, 2, 3, 4]) }), { now: NOW });
    assert.equal(formatDay(result.reference), '2026-09-30');
    assert.equal(result.referenceIsYesterday, true);
    assert.equal(result.ignoredAfterReference, 1);
  });

  it('knows when the reference day is older than yesterday', () => {
    const result = compute(request({ window: 2, horizon: 2, data: series('2026-09-20', [1, 2, 3]) }), { now: NOW });
    assert.equal(formatDay(result.reference), '2026-09-20');
    assert.equal(result.referenceIsYesterday, false);
  });

  it('counts the values in the range the chart uses', () => {
    const result = compute(request({ window: 7, horizon: 28, data: series('2026-09-30', Array(40).fill(1)) }), { now: NOW });
    assert.equal(formatDay(result.rangeStart), '2026-08-28'); // 28 + 7 - 1 = 34 days up to 30 September
    assert.equal(result.valuesInRange, 34);
  });

  it('leaves the spread out when spread is none', () => {
    const result = compute(request({ window: 2, horizon: 2, spread: 'none', data: series('2026-09-30', [1, 2, 3]) }), { now: NOW });
    assert.equal(result.points.every((point) => point.sd === null), true);
  });
});

describe('movingWindowAverage axes', () => {
  it('labels the time axis in steps of the window', () => {
    assert.deepEqual(relativeTicks(28, 7), [-21, -14, -7, 0]);
    assert.deepEqual(relativeTicks(28, 10), [-20, -10, 0]);
  });

  it('falls back to steps of 7 when the horizon is shorter than two windows', () => {
    assert.deepEqual(relativeTicks(20, 14), [-14, -7, 0]);
  });

  it('always shows at least two ticks', () => {
    assert.deepEqual(relativeTicks(7, 7), [-6, 0]);
  });

  it('thins out the time axis to at most eight labels, in multiples of the window', () => {
    assert.deepEqual(relativeTicks(182, 7), [-168, -140, -112, -84, -56, -28, 0]);
    assert.deepEqual(relativeTicks(364, 7), [-273, -182, -91, 0]);
    assert.ok(relativeTicks(728, 7).length <= 8);
  });

  it('draws a dot per day while there is room, and a line with a band beyond that', () => {
    assert.equal(formFor(28), 'dots');
    assert.equal(formFor(56), 'dots');
    assert.equal(formFor(91), 'line');
    assert.equal(formFor(728), 'line');
  });

  it('chooses round value ticks from zero', () => {
    assert.deepEqual(niceTicks(57.3), [0, 20, 40, 60]);
    assert.deepEqual(niceTicks(9), [0, 2.5, 5, 7.5, 10]);
    assert.deepEqual(niceTicks(0), [0, 1]);
    assert.deepEqual(niceTicks(1840), [0, 500, 1000, 1500, 2000]);
  });
});

describe('movingWindowAverage against BigQuery', () => {
  it('gives the same mean and sd as AVG and STDDEV over a 7-day window in BigQuery', async () => {
    const { readFile } = await import('node:fs/promises');
    const { rows } = JSON.parse(await readFile(new URL('./fixtures/bigquery-basic.json', import.meta.url), 'utf8')) as {
      rows: [string, number, number][];
    };
    const basic = JSON.parse(
      await readFile(new URL('../semgraphs/movingWindowAverage/examples/basic.json', import.meta.url), 'utf8'),
    ) as MovingWindowAverageRequest;
    const result = compute(basic, { now: NOW });
    assert.equal(result.points.length, rows.length);
    for (const [day, mean, sd] of rows) {
      const point = result.points.find((candidate) => formatDay(candidate.day) === day)!;
      assert.ok(Math.abs(point.mean - mean) < 1e-6, `mean on ${day}: ${point.mean} vs ${mean}`);
      assert.ok(Math.abs(point.sd! - sd) < 1e-6, `sd on ${day}: ${point.sd} vs ${sd}`);
    }
  });
});

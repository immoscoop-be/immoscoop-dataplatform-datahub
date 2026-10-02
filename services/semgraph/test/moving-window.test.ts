import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { relativeTicks, type MovingWindowRequest } from '../src/charts/moving-window-chart.ts';
import { formFor } from '../src/charts/time-axis-chart.ts';
import { formatDay } from '../src/core/days.ts';
import { MovingWindowAverage } from '../semgraphs/movingWindowAverage/index.ts';
import { MovingWindowMedian } from '../semgraphs/movingWindowMedian/index.ts';
import { example, fixture, NOW, series } from './helpers.ts';

const average = new MovingWindowAverage();
const median = new MovingWindowMedian();

function request(overrides: Partial<MovingWindowRequest>): MovingWindowRequest {
  return { semgraph: 'movingWindowAverage', metric: 'test', measureType: 'additive', window: 7, horizon: 3, data: [], ...overrides };
}

const close = (actual: number | undefined, expected: number, what = '') =>
  assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-6, `${what} ${actual} is not ${expected}`);

describe('moving window', () => {
  it('summarizes the window that ends on each day', () => {
    const result = average.compute(request({ window: 3, horizon: 3, data: series('2026-09-30', [1, 2, 3, 4, 5, 6, 8, 10, 12]) }), { now: NOW });
    assert.deepEqual(result.points.map((point) => point.rel), [-2, -1, 0]);
    close(result.points[0]!.centre, (5 + 6 + 8) / 3);
    close(result.points[2]!.centre, 10);
    close(result.points[2]!.spread!.hi - result.points[2]!.centre, 2); // 8, 10, 12: sd 2
    assert.deepEqual(result.points.map((point) => formatDay(point.first)), ['2026-09-26', '2026-09-27', '2026-09-28']);
  });

  it('is strict: one missing day removes every window that contains it', () => {
    const values: (number | null)[] = Array(14).fill(5);
    values[10] = null;
    const result = average.compute(request({ window: 3, horizon: 7, data: series('2026-09-30', values) }), { now: NOW });
    assert.deepEqual(result.missing, [-3, -2, -1]);
    assert.deepEqual(result.points.map((point) => point.rel), [-6, -5, -4, 0]);
  });

  it('treats an absent day like a null, never as zero', () => {
    const data = series('2026-09-30', [5, 5, 5, 5, 5, 5, 5]).filter((point) => point.day !== '2026-09-28');
    const result = average.compute(request({ window: 2, horizon: 4, data }), { now: NOW });
    assert.deepEqual(result.missing, [-2, -1]);
    assert.deepEqual(result.absentDays.map(formatDay), ['2026-09-28']);
  });

  it('never uses the running day in Brussels as "today"', () => {
    const result = average.compute(request({ window: 2, horizon: 2, data: series('2026-10-01', [1, 2, 3, 4]) }), { now: NOW });
    assert.equal(formatDay(result.reference), '2026-09-30');
    assert.equal(result.referenceIsYesterday, true);
    assert.equal(result.ignoredAfterReference, 1);
  });

  it('counts the values in the range the chart uses', () => {
    const result = average.compute(request({ window: 7, horizon: 28, data: series('2026-09-30', Array(40).fill(1)) }), { now: NOW });
    assert.equal(formatDay(result.rangeStart), '2026-08-28'); // 28 + 7 - 1 = 34 days up to 30 September
    assert.equal(result.valuesInRange, 34);
    assert.equal(result.points.every((point) => !point.running), true);
  });

  it('gives the same mean and sd as AVG and STDDEV over a 7-day window in BigQuery', async () => {
    const { rows } = await fixture<{ rows: [string, number, number][] }>('bigquery-moving-average.json');
    const result = average.compute((await example('basic')) as unknown as MovingWindowRequest, { now: NOW });
    assert.equal(result.points.length, rows.length);
    for (const [day, mean, sd] of rows) {
      const point = result.points.find((candidate) => formatDay(candidate.last) === day)!;
      close(point.centre, mean, `mean on ${day}`);
      close(point.spread!.hi - point.centre, sd, `sd on ${day}`);
    }
  });

  it('gives the same median and quartiles as PERCENTILE_CONT over a 7-day window in BigQuery', async () => {
    const { rows } = await fixture<{ rows: [string, number, number, number][] }>('bigquery-moving-median.json');
    const result = median.compute((await example('basic', 'movingWindowMedian')) as unknown as MovingWindowRequest, { now: NOW });
    for (const [day, p25, p50, p75] of rows) {
      const point = result.points.find((candidate) => formatDay(candidate.last) === day)!;
      close(point.centre, p50, `median on ${day}`);
      close(point.spread!.lo, p25, `P25 on ${day}`);
      close(point.spread!.hi, p75, `P75 on ${day}`);
    }
  });

  it('labels the time axis in steps of the window, at most eight labels', () => {
    assert.deepEqual(relativeTicks(28, 7), [-21, -14, -7, 0]);
    assert.deepEqual(relativeTicks(28, 10), [-20, -10, 0]);
    assert.deepEqual(relativeTicks(20, 14), [-14, -7, 0]); // shorter than two windows: steps of 7
    assert.deepEqual(relativeTicks(182, 7), [-168, -140, -112, -84, -56, -28, 0]);
    assert.deepEqual(relativeTicks(364, 7), [-273, -182, -91, 0]);
  });

  it('draws dots while there is room for the bar, and a line with a band beyond that', () => {
    assert.equal(formFor(28, 4), 'dots');
    assert.equal(formFor(56, 4), 'dots');
    assert.equal(formFor(91, 4), 'line');
    // A median's wide bar needs more room per day.
    assert.equal(formFor(56, 9), 'line');
    assert.equal(formFor(28, 9), 'dots');
  });
});

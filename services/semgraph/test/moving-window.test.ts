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
  it('summarizes blocks of `window` days that do not overlap, the last one ending on the last complete day (REQ-018)', () => {
    const result = average.compute(request({ window: 3, horizon: 3, data: series('2026-09-30', [1, 2, 3, 4, 5, 6, 8, 10, 12]) }), { now: NOW });
    assert.deepEqual(result.points.map((point) => point.rel), [-2, -1, 0]);
    close(result.points[0]!.centre, 2);
    close(result.points[1]!.centre, 5);
    close(result.points[2]!.centre, 10);
    close(result.points[2]!.spread!.hi - result.points[2]!.centre, 2); // 8, 10, 12: sd 2
    assert.deepEqual(result.points.map((point) => formatDay(point.first)), ['2026-09-22', '2026-09-25', '2026-09-28']);
    assert.deepEqual(result.points.map((point) => formatDay(point.last)), ['2026-09-24', '2026-09-27', '2026-09-30']);
  });

  it('is strict: a missing day removes the block that contains it, and only that one', () => {
    const values: (number | null)[] = Array(12).fill(5);
    values[7] = null;
    const result = average.compute(request({ window: 3, horizon: 4, data: series('2026-09-30', values) }), { now: NOW });
    assert.deepEqual(result.missing, [-1]);
    assert.deepEqual(result.points.map((point) => point.rel), [-3, -2, 0]);
  });

  it('treats an absent day like a null, never as zero', () => {
    const data = series('2026-09-30', [5, 5, 5, 5, 5, 5, 5, 5]).filter((point) => point.day !== '2026-09-28');
    const result = average.compute(request({ window: 2, horizon: 4, data }), { now: NOW });
    assert.deepEqual(result.missing, [-1]);
    assert.deepEqual(result.absentDays.map(formatDay), ['2026-09-28']);
  });

  it('never uses the running day in Brussels as "today"', () => {
    const result = average.compute(request({ window: 2, horizon: 2, data: series('2026-10-01', [1, 2, 3, 4]) }), { now: NOW });
    assert.equal(formatDay(result.reference), '2026-09-30');
    assert.equal(result.referenceIsYesterday, true);
    assert.equal(result.ignoredAfterReference, 1);
  });

  it('counts the values in the range the chart uses: horizon times window days', () => {
    const result = average.compute(request({ window: 7, horizon: 4, data: series('2026-09-30', Array(40).fill(1)) }), { now: NOW });
    assert.equal(formatDay(result.rangeStart), '2026-09-03');
    assert.equal(result.valuesInRange, 28);
    assert.equal(result.points.every((point) => !point.running), true);
  });

  it('shows the daily values for a window of one day, without spread and without deviation (REQ-020)', () => {
    const result = average.compute(request({ window: 1, horizon: 5, data: series('2026-09-30', [3, 4, 5, 6, 7]) }), { now: NOW });
    assert.deepEqual(result.points.map((point) => point.centre), [3, 4, 5, 6, 7]);
    assert.ok(result.points.every((point) => point.spread === null));
    assert.equal(result.withSpread, false);
    assert.equal(result.spreadOmitted, false);
    const medianResult = median.compute(request({ semgraph: 'movingWindowMedian', window: 1, horizon: 5, data: series('2026-09-30', [3, 4, 5, 6, 7]) }), { now: NOW });
    assert.ok(medianResult.points.every((point) => point.spread === null));
  });

  it('gives the same mean and sd as AVG and STDDEV over a 7-day window in BigQuery', async () => {
    const { rows } = await fixture<{ rows: [string, number, number][] }>('bigquery-moving-average.json');
    const result = average.compute((await example('basic')) as unknown as MovingWindowRequest, { now: NOW });
    const checked = rows.filter(([day, mean, sd]) => {
      const point = result.points.find((candidate) => formatDay(candidate.last) === day);
      if (!point) return false;
      close(point.centre, mean, `mean on ${day}`);
      close(point.spread!.hi - point.centre, sd, `sd on ${day}`);
      return true;
    });
    assert.equal(checked.length, 4);
  });

  it('gives the same median and quartiles as PERCENTILE_CONT over a 7-day window in BigQuery', async () => {
    const { rows } = await fixture<{ rows: [string, number, number, number][] }>('bigquery-moving-median.json');
    const result = median.compute((await example('basic', 'movingWindowMedian')) as unknown as MovingWindowRequest, { now: NOW });
    const checked = rows.filter(([day, p25, p50, p75]) => {
      const point = result.points.find((candidate) => formatDay(candidate.last) === day);
      if (!point) return false;
      close(point.centre, p50, `median on ${day}`);
      close(point.spread!.lo, p25, `P25 on ${day}`);
      close(point.spread!.hi, p75, `P75 on ${day}`);
      return true;
    });
    assert.ok(checked.length >= 4);
  });

  it('labels every window, or every 2, 4, 13, 26 or 52 windows; daily values per week', () => {
    assert.deepEqual(relativeTicks(7, 7), [-6, -5, -4, -3, -2, -1, 0]);
    assert.deepEqual(relativeTicks(7, 1), [-6, -5, -4, -3, -2, -1, 0]);
    assert.deepEqual(relativeTicks(28, 1), [-21, -14, -7, 0]);
    assert.deepEqual(relativeTicks(26, 7), [-24, -20, -16, -12, -8, -4, 0]);
    assert.deepEqual(relativeTicks(78, 7), [-65, -52, -39, -26, -13, 0]);
  });

  it('draws a bar under every point while there is room for it, and a band along the line beyond that (REQ-011)', () => {
    assert.equal(formFor(28, 4), 'bars');
    assert.equal(formFor(56, 4), 'bars');
    assert.equal(formFor(91, 4), 'band');
    // A median's wide bar needs more room per point.
    assert.equal(formFor(56, 9), 'band');
    assert.equal(formFor(28, 9), 'bars');
  });
});

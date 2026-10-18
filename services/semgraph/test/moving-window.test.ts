import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { relativeTicks, type MovingWindowRequest } from '../src/charts/moving-window-chart.ts';
import type { BlockRow } from '../src/charts/statistics.ts';
import { formFor } from '../src/charts/time-axis-chart.ts';
import { formatDay } from '../src/core/days.ts';
import { MovingWindowAverage } from '../semgraphs/movingWindowAverage/index.ts';
import { MovingWindowMedian } from '../semgraphs/movingWindowMedian/index.ts';
import { example, fixture, NOW } from './helpers.ts';

const average = new MovingWindowAverage();
const median = new MovingWindowMedian();

function request(overrides: Partial<MovingWindowRequest>): MovingWindowRequest {
  return { semgraph: 'movingWindowAverage', metric: 'test', measureType: 'additive', window: 7, points: [], ...overrides };
}

/** Windows of `window` days, the last one ending on `end`, with the given means (null: no data). */
function windows(end: string, window: number, means: (number | null)[], extra: Partial<BlockRow> = {}): BlockRow[] {
  const last = Date.parse(`${end}T00:00:00Z`);
  return means.map((mean, index) => ({
    end: new Date(last - (means.length - 1 - index) * window * 86_400_000).toISOString().slice(0, 10),
    mean,
    ...(mean === null ? {} : extra),
  }));
}

const codes = (issues: { code: string }[]) => issues.map((issue) => issue.code);

describe('moving window', () => {
  it('takes one row per window, named after its last day; windows touch but never overlap (REQ-029, REQ-062)', () => {
    const result = average.compute(request({ window: 3, points: windows('2026-09-30', 3, [2, 5, 10], { sd: 2 }) }), { now: NOW });
    assert.deepEqual(result.points.map((point) => point.rel), [-2, -1, 0]);
    assert.deepEqual(result.points.map((point) => point.centre), [2, 5, 10]);
    assert.deepEqual(result.points.at(-1)!.spread, { lo: 8, hi: 12 });
    assert.deepEqual(result.points.map((point) => formatDay(point.first)), ['2026-09-22', '2026-09-25', '2026-09-28']);
    assert.deepEqual(result.points.map((point) => formatDay(point.last)), ['2026-09-24', '2026-09-27', '2026-09-30']);
    assert.equal(result.daysWithData, 9);
  });

  it('a window without data is empty, never zero: a null row or a window left out', () => {
    const withNull = average.compute(request({ window: 3, points: windows('2026-09-30', 3, [5, 5, null, 5]) }), { now: NOW });
    assert.deepEqual(withNull.missing, [-1]);
    assert.deepEqual(withNull.points.map((point) => point.rel), [-3, -2, 0]);
    const leftOut = windows('2026-09-30', 3, [5, 5, 5, 5]).filter((_, index) => index !== 2);
    assert.deepEqual(average.compute(request({ window: 3, points: leftOut }), { now: NOW }).missing, [-1]);
  });

  it('refuses windows that overlap or leave a gap that is not a whole window (REQ-029)', () => {
    const points = [{ end: '2026-09-23', mean: 4 }, { end: '2026-09-27', mean: 5 }, { end: '2026-09-30', mean: 6 }];
    assert.deepEqual(average.check(request({ points })).map((issue) => [issue.code, issue.field]), [['windowsNotAligned', '/points/1/end']]);
  });

  it('refuses more than 1000 blocks from the first to the last, gaps included', () => {
    const points = [{ end: '2020-01-01', mean: 4 }, { end: '2026-09-30', mean: 5 }];
    assert.deepEqual(average.check(request({ window: 1, points })).map((issue) => [issue.code, issue.params]), [['tooManyBlocks', { count: 2465, max: 1000 }]]);
    // The same span in windows of 7 days is 352 blocks.
    assert.deepEqual(average.check(request({ window: 7, points: [{ end: '2020-01-01', mean: 4 }, { end: '2026-09-23', mean: 5 }] })), []);
  });

  it('refuses a window named twice, and a day that does not exist', () => {
    const points = [{ end: '2026-09-23', mean: 4 }, { end: '2026-09-23', mean: 5 }, { end: '2026-09-31', mean: 6 }];
    assert.deepEqual(average.check(request({ points })).map((issue) => [issue.code, issue.field]), [
      ['duplicateBlock', '/points/1/end'],
      ['invalidDate', '/points/2/end'],
    ]);
  });

  it('only takes the fields of its statistic, and a spread on every window or on none', () => {
    const points: BlockRow[] = [{ end: '2026-09-23', mean: 4, sd: 1 }, { end: '2026-09-30', mean: 5, median: 5 }];
    assert.deepEqual(average.check(request({ points })).map((issue) => [issue.code, issue.field]), [
      ['fieldNotForStatistic', '/points/1/median'],
      ['spreadIncomplete', '/points/1'],
    ]);
    const period = [{ end: '2026-09-30', period: '2026-W40', mean: 5 }];
    assert.deepEqual(codes(average.check(request({ points: period }))), ['unexpectedField']);
  });

  it('a median takes P25 and P75 together, around the median', () => {
    const rows = (p25?: number, p75?: number): BlockRow[] => [{ end: '2026-09-30', median: 5, ...(p25 === undefined ? {} : { p25 }), ...(p75 === undefined ? {} : { p75 }) }];
    const check = (points: BlockRow[]) => median.check(request({ semgraph: 'movingWindowMedian', points })).map((issue) => [issue.code, issue.field]);
    assert.deepEqual(check(rows(3)), [['spreadPartial', '/points/0/p75']]);
    assert.deepEqual(check(rows(6, 8)), [['spreadOrder', '/points/0']]);
    assert.deepEqual(check(rows(3, 8)), []);
  });

  it('the last complete day is yesterday in Brussels, or asOf; a window that ends after it is refused', () => {
    const now = average.compute(request({ points: windows('2026-09-30', 7, [1, 2]) }), { now: NOW });
    assert.equal(formatDay(now.reference), '2026-09-30');
    assert.equal(now.referenceIsYesterday, true);
    assert.deepEqual(now.blocksAfterReference, []);
    const older = average.compute(request({ asOf: '2026-09-23', points: windows('2026-09-23', 7, [1, 2]) }), { now: NOW });
    assert.equal(formatDay(older.reference), '2026-09-23');
    assert.equal(older.referenceIsYesterday, false);
    const after = average.compute(request({ points: windows('2026-10-01', 7, [1, 2]) }), { now: NOW });
    assert.deepEqual(after.blocksAfterReference, ['2026-10-01']);
  });

  it('shows the daily values for a window of one day, without spread and without deviation (REQ-031)', () => {
    const result = average.compute(request({ window: 1, points: windows('2026-09-30', 1, [3, 4, 5, 6, 7], { sd: 1 }) }), { now: NOW });
    assert.deepEqual(result.points.map((point) => point.centre), [3, 4, 5, 6, 7]);
    assert.ok(result.points.every((point) => point.spread === null));
    assert.equal(result.withSpread, false);
    assert.equal(result.spreadOmitted, false);
  });

  it('the examples carry what AVG and STDDEV over a 7-day window give in BigQuery (REQ-058)', async () => {
    const { rows } = await fixture<{ rows: [string, number, number][] }>('bigquery-moving-average.json');
    const result = average.compute((await example('basic')) as unknown as MovingWindowRequest, { now: NOW });
    const checked = rows.filter(([day, mean, sd]) => {
      const point = result.points.find((candidate) => formatDay(candidate.last) === day);
      if (!point) return false;
      assert.ok(Math.abs(point.centre - mean) < 1e-4, `mean on ${day}`);
      assert.ok(Math.abs(point.spread!.hi - point.centre - sd) < 1e-4, `sd on ${day}`);
      return true;
    });
    assert.equal(checked.length, 4);
  });

  it('the examples carry what PERCENTILE_CONT over a 7-day window gives in BigQuery (REQ-058)', async () => {
    const { rows } = await fixture<{ rows: [string, number, number, number][] }>('bigquery-moving-median.json');
    const result = median.compute((await example('basic', 'movingWindowMedian')) as unknown as MovingWindowRequest, { now: NOW });
    const checked = rows.filter(([day, p25, p50, p75]) => {
      const point = result.points.find((candidate) => formatDay(candidate.last) === day);
      if (!point) return false;
      assert.deepEqual([point.spread!.lo, point.centre, point.spread!.hi], [p25, p50, p75], day);
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

  it('draws a bar under every point while there is room for it, and a band along the line beyond that (REQ-022)', () => {
    assert.equal(formFor(28, 4), 'bars');
    assert.equal(formFor(56, 4), 'bars');
    assert.equal(formFor(91, 4), 'band');
    // A median's wide bar needs more room per point.
    assert.equal(formFor(56, 9), 'band');
    assert.equal(formFor(28, 9), 'bars');
  });
});

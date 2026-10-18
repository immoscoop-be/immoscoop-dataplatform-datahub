import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CalendarRequest } from '../src/charts/calendar-chart.ts';
import { formatDay } from '../src/core/days.ts';
import { color } from '../src/core/tokens.ts';
import { runPipeline } from '../src/core/pipeline.ts';
import { CalendarAverage } from '../semgraphs/calendarAverage/index.ts';
import { example, fixture, NOW, testRegistry } from './helpers.ts';

const average = new CalendarAverage();

const close = (actual: number | undefined, expected: number, what = '', tolerance = 1e-6) =>
  assert.ok(actual !== undefined && Math.abs(actual - expected) < tolerance, `${what} ${actual} is not ${expected}`);

async function weeks(overrides: Partial<CalendarRequest> = {}): Promise<CalendarRequest> {
  return { ...((await example('weeks', 'calendarAverage')) as unknown as CalendarRequest), ...overrides };
}

describe('calendar periods chart', () => {
  it('ends with the period of the last complete day, and marks it running while it is not over', async () => {
    const result = average.compute(await weeks(), { now: NOW });
    assert.equal(result.slots.length, 12);
    const last = result.slots.at(-1)!;
    assert.equal(formatDay(last.first), '2026-09-28'); // ISO week 40 starts on Monday 28 September
    assert.equal(formatDay(last.last), '2026-09-30'); // the reference day, a Wednesday
    assert.equal(formatDay(last.fullLast), '2026-10-04');
    assert.equal(last.running, true);
    assert.equal(result.slots.slice(0, -1).some((slot) => slot.running), false);
  });

  it('a period that ends on the reference day is complete, so filled', async () => {
    const months = (await example('months', 'calendarAverage')) as unknown as CalendarRequest;
    const result = average.compute(months, { now: NOW });
    const last = result.points.at(-1)!;
    assert.equal(formatDay(last.first), '2026-09-01');
    assert.equal(last.running, false);
    assert.equal(last.days, 30);
  });

  it('the weekly example carries what AVG and STDDEV per ISO week give in BigQuery (REQ-058)', async () => {
    const { rows } = await fixture<{ rows: [string, number, number, number, number, number, number, number][] }>('bigquery-iso-weeks.json');
    const means = average.compute(await weeks(), { now: NOW });
    const checked = rows.filter(([start, , days, mean, sd]) => {
      const point = means.points.find((candidate) => formatDay(candidate.first) === start);
      if (!point) return false;
      assert.equal(point.days, days, `days of week ${start}`);
      close(point.centre, mean, `mean of week ${start}`, 1e-4);
      close(point.spread!.hi - point.centre, sd, `sd of week ${start}`, 1e-4);
      return true;
    });
    assert.equal(checked.length, 12);
  });

  it('takes one row per period, named by its ISO name, and fills the periods in between as empty (REQ-062)', async () => {
    const base = await weeks();
    const slots = (unit: CalendarRequest['unit'], points: { period: string; mean: number }[]) =>
      average.compute({ ...base, unit, points }, { now: NOW }).slots.map((slot) => `${formatDay(slot.first)}/${formatDay(slot.fullLast)}`);
    assert.deepEqual(slots('month', [{ period: '2026-07', mean: 1 }, { period: '2026-09', mean: 1 }]), ['2026-07-01/2026-07-31', '2026-08-01/2026-08-31', '2026-09-01/2026-09-30']);
    assert.deepEqual(slots('quarter', [{ period: '2026-Q2', mean: 1 }, { period: '2026-Q3', mean: 1 }]), ['2026-04-01/2026-06-30', '2026-07-01/2026-09-30']);
    assert.deepEqual(slots('year', [{ period: '2025', mean: 1 }, { period: '2026', mean: 1 }]), ['2025-01-01/2025-12-31', '2026-01-01/2026-12-31']);
    const gap = average.compute({ ...base, points: [{ period: '2026-W38', mean: 1 }, { period: '2026-W40', mean: 1 }] }, { now: NOW });
    assert.deepEqual(gap.missing, [-1]);
  });

  it('refuses a name that is not a period of the unit, and a period named twice', async () => {
    const check = async (points: { period: string; mean: number }[]) => average.check({ ...(await weeks()), points }).map((issue) => [issue.code, issue.field]);
    assert.deepEqual(await check([{ period: '2025-W53', mean: 1 }, { period: '2026-09', mean: 1 }]), [
      ['invalidPeriod', '/points/0/period'],
      ['invalidPeriod', '/points/1/period'],
    ]);
    assert.deepEqual(await check([{ period: '2026-W39', mean: 1 }, { period: '2026-W39', mean: 2 }]), [['duplicateBlock', '/points/1/period']]);
    assert.deepEqual(await check([{ period: '2000-W01', mean: 1 }, { period: '2026-W39', mean: 2 }]), [['tooManyBlocks', '/points']]);
    const months = average.check({ ...(await weeks()), unit: 'month', points: [{ period: '2000-01', mean: 1 }, { period: '2026-09', mean: 2 }] });
    assert.deepEqual(months, []); // 321 months
    const result = await runPipeline(await testRegistry(), { ...(await weeks()), points: [{ period: '2026-13', mean: 1 }] }, { now: NOW, draw: false });
    assert.match(result.report.issues[0]!.message, /2026-13 is geen geldige week/);
  });

  it('a running period may close the chart, but a period that has not started is refused', async () => {
    const points = [...(await weeks()).points, { period: '2026-W41', mean: 50, sd: 3 }];
    const result = await runPipeline(await testRegistry(), await weeks({ points }), { now: NOW, draw: false });
    assert.deepEqual(result.report.issues.map((issue) => issue.code), ['blockAfterReference']);
    assert.match(result.report.issues[0]!.message, /2026-W41/);
  });

  it('marks the running period with its pattern and says so, on the label and on hover', async () => {
    const { svg } = await runPipeline(await testRegistry(), await weeks(), { now: NOW });
    // REQ-033: the last final week in bold with its spread, the running week next to it in grey;
    // "lopend" under the running point (REQ-000).
    assert.match(svg!, /font-weight="bold"[^>]*>44,0</);
    assert.match(svg!, />± 12,4</);
    assert.match(svg!, /fill="#6b7480"[^>]*>53,7</);
    assert.match(svg!, />lopend</);
    assert.match(svg!, /aria-label="week 40 \(28 sep–4 okt\), gemiddelde per dag: 53,7, ±1 sd: 2,1, lopend: 3 van 7 dagen"/);
    // REQ-052: the running week keeps a filled diamond; its column gets the running pattern.
    assert.doesNotMatch(svg!, /fill="#ffffff" stroke="#dd2c88"/);
    assert.equal([...svg!.matchAll(/fill="url\(#semgraph-running-[0-9a-f]{8}\)"/g)].length, 1);
  });

  it('labels weeks, months and quarters, with the year where it changes', async () => {
    const { svg: weekly } = await runPipeline(await testRegistry(), await weeks(), { now: NOW });
    // The year on a second line, on the first label and at a year change (REQ-000).
    const twoLines = (label: string, year: string) => new RegExp(`<tspan>${label}</tspan><tspan x="0" dy="12">${year}</tspan>`);
    const baseline = color((await testRegistry()).tokens, 'baseline');
    const yearTicks = (svg: string) =>
      [...svg.matchAll(new RegExp(`<line transform="translate\\([-\\d.]+,196\\)" x2="0" y2="12" stroke="${baseline}"`, 'g'))].length;
    assert.match(weekly!, twoLines('W29', '2026'));
    assert.match(weekly!, />W40</);
    assert.equal(yearTicks(weekly!), 0);
    const { svg: monthly } = await runPipeline(await testRegistry(), await example('months', 'calendarAverage'), { now: NOW });
    assert.match(monthly!, twoLines('okt', '2025'));
    assert.match(monthly!, twoLines('jan', '2026'));
    assert.match(monthly!, />sep</);
    // A longer, darker tick at the year change, between December and January.
    assert.equal(yearTicks(monthly!), 1);
    const { svg: quarterly } = await runPipeline(await testRegistry(), await example('quarters', 'calendarMedian'), { now: NOW });
    assert.match(quarterly!, twoLines('K1', '2026'));
    assert.match(quarterly!, />K3</);
    assert.equal(yearTicks(quarterly!), 1);
    assert.match(quarterly!, /mediaan per dag, per kwartaal · P25–P75/);
  });
});

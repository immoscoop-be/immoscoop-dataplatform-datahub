import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CalendarRequest } from '../src/charts/calendar-chart.ts';
import { formatDay } from '../src/core/days.ts';
import { runPipeline } from '../src/core/pipeline.ts';
import { CalendarAverage } from '../semgraphs/calendarAverage/index.ts';
import { CalendarMedian } from '../semgraphs/calendarMedian/index.ts';
import { example, fixture, NOW, testRegistry } from './helpers.ts';

const average = new CalendarAverage();
const median = new CalendarMedian();

const close = (actual: number | undefined, expected: number, what = '') =>
  assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-6, `${what} ${actual} is not ${expected}`);

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

  it('gives the same mean, sd, median and quartiles per ISO week as BigQuery', async () => {
    const { rows } = await fixture<{ rows: [string, number, number, number, number, number, number, number][] }>('bigquery-iso-weeks.json');
    const request = await weeks({ horizon: 14 });
    const means = average.compute(request, { now: NOW });
    const medians = median.compute({ ...request, semgraph: 'calendarMedian', spread: 'iqr' }, { now: NOW });
    for (const [start, , days, mean, sd, p25, p50, p75] of rows) {
      const byStart = (point: { first: number }) => formatDay(point.first) === start;
      const meanPoint = means.points.find(byStart);
      if (days < 7 && start < '2026-07-01') {
        // Week 27 starts before the data: strict, so it has no point at all.
        assert.equal(meanPoint, undefined);
        continue;
      }
      assert.equal(meanPoint!.days, days);
      close(meanPoint!.centre, mean, `mean of week ${start}`);
      close(meanPoint!.spread!.hi - meanPoint!.centre, sd, `sd of week ${start}`);
      const medianPoint = medians.points.find(byStart)!;
      close(medianPoint.centre, p50, `median of week ${start}`);
      close(medianPoint.spread!.lo, p25, `P25 of week ${start}`);
      close(medianPoint.spread!.hi, p75, `P75 of week ${start}`);
    }
  });

  it('builds months, quarters and years from the calendar', async () => {
    const request = await weeks();
    const slots = (unit: CalendarRequest['unit'], horizon: number) =>
      average.compute({ ...request, unit, horizon }, { now: NOW }).slots.map((slot) => `${formatDay(slot.first)}/${formatDay(slot.fullLast)}`);
    assert.deepEqual(slots('month', 3), ['2026-07-01/2026-07-31', '2026-08-01/2026-08-31', '2026-09-01/2026-09-30']);
    assert.deepEqual(slots('quarter', 2), ['2026-04-01/2026-06-30', '2026-07-01/2026-09-30']);
    assert.deepEqual(slots('year', 2), ['2025-01-01/2025-12-31', '2026-01-01/2026-12-31']);
  });

  it('refuses when not a single period is complete', async () => {
    const result = await runPipeline(await testRegistry(), await weeks({ unit: 'year', horizon: 2 }), { now: NOW, draw: false });
    // The data starts in July, so neither 2025 nor 2026 is complete.
    assert.deepEqual(result.report.issues.map((issue) => issue.code), ['noCompletePeriod']);
    assert.match(result.report.issues[0]!.message, /Er is geen enkel jaar volledig/);
  });

  it('draws the running period hollow and says so, on the label and on hover', async () => {
    const { svg } = await runPipeline(await testRegistry(), await weeks(), { now: NOW });
    // REQ-033: the last final week in bold with its spread, the running week next to it in grey;
    // "lopend" under the running point (REQ-000).
    assert.match(svg!, /font-weight="bold"[^>]*>44,0</);
    assert.match(svg!, />± 12,4</);
    assert.match(svg!, /fill="#6b7480"[^>]*>53,7</);
    assert.match(svg!, />lopend</);
    assert.match(svg!, /aria-label="week 40 \(28 sep–4 okt\), gemiddelde per dag: 53,7, ±1 sd: 2,1, lopend: 3 van 7 dagen"/);
    // One hollow dot: filled with the surface colour, outlined in the focus colour.
    assert.equal([...svg!.matchAll(/fill="#ffffff" stroke="#dd2c88"/g)].length, 1);
  });

  it('labels weeks, months and quarters, with the year where it changes', async () => {
    const { svg: weekly } = await runPipeline(await testRegistry(), await weeks(), { now: NOW });
    // The year on a second line, on the first label and at a year change (REQ-000).
    const twoLines = (label: string, year: string) => new RegExp(`<tspan>${label}</tspan><tspan x="0" dy="12">${year}</tspan>`);
    const yearTicks = (svg: string) => [...svg.matchAll(/<line transform="translate\([-\d.]+,196\)" x2="0" y2="12" stroke="#3c444e"/g)].length;
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

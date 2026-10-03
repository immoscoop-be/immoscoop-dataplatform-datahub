import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runPipeline } from '../src/core/pipeline.ts';
import { example, NOW, testRegistry } from './helpers.ts';

async function run(request: unknown) {
  return runPipeline(await testRegistry(), request, { now: NOW });
}

const codes = (result: Awaited<ReturnType<typeof run>>) => result.report.issues.map((issue) => issue.code);

describe('periodComparison', () => {
  it('wants either window or unit, not both and not neither', async () => {
    const weeks = await example('weeks-sum', 'periodComparison');
    assert.deepEqual(codes(await run({ ...weeks, window: 7 })), ['windowOrUnit']);
    const { unit: _, ...neither } = weeks;
    assert.deepEqual(codes(await run(neither)), ['windowOrUnit']);
  });

  it('only allows the spread that belongs to the statistic: none for a total', async () => {
    const result = await run({ ...(await example('weeks-sum', 'periodComparison')), spread: 'stddev' });
    assert.equal(result.report.outcome, 'invalid');
    assert.match(result.report.issues[0]!.message, /spread moet een van deze waarden zijn: none/);
  });

  it('refuses a total of daily uniques: someone who comes back would count several times', async () => {
    const result = await run({ ...(await example('weeks-sum', 'periodComparison')), measureType: 'unique', uniqueAggregation: 'daily' });
    assert.deepEqual(codes(result), ['uniquesOverPeriodNotDerivable']);
    assert.match(result.report.issues[0]!.message, /Unieken over een week/);
  });

  it('refuses when the data does not reach back to the period before the screen', async () => {
    const request = await example('weeks-sum', 'periodComparison');
    const data = (request.data as { day: string }[]).filter((row) => row.day >= '2026-07-13');
    const result = await run({ ...request, data });
    assert.deepEqual(codes(result), ['noComparisonData']);
    assert.match(result.report.issues[0]!.message, /van 2026-04-20 tot 2026-07-12/);
  });

  it('compares a running week with as many days of its earlier week', async () => {
    const result = await run(await example('weeks-sum', 'periodComparison'));
    // Week 40 has run three days (28–30 September); it is compared with the first three days of week 28.
    assert.match(result.svg!, /week 40 \(28 sep–4 okt\), som: 161, lopend: 3 van 7 dagen, vorige periode, week 28 \(6–12 jul\): 135/);
    assert.match(result.svg!, />som per week · tegenover vorige 12 weken</);
    assert.match(result.svg!, />vorige 12 weken</);
  });

  it('names a comparison of whole years "vorig jaar", and of other spans by their length', async () => {
    const years = await example('years', 'calendarAverage');
    const base = { semgraph: 'periodComparison', metric: 'creditLeads', measureType: 'additive', statistic: 'mean', locale: 'nl-BE', data: years.data };
    assert.match((await run({ ...base, unit: 'month', horizon: 12 })).svg!, />vorig jaar</);
    assert.match((await run({ ...base, unit: 'month', horizon: 6 })).svg!, />vorige 6 maanden</);
    assert.match((await run({ ...base, window: 7, horizon: 52 })).svg!, />vorig jaar</);
    assert.match((await run({ ...base, window: 7, horizon: 8 })).svg!, />vorige 8 weken</);
  });
});

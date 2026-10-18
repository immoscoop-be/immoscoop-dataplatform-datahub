import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { runPipeline } from '../src/core/pipeline.ts';
import { example, NOW, testRegistry } from './helpers.ts';

async function run(request: unknown) {
  return runPipeline(await testRegistry(), request, { now: NOW });
}

const codes = (result: Awaited<ReturnType<typeof run>>) => result.report.issues.map((issue) => [issue.code, issue.field]);

type Row = Record<string, unknown>;

/** Blocks with the same mean now and before the screen, named by `name(index)`. */
const blocks = (count: number, name: (index: number) => string): Row[] =>
  Array.from({ length: count }, (_, index) => ({ [name(index)[0] === 'e' ? 'end' : 'period']: name(index).slice(1), mean: 40, sd: 10, previous: { mean: 42 } }));

describe('periodComparison', () => {
  it('wants either window or unit, not both and not neither', async () => {
    const weeks = await example('weeks-sum', 'periodComparison');
    assert.deepEqual(codes(await run({ ...weeks, window: 7 })), [['windowOrUnit', '/unit']]);
    const { unit: _, ...neither } = weeks;
    assert.deepEqual(codes(await run(neither)), [['windowOrUnit', '/window']]);
  });

  it('each block needs its name and the value of the statistic', async () => {
    const weeks = await example('weeks-sum', 'periodComparison');
    const points = (weeks.points as Row[]).map((row, index) => (index === 2 ? { sum: row.sum } : index === 3 ? { period: row.period } : row));
    assert.deepEqual(codes(await run({ ...weeks, points })), [
      ['missingField', '/points/2/period'],
      ['missingField', '/points/3/sum'],
    ]);
  });

  it('a block only carries the fields of the chosen statistic: a total has no sd', async () => {
    const weeks = await example('weeks-sum', 'periodComparison');
    const points = (weeks.points as Row[]).map((row, index) => (index === 0 ? { ...row, sd: 4, previous: { mean: 3 } } : row));
    const result = await run({ ...weeks, points });
    assert.equal(result.report.outcome, 'invalid');
    assert.deepEqual(codes(result), [
      ['fieldNotForStatistic', '/points/0/sd'],
      ['fieldNotForStatistic', '/points/0/previous'],
    ]);
    assert.match(result.report.issues[0]!.message, /hoort niet bij de statistiek sum/);
  });

  it('refuses when no block carries the value of the period before the screen', async () => {
    const weeks = await example('weeks-sum', 'periodComparison');
    const points = (weeks.points as Row[]).map(({ previous: _, ...row }) => row);
    assert.deepEqual(codes(await run({ ...weeks, points })), [['noComparisonData', '/points']]);
  });

  it('compares a running week with as many days of its earlier week', async () => {
    const result = await run(await example('weeks-sum', 'periodComparison'));
    // Week 40 has run three days (28–30 September); it is compared with the first three days of week 28.
    assert.match(result.svg!, /week 40 \(28 sep–4 okt\), som: 161, lopend: 3 van 7 dagen, vorige periode, week 28 \(6–12 jul\): 135/);
    // The reading cue, on one line or two next to the readout of REQ-105.
    const cue = [...result.svg!.matchAll(/font-style="italic"[^>]*>([^<]*)</g)].map((match) => match[1]).join(' ');
    assert.equal(cue, 'som per week · tegenover vorige 12 weken');
    assert.match(result.svg!, />vorige 12 weken</);
  });

  it('names a comparison of whole years "vorig jaar", and of other spans by their length', async () => {
    const base = { semgraph: 'periodComparison', metric: 'creditLeads', measureType: 'additive', statistic: 'mean', locale: 'nl-BE' };
    const month = (index: number, count: number) => {
      const date = new Date(Date.UTC(2026, 8 - (count - 1 - index), 1));
      return `p${date.toISOString().slice(0, 7)}`;
    };
    const end = (index: number, count: number) => `e${new Date(Date.parse('2026-09-30T00:00:00Z') - (count - 1 - index) * 7 * 86_400_000).toISOString().slice(0, 10)}`;
    assert.match((await run({ ...base, unit: 'month', points: blocks(12, (index) => month(index, 12)) })).svg!, />vorig jaar</);
    assert.match((await run({ ...base, unit: 'month', points: blocks(6, (index) => month(index, 6)) })).svg!, />vorige 6 maanden</);
    assert.match((await run({ ...base, window: 7, points: blocks(52, (index) => end(index, 52)) })).svg!, />vorig jaar</);
    assert.match((await run({ ...base, window: 7, points: blocks(8, (index) => end(index, 8)) })).svg!, />vorige 8 weken</);
  });
});

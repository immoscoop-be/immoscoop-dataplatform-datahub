import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runPipeline } from '../src/core/pipeline.ts';
import { example, NOW, testRegistry } from './helpers.ts';

async function run(request: unknown, draw = true) {
  return runPipeline(await testRegistry(), request, { now: NOW, draw });
}
const codes = (result: Awaited<ReturnType<typeof run>>) => result.report.issues.map((issue) => issue.code);
type Row = Record<string, unknown>;

describe('categoryComparison', () => {
  it('wants exactly one of window, period or day', async () => {
    const { window: _, ...none } = await example('provinces-sum', 'categoryComparison');
    assert.deepEqual(codes(await run(none, false)), ['scopeRequired']);
    assert.deepEqual(codes(await run({ ...(await example('provinces-sum', 'categoryComparison')), day: '2026-09-25' }, false)), ['scopeRequired']);
  });

  it('refuses dates as categories: a date axis is always a line (REQ-001, REQ-002)', async () => {
    const request = await example('provinces-sum', 'categoryComparison');
    const points = [{ category: '2026-09', sum: 4 }, { category: '2026-09-30', sum: 5 }, { category: 'Antwerpen', sum: 6 }];
    const result = await run({ ...request, points }, false);
    assert.deepEqual(result.report.issues.map((issue) => [issue.code, issue.field]), [
      ['categoryIsDate', '/points/0/category'],
      ['categoryIsDate', '/points/1/category'],
    ]);
    assert.match(result.report.issues[0]!.message, /een datumas is altijd een lijn/);
  });

  it('wants the value of the statistic in every row, or null for a category without data', async () => {
    const request = await example('provinces-mean', 'categoryComparison');
    const points = (request.points as Row[]).map((row, index) => (index === 1 ? { category: row.category } : row));
    assert.deepEqual((await run({ ...request, points }, false)).report.issues.map((issue) => [issue.code, issue.field]), [['missingField', '/points/1/mean']]);
  });

  it('refuses a category named twice, and more ordered categories than fit next to each other', async () => {
    const request = await example('provinces-sum', 'categoryComparison');
    assert.deepEqual(codes(await run({ ...request, points: [{ category: 'A', sum: 1 }, { category: 'A', sum: 2 }] }, false)), ['duplicateBlock']);
    const many = Array.from({ length: 17 }, (_, index) => ({ category: `klasse ${index}`, sum: index }));
    assert.deepEqual(codes(await run({ ...request, ordered: true, points: many }, false)), ['tooManyCategories']);
  });

  it('refuses a period that is not over yet, or a day after the last complete day: the values are not final', async () => {
    const request = await example('price-ranges-mean', 'categoryComparison');
    assert.deepEqual(codes(await run({ ...request, period: '2026-10' }, false)), ['blockAfterReference']);
    const snapshot = await example('price-ranges-sum', 'categoryComparison');
    assert.deepEqual(codes(await run({ ...snapshot, day: '2026-10-01' }, false)), ['blockAfterReference']);
  });

  it('refuses when no category or only one has a value: bars compare', async () => {
    const request = await example('provinces-sum', 'categoryComparison');
    const rows = request.points as Row[];
    assert.deepEqual(codes(await run({ ...request, points: rows.map((row) => ({ ...row, sum: null })) }, false)), ['noData']);
    assert.deepEqual(codes(await run({ ...request, points: rows.map((row, index) => ({ ...row, sum: index ? null : 5 })) }, false)), ['tooFewCategories']);
  });

  it('draws a category without data as empty, never as zero: at the bottom, with the checkerboard behind its row (REQ-051)', async () => {
    const request = await example('provinces-sum', 'categoryComparison');
    const points = (request.points as Row[]).map((row) => (row.category === 'Antwerpen' ? { ...row, sum: null } : row));
    const result = await run({ ...request, points });
    assert.equal(result.report.outcome, 'ok');
    assert.match(result.svg!, /fill="url\(#semgraph-empty-[0-9a-f]{8}\)"/);
    assert.match(result.svg!, /aria-label="Antwerpen, geen data"/);
    // Sorted by value; the category without a value comes last.
    const labels = [...result.svg!.matchAll(/aria-label="([^",]+),/g)].map((match) => match[1]);
    assert.deepEqual(labels, ['Oost-Vlaanderen', 'Vlaams-Brabant', 'West-Vlaanderen', 'Limburg', 'Antwerpen']);
  });

  it('follows the rules about the kind of number: no total of ratios, unique counts that say how they were counted (REQ-064)', async () => {
    const request = await example('provinces-sum', 'categoryComparison');
    assert.deepEqual(codes(await run({ ...request, measureType: 'ratio' }, false)), ['ratioNotSummable']);
    assert.deepEqual(codes(await run({ ...request, measureType: 'unique', uniqueAggregation: 'daily' }, false)), ['dailyUniquesNotSummable']);
    const uniques = await run({ ...request, measureType: 'unique', uniqueAggregation: 'overPeriod' });
    assert.equal(uniques.report.outcome, 'ok');
    assert.match(uniques.svg!, />uniek · per venster van 28 dagen geteld · voortschrijdend 28d</);
  });

  it('tolerates a mean without spread as a deviation, with the red block (REQ-032)', async () => {
    const request = await example('provinces-mean', 'categoryComparison');
    const points = (request.points as Row[]).map(({ sd: _, ...row }) => row);
    const result = await run({ ...request, points });
    assert.deepEqual(result.deviations, ['meanWithoutSpread']);
    assert.match(result.svg!, /fill="#c8102e"/);
  });

  it('names the time the values cover in the reading cue', async () => {
    assert.match((await run(await example('provinces-sum', 'categoryComparison'))).svg!, />voortschrijdend 28d</);
    assert.match((await run(await example('price-ranges-sum', 'categoryComparison'))).svg!, />op 25\/09</);
    assert.match((await run(await example('price-ranges-median', 'categoryComparison'))).svg!, />mediaan · P25–P75 · sep 2026</);
  });
});

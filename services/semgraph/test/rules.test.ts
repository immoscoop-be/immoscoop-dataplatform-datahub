import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MovingWindowRequest } from '../src/charts/moving-window-chart.ts';
import { runPipeline } from '../src/core/pipeline.ts';
import { example, NOW, testRegistry } from './helpers.ts';

async function validate(request: Record<string, unknown>) {
  const result = await runPipeline(await testRegistry(), request, { now: NOW, draw: false });
  return { outcome: result.report.outcome, codes: result.report.issues.map((issue) => issue.code), report: result.report };
}

type Row = Record<string, unknown>;
const withPoints = async (map: (rows: Row[]) => Row[], name = 'basic', semgraph = 'movingWindowAverage') => {
  const request = await example(name, semgraph);
  return { ...request, points: map(request.points as Row[]) };
};
const without = (...fields: string[]) => (rows: Row[]) => rows.map((row) => Object.fromEntries(Object.entries(row).filter(([field]) => !fields.includes(field))));

describe('movingWindowAverage rules', () => {
  it('accepts the example from the analysis, plus measureType', async () => {
    assert.deepEqual(await validate(await example('basic')).then(({ outcome, codes }) => ({ outcome, codes })), {
      outcome: 'ok',
      codes: [],
    });
  });

  it('refuses a measure type the metadata does not allow', async () => {
    const registry = await testRegistry();
    const { implementation, metadata } = registry.semgraphs.get('movingWindowAverage')!;
    const request = { ...(await example('basic')), measureType: 'unique', uniqueAggregation: 'daily' } as unknown as MovingWindowRequest;
    const computed = implementation.compute(request, { now: NOW });
    const issues = implementation.rules(request, computed, { metadata: { ...metadata, attributes: { ...metadata.attributes, measureType: ['additive'] } } });
    assert.deepEqual(issues.map((issue) => issue.code), ['measureTypeNotAllowed']);
  });

  it('refuses a total of means per unit: an amount per lead does not add up', async () => {
    const result = await validate({ ...(await example('weeks-sum', 'periodComparison')), measureType: 'perUnit' });
    assert.equal(result.outcome, 'refused');
    assert.deepEqual(result.codes, ['perUnitNotSummable']);
  });

  it('refuses a ratio outside a ratio chart: a mean of ratios would mislead (REQ-070, REQ-074, REQ-076)', async () => {
    const result = await validate({ ...(await example('basic')), measureType: 'ratio' });
    assert.deepEqual(result.codes, ['ratioNeedsNumerator']);
    assert.match(result.report.issues[0]!.alternative!, /measureType perUnit/);
  });

  it('asks which unique metric is meant, instead of guessing', async () => {
    const result = await validate(await example('unique-without-aggregation'));
    assert.equal(result.outcome, 'refused');
    assert.deepEqual(result.codes, ['uniqueAggregationRequired']);
    assert.match(result.report.issues[0]!.message, /twee verschillende metrics/);
    assert.ok(result.report.issues[0]!.alternative);
    assert.ok(result.report.issues[0]!.learnMore);
  });

  it('draws the average of daily uniques, and says how they were counted', async () => {
    const daily = await runPipeline(await testRegistry(), { ...(await example('unique-without-aggregation')), uniqueAggregation: 'daily' }, { now: NOW });
    assert.equal(daily.report.outcome, 'ok');
    assert.match(daily.svg!, /uniek · per dag geteld · voortschrijdend gemiddelde 7d/);
  });

  it('refuses the uniques over a window as an average: they are one count per window (REQ-064)', async () => {
    const result = await validate({ ...(await example('unique-without-aggregation')), uniqueAggregation: 'overPeriod' });
    assert.deepEqual(result.codes, ['uniquesOverPeriodNotAveraged']);
  });

  it('a total of unique counts only as the uniques over each block, counted in the warehouse (REQ-035, REQ-064)', async () => {
    const weeks = await example('weeks-sum', 'periodComparison');
    const daily = await validate({ ...weeks, measureType: 'unique', uniqueAggregation: 'daily' });
    assert.deepEqual(daily.codes, ['dailyUniquesNotSummable']);
    assert.match(daily.report.issues[0]!.message, /telt wie op meerdere dagen terugkomt meer dan eens/);
    const overPeriod = await runPipeline(await testRegistry(), { ...weeks, measureType: 'unique', uniqueAggregation: 'overPeriod' }, { now: NOW });
    assert.equal(overPeriod.report.outcome, 'ok');
    assert.match(overPeriod.svg!, /uniek · per week geteld · som per week/);
  });

  it('refuses when the blocks with a value cover fewer days than minimumPoints', async () => {
    const result = await validate(await withPoints((rows) => rows.slice(-3)));
    assert.equal(result.outcome, 'refused');
    assert.deepEqual(result.codes, ['insufficientData']);
    assert.match(result.report.issues[0]!.message, /samen 21 dagen/);
  });

  it('refuses when no block has a value', async () => {
    const result = await validate(await withPoints((rows) => rows.map((row) => ({ end: row.end, mean: null }))));
    assert.deepEqual(result.codes, ['noData']);
  });

  it('refuses a window that ends after the last complete day: its value is not final', async () => {
    const result = await validate(await withPoints((rows) => [...rows, { end: '2026-10-07', mean: 40, sd: 10 }]));
    assert.deepEqual(result.codes, ['blockAfterReference']);
    assert.match(result.report.issues[0]!.message, /2026-10-07/);
  });

  it('tolerates a window that is not a multiple of 7, as a deviation', async () => {
    const result = await validate(await example('window-10'));
    assert.equal(result.outcome, 'deviation');
    assert.deepEqual(result.codes, ['windowNotMultipleOf7']);
  });

  it('tolerates a mean without spread, as a deviation', async () => {
    const result = await validate(await withPoints(without('sd')));
    assert.equal(result.outcome, 'deviation');
    assert.deepEqual(result.codes, ['meanWithoutSpread']);
  });

  it('tolerates a median without spread, as a deviation of its own', async () => {
    const result = await validate(await withPoints(without('p25', 'p75'), 'basic', 'movingWindowMedian'));
    assert.equal(result.outcome, 'deviation');
    assert.deepEqual(result.codes, ['medianWithoutSpread']);
  });

  it('a block only carries its name and the fields of its statistic: a median has no sd', async () => {
    const result = await validate(await withPoints((rows) => rows.map((row) => ({ ...row, sd: 3 })), 'basic', 'movingWindowMedian'));
    assert.equal(result.outcome, 'invalid');
    assert.equal(result.codes[0], 'unexpectedBlockField');
    assert.match(result.report.issues[0]!.message, /points\[0\]\.sd is niet toegelaten/);
  });

  it('ignores uniqueAggregation for additive measures, and says so', async () => {
    const result = await validate({ ...(await example('basic')), uniqueAggregation: 'daily' });
    assert.deepEqual(result.codes, ['uniqueAggregationIgnored']);
  });
});

describe('ratio rules (REQ-074 to REQ-080)', () => {
  it('a ratio chart takes measureType ratio, and names what it counts', async () => {
    const request = await example('weeks', 'calendarRatio');
    assert.deepEqual((await validate(request)).codes, ['fewObservations.ratio.base']);
    assert.deepEqual((await validate({ ...request, measureType: 'additive' })).codes.filter((code) => code !== 'fewObservations.ratio.base'), ['measureTypeNotAllowed']);
    const { numeratorName: _, ...unnamed } = request;
    assert.equal((await validate(unnamed)).outcome, 'invalid');
    // A ratio chart has no valueAxis: both axes start at zero (REQ-079).
    assert.equal((await validate({ ...request, valueAxis: 'zoom' })).outcome, 'invalid');
  });

  it('every block carries its numerator and denominator, and nothing of another statistic', async () => {
    assert.equal((await validate(await withPoints(without('denominator'), 'weeks', 'calendarRatio'))).outcome, 'invalid');
    const result = await validate(await withPoints((rows) => rows.map((row) => ({ ...row, mean: 0.04 })), 'weeks', 'calendarRatio'));
    assert.equal(result.outcome, 'invalid');
  });

  it('refuses a numerator larger than its denominator: how a ratio per unit is shown is still open (REQ-074)', async () => {
    const result = await validate(await withPoints((rows) => rows.map((row, index) => (index === 2 ? { ...row, numerator: 900, denominator: 300 } : row)), 'weeks', 'calendarRatio'));
    assert.equal(result.outcome, 'refused');
    assert.ok(result.codes.includes('ratioPerUnitOpen'));
  });

  it('says whether few observations are statistically thin, an unusual base, or both (REQ-080)', async () => {
    assert.deepEqual((await validate(await example('few-qualified', 'movingWindowRatio'))).codes, ['fewObservations.ratio.thin']);
    const both = await withPoints((rows) => rows.map((row, index) => (index === 1 ? { ...row, numerator: 5, denominator: 300 } : row)), 'weeks', 'calendarRatio');
    const result = await validate(both);
    assert.deepEqual(result.codes, ['fewObservations.ratio.both']);
    assert.match(result.report.issues[0]!.message, /^2 of the 10 weeks rest on few observations: very few leads or visitors, or far fewer visitors than the weeks around them\./);
  });
});

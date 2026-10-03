import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runPipeline } from '../src/core/pipeline.ts';
import { example, NOW, series, testRegistry } from './helpers.ts';

async function validate(request: Record<string, unknown>) {
  const result = await runPipeline(await testRegistry(), request, { now: NOW, draw: false });
  return { outcome: result.report.outcome, codes: result.report.issues.map((issue) => issue.code), report: result.report };
}

describe('movingWindowAverage rules', () => {
  it('accepts the example from the analysis, plus measureType', async () => {
    assert.deepEqual(await validate(await example('basic')).then(({ outcome, codes }) => ({ outcome, codes })), {
      outcome: 'ok',
      codes: [],
    });
  });

  it('refuses a measure type the metadata does not allow', async () => {
    const result = await validate({ ...(await example('basic')), measureType: 'ratio' });
    assert.equal(result.outcome, 'refused');
    assert.deepEqual(result.codes, ['measureTypeNotAllowed']);
  });

  it('asks which unique metric is meant, instead of guessing', async () => {
    const result = await validate(await example('unique-without-aggregation'));
    assert.equal(result.outcome, 'refused');
    assert.deepEqual(result.codes, ['uniqueAggregationRequired']);
    assert.match(result.report.issues[0]!.message, /twee verschillende metrics/);
    assert.ok(result.report.issues[0]!.alternative);
    assert.ok(result.report.issues[0]!.learnMore);
  });

  it('refuses uniques over the window: they cannot be derived from daily values', async () => {
    const result = await validate({ ...(await example('unique-without-aggregation')), uniqueAggregation: 'overPeriod' });
    assert.deepEqual(result.codes, ['uniquesOverPeriodNotDerivable']);
    assert.match(result.report.issues[0]!.message, /een venster van 7 dagen/);
  });

  it('draws the average of daily uniques', async () => {
    const result = await validate({ ...(await example('unique-without-aggregation')), uniqueAggregation: 'daily' });
    assert.equal(result.outcome, 'ok');
  });

  it('refuses when there are fewer values than minimumPoints in the range the chart uses', async () => {
    const result = await validate({ ...(await example('basic')), data: series('2026-09-30', Array(27).fill(4)) });
    assert.equal(result.outcome, 'refused');
    assert.deepEqual(result.codes, ['insufficientData']);
    assert.match(result.report.issues[0]!.message, /27 dagen/);
  });

  it('refuses when not a single window is complete', async () => {
    // 40 days, but every 7th day is missing: no 7-day window is ever complete.
    const values = Array.from({ length: 40 }, (_, index) => (index % 7 === 3 ? null : 10));
    const result = await validate({ ...(await example('basic')), data: series('2026-09-30', values) });
    assert.deepEqual(result.codes, ['noCompleteWindow']);
  });

  it('tolerates a window that is not a multiple of 7, as a deviation', async () => {
    const result = await validate(await example('window-10'));
    assert.equal(result.outcome, 'deviation');
    assert.deepEqual(result.codes, ['windowNotMultipleOf7']);
  });

  it('tolerates a mean without spread, as a deviation', async () => {
    const result = await validate({ ...(await example('basic')), spread: 'none' });
    assert.equal(result.outcome, 'deviation');
    assert.deepEqual(result.codes, ['meanWithoutSpread']);
  });

  it('tolerates a median without spread, as a deviation of its own', async () => {
    const result = await validate({ ...(await example('basic', 'movingWindowMedian')), spread: 'none' });
    assert.equal(result.outcome, 'deviation');
    assert.deepEqual(result.codes, ['medianWithoutSpread']);
  });

  it('a median only accepts its own spread, P25–P75 (iqr)', async () => {
    const result = await validate({ ...(await example('basic', 'movingWindowMedian')), spread: 'stddev' });
    assert.equal(result.outcome, 'invalid');
    assert.match(result.report.issues[0]!.message, /iqr, none/);
  });

  it('refuses uniques over a calendar period, naming the period', async () => {
    const result = await validate({ ...(await example('months', 'calendarAverage')), measureType: 'unique', uniqueAggregation: 'overPeriod' });
    assert.deepEqual(result.codes, ['uniquesOverPeriodNotDerivable']);
    assert.match(result.report.issues[0]!.message, /Unieken over een maand/);
  });

  it('mentions the days after the last complete day that were left out', async () => {
    const result = await validate({ ...(await example('basic')), data: series('2026-10-01', Array(40).fill(3)) });
    assert.equal(result.outcome, 'ok');
    assert.deepEqual(result.codes, ['daysAfterReferenceIgnored']);
  });

  it('ignores uniqueAggregation for additive measures, and says so', async () => {
    const result = await validate({ ...(await example('basic')), uniqueAggregation: 'daily' });
    assert.deepEqual(result.codes, ['uniqueAggregationIgnored']);
  });
});

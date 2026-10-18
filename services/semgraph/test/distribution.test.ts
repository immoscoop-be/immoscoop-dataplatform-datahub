import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { runPipeline } from '../src/core/pipeline.ts';
import { example, NOW, testRegistry } from './helpers.ts';

async function run(request: unknown, draw = true) {
  return runPipeline(await testRegistry(), request, { now: NOW, draw });
}
const issues = (result: Awaited<ReturnType<typeof run>>) => result.report.issues.map((issue) => [issue.code, issue.field]);
type Bin = { from: number; count: number };

describe('distribution', () => {
  it('wants bins of equal width that touch, an open bin after them, and P25 ≤ P50 ≤ P75', async () => {
    const request = await example('asking-price', 'distribution');
    const bins = (request.bins as Bin[]).map((bin, index) => (index === 3 ? { ...bin, from: bin.from + 10000 } : bin));
    assert.deepEqual(issues(await run({ ...request, bins }, false)), [['binsNotContiguous', '/bins/3/from']]);
    assert.deepEqual(issues(await run({ ...request, openBin: { from: 850000, count: 5 } }, false)), [['openBinOverlaps', '/openBin/from']]);
    assert.deepEqual(issues(await run({ ...request, percentiles: { p25: 300000, p50: 290000, p75: 400000 } }, false)), [['spreadOrder', '/percentiles']]);
  });

  it('refuses a distribution without units, or with too few for quartiles to say something', async () => {
    const request = await example('asking-price', 'distribution');
    const empty = (request.bins as Bin[]).map((bin) => ({ ...bin, count: 0 }));
    assert.deepEqual(issues(await run({ ...request, bins: empty, openBin: undefined }, false)), [['noData', '/bins']]);
    const few = (request.bins as Bin[]).map((bin, index) => ({ ...bin, count: index < 2 ? 5 : 0 }));
    const { openBin: _, ...withoutOpen } = request;
    const result = await run({ ...withoutOpen, bins: few }, false);
    assert.deepEqual(issues(result), [['tooFewUnits', '/bins']]);
    assert.match(result.report.issues[0]!.message, /De verdeling telt 10 eenheden/);
  });

  it('shows each bin on hover, with its count and share', async () => {
    const { svg } = await run(await example('asking-price', 'distribution'));
    assert.match(svg!, /aria-label="€ 300k–€ 350k, 2,4k \(15%\)"/);
    assert.match(svg!, /aria-label="≥ P95: vanaf € 900k, 0,5k \(3%\)"/);
  });

  it('draws without an open bin when there is no long tail', async () => {
    const { openBin: _, ...request } = await example('asking-price', 'distribution');
    const result = await run(request);
    assert.equal(result.report.outcome, 'ok');
    assert.doesNotMatch(result.svg!, /≥ P95/);
  });
});

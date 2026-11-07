import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { differenceText } from '../src/charts/kpi-tile.ts';
import { runPipeline } from '../src/core/pipeline.ts';
import { example, NOW, testRegistry } from './helpers.ts';

describe('kpiTile', () => {
  it('writes the difference as in Figma: an arrow, the size, and its share of what it is compared with', () => {
    assert.equal(differenceText(2400, 2220, 'nl-BE'), '▲ 180 (+8%)');
    assert.equal(differenceText(3.9, 4.7, 'nl-BE'), '▼ 0,8 (−17%)');
    assert.equal(differenceText(21500, 22800, 'en'), '▼ 1.3k (−6%)');
    assert.equal(differenceText(12, 0, 'en'), '▲ 12');
    assert.equal(differenceText(5, 5, 'en'), '= 0');
  });

  it('REQ-067: the label names what the number is compared with, and the request may choose', async () => {
    const registry = await testRegistry();
    const request = await example('rolling-7d', 'kpiTile');
    const svg = async (patch: Record<string, unknown>) => (await runPipeline(registry, { ...request, ...patch }, { now: NOW })).svg!;
    // On two lines when it does not fit next to the mini trend.
    assert.match(await svg({}), />▲ 32 \(\+6%\)</);
    assert.match(await svg({}), />vs previous 7 days</);
    assert.doesNotMatch(await svg({}), /grey = /);
    const lastYear = await svg({ comparison: 'lastYear' });
    assert.match(lastYear, /vs last year</);
    assert.match(lastYear, />grey = last year</);
  });
});

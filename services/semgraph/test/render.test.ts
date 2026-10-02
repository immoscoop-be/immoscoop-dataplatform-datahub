import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runPipeline } from '../src/core/pipeline.ts';
import { renderVegaLite } from '../src/core/render/vega.ts';
import { assertGolden, example, NOW, testRegistry } from './helpers.ts';

async function render(request: unknown) {
  return runPipeline(await testRegistry(), request, { now: NOW });
}

/** Text keys that slipped through untranslated would look like "footer.asOf". */
const UNRESOLVED_KEY = /\b(semgraphs|footer|issues|axis|chart|date|types|attributes)\.[a-zA-Z]+/;

describe('render', () => {
  for (const name of ['basic', 'missing-days', 'window-10']) {
    it(`matches the golden SVG for the example ${name}`, async () => {
      const result = await render(await example(name));
      assert.deepEqual(result.warnings, []);
      assert.ok(result.svg);
      assert.doesNotMatch(result.svg, UNRESOLVED_KEY);
      await assertGolden(`movingWindowAverage-${name}.svg`, result.svg);
    });
  }

  it('has the anatomy of the chart language: title, reading cue, footer and version label', async () => {
    const { svg } = await render(await example('basic'));
    assert.match(svg!, /<title>Kredietleads per dag \(voorbeelddata\)<\/title>/);
    assert.match(svg!, /voortschrijdend gemiddelde 7d · ±1 sd/);
    assert.match(svg!, /Leads<\/tspan><tspan> › <\/tspan><tspan>creditLeads<\/tspan><tspan> · <\/tspan><tspan>owner onbekend/);
    assert.match(svg!, /peildatum 30 sep 2026/);
    assert.match(svg!, /definitie onbekend/);
    assert.match(svg!, /<a href="https:\/\/immoscoop\.atlassian\.net\/wiki\/spaces\/DATA\/pages\/1354629146">/);
    assert.match(svg!, />grafiektaal v0</);
    assert.match(svg!, /data-tokens-version="0\.0\.0-provisional"/);
    // The reference day is yesterday, so the 0 tick reads "vandaag".
    assert.match(svg!, />vandaag</);
  });

  it('shows missing days as missing data, never as zero', async () => {
    const { svg } = await render(await example('missing-days'));
    assert.match(svg!, />no data</);
    assert.doesNotMatch(svg!, />geen data</);
  });

  it('puts a tolerated deviation in the footer and leaves out the version label', async () => {
    const result = await render(await example('window-10'));
    assert.deepEqual(result.deviations, ['windowNotMultipleOf7']);
    assert.match(result.svg!, /Buiten de grafiektaal: het venster van 10 dagen is geen veelvoud van 7\./);
    assert.doesNotMatch(result.svg!, /grafiektaal v0/);
  });

  it('draws nothing for a refusal', async () => {
    const result = await render(await example('unique-without-aggregation'));
    assert.equal(result.report.outcome, 'refused');
    assert.equal(result.svg, undefined);
  });

  it('escapes every text from the caller', async () => {
    const request = {
      ...(await example('basic')),
      title: 'Leads <script>alert(1)</script> & co',
      context: { domain: '"><svg onload=alert(1)>', definitionUrl: 'https://example.org/?a=1&b="2"' },
    };
    const { svg } = await render(request);
    assert.doesNotMatch(svg!, /<script>/);
    assert.doesNotMatch(svg!, /<svg onload/);
    assert.match(svg!, /Leads &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; co/);
    assert.match(svg!, /href="https:\/\/example\.org\/\?a=1&amp;b=&quot;2&quot;"/);
  });

  it('refuses links that are not web links, and control characters', async () => {
    const result = await render({
      ...(await example('basic')),
      title: 'bell\u0007',
      context: { definitionUrl: 'javascript:alert(1)' },
    });
    assert.equal(result.report.outcome, 'invalid');
    assert.deepEqual(result.report.issues.map((issue) => issue.code).sort(), ['invalidCharacters', 'invalidUrl']);
  });

  it('Vega output contains no ids, so several charts can share one page', async () => {
    const { svg } = await render(await example('missing-days'));
    assert.doesNotMatch(svg!, /\sid="/);
  });

  it('Vega may not load anything from outside', async () => {
    const output = await renderVegaLite({
      data: { url: 'https://example.org/data.json' },
      mark: 'point',
      encoding: { x: { field: 'a', type: 'quantitative' } },
    });
    assert.ok(output.warnings.some((warning) => warning.includes('may not load external resources')));
  });
});

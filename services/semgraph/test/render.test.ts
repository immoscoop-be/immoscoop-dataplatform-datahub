import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runPipeline } from '../src/core/pipeline.ts';
import { renderVegaLite } from '../src/core/render/vega.ts';
import { assertGolden, example, NOW, testRegistry } from './helpers.ts';

async function render(request: unknown) {
  return runPipeline(await testRegistry(), request, { now: NOW });
}

/** Text keys that slipped through untranslated would look like "footer.asOf". */
const UNRESOLVED_KEY = /\b(semgraphs|footer|issues|axis|chart|cue|desc|calendar|period|date|types|attributes|hover)\.[a-zA-Z]+/;

const hoverLabels = (svg: string) => [...svg.matchAll(/class="semgraph-hover-column" tabindex="0" role="img" aria-label="([^"]*)"/g)].map((match) => match[1]);

describe('render', async () => {
  const registry = await testRegistry();
  for (const [id, semgraph] of registry.semgraphs) {
    for (const [name, request] of semgraph.examples) {
      it(`${id}/${name}: no Vega warnings, no untranslated text, matches its golden SVG`, async () => {
        const result = await render(request);
        assert.deepEqual(result.warnings, []);
        if (result.report.outcome === 'refused') return assert.equal(result.svg, undefined);
        assert.ok(result.svg);
        assert.doesNotMatch(result.svg, UNRESOLVED_KEY);
        assert.doesNotMatch(result.svg, /\sid="/, 'no ids, so several charts can share one page');
        await assertGolden(`${id}-${name}.svg`, result.svg);
      });
    }
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
  });

  it('puts a tolerated deviation in the footer and leaves out the version label', async () => {
    const result = await render(await example('window-10'));
    assert.deepEqual(result.deviations, ['windowNotMultipleOf7']);
    assert.match(result.svg!, /Buiten de grafiektaal: het venster van 10 dagen is geen veelvoud van 7\./);
    assert.doesNotMatch(result.svg!, /grafiektaal v0/);
  });

  it('draws a long horizon as a line with a band, and thins out the time axis', async () => {
    const { svg } = await render(await example('long-horizon'));
    assert.doesNotMatch(svg!, /stroke="#f2afd2" stroke-width="4"/); // no bar per day
    assert.match(svg!, /mark-area role-mark/);
    assert.match(svg!, /mark-line role-mark/);
    for (const label of ['−168d', '−140d', '−112d', '−84d', '−56d', '−28d']) assert.match(svg!, new RegExp(`>${label}<`));
    assert.doesNotMatch(svg!, />−7d</);
    assert.ok(hoverLabels(svg!).includes('16 jul (−76d), geen data: 3 dagen ontbreken, de eerste op 14 jul'));
  });

  it('a median is a dot in a wide bar, a mean a diamond over a thin one (REQ-006, REQ-008)', async () => {
    const { svg: median } = await render(await example('basic', 'movingWindowMedian'));
    const { svg: mean } = await render(await example('basic'));
    assert.match(median!, /voortschrijdende mediaan 7d · P25–P75/);
    assert.match(median!, /stroke="#f2afd2" stroke-width="9" stroke-linecap="round"/);
    assert.match(mean!, /stroke="#f2afd2" stroke-width="4" stroke-linecap="round"/);
  });

  it('a zoomed value axis gets a zigzag at the start of the baseline and a bold first value', async () => {
    const { svg: zoomed } = await render(await example('zoomed'));
    const { svg: fromZero } = await render(await example('basic'));
    assert.match(zoomed!, /font-weight="bold"[^>]*>20</);
    assert.doesNotMatch(zoomed!, />0</);
    const zigzag = /class="mark-line role-mark[^"]*"[^>]*><path [^>]*stroke="#3c444e"/;
    assert.match(zoomed!, zigzag);
    assert.doesNotMatch(fromZero!, /font-weight="bold"[^>]*>0</);
    assert.doesNotMatch(fromZero!, zigzag);
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
    const result = await render({ ...(await example('basic')), title: 'bell\u0007', context: { definitionUrl: 'javascript:alert(1)' } });
    assert.equal(result.report.outcome, 'invalid');
    assert.deepEqual(result.report.issues.map((issue) => issue.code).sort(), ['invalidCharacters', 'invalidUrl']);
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

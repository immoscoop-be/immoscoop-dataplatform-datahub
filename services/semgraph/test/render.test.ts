import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runPipeline } from '../src/core/pipeline.ts';
import { renderVegaLite } from '../src/core/render/vega.ts';
import { color } from '../src/core/tokens.ts';
import { assertGolden, example, NOW, testRegistry } from './helpers.ts';

async function render(request: unknown) {
  return runPipeline(await testRegistry(), request, { now: NOW });
}

/** Text keys that slipped through untranslated would look like "footer.asOf". */
const UNRESOLVED_KEY = /\b(semgraphs|footer|issues|axis|chart|cue|desc|calendar|period|date|types|attributes|hover|meta|readingCards)\.[a-zA-Z]+/;

/** The SVG without the hover details, which only show on hover or focus. */
const withoutHover = (svg: string) => svg.replace(/<g class="semgraph-hover-detail".*?<\/g><\/g>/g, '');

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
        // No ids, so several charts can share one page; only technical ids that are unique per chart (REQ-036).
        for (const [, id] of result.svg.matchAll(/\sid="([^"]*)"/g)) assert.match(id!, /^semgraph-(hatch|towin|empty|running|few)-[0-9a-f]{8}$/);
        await assertGolden(`${id}-${name}.svg`, result.svg);
      });
    }
  }

  it('has the anatomy of the chart language: title, reading cue, footer and version label', async () => {
    const { svg } = await render(await example('basic'));
    assert.match(svg!, /<title>Kredietleads per dag \(voorbeelddata\)<\/title>/);
    assert.match(svg!, /voortschrijdend gemiddelde 7d · ±1 sd/);
    assert.match(svg!, /Leads<\/tspan><tspan> › <\/tspan><tspan>creditLeads<\/tspan><tspan> · <\/tspan><tspan>owner onbekend/);
    // The footer as the building blocks Origin, Status and Learn link in Figma.
    assert.match(svg!, /font-weight="600" fill="#3c444e" xml:space="preserve"><tspan>Leads<\/tspan>/);
    assert.match(svg!, /<tspan>peildatum 30\/09<\/tspan><tspan> · <\/tspan><tspan font-weight="700" fill="#3c444e">samengesteld 01\/10<\/tspan>/);
    assert.match(svg!, /definitie onbekend/);
    assert.match(
      svg!,
      /<tspan>Hoe lees ik deze grafiek\?  <\/tspan><a href="https:\/\/immoscoop\.atlassian\.net\/wiki\/spaces\/DATA\/pages\/1354629146"><tspan fill="#630038">Leeskaart: tijdreeks →<\/tspan><\/a>/,
    );
    assert.match(svg!, />grafiektaal v0</);
    assert.ok(svg!.includes(`data-tokens-version="${(await testRegistry()).tokens.version}"`));
    // The reference day is yesterday, so the last window reads "nu" (REQ-030).
    assert.match(svg!, />nu</);
  });

  it('shows a block without data as empty, never as zero: a checkerboard behind the column (REQ-051)', async () => {
    const { svg } = await render(await example('missing-days'));
    assert.match(svg!, /fill="url\(#semgraph-empty-[0-9a-f]{8}\)"/);
    assert.doesNotMatch(withoutHover(svg!), />no data</);
    assert.ok(hoverLabels(svg!).includes('16 Sep (−14d), no data'));
  });

  it('leaves out the version label for a tolerated deviation, without a footer note (REQ-042)', async () => {
    const result = await render(await example('window-10'));
    assert.deepEqual(result.deviations, ['windowNotMultipleOf7']);
    assert.doesNotMatch(result.svg!, /grafiektaal v0/);
    assert.doesNotMatch(result.svg!, /Buiten de grafiektaal/);
  });

  it('draws a long horizon as a line with a band, and thins out the time axis', async () => {
    const { svg } = await render(await example('long-horizon'));
    assert.doesNotMatch(svg!, /stroke="#f2afd2" stroke-width="4"/); // no bar per window
    assert.match(svg!, /mark-area role-mark/);
    assert.match(svg!, /mark-line role-mark/);
    for (const label of ['−455d', '−364d', '−273d', '−182d', '−91d']) assert.match(svg!, new RegExp(`>${label}<`));
    assert.doesNotMatch(svg!, />−7d</);
    // Two windows without data.
    assert.ok(hoverLabels(svg!).includes('15 jul (−77d), geen data'));
    assert.ok(hoverLabels(svg!).includes('22 jul (−70d), geen data'));
  });

  it('shows every tolerated deviation as a red block with a message to the reader (REQ-032, REQ-038, REQ-040, REQ-041)', async () => {
    const result = await render(await example('without-spread'));
    assert.deepEqual(result.deviations, ['meanWithoutSpread']);
    assert.match(result.svg!, /<rect x="20" y="[\d.]+" width="600" height="[\d.]+" rx="3" fill="#c8102e"\/>/);
    // REQ-041: a message to the reader, without saying anything about whoever delivered the chart.
    assert.match(result.svg!, /fill="#ffffff">Lees deze grafiek met voorzichtigheid: dit gemiddelde staat zonder spreiding, dus je/);
    assert.doesNotMatch(result.svg!, /oplever|verantwoord|legt uit waarom/);
    // REQ-042: the red block says enough; there is no footer note.
    assert.doesNotMatch(result.svg!, /Buiten de grafiektaal/);
    const window10 = (await render(await example('window-10'))).svg!;
    assert.match(window10, /fill="#c8102e"/);
    assert.match(window10, />Lees deze grafiek met voorzichtigheid: een venster van 10 dagen/);
    assert.doesNotMatch((await render(await example('basic'))).svg!, /#c8102e/);
  });

  it('writes no values with values off, and falls back when all values do not fit (REQ-033)', async () => {
    const off = await render({ ...(await example('basic')), values: 'off' });
    assert.doesNotMatch(off.svg!, />45,9</);
    const dense = await render({ ...(await example('long-horizon')), values: 'all' });
    assert.deepEqual(dense.report.issues.map((issue) => issue.code), ['valuesAllTooDense']);
    assert.match(dense.report.issues[0]!.message, /de standaard \(last\) wordt gebruikt/);
    const all = await render(await example('months-values-all', 'calendarAverage'));
    assert.equal([...all.svg!.matchAll(/font-weight="bold"[^>]*>\d+,\d</g)].length, 12);
  });

  it('a median is a dot in a wide bar, a mean a diamond over a thin one (REQ-006, REQ-008)', async () => {
    const { svg: median } = await render(await example('basic', 'movingWindowMedian'));
    const { svg: mean } = await render(await example('basic'));
    assert.match(median!, /voortschrijdende mediaan 7d · P25–P75/);
    const light = color((await testRegistry()).tokens, 'focus/light');
    assert.ok(median!.includes(`stroke="${light}" stroke-width="9" stroke-linecap="round"`));
    assert.ok(mean!.includes(`stroke="${light}" stroke-width="4" stroke-linecap="round"`));
  });

  it('a zoomed value axis gets a zigzag at the start of the baseline and a bold first value', async () => {
    const { svg: zoomed } = await render(await example('zoomed'));
    const { svg: fromZero } = await render(await example('basic'));
    assert.match(zoomed!, /font-weight="bold"[^>]*>20</);
    assert.doesNotMatch(zoomed!, />0</);
    const zigzag = new RegExp(`class="mark-line role-mark[^"]*"[^>]*><path [^>]*stroke="${color((await testRegistry()).tokens, 'baseline')}"`);
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

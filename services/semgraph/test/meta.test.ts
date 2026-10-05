import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runPipeline } from '../src/core/pipeline.ts';
import { example, NOW, testRegistry } from './helpers.ts';

async function render(request: unknown, now = NOW) {
  return runPipeline(await testRegistry(), request, { now });
}

const panelOf = (svg: string, label: string) => new RegExp(`aria-label="${label}">(.*?)</g><rect`).exec(svg)?.[1] ?? '';

describe('chart metadata (REQ-010 to REQ-020)', () => {
  it('REQ-010: shows the question and who asked it, the references, the query, who built it and the day it was compiled', async () => {
    const { svg } = await render(await example('with-metadata'));
    assert.match(panelOf(svg!, 'Vraag'), />Stijgt het aantal kredietleads per dag sinds de nieuwe campagne van half augustus\?</);
    assert.match(panelOf(svg!, 'Vraag'), />Gesteld door Team Krediet \(voorbeeld\)</);
    assert.match(panelOf(svg!, 'Referenties'), /<a href="https:\/\/example\.org\/jira\/DATA-123"><text [^>]*>Jira: DATA-123 \(voorbeeld\) →<\/text><\/a>/);
    // The query keeps its lines and indentation, in a monospaced font.
    assert.match(panelOf(svg!, 'Query'), /font-family="&apos;Roboto Mono&apos;[^"]*"[^>]*xml:space="preserve">       count\(\*\) as value</);
    const metadata = panelOf(svg!, 'Metadata');
    assert.match(metadata, /Uitgewerkt door: <\/tspan><tspan [^>]*>Datateam \(voorbeeld\)</);
    assert.match(metadata, /Samengesteld op: <\/tspan><tspan [^>]*>1 okt 2026</);
    assert.match(metadata, /Semgraph: <\/tspan><tspan [^>]*>movingWindowAverage</);
    assert.match(metadata, /Versie: <\/tspan><tspan [^>]*>0\.1\.0</);
  });

  it('REQ-011: without a compiled day, the chart is compiled on the day it is drawn, in Brussels', async () => {
    const request = await example('basic');
    // 22:30 UTC on 2 October is already 3 October in Brussels.
    const { svg } = await render(request, new Date('2026-10-02T22:30:00Z'));
    assert.match(svg!, />samengesteld 03\/10</);
    const given = await render({ ...request, meta: { compiledOn: '2026-09-29' } });
    assert.match(given.svg!, />samengesteld 29\/09</);
  });

  it('REQ-020: without metadata only the Metadata label, with the semgraph and the version', async () => {
    const { svg } = await render(await example('basic'));
    assert.deepEqual([...svg!.matchAll(/class="semgraph-meta-item" tabindex="0" role="group" aria-label="([^"]*)"/g)].map((match) => match[1]), ['Metadata']);
    assert.doesNotMatch(panelOf(svg!, 'Metadata'), /Uitgewerkt door/);
  });

  it('cuts a long query where the panel ends, and a line that is too long', async () => {
    const request = await example('with-metadata');
    const query = [`select ${'very_long_column_name, '.repeat(10)}x`, ...Array.from({ length: 60 }, (_, index) => `  and line_${index} = ${index}`)].join('\n');
    const { svg } = await render({ ...request, meta: { query } });
    const panel = panelOf(svg!, 'Query');
    assert.match(panel, /very_long_column_name, very_long[^<]*…</);
    assert.match(panel, />…<\/text>$/);
    assert.doesNotMatch(panel, /line_59/);
  });

  it('refuses a reference that is not a web link, and a compiled day that does not exist', async () => {
    const request = await example('basic');
    const link = await render({ ...request, meta: { references: [{ label: 'x', url: 'javascript:alert(1)' }] } });
    assert.equal(link.report.outcome, 'invalid');
    assert.deepEqual(link.report.issues.map((issue) => [issue.code, issue.field]), [['invalidUrl', '/meta/references/0/url']]);
    const day = await render({ ...request, meta: { compiledOn: '2026-02-30' } });
    assert.deepEqual(day.report.issues.map((issue) => [issue.code, issue.field]), [['invalidDate', '/meta/compiledOn']]);
    const unknown = await render({ ...request, meta: { author: 'x' } });
    assert.equal(unknown.report.outcome, 'invalid');
  });

  it('escapes every text of the metadata', async () => {
    const { svg } = await render({ ...(await example('basic')), meta: { question: '<b>&"x"</b>', query: 'select "<x>"' } });
    assert.match(svg!, />&lt;b&gt;&amp;&quot;x&quot;&lt;\/b&gt;</);
    assert.match(svg!, />select &quot;&lt;x&gt;&quot;</);
  });
});

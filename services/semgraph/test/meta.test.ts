import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { runPipeline } from '../src/core/pipeline.ts';
import { cardOf, example, NOW, testRegistry, textsOf } from './helpers.ts';

async function render(request: unknown, now = NOW) {
  return runPipeline(await testRegistry(), request, { now });
}

/** The value next to a name in a card (REQ-101). */
const valueOf = (texts: string[], name: string) => {
  const index = texts.indexOf(name);
  return index < 0 ? undefined : texts[index + 1];
};

describe('chart metadata (REQ-010 to REQ-020)', () => {
  it('REQ-010: shows the question and who asked it, the references, the query, who built it and the day it was compiled', async () => {
    const { svg } = await render(await example('with-metadata'));
    const question = textsOf(cardOf(svg!, 'question')!).join(' ');
    assert.match(question, /Stijgt het aantal kredietleads per dag sinds de nieuwe campagne van half augustus\?/);
    assert.match(question, /Gesteld door Team Krediet \(voorbeeld\)/);
    assert.match(cardOf(svg!, 'references')!, /<a href="https:\/\/example\.org\/jira\/DATA-123"><text [^>]*>Jira: DATA-123 \(voorbeeld\) →<\/text><\/a>/);
    // The query keeps its lines and indentation, in a monospaced font.
    assert.match(cardOf(svg!, 'query')!, /font-family="&apos;Roboto Mono&apos;[^"]*"[^>]*xml:space="preserve">       count\(\*\) as value</);
    // REQ-101, REQ-104: who built it and the day it was compiled under Made, the version under Service.
    const metadata = textsOf(cardOf(svg!, 'metadata')!);
    assert.equal(valueOf(metadata, 'Door'), 'Datateam (voorbeeld)');
    assert.equal(valueOf(metadata, 'Samengesteld'), '01/10/2026');
    assert.equal(valueOf(metadata, 'Type'), 'movingWindowAverage');
    assert.equal(valueOf(metadata, 'semgraph'), 'v0.1.0');
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
    assert.deepEqual([...svg!.matchAll(/class="semgraph-meta-label semgraph-meta-for-\w+" tabindex="0" role="button" aria-label="([^"]*)"/g)].map((match) => match[1]), ['Metadata']);
    const metadata = textsOf(cardOf(svg!, 'metadata')!);
    assert.equal(valueOf(metadata, 'Door'), undefined);
    assert.equal(valueOf(metadata, 'semgraph'), 'v0.1.0');
  });

  it('cuts a long query where the card ends, and a line that is too long; the row of labels stays', async () => {
    const request = await example('with-metadata');
    const query = [`select ${'very_long_column_name, '.repeat(10)}x`, ...Array.from({ length: 60 }, (_, index) => `  and line_${index} = ${index}`)].join('\n');
    const { svg } = await render({ ...request, meta: { query } });
    const card = cardOf(svg!, 'query')!;
    assert.match(card, /very_long_column_name, very_long[^<]*…</);
    const texts = textsOf(card);
    assert.ok(texts.includes('…'));
    assert.ok(!texts.some((text) => text.includes('line_59')));
    assert.deepEqual(texts.slice(-2), ['Metadata', 'samengesteld 01/10']);
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

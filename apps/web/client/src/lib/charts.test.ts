import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHART_GROUPS, ChartMissing, createCharts, exampleLabel, FIRST_CHART, grouped, INTENTS, placeable, shownExamples } from './charts.js';

const SEMGRAPHS = path.resolve(import.meta.dirname, '../../../../../services/semgraph/semgraphs');
const config = { semgraphUrl: 'https://semgraph.test', styleNonce: 'n0nce' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('Charts, the gallery of semgraph (FR-CH-06)', () => {
  it('places every chart semgraph offers in one group of the design, and no other (DEC-UX-182)', () => {
    const available = [...readFileSync(path.join(SEMGRAPHS, 'catalog.yml'), 'utf8').matchAll(/^- \{ id: (\w+), status: available \}/gm)].map((match) => match[1]);
    const placed = CHART_GROUPS.flatMap((group) => [...group.charts]);
    expect(available.length).toBeGreaterThan(10);
    expect(placed.toSorted()).toEqual(available.toSorted());
    expect(new Set(placed).size).toBe(placed.length);
    expect(FIRST_CHART).toBe('movingWindowAverage');
  });

  it('has a sentence for every reason semgraph gives not to use a chart', () => {
    const intents = readdirSync(SEMGRAPHS, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => [...readFileSync(path.join(SEMGRAPHS, entry.name, 'metadata.yml'), 'utf8').matchAll(/intent: (\w+)/g)].map((match) => match[1] as string));
    expect(intents.length).toBeGreaterThan(10);
    expect([...new Set(intents)].filter((intent) => !INTENTS[intent])).toEqual([]);
  });

  it('lists the charts by group, in the order of the design, and leaves out a group semgraph offers nothing of', () => {
    const chart = (id: string) => ({ id, title: id, answers: '' });
    const groups = grouped([chart('distribution'), chart('calendarAverage'), chart('movingWindowAverage'), chart('somethingNew')]);
    expect(groups.map(({ group, charts }) => [group.id, charts.map((one) => one.id)])).toEqual([
      ['overTime', ['movingWindowAverage', 'calendarAverage']],
      ['spread', ['distribution']],
    ]);
  });

  it('lists the examples that do not only show a theme or a size, each by its name', () => {
    const examples = [{ name: 'weeks', title: 'W' }, { name: 'weeks-dark', title: 'W', theme: 'dark' }, { name: 'weeks-card', title: 'W', size: 'card' }, { name: 'long-horizon', title: 'L' }];
    expect(shownExamples(examples).map((example) => example.name)).toEqual(['weeks', 'long-horizon']);
    expect(exampleLabel('long-horizon')).toBe('Long horizon');
    expect(exampleLabel('provinces-sum-vs-last-year')).toBe('Provinces sum vs last year');
    expect(exampleLabel('rolling-28d')).toBe('Rolling 28d');
  });

  it('reads semgraph in the language of the User, without Access Token (TR-PF-34)', async () => {
    const asked: { url: string; init?: RequestInit }[] = [];
    const charts = createCharts(config, (async (input: string, init?: RequestInit) => {
      asked.push({ url: input, init });
      if (input.startsWith('https://semgraph.test/semgraphs?')) {
        return json({ semgraphs: [{ id: 'kpiTile', title: 'KPI-tegel', answers: 'Hoeveel?', href: '/semgraphs/kpiTile', examples: [] }], planned: ['funnel'] });
      }
      if (input === 'https://semgraph.test/semgraphs/kpiTile?locale=en') {
        return json({ id: 'kpiTile', title: 'KPI tile', answers: 'How much?', exampleQuestions: ['Q'], doNotUseWhen: [{ intent: 'compareWithTarget', use: 'kpiStatus' }], data: { minimumPoints: 14 }, examples: [{ name: 'rolling-28d', title: 'T', href: '/x' }, { name: 'rolling-28d-dark', title: 'T', href: '/y', theme: 'dark' }], schema: {} });
      }
      return json({ outcome: 'invalid', issues: [{ level: 'inputError', code: 'unknownSemgraph' }] }, 404);
    }) as typeof fetch);
    expect(await charts.overview('nl')).toEqual({ charts: [{ id: 'kpiTile', title: 'KPI-tegel', answers: 'Hoeveel?' }], planned: ['funnel'] });
    expect(asked[0]?.url).toBe('https://semgraph.test/semgraphs?locale=nl-BE');
    expect(asked[0]?.init?.headers).toBeUndefined();
    expect(await charts.chart('kpiTile', 'en')).toEqual({
      id: 'kpiTile',
      title: 'KPI tile',
      answers: 'How much?',
      exampleQuestions: ['Q'],
      doNotUseWhen: [{ intent: 'compareWithTarget', use: 'kpiStatus' }],
      minimumPoints: 14,
      examples: [{ name: 'rolling-28d', title: 'T' }, { name: 'rolling-28d-dark', title: 'T', theme: 'dark' }],
    });
    await expect(charts.chart('nothing', 'en')).rejects.toBeInstanceOf(ChartMissing);
    expect(charts.iconUrl('kpiTile')).toBe('https://semgraph.test/semgraphs/kpiTile/icon');
  });

  it('draws an example in the theme of the page, as its SVG to place in the page, with what semgraph says of it (DEC-UX-184)', async () => {
    const answers: Record<string, () => Response> = {
      'https://semgraph.test/semgraphs/calendarAverage/examples/per-unit-few-observations?theme=dark': () =>
        new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', { headers: { 'content-type': 'image/svg+xml', 'semgraph-cautions': 'fewObservations.mean' } }),
      'https://semgraph.test/semgraphs/movingWindowAverage/examples/window-10?theme=light': () =>
        new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml', 'semgraph-deviations': 'windowNotMultipleOf7' } }),
      'https://semgraph.test/semgraphs/movingWindowAverage/examples/unique-without-aggregation?theme=light': () =>
        json({ outcome: 'refused', issues: [{ level: 'info', code: 'localeFallback' }, { level: 'refusal', code: 'uniqueAggregationRequired' }] }, 422),
      'https://semgraph.test/semgraphs/kpiTile/examples/broken?theme=light': () => new Response('', { status: 500 }),
    };
    const charts = createCharts(config, (async (input: string) => {
      const answer = answers[input];
      if (!answer) throw new TypeError('Failed to fetch');
      return answer();
    }) as typeof fetch);
    const caution = await charts.draw('calendarAverage', 'per-unit-few-observations', 'dark');
    expect(caution).toMatchObject({ kind: 'drawn', deviations: [], cautions: ['fewObservations.mean'] });
    expect(caution.kind === 'drawn' && caution.svg).toBe('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(await charts.draw('movingWindowAverage', 'window-10', 'light')).toMatchObject({ kind: 'drawn', deviations: ['windowNotMultipleOf7'], cautions: [] });
    expect(await charts.draw('movingWindowAverage', 'unique-without-aggregation', 'light')).toEqual({ kind: 'refused', code: 'uniqueAggregationRequired' });
    expect(await charts.draw('kpiTile', 'broken', 'light')).toEqual({ kind: 'failed' });
    expect(await charts.draw('kpiTile', 'offline', 'light')).toEqual({ kind: 'failed' });
  });

  it('places a drawing in the page without anything that could run, its styles with the nonce of the page (TR-PF-34)', () => {
    const drawn = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)" data-semgraph="kpiTile">
      <style>.semgraph-hover-detail { visibility: visible }</style>
      <script>alert(2)</script>
      <foreignObject><div>html</div></foreignObject>
      <g class="semgraph-hover-column" tabindex="0" onmouseover="alert(3)"><rect width="10" height="10"/></g>
      <a href="https://immoscoop.atlassian.net/wiki/x"><text>Reading card</text></a>
      <a href="javascript:alert(4)"><text>no</text></a>
    </svg>`;
    const svg = placeable(drawn, 'n0nce') ?? '';
    expect(svg).not.toMatch(/alert|script|foreignObject|onload|onmouseover|javascript/i);
    expect(svg).toContain('<style nonce="n0nce">.semgraph-hover-detail { visibility: visible }</style>');
    expect(svg).toContain('<a href="https://immoscoop.atlassian.net/wiki/x" target="_blank" rel="noopener noreferrer">');
    expect(svg).toContain('class="semgraph-hover-column" tabindex="0"');
    // Without a nonce the policy of the page refuses its styles anyway: they are left out.
    expect(placeable(drawn, undefined)).not.toContain('<style');
    expect(placeable('<html><body>no chart</body></html>', 'n0nce')).toBeUndefined();
  });

  it('places every drawing semgraph keeps as golden, its hover and styles kept', () => {
    const golden = path.resolve(SEMGRAPHS, '../test/golden');
    for (const file of readdirSync(golden).filter((name) => name.endsWith('.svg') && !name.endsWith('-icon.svg'))) {
      const text = readFileSync(path.join(golden, file), 'utf8');
      const svg = placeable(text, 'n0nce');
      expect(svg, file).toMatch(/^<svg[^>]* data-semgraph=/);
      expect((svg?.match(/<style nonce="n0nce">/g) ?? []).length, file).toBe((text.match(/<style>/g) ?? []).length);
    }
  });
});

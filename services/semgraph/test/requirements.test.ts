import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SHAPES } from '../src/charts/signatures.ts';
import type { TimeAxisComputed } from '../src/charts/time-axis-chart.ts';
import { createTranslator } from '../src/core/i18n.ts';
import { runPipeline } from '../src/core/pipeline.ts';
import type { Drawing } from '../src/core/semgraph.ts';
import { color } from '../src/core/tokens.ts';
import { NOW, testRegistry } from './helpers.ts';

/**
 * One test per requirement of the chart language (docs/requirements). They run on every example of
 * every semgraph, so a new semgraph is held to the same requirements without writing a test.
 */

interface Layer {
  data?: { name: string };
  mark?: string | { type: string; [key: string]: unknown };
  encoding?: Record<string, unknown>;
  layer?: Layer[];
}

interface Drawn {
  name: string;
  semgraph: string;
  statistic: string;
  request: Record<string, unknown>;
  computed: TimeAxisComputed;
  deviations: string[];
  drawing: Drawing;
  datasets: Record<string, Record<string, unknown>[]>;
  layers: Layer[];
  svg: string;
}

async function drawnExamples(): Promise<Drawn[]> {
  const registry = await testRegistry();
  const drawn: Drawn[] = [];
  for (const [id, semgraph] of registry.semgraphs) {
    for (const [name, request] of semgraph.examples) {
      const result = await runPipeline(registry, request, { now: NOW });
      if (!result.svg) continue;
      const { implementation, metadata } = semgraph;
      const computed = implementation.compute(request, { now: NOW });
      const t = createTranslator(registry.locales, result.report.locale);
      const drawing = implementation.draw(request, computed, { t, tokens: registry.tokens, metadata });
      const spec = drawing.vegaLite as unknown as { datasets: Drawn['datasets']; layer: Layer[] };
      drawn.push({
        name: `${id}/${name}`,
        semgraph: id,
        statistic: (implementation as unknown as { statistic?: { id: string } }).statistic?.id ?? String((request as { statistic: string }).statistic),
        request: request as Record<string, unknown>,
        computed: computed as TimeAxisComputed,
        deviations: result.deviations,
        drawing,
        datasets: spec.datasets,
        layers: flatten(spec.layer),
        svg: result.svg,
      });
    }
  }
  return drawn;
}

function flatten(layers: Layer[]): Layer[] {
  return layers.flatMap((layer) => (layer.layer ? flatten(layer.layer) : [layer]));
}

const markOf = (layer: Layer): Record<string, unknown> => (typeof layer.mark === 'object' ? layer.mark : { type: layer.mark });
const markType = (layer: Layer) => markOf(layer).type;
const pointLayer = (drawn: Drawn) => drawn.layers.find((layer) => layer.data?.name === 'points')!;

describe('requirements of the chart language', async () => {
  const examples = await drawnExamples();
  const tokens = (await testRegistry()).tokens;

  it('every example is checked', () => {
    assert.ok(examples.length >= 10);
  });

  it('REQ-001: a time axis is always a line through every point, never bridging missing data', () => {
    for (const drawn of examples) {
      const line = drawn.layers.find((layer) => layer.data?.name === 'line');
      assert.equal(line && markType(line), 'line', `${drawn.name}: no line`);
      const rows = drawn.datasets.line as { rel: number; segment: number }[];
      const points = (drawn.datasets.points as { rel: number }[]).map((point) => point.rel);
      for (const rel of points) assert.ok(rows.some((row) => row.rel === rel), `${drawn.name}: point ${rel} is not on the line`);
      for (let index = 1; index < rows.length; index++) {
        if (rows[index]!.segment === rows[index - 1]!.segment) {
          assert.equal(rows[index]!.rel, rows[index - 1]!.rel + 1, `${drawn.name}: the line bridges a gap before ${rows[index]!.rel}`);
        }
      }
    }
    const missing = examples.find((drawn) => drawn.name === 'movingWindowAverage/missing-days')!;
    assert.equal(new Set((missing.datasets.line as { segment: number }[]).map((row) => row.segment)).size, 2, 'missing data breaks the line in two');
  });

  it('REQ-002: no bars on a time axis; a rectangle only carries the state of a period, never a value', () => {
    for (const drawn of examples) {
      for (const layer of drawn.layers) {
        assert.notEqual(markType(layer), 'bar', `${drawn.name}: a bar on a time axis`);
        if (markType(layer) === 'rect') {
          assert.equal(layer.data?.name, 'columns', `${drawn.name}: a rectangle that is not a data state`);
          // Over the full height of the plot, whatever the values are (REQ-049).
          assert.deepEqual([layer.encoding!.y, layer.encoding!.y2], [{ value: 0 }, { value: 200 - tokens.stroke.baseline }], drawn.name);
        }
      }
    }
  });

  it('REQ-006, REQ-007 and REQ-008: a mean is a diamond, a total a square, a median a dot; always filled (REQ-052)', () => {
    for (const drawn of examples) {
      const mark = markOf(pointLayer(drawn));
      assert.equal(mark.shape, { mean: 'diamond', sum: 'square', median: 'circle' }[drawn.statistic], drawn.name);
      assert.equal(mark.fill, color(tokens, 'focus'), drawn.name);
      assert.equal(pointLayer(drawn).encoding!.fill, undefined, `${drawn.name}: the fill does not depend on the state`);
    }
    // In the SVG: the running week of calendarAverage/weeks is a filled diamond.
    const weeks = examples.find((drawn) => drawn.name === 'calendarAverage/weeks')!;
    assert.match(weeks.svg, /d="M-4,0L0,-4L4,0L0,4Z" fill="#dd2c88" stroke="#ffffff"/);
    assert.doesNotMatch(weeks.svg, /d="M-4,0L0,-4L4,0L0,4Z" fill="#ffffff"/);
    const quarters = examples.find((drawn) => drawn.name === 'calendarMedian/quarters')!;
    assert.match(quarters.svg, /d="M3\.5,0A3\.5,3\.5,0,1,1,-3\.5,0A3\.5,3\.5,0,1,1,3\.5,0" fill="#dd2c88"/);
  });

  it('REQ-049 to REQ-052: the state of a period is a pattern behind its whole column; empty is a checkerboard, running fine lines', () => {
    for (const drawn of examples) {
      const columns = drawn.datasets.columns as { from: number; to: number; state: string }[];
      const running = new Set(drawn.computed.points.filter((point) => point.running).map((point) => point.rel));
      const empty = new Set(drawn.computed.missing);
      const covered = (state: string) => new Set(columns.filter((column) => column.state === state).flatMap((column) => Array.from({ length: column.to - column.from }, (_, index) => column.from + 0.5 + index)));
      assert.deepEqual([...covered('empty')].sort(), [...empty].sort(), `${drawn.name}: empty`);
      assert.deepEqual([...covered('running')].sort(), [...running].filter((rel) => !empty.has(rel)).sort(), `${drawn.name}: running`);
      // Behind the data: the columns are drawn before the band, the line and the points.
      const order = drawn.layers.map((layer) => layer.data?.name);
      assert.ok(order.indexOf('columns') < order.indexOf('line'), drawn.name);
      // REQ-051: no outline over the chart and no label in it.
      assert.doesNotMatch(drawn.svg, />(no data|geen data)</, drawn.name);
      // REQ-050: tiles anchored to the plot, the sizes of Figma: mosaic 8 px, lines 4 px.
      if (empty.size > 0) assert.match(drawn.svg, /<pattern id="semgraph-empty-[0-9a-f]{8}" width="8" height="8" patternUnits="userSpaceOnUse">/, drawn.name);
      if (covered('running').size > 0) assert.match(drawn.svg, /<pattern id="semgraph-running-[0-9a-f]{8}" width="4" height="4" patternUnits="userSpaceOnUse">/, drawn.name);
    }
    assert.ok(examples.some((drawn) => drawn.computed.missing.length > 0), 'an example with empty periods');
    assert.ok(examples.some((drawn) => drawn.computed.points.some((point) => point.running)), 'an example with a running period');
  });

  it('REQ-028: on a dense line the last point still shows its shape (REQ-006, REQ-008)', () => {
    const long = examples.find((drawn) => drawn.name === 'movingWindowAverage/long-horizon')!;
    assert.ok((long.datasets.points as { rel: number }[]).some((point) => point.rel === 0));
    assert.ok(long.datasets.points!.length < long.datasets.line!.length / 10, 'not a marker on every point of a dense line');
  });

  it('REQ-007: an amount is a square', () => {
    assert.equal(SHAPES.amount, 'square');
    assert.ok(examples.some((drawn) => drawn.statistic === 'sum'), 'an example shows totals');
  });

  it('REQ-009: a light area only shows spread', () => {
    const light = color(tokens, 'focus/light');
    for (const drawn of examples) {
      for (const layer of drawn.layers) {
        const mark = markOf(layer);
        if (mark.color !== light && mark.fill !== light) continue;
        assert.ok(['band', 'bars'].includes(layer.data!.name), `${drawn.name}: light colour on ${layer.data?.name}`);
      }
      // The band runs exactly from the bottom of the spread (never below zero) to its top.
      const spread = new Map(drawn.datasets.line!.map((row) => [row.rel, row.spread as { lo: number; hi: number } | null]));
      for (const row of drawn.datasets.band as { rel: number; lo: number; hi: number }[]) {
        const expected = spread.get(row.rel)!;
        assert.deepEqual([row.lo, row.hi], [Math.max(0, expected.lo), expected.hi], `${drawn.name}: band at ${row.rel}`);
      }
      // In the SVG, only an area is filled with the light colour.
      for (const match of drawn.svg.matchAll(new RegExp(`fill="${light}"`, 'g'))) {
        const container = [...drawn.svg.slice(0, match.index).matchAll(/<g class="mark-(\w+) /g)].at(-1)![1];
        assert.equal(container, 'area', `${drawn.name}: a ${container} filled with the light colour`);
      }
    }
  });
  it('REQ-029: every point is a block of time; blocks touch but never overlap, and a rolling block is one window', () => {
    for (const drawn of examples) {
      const { slots } = drawn.computed;
      slots.forEach((slot, index) => {
        if (index > 0) assert.equal(slot.first, slots[index - 1]!.fullLast + 1, `${drawn.name}: block ${slot.rel}`);
        if (typeof drawn.request.window === 'number') assert.equal(slot.last - slot.first + 1, drawn.request.window);
      });
      // Ticks mark the boundaries between blocks, labels sit in the middle of a block.
      const labels = drawn.datasets.axisLabels as { rel: number }[];
      assert.ok(labels.every((label) => Number.isInteger(label.rel)), drawn.name);
      const ticks = drawn.datasets.axisTicks as { rel: number }[];
      if (drawn.computed.slots.length <= 46) assert.ok(ticks.every((tick) => !Number.isInteger(tick.rel)), `${drawn.name}: ticks between blocks`);
    }
  });

  it('REQ-030: the last window of a rolling axis is "nu" when it ends yesterday', () => {
    for (const drawn of examples.filter((candidate) => candidate.semgraph.startsWith('movingWindow'))) {
      const last = (drawn.datasets.axisLabels as { rel: number; lines: string[] }[]).at(-1)!;
      assert.equal(last.rel, 0);
      assert.deepEqual(last.lines, [drawn.request.locale === 'en' ? 'now' : 'nu'], drawn.name);
    }
  });

  it('REQ-031: a window of one day shows the daily values, conform, without spread', () => {
    const daily = examples.find((drawn) => drawn.name === 'movingWindowAverage/daily')!;
    assert.deepEqual(daily.deviations, []);
    assert.equal(daily.drawing.readingCue, 'dagwaarden');
    assert.equal(daily.datasets.bars!.length + daily.datasets.band!.length, 0);
  });

  it('REQ-032, REQ-038 and REQ-040: every tolerated deviation is a red block between the title and the chart', () => {
    const alert = color(tokens, 'warning');
    for (const drawn of examples) {
      const deviates = drawn.deviations.length > 0;
      assert.equal(drawn.svg.includes(`fill="${alert}"`), deviates, drawn.name);
      if (deviates) {
        const alertAt = drawn.svg.indexOf(`fill="${alert}"`);
        assert.ok(alertAt > drawn.svg.indexOf(drawn.drawing.readingCue) && alertAt < drawn.svg.indexOf('class="marks"'), `${drawn.name}: between title and chart`);
      }
    }
  });

  it('REQ-042: a tolerated deviation has no footer note; only a conforming chart carries the version label', () => {
    for (const drawn of examples) {
      assert.doesNotMatch(drawn.svg, /Buiten de grafiektaal|Outside the chart language/, drawn.name);
      assert.equal(/>(grafiektaal|chart language) v0</.test(drawn.svg), drawn.deviations.length === 0, drawn.name);
    }
  });

  it('REQ-015 and REQ-048: a mouse click holds nothing open, a tap opens on a device without hover, Tab opens', () => {
    for (const drawn of examples) {
      const styles = [...drawn.svg.matchAll(/<style>(.*?)<\/style>/g)].map((match) => match[1]!);
      assert.ok(styles.length > 0, drawn.name);
      for (const style of styles) {
        // Outside the rules for touch, only :hover and :focus-visible open something: a click sets neither.
        const outsideTouch = style.replace(/@media \(hover:none\)\{(?:[^{}]*\{[^{}]*\})*\}/g, '');
        assert.doesNotMatch(outsideTouch, /:focus(?!-visible)/, drawn.name);
        assert.match(style, /:focus-visible/, drawn.name);
        assert.match(style, /@media \(hover:none\)\{[^}]*:focus /, drawn.name);
      }
    }
  });

  it('REQ-010: every contract takes the metadata of a chart', async () => {
    for (const [id, semgraph] of (await testRegistry()).semgraphs) {
      const meta = (semgraph.schema as { properties: Record<string, { properties?: Record<string, unknown> }> }).properties.meta;
      assert.deepEqual(Object.keys(meta?.properties ?? {}).sort(), ['askedBy', 'builtBy', 'compiledOn', 'query', 'question', 'references'], id);
    }
  });

  it('REQ-011: the day the chart was compiled is always in the status line, bold, next to the as-of date', () => {
    for (const drawn of examples) {
      const compiled = (drawn.request.meta as { compiledOn?: string } | undefined)?.compiledOn ?? '2026-10-01';
      const [, month, day] = compiled.split('-');
      const word = drawn.request.locale === 'en' ? 'compiled' : 'samengesteld';
      assert.ok(drawn.svg.includes(`<tspan> · </tspan><tspan font-weight="700" fill="${color(tokens, 'text')}">${word} ${day}/${month}</tspan>`), drawn.name);
    }
  });

  it('REQ-012, REQ-018 and REQ-020: a text label at the bottom left for each topic with content, and nothing for the rest', () => {
    for (const drawn of examples) {
      const meta = (drawn.request.meta ?? {}) as Record<string, unknown>;
      const english = drawn.request.locale === 'en';
      const expected = [
        ...(meta.question || meta.askedBy ? [english ? 'Question' : 'Vraag'] : []),
        ...(meta.references ? [english ? 'References' : 'Referenties'] : []),
        ...(meta.query ? ['Query'] : []),
        'Metadata',
      ];
      const labels = [...drawn.svg.matchAll(/class="semgraph-meta-item" tabindex="0" role="group" aria-label="([^"]*)"/g)].map((match) => match[1]);
      assert.deepEqual(labels, expected, drawn.name);
      // REQ-020 replaces REQ-013 and REQ-019: no dimmed or struck-through labels; no icons (REQ-018).
      assert.doesNotMatch(drawn.svg, /line-through/, drawn.name);
      // The labels lie below the footer lines, their text aligned with the footer's left edge.
      const firstLabel = /class="semgraph-meta-pill" x="([\d.]+)" y="([\d.]+)"/.exec(drawn.svg)!;
      const learnLine = /<text x="20" y="([\d.]+)"[^>]*xml:space="preserve"><tspan>(Hoe lees|How do I read)/.exec(drawn.svg)!;
      assert.equal(Number(firstLabel[1]) + 4, 20, drawn.name);
      assert.ok(Number(firstLabel[2]) > Number(learnLine[1]), drawn.name);
    }
    assert.ok(examples.some((drawn) => drawn.request.meta), 'an example with metadata');
  });

  it('REQ-014: the label itself grows into a panel over the whole chart; closing waits about 350 ms', () => {
    for (const drawn of examples) {
      const width = Number(/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="(\d+)"/.exec(drawn.svg)![1]);
      for (const markup of drawn.svg.split('<g class="semgraph-meta-item"').slice(1)) {
        // The panel is part of the label's element, so the pointer never leaves it.
        const panel = /<g class="semgraph-meta-panel" visibility="hidden" style="transform-origin:[\d.]+px [\d.]+px"><rect x="0\.5" y="0\.5" width="(\d+)" height="([\d.]+)"/.exec(markup);
        assert.ok(panel, drawn.name);
        assert.equal(Number(panel[1]), width - 1, drawn.name);
        // The hit area of the label reaches up to the bottom of the panel: no gap.
        const hit = /<rect x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="[\d.]+" fill="transparent"\/><rect class="semgraph-meta-pill"/.exec(markup)!;
        assert.equal(Number(hit[1]), Math.round((Number(panel[2]) + 0.5) * 100) / 100, drawn.name);
      }
      assert.match(drawn.svg, /\.semgraph-meta-panel\{opacity:0;transform:scale\(\.04\);transition:transform 0\.15s ease-in 0\.35s/, drawn.name);
    }
  });

  it('REQ-016: CSS in the SVG, no script; as an image the panels stay hidden and the date stays visible', () => {
    for (const drawn of examples) {
      assert.doesNotMatch(drawn.svg, /<script|\son[a-z]+="/i, drawn.name);
      // Hidden by attribute, so a renderer without CSS or interaction shows no panel.
      assert.equal(
        [...drawn.svg.matchAll(/class="semgraph-meta-panel" visibility="hidden"/g)].length,
        [...drawn.svg.matchAll(/class="semgraph-meta-item"/g)].length,
        drawn.name,
      );
      // The compiled date is in the footer, outside every panel.
      const compiledAt = drawn.svg.search(/>(samengesteld|compiled) \d\d\/\d\d</);
      assert.ok(compiledAt > 0 && compiledAt < drawn.svg.indexOf('class="semgraph-meta"'), drawn.name);
    }
  });

  it('REQ-033: the values on the chart follow the mode, centred above their point', () => {
    for (const drawn of examples) {
      const strong = drawn.datasets.valuesStrong as { rel: number; y: number }[];
      const muted = drawn.datasets.valuesMuted as { rel: number; y: number }[];
      const points = drawn.computed.points;
      const mode = drawn.computed.values;
      const familyDefault = drawn.semgraph.startsWith('calendar') ? 'lastAndPrevious' : 'last';
      // A comparison labels the ends of its lines instead (REQ-003).
      assert.equal(mode, drawn.semgraph === 'periodComparison' ? 'off' : (drawn.request.values ?? familyDefault), drawn.name);
      if (mode === 'all') assert.equal(strong.length + muted.length, points.length, drawn.name);
      else if (mode === 'off') assert.equal(strong.length + muted.length, 0, drawn.name);
      else {
        assert.ok(strong.length <= 1 && muted.length <= (mode === 'lastAndPrevious' ? 1 : 0), drawn.name);
        if (points.some((point) => point.rel === 0)) assert.equal(strong.length + muted.length >= 1, true, drawn.name);
      }
      for (const label of [...strong, ...muted]) {
        const point = points.find((candidate) => candidate.rel === label.rel)!;
        assert.ok(label.y > (point.spread?.hi ?? point.centre), `${drawn.name}: label above point ${label.rel}`);
      }
    }
    const weeks = examples.find((drawn) => drawn.name === 'calendarAverage/weeks')!;
    assert.deepEqual((weeks.datasets.valuesStrong as { rel: number }[]).map((label) => label.rel), [-1]);
    assert.deepEqual((weeks.datasets.valuesMuted as { rel: number }[]).map((label) => label.rel), [0]);
  });
  const comparisons = () => examples.filter((drawn) => drawn.computed.comparison);

  it('REQ-003: a comparison is two lines on one time axis, the earlier one grey and labelled at its end', () => {
    assert.ok(comparisons().length >= 3);
    for (const drawn of comparisons()) {
      const line = drawn.layers.find((layer) => layer.data?.name === 'comparisonLine')!;
      assert.equal(markOf(line).color, color(tokens, 'context'), drawn.name);
      assert.equal(drawn.datasets.comparisonLine!.length, drawn.computed.comparison!.points.length);
      const label = drawn.datasets.endComparison as { rel: number; text: string }[];
      assert.equal(label.length, 1, drawn.name);
      assert.equal(label[0]!.rel, drawn.computed.comparison!.points.at(-1)!.rel);
      assert.match(label[0]!.text, /^(vorig|vorige|last|previous) /);
    }
    for (const drawn of examples.filter((candidate) => !candidate.computed.comparison)) {
      assert.equal(drawn.datasets.comparisonLine!.length + drawn.datasets.hatch!.length, 0, drawn.name);
    }
  });

  it('REQ-004: only a shortfall against the comparison is hatched; a gain gets no fill', () => {
    for (const drawn of comparisons()) {
      const focus = new Map(drawn.computed.points.map((point) => [point.rel, point.centre]));
      const previous = new Map(drawn.computed.comparison!.points.map((point) => [point.rel, point.centre]));
      const rows = drawn.datasets.hatch as { rel: number; lo: number; hi: number }[];
      for (const row of rows) {
        assert.ok(row.lo <= row.hi + 1e-9, `${drawn.name}: hatch at ${row.rel}`);
        if (Number.isInteger(row.rel)) assert.deepEqual([row.lo, row.hi], [focus.get(row.rel), previous.get(row.rel)]);
      }
      for (const [rel, value] of focus) {
        const before = previous.get(rel);
        if (before !== undefined && value >= before) {
          assert.ok(!rows.some((row) => row.rel === rel && row.hi > row.lo), `${drawn.name}: a gain at ${rel} is hatched`);
        }
      }
    }
    assert.ok(comparisons().some((drawn) => drawn.datasets.hatch!.length > 0), 'an example shows a shortfall');
    // REQ-055: falling from top left to bottom right, thin and soft, on the surface colour so it covers a pattern below.
    for (const drawn of comparisons().filter((comparison) => comparison.datasets.hatch!.length > 0)) {
      assert.match(
        drawn.svg,
        new RegExp(`<pattern id="semgraph-hatch-[0-9a-f]{8}"[^>]*patternTransform="rotate\\(-45\\)"><rect [^>]*fill="${color(tokens, 'surface')}"/><line [^>]*stroke-width="1" stroke-opacity="0.75"/>`),
        drawn.name,
      );
    }
  });

  it('REQ-005: with a mean or median only the focus series has a light band; the comparison never has one', () => {
    for (const drawn of comparisons()) {
      assert.ok(drawn.computed.comparison!.points.every((point) => point.spread === null), drawn.name);
      if (drawn.statistic !== 'sum') assert.ok(drawn.datasets.band!.length > 0, `${drawn.name}: the focus series has a band`);
      assert.equal(drawn.datasets.bars!.filter((bar) => !drawn.computed.points.find((point) => point.rel === bar.rel)?.running).length, 0, drawn.name);
    }
  });

  it('REQ-035: both lines show the same value: the total, the mean or the median', () => {
    const statistic = { sum: (v: number[]) => v.reduce((a, b) => a + b, 0), mean: (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length, median: (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]! };
    for (const drawn of comparisons()) {
      const data = new Map((drawn.request.data as { day: string; value: number }[]).map((row) => [Date.parse(`${row.day}T00:00:00Z`) / 86_400_000, row.value]));
      for (const point of drawn.computed.comparison!.points) {
        const values = Array.from({ length: point.last - point.first + 1 }, (_, index) => data.get(point.first + index)!);
        const expected = statistic[drawn.statistic as 'sum' | 'mean' | 'median'](values);
        if (drawn.statistic !== 'median' || values.length % 2 === 1) assert.ok(Math.abs(point.centre - expected) < 1e-9, `${drawn.name}: ${point.rel}`);
      }
    }
  });

  it('REQ-037: the comparison is always the period just before the screen, as long as what the screen shows', () => {
    for (const drawn of comparisons()) {
      const { slots } = drawn.computed;
      const previous = drawn.computed.comparison!.slots;
      assert.equal(previous.length, slots.length, drawn.name);
      assert.ok(previous.every((slot) => slot.fullLast < slots[0]!.first), `${drawn.name}: nothing of it is on the screen`);
      assert.equal(previous.at(-1)!.fullLast + 1, slots[0]!.first, `${drawn.name}: it ends where the screen begins`);
      previous.forEach((slot, index) => assert.equal(slot.rel, slots[index]!.rel));
    }
  });
});

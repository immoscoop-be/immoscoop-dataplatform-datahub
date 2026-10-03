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
        statistic: (implementation as unknown as { statistic: { id: string } }).statistic.id,
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

  it('REQ-002: no bars on a time axis; a rectangle only outlines missing data', () => {
    for (const drawn of examples) {
      for (const layer of drawn.layers) {
        assert.notEqual(markType(layer), 'bar', `${drawn.name}: a bar on a time axis`);
        if (markType(layer) === 'rect') {
          assert.equal(layer.data?.name, 'missing', `${drawn.name}: a rectangle that is not missing data`);
          assert.equal(markOf(layer).fill, null, `${drawn.name}: missing data is outlined, not filled`);
        }
      }
    }
  });

  it('REQ-006 and REQ-008: a mean is a diamond, a median a dot; hollow while the period is running', () => {
    for (const drawn of examples) {
      const shape = markOf(pointLayer(drawn)).shape;
      assert.equal(shape, drawn.statistic === 'mean' ? 'diamond' : 'circle', drawn.name);
      const fill = pointLayer(drawn).encoding!.fill as { condition: { test: string; value: string }; value: string };
      assert.deepEqual(fill, { condition: { test: 'datum.running', value: color(tokens, 'surface') }, value: color(tokens, 'focus') });
    }
    // In the SVG: the running week of calendarAverage/weeks is a hollow diamond.
    const weeks = examples.find((drawn) => drawn.name === 'calendarAverage/weeks')!;
    assert.match(weeks.svg, /d="M-4,0L0,-4L4,0L0,4Z" fill="#ffffff" stroke="#dd2c88"/);
    const quarters = examples.find((drawn) => drawn.name === 'calendarMedian/quarters')!;
    assert.match(quarters.svg, /d="M3\.5,0A3\.5,3\.5,0,1,1,-3\.5,0A3\.5,3\.5,0,1,1,3\.5,0" fill="#dd2c88"/);
  });

  it('REQ-017: on a dense line the last point still shows its shape (REQ-006, REQ-008)', () => {
    const long = examples.find((drawn) => drawn.name === 'movingWindowAverage/long-horizon')!;
    assert.ok((long.datasets.points as { rel: number }[]).some((point) => point.rel === 0));
    assert.ok(long.datasets.points!.length < long.datasets.line!.length / 10, 'not a marker on every point of a dense line');
  });

  it('REQ-007: an amount is a square, ready for the first semgraph that shows amounts as points', () => {
    assert.equal(SHAPES.amount, 'square');
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
  it('REQ-018: every point is a block of time; blocks touch but never overlap, and a rolling block is one window', () => {
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

  it('REQ-019: the last window of a rolling axis is "nu" when it ends yesterday', () => {
    for (const drawn of examples.filter((candidate) => candidate.semgraph.startsWith('movingWindow'))) {
      const last = (drawn.datasets.axisLabels as { rel: number; lines: string[] }[]).at(-1)!;
      assert.equal(last.rel, 0);
      assert.deepEqual(last.lines, [drawn.request.locale === 'en' ? 'now' : 'nu'], drawn.name);
    }
  });

  it('REQ-020: a window of one day shows the daily values, conform, without spread', () => {
    const daily = examples.find((drawn) => drawn.name === 'movingWindowAverage/daily')!;
    assert.deepEqual(daily.deviations, []);
    assert.equal(daily.drawing.readingCue, 'dagwaarden');
    assert.equal(daily.datasets.bars!.length + daily.datasets.band!.length, 0);
  });

  it('REQ-021: a mean or median without its spread is drawn with a red alert between the title and the chart', () => {
    const alert = color(tokens, 'alert');
    for (const drawn of examples) {
      const withoutSpread = drawn.deviations.some((code) => code.endsWith('WithoutSpread'));
      assert.equal(drawn.svg.includes(`fill="${alert}"`), withoutSpread, drawn.name);
      if (withoutSpread) {
        const alertAt = drawn.svg.indexOf(`fill="${alert}"`);
        assert.ok(alertAt > drawn.svg.indexOf(drawn.drawing.readingCue) && alertAt < drawn.svg.indexOf('class="marks"'), `${drawn.name}: between title and chart`);
      }
    }
  });

  it('REQ-022: the values on the chart follow the mode, centred above their point', () => {
    for (const drawn of examples) {
      const strong = drawn.datasets.valuesStrong as { rel: number; y: number }[];
      const muted = drawn.datasets.valuesMuted as { rel: number; y: number }[];
      const points = drawn.computed.points;
      const mode = drawn.computed.values;
      assert.equal(mode, drawn.request.values ?? (drawn.semgraph.startsWith('calendar') ? 'lastAndPrevious' : 'last'), drawn.name);
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
});

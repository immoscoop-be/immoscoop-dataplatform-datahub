import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SHAPES } from '../src/charts/signatures.ts';
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

  it('REQ-006 and REQ-008: on a dense line the last point still shows its shape', () => {
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
});

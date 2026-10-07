import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SHAPES } from '../src/charts/signatures.ts';
import type { CategoryComputed } from '../src/charts/category-chart.ts';
import type { TimeAxisComputed } from '../src/charts/time-axis-chart.ts';
import { buildApp } from '../src/app.ts';
import { createTranslator } from '../src/core/i18n.ts';
import { iconShapes, readIcon } from '../src/core/icon.ts';
import { openApiDocument } from '../src/core/openapi.ts';
import { runPipeline } from '../src/core/pipeline.ts';
import { createAjv } from '../src/core/schema.ts';
import { SIZE_NAMES, SIZES } from '../src/core/size.ts';
import { textWidth } from '../src/core/render/text.ts';
import type { Drawing } from '../src/core/semgraph.ts';
import { checkThemes, color, themeOf, tokensFor, type Tokens } from '../src/core/tokens.ts';
import { cardOf, mcpCall, NOW, svgOfResult, TEST_LESSON, testRegistry, testRegistryWithLessons, textsOf } from './helpers.ts';

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
  /** Time axis (REQ-001), categories (REQ-002), the distribution of one value, or a KPI. */
  family: 'timeAxis' | 'category' | 'distribution' | 'kpi';
  statistic: string;
  request: Record<string, unknown>;
  computed: TimeAxisComputed;
  deviations: string[];
  /** Red blocks for the reader that are no deviation, such as few observations (REQ-047). */
  cautions: string[];
  drawing: Drawing;
  datasets: Record<string, Record<string, unknown>[]>;
  layers: Layer[];
  svg: string;
  /** The tokens of the theme of the example: light, or dark (REQ-094). */
  tokens: Tokens;
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
      const tokens = tokensFor(registry.tokens, themeOf(request as object));
      const drawing = implementation.draw(request, computed, { t, tokens, metadata });
      const spec = drawing.vegaLite as unknown as { datasets: Drawn['datasets']; layer: Layer[] };
      drawn.push({
        name: `${id}/${name}`,
        semgraph: id,
        // A KPI tile has the blocks of a time axis, but only its mini trend is drawn on one.
        family: id === 'kpiTile' || id === 'kpiStatus' ? 'kpi' : 'slots' in computed ? 'timeAxis' : 'rows' in computed ? 'category' : 'distribution',
        statistic: (implementation as unknown as { statistic?: { id: string } }).statistic?.id ?? String((request as { statistic: string }).statistic),
        request: request as Record<string, unknown>,
        computed: computed as TimeAxisComputed,
        deviations: result.deviations,
        cautions: result.report.issues.filter((issue) => issue.level === 'caution').map((issue) => issue.code),
        drawing,
        datasets: spec.datasets,
        layers: flatten(spec.layer),
        svg: result.svg,
        tokens,
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
/** The SVG without the hover details, which only show on hover or focus. */
/** The zigzag of a zoomed value axis (REQ-026, REQ-073): a line in the baseline colour with sharp corners. */
const ZIGZAG = /mark-line role-mark[^"]*"[^>]*><path [^>]*stroke="#6b7480"[^>]*stroke-linejoin="miter"/;
const withoutHover = (svg: string) => svg.replace(/<g class="semgraph-hover-detail".*?<\/g><\/g>/g, '');
/** The labels in the footer (REQ-012, REQ-018), by text and by topic. */
const footerLabels = (svg: string) => [...svg.matchAll(/class="semgraph-meta-label semgraph-meta-for-\w+" tabindex="0" role="button" aria-label="([^"]*)"/g)].map((match) => match[1]);
const footerKinds = (svg: string) => [...svg.matchAll(/class="semgraph-meta-label semgraph-meta-for-(\w+)" tabindex="0" role="button" aria-label="[^"]*"><rect/g)].map((match) => match[1]!);
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('requirements of the chart language', async () => {
  const examples = await drawnExamples();
  /** The examples with a time axis; the requirements of a time axis only hold for these. */
  const timeAxis = examples.filter((drawn) => drawn.family === 'timeAxis');
  const categories = examples.filter((drawn) => drawn.family === 'category');
  const kpis = examples.filter((drawn) => drawn.family === 'kpi');
  const tiles = kpis.filter((drawn) => drawn.semgraph === 'kpiTile');
  const categoryOf = (drawn: Drawn) => drawn.computed as unknown as CategoryComputed;
  const tokens = (await testRegistry()).tokens;

  it('every example is checked', () => {
    assert.ok(examples.length >= 10);
  });

  it('REQ-001: a time axis is always a line through every point, never bridging missing data', () => {
    // The mini trend of a KPI tile too.
    for (const drawn of [...timeAxis, ...tiles]) {
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

  it('REQ-002: bars only for categories, never on a date axis; on a time axis a rectangle only carries the state of a period', () => {
    for (const drawn of examples) {
      for (const layer of drawn.layers) {
        assert.notEqual(markType(layer), 'bar', drawn.name);
        if (markType(layer) !== 'rect') continue;
        if (drawn.family === 'timeAxis') {
          assert.equal(layer.data?.name, 'columns', `${drawn.name}: a rectangle that is not a data state`);
          // Over the full height of the plot, whatever the values are (REQ-049).
          assert.deepEqual([layer.encoding!.y, layer.encoding!.y2], [{ value: 0 }, { value: 200 - tokens.stroke.baseline }], drawn.name);
        } else {
          // Bars for categories, bins on a value axis, and the patterns of the data states; never a date axis.
          // A comparison stays inside one bar: what was gained and what was lost (REQ-066). Against a
          // path, a loss is hatched and what is still to be won dotted (REQ-068); the box is a label.
          assert.ok(['columns', 'bars', 'gained', 'lost', 'bins', 'open', 'toWin', 'box'].includes(layer.data!.name), `${drawn.name}: ${layer.data?.name}`);
        }
      }
      if (drawn.family === 'category') {
        for (const row of categoryOf(drawn).rows) assert.doesNotMatch(row.category, /^\d{4}(-\d{2}(-\d{2})?|-W\d{2}|-Q[1-4])?$/, drawn.name);
      }
    }
    assert.ok(categories.length >= 6, 'the six bar charts of Figma');
  });

  it('REQ-006, REQ-007 and REQ-008: a mean is a diamond, a total a square, a median a dot; always filled (REQ-052)', () => {
    for (const drawn of [...timeAxis, ...tiles]) {
      const mark = markOf(pointLayer(drawn));
      assert.equal(mark.shape, { mean: 'diamond', sum: 'square', median: 'circle', ratio: 'square' }[drawn.statistic], drawn.name);
      // A ratio is a square in a square (REQ-075): its outer square is white inside, outlined in the focus colour.
      assert.equal(drawn.statistic === 'ratio' ? mark.stroke : mark.fill, color(drawn.tokens, 'focus'), drawn.name);
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
    for (const drawn of timeAxis) {
      const columns = drawn.datasets.columns as { from: number; to: number; state: string }[];
      const running = new Set(drawn.computed.points.filter((point) => point.running).map((point) => point.rel));
      const empty = new Set(drawn.computed.missing);
      const covered = (state: string) => new Set(columns.filter((column) => column.state === state).flatMap((column) => Array.from({ length: column.to - column.from }, (_, index) => column.from + 0.5 + index)));
      assert.deepEqual([...covered('empty')].sort(), [...empty].sort(), `${drawn.name}: empty`);
      assert.deepEqual([...covered('running')].sort(), [...running].filter((rel) => !empty.has(rel)).sort(), `${drawn.name}: running`);
      assert.deepEqual([...covered('few')].sort(), [...drawn.computed.few].sort(), `${drawn.name}: few`);
      // Behind the data: the columns are drawn before the band, the line and the points.
      const order = drawn.layers.map((layer) => layer.data?.name);
      assert.ok(order.indexOf('columns') < order.indexOf('line'), drawn.name);
      // REQ-051: no outline over the chart and no label in it; only the hover names an empty period.
      assert.doesNotMatch(withoutHover(drawn.svg), />(no data|geen data)</, drawn.name);
      // REQ-050: tiles anchored to the plot, the sizes of Figma: mosaic 8 px, lines 4 px.
      if (empty.size > 0) assert.match(drawn.svg, /<pattern id="semgraph-empty-[0-9a-f]{8}(-dark)?" width="8" height="8" patternUnits="userSpaceOnUse">/, drawn.name);
      if (covered('running').size > 0) assert.match(drawn.svg, /<pattern id="semgraph-running-[0-9a-f]{8}(-dark)?" width="4" height="4" patternUnits="userSpaceOnUse">/, drawn.name);
      if (covered('few').size > 0) assert.match(drawn.svg, /<pattern id="semgraph-few-[0-9a-f]{8}(-dark)?" width="6" height="6" patternUnits="userSpaceOnUse">/, drawn.name);
    }
    assert.ok(timeAxis.some((drawn) => drawn.computed.missing.length > 0), 'an example with empty periods');
    assert.ok(timeAxis.some((drawn) => drawn.computed.points.some((point) => point.running)), 'an example with a running period');
    assert.ok(timeAxis.some((drawn) => drawn.computed.few.length > 0), 'an example with few observations');
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
    for (const drawn of timeAxis) {
      const light = color(drawn.tokens, 'focus/light');
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
    for (const drawn of timeAxis) {
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
      // Few observations is a red block too, but no deviation (REQ-047).
      const deviates = drawn.deviations.length + drawn.cautions.length > 0;
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
        assert.match(style, /@media \(hover:none\)\{[^}]*:focus[ )]/, drawn.name);
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
      assert.ok(drawn.svg.includes(`<tspan> · </tspan><tspan font-weight="700" fill="${color(drawn.tokens, 'text')}">${word} ${day}/${month}</tspan>`), drawn.name);
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
      assert.deepEqual(footerLabels(drawn.svg), expected, drawn.name);
      // REQ-020 replaces REQ-013 and REQ-019: no dimmed or struck-through labels; no icons (REQ-018).
      assert.doesNotMatch(drawn.svg, /line-through/, drawn.name);
      // The labels lie below the footer lines, their text aligned with the footer's left edge.
      const firstLabel = /class="semgraph-meta-label semgraph-meta-for-\w+" tabindex="0" role="button" aria-label="[^"]*"><rect x="([\d.]+)" y="([\d.]+)"/.exec(drawn.svg)!;
      const learnLine = /<text x="20" y="([\d.]+)"[^>]*xml:space="preserve"><tspan>(Hoe lees|How do I read)/.exec(drawn.svg)!;
      assert.equal(Number(firstLabel[1]) + 4, 20, drawn.name);
      assert.ok(Number(firstLabel[2]) > Number(learnLine[1]), drawn.name);
    }
    assert.ok(examples.some((drawn) => drawn.request.meta), 'an example with metadata');
  });

  it('REQ-014 as changed by REQ-098: a label opens a card; it stays while the pointer is over the chart and closes about 350 ms after it left', () => {
    for (const drawn of examples) {
      // Closed, a card waits 350 ms before it fades; over the card or its veil, which covers the whole chart, it stays.
      assert.ok(drawn.svg.includes('.semgraph-meta-card{opacity:0;transition:opacity 0.15s ease-in 0.35s,visibility 0s linear 0.5s}'), drawn.name);
      assert.match(drawn.svg, /@media \(hover:hover\)\{[^@]*\.semgraph-meta-card:hover\{visibility:visible;opacity:1/, drawn.name);
      // Every label in the footer opens the card of its topic.
      for (const kind of footerKinds(drawn.svg)) {
        assert.ok(drawn.svg.includes(`svg[data-semgraph]:has(.semgraph-meta-for-${kind}:hover) .semgraph-meta-card-${kind}`), `${drawn.name}: ${kind}`);
      }
    }
  });

  it('REQ-016: CSS in the SVG, no script; as an image the panels stay hidden and the date stays visible', () => {
    for (const drawn of examples) {
      assert.doesNotMatch(drawn.svg, /<script|\son[a-z]+="/i, drawn.name);
      // Hidden by attribute, so a renderer without CSS or interaction shows no card and no veil (REQ-098).
      assert.equal([...drawn.svg.matchAll(/<g class="semgraph-meta-card semgraph-meta-card-\w+" visibility="hidden"/g)].length, footerKinds(drawn.svg).length, drawn.name);
      assert.equal([...drawn.svg.matchAll(/class="semgraph-meta-veil"/g)].length, footerKinds(drawn.svg).length, drawn.name);
      // The compiled date is in the footer, outside every panel.
      const compiledAt = drawn.svg.search(/>(samengesteld|compiled) \d\d\/\d\d</);
      assert.ok(compiledAt > 0 && compiledAt < drawn.svg.indexOf('class="semgraph-meta"'), drawn.name);
    }
  });

  it('REQ-033: the values on the chart follow the mode, centred above their point', () => {
    for (const drawn of timeAxis) {
      const strong = drawn.datasets.valuesStrong as { rel: number; y: number }[];
      const muted = drawn.datasets.valuesMuted as { rel: number; y: number }[];
      const points = drawn.computed.points;
      const mode = drawn.computed.values;
      const familyDefault = drawn.semgraph.startsWith('calendar') ? 'lastAndPrevious' : 'last';
      // A ratio also labels its points with few observations (REQ-080).
      const extra = drawn.statistic === 'ratio' ? drawn.computed.few.filter((rel) => rel !== 0).length : 0;
      // A comparison labels the ends of its lines instead (REQ-003).
      assert.equal(mode, drawn.semgraph === 'periodComparison' ? 'off' : (drawn.request.values ?? familyDefault), drawn.name);
      if (mode === 'all') assert.equal(strong.length + muted.length, points.length, drawn.name);
      else if (mode === 'off') assert.equal(strong.length + muted.length, extra, drawn.name);
      else {
        assert.ok(strong.length <= 1 + extra && muted.length <= (mode === 'lastAndPrevious' ? 1 : 0), drawn.name);
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
  const comparisons = () => timeAxis.filter((drawn) => drawn.computed.comparison);

  it('REQ-003: a comparison is two lines on one time axis, the earlier one grey and labelled at its end', () => {
    assert.ok(comparisons().length >= 3);
    for (const drawn of comparisons()) {
      const line = drawn.layers.find((layer) => layer.data?.name === 'comparisonLine')!;
      assert.equal(markOf(line).color, color(drawn.tokens, 'context'), drawn.name);
      assert.equal(drawn.datasets.comparisonLine!.length, drawn.computed.comparison!.points.length);
      const label = drawn.datasets.endComparison as { rel: number; text: string }[];
      assert.equal(label.length, 1, drawn.name);
      assert.equal(label[0]!.rel, drawn.computed.comparison!.points.at(-1)!.rel);
      assert.match(label[0]!.text, /^(vorig|vorige|last|previous) /);
    }
    for (const drawn of timeAxis.filter((candidate) => !candidate.computed.comparison)) {
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
        new RegExp(`<pattern id="semgraph-hatch-[0-9a-f]{8}(-dark)?"[^>]*patternTransform="rotate\\(-45\\)"><rect [^>]*fill="${color(drawn.tokens, 'surface')}"/><line [^>]*stroke-width="1" stroke-opacity="0.75"/>`),
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
    for (const drawn of comparisons()) {
      const statistic = drawn.request.statistic as 'sum' | 'mean' | 'median';
      assert.equal(drawn.statistic, statistic, drawn.name);
      // The value before the screen comes from the same block, in the field of the same statistic (REQ-058).
      const rows = drawn.request.points as { previous?: Record<string, number | null> | null }[];
      const byRel = new Map(drawn.computed.comparison!.points.map((point) => [point.rel, point.centre]));
      const expected = rows.flatMap((row, index) => (typeof row.previous?.[statistic] === 'number' ? [row.previous[statistic]] : []));
      assert.deepEqual([...byRel.values()], expected, drawn.name);
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

  /** Means and medians of observations, whose n counts observations (REQ-063, REQ-070). */
  const perUnit = () => timeAxis.filter((drawn) => drawn.request.measureType === 'perUnit' && drawn.statistic !== 'sum');
  const blockRows = (drawn: Drawn) => drawn.request.points as Record<string, unknown>[];

  it('REQ-058: the semgraph computes nothing over days: every point is a block as the warehouse delivered it', () => {
    for (const drawn of timeAxis) {
      // A ratio only divides the numerator by the denominator (REQ-076).
      const value = (row: Record<string, unknown>) => (drawn.statistic === 'ratio' ? (row.numerator as number) / (row.denominator as number) : row[drawn.statistic]);
      const rows = blockRows(drawn).filter((row) => typeof value(row) === 'number');
      assert.deepEqual(drawn.computed.points.map((point) => point.centre), rows.map(value), drawn.name);
      // The spread too: ±1 sd around the mean, or P25–P75 around the median; none for a single day (REQ-031).
      drawn.computed.points.forEach((point, index) => {
        const row = rows[index]!;
        if (!point.spread) return;
        if (drawn.statistic === 'mean') assert.deepEqual([point.spread.lo, point.spread.hi], [(row.mean as number) - (row.sd as number), (row.mean as number) + (row.sd as number)], drawn.name);
        else assert.deepEqual([point.spread.lo, point.spread.hi], [row.p25, row.p75], drawn.name);
      });
    }
  });

  it('REQ-062: a rolling window is named after its last day, a calendar period by its ISO name', () => {
    for (const drawn of timeAxis) {
      const field = typeof drawn.request.window === 'number' ? 'end' : 'period';
      const pattern = field === 'end' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}(-W\d{2}|-\d{2}|-Q[1-4])?$/;
      for (const row of blockRows(drawn)) assert.match(String(row[field]), pattern, drawn.name);
    }
  });

  it('REQ-043, REQ-062 and REQ-063: every point of a mean or median of observations shows its n on hover; without n a red alert', () => {
    for (const drawn of perUnit()) {
      const withN = drawn.computed.points.filter((point) => point.n !== undefined);
      assert.equal(drawn.deviations.includes(`nMissing.${drawn.statistic}`), withN.length < drawn.computed.points.length, drawn.name);
      for (const point of withN) {
        const label = drawn.drawing.hover!.find((hover) => hover.x === point.rel)!.lines.map((line) => line.text).join(' ');
        assert.match(label, new RegExp(`n = ${point.n} (waarnemingen|observations)`), drawn.name);
      }
    }
    assert.ok(perUnit().some((drawn) => drawn.deviations.some((code) => code.startsWith('nMissing.'))), 'an example without n');
    // A total has no n: for a count the number is the n.
    for (const drawn of timeAxis.filter((candidate) => candidate.statistic === 'sum')) assert.ok(drawn.computed.points.every((point) => point.n === undefined), drawn.name);
  });

  it('REQ-044, REQ-054, REQ-057 and REQ-063: few observations below 30 (mean) or 10 (median), or below half the median n; never running; only for observations', () => {
    for (const drawn of timeAxis) {
      // A ratio has rules of its own (REQ-080).
      if (drawn.statistic === 'ratio') continue;
      if (!perUnit().includes(drawn)) {
        assert.deepEqual(drawn.computed.few, [], `${drawn.name}: n of days is no number of observations (REQ-057)`);
        continue;
      }
      const ns = drawn.computed.points.flatMap((point) => (point.n === undefined ? [] : [point.n])).sort((a, b) => a - b);
      const middle = ns.length % 2 ? ns[(ns.length - 1) / 2]! : (ns[ns.length / 2 - 1]! + ns[ns.length / 2]!) / 2;
      const relative = ns.length >= 5 ? middle / 2 : 0;
      const threshold = drawn.statistic === 'mean' ? 30 : 10;
      const expected = drawn.computed.points.filter((point) => point.n !== undefined && !point.running && (point.n < threshold || point.n < relative)).map((point) => point.rel);
      assert.deepEqual(drawn.computed.few, expected, drawn.name);
    }
    const few = examples.find((drawn) => drawn.name === 'calendarAverage/per-unit-few-observations')!;
    assert.deepEqual(few.computed.few, [-7, -6]);
    // The running week has n 17, but running wins (REQ-054).
    assert.ok(few.computed.points.at(-1)!.running && few.computed.points.at(-1)!.n! < 30);
  });

  it('REQ-046: the n of a point with few observations sits under the time axis, right below it; other points get nothing there', () => {
    for (const drawn of timeAxis) {
      const labels = drawn.datasets.nLabels as { rel: number; text: string }[];
      // A ratio has no n: its counts stand at the point (REQ-080).
      assert.deepEqual(labels.map((label) => label.rel), drawn.statistic === 'ratio' ? [] : drawn.computed.few, drawn.name);
      for (const label of labels) assert.equal(label.text, `n ${drawn.computed.points.find((point) => point.rel === label.rel)!.n}`, drawn.name);
      if (labels.length > 0) {
        const layer = drawn.layers.find((candidate) => candidate.data?.name === 'nLabels')!;
        assert.ok((layer.encoding!.y as { value: number }).value > 200, `${drawn.name}: below the axis`);
      }
    }
  });

  it('REQ-047: few observations is a red block for the reader, but no deviation: the version label stays', () => {
    for (const drawn of examples) {
      assert.equal(drawn.cautions.some((code) => code.startsWith('fewObservations.')), (drawn.computed.few ?? []).length > 0, drawn.name);
      if ((drawn.computed.few ?? []).length === 0) continue;
      assert.ok(drawn.svg.includes(`fill="${color(drawn.tokens, 'warning')}"`), drawn.name);
      assert.match(drawn.svg, /(Lees deze grafiek met voorzichtigheid: (weinig waarnemingen bij )?\d+ van de \d+|Read this chart with care: (few observations in )?\d+ of the \d+)/, drawn.name);
      if (drawn.deviations.length === 0) assert.match(drawn.svg, />(grafiektaal|chart language) v0</, drawn.name);
    }
  });

  it('REQ-053: a period with few observations gets dots behind its column; its shape stays filled in the focus colour', () => {
    const few = examples.find((drawn) => drawn.name === 'calendarAverage/per-unit-few-observations')!;
    const marked = (few.datasets.points as { rel: number }[]).map((point) => point.rel);
    for (const rel of few.computed.few) assert.ok(marked.includes(rel), `point ${rel} keeps its shape`);
    assert.equal(markOf(pointLayer(few)).fill, color(tokens, 'focus'));
    // REQ-097: the dots take the variable their master is bound to in Figma, context.
    assert.ok(few.svg.includes(`<rect width="6" height="6" fill="${color(tokens, 'surface')}"/><circle cx="3" cy="3" r="1.1" fill="${color(tokens, 'context')}"/></pattern>`));
    assert.match(few.svg, /<pattern id="semgraph-few-[0-9a-f]{8}" width="6" height="6" patternUnits="userSpaceOnUse">/);
  });

  it('REQ-059: the text of a chart is dark grey, grey/700, not black', () => {
    assert.equal(color(tokens, 'text'), '#3c444e');
    for (const drawn of examples) assert.match(drawn.svg, new RegExp(`font-size="15" font-weight="600" fill="${color(drawn.tokens, 'text')}"`), drawn.name);
  });

  it('REQ-060: the icon of the semgraph left of the title, 44 px, muted grey, linked to the reading card; a warning below the header', async () => {
    const registry = await testRegistry();
    for (const drawn of examples) {
      const { metadata } = registry.semgraphs.get(drawn.semgraph)!;
      const icon = new RegExp(`<a href="${metadata.links.learning.replace(/[.?]/g, '\\$&')}" aria-label="[^"]+"><svg x="20" y="12" width="44" height="44" viewBox="0 0 44 44" fill="none" color="${color(drawn.tokens, 'text/muted')}">`);
      assert.match(drawn.svg, icon, drawn.name);
      assert.match(drawn.svg, /<text x="78" y="33" font-family="Poppins/, `${drawn.name}: the title right of the icon`);
      const alert = new RegExp(`<rect x="20" y="([\\d.]+)" width="600" height="[\\d.]+" rx="3" fill="${color(drawn.tokens, 'warning')}"/>`).exec(drawn.svg);
      if (alert) assert.ok(Number(alert[1]) >= 12 + 44, `${drawn.name}: the warning below the header block, over the full width`);
    }
  });

  it('REQ-061: every icon is built from the fixed set, in one colour, and says what its semgraph shows', async () => {
    for (const [id, semgraph] of (await testRegistry()).semgraphs) {
      assert.deepEqual(readIcon(`<svg viewBox="0 0 44 44" fill="none">${semgraph.icon}</svg>`).problems, [], id);
      const shapes = iconShapes(semgraph.icon);
      // A diamond for a mean, a dot for a median, a square for an amount (REQ-006, REQ-007, REQ-008).
      const statistic = (semgraph.implementation as unknown as { statistic?: { id: string } }).statistic?.id;
      if (statistic === 'mean') assert.ok(shapes.diamonds > 0 && shapes.dots === 0, id);
      if (statistic === 'median') assert.ok(shapes.dots > 0 && shapes.diamonds === 0, id);
      // A baseline with ticks for calendar periods; a dotted line for an earlier period.
      assert.equal(/<path d="M[\d.]+ [\d.]+V[\d.]+H[\d.]+V[\d.]+(M[\d.]+ [\d.]+V[\d.]+)+" stroke=/.test(semgraph.icon), id.startsWith('calendar'), id);
      assert.equal(shapes.lineDots > 0, id === 'periodComparison', id);
    }
    assert.ok(iconShapes((await testRegistry()).semgraphs.get('periodComparison')!.icon).squares > 0);
  });

  it('REQ-064: daily uniques are never summed; the uniques over a block, counted in the warehouse, only as a total', async () => {
    const registry = await testRegistry();
    // A ratio is always measureType ratio (REQ-074).
    for (const drawn of examples.filter((candidate) => candidate.family !== 'distribution' && candidate.statistic !== 'ratio')) {
      const codes = async (uniqueAggregation: string) =>
        (await runPipeline(registry, { ...drawn.request, measureType: 'unique', uniqueAggregation }, { now: NOW, draw: false })).report.issues
          .filter((issue) => issue.level === 'refusal')
          .map((issue) => issue.code);
      const total = drawn.statistic === 'sum';
      assert.deepEqual(await codes('daily'), total ? ['dailyUniquesNotSummable'] : [], drawn.name);
      assert.deepEqual(await codes('overPeriod'), total ? [] : ['uniquesOverPeriodNotAveraged'], drawn.name);
    }
  });

  it('REQ-000 and REQ-065: bars lie down for categories without order, sorted by value, and stand up in their order', () => {
    for (const drawn of categories) {
      const computed = categoryOf(drawn);
      const ordered = drawn.request.ordered === true;
      assert.equal(computed.orientation, ordered ? 'vertical' : 'horizontal', drawn.name);
      assert.equal(drawn.drawing.hoverRows, !ordered, drawn.name);
      const order = computed.rows.map((row) => row.category);
      const given = (drawn.request.points as { category: string }[]).map((row) => row.category);
      if (ordered) assert.deepEqual(order, given, drawn.name);
      else {
        const centres = computed.rows.map((row) => row.summary?.centre ?? -Infinity);
        assert.deepEqual(centres, [...centres].sort((a, b) => b - a), `${drawn.name}: sorted by value, the largest on top`);
      }
    }
  });

  it('REQ-000 and REQ-065: an amount is a bar from zero, a median a dot in a wide bar, a mean a diamond over a thin bar; the axis from zero', () => {
    for (const drawn of categories) {
      const light = color(drawn.tokens, 'focus/light');
      const bars = drawn.datasets.bars as Record<string, number>[];
      const points = drawn.datasets.points as unknown[];
      const spread = drawn.layers.find((layer) => layer.data?.name === 'spread')!;
      if (drawn.statistic === 'sum') {
        assert.ok(bars.length > 0 && points.length === 0, drawn.name);
        // From zero: x (lying) or v (upright) starts at 0.
        for (const bar of bars) assert.equal(bar.x ?? bar.v, 0, drawn.name);
      } else {
        assert.equal(bars.length, 0, drawn.name);
        assert.equal(markOf(pointLayer(drawn)).shape, drawn.statistic === 'mean' ? 'diamond' : 'circle', drawn.name);
        assert.equal(markOf(spread).color, light, drawn.name);
        assert.equal(markOf(spread).strokeWidth, drawn.statistic === 'mean' ? tokens.stroke.spread : tokens.stroke.spreadWide, drawn.name);
      }
      // The value axis starts at zero, also for medians and means (Figma, Bar charts), unless a mean or median zooms (REQ-073).
      if (drawn.request.valueAxis !== 'zoom') assert.doesNotMatch(drawn.svg, ZIGZAG, `${drawn.name}: no zigzag`);
    }
    // Upright amounts take the ordinal ramp from light to dark, along the order.
    const ramp = categories.find((drawn) => drawn.name === 'categoryComparison/price-ranges-sum')!;
    assert.deepEqual((ramp.datasets.bars as { fill: string }[]).map((bar) => bar.fill), [1, 2, 3, 4, 5].map((step) => color(tokens, `ordinal/${step}`)));
  });

  it('REQ-000 and REQ-065: the value stands next to its shape, in the unit and precision of the axis', () => {
    const provinces = categories.find((drawn) => drawn.name === 'categoryComparison/provinces-sum')!;
    assert.deepEqual((provinces.datasets.valuesStrong as { text: string }[]).map((label) => label.text), ['1,8k', '1,5k', '1,1k', '0,9k', '0,6k']);
    const median = categories.find((drawn) => drawn.name === 'categoryComparison/provinces-median')!;
    assert.equal((median.datasets.valuesStrong as { text: string }[])[0]!.text, '€ 390k');
    assert.equal((median.datasets.valuesDetail as { text: string }[])[0]!.text, '300–510k');
    const mean = categories.find((drawn) => drawn.name === 'categoryComparison/price-ranges-mean')!;
    assert.deepEqual((mean.datasets.detailAbove as { text: string }[]).map((label) => label.text), ['± 28 d', '± 18 d', '± 20 d', '± 28 d', '± 40 d']);
    for (const drawn of categories) {
      const labels = [...(drawn.datasets.valuesStrong ?? []), ...(drawn.datasets.valuesAbove ?? []), ...(drawn.datasets.valuesBeside ?? [])];
      assert.equal(labels.length, categoryOf(drawn).rows.length - categoryOf(drawn).missing.length, `${drawn.name}: every value written`);
    }
  });

  it('REQ-066 and REQ-067: a sum compares inside one bar: light shared, focus gained, hatched lost, a dark cap for now', async () => {
    const registry = await testRegistry();
    const compared = categories.filter((drawn) => categoryOf(drawn).comparison);
    assert.deepEqual([...new Set(compared.map((drawn) => categoryOf(drawn).orientation))].sort(), ['horizontal', 'vertical'], 'lying and upright, as in Figma');
    for (const drawn of compared) {
      const rows = categoryOf(drawn).rows.filter((row) => row.summary && typeof row.previous === 'number');
      const layer = (name: string) => markOf(drawn.layers.find((candidate) => candidate.data?.name === name)!);
      // The bar from zero to now is light, what both periods share; upright too, without the ordinal ramp.
      for (const bar of drawn.datasets.bars as Record<string, number | string>[]) {
        assert.equal(bar.x ?? bar.v, 0, `${drawn.name}: from zero`);
        assert.equal(bar.fill ?? layer('bars').color, color(drawn.tokens, 'focus/light'), drawn.name);
      }
      assert.equal(layer('gained').color, color(drawn.tokens, 'focus'), drawn.name);
      assert.match(String(layer('lost').fill), /^url\(#semgraph-hatch-/, `${drawn.name}: a loss is hatched (REQ-004, REQ-055)`);
      assert.equal(layer('caps').color, color(drawn.tokens, 'text'), drawn.name);
      const span = (row: Record<string, number>) => [row.x ?? row.v, row.x2 ?? row.v2];
      const gained = (drawn.datasets.gained as Record<string, number>[]).map(span);
      const lost = (drawn.datasets.lost as Record<string, number>[]).map(span);
      assert.deepEqual(gained, rows.filter((row) => row.summary!.centre > row.previous!).map((row) => [row.previous, row.summary!.centre]), drawn.name);
      assert.deepEqual(lost, rows.filter((row) => row.summary!.centre < row.previous!).map((row) => [row.summary!.centre, row.previous]), drawn.name);
      assert.equal((drawn.datasets.caps as unknown[]).length, categoryOf(drawn).rows.length - categoryOf(drawn).missing.length, `${drawn.name}: a cap on every bar`);
      // REQ-037, REQ-067: the label names what it is compared with; neither is on the screen.
      assert.match(drawn.drawing.readingCue, /tegenover vorig jaar|vs last year/, drawn.name);
      for (const hover of drawn.drawing.hover.filter((spec) => spec.point)) assert.ok(hover.lines.some((line) => /^(verschil|difference): [▲▼=]/.test(line.text)), drawn.name);
    }
    // The difference stands under the value, with an arrow, in the unit and precision of the axis (Figma).
    const provinces = categories.find((drawn) => drawn.name === 'categoryComparison/provinces-sum-vs-last-year')!;
    assert.deepEqual((provinces.datasets.valuesDetail as { text: string }[]).map((label) => label.text), ['▲ 0,2k', '▲ 0,08k', '▼ 0,08k', '▲ 0,05k', '▼ 0,08k']);
    // Without a choice, the default follows Figma: last year for 28 days and longer, the period before for 7 and 14 days.
    const kinds = async (patch: Record<string, unknown>) => {
      const request = { ...provinces.request, ...patch };
      const semgraph = registry.semgraphs.get('categoryComparison')!;
      return (semgraph.implementation.compute(request, { now: NOW }) as CategoryComputed).comparison?.kind;
    };
    assert.equal(await kinds({}), 'lastYear');
    assert.equal(await kinds({ window: 14 }), 'previousPeriod');
    assert.equal(await kinds({ window: 7 }), 'previousPeriod');
    assert.equal(await kinds({ window: 91 }), 'lastYear');
    assert.equal(await kinds({ window: undefined, period: '2026-09' }), 'lastYear');
    assert.equal(await kinds({ window: 7, comparison: 'lastYear' }), 'lastYear');
  });

  it('REQ-073: an amount is a bar from zero; a mean or median may zoom, with a zigzag and a bold first value', async () => {
    const registry = await testRegistry();
    const zoomed = categories.find((drawn) => drawn.name === 'categoryComparison/provinces-median-zoomed')!;
    assert.match(zoomed.svg, ZIGZAG, 'a zigzag at the start of the baseline');
    assert.match(zoomed.svg, /font-weight="bold"[^>]*>€ 200k</, 'the first value is bold');
    assert.doesNotMatch(zoomed.svg, />€ 0</);
    for (const drawn of categories.filter((candidate) => candidate.statistic === 'sum')) {
      const result = await runPipeline(registry, { ...drawn.request, valueAxis: 'zoom' }, { now: NOW });
      assert.doesNotMatch(result.svg!, ZIGZAG, `${drawn.name}: a bar starts at zero`);
      assert.ok(result.report.issues.some((issue) => issue.level === 'info' && issue.code === 'valueAxisZoomIgnored'), drawn.name);
    }
  });

  it('REQ-065 and REQ-067: a KPI tile is one number with a mandatory comparison, and a mini trend with a baseline and its first and last period', async () => {
    const registry = await testRegistry();
    assert.ok(tiles.length >= 3, 'the KPI tile of Figma, a mean, and a short window');
    for (const drawn of tiles) {
      const computed = drawn.computed;
      const last = computed.points.find((point) => point.rel === 0)!;
      // The number is the last block; the difference has an arrow, the absolute size and its share.
      assert.equal((drawn.datasets.number as { text: string }[])[0]!.text.replace(/[^\d,.]/g, '').length > 0, true, drawn.name);
      const comparison = (drawn.datasets.comparison as { text: string }[]).map((line) => line.text).join(' ');
      assert.match(comparison, /^[▲▼=] [\d,.k]+ \([+−]\d+%\) (tegenover|vs) /, drawn.name);
      // Even the mini trend has a baseline and labels for its first and last period (Figma).
      assert.equal((drawn.datasets.baseline as unknown[]).length, 1, drawn.name);
      assert.deepEqual((drawn.datasets.ends as { rel: number }[]).map((end) => end.rel), [computed.slots[0]!.rel, 0], drawn.name);
      // Last year is a grey shadow line under the trend; the period before is already on it (REQ-037).
      const shadow = drawn.datasets.shadow as unknown[];
      const lastYear = (drawn.request.comparison ?? (drawn.request.window !== undefined && Number(drawn.request.window) <= 14 ? 'previousPeriod' : 'lastYear')) === 'lastYear';
      assert.equal(shadow.length > 0, lastYear, drawn.name);
      assert.equal((drawn.datasets.legend as unknown[]).length > 0, lastYear, drawn.name);
      assert.equal(markOf(drawn.layers.find((layer) => layer.data?.name === 'shadow')!).color, color(drawn.tokens, 'context'), drawn.name);
      // A mean or median shows its spread next to the number.
      assert.equal((drawn.datasets.spread as unknown[]).length > 0, last.spread !== null, drawn.name);
    }
    const figma = tiles.find((drawn) => drawn.name === 'kpiTile/rolling-28d')!;
    assert.deepEqual((figma.datasets.number as { text: string }[]).map((line) => line.text), ['2,4k']);
    assert.match((figma.datasets.comparison as { text: string }[]).map((line) => line.text).join(' '), /^▲ 180 \(\+8%\) tegenover vorig jaar$/);
    const week = tiles.find((drawn) => drawn.name === 'kpiTile/rolling-7d')!;
    assert.match((week.datasets.comparison as { text: string }[]).map((line) => line.text).join(' '), /vs previous 7 days$/);
    // No number without its comparison, and no tile without its number.
    const points = figma.request.points as Record<string, unknown>[];
    const codes = async (rows: Record<string, unknown>[]) =>
      (await runPipeline(registry, { ...figma.request, points: rows }, { now: NOW, draw: false })).report.issues.filter((issue) => issue.level === 'refusal').map((issue) => issue.code);
    assert.deepEqual(await codes(points.map((row, index) => (index === points.length - 1 ? { ...row, previous: null } : row))), ['kpiComparisonMissing']);
    assert.deepEqual(await codes(points.map((row, index) => (index === points.length - 1 ? { ...row, sum: null } : row))), ['kpiValueMissing']);
  });

  it('REQ-065, REQ-068 and REQ-069: a KPI status puts the real staircase against the fixed path; a loss is hatched, what is still to be won dotted', () => {
    const drawn = kpis.find((candidate) => candidate.name === 'kpiStatus/leads-since-launch')!;
    const texts = (name: string) => (drawn.datasets[name] as { text: string }[]).map((label) => label.text);
    // REQ-069: the warehouse delivers the levels; the chart only takes differences.
    assert.deepEqual(texts('added'), ['2,4k', '2,5k', '2,7k', '1,1k', '2,2k', '1,8k', '1,5k', '1,4k'], 'what each period added');
    assert.deepEqual(texts('deltas'), ['−0,5k', '−0,9k', '−1,2k', '−1,3k'], 'each step against the planned step');
    assert.deepEqual((drawn.datasets.futureLabels as { text: string; note: string }[]).map((label) => [label.text, label.note]), [['6,4k', 'incl. inhaal']], 'the catch-up');
    assert.deepEqual(texts('paceLabels'), ['2,7k/mnd'], 'one label for a linear path');
    assert.deepEqual(texts('current'), ['115,6k']);
    assert.match(drawn.svg, />Δ \+14,4k</);
    assert.match(drawn.svg, />6,4k in sep · daarna 2,7k\/mnd</);
    assert.match(drawn.svg, />doel 130k · 31\/12</);
    // Colour roles: magenta is done, teal is to do.
    const mark = (name: string) => markOf(drawn.layers.find((layer) => layer.data?.name === name)!);
    assert.equal(mark('risers').color, color(tokens, 'focus'));
    assert.equal(mark('done').color, color(tokens, 'focus/subtle'));
    for (const name of ['pastPath', 'futurePath']) {
      assert.equal(mark(name).color, color(tokens, 'target'), name);
      assert.ok(Array.isArray(mark(name).strokeDash), `${name}: dotted`);
    }
    // The path was set at planning and starts there: it never moves.
    const path = drawn.datasets.pastPath as { rel: number }[];
    assert.equal(path[0]!.rel, 3 + 0.5 - 11, 'from the end of April, when it was set');
    // REQ-004, REQ-055: only a shortfall is hatched, densely.
    assert.match(String(mark('lost').fill), /^url\(#semgraph-hatch-/);
    for (const band of drawn.datasets.lost as { value: number; value2: number }[]) assert.ok(band.value < band.value2);
    // REQ-068: what is still to be won is a new pattern, dots that just touch; never hatching.
    assert.match(String(mark('toWin').fill), /^url\(#semgraph-towin-/);
    const pattern = /<pattern id="semgraph-towin-[^"]*" width="(\d+)"[^>]*>(.*?)<\/pattern>/.exec(drawn.svg)!;
    assert.ok(pattern, 'the dots are defined');
    assert.doesNotMatch(pattern[2]!, /<line/);
    assert.equal(Number(/<circle [^>]*r="([\d.]+)"/.exec(pattern[2]!)![1]) * 2, Number(pattern[1]), 'the dots just touch');
    // Axis from the KPI start, with a zigzag; the start value bold.
    assert.match(drawn.svg, ZIGZAG);
    assert.match(drawn.svg, /font-weight="bold"[^>]*>100k</);
    // A team ahead of its path: no hatching, the deltas positive, and no catch-up.
    const ahead = kpis.find((candidate) => candidate.name === 'kpiStatus/weeks-ahead')!;
    assert.equal((ahead.datasets.lost as unknown[]).length, 0);
    assert.ok((ahead.datasets.deltas as { text: string }[]).every((label) => label.text.startsWith('+')));
    assert.equal((ahead.datasets.futureLabels as { note: string }[])[0]!.note, '');
  });

  it('REQ-043, REQ-046 and REQ-053 for categories: n on hover; few observations get dots behind their column and their n under it', () => {
    const few = categories.find((drawn) => drawn.name === 'categoryComparison/price-ranges-median')!;
    assert.deepEqual(categoryOf(few).few, [4]);
    assert.deepEqual(few.cautions, ['fewObservations.median']);
    assert.deepEqual((few.datasets.columns as { state: string }[]).map((column) => column.state), ['few']);
    assert.deepEqual((few.datasets.nLabels as { text: string }[]).map((label) => label.text), ['n 8']);
    for (const drawn of categories.filter((candidate) => candidate.request.measureType === 'perUnit')) {
      for (const hover of drawn.drawing.hover) assert.ok(hover.lines.some((line) => /^n = /.test(line.text)), drawn.name);
    }
  });

  it('REQ-000 and REQ-065: a distribution has equal bins that touch, P25, P50 and P75 as guides, and the tail in one grey open bin', () => {
    const drawn = examples.find((candidate) => candidate.name === 'distribution/asking-price')!;
    const bins = drawn.datasets.bins as { x: number; x2: number }[];
    bins.forEach((bin, index) => {
      if (index > 0) assert.equal(bin.x, bins[index - 1]!.x2, 'touching');
      assert.equal(bin.x2 - bin.x, drawn.request.binWidth);
    });
    const guides = drawn.datasets.guides as { x: number; median: boolean }[];
    assert.deepEqual(guides.map((guide) => guide.x), [261000, 312000, 408000]);
    assert.deepEqual(guides.map((guide) => guide.median), [false, true, false]);
    assert.deepEqual((drawn.datasets.guideMedian_center as { text: string }[]).map((label) => label.text), ['€ 312k']);
    const open = drawn.layers.find((layer) => layer.data?.name === 'open')!;
    assert.equal(markOf(open).color, color(tokens, 'context'));
    assert.deepEqual((drawn.datasets.openAxis as { lines: string[] }[])[0]!.lines, ['≥ P95', '€ 900k']);
    assert.equal(drawn.drawing.readingCue, 'verdeling · per € 50k');
    // Set apart: a gap between the last bin and the open one.
    assert.ok((drawn.datasets.open as { x: number }[])[0]!.x > bins.at(-1)!.x2);
  });

  const ratioCharts = timeAxis.filter((drawn) => drawn.statistic === 'ratio');
  type RatioPoint = { rel: number; centre: number; parts: { numerator: number; denominator: number } };
  const ratioPoints = (drawn: Drawn) => drawn.computed.points as unknown as RatioPoint[];
  /** The height of each block of the denominator, in the units of the ratio axis, by position. */
  const baseOf = (drawn: Drawn) => new Map((drawn.datasets.base as { rel: number; value: number }[]).map((row) => [row.rel, row.value]));

  it('REQ-074: a ratio is a numerator divided by a denominator, drawn only by a ratio chart; every other chart refuses it', async () => {
    const registry = await testRegistry();
    assert.deepEqual([...new Set(ratioCharts.map((drawn) => drawn.semgraph))].sort(), ['calendarRatio', 'movingWindowRatio']);
    for (const drawn of timeAxis) {
      const refusals = async (measureType: string) =>
        (await runPipeline(registry, { ...drawn.request, measureType }, { now: NOW, draw: false })).report.issues.filter((issue) => issue.level === 'refusal').map((issue) => issue.code);
      if (drawn.statistic === 'ratio') {
        assert.equal(drawn.request.measureType, 'ratio', drawn.name);
        assert.deepEqual(await refusals('perUnit'), ['measureTypeNotAllowed'], drawn.name);
      } else assert.ok((await refusals('ratio')).includes('ratioNeedsNumerator'), drawn.name);
    }
  });

  it('REQ-075: a ratio is a square in a square: an open square in the focus colour around a small filled one', () => {
    for (const drawn of timeAxis) {
      const marks = drawn.layers.filter((layer) => layer.data?.name === 'points').map(markOf);
      if (drawn.statistic !== 'ratio') {
        assert.equal(marks.length, 1, drawn.name);
        continue;
      }
      const [outer, inner] = marks as [Record<string, unknown>, Record<string, unknown>];
      assert.deepEqual([outer.shape, outer.fill, outer.stroke], ['square', color(drawn.tokens, 'surface'), color(drawn.tokens, 'focus')], drawn.name);
      assert.deepEqual([inner.shape, inner.fill], ['square', color(drawn.tokens, 'focus')], drawn.name);
      assert.ok((inner.size as number) < (outer.size as number) / 4, `${drawn.name}: the numerator is small inside the denominator`);
    }
  });

  it('REQ-076: a ratio over time is one chart: the ratio as a line, the denominator as a grey step area behind it, on a right axis; the numerator only in words', () => {
    assert.ok(ratioCharts.length > 0);
    for (const drawn of ratioCharts) {
      const order = drawn.layers.map((layer) => layer.data?.name);
      assert.ok(order.indexOf('base') > order.indexOf('columns') && order.indexOf('base') < order.indexOf('line'), `${drawn.name}: the denominator behind the data`);
      const area = drawn.layers.find((layer) => layer.data?.name === 'base' && markType(layer) === 'area')!;
      assert.deepEqual([markOf(area).interpolate, markOf(area).color], ['step', color(drawn.tokens, 'axis')], drawn.name);
      // One flat block per period, as high as its denominator on the right axis: one scale for every block.
      const base = baseOf(drawn);
      const perUnit = ratioPoints(drawn).map((point) => base.get(point.rel)! / point.parts.denominator);
      for (const value of perUnit) assert.ok(Math.abs(value - perUnit[0]!) < 1e-12, drawn.name);
      for (const point of ratioPoints(drawn)) assert.equal(base.get(point.rel - 0.5) ?? base.get(point.rel), base.get(point.rel), `${drawn.name}: flat over ${point.rel}`);
      // The numerator is not drawn: it stands with the labelled values and on hover, "27 / 640".
      const details = (drawn.datasets.valuesDetail as { rel: number; text: string }[]).map((label) => label.text);
      assert.ok(details.length > 0 && details.every((text) => /^[\d., ]+ \/ [\d., ]+$/.test(text)), drawn.name);
      const names = `${drawn.request.numeratorName} / ${drawn.request.denominatorName}`;
      assert.ok(drawn.drawing.readingCue.includes(names), drawn.name);
      for (const point of ratioPoints(drawn)) {
        const hover = drawn.drawing.hover!.find((spec) => spec.x === point.rel)!;
        assert.ok(hover.lines.some((line) => line.text.startsWith(`${names}: `)), `${drawn.name}: the counts on hover at ${point.rel}`);
      }
    }
  });

  it('REQ-077: a filled step on a date axis only for the denominator of a ratio, in neutral grey, never for the metric itself', () => {
    for (const drawn of [...timeAxis, ...tiles]) {
      for (const layer of drawn.layers) {
        const mark = markOf(layer);
        if (!String(mark.interpolate ?? '').startsWith('step')) continue;
        assert.equal(layer.data?.name, 'base', `${drawn.name}: a step on ${layer.data?.name}`);
        if (markType(layer) === 'area') assert.equal(mark.color, color(drawn.tokens, 'axis'), drawn.name);
      }
    }
    // kpiStatus draws its cumulative level as a staircase (REQ-065, REQ-068): an open point against REQ-077.
  });

  it('REQ-078: a light area in the focus colour is spread, in neutral grey it is the base of a ratio; never the other way round', () => {
    for (const drawn of timeAxis) {
      const light = color(drawn.tokens, 'focus/light');
      const grey = color(drawn.tokens, 'axis');
      for (const layer of drawn.layers.filter((candidate) => markType(candidate) === 'area')) {
        const fill = markOf(layer).color ?? markOf(layer).fill;
        if (fill === light) assert.equal(layer.data?.name, 'band', drawn.name);
        if (fill === grey) assert.equal(layer.data?.name, 'base', drawn.name);
        if (layer.data?.name === 'base') assert.equal(fill, grey, drawn.name);
      }
      if (drawn.statistic === 'ratio') assert.equal(drawn.computed.withSpread, false, `${drawn.name}: a ratio has no spread`);
    }
  });

  it('REQ-079: both axes start at zero and share their gridlines; the denominator stays below the ratio; the right axis is quieter', () => {
    for (const drawn of ratioCharts) {
      const left = drawn.layers.find((layer) => layer.data?.name === 'frame')!;
      const ticks = (left.encoding!.y as { axis: { values: number[] } }).axis.values;
      assert.equal(ticks[0], 0, `${drawn.name}: the ratio axis from zero`);
      const right = drawn.datasets.rightAxis as { value: number; text: string }[];
      assert.deepEqual(right.map((tick) => tick.value), ticks, `${drawn.name}: one set of gridlines`);
      assert.equal(right[0]!.text, '0', `${drawn.name}: the denominator axis from zero`);
      const base = baseOf(drawn);
      for (const point of ratioPoints(drawn).filter((candidate) => candidate.centre > 0)) {
        assert.ok(base.get(point.rel)! < point.centre, `${drawn.name}: the denominator under the ratio at ${point.rel}`);
      }
      // REQ-105, REQ-106: on hover nothing is drawn over the data; the counts are read in the readout.
      for (const point of ratioPoints(drawn)) assert.match(drawn.drawing.hover!.find((spec) => spec.x === point.rel)!.readout!.extra ?? '', /: [\d.,]+ \/ [\d.,]+/, drawn.name);
      const rightLayer = drawn.layers.find((layer) => layer.data?.name === 'rightAxis')!;
      assert.equal(markOf(rightLayer).color, color(drawn.tokens, 'context'), `${drawn.name}: lighter labels`);
      assert.equal(drawn.layers.filter((layer) => markType(layer) === 'point' && layer.data?.name !== 'points' && layer.data?.name !== 'frame').length, 0, `${drawn.name}: no shapes on the right axis`);
    }
  });

  it('REQ-080: few observations of a ratio: statistically thin or an unusual base; dots behind the column, the counts at the point', () => {
    const thin = ratioCharts.find((drawn) => drawn.name === 'movingWindowRatio/few-qualified')!;
    assert.deepEqual([thin.computed.few, thin.cautions], [[-4], ['fewObservations.ratio.thin']]);
    const base = ratioCharts.find((drawn) => drawn.name === 'calendarRatio/weeks')!;
    assert.deepEqual([base.computed.few, base.cautions], [[-5], ['fewObservations.ratio.base']]);
    for (const drawn of ratioCharts) {
      assert.deepEqual((drawn.datasets.columns as { state: string }[]).filter((column) => column.state === 'few').length, drawn.computed.few.length, drawn.name);
      const labelled = new Set((drawn.datasets.valuesDetail as { rel: number }[]).map((label) => label.rel));
      const baseLabels = new Set((drawn.datasets.baseLabels as { rel: number }[]).map((label) => label.rel));
      for (const rel of drawn.computed.few) assert.ok(labelled.has(rel) && baseLabels.has(rel), `${drawn.name}: the counts of ${rel} at the point`);
    }
    assert.match(base.svg, /Read this chart with care: 1 of the 10 weeks rest on far fewer visitors than the weeks around them\./);
  });

  it('REQ-082: the icon of a ratio over time: a line of squares in a square over a step line; with calendar periods the baseline with ticks', async () => {
    for (const [id, semgraph] of (await testRegistry()).semgraphs) {
      const ratio = (semgraph.implementation as unknown as { statistic?: { id: string } }).statistic?.id === 'ratio';
      const outlined = [...semgraph.icon.matchAll(/<path d="M[\d.]+ [\d.]+H[\d.]+V[\d.]+H[\d.]+V[\d.]+Z" stroke="currentColor"/g)].length;
      const steps = /<path d="M[\d.]+ [\d.]+V[\d.]+(H[\d.]+V[\d.]+){3,}" stroke=/.test(semgraph.icon);
      assert.equal(outlined > 0 && iconShapes(semgraph.icon).squares === outlined, ratio, `${id}: squares in a square`);
      assert.equal(steps, ratio, `${id}: the denominator as a step line`);
    }
  });

  it('REQ-084: every example is in the OpenAPI document as a request of its semgraph, and valid against the contract there', async () => {
    const registry = await testRegistry();
    const document = openApiDocument(registry) as { components: { schemas: Record<string, object>; examples: Record<string, { value: unknown }> } };
    const ajv = createAjv();
    // Every example, also the ones that show a refusal: they are drawn on /gallery, not here.
    for (const [id, semgraph] of registry.semgraphs) {
      const validate = ajv.compile(document.components.schemas[`${id}Request`]!);
      for (const [name, request] of semgraph.examples) {
        const example = document.components.examples[`${id}.${name}`];
        assert.deepEqual(example?.value, request, `${id}/${name}`);
        assert.ok(validate(example!.value), `${id}/${name}: ${ajv.errorsText(validate.errors)}`);
      }
    }
  });

  it('REQ-085: every chart in every size: built at its width, enlarged for a slide or a big screen, its axis labels apart; the KPI tile has one size', async () => {
    const registry = await testRegistry();
    for (const [id, semgraph] of registry.semgraphs) {
      for (const [name, example] of semgraph.examples) {
        const { size: _size, ...request } = example as Record<string, unknown>;
        const plain = await runPipeline(registry, request, { now: NOW });
        if (id === 'kpiTile') {
          // A tile keeps its size wherever it stands.
          assert.equal((await runPipeline(registry, { ...request, size: 'card' }, { now: NOW, draw: false })).report.outcome, 'invalid', `${id}/${name}`);
          continue;
        }
        for (const size of SIZE_NAMES) {
          const label = `${id}/${name} ${size}`;
          const sized = { ...request, size };
          const result = await runPipeline(registry, sized, { now: NOW });
          assert.equal(result.report.outcome, plain.report.outcome, label);
          assert.deepEqual(result.warnings, [], label);
          if (size === 'default') assert.equal(result.svg, plain.svg, `${label}: the default is the chart without a size`);
          if (!result.svg) continue;
          const { layout, scale } = SIZES[size];
          const [, width, height, viewWidth, viewHeight] = /^<svg [^>]*width="([\d.]+)" height="([\d.]+)" viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(result.svg)!.map(Number);
          assert.deepEqual([width, viewWidth, height], [Math.round(layout * scale), layout, Math.ceil(viewHeight! * scale)], label);
          // The labels of a time axis never touch: on a card there are fewer of them.
          const { implementation } = semgraph;
          const t = createTranslator(registry.locales, result.report.locale);
          const drawing = implementation.draw(sized as never, implementation.compute(sized as never, { now: NOW }), { t, tokens: registry.tokens, metadata: semgraph.metadata });
          const spec = drawing.vegaLite as unknown as { datasets: Record<string, { rel: number; lines: string[] }[]>; layer: Layer[] };
          const labels = spec.datasets.axisLabels;
          if (!labels || !drawing.plotArea) continue;
          const domain = (flatten(spec.layer).find((layer) => (layer.encoding?.x as { scale?: { domain?: number[] } } | undefined)?.scale?.domain)!.encoding!.x as { scale: { domain: [number, number] } }).scale.domain;
          const perSlot = drawing.plotArea.width / (domain[1] - domain[0]);
          const widthOf = (item: { lines: string[] }) => Math.max(...item.lines.map((line) => textWidth(line, registry.tokens.size.axisLabel)));
          const sorted = [...labels].sort((a, b) => a.rel - b.rel);
          for (let index = 1; index < sorted.length; index++) {
            const [a, b] = [sorted[index - 1]!, sorted[index]!];
            assert.ok((b.rel - a.rel) * perSlot >= (widthOf(a) + widthOf(b)) / 2 + 2, `${label}: ${a.lines[0]} and ${b.lines[0]} touch`);
          }
        }
      }
    }
  });

  it('REQ-090: through MCP every example gets the outcome and the chart of the core, as through REST', async () => {
    const registry = await testRegistry();
    const app = await buildApp({ registry, now: () => NOW, logger: false, mcp: { mode: 'open' } });
    for (const [id, semgraph] of registry.semgraphs) {
      for (const [name, request] of semgraph.examples) {
        const label = `${id}/${name}`;
        const core = await runPipeline(registry, request, { now: NOW });
        const { result } = await mcpCall(app, 'tools/call', { name: 'render_semgraph', arguments: { request } });
        assert.equal(result._meta['semgraph/report'].outcome, core.report.outcome, label);
        assert.deepEqual(result._meta['semgraph/report'].issues, core.report.issues, label);
        assert.equal(svgOfResult(result), core.svg, label);
      }
    }
    await app.close();
  });

  it('REQ-092: every chart reaches the app as drawn, within what Claude passes on, and Claude gets the report, not the SVG', async () => {
    const registry = await testRegistry();
    const app = await buildApp({ registry, now: () => NOW, logger: false, mcp: { mode: 'open' } });
    const { result: list } = await mcpCall(app, 'tools/list');
    const render = list.tools.find((tool: { name: string }) => tool.name === 'render_semgraph');
    assert.equal(render._meta.ui.resourceUri, 'ui://semgraph/chart.html');
    for (const drawn of await drawnExamples()) {
      const { result } = await mcpCall(app, 'tools/call', { name: 'render_semgraph', arguments: { request: drawn.request } });
      assert.equal(svgOfResult(result), drawn.svg, drawn.name);
      // Claude passes on a tool result of about 150,000 characters; the gzipped chart stays well under it.
      assert.ok(JSON.stringify(result).length < 100_000, `${drawn.name}: ${JSON.stringify(result).length} characters`);
      for (const content of result.content) assert.doesNotMatch(content.text, /<svg/, drawn.name);
      // The chart paints its own background, in the colours of its theme (REQ-094).
      const [, width, height] = /^<svg [^>]*viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(drawn.svg)!;
      assert.ok(drawn.svg.includes(`<rect width="${width}" height="${height}" fill="${color(drawn.tokens, 'surface')}"/>`), drawn.name);
    }
    await app.close();
  });

  it('REQ-093: every contract takes the meta that Claude fills in, and the chart shows it', async () => {
    const registry = await testRegistry();
    const meta = { question: 'How many credit leads per day?', query: 'SELECT day, COUNT(*) FROM leads GROUP BY day', askedBy: 'Hannelore', compiledOn: '2026-10-01' };
    for (const drawn of await drawnExamples()) {
      const result = await runPipeline(registry, { ...drawn.request, meta }, { now: NOW });
      assert.equal(result.report.outcome, (await runPipeline(registry, drawn.request, { now: NOW })).report.outcome, drawn.name);
      const t = createTranslator(registry.locales, result.report.locale);
      for (const key of ['meta.question', 'meta.query']) assert.ok(result.svg!.includes(`>${t(key)}<`), `${drawn.name}: ${t(key)}`);
      assert.ok(result.svg!.includes('Hannelore'), drawn.name);
    }
  });

  it('REQ-094: every chart also dark: the same chart in the colours of the mode Dark, and nothing of the mode Light', async () => {
    const registry = await testRegistry();
    const light = registry.tokens;
    const dark = tokensFor(light, 'dark');
    assert.deepEqual(checkThemes(light), []);
    // Only what the mode Light has and the mode Dark not; white stays for the text on the red alert (REQ-040).
    const lightOnly = new Set(Object.values(light.color).filter((value) => !Object.values(dark.color).includes(value) && value !== '#ffffff'));
    for (const [id, semgraph] of registry.semgraphs) {
      for (const [name, request] of semgraph.examples) {
        if ((request as { theme?: string }).theme !== undefined) continue;
        const label = `${id}/${name}`;
        const [day, night] = await Promise.all([runPipeline(registry, request, { now: NOW }), runPipeline(registry, { ...(request as object), theme: 'dark' }, { now: NOW })]);
        assert.equal(night.report.outcome, day.report.outcome, label);
        assert.deepEqual(night.report.issues, day.report.issues, label);
        if (!day.svg) continue;
        const root = (svg: string) => /^<svg [^>]*width="([\d.]+)" height="([\d.]+)"/.exec(svg)!.slice(1);
        assert.deepEqual(root(night.svg!), root(day.svg), `${label}: the same size`);
        assert.match(night.svg!, /^<svg [^>]* data-theme="dark">/, label);
        const [, width, height] = /^<svg [^>]*viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(night.svg!)!;
        assert.ok(night.svg!.includes(`<rect width="${width}" height="${height}" fill="${color(dark, 'surface')}"/>`), `${label}: the dark surface`);
        for (const value of lightOnly) assert.ok(!night.svg!.toLowerCase().includes(value.toLowerCase()), `${label}: ${value} of the mode Light`);
        // Light and dark of one chart can share a page: their patterns have ids of their own (REQ-036).
        for (const [, patternId] of night.svg!.matchAll(/<pattern id="([^"]+)"/g)) assert.match(patternId!, /-dark$/, label);
      }
    }
  });

  it('REQ-097: the patterns take the Figma variables of their masters, in Light and Dark; few observations stands out most', async () => {
    const registry = await testRegistry();
    // As the masters in Figma: the mosaic and the fine lines in context/light, the dots in context, on surface.
    const expected = (theme: Tokens) => ({
      empty: [color(theme, 'surface'), color(theme, 'context/light')],
      running: [color(theme, 'surface'), color(theme, 'context/light')],
      few: [color(theme, 'surface'), color(theme, 'context')],
    });
    const contrast = (a: string, b: string) => Math.abs(luminance(a) - luminance(b));
    for (const theme of [registry.tokens, tokensFor(registry.tokens, 'dark')]) {
      const { empty, running, few } = expected(theme);
      // Empty and running share their colour and differ in shape; few stands out most, as in REQ-096.
      assert.ok(contrast(empty[1]!, empty[0]!) === contrast(running[1]!, running[0]!) && contrast(running[1]!, running[0]!) < contrast(few[1]!, few[0]!));
    }
    let seen = 0;
    for (const drawn of examples) {
      const colours = expected(drawn.tokens);
      for (const state of ['empty', 'running', 'few'] as const) {
        for (const [, body] of drawn.svg.matchAll(new RegExp(`<pattern id="semgraph-${state}-[0-9a-f]{8}(?:-dark)?"[^>]*>(.*?)</pattern>`, 'g'))) {
          const used = [...body!.matchAll(/(?:fill|stroke)="(#[0-9a-f]{6})"/g)].map((match) => match[1]);
          assert.deepEqual([...new Set(used)], colours[state], `${drawn.name}: ${state}`);
          seen++;
        }
      }
    }
    assert.ok(seen > 0);
    for (const state of ['empty', 'running', 'few']) {
      assert.ok(examples.some((drawn) => drawn.request.theme === 'dark' && new RegExp(`semgraph-${state}-[0-9a-f]{8}-dark`).test(drawn.svg)), `a dark example with ${state}`);
    }
  });

  it('REQ-098: a card lies on a veil over the whole chart, in the surface colour of its theme, about 80% opaque', () => {
    for (const drawn of examples) {
      const [, width, height] = /^<svg [^>]*viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(drawn.svg)!;
      const veils = [...drawn.svg.matchAll(/<rect class="semgraph-meta-veil" width="([\d.]+)" height="([\d.]+)" fill="(#[0-9a-f]{6})" fill-opacity="0\.82"\/>/g)];
      assert.equal(veils.length, footerKinds(drawn.svg).length, drawn.name);
      for (const [, w, h, fill] of veils) assert.deepEqual([w, h, fill], [width, height, color(drawn.tokens, 'surface')], drawn.name);
      // The cards come after everything else, so a card and its veil lie on top, the footer included.
      const lastFooterLabel = Math.max(...[...drawn.svg.matchAll(/class="semgraph-meta-label semgraph-meta-for-\w+" tabindex="0"/g)].map((match) => match.index));
      assert.ok(drawn.svg.indexOf('semgraph-meta-veil') > lastFooterLabel, drawn.name);
    }
  });

  it('REQ-099: every card has the same anatomy: eyebrow, title, sections between thin lines, and the row of labels with the active one underlined', () => {
    for (const drawn of examples) {
      const [, width] = /^<svg [^>]*viewBox="0 0 ([\d.]+)/.exec(drawn.svg)!;
      const labels = footerLabels(drawn.svg);
      for (const kind of footerKinds(drawn.svg)) {
        const card = cardOf(drawn.svg, kind)!;
        const label = `${drawn.name}: ${kind}`;
        // 540 wide and centred, at least 20 from the edge; on a narrow chart (a card or the tile) all but 16 (REQ-085).
        const box = /<g class="semgraph-meta-box" tabindex="-1" transform="translate\(([\d.]+),([\d.]+)\)"><rect x="0\.5" y="0\.5" width="([\d.]+)" height="[\d.]+" rx="10" fill="([^"]+)" stroke="([^"]+)" stroke-width="1"\/>/.exec(card);
        assert.ok(box, label);
        const cardWidth = Number(box[3]) + 1;
        assert.equal(cardWidth, Number(width) < 500 ? Number(width) - 32 : Math.min(540, Number(width) - 40), label);
        assert.equal(Number(box[1]), (Number(width) - cardWidth) / 2, label);
        assert.deepEqual([box[4], box[5]], [color(drawn.tokens, 'surface'), color(drawn.tokens, 'context/light')], label);
        // The eyebrow in capitals, bold and spaced in the dark focus colour; the title of the chart in Poppins.
        const texts = textsOf(card);
        assert.match(card, new RegExp(`font-size="10" font-weight="700" letter-spacing="0.8" fill="${color(drawn.tokens, 'focus/dark')}">[^<a-z]+</text>`), label);
        if (kind !== 'learn') assert.ok(drawn.drawing.title.startsWith(texts.find((text, index) => index > 2 && text.length > 0)!.replace(/…$/, '')), label);
        // Thin lines in context/light, section labels in capitals.
        assert.match(card, new RegExp(`<line x1="24" x2="[\\d.]+" y1="[\\d.]+" y2="[\\d.]+" stroke="${color(drawn.tokens, 'context/light')}" stroke-width="1"/>`), label);
        // The row: every label, the active one underlined in the focus colour, the others switch to their card.
        const row = texts.slice(-labels.length - 1).filter((text) => labels.includes(text));
        assert.deepEqual(row, labels, label);
        assert.match(card, new RegExp(`height="1.5" fill="${color(drawn.tokens, 'focus')}"/>`), label);
        assert.equal([...card.matchAll(/class="semgraph-meta-label semgraph-meta-for-\w+ semgraph-meta-switch" tabindex="-1"/g)].length, labels.length - 1, label);
      }
      // A label in a card opens its card without closing first: the card it was in steps aside.
      assert.ok(drawn.svg.includes('.semgraph-meta-card:has(.semgraph-meta-switch:hover){visibility:hidden!important'), drawn.name);
      // How to close, for the mouse and for touch.
      assert.match(drawn.svg, /@media \(hover:none\)\{[^@]*\.semgraph-meta-mouse\{display:none\}\.semgraph-meta-touch\{display:inline\}\}/, drawn.name);
    }
  });

  it('REQ-100: the Query card shows only the title of the chart and the SQL, in Roboto Mono on its own surface', async () => {
    const registry = await testRegistry();
    let seen = 0;
    for (const drawn of examples) {
      const query = (drawn.request.meta as { query?: string } | undefined)?.query;
      const card = cardOf(drawn.svg, 'query');
      assert.equal(card !== undefined, Boolean(query), drawn.name);
      if (!card) continue;
      const t = createTranslator(registry.locales, (drawn.request.locale as string | undefined) ?? 'nl-BE');
      // One section, SQL; no parameters.
      const sections = [...card.matchAll(/letter-spacing="0.8" fill="[^"]+">([^<]+)<\/text>/g)].map((match) => match[1]);
      assert.deepEqual(sections, ['QUERY', t('meta.section.sql').toLocaleUpperCase()], drawn.name);
      assert.match(card, new RegExp(`<rect x="24" y="[\\d.]+" width="[\\d.]+" height="[\\d.]+" rx="6" fill="${color(drawn.tokens, 'badge/surface')}"/>`), drawn.name);
      // The first line of the query, as written, in the monospaced font at 11.
      const first = query!.split(/\r?\n/)[0]!.trimEnd();
      assert.match(card, new RegExp(`font-family="&apos;Roboto Mono&apos;[^"]*" font-size="11" fill="[^"]+" xml:space="preserve">${escapeRegExp(first.slice(0, 20).replaceAll("'", '&apos;'))}`), drawn.name);
      seen++;
    }
    assert.ok(seen > 0);
  });

  it('REQ-101 and REQ-104: Metadata: the parameters straight from the request, the data, and who made it next to the service', async () => {
    const registry = await testRegistry();
    for (const drawn of examples) {
      const t = createTranslator(registry.locales, (drawn.request.locale as string | undefined) ?? 'nl-BE');
      const card = cardOf(drawn.svg, 'metadata')!;
      assert.ok(card, drawn.name);
      const texts = textsOf(card);
      const sections = [...card.matchAll(/letter-spacing="0.8" fill="[^"]+">([^<]+)<\/text>/g)].map((match) => match[1]);
      const upper = (key: string) => t(`meta.section.${key}`).toLocaleUpperCase();
      assert.deepEqual(sections.slice(1), [upper('parameters'), upper('data'), upper('made'), upper('service')].slice(0, sections.length - 1), drawn.name);
      const value = (key: string) => {
        const index = texts.indexOf(t(`meta.field.${key}`));
        return index < 0 ? undefined : texts[index + 1];
      };
      // A card that does not fit its chart, such as on the size card, is cut (REQ-014): what is shown is right.
      const cut = texts.includes('…');
      const equal = (actual: string | undefined, expected: string | undefined, label: string) => {
        if (!cut || actual !== undefined) assert.equal(actual, expected, label);
      };
      // The type is the semgraph; every other parameter only when the request gives it, as given.
      assert.equal(value('type'), drawn.semgraph, drawn.name);
      for (const key of ['metric', 'unit', 'statistic', 'comparison', 'period', 'day']) {
        const given = drawn.request[key];
        equal(value(key), typeof given === 'string' ? given : undefined, `${drawn.name}: ${key}`);
      }
      const window = drawn.request.window as number | undefined;
      equal(value('window'), window === undefined ? undefined : window === 1 ? t('meta.oneDay') : t('meta.days', { n: window }), drawn.name);
      // No filter and no period of a time series: no contract has them (REQ-104).
      assert.ok(!texts.includes('Filter'), drawn.name);
      // Made: by whom only with builtBy, and the compiled day; the owner stays in the footer.
      const meta = (drawn.request.meta ?? {}) as { builtBy?: string };
      equal(value('builtBy'), meta.builtBy, drawn.name);
      if (!cut || value('compiled')) assert.match(value('compiled') ?? '', /^\d\d\/\d\d\/\d{4}$/, drawn.name);
      equal(value('semgraph'), `v${registry.version}`, drawn.name);
    }
  });

  it('REQ-102 and REQ-103: without a lesson no Learn label and the icon links to the reading card; with one, Learn opens from the label and the icon', async () => {
    const plain = await testRegistry();
    for (const drawn of examples) {
      assert.ok(!drawn.svg.includes('semgraph-meta-for-learn'), drawn.name);
      assert.match(drawn.svg, new RegExp(`<a href="${plain.semgraphs.get(drawn.semgraph)!.metadata.links.learning.replace(/[.?]/g, '\\$&')}" aria-label="[^"]+"><svg x="20" y="12"`), drawn.name);
    }
    const registry = await testRegistryWithLessons();
    for (const drawn of examples) {
      const result = await runPipeline(registry, drawn.request, { now: NOW });
      const svg = result.svg!;
      const t = createTranslator(registry.locales, result.report.locale);
      const learning = registry.semgraphs.get(drawn.semgraph)!.metadata.links.learning;
      // Learn is the last label; the icon is one more label of Learn instead of a link.
      assert.equal(footerLabels(svg).at(-1), t('meta.learn'), drawn.name);
      assert.match(svg, /<g class="semgraph-meta-label semgraph-meta-for-learn" tabindex="0" role="button" aria-label="[^"]+"><svg x="20" y="12" width="44"/, drawn.name);
      assert.ok(!svg.includes(`<a href="${learning}" aria-label`), drawn.name);
      // The card: the kind of chart as its title, what you see, the signs, watch out, and the full reading card.
      const card = cardOf(svg, 'learn')!;
      const texts = textsOf(card);
      // On a narrow chart the title takes two lines.
      assert.ok(texts.join(' ').includes(TEST_LESSON.title), drawn.name);
      const sections = [...card.matchAll(/letter-spacing="0.8" fill="[^"]+">([^<]+)<\/text>/g)].map((match) => match[1]);
      const upper = (key: string) => t(`meta.section.${key}`).toLocaleUpperCase();
      const signs = drawn.drawing.signs ?? [];
      assert.deepEqual(sections.slice(1), [upper('whatYouSee'), ...(signs.length > 0 ? [upper('signs')] : []), upper('watchOut')].slice(0, sections.length - 1), drawn.name);
      // Unless the card was cut to fit its chart (REQ-014), it ends with the full reading card.
      if (!texts.includes('…')) assert.ok(card.includes(`<a href="${learning}">`), drawn.name);
    }
  });

  it('REQ-105: a time axis reads its values in one fixed spot; on the data only a guide and a ring, the date on the axis', () => {
    for (const drawn of timeAxis) {
      const [, width] = /^<svg [^>]*viewBox="0 0 ([\d.]+)/.exec(drawn.svg)!;
      const layer = /<g class="semgraph-hover">\n<g class="semgraph-hover-rest" pointer-events="none">(.*?)<\/g>/.exec(drawn.svg);
      assert.ok(layer, `${drawn.name}: the readout at rest`);
      // At rest the latest value.
      const latest = drawn.computed.points.at(-1)!;
      assert.equal(textsOf(layer[1]!)[0], drawn.drawing.hover.find((spec) => spec.x === latest.rel)!.readout!.value, drawn.name);
      // Right aligned at the right edge of a wide chart; on a narrow one left aligned, at 13.
      if (Number(width) >= 500) assert.match(layer[1]!, /text-anchor="end"[^>]*font-size="16" font-weight="bold"/, drawn.name);
      else assert.match(layer[1]!, /^<text x="[-\d.]+" y="[-\d.]+" font-family="[^"]+" font-size="13" font-weight="bold"/, drawn.name);
      for (const spec of drawn.drawing.hover) {
        assert.ok(spec.readout?.date, `${drawn.name}: a date for ${spec.x}`);
        assert.equal(spec.readout!.value, spec.point ? spec.lines[1]!.text.split(': ').at(-1) : '–', drawn.name);
      }
      // No box over the data: only the dotted guide, the ring and the date label in a column.
      const details = [...drawn.svg.matchAll(/<g class="semgraph-hover-detail" visibility="hidden" pointer-events="none">(.*?)<\/g><\/g>/g)].map((match) => match[1]!);
      assert.equal(details.length, drawn.drawing.hover.length, drawn.name);
      for (const detail of details) {
        assert.equal([...detail.matchAll(/<line /g)].length, 1, drawn.name);
        assert.doesNotMatch(detail, /<rect [^>]*stroke=/, `${drawn.name}: no box`);
        assert.match(detail, new RegExp(`rx="3" fill="${color(drawn.tokens, 'text')}"/><text [^>]*font-weight="bold" fill="${color(drawn.tokens, 'surface')}">`), `${drawn.name}: the date`);
      }
    }
  });

  it('REQ-106: the labels at the points stay; whatever else the box said stands on a second line, and every line in the aria-label', () => {
    for (const drawn of timeAxis) {
      // REQ-033 and REQ-003 as they were: the value labels are still drawn.
      if (drawn.request.values !== 'off') assert.ok((drawn.datasets.valuesStrong ?? []).length + (drawn.datasets.valuesMuted ?? []).length + (drawn.datasets.endValue ?? []).length > 0, drawn.name);
      for (const spec of drawn.drawing.hover) {
        const label = drawn.svg.includes(`aria-label="${spec.lines.map((line) => line.text).join(', ').replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"`);
        assert.ok(label, `${drawn.name}: every line in the aria-label of ${spec.x}`);
        // Every line beyond the name, the value, the spread and the window or period is on the second line.
        const extra = spec.readout!.extra ?? '';
        for (const line of spec.lines.slice(1)) {
          if (/^(n = |lopend|running|vorige periode|previous period|geen data|no data)/.test(line.text)) assert.ok(extra.includes(line.text), `${drawn.name}: ${line.text}`);
        }
      }
    }
  });

  it('REQ-107: the gallery links every drawn example in every size, light and dark; the KPI tile only light and dark', async () => {
    const registry = await testRegistry();
    const app = await buildApp({ registry, now: () => NOW, logger: false, mcp: { mode: 'off' } });
    const html = (await app.inject('/gallery?locale=nl-BE')).body;
    for (const drawn of examples) {
      const href = `/semgraphs/${drawn.semgraph}/examples/${drawn.name.split('/')[1]}`;
      const sized = 'size' in ((registry.semgraphs.get(drawn.semgraph)!.schema as { properties: object }).properties);
      for (const theme of ['light', 'dark']) {
        const links = sized ? SIZE_NAMES.map((size) => `${href}?theme=${theme}&amp;size=${size}`) : [`${href}?theme=${theme}`];
        for (const link of links) assert.ok(html.includes(`<a href="${link}">`), `${drawn.name}: ${link}`);
      }
      if (!sized) assert.ok(!html.includes(`${href}?theme=light&amp;size=`), drawn.name);
    }
    // A refused example has no other sizes or modes.
    assert.ok(!html.includes('/semgraphs/movingWindowAverage/examples/unique-without-aggregation?theme='));
    // The links draw what they say: the size of REQ-085 and the mode of REQ-094, also against what the example asks.
    const svgOf = async (url: string) => (await app.inject(url)).body;
    const card = await svgOf('/semgraphs/calendarAverage/examples/weeks-dark?theme=light&size=card');
    assert.match(card, /^<svg [^>]*width="360"/);
    assert.doesNotMatch(card, /data-theme="dark"/);
    assert.match(await svgOf('/semgraphs/movingWindowAverage/examples/basic?theme=dark&size=xl'), /^<svg [^>]*width="1920"[^>]*data-theme="dark"/);
    assert.match(await svgOf('/semgraphs/kpiTile/examples/rolling-28d?theme=dark'), /data-theme="dark"/);
    assert.equal((await app.inject('/semgraphs/kpiTile/examples/rolling-28d?size=large')).statusCode, 400);
    assert.equal((await app.inject('/semgraphs/movingWindowAverage/examples/basic?size=huge')).statusCode, 400);
    await app.close();
  });

  it('REQ-102: Signs in this chart lists only the signs the chart really drew', () => {
    const shapes: Record<string, string> = { mean: 'diamond', median: 'circle', sum: 'square', ratio: 'squareInSquare' };
    const seen = new Set<string>();
    for (const drawn of examples) {
      const signs = (drawn.drawing.signs ?? []).map((sample) => sample.sign);
      signs.forEach((sign) => seen.add(sign));
      const has = (pattern: string) => new RegExp(`<pattern id="semgraph-${pattern}-[0-9a-f]{8}`).test(drawn.svg);
      const points = (drawn.datasets.points ?? []).length > 0;
      // The shape of the series, unless it is a bar (an amount per category) or there is no series of points.
      const shape = drawn.semgraph === 'kpiStatus' || drawn.family === 'distribution' || (drawn.family === 'category' && drawn.statistic === 'sum') || !points ? undefined : shapes[drawn.statistic];
      const expected = [
        ...(shape ? [shape] : []),
        ...(['running', 'few', 'empty'] as const).filter((state) => has(state)),
        ...(has('hatch') ? ['loss'] : []),
        ...((drawn.datasets.zigzag ?? []).length > 0 ? ['zigzag'] : []),
      ];
      assert.deepEqual([...signs].sort(), expected.sort(), drawn.name);
    }
    // The examples show every sign at least once.
    for (const sign of ['square', 'circle', 'diamond', 'squareInSquare', 'running', 'few', 'empty', 'loss', 'zigzag']) assert.ok(seen.has(sign), sign);
  });
});

/** Relative luminance of a colour, for the order of the patterns. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

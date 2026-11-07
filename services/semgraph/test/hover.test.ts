import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { runPipeline } from '../src/core/pipeline.ts';
import { HoverLayer, type HoverSpec } from '../src/core/render/hover.ts';
import { example, NOW, testRegistry } from './helpers.ts';

const PLOT = { width: 560, height: 200 };
const { tokens } = await testRegistry();

async function svgOf(request: unknown): Promise<string> {
  const { svg, warnings } = await runPipeline(await testRegistry(), request, { now: NOW });
  assert.deepEqual(warnings, []);
  return svg!;
}

interface Column {
  label: string;
  rect: { x: number; width: number };
  detail: string;
  ring?: { cx: number; cy: number; r: number };
  box?: { x: number; y: number; width: number; height: number };
  guides: { x1: number; x2: number; y1: number; y2: number }[];
  texts: string[];
}

const number = (text: string, name: string) => Number(new RegExp(`\\b${name}="([^"]+)"`).exec(text)![1]);
const textsOf = (markup: string) => [...markup.matchAll(/<text [^>]*>([^<]*)<\/text>/g)].map((match) => match[1]!);

/** The hover columns as the SVG contains them. */
function columns(svg: string): Column[] {
  return [...svg.matchAll(/<g class="semgraph-hover-column" tabindex="0" role="img" aria-label="([^"]*)">(<rect [^>]*\/>)(<g class="semgraph-hover-detail" visibility="hidden" pointer-events="none">.*?)<\/g><\/g>/g)].map(
    ([, label, rect, detail]) => {
      const ring = /<circle [^>]*\/>/.exec(detail!)?.[0];
      // The box of a chart without a time axis has a stroke; the date of REQ-105 is a filled label.
      const box = /<rect [^>]*stroke=[^>]*\/>/.exec(detail!)?.[0];
      return {
        label: label!,
        rect: { x: number(rect!, 'x'), width: number(rect!, 'width') },
        detail: detail!,
        ...(ring ? { ring: { cx: number(ring, 'cx'), cy: number(ring, 'cy'), r: number(ring, 'r') } } : {}),
        ...(box ? { box: { x: number(box, 'x'), y: number(box, 'y'), width: number(box, 'width'), height: number(box, 'height') } } : {}),
        guides: [...detail!.matchAll(/<line [^>]*\/>/g)].map(([line]) => ({
          x1: number(line, 'x1'),
          x2: number(line, 'x2'),
          y1: number(line, 'y1'),
          y2: number(line, 'y2'),
        })),
        texts: textsOf(detail!),
      };
    },
  );
}

/** The readout at rest (REQ-105). */
const restOf = (svg: string) => textsOf(/<g class="semgraph-hover-rest" pointer-events="none">(.*?)<\/g>/.exec(svg)![1]!);

/** Where Vega drew the dots: filled ones and hollow (running) ones, in plot coordinates. */
function vegaDots(svg: string): { x: number; y: number }[] {
  return [...svg.matchAll(/<path transform="translate\(([-\d.]+),([-\d.]+)\)" d="[^"]*" fill="(#dd2c88|#ffffff)" stroke="(#ffffff|#dd2c88)"/g)].map(
    ([, x, y]) => ({ x: Number(x), y: Number(y) }),
  );
}

describe('hover', () => {
  it('gives every slot a full-height column, also a slot without data', async () => {
    const found = columns(await svgOf(await example('missing-days')));
    assert.equal(found.length, 7);
    assert.equal(found.filter((column) => !column.ring).length, 1);
    // The columns tile the plot without gaps or overlap.
    found.forEach((column, index) => {
      if (index > 0) assert.ok(Math.abs(column.rect.x - (found[index - 1]!.rect.x + found[index - 1]!.rect.width)) < 0.01);
    });
  });

  it('keeps every line of the specification in the aria-label of its column (REQ-027, REQ-106)', async () => {
    const found = columns(await svgOf(await example('basic')));
    assert.equal(found[5]!.label, '23 sep (−7d), gemiddelde 7d: 43,7, ±1 sd: 12,2, venster 17–23 sep');
    assert.equal(found[6]!.label, '30 sep (nu), gemiddelde 7d: 45,9, ±1 sd: 11,3, venster 24–30 sep');
    const missing = columns(await svgOf(await example('missing-days')));
    assert.equal(missing[4]!.label, '16 Sep (−14d), no data');
    const median = columns(await svgOf(await example('quarters', 'calendarMedian')));
    assert.equal(median[0]!.label, 'K2 2025, mediaan per dag: 46,0, P25–P75: 32,0–50,0');
    const weeks = columns(await svgOf(await example('weeks', 'calendarAverage')));
    assert.equal(weeks.at(-1)!.label, 'week 40 (28 sep–4 okt), gemiddelde per dag: 53,7, ±1 sd: 2,1, lopend: 3 van 7 dagen');
  });

  it('places the ring on Vega’s own point, closer than 0.01 px', async () => {
    for (const request of [await example('basic'), await example('weeks', 'calendarAverage'), await example('zoomed')]) {
      const svg = await svgOf(request);
      const dots = vegaDots(svg);
      const rings = columns(svg).flatMap((column) => (column.ring ? [column.ring] : []));
      assert.equal(rings.length, dots.length);
      rings.forEach((ring, index) => {
        assert.ok(Math.abs(ring.cx - dots[index]!.x) < 0.01, `x ${ring.cx} vs ${dots[index]!.x}`);
        assert.ok(Math.abs(ring.cy - dots[index]!.y) < 0.01, `y ${ring.cy} vs ${dots[index]!.y}`);
      });
    }
  });

  it('REQ-105: on a time axis nothing is drawn over the data but a dotted guide over the plot and a ring of 14 px; no box', async () => {
    for (const request of [await example('basic'), await example('weeks', 'calendarAverage'), await example('few-qualified', 'movingWindowRatio')]) {
      for (const column of columns(await svgOf(request))) {
        assert.equal(column.box, undefined);
        assert.equal(column.guides.length, 1);
        const [guide] = column.guides;
        assert.deepEqual([guide!.y1, guide!.y2], [0, PLOT.height]);
        assert.match(column.detail, /<line [^>]*stroke-dasharray="2 3"\/>/);
        if (column.ring) assert.equal(column.ring.r, 7);
        if (column.ring) assert.equal(guide!.x1, column.ring.cx);
      }
    }
  });

  it('REQ-105: the value in one fixed spot: the latest at rest, the value under the pointer on hover, the date on the time axis', async () => {
    const svg = await svgOf(await example('basic'));
    assert.deepEqual(restOf(svg), ['45,9', 'laatste · 30 sep']);
    const found = columns(svg);
    // The date over the label of its period, then the value, its spread and its window.
    assert.deepEqual(found[5]!.texts, ['23 sep', '43,7', '± 12,2 · venster 17–23 sep']);
    // Every readout stands at the same coordinates as the one at rest, so nothing jumps.
    const at = (markup: string) => /<text x="([-\d.]+)" y="([-\d.]+)" text-anchor="end"[^>]*font-size="16" font-weight="bold"/.exec(markup)!.slice(1);
    const rest = /<g class="semgraph-hover-rest" pointer-events="none">(.*?)<\/g>/.exec(svg)![1]!;
    for (const column of found) assert.deepEqual(at(column.detail), at(rest));
    // The date is a dark label under the point, over the labels of the time axis.
    const date = /<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="[\d.]+" rx="3" fill="#3c444e"\/><text [^>]*font-weight="bold" fill="#ffffff">23 sep</.exec(found[5]!.detail)!;
    assert.ok(Math.abs(Number(date[1]) + Number(date[3]) / 2 - found[5]!.ring!.cx) < 0.01, 'centred under the point');
    assert.ok(Number(date[2]) > PLOT.height, 'under the plot');
    // The readout stands at the right of the header, right aligned on the right edge of the chart.
    const plot = /<g transform="translate\(([\d.]+),([\d.]+)\)">\n<style>/.exec(svg)!;
    assert.equal(Number(at(rest)[0]) + Number(plot[1]), 620);
  });

  it('REQ-106: whatever else there is to know stands on a second line: n, running, no data, the counts and the comparison', async () => {
    const weeks = columns(await svgOf(await example('weeks', 'calendarAverage')));
    assert.deepEqual(weeks.at(-1)!.texts.slice(1), ['53,7', '± 2,1 · week 40 (28 sep–4 okt)', 'lopend: 3 van 7 dagen']);
    const few = columns(await svgOf(await example('per-unit-few-observations', 'calendarAverage')));
    assert.ok(few.some((column) => column.texts.includes('n = 58 waarnemingen')));
    const missing = columns(await svgOf(await example('missing-days')));
    assert.deepEqual(missing[4]!.texts, ['16 Sep', '–', 'window 10–16 Sep', 'no data']);
    const ratio = columns(await svgOf(await example('few-qualified', 'movingWindowRatio')));
    assert.ok(ratio[6]!.texts.at(-1)!.startsWith('gekwalificeerde leads / leads: '), ratio[6]!.texts.join(' | '));
    const comparison = columns(await svgOf(await example('weeks-sum', 'periodComparison')));
    assert.equal(comparison.at(-1)!.texts.at(-1), 'lopend: 3 van 7 dagen · vorige periode, week 28 (6–12 jul): 135');
  });

  it('REQ-105: on a narrow chart the readout has a line of its own under the reading cue, left aligned', async () => {
    const svg = await svgOf(await example('weeks-card', 'calendarAverage'));
    const rest = /<g class="semgraph-hover-rest" pointer-events="none">(.*?)<\/g>/.exec(svg)![1]!;
    assert.match(rest, /<text x="[-\d.]+" y="[-\d.]+" font-family="[^"]+" font-size="13" font-weight="bold"/);
    assert.doesNotMatch(rest, /text-anchor="end"/);
  });

  it('is shown by CSS following the device rules (REQ-015, REQ-048), with prefixed classes, and hidden without CSS', async () => {
    const svg = await svgOf(await example('basic'));
    const style = /<style>(.*?)<\/style>/.exec(svg)![1]!;
    // The mouse hovers, the keyboard focuses visibly; a click sets :focus but not :focus-visible, so it holds nothing open.
    assert.match(style, /\.semgraph-hover-column:hover \.semgraph-hover-detail,\.semgraph-hover-column:focus-visible \.semgraph-hover-detail\{visibility:visible\}/);
    assert.doesNotMatch(style.replace(/@media \(hover:none\)\{.*?\}\}/, ''), /:focus[^-]/);
    // On a device without hover a tap focuses and opens; a tap elsewhere takes the focus away and closes.
    assert.match(style, /@media \(hover:none\)\{\.semgraph-hover-column:focus \.semgraph-hover-detail\{visibility:visible\}/);
    // REQ-105: never two values at once: the readout at rest hides while a column is shown.
    assert.match(style, /\.semgraph-hover:hover \.semgraph-hover-rest,\.semgraph-hover:has\(\.semgraph-hover-column:focus-visible\) \.semgraph-hover-rest\{visibility:hidden\}/);
    for (const selector of style.replace(/@media [^{]+\{/g, '').matchAll(/(^|[},])([^{},]+)\{/g)) assert.match(selector[2]!.trim(), /^\.semgraph-hover/);
    // Every detail starts hidden and lets the pointer through to the next column.
    assert.equal([...svg.matchAll(/class="semgraph-hover-detail" visibility="hidden" pointer-events="none"/g)].length, 7);
    assert.equal([...svg.matchAll(/class="semgraph-hover-column" tabindex="0"/g)].length, 7);
    assert.doesNotMatch(svg, /\sid="/);
    assert.doesNotMatch(svg, /<script/);
  });
});

describe('hover box, for charts without a time axis', () => {
  // A plot of 560 × 200; the value 0 at the bottom, 100 at the top.
  const scales = { x: (value: number) => 40 + value * 80, y: (value: number) => 200 - value * 2 };
  const draw = (specs: HoverSpec[]) => columns(new HoverLayer(tokens, PLOT, scales).render(specs));
  const spec = (x: number, y: number, lo: number, hi: number): HoverSpec => ({ x, point: { y, lo, hi }, lines: [{ text: 'name', bold: true }, { text: `value: ${y}` }] });

  it('draws guides through the column and from the axis to the centre and both spread edges, never below zero', () => {
    const [column] = draw([spec(2, 10, -20, 40)]);
    const [vertical, ...horizontal] = column!.guides;
    assert.deepEqual([vertical!.y1, vertical!.y2], [0, PLOT.height]);
    assert.equal(horizontal.length, 3);
    for (const guide of horizontal) assert.deepEqual([guide.x1, guide.x2], [0, column!.ring!.cx]);
    // The lower edge, −20, is drawn at zero.
    assert.ok(horizontal.some((guide) => guide.y1 === PLOT.height));
  });

  it('puts the box above the spread when there is room, below it otherwise, always inside the plot', () => {
    const [low, high] = draw([spec(1, 20, 15, 25), spec(5, 90, 80, 99)]);
    assert.ok(low!.box!.y + low!.box!.height <= scales.y(25), 'above the spread');
    assert.ok(high!.box!.y >= scales.y(80), 'below the spread');
    for (const { box } of [low!, high!]) {
      assert.ok(box!.x >= 0 && box!.x + box!.width <= PLOT.width + 1e-9);
      assert.ok(box!.y >= 0 && box!.y + box!.height <= PLOT.height + 1e-9);
    }
  });
});

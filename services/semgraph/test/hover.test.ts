import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runPipeline } from '../src/core/pipeline.ts';
import { example, NOW, series, testRegistry } from './helpers.ts';

const PLOT = { width: 560, height: 200 };

async function svgOf(request: unknown): Promise<string> {
  const { svg, warnings } = await runPipeline(await testRegistry(), request, { now: NOW });
  assert.deepEqual(warnings, []);
  return svg!;
}

interface Column {
  label: string;
  rect: { x: number; width: number };
  detail: string;
  ring?: { cx: number; cy: number };
  box: { x: number; y: number; width: number; height: number };
  guides: { x1: number; x2: number; y1: number; y2: number }[];
  bold: string[];
}

const number = (text: string, name: string) => Number(new RegExp(`\\b${name}="([^"]+)"`).exec(text)![1]);

/** The hover columns as the SVG contains them. */
function columns(svg: string): Column[] {
  return [...svg.matchAll(/<g class="semgraph-hover-column" tabindex="0" role="img" aria-label="([^"]*)">(<rect [^>]*\/>)(<g class="semgraph-hover-detail" visibility="hidden" pointer-events="none">.*?)<\/g><\/g>/g)].map(
    ([, label, rect, detail]) => {
      const ring = /<circle [^>]*\/>/.exec(detail!)?.[0];
      const box = /<rect [^>]*\/>/.exec(detail!)![0];
      return {
        label: label!,
        rect: { x: number(rect!, 'x'), width: number(rect!, 'width') },
        detail: detail!,
        ...(ring ? { ring: { cx: number(ring, 'cx'), cy: number(ring, 'cy') } } : {}),
        box: { x: number(box, 'x'), y: number(box, 'y'), width: number(box, 'width'), height: number(box, 'height') },
        guides: [...detail!.matchAll(/<line [^>]*\/>/g)].map(([line]) => ({
          x1: number(line, 'x1'),
          x2: number(line, 'x2'),
          y1: number(line, 'y1'),
          y2: number(line, 'y2'),
        })),
        bold: [...detail!.matchAll(/font-weight="bold"[^>]*>([^<]*)</g)].map((match) => match[1]!),
      };
    },
  );
}

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

  it('shows the lines of the specification, the first one bold', async () => {
    const found = columns(await svgOf(await example('basic')));
    assert.equal(found[5]!.label, '23 sep (−7d), gemiddelde 7d: 43,7, ±1 sd: 12,2, venster 17–23 sep');
    assert.deepEqual(found[5]!.bold, ['23 sep (−7d)']);
    assert.equal(found[6]!.label, '30 sep (nu), gemiddelde 7d: 45,9, ±1 sd: 11,3, venster 24–30 sep');
    const missing = columns(await svgOf(await example('missing-days')));
    assert.equal(missing[4]!.label, '16 Sep (−14d), no data: 15 Sep is missing');
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

  it('draws guides through the column and from the y axis to the centre and both spread edges', async () => {
    const column = columns(await svgOf(await example('basic')))[5]!;
    const [vertical, ...horizontal] = column.guides;
    assert.deepEqual([vertical!.y1, vertical!.y2], [0, PLOT.height]);
    assert.equal(vertical!.x1, column.ring!.cx);
    assert.equal(horizontal.length, 3);
    for (const guide of horizontal) {
      assert.equal(guide.x1, 0);
      assert.equal(guide.x2, column.ring!.cx);
    }
    assert.ok(horizontal.some((guide) => guide.y1 === column.ring!.cy));
  });

  it('never draws the lower spread guide below zero', async () => {
    // Mostly zeros with a few spikes: mean − sd is below zero.
    const values = Array.from({ length: 49 }, (_, index) => (index % 7 === 3 ? 12 : 0));
    const found = columns(await svgOf({ ...(await example('basic')), data: series('2026-09-30', values) }));
    for (const column of found) for (const guide of column.guides) assert.ok(guide.y1 <= PLOT.height + 1e-9);
    assert.ok(found.some((column) => column.guides.some((guide) => guide.x1 === 0 && guide.y1 === PLOT.height)));
  });

  it('puts the box above the spread when there is room, below it otherwise, always inside the plot', async () => {
    // Low values with one early spike: the last days have plenty of room above.
    const values = Array.from({ length: 49 }, (_, index) => (index === 3 ? 100 : 40 + (index % 3)));
    const found = columns(await svgOf({ ...(await example('basic')), data: series('2026-09-30', values) }));
    const low = found.at(-1)!;
    const lowTop = Math.min(...low.guides.slice(1).map((guide) => guide.y1));
    assert.ok(low.box.y + low.box.height <= lowTop, 'above the spread');
    // The first block has a spike: its spread reaches almost to the top, so the box goes below.
    const high = found[0]!;
    const highBottom = Math.max(...high.guides.slice(1).map((guide) => guide.y1));
    assert.ok(high.box.y >= highBottom, 'below the spread');
    for (const request of [await example('basic'), await example('zoomed'), await example('long-horizon'), await example('quarters', 'calendarMedian')]) {
      for (const { box } of columns(await svgOf(request))) {
        assert.ok(box.x >= 0 && box.x + box.width <= PLOT.width + 1e-9, `box x ${box.x} + ${box.width}`);
        assert.ok(box.y >= 0 && box.y + box.height <= PLOT.height + 1e-9, `box y ${box.y} + ${box.height}`);
      }
    }
  });

  it('is shown by CSS following the device rules (REQ-015), with prefixed classes, and hidden without CSS', async () => {
    const svg = await svgOf(await example('basic'));
    const style = /<style>(.*?)<\/style>/.exec(svg)![1]!;
    // The mouse hovers, the keyboard focuses visibly; a click sets :focus but not :focus-visible, so it holds nothing open.
    assert.match(style, /\.semgraph-hover-column:hover \.semgraph-hover-detail,\.semgraph-hover-column:focus-visible \.semgraph-hover-detail\{visibility:visible\}/);
    assert.doesNotMatch(style.replace(/@media \(hover:none\)\{.*?\}\}/, ''), /:focus[^-]/);
    // On a device without hover a tap focuses and opens; a tap elsewhere takes the focus away and closes.
    assert.match(style, /@media \(hover:none\)\{\.semgraph-hover-column:focus \.semgraph-hover-detail\{visibility:visible\}\}/);
    for (const selector of style.replace(/@media [^{]+\{/g, '').matchAll(/(^|[},])([^{},]+)\{/g)) assert.match(selector[2]!.trim(), /^\.semgraph-hover/);
    // Every detail starts hidden and lets the pointer through to the next column.
    assert.equal([...svg.matchAll(/class="semgraph-hover-detail" visibility="hidden" pointer-events="none"/g)].length, 7);
    assert.equal([...svg.matchAll(/class="semgraph-hover-column" tabindex="0"/g)].length, 7);
    assert.doesNotMatch(svg, /\sid="/);
    assert.doesNotMatch(svg, /<script/);
  });
});

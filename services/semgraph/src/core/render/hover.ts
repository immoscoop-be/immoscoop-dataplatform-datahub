import { color, type Tokens } from '../tokens.ts';
import { escapeXml } from './escape.ts';
import type { PlotScales } from './vega.ts';

/** One line of a hover box; the first line is usually bold. */
export interface HoverLine {
  text: string;
  bold?: boolean;
}

/** What one column shows on hover, in data units: the chart decides, the layer only places and draws. */
export interface HoverSpec {
  /** Centre of the column on the x scale; the column runs from x − 0.5 to x + 0.5. */
  x: number;
  /** The point and its spread on the y scale; absent for a slot without data. */
  point?: { y: number; lo: number | null; hi: number | null };
  lines: HoverLine[];
}

export interface PlotArea {
  width: number;
  height: number;
}

/** Every class has this prefix: CSS in an inline SVG applies to the whole page. */
const PREFIX = 'semgraph-hover';

// REQ-048: the device rules of REQ-015 hold here too. The mouse only hovers, a click holds nothing open
// (:focus-visible is not set by a click);
// a tap opens and a tap elsewhere closes (focus on a device without hover); Tab opens, the next Tab closes.
const STYLE = [
  `.${PREFIX}-column{outline:none}`,
  `.${PREFIX}-column:hover .${PREFIX}-detail,.${PREFIX}-column:focus-visible .${PREFIX}-detail{visibility:visible}`,
  `@media (hover:none){.${PREFIX}-column:focus .${PREFIX}-detail{visibility:visible}}`,
].join('');

const FONT_SIZE = 10;
const LINE_HEIGHT = 13;
const BOX_PADDING = { x: 8, y: 6 };
const BOX_GAP = 8;
/** Average character width as a share of the font size, to size the box without measuring text. */
const CHAR_WIDTH = 0.56;
const RING_RADIUS = 6;

/**
 * Hover for a static SVG, without script. Every column covers the full height, also without data.
 * On hover, a tap or Tab (each column has tabindex 0), following the device rules of REQ-015 (REQ-048), it
 * shows grey dotted guides, a ring around the point and a box with the lines. The detail is hidden
 * with the visibility attribute and made visible by CSS, so a renderer without CSS shows nothing.
 * Positions come from Vega's own scales. No ids, so several charts can share one page (REQ-027).
 */
export class HoverLayer {
  protected readonly tokens: Tokens;
  protected readonly area: PlotArea;
  protected readonly scales: PlotScales;

  constructor(tokens: Tokens, area: PlotArea, scales: PlotScales) {
    this.tokens = tokens;
    this.area = area;
    this.scales = scales;
  }

  /** The layer in plot-area coordinates, or nothing when there is nothing to hover. */
  render(specs: readonly HoverSpec[]): string {
    const columns = specs.map((spec) => this.column(spec)).filter(Boolean);
    if (columns.length === 0) return '';
    return [`<style>${STYLE}</style>`, `<g class="${PREFIX}">`, ...columns, '</g>'].join('\n');
  }

  protected column(spec: HoverSpec): string {
    const left = this.scales.x(spec.x - 0.5);
    const right = this.scales.x(spec.x + 0.5);
    const centre = this.scales.x(spec.x);
    if (![left, right, centre].every(Number.isFinite)) return '';
    const label = escapeXml(spec.lines.map((line) => line.text).join(', '));
    const detail = [...this.guides(spec, centre), ...this.ring(spec, centre), ...this.box(spec, centre)];
    return [
      `<g class="${PREFIX}-column" tabindex="0" role="img" aria-label="${label}">`,
      `<rect x="${round(left)}" y="0" width="${round(right - left)}" height="${this.area.height}" fill="transparent"/>`,
      `<g class="${PREFIX}-detail" visibility="hidden" pointer-events="none">`,
      ...detail,
      '</g>',
      '</g>',
    ].join('');
  }

  /** Grey dotted guides: vertical through the column, horizontal from the y axis to the point and its spread. */
  protected guides(spec: HoverSpec, centre: number): string[] {
    const stroke = `stroke="${color(this.tokens, 'context/dark')}" stroke-width="${this.tokens.stroke.guide}" stroke-dasharray="1 3" stroke-linecap="round"`;
    const lines = [`<line x1="${round(centre)}" x2="${round(centre)}" y1="0" y2="${this.area.height}" ${stroke}/>`];
    for (const value of this.levels(spec)) {
      const y = round(this.scales.y(value));
      lines.push(`<line x1="0" x2="${round(centre)}" y1="${y}" y2="${y}" ${stroke}/>`);
    }
    return lines;
  }

  /** A ring in the focus colour around the point. */
  protected ring(spec: HoverSpec, centre: number): string[] {
    if (!spec.point) return [];
    const y = round(this.scales.y(spec.point.y));
    return [`<circle cx="${round(centre)}" cy="${y}" r="${RING_RADIUS}" fill="none" stroke="${color(this.tokens, 'focus')}" stroke-width="1.5"/>`];
  }

  /** The box: centred on the column, above the spread, below it when there is no room, always inside the plot. */
  protected box(spec: HoverSpec, centre: number): string[] {
    const widest = Math.max(...spec.lines.map((line) => line.text.length * CHAR_WIDTH * FONT_SIZE * (line.bold ? 1.06 : 1)));
    const width = Math.min(this.area.width, widest + 2 * BOX_PADDING.x);
    const height = spec.lines.length * LINE_HEIGHT + 2 * BOX_PADDING.y;
    const levels = this.levels(spec).map((value) => this.scales.y(value));
    const top = levels.length ? Math.min(...levels) - RING_RADIUS : 0;
    const bottom = levels.length ? Math.max(...levels) + RING_RADIUS : 0;
    let y = top - BOX_GAP - height;
    if (y < 0) y = levels.length ? bottom + BOX_GAP : BOX_GAP;
    y = clamp(y, 0, this.area.height - height);
    const x = clamp(centre - width / 2, 0, this.area.width - width);
    const middle = round(x + width / 2);
    const text = spec.lines.map((line, index) => {
      const baseline = round(y + BOX_PADDING.y + (index + 1) * LINE_HEIGHT - 3);
      const weight = line.bold ? ' font-weight="bold"' : '';
      return `<text x="${middle}" y="${baseline}" text-anchor="middle" font-family="${escapeXml(this.tokens.font.body)}" font-size="${FONT_SIZE}"${weight} fill="${color(this.tokens, 'text')}">${escapeXml(line.text)}</text>`;
    });
    return [
      `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${height}" rx="4" fill="${color(this.tokens, 'surface')}" stroke="${color(this.tokens, 'axis')}" stroke-width="1"/>`,
      ...text,
    ];
  }

  /** The centre and both spread edges; the lower edge never below zero. */
  protected levels(spec: HoverSpec): number[] {
    if (!spec.point) return [];
    const { y, lo, hi } = spec.point;
    return [y, ...(hi === null ? [] : [hi]), ...(lo === null ? [] : [Math.max(0, lo)])];
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

import { color, type Tokens } from '../tokens.ts';
import { escapeXml } from './escape.ts';
import { textWidth } from './text.ts';
import type { PlotScales } from './vega.ts';

/** One line of a hover box; the first line is usually bold. */
export interface HoverLine {
  text: string;
  bold?: boolean;
}

/** What one column shows on hover, in data units: the chart decides, the layer only places and draws. */
export interface HoverSpec {
  /** Centre of the column on the band scale; the column runs from x − 0.5 to x + 0.5 unless from and to say otherwise. */
  x: number;
  /** The edges of the column when it is not one unit wide, such as a bin of a distribution. */
  from?: number;
  to?: number;
  /** The point and its spread on the y scale; absent for a slot without data. */
  point?: { y: number; lo: number | null; hi: number | null };
  /** Every line, also for the aria-label of the column (REQ-027, REQ-106). */
  lines: HoverLine[];
  /** REQ-105: what the fixed readout says for this column, and the date on the time axis under the point. */
  readout?: Readout & { date: string };
}

/**
 * REQ-105, REQ-106: the value you are looking at, in one fixed spot: the value, the spread and the window or
 * period under it, and on a second line whatever else there is to know (n, the comparison, running, no data, the
 * counts of a ratio).
 */
export interface Readout {
  value: string;
  detail?: string;
  extra?: string;
}

/** Where the readout stands, in the coordinates of the whole chart (REQ-105). */
export interface ReadoutAnchor {
  /** The right edge (end) or the left edge (start) of the readout, and the baseline of the value. */
  x: number;
  y: number;
  /** At the right of the header, right aligned; or on a line of its own under the reading cue (the size card). */
  align: 'end' | 'start';
}

export interface ReadoutPlace {
  anchor: ReadoutAnchor;
  /** The origin of the plot area in the coordinates of the whole chart. */
  origin: { x: number; y: number };
  /** The top of the labels of the time axis, in plot-area coordinates: the date goes over them. */
  dateTop: number;
  /** The readout at rest: the latest value. */
  rest: Readout;
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

/** REQ-105: the value, its detail lines, and the date over the time axis. */
const READOUT = { value: 16, valueNarrow: 13, detail: 11, detailLine: 15, extraLine: 14, gap: 8 };
const DATE = { size: 11, padding: { x: 6, y: 2 }, radius: 3, overhang: 20 };
const RING = { radius: 7, stroke: 1.6 };
/** A bold text is a bit wider than the estimate. */
const BOLD = 1.06;

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
    const left = this.scales.x(spec.from ?? spec.x - 0.5);
    const right = this.scales.x(spec.to ?? spec.x + 0.5);
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

/**
 * The same hover for horizontal bars: every category is a row over the full width. The guides run
 * through the row up to the spread, and up from the axis to the point and both spread edges; the box
 * sits next to the spread, right of it when there is room, and never leaves the plot.
 */
export class RowHoverLayer extends HoverLayer {
  protected override column(spec: HoverSpec): string {
    const top = this.scales.y(spec.x - 0.5);
    const bottom = this.scales.y(spec.x + 0.5);
    const centre = this.scales.y(spec.x);
    if (![top, bottom, centre].every(Number.isFinite)) return '';
    const label = escapeXml(spec.lines.map((line) => line.text).join(', '));
    const detail = [...this.guides(spec, centre), ...this.ring(spec, centre), ...this.box(spec, centre)];
    return [
      `<g class="${PREFIX}-column" tabindex="0" role="img" aria-label="${label}">`,
      `<rect x="0" y="${round(Math.min(top, bottom))}" width="${this.area.width}" height="${round(Math.abs(bottom - top))}" fill="transparent"/>`,
      `<g class="${PREFIX}-detail" visibility="hidden" pointer-events="none">`,
      ...detail,
      '</g>',
      '</g>',
    ].join('');
  }

  protected override guides(spec: HoverSpec, centre: number): string[] {
    const stroke = `stroke="${color(this.tokens, 'context/dark')}" stroke-width="${this.tokens.stroke.guide}" stroke-dasharray="1 3" stroke-linecap="round"`;
    // Through the row up to the end of the spread, so it never crosses the value written after it.
    const levels = this.levels(spec).map((value) => this.scales.x(value));
    const end = levels.length ? Math.max(...levels) : this.area.width;
    const lines = [`<line x1="0" x2="${round(end)}" y1="${round(centre)}" y2="${round(centre)}" ${stroke}/>`];
    for (const value of this.levels(spec)) {
      const x = round(this.scales.x(value));
      lines.push(`<line x1="${x}" x2="${x}" y1="${this.area.height}" y2="${round(centre)}" ${stroke}/>`);
    }
    return lines;
  }

  protected override ring(spec: HoverSpec, centre: number): string[] {
    if (!spec.point) return [];
    const x = round(this.scales.x(spec.point.y));
    return [`<circle cx="${x}" cy="${round(centre)}" r="${RING_RADIUS}" fill="none" stroke="${color(this.tokens, 'focus')}" stroke-width="1.5"/>`];
  }

  protected override box(spec: HoverSpec, centre: number): string[] {
    const widest = Math.max(...spec.lines.map((line) => line.text.length * CHAR_WIDTH * FONT_SIZE * (line.bold ? 1.06 : 1)));
    const width = Math.min(this.area.width, widest + 2 * BOX_PADDING.x);
    const height = spec.lines.length * LINE_HEIGHT + 2 * BOX_PADDING.y;
    const levels = this.levels(spec).map((value) => this.scales.x(value));
    const right = levels.length ? Math.max(...levels) + RING_RADIUS : 0;
    const left = levels.length ? Math.min(...levels) - RING_RADIUS : 0;
    let x = right + BOX_GAP;
    if (x + width > this.area.width) x = left - BOX_GAP - width;
    x = clamp(x, 0, this.area.width - width);
    const y = clamp(centre - height / 2, 0, this.area.height - height);
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
}

/**
 * REQ-105, REQ-106: the hover of a time axis. Nothing is drawn over the data: on the point only a dotted guide
 * over the height of the plot and a ring; the date as a small label on the time axis, over the label of its
 * period; and the value in one fixed spot. Every column carries its own readout at the same coordinates, so
 * nothing jumps; the readout at rest (the latest value) hides while a column is shown. Only CSS, with the device
 * rules of REQ-015 (REQ-048).
 */
export class ReadoutHoverLayer extends HoverLayer {
  protected readonly place: ReadoutPlace;

  constructor(tokens: Tokens, area: PlotArea, scales: PlotScales, place: ReadoutPlace) {
    super(tokens, area, scales);
    this.place = place;
  }

  /** How much room the readouts need at the right of the header, and whether any has a second detail line. */
  static size(tokens: Tokens, readouts: readonly Readout[]): { width: number; extra: boolean } {
    const width = Math.max(
      0,
      // The extra line too: it stands under the detail, next to the reading cue, and never runs under it.
      ...readouts.map((readout) =>
        Math.max(textWidth(readout.value, READOUT.value) * BOLD, textWidth(readout.detail ?? '', READOUT.detail), textWidth(readout.extra ?? '', READOUT.detail)),
      ),
    );
    return { width: Math.ceil(width), extra: readouts.some((readout) => Boolean(readout.extra)) };
  }

  override render(specs: readonly HoverSpec[]): string {
    const columns = specs.map((spec) => this.column(spec)).filter(Boolean);
    if (columns.length === 0) return '';
    const group = `.${PREFIX}`;
    const rest = `.${PREFIX}-rest`;
    const column = `.${PREFIX}-column`;
    const detail = `.${PREFIX}-detail`;
    // As STYLE, and there are never two values at once: the readout at rest hides while a column shows its own.
    const style = [
      `${column}{outline:none}`,
      `${column}:hover ${detail},${column}:focus-visible ${detail}{visibility:visible}`,
      `${group}:hover ${rest},${group}:has(${column}:focus-visible) ${rest}{visibility:hidden}`,
      `@media (hover:none){${column}:focus ${detail}{visibility:visible}${group}:has(${column}:focus) ${rest}{visibility:hidden}}`,
    ].join('');
    return [
      `<style>${style}</style>`,
      `<g class="${PREFIX}">`,
      `<g class="${PREFIX}-rest" pointer-events="none">${this.readout(this.place.rest)}</g>`,
      ...columns,
      '</g>',
    ].join('\n');
  }

  protected override column(spec: HoverSpec): string {
    const left = this.scales.x(spec.from ?? spec.x - 0.5);
    const right = this.scales.x(spec.to ?? spec.x + 0.5);
    const centre = this.scales.x(spec.x);
    if (![left, right, centre].every(Number.isFinite)) return '';
    const label = escapeXml(spec.lines.map((line) => line.text).join(', '));
    const detail = [
      ...this.guides(spec, centre),
      ...this.ring(spec, centre),
      ...(spec.readout ? [this.date(spec.readout.date, centre), this.readout(spec.readout)] : this.box(spec, centre)),
    ];
    return [
      `<g class="${PREFIX}-column" tabindex="0" role="img" aria-label="${label}">`,
      `<rect x="${round(left)}" y="0" width="${round(right - left)}" height="${this.area.height}" fill="transparent"/>`,
      `<g class="${PREFIX}-detail" visibility="hidden" pointer-events="none">`,
      ...detail,
      '</g>',
      '</g>',
    ].join('');
  }

  /** Only the dotted guide through the column, over the height of the plot. */
  protected override guides(_spec: HoverSpec, centre: number): string[] {
    const stroke = `stroke="${color(this.tokens, 'context/dark')}" stroke-width="${this.tokens.stroke.guide}" stroke-dasharray="2 3"`;
    return [`<line x1="${round(centre)}" x2="${round(centre)}" y1="0" y2="${this.area.height}" ${stroke}/>`];
  }

  protected override ring(spec: HoverSpec, centre: number): string[] {
    if (!spec.point) return [];
    const y = round(this.scales.y(spec.point.y));
    return [`<circle cx="${round(centre)}" cy="${y}" r="${RING.radius}" fill="none" stroke="${color(this.tokens, 'focus')}" stroke-width="${RING.stroke}"/>`];
  }

  /** The date on the time axis, right under the point, over the label of its period. */
  protected date(text: string, centre: number): string {
    const width = textWidth(text, DATE.size) * BOLD + 2 * DATE.padding.x;
    const height = DATE.size + 2 * DATE.padding.y + 1;
    // Under the point, but never further out than the axis labels themselves.
    const x = clamp(centre - width / 2, -DATE.overhang, this.area.width + DATE.overhang - width);
    const top = this.place.dateTop - DATE.padding.y - 1;
    return [
      `<rect x="${round(x)}" y="${round(top)}" width="${round(width)}" height="${height}" rx="${DATE.radius}" fill="${color(this.tokens, 'text')}"/>`,
      `<text x="${round(x + width / 2)}" y="${round(top + DATE.padding.y + DATE.size - 1.5)}" text-anchor="middle" font-family="${escapeXml(this.tokens.font.body)}" font-size="${DATE.size}" font-weight="bold" fill="${color(this.tokens, 'surface')}">${escapeXml(text)}</text>`,
    ].join('');
  }

  /** The readout in its fixed spot: the value, the detail beside or under it, and the extra line under that. */
  protected readout(readout: Readout): string {
    const { anchor, origin } = this.place;
    const x = anchor.x - origin.x;
    const y = anchor.y - origin.y;
    const font = escapeXml(this.tokens.font.body);
    const text = (content: string, at: { x: number; y: number }, style: string) =>
      `<text x="${round(at.x)}" y="${round(at.y)}"${anchor.align === 'end' ? ' text-anchor="end"' : ''} font-family="${font}" ${style}>${escapeXml(content)}</text>`;
    const muted = `font-size="${READOUT.detail}" fill="${color(this.tokens, 'text/muted')}"`;
    const parts: string[] = [];
    if (anchor.align === 'end') {
      parts.push(text(readout.value, { x, y }, `font-size="${READOUT.value}" font-weight="bold" fill="${color(this.tokens, 'focus/dark')}"`));
      if (readout.detail) parts.push(text(readout.detail, { x, y: y + READOUT.detailLine }, muted));
      if (readout.extra) parts.push(text(readout.extra, { x, y: y + READOUT.detailLine + READOUT.extraLine }, muted));
    } else {
      // On a narrow chart: the value and its detail on one line under the reading cue, the extra line under it.
      parts.push(text(readout.value, { x, y }, `font-size="${READOUT.valueNarrow}" font-weight="bold" fill="${color(this.tokens, 'focus/dark')}"`));
      const after = x + textWidth(readout.value, READOUT.valueNarrow) * BOLD + READOUT.gap;
      if (readout.detail) parts.push(text(readout.detail, { x: after, y }, muted));
      if (readout.extra) parts.push(text(readout.extra, { x, y: y + READOUT.extraLine }, muted));
    }
    return parts.join('');
  }
}

/** How far under the value of a readout its lines reach, for the room the header keeps (REQ-105). */
export const READOUT_LINES = { detail: READOUT.detailLine, extra: READOUT.extraLine, narrowValue: READOUT.valueNarrow };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

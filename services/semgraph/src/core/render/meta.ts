import { color, type Tokens } from '../tokens.ts';
import { escapeXml } from './escape.ts';
import { MONO_CHAR_WIDTH, round, textWidth, wrap } from './text.ts';

/** One piece of a panel: a paragraph, a query, a link or a named value. */
export type PanelBlock =
  | { kind: 'text'; text: string; muted?: boolean }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'field'; name: string; value: string };

/** One label in the footer and the panel it grows into. The pipeline only passes labels with content (REQ-020). */
export interface MetaItem {
  label: string;
  blocks: PanelBlock[];
}

export interface MetaLayout {
  /** Width of the whole chart; a panel covers it from the top down to the row of labels (REQ-014). */
  width: number;
  /** Left edge of the label text, aligned with the footer. */
  left: number;
  /** Top of the row of labels. */
  top: number;
}

/** Every class has this prefix: CSS in an inline SVG applies to the whole page. */
const PREFIX = 'semgraph-meta';

const LABEL_SIZE = 10;
const LABEL_PADDING = { x: 4, y: 2 };
export const LABEL_HEIGHT = 17;
const LABEL_GAP = 4;
/** The panel ends this far above the labels; the label's hit area bridges the gap, so there is none. */
const PANEL_GAP = 6;
const PANEL_PADDING = 20;
const PANEL_RADIUS = 12;
const LINE_HEIGHT = 1.5;
const BLOCK_GAP = 6;
/** REQ-014: closing waits about 350 ms. */
const CLOSE_DELAY = 0.35;
const GROW = 0.15;

/**
 * The chart metadata in the footer (REQ-010 to REQ-020): short text labels at the bottom left, one
 * topic per label. On hover the label itself grows into a panel over the whole chart. The panel is
 * part of the label's element, so the pointer never leaves it: no gap, nothing jumps. Only CSS in
 * the SVG, no script (REQ-016); without CSS, or when the SVG is shown as an image, the panels stay
 * hidden. The text in a panel is selectable; there are no copy buttons.
 */
export class MetaLayer {
  protected readonly tokens: Tokens;
  protected readonly layout: MetaLayout;

  constructor(tokens: Tokens, layout: MetaLayout) {
    this.tokens = tokens;
    this.layout = layout;
  }

  /** The labels and their panels, or nothing without labels. */
  render(items: readonly MetaItem[]): string {
    if (items.length === 0) return '';
    let x = this.layout.left - LABEL_PADDING.x;
    const groups = items.map((item) => {
      const width = textWidth(item.label, LABEL_SIZE) + 2 * LABEL_PADDING.x;
      const group = this.item(item, x, width);
      x += width + LABEL_GAP;
      return group;
    });
    return [`<style>${this.style()}</style>`, `<g class="${PREFIX}">`, ...groups, '</g>'].join('\n');
  }

  protected style(): string {
    const open = `visibility:visible;opacity:1;transform:none;transition:transform ${GROW}s ease-out,opacity ${GROW}s ease-out,visibility 0s`;
    const active = `fill:${color(this.tokens, 'axis')}`;
    const item = `.${PREFIX}-item`;
    const panel = `.${PREFIX}-panel`;
    const pill = `.${PREFIX}-pill`;
    return [
      `${item}{outline:none}`,
      // Closed: shrunk into the label. Leaving waits CLOSE_DELAY before it shrinks back.
      `${panel}{opacity:0;transform:scale(.04);transition:transform ${GROW}s ease-in ${CLOSE_DELAY}s,opacity ${GROW}s ease-in ${CLOSE_DELAY}s,visibility 0s linear ${CLOSE_DELAY + GROW}s}`,
      `${panel} text{user-select:text;-webkit-user-select:text}`,
      // REQ-015: the mouse only hovers, a click holds nothing open; Tab opens, the next Tab closes.
      `${item}:hover ${panel},${item}:focus-visible ${panel}{${open}}`,
      `${item}:hover ${pill},${item}:focus-visible ${pill}{${active}}`,
      // REQ-015: on touch a tap opens and a tap elsewhere closes.
      `@media (hover:none){${item}:focus ${panel}{${open}}${item}:focus ${pill}{${active}}}`,
      `@media (prefers-reduced-motion:reduce){${panel}{transform:none!important}}`,
    ].join('');
  }

  protected item(item: MetaItem, x: number, width: number): string {
    const { top } = this.layout;
    const muted = color(this.tokens, 'text/muted');
    const centre = { x: round(x + width / 2), y: round(top + LABEL_HEIGHT / 2) };
    return [
      `<g class="${PREFIX}-item" tabindex="0" role="group" aria-label="${escapeXml(item.label)}">`,
      `<g class="${PREFIX}-panel" visibility="hidden" style="transform-origin:${centre.x}px ${centre.y}px">`,
      ...this.panel(item),
      '</g>',
      // The hit area reaches up to the panel, so moving from the label into the panel crosses no gap.
      `<rect x="${round(x)}" y="${round(top - PANEL_GAP)}" width="${round(width)}" height="${LABEL_HEIGHT + PANEL_GAP}" fill="transparent"/>`,
      `<rect class="${PREFIX}-pill" x="${round(x)}" y="${round(top)}" width="${round(width)}" height="${LABEL_HEIGHT}" rx="4" fill="transparent"/>`,
      `<text x="${round(x + LABEL_PADDING.x)}" y="${round(top + LABEL_PADDING.y + LABEL_SIZE + 0.5)}" font-family="${escapeXml(this.tokens.font.body)}" font-size="${LABEL_SIZE}" fill="${muted}">${escapeXml(item.label)}</text>`,
      '</g>',
    ].join('');
  }

  /** The panel over the whole chart: the label as its title, then the blocks, cut where the room ends. */
  protected panel(item: MetaItem): string[] {
    const { width } = this.layout;
    const bottom = this.layout.top - PANEL_GAP;
    const inner = width - 2 * PANEL_PADDING;
    const body = this.tokens.size.panelBody;
    const lineHeight = body * LINE_HEIGHT;
    const parts = [
      `<rect x="0.5" y="0.5" width="${width - 1}" height="${round(bottom - 0.5)}" rx="${PANEL_RADIUS}" fill="${color(this.tokens, 'surface')}" stroke="${color(this.tokens, 'text/muted')}" stroke-width="1"/>`,
      this.text(item.label, PANEL_PADDING + this.tokens.size.panelTitle, { size: this.tokens.size.panelTitle, weight: 700 }),
    ];
    const lines = this.lines(item.blocks, inner);
    const tops: number[] = [];
    let y = PANEL_PADDING + this.tokens.size.panelTitle + 10;
    for (const line of lines) {
      y += line.gap;
      tops.push(y);
      y += lineHeight;
    }
    // What does not fit is cut, and the last line that fits becomes an ellipsis.
    const fit = tops.filter((top) => top + lineHeight <= bottom - PANEL_PADDING).length;
    const shown = fit < lines.length ? Math.max(0, fit - 1) : lines.length;
    for (let index = 0; index < shown; index++) parts.push(lines[index]!.markup(tops[index]! + body));
    if (shown < lines.length) parts.push(this.text('…', tops[shown]! + body, { muted: true }));
    return parts;
  }

  /** Every block as lines of markup; a line knows the gap above it. */
  protected lines(blocks: readonly PanelBlock[], inner: number): { markup: (baseline: number) => string; gap: number }[] {
    const body = this.tokens.size.panelBody;
    const lines: { markup: (baseline: number) => string; gap: number }[] = [];
    blocks.forEach((block, index) => {
      const gap = index === 0 ? 0 : BLOCK_GAP;
      // Only the first line of a block keeps the gap above it.
      const push = (markup: (baseline: number) => string, lineIndex: number) => lines.push({ markup, gap: lineIndex === 0 ? gap : 0 });
      switch (block.kind) {
        case 'text':
          wrap(block.text, body, inner, 40).forEach((line, lineIndex) => push((baseline) => this.text(line, baseline, { muted: block.muted }), lineIndex));
          break;
        case 'code': {
          // The query keeps its own lines and indentation; a line that does not fit ends in an ellipsis.
          const maxChars = Math.floor(inner / (body * MONO_CHAR_WIDTH));
          block.text
            .replaceAll('\t', '  ')
            .split(/\r?\n/)
            .map((line) => line.trimEnd())
            .forEach((line, lineIndex) => {
              const cut = line.length > maxChars ? `${line.slice(0, maxChars - 1)}…` : line;
              push((baseline) => this.text(cut, baseline, { mono: true }), lineIndex);
            });
          break;
        }
        case 'link': {
          const [line] = wrap(`${block.text} →`, body, inner, 1);
          push((baseline) => `<a href="${escapeXml(block.href)}">${this.text(line!, baseline, { fill: color(this.tokens, 'focus/dark') })}</a>`, 0);
          break;
        }
        case 'field': {
          const [value] = wrap(block.value, body, inner - textWidth(`${block.name}: `, body), 1);
          push(
            (baseline) =>
              `<text x="${PANEL_PADDING}" y="${round(baseline)}" font-family="${escapeXml(this.tokens.font.body)}" font-size="${body}" xml:space="preserve"><tspan fill="${color(this.tokens, 'text/muted')}">${escapeXml(block.name)}: </tspan><tspan fill="${color(this.tokens, 'text')}">${escapeXml(value!)}</tspan></text>`,
            0,
          );
          break;
        }
      }
    });
    return lines;
  }

  protected text(content: string, baseline: number, style: { size?: number; weight?: number; muted?: boolean; mono?: boolean; fill?: string } = {}): string {
    const family = style.mono ? this.tokens.font.mono : this.tokens.font.body;
    const fill = style.fill ?? color(this.tokens, style.muted ? 'text/muted' : 'text');
    const weight = style.weight ? ` font-weight="${style.weight}"` : '';
    const space = style.mono ? ' xml:space="preserve"' : '';
    return `<text x="${PANEL_PADDING}" y="${round(baseline)}" font-family="${escapeXml(family)}" font-size="${style.size ?? this.tokens.size.panelBody}"${weight} fill="${fill}"${space}>${escapeXml(content)}</text>`;
  }
}

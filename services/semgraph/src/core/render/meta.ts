import { color, type Tokens } from '../tokens.ts';
import { escapeXml } from './escape.ts';
import { MONO_CHAR_WIDTH, round, textWidth, wrap } from './text.ts';

/** The topics of the labels, in the order of the row (REQ-012, REQ-018, REQ-102). */
export const META_KINDS = ['question', 'references', 'query', 'metadata', 'learn'] as const;
export type MetaKind = (typeof META_KINDS)[number];

/** A named value; a wide one takes a row of its own, the others stand two by two where there is room. */
export interface Field {
  name: string;
  value: string;
  wide?: boolean;
}

/** One piece of a section: a paragraph, a query, a link, named values or the signs of a chart. */
export type PanelBlock =
  | { kind: 'text'; text: string; muted?: boolean }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'fields'; fields: Field[] }
  | { kind: 'signs'; signs: { markup: string; text: string }[] };

/** A section of a card, under a small label in capitals (REQ-099). */
export interface CardSection {
  label: string;
  blocks: PanelBlock[];
}

/**
 * One label in the footer and the card it opens (REQ-098, REQ-099). The pipeline only passes labels with
 * content (REQ-020). Two sections in a pair stand side by side where there is room, such as Made and Service.
 */
export interface MetaItem {
  kind: MetaKind;
  label: string;
  /** The eyebrow of the card: QUERY, METADATA, HOW DO I READ THIS? */
  eyebrow: string;
  title: string;
  sections: (CardSection | readonly [CardSection, CardSection])[];
}

export interface MetaCards {
  items: MetaItem[];
  /** The compiled date at the right of the row of labels in every card ("compiled 02/10"). */
  compiled: string;
  /** How to close a card, with the mouse and on touch. */
  close: { mouse: string; touch: string };
}

export interface MetaLayout {
  /** Size of the whole chart: the veil covers all of it (REQ-098). */
  width: number;
  height: number;
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

/** REQ-098: the veil in the surface colour, about 80% opaque, so the chart stays faintly visible. */
const VEIL_OPACITY = 0.82;
/** REQ-099: the card, as in Figma at the size default; at least this far from the edge. */
const CARD_WIDTH = 540;
const CARD_MARGIN = 20;
/** REQ-085: on a narrow chart, such as the size card or the KPI tile, the card fills it but for this margin. */
const NARROW = 500;
const NARROW_MARGIN = 16;
const PADDING = { x: 24, top: 20, bottom: 18 };
/**
 * The room between the blocks of a card: eyebrow, title, lines, section labels and their content. 14 as in
 * Figma; a card that would not fit in its chart closes up before anything is cut.
 */
const GAPS = [14, 10, 6] as const;
const RADIUS = 10;
const EYEBROW_HEIGHT = 14;
/** Letter spacing of the eyebrow and the section labels: 8% of the font size. */
const SPACING = 0.08;
const TITLE_LINE = 22;
/** Poppins is wider than Nunito. */
const TITLE_CHAR_WIDTH = 0.6;
const TEXT_LINE = 17;
const BLOCK_GAP = 6;
const ROW_GAP = 6;
const KEY_WIDTH = 84;
const COLUMN_GAP = 16;
/** Below this width a card has one column of values. */
const TWO_COLUMNS = 400;
/** REQ-100: the SQL on its own surface. */
const CODE_PADDING = { x: 14, y: 12 };
const CODE_RADIUS = 6;
const CODE_LINE = 1.5;
/** REQ-102: a sample of every sign, 16 × 16, its explanation next to it. */
const SIGN = 16;
const SIGN_GAP = 8;
const SIGN_TEXT = 26;
const ROW_HEIGHT = 17.5;
const ROW_LABEL_GAP = 12;
const UNDERLINE = 1.5;
/** A semibold or bold text is a bit wider than the estimate. */
const BOLD = 1.06;
/** REQ-014: closing waits about 350 ms. */
const CLOSE_DELAY = 0.35;
const FADE = 0.15;

/** A line of a card: the room above it, its height, and its markup at a given top. */
interface Line {
  gap: number;
  height: number;
  draw: (top: number) => string;
  /** Part of the SQL, which lies on its own surface. */
  code?: boolean;
  /** A thin line or a section label: a cut never ends on one. */
  structure?: boolean;
}

/**
 * The chart metadata in the footer (REQ-010 to REQ-020, REQ-098 to REQ-104): short text labels at the
 * bottom left, one topic per label. A label opens a card over the chart, on a veil that covers all of it, so
 * the card stays open until the pointer leaves the chart. A label in the card switches to its card without
 * closing. Only CSS in the SVG, no script (REQ-016); without CSS, or when the SVG is shown as an image, the
 * cards stay hidden. The text in a card is selectable; there are no copy buttons (REQ-015).
 */
export class MetaLayer {
  protected readonly tokens: Tokens;
  protected readonly layout: MetaLayout;

  constructor(tokens: Tokens, layout: MetaLayout) {
    this.tokens = tokens;
    this.layout = layout;
  }

  /** The labels and their cards, or nothing without labels. */
  render(cards: MetaCards): string {
    if (cards.items.length === 0) return '';
    let x = this.layout.left - LABEL_PADDING.x;
    const labels = cards.items.map((item) => {
      const width = textWidth(item.label, LABEL_SIZE) + 2 * LABEL_PADDING.x;
      const label = this.label(item, x, width);
      x += width + LABEL_GAP;
      return label;
    });
    return [
      `<style>${this.style(cards.items)}</style>`,
      `<g class="${PREFIX}">`,
      ...labels,
      // Drawn after the labels, so an open card lies over the whole chart, its footer included.
      ...cards.items.map((item) => this.card(item, cards)),
      '</g>',
    ].join('\n');
  }

  protected style(items: readonly MetaItem[]): string {
    const root = 'svg[data-semgraph]';
    const card = `.${PREFIX}-card`;
    const open = `visibility:visible;opacity:1;transition:opacity ${FADE}s ease-out,visibility 0s`;
    // The card of a topic opens from any label of that topic: in the footer, in another card, or the icon.
    const opens = (state: string) => items.map(({ kind }) => `${root}:has(.${PREFIX}-for-${kind}:${state}) ${card}-${kind}`).join(',');
    return [
      `.${PREFIX}-label,.${PREFIX}-box{outline:none}`,
      // Closed. Leaving waits CLOSE_DELAY before the card fades.
      `${card}{opacity:0;transition:opacity ${FADE}s ease-in ${CLOSE_DELAY}s,visibility 0s linear ${CLOSE_DELAY + FADE}s}`,
      `${card} text{user-select:text;-webkit-user-select:text}`,
      `.${PREFIX}-touch{display:none}`,
      // REQ-015: Tab opens, the next Tab closes.
      `${opens('focus-visible')}{${open}}`,
      // REQ-015: the mouse only hovers, a click holds nothing open. Over the card or its veil the card stays,
      // so it closes when the pointer leaves the chart. A label in the card opens its own card instead (REQ-099).
      `@media (hover:hover){${opens('hover')},${card}:hover{${open}}${card}:has(.${PREFIX}-switch:hover){visibility:hidden!important;opacity:0!important;transition:none!important}}`,
      // REQ-015: on touch a tap opens, a tap in the card keeps it, and a tap outside it closes. A tap on a
      // label in the card opens that card; the card it was in steps aside but keeps the focus.
      `@media (hover:none){${opens('focus')},${card}:focus-within{${open}}${card}:has(.${PREFIX}-switch:focus){opacity:0!important;pointer-events:none}.${PREFIX}-mouse{display:none}.${PREFIX}-touch{display:inline}}`,
      `@media (prefers-reduced-motion:reduce){${card}{transition-duration:0s!important}}`,
    ].join('');
  }

  /** A label in the footer: it opens its card. */
  protected label(item: MetaItem, x: number, width: number): string {
    const { top } = this.layout;
    return [
      `<g class="${PREFIX}-label ${PREFIX}-for-${item.kind}" tabindex="0" role="button" aria-label="${escapeXml(item.label)}">`,
      `<rect x="${round(x)}" y="${round(top)}" width="${round(width)}" height="${LABEL_HEIGHT}" fill="transparent"/>`,
      `<text x="${round(x + LABEL_PADDING.x)}" y="${round(top + LABEL_PADDING.y + LABEL_SIZE + 0.5)}" font-family="${escapeXml(this.tokens.font.body)}" font-size="${LABEL_SIZE}" fill="${color(this.tokens, 'text/muted')}">${escapeXml(item.label)}</text>`,
      '</g>',
    ].join('');
  }

  /**
   * The card on its veil (REQ-098, REQ-099): eyebrow, title, the sections between thin lines, and the row of
   * labels with the active one underlined. What does not fit in the chart is cut, and the last line that fits
   * becomes an ellipsis (REQ-014); the eyebrow, the title and the row always stay.
   */
  protected card(item: MetaItem, cards: MetaCards): string {
    const { width: chartWidth, height: chartHeight } = this.layout;
    const margin = chartWidth < NARROW ? NARROW_MARGIN : CARD_MARGIN;
    const inner = this.innerWidth();
    const width = inner + 2 * PADDING.x;
    const titleLines = wrap(item.title, this.tokens.size.panelTitle, inner, 2, TITLE_CHAR_WIDTH);
    const layout = (gap: number) => {
      const head = PADDING.top + EYEBROW_HEIGHT + gap + titleLines.length * TITLE_LINE;
      const foot = gap + 1 + gap + ROW_HEIGHT + PADDING.bottom;
      const lines = item.sections.flatMap((section) => this.section(section, inner, gap));
      return { gap, head, foot, lines, total: head + foot + lines.reduce((sum, line) => sum + line.gap + line.height, 0) };
    };
    const max = chartHeight - 2 * margin;
    const { gap, head, foot, lines } = GAPS.map(layout).find((candidate) => candidate.total <= max) ?? layout(GAPS.at(-1)!);

    // Cut what still does not fit, never after a thin line or a section label; the last line that fits
    // becomes an ellipsis.
    const room = max - head - foot;
    const tops: number[] = [];
    let used = 0;
    for (const line of lines) {
      if (used + line.gap + line.height > room) break;
      tops.push(head + used + line.gap);
      used += line.gap + line.height;
    }
    let shown = lines.slice(0, tops.length);
    if (shown.length < lines.length) {
      while (shown.at(-1)?.structure) shown = shown.slice(0, -1);
      const last = shown.at(-1);
      if (last) {
        shown = [...shown.slice(0, -1), { gap: last.gap, height: TEXT_LINE, draw: (top) => this.text('…', top + 12.5, { muted: true }) }];
        used = tops[shown.length - 1]! - head + TEXT_LINE;
      } else {
        used = 0;
      }
    }
    const height = head + used + foot;
    const x = round((chartWidth - width) / 2);
    const y = round(Math.max(margin, (chartHeight - height) / 2));

    const muted = color(this.tokens, 'text/muted');
    const kind = this.tokens.size.panelKind;
    const right = PADDING.x + inner;
    const parts = [
      `<rect x="0.5" y="0.5" width="${width - 1}" height="${round(height - 1)}" rx="${RADIUS}" fill="${color(this.tokens, 'surface')}" stroke="${color(this.tokens, 'context/light')}" stroke-width="1"/>`,
      this.text(upper(item.eyebrow), PADDING.top + 10.5, { size: kind, weight: 700, spacing: true, fill: color(this.tokens, 'focus/dark') }),
      // REQ-015: how to close, for the mouse and for touch.
      this.text(cards.close.mouse, PADDING.top + 10.5, { size: kind, muted: true, x: right, end: true, className: `${PREFIX}-mouse` }),
      this.text(cards.close.touch, PADDING.top + 10.5, { size: kind, muted: true, x: right, end: true, className: `${PREFIX}-touch` }),
      ...titleLines.map((line, index) =>
        `<text x="${PADDING.x}" y="${round(PADDING.top + EYEBROW_HEIGHT + gap + index * TITLE_LINE + 16)}" font-family="${escapeXml(this.tokens.font.title)}" font-size="${this.tokens.size.panelTitle}" font-weight="600" fill="${color(this.tokens, 'text')}">${escapeXml(line)}</text>`,
      ),
      ...this.codeSurfaces(shown, tops),
      ...shown.map((line, index) => line.draw(tops[index]!)),
      this.rule(head + used + gap),
      this.row(item, cards, head + used + gap + 1 + gap, inner),
    ];
    return [
      `<g class="${PREFIX}-card ${PREFIX}-card-${item.kind}" visibility="hidden" role="dialog" aria-label="${escapeXml(item.label)}">`,
      `<rect class="${PREFIX}-veil" width="${chartWidth}" height="${chartHeight}" fill="${color(this.tokens, 'surface')}" fill-opacity="${VEIL_OPACITY}"/>`,
      `<g class="${PREFIX}-box" tabindex="-1" transform="translate(${x},${y})">`,
      ...parts,
      '</g></g>',
    ].join('');
  }

  /** A section as lines: the thin line above it, its label, then its blocks. A pair stands side by side where there is room. */
  protected section(section: CardSection | readonly [CardSection, CardSection], inner: number, gap: number): Line[] {
    if (isPair(section)) {
      if (inner < TWO_COLUMNS) return [...this.section(section[0], inner, gap), ...this.section(section[1], inner, gap)];
      const column = (inner + COLUMN_GAP) / 2;
      const [left, right] = section.map((part) => part.blocks.flatMap((block) => (block.kind === 'fields' ? block.fields : [])));
      const rows = Array.from({ length: Math.max(left!.length, right!.length) }, (_, index) => [left![index], right![index]] as const);
      const [leftKey, rightKey] = [keyWidth(left!, this.tokens.size.panelBody), keyWidth(right!, this.tokens.size.panelBody)];
      return [
        { gap, height: 1, structure: true, draw: (top) => this.rule(top) },
        { gap, height: EYEBROW_HEIGHT, structure: true, draw: (top) => this.sectionLabel(section[0].label, top) + this.sectionLabel(section[1].label, top, column) },
        ...rows.map(([a, b], index) => ({
          gap: index === 0 ? gap : ROW_GAP,
          height: TEXT_LINE,
          draw: (top: number) => [a ? this.field(a, top, 0, column - COLUMN_GAP, leftKey) : '', b ? this.field(b, top, column, inner - column, rightKey) : ''].join(''),
        })),
      ];
    }
    const lines: Line[] = [
      { gap, height: 1, structure: true, draw: (top) => this.rule(top) },
      { gap, height: EYEBROW_HEIGHT, structure: true, draw: (top) => this.sectionLabel(section.label, top) },
    ];
    section.blocks.forEach((block, index) => {
      const blockLines = this.block(block, inner);
      if (blockLines[0]) blockLines[0] = { ...blockLines[0], gap: blockLines[0].gap + (index === 0 ? gap : BLOCK_GAP) };
      lines.push(...blockLines);
    });
    return lines;
  }

  protected block(block: PanelBlock, inner: number): Line[] {
    const body = this.tokens.size.panelBody;
    switch (block.kind) {
      case 'text':
        return wrap(block.text, body, inner, 40).map((line) => ({
          gap: 0,
          height: TEXT_LINE,
          draw: (top) => this.text(line, top + 12.5, { muted: block.muted }),
        }));
      case 'code': {
        // REQ-100: the query keeps its own lines and indentation; a line that does not fit ends in an ellipsis.
        const size = this.tokens.size.panelCode;
        const lineHeight = size * CODE_LINE;
        const maxChars = Math.floor((inner - 2 * CODE_PADDING.x) / (size * MONO_CHAR_WIDTH));
        const lines: Line[] = block.text
          .replaceAll('\t', '  ')
          .split(/\r?\n/)
          .map((line) => line.trimEnd())
          .map((line, index) => {
            const cut = line.length > maxChars ? `${line.slice(0, maxChars - 1)}…` : line;
            return {
              gap: index === 0 ? CODE_PADDING.y : 0,
              height: lineHeight,
              code: true,
              draw: (top: number) => this.text(cut, top + size + 1, { size, mono: true, x: PADDING.x + CODE_PADDING.x }),
            };
          });
        return [...lines, { gap: 0, height: CODE_PADDING.y, code: true, draw: () => '' }];
      }
      case 'link': {
        const [line] = wrap(`${block.text} →`, body, inner, 1);
        return [
          {
            gap: 0,
            height: TEXT_LINE,
            draw: (top) => `<a href="${escapeXml(block.href)}">${this.text(line!, top + 12.5, { fill: color(this.tokens, 'focus/dark'), underline: true })}</a>`,
          },
        ];
      }
      case 'fields': {
        // Two by two where there is room; a wide value takes a row of its own.
        const column = (inner + COLUMN_GAP) / 2;
        const rows: Field[][] = [];
        for (const field of block.fields) {
          const last = rows.at(-1);
          if (inner >= TWO_COLUMNS && !field.wide && last?.length === 1 && !last[0]!.wide) last.push(field);
          else rows.push([field]);
        }
        const key = keyWidth(block.fields, body);
        return rows.map((row, index) => ({
          gap: index === 0 ? 0 : ROW_GAP,
          height: TEXT_LINE,
          draw: (top: number) =>
            row.length === 1
              ? this.field(row[0]!, top, 0, inner, key)
              : this.field(row[0]!, top, 0, column - COLUMN_GAP, key) + this.field(row[1]!, top, column, inner - column, key),
        }));
      }
      case 'signs':
        // REQ-102: only the signs this chart really drew, each as a sample with its meaning.
        return block.signs.map((sign, index) => ({
          gap: index === 0 ? 0 : SIGN_GAP,
          height: SIGN,
          draw: (top: number) =>
            [
              `<svg x="${PADDING.x}" y="${round(top)}" width="${SIGN}" height="${SIGN}" viewBox="0 0 ${SIGN} ${SIGN}" overflow="hidden">`,
              `<rect width="${SIGN}" height="${SIGN}" fill="${color(this.tokens, 'surface')}"/>${sign.markup}`,
              `<rect x="0.5" y="0.5" width="${SIGN - 1}" height="${SIGN - 1}" fill="none" stroke="${color(this.tokens, 'context/light')}" stroke-width="1"/></svg>`,
              this.text(sign.text, top + 12, { x: PADDING.x + SIGN_TEXT }),
            ].join(''),
        }));
    }
  }

  /** REQ-100: every run of SQL lines lies on one surface, with room around it. */
  protected codeSurfaces(lines: readonly Line[], tops: readonly number[]): string[] {
    const surfaces: string[] = [];
    let start: number | undefined;
    lines.forEach((line, index) => {
      if (line.code && start === undefined) start = index;
      const ends = line.code && !lines[index + 1]?.code;
      if (ends && start !== undefined) {
        const top = tops[start]! - CODE_PADDING.y;
        const bottom = tops[index]! + line.height;
        surfaces.push(
          `<rect x="${PADDING.x}" y="${round(top)}" width="${round(this.innerWidth())}" height="${round(bottom - top)}" rx="${CODE_RADIUS}" fill="${color(this.tokens, 'badge/surface')}"/>`,
        );
        start = undefined;
      }
    });
    return surfaces;
  }

  /** The row of labels at the bottom of a card: the active one underlined, the others switch to their card. */
  protected row(active: MetaItem, cards: MetaCards, top: number, inner: number): string {
    const parts: string[] = [];
    const baseline = top + 11;
    let x = PADDING.x;
    for (const item of cards.items) {
      const isActive = item.kind === active.kind;
      const width = textWidth(item.label, LABEL_SIZE) * (isActive ? BOLD : 1);
      const text = this.text(item.label, baseline, { size: LABEL_SIZE, x, muted: !isActive, weight: isActive ? 600 : undefined });
      if (isActive) {
        parts.push(text, `<rect x="${round(x)}" y="${round(top + 15)}" width="${round(width)}" height="${UNDERLINE}" fill="${color(this.tokens, 'focus')}"/>`);
      } else {
        parts.push(
          `<g class="${PREFIX}-label ${PREFIX}-for-${item.kind} ${PREFIX}-switch" tabindex="-1" role="button" aria-label="${escapeXml(item.label)}">`,
          `<rect x="${round(x - ROW_LABEL_GAP / 2)}" y="${round(top)}" width="${round(width + ROW_LABEL_GAP)}" height="${ROW_HEIGHT}" fill="transparent"/>`,
          text,
          '</g>',
        );
      }
      x += width + ROW_LABEL_GAP;
    }
    // The compiled date at the right, bold, where it fits; it is in the footer anyway (REQ-011).
    if (x + textWidth(cards.compiled, LABEL_SIZE) * BOLD <= PADDING.x + inner) {
      parts.push(this.text(cards.compiled, baseline, { size: LABEL_SIZE, x: PADDING.x + inner, end: true, weight: 700 }));
    }
    return parts.join('');
  }

  protected rule(top: number): string {
    const y = round(top + 0.5);
    return `<line x1="${PADDING.x}" x2="${round(this.innerWidth() + PADDING.x)}" y1="${y}" y2="${y}" stroke="${color(this.tokens, 'context/light')}" stroke-width="1"/>`;
  }

  protected sectionLabel(label: string, top: number, offset = 0): string {
    return this.text(upper(label), top + 10.5, { size: this.tokens.size.panelKind, weight: 700, spacing: true, muted: true, x: PADDING.x + offset });
  }

  /** A name and its value; the name is muted, the value cut to one line. */
  protected field(field: Field, top: number, offset: number, width: number, key: number): string {
    const body = this.tokens.size.panelBody;
    const [value] = wrap(field.value, body, width - key, 1);
    return (
      this.text(field.name, top + 12.5, { muted: true, x: PADDING.x + offset }) +
      this.text(value ?? '', top + 12.5, { x: PADDING.x + offset + key })
    );
  }

  /** The width inside a card; every card of a chart has the same (REQ-099, REQ-085). */
  protected innerWidth(): number {
    const { width } = this.layout;
    const card = width < NARROW ? width - 2 * NARROW_MARGIN : Math.min(CARD_WIDTH, width - 2 * CARD_MARGIN);
    return card - 2 * PADDING.x;
  }

  protected text(
    content: string,
    baseline: number,
    style: { size?: number; weight?: number; muted?: boolean; mono?: boolean; fill?: string; x?: number; end?: boolean; spacing?: boolean; underline?: boolean; className?: string } = {},
  ): string {
    const size = style.size ?? this.tokens.size.panelBody;
    const family = style.mono ? this.tokens.font.mono : this.tokens.font.body;
    const fill = style.fill ?? color(this.tokens, style.muted ? 'text/muted' : 'text');
    const attributes = [
      style.className ? `class="${style.className}"` : '',
      `x="${round(style.x ?? PADDING.x)}"`,
      `y="${round(baseline)}"`,
      style.end ? 'text-anchor="end"' : '',
      `font-family="${escapeXml(family)}"`,
      `font-size="${size}"`,
      style.weight ? `font-weight="${style.weight}"` : '',
      style.spacing ? `letter-spacing="${round(size * SPACING)}"` : '',
      style.underline ? 'text-decoration="underline"' : '',
      `fill="${fill}"`,
      style.mono ? 'xml:space="preserve"' : '',
    ].filter(Boolean);
    return `<text ${attributes.join(' ')}>${escapeXml(content)}</text>`;
  }
}

/** The column of the names: as in Figma, unless a name, such as one in Dutch, needs more room. */
function keyWidth(fields: readonly Field[], size: number): number {
  return Math.max(KEY_WIDTH, ...fields.map((field) => Math.ceil(textWidth(field.name, size)) + 10));
}

function isPair(section: CardSection | readonly [CardSection, CardSection]): section is readonly [CardSection, CardSection] {
  return Array.isArray(section);
}

/** Eyebrows and section labels are in capitals, as in Figma. */
function upper(text: string): string {
  return text.toLocaleUpperCase();
}

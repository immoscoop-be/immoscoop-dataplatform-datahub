import { ICON_SIZE } from '../icon.ts';
import { color, type Tokens } from '../tokens.ts';
import { escapeXml } from './escape.ts';
import { READOUT_LINES, type ReadoutAnchor } from './hover.ts';
import { LABEL_HEIGHT, MetaLayer, type MetaCards } from './meta.ts';
import { round, textWidth, wrap } from './text.ts';

/** A piece of footer text: a link when href is set, bold in the text colour when strong, in the dark focus colour when accent. */
export interface Segment {
  text: string;
  href?: string;
  strong?: boolean;
  accent?: boolean;
}

/** The footer, as the building blocks Origin, Status and Learn link in Figma. */
export interface Footer {
  /** 1) domain › dataset · owner */
  origin: Segment[];
  /** 2) reliability · as of · compiled · definition */
  status: Segment[];
  /** 3) "How do I read this chart?" and the reading card */
  learn: Segment[];
  /** The chart-language version label, only when the chart fully conforms. */
  versionLabel?: string;
}

export interface TemplateInput {
  width: number;
  /** REQ-085: how much the finished chart is enlarged (large and xl); the drawing keeps its own units. */
  scale?: number;
  title: string;
  readingCue: string;
  /**
   * The icon of the semgraph left of the title, linked to the reading card (REQ-060). With a lesson it opens
   * the Learn card instead, which links to the reading card (REQ-103).
   */
  icon?: { markup: string; href: string; label: string; opensLearn?: boolean };
  /** Red alerts between the title and the chart: allowed, but discouraged (REQ-032, REQ-038). */
  alerts?: string[];
  /** SVG definitions the chart refers to, such as a hatch pattern. */
  defs?: string;
  description: string;
  plot: {
    svg: string;
    height: number;
    /** Where the plot area sits inside the plot SVG; the overlay is placed over it. */
    area: { x: number; y: number };
    /**
     * Markup in plot-area coordinates drawn on top of the chart, e.g. the hover layer. It learns where the plot
     * area and the readout of REQ-105 ended up.
     */
    overlay: (place: OverlayPlace) => string;
  };
  /** REQ-105: the room the fixed readout needs in the header, and whether it has a second detail line. */
  readout?: { width: number; extra: boolean };
  footer: Footer;
  /** The metadata labels at the bottom left and their cards (REQ-012, REQ-018, REQ-020, REQ-098, REQ-099). */
  meta: MetaCards;
  tokens: Tokens;
  /** data-* attributes on the root element, e.g. the language and token versions. */
  data: Record<string, string>;
}

/** Where the overlay is drawn: the origin of the plot area, and the readout in the header (REQ-105). */
export interface OverlayPlace {
  origin: { x: number; y: number };
  readout?: ReadoutAnchor;
}

const PADDING_X = 20;
/** REQ-105: room between the title and the readout at its right. */
const READOUT_GAP = 16;
const PADDING_TOP = 18;
/** REQ-060: the icon spans the title and the reading cue, with white around it, as in Figma. */
const ICON_TOP = 12;
const ICON_GAP = 14;
const PADDING_BOTTOM = 16;
const LINE_HEIGHT = 1.5;
/** Room for the warning sign in front of an alert, and the padding inside its red block. */
const ALERT_INDENT = 18;
const ALERT_PADDING = 8;
/** REQ-085: a title may take three lines on a narrow chart, such as a card, so it is never cut. */
const NARROW = 500;

/**
 * The fixed anatomy around the chart, like the building blocks in Figma: title, reading cue,
 * the chart itself, and the footer with origin, status, the learn link, the metadata labels and
 * the version label.
 */
export function composeSvg(input: TemplateInput): string {
  const { tokens, width } = input;
  const scale = input.scale ?? 1;
  const textColor = color(tokens, 'text');
  const muted = color(tokens, 'text/muted');
  const inner = width - 2 * PADDING_X;
  const parts: string[] = [];
  let y = PADDING_TOP;

  // The header block: the icon of the semgraph, in the muted grey (REQ-060), then title and reading cue. REQ-105:
  // the fixed readout stands at the right of title and cue; on a narrow chart on a line of its own under the cue.
  const narrow = width < NARROW;
  const headerX = input.icon ? PADDING_X + ICON_SIZE + ICON_GAP : PADDING_X;
  const reserve = input.readout && !narrow ? input.readout.width + READOUT_GAP : 0;
  const headerWidth = width - PADDING_X - headerX - reserve;
  if (input.icon) {
    const icon =
      `<svg x="${PADDING_X}" y="${ICON_TOP}" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}" fill="none" color="${muted}">` +
      `<rect width="${ICON_SIZE}" height="${ICON_SIZE}" fill="transparent"/>${input.icon.markup.replace(/\n/g, '')}</svg>`;
    // REQ-103: with a lesson the icon is one more label of Learn; the Learn card links to the reading card.
    parts.push(
      input.icon.opensLearn
        ? `<g class="semgraph-meta-label semgraph-meta-for-learn" tabindex="0" role="button" aria-label="${escapeXml(input.icon.label)}">${icon}</g>`
        : `<a href="${escapeXml(input.icon.href)}" aria-label="${escapeXml(input.icon.label)}">${icon}</a>`,
    );
  }
  for (const line of wrap(input.title, tokens.size.title, headerWidth, narrow || reserve > 0 ? 3 : 2)) {
    y += tokens.size.title;
    parts.push(
      text(line, { y, x: headerX, family: tokens.font.title, size: tokens.size.title, weight: 600, fill: textColor }),
    );
    y += tokens.size.title * (LINE_HEIGHT - 1);
  }
  y += tokens.size.readingCue * 0.5;
  wrap(input.readingCue, tokens.size.readingCue, headerWidth, 2).forEach((line, index) => {
    // A second line keeps the line spacing of the first.
    y += tokens.size.readingCue * (index === 0 ? 1 : LINE_HEIGHT);
    parts.push(
      text(line, {
        y,
        x: headerX,
        family: tokens.font.body,
        size: tokens.size.readingCue,
        weight: 700,
        italic: true,
        fill: color(tokens, 'reading-cue/text'),
      }),
    );
  });

  let readout: ReadoutAnchor | undefined;
  if (input.readout && narrow) {
    y += 6 + READOUT_LINES.narrowValue;
    readout = { x: headerX, y, align: 'start' };
    y += (input.readout.extra ? READOUT_LINES.extra : 0) + 3;
  } else if (input.readout) {
    readout = { x: width - PADDING_X, y: PADDING_TOP + tokens.size.title, align: 'end' };
    y = Math.max(y, readout.y + READOUT_LINES.detail + (input.readout.extra ? READOUT_LINES.extra : 0) + 4);
  }

  // A warning lies under the header block, over the full width (REQ-060).
  if (input.icon) y = Math.max(y, ICON_TOP + ICON_SIZE);

  // A red block with white text (REQ-040). The text speaks to the reader, as help to read the chart;
  // the discomfort of whoever delivers it stays implicit (REQ-041).
  for (const alert of input.alerts ?? []) {
    y += 10;
    const size = tokens.size.readingCue;
    // Never cut: on a card an alert simply takes more lines.
    const lines = wrap(alert, size, inner - ALERT_INDENT - 2 * ALERT_PADDING, 12);
    const height = 2 * ALERT_PADDING + lines.length * size * LINE_HEIGHT - size * (LINE_HEIGHT - 1);
    parts.push(`<rect x="${PADDING_X}" y="${round(y)}" width="${inner}" height="${round(height)}" rx="3" fill="${color(tokens, 'warning')}"/>`);
    parts.push(alertIcon(y + ALERT_PADDING, size, color(tokens, 'warning')));
    let lineY = y + ALERT_PADDING;
    for (const line of lines) {
      lineY += size;
      parts.push(text(line, { y: lineY, x: PADDING_X + ALERT_PADDING + ALERT_INDENT, family: tokens.font.body, size, weight: 700, fill: '#ffffff' }));
      lineY += size * (LINE_HEIGHT - 1);
    }
    y += height;
  }

  y += 8;
  parts.push(input.plot.svg.replace(/^<svg /, `<svg x="0" y="${round(y)}" `));
  const origin = { x: input.plot.area.x, y: y + input.plot.area.y };
  const overlay = input.plot.overlay({ origin, ...(readout ? { readout } : {}) });
  if (overlay) parts.push(`<g transform="translate(${round(origin.x)},${round(origin.y)})">`, overlay, '</g>');
  y += input.plot.height + 10;

  parts.push(
    `<line x1="${PADDING_X}" x2="${width - PADDING_X}" y1="${round(y)}" y2="${round(y)}" stroke="${color(tokens, 'context/light')}" stroke-width="1"/>`,
  );
  y += 6;
  const footerSize = tokens.size.footer;
  const footerLine = (segments: Segment[], style: Partial<TextStyle> = {}) => {
    for (const line of footerLines(segments, footerSize, inner)) {
      y += footerSize * LINE_HEIGHT;
      parts.push(segmentsText(line, { y, family: tokens.font.body, size: footerSize, fill: muted, ...style }, tokens));
    }
  };
  footerLine(input.footer.origin, { weight: 600, fill: textColor });
  footerLine(input.footer.status);
  footerLine(input.footer.learn);

  // The metadata labels at the bottom left (REQ-012, REQ-018), the version label at the right of the same row.
  y += 10;
  const row = y;
  if (input.footer.versionLabel) {
    parts.push(text(input.footer.versionLabel, { y: row + 12.5, x: width - PADDING_X, anchor: 'end', family: tokens.font.body, size: footerSize, fill: muted }));
  }
  y += LABEL_HEIGHT + PADDING_BOTTOM;
  const height = Math.ceil(y);
  // Drawn last, so a card and its veil lie over the whole chart (REQ-098).
  const metaLayer = new MetaLayer(tokens, { width, height, left: PADDING_X, top: row }).render(input.meta);
  if (metaLayer) parts.push(metaLayer);

  const data = Object.entries(input.data)
    .map(([name, value]) => ` data-${name}="${escapeXml(value)}"`)
    .join('');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width * scale)}" height="${Math.ceil(height * scale)}" viewBox="0 0 ${width} ${height}"${data}>`,
    `<title>${escapeXml(input.title)}</title>`,
    `<desc>${escapeXml(input.description)}</desc>`,
    ...(input.defs ? [`<defs>${input.defs}</defs>`] : []),
    `<rect width="${width}" height="${height}" fill="${color(tokens, 'surface')}"/>`,
    ...parts,
    '</svg>',
  ].join('\n');
}

interface TextStyle {
  y: number;
  x?: number;
  family: string;
  size: number;
  fill: string;
  weight?: number;
  italic?: boolean;
  anchor?: 'end';
}

function attributes(style: TextStyle): string {
  return [
    `x="${style.x ?? PADDING_X}"`,
    `y="${round(style.y)}"`,
    style.anchor ? `text-anchor="${style.anchor}"` : '',
    `font-family="${escapeXml(style.family)}"`,
    `font-size="${style.size}"`,
    style.weight ? `font-weight="${style.weight}"` : '',
    style.italic ? 'font-style="italic"' : '',
    `fill="${style.fill}"`,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * A warning sign on the red block: a white triangle with an exclamation mark in the alert colour.
 * The block is a strong, solid colour: never the light tint that means spread (REQ-009).
 */
function alertIcon(top: number, size: number, alertColor: string): string {
  const h = size + 2;
  const w = h * 1.15;
  const x = PADDING_X + ALERT_PADDING;
  const y = top + 0.5;
  const mid = x + w / 2;
  return [
    `<path d="M${round(mid)},${round(y)}L${round(x + w)},${round(y + h)}L${round(x)},${round(y + h)}Z" fill="#ffffff"/>`,
    `<path d="M${round(mid)},${round(y + h * 0.35)}V${round(y + h * 0.68)}" stroke="${alertColor}" stroke-width="1.5" stroke-linecap="round"/>`,
    `<circle cx="${round(mid)}" cy="${round(y + h * 0.83)}" r="0.9" fill="${alertColor}"/>`,
  ].join('');
}

function text(content: string, style: TextStyle): string {
  return `<text ${attributes(style)}>${escapeXml(content)}</text>`;
}

/**
 * A footer line that is wider than the chart, such as on a narrow KPI tile, breaks at its separators
 * (" · ", " › "); the separator at the break is left out.
 */
function footerLines(segments: Segment[], size: number, width: number): Segment[][] {
  const separator = (segment: Segment) => !segment.href && /^ \S \s*$/.test(segment.text);
  const widthOf = (line: Segment[]) => line.reduce((sum, segment) => sum + textWidth(segment.text, size) * (segment.strong ? 1.06 : 1), 0);
  const lines: Segment[][] = [[]];
  let pending: Segment | undefined;
  for (const segment of segments) {
    if (separator(segment)) {
      pending = segment;
      continue;
    }
    const line = lines.at(-1)!;
    const candidate = [...line, ...(pending && line.length > 0 ? [pending] : []), segment];
    if (line.length > 0 && widthOf(candidate) > width) lines.push([segment]);
    else line.splice(0, line.length, ...candidate);
    pending = undefined;
  }
  return lines;
}

/** Links carry an arrow instead of an underline, as in Figma. */
function segmentsText(segments: Segment[], style: TextStyle, tokens: Tokens): string {
  const body = segments
    .map((segment) => {
      const attributes = [
        segment.strong ? ` font-weight="700" fill="${color(tokens, 'text')}"` : '',
        segment.accent ? ` fill="${color(tokens, 'focus/dark')}"` : '',
      ].join('');
      const span = `<tspan${attributes}>${escapeXml(segment.text)}</tspan>`;
      return segment.href ? `<a href="${escapeXml(segment.href)}">${span}</a>` : span;
    })
    .join('');
  return `<text ${attributes(style)} xml:space="preserve">${body}</text>`;
}

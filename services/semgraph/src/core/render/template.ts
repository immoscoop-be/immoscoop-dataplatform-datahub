import { ICON_SIZE } from '../icon.ts';
import { color, type Tokens } from '../tokens.ts';
import { escapeXml } from './escape.ts';
import { LABEL_HEIGHT, MetaLayer, type MetaItem } from './meta.ts';
import { round, wrap } from './text.ts';

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
  title: string;
  readingCue: string;
  /** The icon of the semgraph left of the title, linked to the reading card (REQ-060). */
  icon?: { markup: string; href: string; label: string };
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
    /** Markup in plot-area coordinates drawn on top of the chart, e.g. the hover layer. */
    overlay: string;
  };
  footer: Footer;
  /** The metadata labels at the bottom left and their panels (REQ-012, REQ-014, REQ-018, REQ-020). */
  meta: MetaItem[];
  tokens: Tokens;
  /** data-* attributes on the root element, e.g. the language and token versions. */
  data: Record<string, string>;
}

const PADDING_X = 20;
const PADDING_TOP = 18;
/** REQ-060: the icon spans the title and the reading cue, with white around it, as in Figma. */
const ICON_TOP = 12;
const ICON_GAP = 14;
const PADDING_BOTTOM = 16;
const LINE_HEIGHT = 1.5;
/** Room for the warning sign in front of an alert, and the padding inside its red block. */
const ALERT_INDENT = 18;
const ALERT_PADDING = 8;

/**
 * The fixed anatomy around the chart, like the building blocks in Figma: title, reading cue,
 * the chart itself, and the footer with origin, status, the learn link, the metadata labels and
 * the version label.
 */
export function composeSvg(input: TemplateInput): string {
  const { tokens, width } = input;
  const textColor = color(tokens, 'text');
  const muted = color(tokens, 'text/muted');
  const inner = width - 2 * PADDING_X;
  const parts: string[] = [];
  let y = PADDING_TOP;

  // The header block: the icon of the semgraph, in the muted grey (REQ-060), then title and reading cue.
  const headerX = input.icon ? PADDING_X + ICON_SIZE + ICON_GAP : PADDING_X;
  const headerWidth = width - PADDING_X - headerX;
  if (input.icon) {
    parts.push(
      `<a href="${escapeXml(input.icon.href)}" aria-label="${escapeXml(input.icon.label)}">` +
        `<svg x="${PADDING_X}" y="${ICON_TOP}" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}" fill="none" color="${muted}">` +
        `<rect width="${ICON_SIZE}" height="${ICON_SIZE}" fill="transparent"/>${input.icon.markup.replace(/\n/g, '')}</svg></a>`,
    );
  }
  for (const line of wrap(input.title, tokens.size.title, headerWidth, 2)) {
    y += tokens.size.title;
    parts.push(
      text(line, { y, x: headerX, family: tokens.font.title, size: tokens.size.title, weight: 600, fill: textColor }),
    );
    y += tokens.size.title * (LINE_HEIGHT - 1);
  }
  y += tokens.size.readingCue * 0.5;
  for (const line of wrap(input.readingCue, tokens.size.readingCue, headerWidth, 2)) {
    y += tokens.size.readingCue;
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
  }

  // A warning lies under the header block, over the full width (REQ-060).
  if (input.icon) y = Math.max(y, ICON_TOP + ICON_SIZE);

  // A red block with white text (REQ-040). The text speaks to the reader, as help to read the chart;
  // the discomfort of whoever delivers it stays implicit (REQ-041).
  for (const alert of input.alerts ?? []) {
    y += 10;
    const size = tokens.size.readingCue;
    const lines = wrap(alert, size, inner - ALERT_INDENT - 2 * ALERT_PADDING, 4);
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
  if (input.plot.overlay) {
    parts.push(`<g transform="translate(${round(input.plot.area.x)},${round(y + input.plot.area.y)})">`, input.plot.overlay, '</g>');
  }
  y += input.plot.height + 10;

  parts.push(
    `<line x1="${PADDING_X}" x2="${width - PADDING_X}" y1="${round(y)}" y2="${round(y)}" stroke="${color(tokens, 'context/light')}" stroke-width="1"/>`,
  );
  y += 6;
  const footerSize = tokens.size.footer;
  const footerLine = (segments: Segment[], style: Partial<TextStyle> = {}) => {
    y += footerSize * LINE_HEIGHT;
    parts.push(segmentsText(segments, { y, family: tokens.font.body, size: footerSize, fill: muted, ...style }, tokens));
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
  // Drawn last, so a panel lies over the whole chart (REQ-014).
  const metaLayer = new MetaLayer(tokens, { width, left: PADDING_X, top: row }).render(input.meta);
  if (metaLayer) parts.push(metaLayer);

  const height = Math.ceil(y);
  const data = Object.entries(input.data)
    .map(([name, value]) => ` data-${name}="${escapeXml(value)}"`)
    .join('');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"${data}>`,
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

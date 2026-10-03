import { color, type Tokens } from '../tokens.ts';
import { escapeXml } from './escape.ts';

/** A piece of footer text; a link when href is set. */
export interface Segment {
  text: string;
  href?: string;
}

export interface Footer {
  /** 1) domain › dataset · owner */
  provenance: Segment[];
  /** 2) reliability · as-of date · definition */
  status: Segment[];
  /** 3) "How do I read this chart?" */
  learn: Segment[];
  /** "Outside the chart language: ..." when there are tolerated deviations. */
  note?: string;
  /** The chart-language version label, only when the chart fully conforms. */
  versionLabel?: string;
}

export interface TemplateInput {
  width: number;
  title: string;
  readingCue: string;
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
  tokens: Tokens;
  /** data-* attributes on the root element, e.g. the language and token versions. */
  data: Record<string, string>;
}

const PADDING_X = 20;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 16;
const LINE_HEIGHT = 1.5;
/** Average character width as a share of the font size; good enough to wrap footer notes. */
const CHAR_WIDTH = 0.56;
/** Room for the warning sign in front of an alert, and the padding inside its red block. */
const ALERT_INDENT = 18;
const ALERT_PADDING = 8;

/**
 * The fixed anatomy around the chart, like the building blocks in Figma: title, reading cue,
 * the chart itself, and the footer with provenance, status, a learning link and the version label.
 */
export function composeSvg(input: TemplateInput): string {
  const { tokens, width } = input;
  const textColor = color(tokens, 'text');
  const muted = color(tokens, 'text/muted');
  const inner = width - 2 * PADDING_X;
  const parts: string[] = [];
  let y = PADDING_TOP;

  for (const line of wrap(input.title, tokens.size.title, inner, 2)) {
    y += tokens.size.title;
    parts.push(
      text(line, { y, family: tokens.font.title, size: tokens.size.title, weight: 600, fill: textColor }),
    );
    y += tokens.size.title * (LINE_HEIGHT - 1);
  }
  y += tokens.size.readingCue * 0.5;
  for (const line of wrap(input.readingCue, tokens.size.readingCue, inner, 2)) {
    y += tokens.size.readingCue;
    parts.push(
      text(line, {
        y,
        family: tokens.font.body,
        size: tokens.size.readingCue,
        weight: 700,
        italic: true,
        fill: color(tokens, 'reading-cue/text'),
      }),
    );
  }

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
  const footerLine = (segments: Segment[]) => {
    y += footerSize * LINE_HEIGHT;
    parts.push(segmentsText(segments, { y, family: tokens.font.body, size: footerSize, fill: muted }));
  };
  footerLine(input.footer.provenance);
  footerLine(input.footer.status);
  footerLine(input.footer.learn);
  if (input.footer.note) {
    for (const line of wrap(input.footer.note, footerSize, inner, 4)) footerLine([{ text: line }]);
  }
  if (input.footer.versionLabel) footerLine([{ text: input.footer.versionLabel }]);
  y += PADDING_BOTTOM;

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
}

function attributes(style: TextStyle): string {
  return [
    `x="${style.x ?? PADDING_X}"`,
    `y="${round(style.y)}"`,
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

function segmentsText(segments: Segment[], style: TextStyle): string {
  const body = segments
    .map((segment) =>
      segment.href
        ? `<a href="${escapeXml(segment.href)}"><tspan text-decoration="underline">${escapeXml(segment.text)}</tspan></a>`
        : `<tspan>${escapeXml(segment.text)}</tspan>`,
    )
    .join('');
  return `<text ${attributes(style)} xml:space="preserve">${body}</text>`;
}

/** Greedy word wrap on estimated widths; the last allowed line ends in an ellipsis when cut. */
export function wrap(content: string, size: number, width: number, maxLines: number): string[] {
  const maxChars = Math.max(10, Math.floor(width / (size * CHAR_WIDTH)));
  const lines: string[] = [];
  let line = '';
  for (const word of content.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1]!.slice(0, maxChars - 1)}…`;
  return kept;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

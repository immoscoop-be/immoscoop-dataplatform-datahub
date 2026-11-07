/**
 * The icon of a semgraph (REQ-060, REQ-061): semgraphs/<id>/icon.svg, as exported from the Semgraph
 * icons in Figma, in currentColor so the template gives it the muted grey of the tokens.
 */

/** The size of an icon in Figma, and in the header of a chart. */
export const ICON_SIZE = 44;

/**
 * REQ-061: icons are built from a small fixed set. One stroke weight; one dot (a median), plus the
 * small dots that make a dotted line (an earlier period). Diamonds and squares are paths. The icon of
 * `distribution` in Figma stacks dots of its own size, a histogram in dots; the KPI icons draw a ring
 * around their number (`kpiTile`) and a target mark (`kpiStatus`): allowed as they are in Figma.
 */
const STROKE_WIDTH = '0.75';
const RADII = { dot: '1.87', lineDot: '0.66', stackDot: '1.43', tileRing: '11.725', targetRing: '4.025', targetDot: '1.1' } as const;
const ELEMENTS = new Set(['svg', 'path', 'circle']);
const COLOUR_ATTRIBUTES = ['fill', 'stroke', 'color', 'stop-color'];

export interface Icon {
  /** What goes inside the icon's own svg element: its paths and circles. */
  markup: string;
  problems: string[];
}

/** Reads an icon and checks it against the building blocks of REQ-061. */
export function readIcon(svg: string): Icon {
  const problems: string[] = [];
  const root = /^<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/.exec(svg.trim());
  if (!root) return { markup: '', problems: ['icon.svg is not a single svg element'] };
  const [, rootAttributes, markup] = root as unknown as [string, string, string];
  if (!/\bviewBox="0 0 44 44"/.test(rootAttributes)) problems.push(`icon.svg must have viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}"`);
  for (const [, name, attributes] of svg.matchAll(/<([a-zA-Z]+)\b([^>]*)>/g) as Iterable<[string, string, string]>) {
    if (!ELEMENTS.has(name)) problems.push(`icon.svg may only hold paths and circles, not <${name}>`);
    for (const [, attribute, value] of attributes.matchAll(/([a-z-]+)="([^"]*)"/g) as Iterable<[string, string, string]>) {
      if (COLOUR_ATTRIBUTES.includes(attribute) && value !== 'currentColor' && value !== 'none') {
        problems.push(`icon.svg has one colour, currentColor; found ${attribute}="${value}"`);
      }
      if (attribute === 'stroke-width' && value !== STROKE_WIDTH) problems.push(`icon.svg has one stroke weight, ${STROKE_WIDTH}; found ${value}`);
      if (attribute === 'style' || attribute === 'opacity' || attribute.endsWith('-opacity')) problems.push(`icon.svg may not use ${attribute}`);
    }
    if (name === 'circle') {
      const radius = /\br="([^"]*)"/.exec(attributes)?.[1];
      if (!Object.values(RADII).includes(radius as never)) problems.push(`icon.svg has dots of r ${RADII.dot} (and ${RADII.lineDot} in a dotted line, ${RADII.stackDot} in a histogram of dots, ${RADII.tileRing}, ${RADII.targetRing} and ${RADII.targetDot} in the KPI icons); found r ${radius}`);
    }
  }
  return { markup: markup.trim(), problems };
}

/** The shapes an icon is made of, to check that it says what its semgraph shows (REQ-061). */
export function iconShapes(markup: string): { diamonds: number; squares: number; dots: number; lineDots: number } {
  const paths = [...markup.matchAll(/<path\b[^>]*\bd="([^"]*)"[^>]*\bfill="currentColor"/g)].map((match) => match[1]!);
  const radii = [...markup.matchAll(/<circle\b[^>]*\br="([^"]*)"/g)].map((match) => match[1]);
  return {
    // A filled diamond: four corners joined by straight lines; a filled square: lines along the axes.
    diamonds: paths.filter((d) => /^M[\d.]+ [\d.]+(L[\d.]+ [\d.]+){4}Z$/.test(d)).length,
    squares: paths.filter((d) => /^M[\d.]+ [\d.]+H[\d.]+V[\d.]+H[\d.]+V[\d.]+Z$/.test(d)).length,
    dots: radii.filter((r) => r === RADII.dot).length,
    lineDots: radii.filter((r) => r === RADII.lineDot).length,
  };
}

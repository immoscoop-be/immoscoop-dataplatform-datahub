import type { Config } from 'vega-lite';

/** The chart-language tokens. The service takes its style only from tokens/ptditt-grafiektaal-tokens.json. */
export interface Tokens {
  version: string;
  languageVersion: string;
  color: Record<string, string>;
  font: { title: string; body: string; mono: string };
  size: {
    title: number;
    readingCue: number;
    value: number;
    detail: number;
    axisLabel: number;
    footer: number;
    panelTitle: number;
    panelBody: number;
  };
  stroke: { axis: number; baseline: number; spread: number; spreadWide: number; line: number; missing: number; guide: number };
  /** Width in pixels of a point, per shape (see src/charts/signatures.ts). */
  mark: { square: number; diamond: number; circle: number };
}

export function color(tokens: Tokens, name: string): string {
  const value = tokens.color[name];
  if (value === undefined) throw new Error(`Unknown colour token ${name}`);
  return value;
}

/** The Vega-Lite theme: everything that is the same for every semgraph. */
export function vegaLiteConfig(tokens: Tokens): Config {
  const font = tokens.font.body;
  return {
    aria: false,
    view: { stroke: null },
    font,
    axis: {
      title: null,
      labelFont: font,
      labelFontSize: tokens.size.axisLabel,
      labelColor: color(tokens, 'text/muted'),
      labelOverlap: false,
      labelFlush: false,
      domainColor: color(tokens, 'axis'),
      domainWidth: tokens.stroke.axis,
      tickColor: color(tokens, 'axis'),
      tickWidth: tokens.stroke.axis,
      gridColor: color(tokens, 'context/light'),
      gridWidth: tokens.stroke.axis,
    },
    // The baseline, the floor of the value axis, is darker and thicker than the other axis lines.
    axisX: {
      domainColor: color(tokens, 'baseline'),
      domainWidth: tokens.stroke.baseline,
      grid: false,
      tickSize: 4,
      labelPadding: 4,
    },
    axisY: { domain: false, ticks: false, grid: true, labelPadding: 8 },
    text: { font, fontSize: tokens.size.value, color: color(tokens, 'text') },
  };
}

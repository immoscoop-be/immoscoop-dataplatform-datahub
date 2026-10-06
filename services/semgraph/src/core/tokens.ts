import type { Config } from 'vega-lite';

/** The chart-language tokens. The service takes its style only from tokens/ptditt-grafiektaal-tokens.json. */
export interface Tokens {
  version: string;
  languageVersion: string;
  /** The colours of the mode Light in Figma, the default. */
  color: Record<string, string>;
  /** REQ-094: the same colours in the mode Dark; every name of color has one. */
  colorDark: Record<string, string>;
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
    /** The number of a KPI tile, its comparison, and what a KPI status still needs (REQ-065). */
    kpi: number;
    kpiDetail: number;
    delta: number;
  };
  stroke: { axis: number; baseline: number; spread: number; spreadWide: number; line: number; guide: number };
  /** Width in pixels of a point, per shape (see src/charts/signatures.ts). */
  mark: { square: number; diamond: number; circle: number };
}

/** REQ-094: a chart is light, or dark for a dark page or conversation. */
export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** The theme a request asks for; light when it asks for none. */
export function themeOf(request: object): Theme {
  return (request as { theme?: unknown }).theme === 'dark' ? 'dark' : 'light';
}

/**
 * The tokens of a theme. Everything that draws takes its colours from color(), so a dark chart is the same
 * chart with the colours of the mode Dark: nothing else changes.
 */
export function tokensFor(tokens: Tokens, theme: Theme): Tokens {
  return theme === 'dark' ? { ...tokens, color: tokens.colorDark } : tokens;
}

/** Every colour of the mode Light has a value in the mode Dark, and nothing more. */
export function checkThemes(tokens: Tokens): string[] {
  const light = Object.keys(tokens.color);
  const dark = Object.keys(tokens.colorDark ?? {});
  return [
    ...light.filter((name) => !dark.includes(name)).map((name) => `colour token ${name} has no value in colorDark`),
    ...dark.filter((name) => !light.includes(name)).map((name) => `colorDark has ${name}, which color has not`),
  ];
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

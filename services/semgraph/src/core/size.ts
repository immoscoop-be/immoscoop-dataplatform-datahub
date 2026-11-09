/**
 * REQ-085: the fixed sizes a chart can be drawn in. Only the width is chosen; the height follows from
 * the content. `layout` is the width the chart is built at, with the type sizes and strokes of the
 * chart language, so everything written on it fits. `scale` enlarges the whole for a slide or a big
 * screen, which are seen from further away: large is 1280 px wide (a 16:9 slide), xl 1920 px (full HD,
 * or print). The widths and the enlargement are a proposal to confirm (open point).
 */
export const SIZES = {
  // As wide as the KPI tile, so a chart and a tile sit side by side on a dashboard.
  card: { layout: 360, scale: 1 },
  default: { layout: 640, scale: 1 },
  large: { layout: 960, scale: 4 / 3 },
  xl: { layout: 1280, scale: 1.5 },
} as const;

export type SizeName = keyof typeof SIZES;
export const SIZE_NAMES = Object.keys(SIZES) as SizeName[];

export interface ChartSize {
  name: SizeName;
  /** The width the chart is built at. */
  layout: number;
  /** How much the finished chart is enlarged; its width is layout × scale. */
  scale: number;
}

/** The size a request asks for; the default when it asks for none. */
export function sizeOf(request: object): ChartSize {
  const { size } = request as { size?: unknown };
  const name = typeof size === 'string' && size in SIZES ? (size as SizeName) : 'default';
  return { name, ...SIZES[name] };
}

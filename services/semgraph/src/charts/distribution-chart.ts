import type { TopLevelSpec } from 'vega-lite';
import { currentDay, localizeDay, parseDay } from '../core/days.ts';
import type { IssueSpec } from '../core/issues.ts';
import { META_SCHEMA, type ChartMeta } from '../core/meta.ts';
import type { HoverSpec } from '../core/render/hover.ts';
import type { DrawContext, Drawing, RequestContext, SemgraphImplementation, SemgraphMetadata } from '../core/semgraph.ts';
import { color, vegaLiteConfig } from '../core/tokens.ts';
import { sizeOf } from '../core/size.ts';
import { CONTEXT, DAY, FORMAT, LOCALE, METRIC, SIZE, THEME, TITLE } from './contract.ts';
import { CompactFormat, UNIT_SCHEMA, type ValueUnit } from './number-format.ts';
import { lookup, niceRange, valueScale } from './scales.ts';
import { PLOT_HEIGHT } from './time-axis-chart.ts';

export interface Bin {
  from: number;
  count: number;
}

export interface DistributionRequest {
  semgraph: string;
  metric: string;
  title?: string;
  /** Width of every bin, fixed per metric in the dbt YAML so months stay comparable (Figma). */
  binWidth: number;
  bins: Bin[];
  /** Everything above the threshold (about P95), as one open bin set apart. */
  openBin?: Bin;
  percentiles: { p25: number; p50: number; p75: number };
  asOf?: string;
  unit?: ValueUnit;
  /** card, default, large or xl (REQ-085). */
  size?: string;
  format?: string;
  locale?: string;
  context?: RequestContext;
  meta?: ChartMeta;
}

export interface DistributionComputed {
  reference: number;
  /** The end of the last closed bin. */
  end: number;
  total: number;
}

const PADDING = { left: 52, right: 28, top: 36, bottom: 40 };
/** The open bin stands apart from the others by this share of a bin. */
const GAP = 0.6;

/**
 * The distribution of a continuous value, after Figma's Chart/Distribution: bins of equal width that
 * touch, because the axis is not a set of categories; one colour; P25, P50 and P75 as grey guide
 * lines with their value, the median darker and bold; everything above the threshold (about P95) in
 * one open bin, set apart and grey. The warehouse counts the bins (REQ-058); the chart checks and draws.
 */
export class DistributionChart implements SemgraphImplementation<DistributionRequest, DistributionComputed> {
  readonly id: string;

  constructor(id: string) {
    this.id = id;
  }

  schema(): object {
    const bin = (description: string) => ({
      description,
      type: 'object',
      additionalProperties: false,
      required: ['from', 'count'],
      properties: {
        from: { description: 'The lower edge of the bin.', type: 'number' },
        count: { description: 'The number of units in the bin.', type: 'integer', minimum: 0 },
      },
    });
    return {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: `semgraph:${this.id}/request`,
      title: `${this.id} request`,
      description:
        'The distribution of a continuous value as bins of equal width that touch, with P25, P50 and P75, and everything above the threshold (about P95) in one open bin. The warehouse counts the bins (REQ-058); bin width and threshold are fixed per metric in the dbt YAML.',
      type: 'object',
      additionalProperties: false,
      required: ['semgraph', 'metric', 'binWidth', 'bins', 'percentiles'],
      properties: {
        semgraph: { const: this.id },
        metric: METRIC,
        title: TITLE,
        binWidth: { description: 'The width of every bin, in the unit of the value; it stands in the reading cue.', type: 'number', exclusiveMinimum: 0 },
        bins: { description: 'The bins from low to high, each one bin width after the previous.', type: 'array', minItems: 2, maxItems: 60, items: bin('One bin: from its lower edge, one bin width wide.') },
        openBin: bin('Everything from this threshold up, about P95: one open bin, set apart and grey.'),
        percentiles: {
          description: 'P25, P50 (the median) and P75 of all units, as the warehouse computed them.',
          type: 'object',
          additionalProperties: false,
          required: ['p25', 'p50', 'p75'],
          properties: { p25: { type: 'number' }, p50: { type: 'number' }, p75: { type: 'number' } },
        },
        asOf: { description: 'The day of the data, for the footer. Yesterday in Brussels when absent.', ...DAY },
        unit: UNIT_SCHEMA,
        size: SIZE,
        theme: THEME,
        format: FORMAT,
        locale: LOCALE,
        context: CONTEXT,
        meta: META_SCHEMA,
      },
    };
  }

  check(request: DistributionRequest): IssueSpec[] {
    const issues: IssueSpec[] = [];
    if (request.asOf !== undefined && parseDay(request.asOf) === undefined) {
      issues.push({ level: 'inputError', code: 'invalidDate', field: '/asOf', params: { value: request.asOf } });
    }
    // Equal bins that touch: each starts one bin width after the previous.
    const first = request.bins[0]!.from;
    const off = request.bins.findIndex((bin, index) => Math.abs(bin.from - (first + index * request.binWidth)) > request.binWidth * 1e-9);
    if (off >= 0) issues.push({ level: 'inputError', code: 'binsNotContiguous', field: `/bins/${off}/from`, params: { width: request.binWidth } });
    const end = first + request.bins.length * request.binWidth;
    if (request.openBin && request.openBin.from < end - request.binWidth * 1e-9) {
      issues.push({ level: 'inputError', code: 'openBinOverlaps', field: '/openBin/from' });
    }
    const { p25, p50, p75 } = request.percentiles;
    if (!(p25 <= p50 && p50 <= p75)) issues.push({ level: 'inputError', code: 'spreadOrder', field: '/percentiles' });
    return issues;
  }

  compute(request: DistributionRequest, { now }: { now: Date }): DistributionComputed {
    const reference = request.asOf === undefined ? currentDay(now) - 1 : parseDay(request.asOf)!;
    const end = request.bins[0]!.from + request.bins.length * request.binWidth;
    const total = request.bins.reduce((sum, bin) => sum + bin.count, 0) + (request.openBin?.count ?? 0);
    return { reference, end, total };
  }

  rules(_request: DistributionRequest, computed: DistributionComputed, { metadata }: { metadata: SemgraphMetadata }): IssueSpec[] {
    if (computed.total === 0) return [{ level: 'refusal', code: 'noData', field: '/bins' }];
    const { minimumPoints } = metadata.data;
    if (computed.total < minimumPoints) return [{ level: 'refusal', code: 'tooFewUnits', field: '/bins', params: { count: computed.total, minimumPoints } }];
    return [];
  }

  draw(request: DistributionRequest, computed: DistributionComputed, { t, tokens }: DrawContext): Drawing {
    const { bins, binWidth, openBin, percentiles } = request;
    const first = bins[0]!.from;
    const openFrom = computed.end + GAP * binWidth;
    const right = openBin ? openFrom + binWidth : computed.end;
    const width = sizeOf(request).layout;
    const plotWidth = width - PADDING.left - PADDING.right;
    const counts = [...bins.map((bin) => bin.count), openBin?.count ?? 0];
    // Room above the open bin for its count and share.
    const highest = Math.max(...counts);
    let scale = valueScale(0, highest, 'zero');
    const needed = (openBin?.count ?? 0) + 26 * (scale.max / PLOT_HEIGHT);
    if (needed > scale.max) scale = valueScale(0, needed, 'zero');
    const values = new CompactFormat(t.locale, computed.end, request.unit);
    const amounts = new CompactFormat(t.locale, scale.max);
    const percent = new Intl.NumberFormat(t.locale, { style: 'percent', maximumFractionDigits: 0 });
    const share = (count: number) => percent.format(count / computed.total);

    // Ticks on round values inside the closed bins; the open bin is named instead.
    const xTicks = niceRange(first, computed.end, 4).filter((tick) => tick >= first && tick <= computed.end);
    const x = { field: 'x', type: 'quantitative' as const, scale: { domain: [first, right], nice: false, zero: false } };
    const y = { field: 'y', type: 'quantitative' as const, scale: { domain: [0, scale.max], nice: false, zero: false } };
    const guides = [
      { x: percentiles.p25, name: 'P25', value: values.value(percentiles.p25), align: 'right', median: false },
      { x: percentiles.p50, name: 'P50', value: values.value(percentiles.p50), align: 'center', median: true },
      { x: percentiles.p75, name: 'P75', value: values.value(percentiles.p75), align: 'left', median: false },
    ];
    const guideLabels = (median: boolean, align: string) => guides.filter((guide) => guide.median === median && guide.align === align);

    const textLayer = (name: string, props: object, yPixel: number, field = 'text') => ({
      data: { name },
      mark: { type: 'text', baseline: 'bottom', ...props },
      encoding: { x, y: { value: yPixel }, text: { field } },
    });

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      width: plotWidth,
      height: PLOT_HEIGHT,
      autosize: { type: 'none' },
      padding: PADDING,
      background: 'transparent',
      config: vegaLiteConfig(tokens),
      datasets: {
        frame: [{ x: first, y: 0 }],
        bins: bins.map((bin) => ({ x: bin.from, x2: bin.from + binWidth, y: 0, y2: bin.count })),
        open: openBin ? [{ x: openFrom, x2: right, y: 0, y2: openBin.count }] : [],
        separator: openBin ? [{ x: computed.end + (GAP / 2) * binWidth }] : [],
        openLabel: openBin ? [{ x: openFrom + binWidth / 2, y: openBin.count, text: amounts.value(openBin.count), share: share(openBin.count) }] : [],
        openAxis: openBin ? [{ x: openFrom + binWidth / 2, lines: [t('chart.distribution.open'), values.value(openBin.from)] }] : [],
        guides: guides.map(({ x: at, median }) => ({ x: at, median })),
        ...Object.fromEntries(['left', 'center', 'right'].flatMap((align) => [
          [`guideNames_${align}`, guideLabels(false, align).concat(guideLabels(true, align)).map((guide) => ({ x: guide.x, text: guide.name }))],
          [`guideValues_${align}`, guideLabels(false, align).map((guide) => ({ x: guide.x, text: guide.value }))],
          [`guideMedian_${align}`, guideLabels(true, align).map((guide) => ({ x: guide.x, text: guide.value }))],
        ])),
      },
      layer: [
        {
          data: { name: 'frame' },
          mark: { type: 'point', opacity: 0 },
          encoding: {
            x: { ...x, axis: { values: xTicks, labelExpr: lookup(values.ticks(xTicks)), title: null } },
            y: { ...y, axis: { values: scale.ticks, labelExpr: lookup(amounts.ticks(scale.ticks)), title: null } },
          },
        },
        {
          // Bins touch: a hairline in the surface colour only marks where one ends and the next begins.
          data: { name: 'bins' },
          mark: { type: 'rect', color: color(tokens, 'focus'), stroke: color(tokens, 'surface'), strokeWidth: 1, opacity: 1 },
          encoding: { x, x2: { field: 'x2' }, y, y2: { field: 'y2' } },
        },
        {
          data: { name: 'separator' },
          mark: { type: 'rule', color: color(tokens, 'axis'), strokeWidth: tokens.stroke.axis },
          encoding: { x, y: { value: 0 }, y2: { value: PLOT_HEIGHT } },
        },
        {
          // The remainder: set apart and grey (Figma).
          data: { name: 'open' },
          mark: { type: 'rect', color: color(tokens, 'context'), opacity: 1 },
          encoding: { x, x2: { field: 'x2' }, y, y2: { field: 'y2' } },
        },
        {
          data: { name: 'guides' },
          mark: { type: 'rule', strokeDash: [2, 3], strokeWidth: tokens.stroke.guide },
          encoding: {
            x,
            y: { value: -10 },
            y2: { value: PLOT_HEIGHT },
            color: { field: 'median', type: 'nominal', scale: { domain: [false, true], range: [color(tokens, 'context/dark'), color(tokens, 'text')] }, legend: null },
          },
        },
        ...['left', 'center', 'right'].flatMap((align) => {
          const dx = align === 'left' ? 3 : align === 'right' ? -3 : 0;
          return [
            textLayer(`guideNames_${align}`, { align, dx, fontSize: tokens.size.detail, color: color(tokens, 'text/muted') }, -24),
            textLayer(`guideValues_${align}`, { align, dx, fontSize: tokens.size.value, color: color(tokens, 'text/muted') }, -12),
            textLayer(`guideMedian_${align}`, { align, dx, fontSize: tokens.size.value, fontWeight: 'bold', color: color(tokens, 'text') }, -12),
          ];
        }),
        {
          data: { name: 'openLabel' },
          mark: { type: 'text', align: 'center', baseline: 'bottom', dy: -14, fontSize: tokens.size.value, color: color(tokens, 'text/muted') },
          encoding: { x, y, text: { field: 'text' } },
        },
        {
          data: { name: 'openLabel' },
          mark: { type: 'text', align: 'center', baseline: 'bottom', dy: -4, fontSize: tokens.size.detail, color: color(tokens, 'text/muted') },
          encoding: { x, y, text: { field: 'share' } },
        },
        {
          data: { name: 'openAxis' },
          mark: { type: 'text', align: 'center', baseline: 'top', fontSize: tokens.size.axisLabel, lineHeight: 12, color: color(tokens, 'text/muted') },
          encoding: { x, y: { value: PLOT_HEIGHT + 6 }, text: { field: 'lines' } },
        },
      ],
    } as TopLevelSpec;

    const hover: HoverSpec[] = [
      ...bins.map((bin) => ({
        x: bin.from + binWidth / 2,
        from: bin.from,
        to: bin.from + binWidth,
        point: { y: bin.count, lo: null, hi: null },
        lines: [
          { text: t('chart.distribution.bin', { from: values.value(bin.from), to: values.value(bin.from + binWidth) }), bold: true },
          { text: t('chart.distribution.count', { count: amounts.value(bin.count), share: share(bin.count) }) },
        ],
      })),
      ...(openBin
        ? [{
            x: openFrom + binWidth / 2,
            from: openFrom,
            to: right,
            point: { y: openBin.count, lo: null, hi: null },
            lines: [
              { text: t('chart.distribution.openBin', { from: values.value(openBin.from) }), bold: true },
              { text: t('chart.distribution.count', { count: amounts.value(openBin.count), share: share(openBin.count) }) },
            ],
          }]
        : []),
    ];

    const title = request.title ?? request.metric;
    const readingCue = t('cue.distribution', { width: values.value(binWidth) });
    const description = [
      t('desc.base', { title, cue: readingCue, date: localizeDay(t, computed.reference, 'long') }),
      t('desc.distribution', { p25: values.value(percentiles.p25), p50: values.value(percentiles.p50), p75: values.value(percentiles.p75) }),
    ].join(' ');
    return {
      vegaLite: spec,
      width,
      height: PADDING.top + PLOT_HEIGHT + PADDING.bottom,
      plotArea: { x: PADDING.left, y: PADDING.top, width: plotWidth, height: PLOT_HEIGHT },
      hover,
      title,
      readingCue,
      description,
      asOf: computed.reference,
    };
  }
}

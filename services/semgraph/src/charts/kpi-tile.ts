import type { TopLevelSpec } from 'vega-lite';
import { localizeDay } from '../core/days.ts';
import type { Translator } from '../core/i18n.ts';
import type { IssueSpec } from '../core/issues.ts';
import type { HoverSpec } from '../core/render/hover.ts';
import { textWidth } from '../core/render/text.ts';
import type { DrawContext, Drawing, SemgraphMetadata } from '../core/semgraph.ts';
import { color, vegaLiteConfig } from '../core/tokens.ts';
import { COMPARISONS, comparisonLabel, defaultComparison, type BlockLength, type ComparisonKind } from './comparison.ts';
import { CompactFormat } from './number-format.ts';
import { PeriodComparisonChart, type PeriodComparisonRequest } from './period-comparison.ts';
import { numberFormat, valueScale, ZIGZAG, ZIGZAG_MASK, zoomLayers } from './scales.ts';
import { withSegments, type TimeAxisComputed } from './time-axis-chart.ts';

/** The blocks of periodComparison, and what they are compared with (REQ-067); the default follows Figma. */
export type KpiTileRequest = PeriodComparisonRequest & { comparison?: ComparisonKind };

/** A tile, as in Figma's Chart/KPI tile: 320 wide inside the margins of the template. */
const TILE_WIDTH = 360;
const MARGIN = 20;
/** The mini trend on the right; the number and its comparison in the column on its left. */
const TREND = { left: 200, width: 140, height: 50, top: 26, bottom: 24 };
const NUMBER = { baseline: 22, comparison: 42, line: 14 };
/** The marks of the mini trend, smaller than on a full chart (4.5 px in Figma). */
const MINI_MARK = 4.5;
const GAP = 8;
/** Semibold text, and the title face of the number, run wider than the estimate of regular text. */
const SEMIBOLD = 1.15;
const TITLE_FACE = 1.1;

/**
 * One number with a mandatory comparison (REQ-065, after Figma's Chart/KPI tile): the value of the
 * last block, the difference with what it is compared with (an arrow, absolute and in %), the spread
 * of a mean or median next to the number, and a mini trend of the blocks before it with a baseline and
 * its first and last period. With last year, the mini trend has last year as a grey shadow line.
 *
 * The blocks are those of periodComparison (REQ-058): rolling windows or calendar periods, each with
 * `previous`, the value it is compared with. Only the drawing is the tile's own (REQ-025).
 */
export class KpiTileChart extends PeriodComparisonChart<KpiTileRequest> {
  override schema(): object {
    const base = super.schema() as { description: string; properties: Record<string, any> };
    const { valueAxis: _, ...properties } = base.properties;
    const points = properties.points;
    return {
      ...base,
      description:
        'One number with a mandatory comparison, and a mini trend of the blocks before it: the last block is the number. Give either window (rolling windows) or unit (calendar periods). The warehouse computes each block and, in previous, the value it is compared with (REQ-058).',
      properties: {
        ...properties,
        comparison: {
          description: 'What the number is compared with: previousPeriod (the block just before) or lastYear (the same block a year earlier), as delivered in previous (REQ-067). Default: the period before for a window of up to 14 days, last year for longer windows and calendar periods. With lastYear, the mini trend shows last year as a grey shadow line.',
          enum: [...COMPARISONS],
        },
        points: {
          ...points,
          description: 'One row per block, oldest first or in any order, computed in the warehouse (REQ-058). The last block is the number; the blocks before it make the mini trend.',
          items: {
            ...points.items,
            properties: {
              ...points.items.properties,
              previous: {
                ...points.items.properties.previous,
                description: 'The value this block is compared with (see comparison), in the field of the statistic; null when it has no data. The last block needs it: a number without a comparison says nothing.',
              },
            },
          },
        },
      },
    };
  }

  override rules(request: KpiTileRequest, computed: TimeAxisComputed, context: { metadata: SemgraphMetadata }): IssueSpec[] {
    const issues = super.rules(request, computed, context);
    if (issues.some((issue) => issue.level === 'refusal')) return issues;
    // The number is the last block, and it is never shown without its comparison (Figma, KPI tile).
    if (!lastOf(computed)) issues.push({ level: 'refusal', code: 'kpiValueMissing', field: '/points' });
    else if (!previousOf(computed)) issues.push({ level: 'refusal', code: 'kpiComparisonMissing', field: '/points', params: { label: comparisonLabel(kindOf(request), lengthOf(request)) } });
    return issues;
  }

  override draw(request: KpiTileRequest, computed: TimeAxisComputed, { t, tokens }: DrawContext): Drawing {
    const chart = this.chartFor(request);
    const names = chart.names(request as never, computed, t);
    const statistic = chart.statistic;
    const kind = kindOf(request);
    const label = translate(t, comparisonLabel(kind, lengthOf(request)));
    const last = lastOf(computed)!;
    const previous = previousOf(computed)!;

    // The number, the spread of a mean or median next to it, and the difference under it.
    const numberFormatter = new CompactFormat(t.locale, Math.abs(last.centre));
    const number = numberFormatter.value(last.centre);
    const spread = last.spread ? (statistic.id === 'mean' ? numberFormatter.plusMinus(last.spread.hi - last.centre) : numberFormatter.range(last.spread.lo, last.spread.hi)) : '';
    const difference = differenceText(last.centre, previous.centre, t.locale);
    const versus = `${t('cue.comparison', { label })}${last.running ? ` · ${t('chart.runningShort')}` : ''}`;
    const column = TREND.left - MARGIN - GAP;
    const oneLine = `${difference} ${versus}`;
    const comparisonLines = textWidth(oneLine, tokens.size.kpiDetail) * SEMIBOLD <= column ? [oneLine] : [difference, versus];
    const numberLeft = MARGIN - TREND.left;
    const numberWidth = textWidth(number, tokens.size.kpi) * TITLE_FACE;

    // The mini trend: the focus line through every block, last year as a grey shadow line under it
    // (REQ-067). With the period before, that period is the previous point of the trend itself, so
    // there is no shadow line: what is on the screen is compared by eye (REQ-037).
    const shadow = kind === 'lastYear' ? (computed.comparison?.points ?? []) : [];
    const count = computed.slots.length;
    const values = [...computed.points, ...shadow].map((point) => point.centre);
    const scale = valueScale(Math.min(...values), Math.max(...values), 'zoom');
    const domain = count === 1 ? [-0.5, 0.5] : [-(count - 1), 0];
    const perPixel = { x: (domain[1]! - domain[0]!) / TREND.width, y: (scale.max - scale.min) / TREND.height };
    const x = { field: 'rel', type: 'quantitative' as const, scale: { domain, nice: false, zero: false } };
    const y = { field: 'value', type: 'quantitative' as const, scale: { domain: [scale.min, scale.max], nice: false, zero: false } };
    const ends = [computed.slots[0]!, computed.slots.at(-1)!].filter((slot, index, all) => index === 0 || slot.rel !== all[0]!.rel);
    const trendFormat = new CompactFormat(t.locale, scale.max);
    // A sparkline has no value axis, but its baseline still says that it does not start at zero (REQ-026).
    const left = domain[0]! - 4 * perPixel.x;
    const zigzag = scale.zoomed ? ZIGZAG.map(([along, across], order) => ({ rel: left + along * perPixel.x, value: scale.min + across * perPixel.y, order })) : [];
    const mask = scale.zoomed ? [{ rel: left, rel2: left + ZIGZAG_MASK * perPixel.x, value: scale.min }] : [];

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      width: TREND.width,
      height: TREND.height,
      autosize: { type: 'none' },
      padding: { left: TREND.left, right: TILE_WIDTH - TREND.left - TREND.width, top: TREND.top, bottom: TREND.bottom },
      background: 'transparent',
      config: vegaLiteConfig(tokens),
      datasets: {
        frame: [{ rel: domain[1], value: scale.min }],
        baseline: [{ rel: left, rel2: domain[1]! + 4 * perPixel.x, value: scale.min }],
        mask,
        zigzag,
        shadow: withSegments(shadow).map(({ rel, centre, segment }) => ({ rel, value: centre, segment })),
        line: withSegments(computed.points).map(({ rel, centre, segment }) => ({ rel, value: centre, segment })),
        points: computed.points.map(({ rel, centre }) => ({ rel, value: centre })),
        ends: ends.map((slot) => ({ rel: slot.rel, text: names.tick(slot, false)[0] ?? '' })),
        legend: shadow.length > 0 ? [{ text: t('chart.kpi.shadow', { label }) }] : [],
        number: [{ text: number }],
        spread: spread ? [{ text: spread }] : [],
        comparison: comparisonLines.map((text, index) => ({ text, py: NUMBER.comparison + index * NUMBER.line })),
      },
      layer: [
        {
          data: { name: 'frame' },
          mark: { type: 'point', opacity: 0 },
          encoding: { x: { ...x, axis: null }, y: { ...y, axis: null } },
        },
        {
          // Even the mini trend has a baseline (Figma, KPI tile).
          data: { name: 'baseline' },
          mark: { type: 'rule', color: color(tokens, 'baseline'), strokeWidth: tokens.stroke.baseline },
          encoding: { x, x2: { field: 'rel2' }, y },
        },
        ...zoomLayers(tokens, x, y, { x, x2: { field: 'rel2' }, y }),
        {
          data: { name: 'shadow' },
          mark: { type: 'line', color: color(tokens, 'context'), strokeWidth: tokens.stroke.line },
          encoding: { x, y, detail: { field: 'segment' } },
        },
        {
          data: { name: 'line' },
          mark: { type: 'line', color: color(tokens, 'focus'), strokeWidth: tokens.stroke.line },
          encoding: { x, y, detail: { field: 'segment' } },
        },
        {
          // The signature of the statistic, small (REQ-006, REQ-007, REQ-008).
          data: { name: 'points' },
          mark: { type: 'point', shape: statistic.shape, filled: true, size: MINI_MARK ** 2, opacity: 1, fill: color(tokens, 'focus'), stroke: color(tokens, 'surface'), strokeWidth: 0.5 },
          encoding: { x, y },
        },
        {
          // ... and labels for its first and last period.
          data: { name: 'ends' },
          mark: { type: 'text', align: 'center', baseline: 'top', fontSize: tokens.size.axisLabel, color: color(tokens, 'text/muted') },
          encoding: { x, y: { value: TREND.height + 4 }, text: { field: 'text' } },
        },
        {
          data: { name: 'legend' },
          mark: { type: 'text', align: 'right', baseline: 'alphabetic', fontSize: tokens.size.footer, color: color(tokens, 'text/muted') },
          encoding: { x: { value: TREND.width }, y: { value: -12 }, text: { field: 'text' } },
        },
        {
          data: { name: 'number' },
          mark: { type: 'text', align: 'left', baseline: 'alphabetic', font: tokens.font.title, fontSize: tokens.size.kpi, fontWeight: 600, color: color(tokens, 'text') },
          encoding: { x: { value: numberLeft }, y: { value: NUMBER.baseline }, text: { field: 'text' } },
        },
        {
          data: { name: 'spread' },
          mark: { type: 'text', align: 'left', baseline: 'alphabetic', fontSize: tokens.size.kpiDetail, color: color(tokens, 'text/muted') },
          encoding: { x: { value: numberLeft + numberWidth + GAP }, y: { value: NUMBER.baseline }, text: { field: 'text' } },
        },
        {
          data: { name: 'comparison' },
          mark: { type: 'text', align: 'left', baseline: 'alphabetic', fontSize: tokens.size.kpiDetail, fontWeight: 600, color: color(tokens, 'text') },
          encoding: { x: { value: numberLeft }, y: { field: 'py', type: 'quantitative', scale: null }, text: { field: 'text' } },
        },
      ],
    } as TopLevelSpec;

    // Hover on the mini trend: each block with its value, its spread, n and what it is compared with.
    const byRel = new Map(computed.points.map((point) => [point.rel, point]));
    const compared = new Map(computed.comparison?.points.map((point) => [point.rel, point]));
    const formatter = { format: (value: number) => trendFormat.value(value) };
    const hover: HoverSpec[] = computed.slots.map((slot) => {
      const name = { text: names.slot(slot), bold: true };
      const point = byRel.get(slot.rel);
      const other = compared.get(slot.rel);
      const comparison = other ? [{ text: t('hover.comparedWith', { label, value: trendFormat.value(other.centre) }) }] : [];
      if (!point) return { x: slot.rel, lines: [name, { text: t('chart.noData') }, ...comparison] };
      const spreadLine = statistic.spreadLine(t, formatter, point);
      return {
        x: slot.rel,
        point: { y: point.centre, lo: null, hi: null },
        lines: [
          name,
          { text: `${names.centre}: ${trendFormat.value(point.centre)}` },
          ...(spreadLine ? [{ text: spreadLine }] : []),
          ...(point.n === undefined ? [] : [{ text: t('hover.n', { n: numberFormat(t.locale, 0).format(point.n) }) }]),
          ...comparison,
        ],
      };
    });

    const title = request.title ?? request.metric;
    const cue = [names.cue, computed.withSpread ? t(`cue.spread.${statistic.id}`) : ''].filter(Boolean).join(' · ');
    const unique = request.uniqueAggregation === 'overPeriod' ? t('cue.uniqueOverPeriod', { block: names.block }) : t('cue.unique');
    const readingCue = request.measureType === 'unique' ? `${unique} · ${cue}` : cue;
    const description = [
      t('desc.base', { title, cue: readingCue, date: localizeDay(t, computed.reference, 'long') }),
      t('desc.kpi', { value: number, difference, label }),
    ].join(' ');

    return {
      vegaLite: spec,
      width: TILE_WIDTH,
      height: TREND.top + TREND.height + TREND.bottom,
      plotArea: { x: TREND.left, y: TREND.top, width: TREND.width, height: TREND.height },
      hover,
      title,
      readingCue,
      description,
      asOf: computed.reference,
    };
  }
}

/** The difference with what the number is compared with, as in Figma: "▲ 180 (+8%)", "▼ 1,2k (−5%)". */
export function differenceText(now: number, previous: number, locale: string): string {
  const difference = now - previous;
  if (difference === 0) return '= 0';
  const size = Math.abs(difference);
  const share = previous > 0 ? ` (${difference > 0 ? '+' : '−'}${numberFormat(locale, 0).format((size / previous) * 100)}%)` : '';
  return `${difference > 0 ? '▲' : '▼'} ${new CompactFormat(locale, size).value(size)}${share}`;
}

function lastOf(computed: TimeAxisComputed) {
  return computed.points.find((point) => point.rel === 0);
}

function previousOf(computed: TimeAxisComputed) {
  return computed.comparison?.points.find((point) => point.rel === 0);
}

function lengthOf(request: KpiTileRequest): BlockLength {
  return request.window !== undefined ? { window: request.window } : { unit: request.unit as 'week' | 'month' | 'quarter' | 'year' };
}

function kindOf(request: KpiTileRequest): ComparisonKind {
  return request.comparison ?? defaultComparison(lengthOf(request));
}

function translate(t: Translator, label: { t: string; params?: Record<string, number> }): string {
  return t(label.t, label.params);
}

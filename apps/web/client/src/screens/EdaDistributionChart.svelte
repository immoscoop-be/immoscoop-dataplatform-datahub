<script lang="ts">
  import type { DistributionResult } from '@datahub/contracts/eda';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { number, percent } from '../lib/eda.js';

  /**
   * How the values of a number spread (FR-ED-10, DEC-ED-24): the rows per bin, the middle half from P25 to P75 shaded,
   * the median and the mean drawn apart, and the tail, everything from about P95, in one bin of its own. An
   * illustration drawn for the EDA (DEC-UX-325).
   */
  let { result, field }: { result: DistributionResult; field: string } = $props();

  const language = $derived(currentLanguage());
  const LEFT = 40;
  const RIGHT = 440;
  const BASE = 150;
  /** The tallest bin stays under the labels of the median and the mean, so that nothing is written over a bar. */
  const HIGHEST = 96;
  const span = $derived(Math.max(result.tailFrom - result.start, result.width));
  const xOf = (value: number) => LEFT + ((Math.min(Math.max(value, result.start), result.tailFrom) - result.start) / span) * (RIGHT - LEFT);
  const most = $derived(Math.max(1, ...result.bins, result.tail));
  const heightOf = (rows: number) => (rows === 0 ? 0 : Math.max(0.7, (rows / most) * HIGHEST));
  const binWidth = $derived(Math.max(1, xOf(result.start + result.width) - xOf(result.start) - 2));
  /** About six numbers under the bins, on their edges. */
  const ticks = $derived.by(() => {
    const every = Math.max(1, Math.ceil(result.bins.length / 6));
    const out: number[] = [];
    for (let index = 0; index <= result.bins.length; index += every) out.push(result.start + index * result.width);
    return out.filter((value) => value <= result.tailFrom + 1e-9);
  });
  const median = $derived(xOf(result.median));
  const mean = $derived(xOf(result.mean));
  const apart = $derived(Math.abs(mean - median) > 14);
  const tailShare = $derived(percent(result.tail, result.rows, language));
</script>

<svg class="chart" viewBox="0 0 520 180" role="img" aria-label={t('eda.distribution.chart.label', { field })}>
  <rect class="middle" x={xOf(result.p25)} y="28" width={Math.max(1, xOf(result.p75) - xOf(result.p25))} height={BASE - 28} />
  <text class="note" x={(xOf(result.p25) + xOf(result.p75)) / 2} y="24" text-anchor="middle">{t('eda.distribution.chart.middle')}</text>
  {#each result.bins as rows, index (index)}
    {@const from = result.start + index * result.width}
    <rect class="bin" x={xOf(from) + 1} y={BASE - heightOf(rows)} width={binWidth} height={heightOf(rows)} rx="2">
      <title>{t('eda.distribution.chart.bin', { from: number(from, language), to: number(from + result.width, language), rows })}</title>
    </rect>
  {/each}
  <rect class="tail" x="458" y={BASE - heightOf(result.tail)} width="46" height={heightOf(result.tail)} rx="2">
    <title>{t('eda.distribution.chart.tailBin', { from: number(result.tailFrom, language), rows: result.tail })}</title>
  </rect>
  <text class="share" x="481" y={BASE - heightOf(result.tail) - 5} text-anchor="middle">{tailShare}</text>
  <text class="tick" x="481" y="162" text-anchor="middle">{number(result.tailFrom, language)}+</text>
  <text class="note" x="481" y="173" text-anchor="middle">{t('eda.distribution.chart.tail')}</text>
  <line class="axis" x1={LEFT} y1="150.5" x2={RIGHT} y2="150.5" />
  <line class="axis" x1="458" y1="150.5" x2="504" y2="150.5" />
  {#each ticks as tick (tick)}
    <text class="tick" x={xOf(tick)} y="162" text-anchor="middle">{number(tick, language)}</text>
  {/each}
  <line class="median" x1={median} y1="30" x2={median} y2="150" />
  <text class="median-text" x={median - 4} y="38" text-anchor="end">{t('eda.distribution.chart.median', { value: number(result.median, language) })}</text>
  <line class="mean" x1={mean} y1="30" x2={mean} y2="150" />
  <text class="mean-text" x={mean + 4} y="38">{t('eda.distribution.chart.mean', { value: number(result.mean, language) })}</text>
  {#if apart}
    {@const right = mean > median}
    <path class="pull" d={right ? `M${median + 3} 45 L${mean - 3} 45 M${mean - 7} 41.5 L${mean - 3} 45 L${mean - 7} 48.5` : `M${median - 3} 45 L${mean + 3} 45 M${mean + 7} 41.5 L${mean + 3} 45 L${mean + 7} 48.5`} />
    <text class="mean-note" x={right ? mean + 8 : mean - 8} y="51" text-anchor={right ? 'start' : 'end'}>{t(right ? 'eda.distribution.chart.up' : 'eda.distribution.chart.down')}</text>
  {/if}
  <text class="title" x={LEFT} y="12">{t('eda.distribution.chart.title', { field, width: number(result.width, language) })}</text>
</svg>

<style>
  /* Never larger than drawn, so that its words stay the size of the page (DEC-UX-332). */
  .chart { --sk-line: color-mix(in srgb, var(--text-muted) 45%, transparent); width: 100%; max-width: 520px; height: auto; display: block; margin-top: 6px; }
  .middle { fill: color-mix(in srgb, var(--col-slate) 9%, transparent); }
  .note { font-size: 7.5px; fill: var(--text-muted); }
  .bin { fill: var(--col-slate); }
  .tail { fill: color-mix(in srgb, var(--text-muted) 45%, transparent); }
  .share { font-size: 8px; font-weight: var(--weight-medium); fill: var(--text-secondary); }
  .tick { font-size: 8px; fill: var(--text-muted); }
  .axis { stroke: var(--sk-line); }
  .median { stroke: var(--text-primary); stroke-width: 1.8; }
  .median-text { font-size: 8.5px; font-weight: var(--weight-semibold); fill: var(--text-primary); }
  .mean { stroke: var(--col-teal-ink); stroke-width: 1.8; stroke-dasharray: 4 3; }
  .mean-text { font-size: 8.5px; font-weight: var(--weight-semibold); fill: var(--col-teal-ink); }
  .pull { fill: none; stroke: var(--col-teal-ink); stroke-width: 1.2; }
  .mean-note { font-size: 7.5px; fill: var(--col-teal-ink); }
  .title { font-size: 8.5px; font-weight: var(--weight-medium); fill: var(--text-secondary); }
</style>

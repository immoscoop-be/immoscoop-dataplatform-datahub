<script lang="ts">
  import type { GrainResult } from '@datahub/contracts/eda';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { number } from '../lib/eda.js';

  /**
   * The result of The grain holds drawn (FR-ED-07, DEC-UX-324): how many grain values are on one row, two, three, or
   * four and more, the wrong side shaded on the chart itself. An illustration drawn for the EDA (DEC-UX-325).
   */
  let { result, grain }: { result: GrainResult; /** The fields of the grain, as they are written under it. */ grain: string } = $props();

  const LABELS = ['1', '2', '3', '4+'];
  /** How many rows a bucket is, as its sentence chooses it. */
  const ROWS = ['one', 'two', 'three', 'more'];
  const BASE = 118;
  const HIGHEST = 66;
  const most = $derived(Math.max(1, ...result.buckets));
  const heightOf = (count: number) => (count === 0 ? 0 : Math.max(3, (count / most) * HIGHEST));
</script>

<svg class="chart" viewBox="0 0 480 150" role="img" aria-label={t('eda.grain.chart.label', { grain })}>
  <rect class="wrong" x="121" y="14" width="351" height="104" rx="4" />
  <text class="wrong-text" x="127" y="28">{t('eda.grain.chart.wrong')}</text>
  <text class="good-text" x="64" y="28" text-anchor="middle">{t('eda.grain.chart.good')}</text>
  <line class="axis" x1="14" y1="118.5" x2="472" y2="118.5" />
  {#each result.buckets as count, index (index)}
    {@const x = 18 + index * 114}
    {@const height = heightOf(count)}
    {#if count === 0}
      <rect class="none" x={x} y={BASE - 3} width="92" height="3" rx="1.5" />
    {:else}
      <rect class={index === 0 ? 'one' : 'more'} x={x} y={BASE - height} width="92" height={height} rx="3"><title>{t('eda.grain.chart.bar', { rows: ROWS[index] ?? 'more', count })}</title></rect>
    {/if}
    <text class="count" x={x + 46} y={BASE - Math.max(height, 3) - 5} text-anchor="middle">{number(count, currentLanguage())}</text>
    <text class="tick" x={x + 46} y="131" text-anchor="middle">{LABELS[index]}</text>
  {/each}
  <text class="caption" x="242" y="145" text-anchor="middle">{t('eda.grain.chart.rows', { grain })}</text>
</svg>

<style>
  .chart { --sk-line: color-mix(in srgb, var(--text-muted) 45%, transparent); width: 100%; height: auto; display: block; margin-top: 6px; }
  .wrong { fill: color-mix(in srgb, var(--signal-warn) 9%, transparent); }
  .wrong-text { font-size: 8px; font-weight: var(--weight-medium); fill: var(--signal-warn); }
  .good-text { font-size: 8px; font-weight: var(--weight-medium); fill: var(--col-teal-ink); }
  .axis { stroke: var(--sk-line); }
  .one { fill: var(--col-teal); }
  .more { fill: var(--signal-warn); }
  .none { fill: none; stroke: var(--sk-line); stroke-dasharray: 2 2; }
  .count { font-size: 9px; font-weight: var(--weight-medium); fill: var(--text-primary); }
  .tick { font-size: 9px; fill: var(--text-secondary); }
  .caption { font-size: 8px; fill: var(--text-muted); }
</style>

<script lang="ts">
  import type { VolumeResult } from '@datahub/contracts/eda';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { type BlockDays, niceTicks, number, periodDay, volumeBlocks } from '../lib/eda.js';

  /**
   * The volume of a date over its whole history, drawn per block of 7, 14, 21 or 28 days from a Monday as chosen on the
   * chart (FR-ED-09, DEC-ED-23): the sum of the field that adds up on top when there is one, the rows under it; a block
   * with a period without rows hatched, the current one, not complete yet, dotted; the numbers of a block on hover. An
   * illustration drawn for the EDA (DEC-UX-325).
   */
  let { result, days, field }: { result: VolumeResult; days: BlockDays; /** The date it counts by. */ field: string } = $props();

  const language = $derived(currentLanguage());
  const blocks = $derived(volumeBlocks(result, days));
  const measured = $derived(result.measure !== null && result.periods.some((period) => period.sum !== null));

  const LEFT = 40;
  const RIGHT = 508;
  const xOf = (index: number) => LEFT + (blocks.length > 1 ? (index * (RIGHT - LEFT)) / (blocks.length - 1) : (RIGHT - LEFT) / 2);
  const step = $derived(blocks.length > 1 ? (RIGHT - LEFT) / (blocks.length - 1) : RIGHT - LEFT);

  type Panel = { kind: 'sum' | 'rows'; top: number; bottom: number; ticks: number[]; label: string };
  const panels: Panel[] = $derived.by(() => {
    const rowsMax = Math.max(0, ...blocks.map((block) => block.rows));
    const rowsLabel = t('eda.volume.chart.rows', { days });
    if (!measured) {
      return [{ kind: 'rows', top: 22, bottom: 196, ticks: niceTicks(rowsMax, 4), label: rowsLabel }];
    }
    const sumMax = Math.max(0, ...blocks.map((block) => block.sum ?? 0));
    return [
      { kind: 'sum', top: 22, bottom: 132, ticks: niceTicks(sumMax, 3), label: t('eda.volume.chart.sum', { days, measure: result.measure ?? '' }) },
      { kind: 'rows', top: 164.8, bottom: 196, ticks: [0, rowsMax], label: rowsLabel },
    ];
  });
  const valueOf = (panel: Panel, block: (typeof blocks)[number]) => (panel.kind === 'sum' ? (block.sum ?? 0) : block.rows);
  const yOf = (panel: Panel, value: number) => {
    const max = panel.ticks.at(-1) ?? 0;
    return max > 0 ? panel.bottom - (value / max) * (panel.bottom - panel.top) : panel.bottom;
  };

  /** The lines of a panel, broken at every empty block and stopping before the current one. */
  function linesOf(panel: Panel): string[] {
    const lines: string[] = [];
    let points: string[] = [];
    blocks.forEach((block, index) => {
      if (block.empty || block.current) {
        if (points.length > 0) lines.push(points.join(' '));
        points = [];
        return;
      }
      points.push(`${xOf(index).toFixed(1)},${yOf(panel, valueOf(panel, block)).toFixed(1)}`);
    });
    if (points.length > 0) lines.push(points.join(' '));
    return lines;
  }

  /** Where each year starts, under the chart. */
  const years = $derived(blocks.flatMap((block, index) => (index === 0 || block.start.slice(0, 4) !== blocks[index - 1]?.start.slice(0, 4) ? [{ index, year: block.start.slice(0, 4) }] : [])));
  const empties = $derived(blocks.flatMap((block, index) => (block.empty ? [{ block, index }] : [])));
  const currentAt = $derived(blocks.findIndex((block) => block.current));
</script>

<svg class="chart" viewBox="0 0 520 214" role="img" aria-label={t('eda.volume.chart.label', { days, field })}>
  <defs>
    <pattern id="eda-volume-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line class="hatch-line" x1="0" y1="0" x2="0" y2="5" />
    </pattern>
  </defs>
  {#each empties as { block, index }, at (block.start)}
    <rect class="gap" x={xOf(index) - 6} y="10" width="12" height="186" rx="2" />
    <rect x={xOf(index) - 6} y="10" width="12" height="186" rx="2" fill="url(#eda-volume-hatch)" />
    {#if at < 3}<text class="gap-text" x={xOf(index) + 8} y={18 + at * 10}>{t('eda.volume.chart.gap', { day: periodDay(block.start, language) })}</text>{/if}
  {/each}
  {#each panels as panel (panel.kind)}
    <text class="panel-label" x={LEFT} y={panel.top - 10}>{panel.label}</text>
    {#each panel.ticks as tick (tick)}
      <line class="grid" x1={LEFT} y1={yOf(panel, tick)} x2={RIGHT} y2={yOf(panel, tick)} />
      <text class="tick" x="36" y={yOf(panel, tick) + 3} text-anchor="end">{number(tick, language)}</text>
    {/each}
    {#each linesOf(panel) as points (points)}
      <polyline class={panel.kind === 'sum' ? 'sum' : 'rows'} {points} />
    {/each}
    {#each empties as { index } (index)}
      <circle class="gap-dot" cx={xOf(index)} cy={panel.bottom} r="3" />
    {/each}
    {#if currentAt >= 0}
      {@const block = blocks[currentAt]}
      {#if block}
        {@const y = yOf(panel, valueOf(panel, block))}
        {@const before = blocks[currentAt - 1]}
        {#if before && !before.empty}<line class="current {panel.kind}" x1={xOf(currentAt - 1)} y1={yOf(panel, valueOf(panel, before))} x2={xOf(currentAt)} y2={y} />{/if}
        <circle class="current-dot {panel.kind}" cx={xOf(currentAt)} cy={y} r="2.6" />
        {#if panel.kind === panels[0]?.kind}<text class="tick" x={RIGHT + 2} y={y - 8} text-anchor="end">{t('eda.volume.chart.current')}</text>{/if}
      {/if}
    {/if}
  {/each}
  {#each years as { index, year } (year)}
    <line class="grid" x1={xOf(index)} y1="196" x2={xOf(index)} y2="200" />
    <text class="tick year" x={xOf(index) + 3} y="209">{year}</text>
  {/each}
  {#each blocks as block, index (block.start)}
    <rect class="hover" x={xOf(index) - step / 2} y="10" width={step} height="190">
      <title>{t(measured ? 'eda.volume.chart.block.sum' : 'eda.volume.chart.block', { day: periodDay(block.start, language), rows: block.rows, sum: number(block.sum ?? 0, language), measure: result.measure ?? '' })}</title>
    </rect>
  {/each}
</svg>

<style>
  .chart { --sk-line: color-mix(in srgb, var(--text-muted) 45%, transparent); width: 100%; height: auto; display: block; margin-top: 4px; }
  .hatch-line { stroke: var(--signal-warn); stroke-width: 1.2; opacity: .5; }
  .gap { fill: color-mix(in srgb, var(--signal-warn) 18%, transparent); }
  .gap-text { font-size: 8px; font-weight: var(--weight-semibold); fill: var(--signal-warn); }
  .gap-dot { fill: var(--signal-warn); }
  .panel-label { font-size: 8.5px; font-weight: var(--weight-medium); fill: var(--text-secondary); }
  .grid { stroke: var(--sk-line); stroke-width: .5; }
  .tick { font-size: 7.5px; fill: var(--text-muted); }
  .year { font-size: 8px; }
  polyline { fill: none; }
  .sum { stroke: var(--col-teal); stroke-width: 1.3; }
  .rows { stroke: var(--col-slate); stroke-width: 1.2; }
  .current { stroke-dasharray: 2 2; }
  .current.sum { stroke: var(--col-teal); stroke-width: 1.3; }
  .current.rows { stroke: var(--col-slate); stroke-width: 1.2; }
  .current-dot { fill: none; stroke-width: 1.2; }
  .current-dot.sum { stroke: var(--col-teal); }
  .current-dot.rows { stroke: var(--col-slate); }
  .hover { fill: transparent; }
  .hover:hover { fill: color-mix(in srgb, var(--text-muted) 10%, transparent); }
</style>

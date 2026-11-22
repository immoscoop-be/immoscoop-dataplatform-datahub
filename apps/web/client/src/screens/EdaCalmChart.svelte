<script lang="ts">
  import type { VolumeUnit } from '@datahub/contracts/eda';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { number, periodDay } from '../lib/eda.js';

  /**
   * How calm the volume is per unit (FR-ED-09, DEC-ED-23): a row per unit on one axis, each against its own average,
   * with its lowest to highest, P25 to P75, the median and one standard deviation around the average, also as a share
   * of the average; its numbers on hover. The narrower, the calmer. Its axis holds at most three steps each side, so
   * that its labels never run into each other, its average named under its 0. An illustration drawn for the EDA
   * (DEC-UX-325), never larger than drawn (DEC-UX-332).
   */
  let { units }: { units: readonly VolumeUnit[] } = $props();

  const language = $derived(currentLanguage());
  const rows = $derived([...units].filter((unit) => unit.average > 0).sort((a, b) => a.days - b.days));

  const CENTER = 290;
  const REACH = 170;
  const ROW = 34;
  const FIRST = 23;
  /** How far the units swing, as a share of their average: the axis reaches a little beyond the widest. */
  const widest = $derived(
    Math.max(0.25, ...rows.flatMap((unit) => [(unit.average - unit.lowest.value) / unit.average, (unit.highest.value - unit.average) / unit.average, unit.sd / unit.average])),
  );
  /** A round step that reaches the widest in three steps at most: 10%, 25%, 50%, 100%, 200%, 250%, 500%, … */
  const tickStep = $derived.by(() => {
    for (let power = 0.1; ; power *= 10) {
      const step = [1, 2.5, 5].map((factor) => factor * power).find((candidate) => widest / candidate <= 3 + 1e-9);
      if (step !== undefined) return Number(step.toPrecision(6));
    }
  });
  const reach = $derived(Math.ceil(widest / tickStep) * tickStep);
  const xOf = (unit: VolumeUnit, value: number) => CENTER + ((value - unit.average) / unit.average / reach) * REACH;
  const ticks = $derived.by(() => {
    const out: number[] = [];
    for (let at = -reach; at <= reach + 1e-9; at += tickStep) out.push(Number(at.toFixed(2)));
    return out;
  });
  const height = $derived(FIRST + rows.length * ROW + 32);
  const share = (value: number) => `${Math.round(value * 100)}%`;
</script>

<svg class="chart" viewBox="0 0 520 {height}" role="img" aria-label={t('eda.volume.calm.label')}>
  {#each ticks as tick (tick)}
    {@const x = CENTER + (tick / reach) * REACH}
    <line class={tick === 0 ? 'axis' : 'grid'} x1={x} y1="18" x2={x} y2={height - 30} />
    <text class="tick" x={x} y={height - 18} text-anchor="middle">{`${tick > 0 ? '+' : ''}${share(tick)}`}</text>
    {#if tick === 0}<text class="average" x={x} y={height - 7} text-anchor="middle">{t('eda.volume.calm.average')}</text>{/if}
  {/each}
  {#each rows as unit, index (unit.days)}
    {@const y = FIRST + index * ROW}
    {@const days = t('eda.volume.days', { count: unit.days })}
    <g class="row">
      <title>{t('eda.volume.calm.title', {
        days,
        average: number(unit.average, language),
        sd: number(unit.sd, language),
        cv: share(unit.sd / unit.average),
        median: number(unit.median, language),
        p25: number(unit.p25, language),
        p75: number(unit.p75, language),
        lowest: number(unit.lowest.value, language),
        lowestAt: periodDay(unit.lowest.start, language),
        highest: number(unit.highest.value, language),
        highestAt: periodDay(unit.highest.start, language),
      })}</title>
      <rect class="band" x={xOf(unit, unit.average - unit.sd)} y={y} width={xOf(unit, unit.average + unit.sd) - xOf(unit, unit.average - unit.sd)} height="22" rx="4" />
      <line class="whisker" x1={xOf(unit, unit.lowest.value)} y1={y + 11} x2={xOf(unit, unit.highest.value)} y2={y + 11} />
      <line class="whisker" x1={xOf(unit, unit.lowest.value)} y1={y + 6} x2={xOf(unit, unit.lowest.value)} y2={y + 16} />
      <line class="whisker" x1={xOf(unit, unit.highest.value)} y1={y + 6} x2={xOf(unit, unit.highest.value)} y2={y + 16} />
      <rect class="box" x={xOf(unit, unit.p25)} y={y + 5} width={Math.max(1, xOf(unit, unit.p75) - xOf(unit, unit.p25))} height="12" rx="2" />
      <line class="median" x1={xOf(unit, unit.median)} y1={y + 3} x2={xOf(unit, unit.median)} y2={y + 19} />
      <text class="value" x={xOf(unit, unit.lowest.value) - 5} y={y + 14} text-anchor="end">{number(unit.lowest.value, language)}</text>
      <text class="value" x={xOf(unit, unit.highest.value) + 5} y={y + 14}>{number(unit.highest.value, language)}</text>
      <text class="unit" x="4" y={y + 14}>{days}</text>
      <text class="cv" x="518" y={y + 14} text-anchor="end">± {share(unit.sd / unit.average)}</text>
    </g>
  {/each}
</svg>

<style>
  /* Never larger than drawn, so that its words stay the size of the page (DEC-UX-332). */
  .chart { --sk-line: color-mix(in srgb, var(--text-muted) 45%, transparent); width: 100%; max-width: 520px; height: auto; display: block; margin-top: 4px; }
  .grid { stroke: var(--sk-line); stroke-width: .5; stroke-dasharray: 2 3; }
  .axis { stroke: var(--sk-line); stroke-width: 1; }
  .tick { font-size: 8px; fill: var(--text-muted); }
  .average { font-size: 8px; font-weight: var(--weight-medium); fill: var(--text-secondary); }
  .band { fill: color-mix(in srgb, var(--col-teal) 18%, transparent); }
  .row:hover .band { fill: color-mix(in srgb, var(--col-teal) 30%, transparent); }
  .whisker { stroke: var(--col-slate); stroke-width: 1.4; }
  .box { fill: var(--surface-solid); stroke: var(--col-slate); stroke-width: 1.2; }
  .median { stroke: var(--text-primary); stroke-width: 2; }
  .value { font-size: 8px; fill: var(--text-secondary); }
  .unit { font-size: 8.5px; font-weight: var(--weight-medium); fill: var(--text-primary); }
  .cv { font-size: 8.5px; font-weight: var(--weight-semibold); fill: var(--col-teal-ink); }
</style>

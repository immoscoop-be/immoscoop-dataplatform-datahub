<script lang="ts">
  import type { DigResult } from '@datahub/contracts/eda';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { niceTicks, percent, periodDay } from '../lib/eda.js';
  import { periodShare, splitAt } from '../lib/dig.js';
  import { dayOfDate } from '../lib/edaWords.js';

  /**
   * The share of the selected rows per period, over time, on the date its role names (FR-ED-20, DEC-ED-36): a bar per
   * period as high as the share of its rows that is selected; where that share breaks, a dashed line, the side where the
   * selection is more in the colour of a state that calls for action, the other quiet, with the share of both above it;
   * the numbers of a period on hover. An illustration drawn for the EDA (DEC-UX-325), as in eda-dig.
   */
  let { time }: { time: NonNullable<DigResult['overTime']> } = $props();

  const language = $derived(currentLanguage());
  const LEFT = 46;
  const RIGHT = 1000;
  const TOP = 22;
  const BOTTOM = 132;
  const periods = $derived(time.periods);
  const slot = $derived(periods.length > 0 ? (RIGHT - LEFT) / periods.length : RIGHT - LEFT);
  const xOf = (index: number) => LEFT + index * slot;
  const ticks = $derived(niceTicks(Math.max(0, ...periods.map((period) => periodShare(period) * 100)), 2));
  const top = $derived(ticks.at(-1) ?? 0);
  const yOf = (share: number) => (top > 0 ? BOTTOM - ((share * 100) / top) * (BOTTOM - TOP) : BOTTOM);

  /** Where the share breaks, the index of its first period after, and the share before and after it. */
  const broken = $derived.by(() => {
    if (!time.breakAt || !time.before) return null;
    const day = time.breakAt.slice(0, 10);
    const at = periods.findIndex((period) => period.start.slice(0, 10) >= day);
    if (at <= 0) return null;
    const { before, after } = splitAt(periods, time.breakAt);
    return { at, x: xOf(at), before: percent(before.selected, before.total, language), after: percent(after.selected, after.total, language), day: dayOfDate(time.breakAt, language) };
  });
  /** Whether a period lies on the side of the break where the selection is more: before it, or from it on. */
  const isMore = (index: number) => !broken || (time.before === 'more' ? index < broken.at : index >= broken.at);

  /** A month under the chart, its year with January. */
  const periodMonth = (start: string) =>
    new Intl.DateTimeFormat(language === 'nl' ? 'nl-BE' : 'en-GB', { month: 'short', year: start.slice(5, 7) === '01' ? 'numeric' : undefined, timeZone: 'UTC' }).format(new Date(`${start.slice(0, 10)}T00:00:00Z`));
  /** Where each year starts under the chart, or each month when the periods span little more than a year. */
  const marks = $derived.by(() => {
    const years = periods.flatMap((period, index) => (index === 0 || period.start.slice(0, 4) !== periods[index - 1]?.start.slice(0, 4) ? [{ index, label: period.start.slice(0, 4) }] : []));
    if (years.length >= 3) return years;
    const months = periods.flatMap((period, index) => (index === 0 || period.start.slice(0, 7) !== periods[index - 1]?.start.slice(0, 7) ? [{ index, label: periodMonth(period.start) }] : []));
    const step = Math.ceil(months.length / 8);
    return months.filter((_, at) => at % step === 0);
  });
</script>

<svg class="chart" viewBox="0 0 1020 150" role="img" aria-label={t('eda.dig.time.label', { unit: time.unit, field: time.field })}>
  {#each ticks as tick (tick)}
    <line class="grid" x1={LEFT} x2={RIGHT} y1={yOf(tick / 100)} y2={yOf(tick / 100)} />
    <text class="tick" x="40" y={yOf(tick / 100) + 3} text-anchor="end">{percent(tick, 100, language)}</text>
  {/each}
  {#each periods as period, index (period.start)}
    {@const share = periodShare(period)}
    <rect class="bar" class:more={isMore(index)} x={xOf(index) + slot * 0.05} y={yOf(share)} width={Math.max(slot * 0.9, 0.6)} height={Math.max(BOTTOM - yOf(share), 0)} />
  {/each}
  {#if broken}
    <line class="break" x1={broken.x} x2={broken.x} y1="14" y2={BOTTOM} />
    <text class="label" class:warn={time.before === 'more'} x={broken.x - 4} y="12" text-anchor="end">{t('eda.dig.time.before', { day: broken.day, share: broken.before })}</text>
    <text class="label" class:warn={time.before === 'less'} x={broken.x + 4} y="12">{t('eda.dig.time.since', { share: broken.after })}</text>
  {/if}
  {#each marks as mark (mark.index)}
    <text class="tick" x={xOf(mark.index)} y="144">{mark.label}</text>
  {/each}
  {#each periods as period, index (period.start)}
    <rect class="hover" x={xOf(index)} y={TOP - 8} width={slot} height={BOTTOM - TOP + 8}>
      <title>{t('eda.dig.time.period', { day: periodDay(period.start, language), selected: period.selected, total: period.total, share: percent(period.selected, period.total, language) })}</title>
    </rect>
  {/each}
</svg>

<style>
  /* Never larger than drawn, so that its words stay the size of the page (DEC-UX-332). */
  .chart { width: 100%; max-width: 1020px; height: auto; display: block; }
  .grid { stroke: var(--tint-active); stroke-width: .6; }
  .tick { font-size: 8px; fill: var(--text-muted); }
  .bar { fill: var(--col-slate); opacity: .7; }
  .bar.more { fill: var(--signal-warn); opacity: .85; }
  .break { stroke: var(--text-primary); stroke-width: 1.2; stroke-dasharray: 3 2; }
  .label { font-size: 9px; font-weight: var(--weight-medium); fill: var(--text-secondary); }
  .label.warn { fill: var(--signal-warn); }
  .hover { fill: transparent; }
  .hover:hover { fill: color-mix(in srgb, var(--text-muted) 10%, transparent); }
</style>

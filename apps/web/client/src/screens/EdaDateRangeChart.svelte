<script lang="ts">
  import type { DateRangeResult } from '@datahub/contracts/eda';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { dayOfDate, dayOfMonth, isUpToDate, periodName, periodOn, periodsOf, sinceWord } from '../lib/edaWords.js';

  /**
   * A date from its first value to today (FR-ED-18, DEC-ED-34): a line in its periods, the part before the Reliable Since
   * of its Resource Card paler with the day dashed, today marked at the end; when its last value is behind, the part
   * from there to today hatched and named. Years under it. An illustration drawn for the EDA (DEC-UX-325).
   */
  let {
    result,
    field,
    ranAt,
  }: {
    result: DateRangeResult;
    /** The date it is set on. */
    field: string;
    /** When it ran: today is the day of the run. */
    ranAt: string;
  } = $props();

  const language = $derived(currentLanguage());
  const DAY = 86_400_000;
  const LEFT = 40;
  const RIGHT = 600;
  /** About the width of a character of the labels, to keep them apart. */
  const CHAR = 5.1;
  const widthOf = (text: string) => text.length * CHAR;
  const at = (date: string) => Date.parse(`${date.slice(0, 10)}T00:00:00Z`);

  /** A day in the time zone of Immoscoop, where eda counts its periods, as YYYY-MM-DD. */
  function dayIn(moment: Date): string {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(moment);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((one) => one.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  const unitDays = $derived(result.unit === 'week' ? 7 : 1);
  /** Today: the day of the run, in its current period; the current period itself if that cannot be read. */
  const today = $derived.by(() => {
    const day = dayIn(new Date(ranAt));
    const current = at(result.current);
    const time = at(day);
    return Number.isFinite(time) && time >= current && time < current + unitDays * DAY ? day : result.current.slice(0, 10);
  });
  const isToday = $derived(today === dayIn(new Date()));

  const start = $derived(at(result.first ?? result.current));
  const end = $derived(Math.max(at(today) + DAY, start + DAY));
  const xOf = (time: number) => LEFT + ((Math.min(Math.max(time, start), end) - start) / (end - start)) * (RIGHT - LEFT);
  /** Where the line stops: the end of the period of its last value, at today at most. */
  const lastEnd = $derived(xOf(Math.min(at(result.last ?? result.current) + unitDays * DAY, end)));
  const late = $derived(!isUpToDate(result));
  const reliable = $derived(result.reliableSince !== null && at(result.reliableSince) > start ? xOf(at(result.reliableSince)) : null);

  const todayText = $derived(t(isToday ? 'eda.dateRange.chart.today' : 'eda.dateRange.chart.ran', { day: dayOfDate(today, language) }));
  /** The first value by the name of its period, a week with its Monday; the last as its week and Monday, or its day. */
  const firstText = $derived.by(() => {
    const first = result.first ?? result.current;
    return result.unit === 'week' ? t('eda.dateRange.chart.first', { name: periodName('week', first, language), day: dayOfMonth(first, language) }) : dayOfDate(first, language);
  });
  const lastText = $derived.by(() => {
    const last = periodOn(result.unit, result.last ?? result.current, language);
    return late ? t('eda.dateRange.chart.last', { day: last }) : t('eda.dateRange.chart.lastSince', { day: last, since: sinceWord(result) });
  });
  const behindText = $derived(t('eda.dateRange.chart.behind', { periods: periodsOf(result.unit, result.behind) }));

  /**
   * Reliable Since above the line, about its day and clear of today on the right; where there is no room, under the
   * line beside its day.
   */
  const reliableLabel = $derived.by(() => {
    if (reliable === null || result.reliableSince === null) return null;
    const text = t('eda.dateRange.chart.reliable', { day: dayOfDate(result.reliableSince, language) });
    const half = widthOf(text) / 2;
    const limit = RIGHT - widthOf(todayText) - 10;
    const x = Math.min(Math.max(reliable, LEFT + half), limit - half);
    if (x - half >= LEFT && Math.abs(x - reliable) <= half) return { text, x, y: 28, anchor: 'middle' as const };
    return reliable + 4 + widthOf(text) <= RIGHT ? { text, x: reliable + 4, y: 81, anchor: 'start' as const } : { text, x: reliable - 4, y: 81, anchor: 'end' as const };
  });
  /** Under the line, the last value at the right end while it is up to date; when behind, how far, and the last beside where it stops. */
  const lastLabel = $derived(late ? { x: Math.max(lastEnd - 2, LEFT + widthOf(lastText)), y: 81 } : { x: RIGHT, y: widthOf(firstText) + widthOf(lastText) + 12 > RIGHT - LEFT ? 81 : 68 });

  /** The years the line crosses, eight at most. */
  const years = $derived.by(() => {
    const crossed: { x: number; year: number }[] = [];
    const from = new Date(start).getUTCFullYear() + 1;
    const to = new Date(end).getUTCFullYear();
    for (let year = from; year <= to; year += 1) crossed.push({ x: xOf(Date.UTC(year, 0, 1)), year });
    const every = Math.max(1, Math.ceil(crossed.length / 8));
    return crossed.filter((_, index) => index % every === 0);
  });
  const hatch = $derived(`eda-range-hatch-${field.replace(/[^\w-]/g, '_')}`);
</script>

<svg class="chart" viewBox="0 0 640 104" role="img" aria-label={t('eda.dateRange.chart.label', { field })}>
  <defs>
    <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="hatch" width="3" height="6" /></pattern>
  </defs>
  <rect class="line" x={LEFT} y="39" width={Math.max(lastEnd - LEFT, 2)} height="14" rx="3" />
  {#if late}
    <rect x={lastEnd} y="39" width={Math.max(RIGHT - lastEnd, 2)} height="14" rx="3" fill="url(#{hatch})" />
    <text class="behind" x={RIGHT} y="68" text-anchor="end">{behindText}</text>
  {/if}
  {#if reliable !== null}
    <rect class="before" x={LEFT} y="39" width={Math.max(Math.min(reliable, lastEnd) - LEFT, 0)} height="14" rx="3" />
    <path class="reliable" d="M{reliable} 32 v28" />
  {/if}
  {#if reliableLabel}<text class="label" x={reliableLabel.x} y={reliableLabel.y} text-anchor={reliableLabel.anchor}>{reliableLabel.text}</text>{/if}
  <path class="today" d="M{RIGHT} 32 v28" />
  <text class="today-text" x={RIGHT} y="28" text-anchor="end">{todayText}</text>
  <text class="label" x={LEFT} y="68">{firstText}</text>
  <text class="label" x={lastLabel.x} y={lastLabel.y} text-anchor="end">{lastText}</text>
  {#each years as { x, year } (year)}
    <text class="year" {x} y="94" text-anchor="middle">{year}</text>
  {/each}
</svg>

<style>
  .chart { width: 100%; height: auto; display: block; margin: 8px 0 4px; }
  .line { fill: var(--col-teal); opacity: .85; }
  .hatch { fill: var(--signal-warn); opacity: .6; }
  .before { fill: var(--surface-solid); opacity: .55; }
  .reliable { stroke: var(--text-secondary); stroke-width: 1.2; stroke-dasharray: 3 2; }
  .today { stroke: var(--text-primary); stroke-width: 1.6; }
  .today-text { font-size: 9px; font-weight: var(--weight-medium); fill: var(--text-primary); }
  .label { font-size: 9px; fill: var(--text-secondary); }
  .behind { font-size: 9px; font-weight: var(--weight-medium); fill: var(--signal-warn); }
  .year { font-size: 8px; fill: var(--text-muted); }
</style>

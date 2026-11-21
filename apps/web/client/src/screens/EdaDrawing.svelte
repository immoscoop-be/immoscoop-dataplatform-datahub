<script lang="ts">
  import type { DistributionResult, EdaField, GrainResult, NullsResult, ProbeKey, ResultView, VolumeResult } from '@datahub/contracts/eda';
  import { ICONS, type IconName } from '@datahub/ui/foundations/icons.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { MARK_ICONS, markOf, number } from '../lib/eda.js';

  /**
   * The drawing of an EDA-Probe (DEC-UX-268): one schematic table with fine lines, the kind of each field as an icon in
   * its header, and in its cells what the EDA-Probe looks at and what a finding looks like, the same on every Resource.
   * The idea, on its detail, comes in once, again on Replay, and stands still for whoever asks for reduced motion
   * (DEC-UX-324, TR-ED-07); on a card it shows the result of the last run on it (DEC-UX-322). Drawn for the EDA, not
   * by semgraph (DEC-UX-325).
   */
  let {
    probe,
    fields,
    setOn,
    results = null,
    play = 0,
    label,
  }: {
    probe: ProbeKey;
    /** The fields of the Resource, in the order of its Resource Card. */
    fields: readonly EdaField[];
    /** The fields the EDA-Probe is set on, or applies to. */
    setOn: readonly string[];
    /** The results of its last run, drawn on a card; null draws the idea. */
    results?: readonly ResultView[] | null;
    /** Grows on Replay: the drawing comes in again. 0 stands still. */
    play?: number;
    label: string;
  } = $props();

  const language = $derived(currentLanguage());

  // The geometry of the schematic table: four columns, six rows.
  const LEFT = 14;
  const WIDTH = 224;
  const COLUMN = WIDTH / 4;
  const ROWS = [0, 1, 2, 3, 4, 5];
  const center = (column: number) => LEFT + COLUMN * column + COLUMN / 2;
  const top = (row: number) => 58 + 18 * row;

  /**
   * The columns drawn: up to four fields, those it is set on first, then the Key Fields, then the others, shown in the
   * order of the Resource Card (DEC-UX-323).
   */
  const columns = $derived.by(() => {
    const rank = (field: EdaField) => (setOn.includes(field.name) ? 0 : field.keyField ? 1 : 2);
    const chosen = [...fields].sort((a, b) => rank(a) - rank(b)).slice(0, 4);
    return fields
      .filter((field) => chosen.includes(field))
      .map((field) => ({ name: field.name, icon: MARK_ICONS[markOf(field)] as IconName, on: setOn.includes(field.name), date: markOf(field) === 'date', number: markOf(field) === 'number' }));
  });
  /** The columns it looks at; the first column when it is set on none of them. */
  const looked = $derived(columns.flatMap((column, index) => (column.on ? [index] : [])));
  const firstOn = $derived(looked[0] ?? 0);

  const inner = (name: IconName) => ICONS[name].replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const short = (name: string) => (name.length > 13 ? `${name.slice(0, 12)}…` : name);

  const result = <T,>(subject?: string): T | undefined => (results?.find((one) => subject === undefined || one.subject === subject)?.data as T | undefined);

  /** The colours of the grain values per row: all apart when the grain holds, rows 2 and 4 the same when it does not. */
  const GRAIN_HOLDS = ['magenta', 'teal', 'slate', 'olive', 'ochre', 'bordeaux'];
  const GRAIN_TWICE = ['magenta', 'teal', 'slate', 'teal', 'olive', 'bordeaux'];

  type Pill = { text: string; tone: 'warn' | 'fine' | 'judge' };

  const grain = $derived(results ? result<GrainResult>('') ?? result<GrainResult>() : undefined);
  const twice = $derived(results ? (grain?.onMoreThanOne ?? 0) > 0 || (grain?.emptyGrain ?? 0) > 0 : true);
  const nullsBy = $derived(
    new Map(
      (results ?? []).map((one) => [one.subject, (one.data as NullsResult).empty ?? 0] as const),
    ),
  );
  /** The cells left empty per column: in the idea a few, on a card where the result found any. */
  const emptyCells = $derived.by(() => {
    const cells = new Set<string>();
    if (probe !== 'nullsPerKeyField') return cells;
    if (!results) {
      // The idea: one cell empty in a field, two in another.
      const some = looked[1] ?? looked[0] ?? 1;
      const more = looked.at(-1) ?? 3;
      for (const cell of [`3:${some}`, `1:${more}`, `4:${more}`]) cells.add(cell);
      return cells;
    }
    columns.forEach((column, index) => {
      if ((nullsBy.get(column.name) ?? 0) > 0) {
        cells.add(`${(index * 2 + 1) % 6}:${index}`);
        cells.add(`${(index * 2 + 4) % 6}:${index}`);
      }
    });
    return cells;
  });
  const volume = $derived(results ? results.map((one) => one.data as VolumeResult) : undefined);
  const emptyPeriods = $derived(volume ? volume.reduce((sum, one) => sum + (one.empty?.length ?? 0), 0) : 1);
  const dateColumn = $derived(columns.findIndex((column) => column.on && column.date));
  const distribution = $derived(results ? result<DistributionResult>() : undefined);
  const numberColumn = $derived(looked.find((index) => columns[index]?.number) ?? firstOn);

  const pill: Pill | null = $derived.by(() => {
    switch (probe) {
      case 'grainHolds':
        if (!results) return { text: t('eda.draw.grain.idea'), tone: 'warn' };
        return twice ? { text: t('eda.draw.grain.twice', { count: grain?.onMoreThanOne ?? 0 }), tone: 'warn' } : { text: t('eda.draw.grain.holds'), tone: 'fine' };
      case 'nullsPerKeyField': {
        if (!results) return { text: t('eda.draw.nulls.idea'), tone: 'warn' };
        const count = [...nullsBy.values()].filter((empty) => empty > 0).length;
        return count > 0 ? { text: t('eda.draw.nulls.some', { count }), tone: 'warn' } : { text: t('eda.draw.nulls.none'), tone: 'fine' };
      }
      case 'volumeOverTime':
        if (!results) return { text: t('eda.draw.volume.idea'), tone: 'warn' };
        return emptyPeriods > 0 ? { text: t('eda.draw.volume.some', { count: emptyPeriods }), tone: 'warn' } : { text: t('eda.draw.volume.none'), tone: 'fine' };
      case 'distributionOfNumbers':
        if (!results) return { text: t('eda.draw.distribution.idea'), tone: 'judge' };
        return distribution ? { text: t('eda.draw.distribution.result', { median: number(distribution.median, language), mean: number(distribution.mean, language) }), tone: 'judge' } : null;
      default:
        return null;
    }
  });
  const pillWidth = $derived(pill ? Math.min(240, pill.text.length * 4.3 + 18) : 0);

  /** The bars of a number per row: most short, one long. */
  const BARS = [10, 14, 8, 44, 12, 18];
  /** The order in which the parts come in: the rows one by one, then the finding, then what it says. */
  const animated = $derived(play > 0);
</script>

{#key play}
  <svg class="drawing" class:animated viewBox="0 0 252 190" role="img" aria-label={label}>
    <defs>
      <pattern id="eda-hatch-{probe}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line class="hatch-line" x1="0" y1="0" x2="0" y2="5" />
      </pattern>
    </defs>
    <g>
      <rect class="paper" x={LEFT} y="28" width={WIDTH} height="132" />
      {#each [1, 2, 3] as column (column)}<line class="line" x1={LEFT + COLUMN * column} y1="28" x2={LEFT + COLUMN * column} y2="160" />{/each}
      <line class="head-line" x1={LEFT} y1="52" x2={LEFT + WIDTH} y2="52" />
      {#each [70, 88, 106, 124, 142] as y (y)}<line class="line thin" x1={LEFT} y1={y} x2={LEFT + WIDTH} y2={y} />{/each}
      {#each columns as column, index (column.name)}
        <svg class="kind" class:on={column.on} x={center(index) - 6.5} y="33.5" width="13" height="13" viewBox="0 0 256 256">{@html inner(column.icon)}</svg>
        <text class="name" class:on={column.on} x={center(index)} y="24" text-anchor="middle">{short(column.name)}</text>
      {/each}
    </g>
    {#each ROWS as row (row)}
      {#if probe === 'volumeOverTime' && row === 3 && emptyPeriods > 0}
        <g class="a" style:--o={8}>
          <rect x={LEFT + 1} y="107" width={WIDTH - 2} height="16" fill="url(#eda-hatch-{probe})" />
          <text class="gap" x="126" y="118" text-anchor="middle">{t('eda.draw.volume.gap', { period: 'w14' })}</text>
        </g>
      {:else}
        <g class="a" style:--o={row + 1}>
          {#each columns as column, index (column.name)}
            {#if probe === 'grainHolds' && column.on}
              <rect class="c-{(twice ? GRAIN_TWICE : GRAIN_HOLDS)[row]}" x={center(index) - 22} y={top(row)} width="44" height="6" rx="3" />
            {:else if probe === 'nullsPerKeyField' && emptyCells.has(`${row}:${index}`)}
              <!-- An empty cell: nothing in it. -->
            {:else if probe === 'nullsPerKeyField' && column.on}
              <rect class={index % 2 === 0 ? 'c-teal' : 'c-magenta'} x={center(index) - 13} y={top(row)} width="26" height="6" rx="3" />
            {:else if probe === 'volumeOverTime' && index === (dateColumn >= 0 ? dateColumn : 0)}
              <text class="period" x={center(index)} y={top(row) + 5.8} text-anchor="middle">w{11 + row}</text>
            {:else if probe === 'volumeOverTime' && column.on}
              <rect class="c-teal" x={center(index) - 13} y={top(row)} width="26" height="6" rx="3" />
            {:else if probe === 'distributionOfNumbers' && index === numberColumn}
              <rect class={row === 3 ? 'c-bordeaux' : 'c-slate'} x={center(index) - 23} y={top(row)} width={BARS[row]} height="6" rx="2" />
            {:else}
              <rect class="ink" x={center(index) - 13} y={top(row)} width="26" height="6" rx="3" />
            {/if}
          {/each}
        </g>
      {/if}
    {/each}
    {#if probe === 'grainHolds' && twice}
      {@const on = looked.length > 0 ? looked : [0]}
      <g class="a" style:--o={8}>
        {#each [1, 3] as row (row)}
          {#each on as index (index)}<rect class="finding" x={center(index) - 25} y={top(row) - 4} width="50" height="14" rx="4" />{/each}
        {/each}
        <path class="finding" d="M{LEFT + 4} {top(1) + 3} h-5 v36 h5" />
      </g>
    {:else if probe === 'nullsPerKeyField'}
      <g class="a" style:--o={8}>
        {#each [...emptyCells] as cell (cell)}
          {@const [row, index] = cell.split(':').map(Number) as [number, number]}
          <rect class="empty" x={center(index) - 20} y={top(row) - 2} width="40" height="10" rx="3" />
        {/each}
      </g>
    {:else if probe === 'distributionOfNumbers'}
      <g class="a" style:--o={8}>
        <line class="median" x1={center(numberColumn) - 10} y1="52" x2={center(numberColumn) - 10} y2="160" />
        <line class="mean" x1={center(numberColumn) - 6} y1="52" x2={center(numberColumn) - 6} y2="160" />
      </g>
    {/if}
    {#if pill}
      <g class="a" style:--o={10}>
        <rect class="pill {pill.tone}" x={126 - pillWidth / 2} y="166" width={pillWidth} height="15" rx="7.5" />
        <text class="pill-text {pill.tone}" x="126" y="176.5" text-anchor="middle">{pill.text}</text>
      </g>
    {/if}
  </svg>
{/key}

<style>
  .drawing {
    --sk-line: color-mix(in srgb, var(--text-muted) 45%, transparent);
    --sk-head: color-mix(in srgb, var(--text-secondary) 70%, transparent);
    --sk-ink: color-mix(in srgb, var(--text-muted) 38%, transparent);
    width: 100%; height: auto; display: block;
  }
  .paper { fill: var(--surface-solid); stroke: var(--sk-line); }
  .line { stroke: var(--sk-line); }
  .line.thin { stroke-width: .6; }
  .head-line { stroke: var(--sk-head); stroke-width: 1.2; }
  .kind { fill: var(--text-muted); }
  .kind.on { fill: var(--text-primary); }
  .name { font-family: var(--font-mono); font-size: 7px; fill: var(--text-muted); }
  .name.on { fill: var(--text-primary); font-weight: var(--weight-medium); }
  .ink { fill: var(--sk-ink); }
  .c-magenta { fill: var(--col-magenta); }
  .c-teal { fill: var(--col-teal); }
  .c-slate { fill: var(--col-slate); }
  .c-olive { fill: var(--col-olive); }
  .c-ochre { fill: var(--col-ochre); }
  .c-bordeaux { fill: var(--col-bordeaux); }
  .period { font-family: var(--font-mono); font-size: 8px; fill: var(--text-primary); }
  .hatch-line { stroke: var(--signal-warn); stroke-width: 1.2; opacity: .5; }
  .gap { font-size: 8px; font-weight: var(--weight-medium); fill: var(--signal-warn); }
  .finding { fill: none; stroke: var(--signal-warn); stroke-width: 1.3; }
  .empty { fill: none; stroke: var(--signal-warn); stroke-width: 1.2; stroke-dasharray: 2 2; }
  .median { stroke: var(--text-primary); stroke-width: 1.4; }
  .mean { stroke: var(--col-teal-ink); stroke-width: 1.4; stroke-dasharray: 3 2; }
  .pill.warn { fill: color-mix(in srgb, var(--signal-warn) 14%, var(--surface-solid)); }
  .pill.fine { fill: color-mix(in srgb, var(--col-teal-ink) 14%, var(--surface-solid)); }
  .pill.judge { fill: color-mix(in srgb, var(--col-slate) 14%, var(--surface-solid)); }
  .pill-text { font-size: 8px; font-weight: var(--weight-semibold); }
  .pill-text.warn { fill: var(--signal-warn); }
  .pill-text.fine { fill: var(--col-teal-ink); }
  .pill-text.judge { fill: var(--col-slate); }
  /* It comes in once, row after row, then the finding, then what it says; still with Reduce motion (global.css). */
  .animated .a { animation: drawn var(--motion-fade) ease-out both; animation-delay: calc(var(--o) * var(--motion-fade)); }
  @keyframes drawn { from { opacity: 0; } to { opacity: 1; } }
</style>

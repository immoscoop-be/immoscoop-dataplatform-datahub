<script module lang="ts">
  export interface GridColumn {
    name: string;
    /** Its type in BigQuery, shown under its name. */
    type: string;
  }
</script>

<script lang="ts">
  import Icon from '../foundations/Icon.svelte';
  import type { IconName } from '../foundations/icons.js';
  import { t } from '../foundations/texts.svelte.js';

  /**
   * A result as a grid like that of BigQuery (Data grid, DEC-UX-72): the row number, then a column per field
   * with its type under its name. A column starts as wide as its values; the edge of its head makes it
   * narrower or wider, and a double click fits it again. A value that does not fit ends in "…" and shows
   * whole on hover. Numbers to the right, `null` in grey. A click selects a cell, Ctrl+C copies it, the
   * arrows move. The menu of a column sorts this page only, fits it, or copies its name.
   */
  let {
    columns,
    rows,
    first = 1,
    label,
  }: {
    columns: readonly GridColumn[];
    /** Each value as text, or null. */
    rows: readonly (readonly (string | null)[])[];
    /** The number of the first row of this page. */
    first?: number;
    label: string;
  } = $props();

  const NUMERIC = new Set(['INT64', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC']);
  /** Roughly the width of a character of the grid, to start a column as wide as its values. */
  const CHAR = 7;

  function fitted(index: number): number {
    const column = columns[index] as GridColumn;
    const longest = Math.max(column.name.length + 3, column.type.length * 0.9, ...rows.map((row) => Math.min((row[index] ?? 'null').length, 60)));
    return Math.round(Math.min(Math.max(longest * CHAR + 24, 64), 440));
  }

  let widths = $derived(columns.map((_, index) => fitted(index)));
  let sort: { column: number; direction: 'ascending' | 'descending' } | null = $state(null);
  let selected: { row: number; column: number } | null = $state(null);
  let menu: { column: number; x: number; y: number } | null = $state(null);
  let table: HTMLTableElement | undefined = $state();
  let wrap: HTMLDivElement | undefined = $state();

  // Another page or result: its own order and selection.
  $effect(() => {
    void rows;
    sort = null;
    selected = null;
  });

  const compare = (a: string | null, b: string | null, numeric: boolean): number => {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return numeric ? Number(a) - Number(b) : a.localeCompare(b);
  };
  const shown = $derived.by(() => {
    const numbered = rows.map((values, index) => ({ number: first + index, values }));
    if (!sort) return numbered;
    const { column, direction } = sort;
    const numeric = NUMERIC.has(columns[column]?.type ?? '');
    const sign = direction === 'ascending' ? 1 : -1;
    // Null stays last, both ways.
    return [...numbered].sort((a, b) => {
      const x = a.values[column] ?? null;
      const y = b.values[column] ?? null;
      return x === null || y === null ? compare(x, y, numeric) : sign * compare(x, y, numeric);
    });
  });

  function copy(text: string): void {
    navigator.clipboard?.writeText(text).catch(() => {
      // A browser that refuses the clipboard leaves the text to be selected by hand.
    });
  }

  function keydown(event: KeyboardEvent): void {
    if (!selected) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
      copy(shown[selected.row]?.values[selected.column] ?? '');
      event.preventDefault();
      return;
    }
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const move = moves[event.key];
    if (move) {
      selected = {
        row: Math.min(Math.max(selected.row + move[0], 0), shown.length - 1),
        column: Math.min(Math.max(selected.column + move[1], 0), columns.length - 1),
      };
      table?.querySelector(`[data-cell="${selected.row}-${selected.column}"]`)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      event.preventDefault();
    }
  }

  function select(event: MouseEvent): void {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-cell]');
    if (!cell) return;
    const [row, column] = (cell.dataset.cell as string).split('-').map(Number) as [number, number];
    selected = { row, column };
  }

  function resize(event: PointerEvent, index: number): void {
    const start = event.clientX;
    const width = widths[index] as number;
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    const move = (next: PointerEvent) => (widths[index] = Math.max(48, width + next.clientX - start));
    const stop = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', stop);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop);
    event.preventDefault();
  }

  function openMenu(event: MouseEvent, column: number): void {
    // Placed in the grid itself: a glass card around it makes `fixed` follow the card, not the window.
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const frame = wrap?.getBoundingClientRect() ?? { left: 0, top: 0 };
    menu = menu?.column === column ? null : { column, x: Math.max(0, box.right - frame.left - 270), y: box.bottom - frame.top + 4 };
    event.stopPropagation();
  }

  const ACTIONS: { icon: IconName; label: string; act: (column: number) => void }[] = [
    { icon: 'sort-ascending', label: 'grid.sortAscending', act: (column) => (sort = { column, direction: 'ascending' }) },
    { icon: 'sort-descending', label: 'grid.sortDescending', act: (column) => (sort = { column, direction: 'descending' }) },
    { icon: 'arrows-out-line-horizontal', label: 'grid.fit', act: (column) => (widths[column] = fitted(column)) },
    { icon: 'copy-fill', label: 'grid.copyName', act: (column) => copy(columns[column]?.name ?? '') },
  ];
  const total = $derived(48 + widths.reduce((sum, width) => sum + width, 0));
</script>

<svelte:window onclick={() => (menu = null)} onkeydown={(event) => event.key === 'Escape' && (menu = null)} />

<div class="wrap" bind:this={wrap}>
  <div class="scroll">
    <table bind:this={table} role="grid" aria-label={label} tabindex="0" style:width="{total}px" onkeydown={keydown} onclick={select}>
      <colgroup>
        <col style:width="48px" />
        {#each widths as width, index (index)}<col style:width="{width}px" />{/each}
      </colgroup>
      <thead>
        <tr>
          <th class="rn" scope="col">{t('grid.row')}</th>
          {#each columns as column, index (index)}
            <th scope="col" aria-sort={sort?.column === index ? sort.direction : undefined}>
              <span class="head">
                <span class="text">
                  <span class="name"><span title={column.name}>{column.name}</span>{#if sort?.column === index}<Icon name={sort.direction === 'ascending' ? 'sort-ascending' : 'sort-descending'} />{/if}</span>
                  <span class="type">{column.type}</span>
                </span>
                <button type="button" class="menu-button" aria-label={t('grid.menu', { name: column.name })} aria-expanded={menu?.column === index} onclick={(event) => openMenu(event, index)}><Icon name="dots-three" /></button>
              </span>
              <span
                class="resize"
                role="separator"
                aria-orientation="vertical"
                aria-label={t('grid.resize', { name: column.name })}
                onpointerdown={(event) => resize(event, index)}
                ondblclick={() => (widths[index] = fitted(index))}
              ></span>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each shown as row, r (row.number)}
          <tr>
            <td class="rn">{row.number}</td>
            {#each row.values as value, c (c)}
              <td
                role="gridcell"
                data-cell="{r}-{c}"
                class:num={NUMERIC.has(columns[c]?.type ?? '')}
                class:sel={selected?.row === r && selected?.column === c}
                aria-selected={selected?.row === r && selected?.column === c}
                title={value !== null && value.length * CHAR + 20 > (widths[c] ?? 0) ? value : undefined}
              >{#if value === null}<span class="null">null</span>{:else}{value}{/if}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if menu}
    {@const column = menu.column}
    <div class="menu" role="menu" tabindex="-1" style:left="{menu.x}px" style:top="{menu.y}px" onclick={(event) => event.stopPropagation()} onkeydown={(event) => event.key === 'Escape' && (menu = null)}>
      {#each ACTIONS as action (action.label)}
        <button type="button" role="menuitem" onclick={() => { action.act(column); menu = null; }}><Icon name={action.icon} />{t(action.label)}</button>
      {/each}
      <p class="note">{t('grid.sortNote')}</p>
    </div>
  {/if}
</div>

<style>
  .wrap { position: relative; }
  .scroll { overflow: auto; max-height: min(620px, calc(100vh - 220px)); border-radius: var(--radius-md); outline: 1px solid var(--tint-active); background: var(--surface-solid); }
  table { table-layout: fixed; border-collapse: separate; border-spacing: 0; font-size: var(--text-small); font-variant-numeric: tabular-nums; }
  table:focus-visible { outline: 2px solid var(--text-secondary); outline-offset: -2px; }
  th, td { padding: 7px 10px; border-right: 1px solid var(--tint-hover); border-bottom: 1px solid var(--tint-hover); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; text-align: left; }
  th { position: sticky; top: 0; z-index: 2; padding: 0; background: var(--surface-sub); color: var(--text-primary); font-weight: var(--weight-medium); border-bottom-color: var(--tint-active); }
  .head { display: flex; align-items: center; gap: 6px; padding: 6px 4px 6px 10px; min-width: 0; }
  .text { display: flex; flex-direction: column; min-width: 0; line-height: 1.35; }
  .name { display: flex; align-items: center; gap: 4px; min-width: 0; }
  .name > span { overflow: hidden; text-overflow: ellipsis; }
  .name :global(.icon) { font-size: 12px; color: var(--text-secondary); flex: none; }
  .type { font: 10.5px var(--font-mono); color: var(--text-muted); font-weight: var(--weight-regular); overflow: hidden; text-overflow: ellipsis; }
  .menu-button { width: 22px; height: 22px; margin-left: auto; flex: none; border: 0; border-radius: var(--radius-sm); background: none; color: var(--text-muted); cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; font-size: 12px; }
  .menu-button:hover, .menu-button[aria-expanded='true'] { background: var(--tint-active); color: var(--text-primary); }
  .resize { position: absolute; top: 0; right: -4px; bottom: 0; width: 9px; cursor: col-resize; z-index: 3; touch-action: none; }
  .resize::after { content: ''; position: absolute; top: 6px; bottom: 6px; left: 4px; width: 1px; }
  th:hover .resize::after { background: var(--text-muted); width: 2px; left: 3px; }
  td { color: var(--text-primary); cursor: default; }
  td.num { text-align: right; }
  .rn { position: sticky; left: 0; z-index: 1; background: var(--surface-sub); color: var(--text-muted); text-align: right; font-size: var(--text-meta); }
  th.rn { z-index: 3; padding: 7px 10px; font-weight: var(--weight-regular); }
  tbody tr:nth-child(even) td { background: var(--surface-sub); }
  tbody tr:nth-child(even) td.rn { background: var(--tint-hover); }
  tbody tr:hover td { background: var(--tint-hover); }
  tbody tr:hover td.rn { background: var(--tint-active); }
  tbody td.sel { outline: 2px solid var(--text-secondary); outline-offset: -2px; background: var(--surface-solid); }
  .null { color: var(--text-muted); font-style: italic; }
  .menu { position: absolute; z-index: 30; width: 270px; padding: 6px; border-radius: var(--radius-md); background: var(--surface-solid); outline: 1px solid var(--tint-active); box-shadow: var(--sheet-shadow); }
  .menu button { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 8px; border-radius: var(--radius-sm); font-size: var(--text-small); color: var(--text-primary); cursor: pointer; }
  .menu button:hover, .menu button:focus-visible { background: var(--tint-hover); }
  .menu button :global(.icon) { color: var(--text-secondary); }
  .note { margin: 4px 8px; padding-top: 6px; border-top: 1px solid var(--tint-hover); font-size: var(--text-meta); line-height: 1.45; color: var(--text-muted); }
</style>

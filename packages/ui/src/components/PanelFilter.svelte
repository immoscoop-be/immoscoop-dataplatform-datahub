<script module lang="ts">
  /** A kind of item a panel can show or leave out: its name, a line on what it is and how many there are. */
  export interface FilterKind<T extends string = string> {
    value: T;
    name: string;
    detail: string;
    count?: number | undefined;
  }
</script>

<script lang="ts" generics="T extends string">
  import type { Snippet } from 'svelte';
  import Icon from '../foundations/Icon.svelte';
  import { t } from '../foundations/texts.svelte.js';

  /**
   * The filter of a panel, next to its search (Filter a list, DEC-UX-150): a button with how many kinds
   * differ from what the panel shows by itself folds open a small form, with a checkbox per kind, what it
   * is and how many there are, "Reset" and the reminder that only the panel of the User changes. Folded,
   * one line says what differs, each kind with a cross that puts it back.
   */
  let {
    id,
    label,
    legend,
    kinds,
    chosen = $bindable(),
    defaults,
    atLeastOne = false,
    children,
  }: {
    /** The id of the form, which the button opens. */
    id: string;
    /** What the button does, said in full. */
    label: string;
    legend: string;
    kinds: readonly FilterKind<T>[];
    /** The kinds the panel shows, in the order of `kinds`. */
    chosen: T[];
    /** What the panel shows by itself, and what "Reset" goes back to. */
    defaults: readonly T[];
    /** One kind always stays ticked, so that the panel shows something. */
    atLeastOne?: boolean;
    /** The search the filter stands next to. */
    children: Snippet;
  } = $props();

  let open = $state(false);

  const added = $derived(kinds.filter((kind) => chosen.includes(kind.value) && !defaults.includes(kind.value)));
  const removed = $derived(kinds.filter((kind) => !chosen.includes(kind.value) && defaults.includes(kind.value)));
  const differs = $derived(added.length + removed.length);

  function toggle(value: T) {
    chosen = kinds.filter((kind) => (kind.value === value) !== chosen.includes(kind.value)).map((kind) => kind.value);
  }
</script>

<div class="row">
  <div class="field">{@render children()}</div>
  <button type="button" class="toggle" aria-expanded={open} aria-controls={id} aria-label={label} title={label} onclick={() => (open = !open)}>
    <Icon name="sliders-horizontal" />{#if differs > 0}<span class="badge" aria-hidden="true">{differs}</span>{/if}
  </button>
</div>

<form
  class="form card"
  {id}
  hidden={!open}
  onsubmit={(event) => event.preventDefault()}
  onreset={(event) => {
    event.preventDefault();
    chosen = kinds.filter((kind) => defaults.includes(kind.value)).map((kind) => kind.value);
  }}
>
  <fieldset>
    <legend>{legend}</legend>
    {#each kinds as kind (kind.value)}
      {@const on = chosen.includes(kind.value)}
      <label class="option">
        <input type="checkbox" checked={on} disabled={atLeastOne && on && chosen.length === 1} onchange={() => toggle(kind.value)} />
        <span class="text"><span>{kind.name}</span><span class="meta">{kind.detail}</span></span>
        {#if kind.count !== undefined}<span class="count">{kind.count}</span>{/if}
      </label>
    {/each}
  </fieldset>
  <div class="foot">
    <button type="reset" class="reset" disabled={differs === 0}>{t('filter.reset')}</button>
    <span class="meta">{t('filter.note')}</span>
  </div>
</form>

{#if !open && differs > 0}
  <p class="on">
    {#if added.length > 0}
      <span>{t('filter.added')}</span>
      {#each added as kind (kind.value)}
        <span class="kind">{kind.name}<button type="button" class="undo" aria-label={t('filter.remove', { name: kind.name })} onclick={() => toggle(kind.value)}><Icon name="x" /></button></span>
      {/each}
    {/if}
    {#if removed.length > 0}
      <span>{t('filter.removed')}</span>
      {#each removed as kind (kind.value)}
        <span class="kind">{kind.name}<button type="button" class="undo" aria-label={t('filter.add', { name: kind.name })} onclick={() => toggle(kind.value)}><Icon name="x" /></button></span>
      {/each}
    {/if}
  </p>
{/if}

<style>
  .row { display: flex; align-items: center; gap: 6px; margin: 16px 0 12px; }
  .field { flex: 1; min-width: 0; }
  .toggle { position: relative; flex: none; width: 36px; height: 36px; border: 0; border-radius: var(--radius-md); background: none; color: var(--text-secondary);
    display: inline-flex; align-items: center; justify-content: center; font-size: 16px; cursor: pointer; }
  .toggle:hover { background: var(--tint-hover); }
  .toggle[aria-expanded='true'] { background: var(--surface-sub); color: var(--text-primary); }
  .toggle:focus-visible { outline: 2px solid var(--text-secondary); }
  .badge { position: absolute; top: 2px; right: 2px; min-width: 15px; height: 15px; padding: 0 4px; box-sizing: border-box; border-radius: var(--radius-pill);
    background: var(--text-primary); color: var(--surface-solid); font-size: 10px; line-height: 15px; text-align: center; }
  .form { margin: 0 0 10px; padding: 12px 14px; border-radius: var(--radius-md); }
  .form[hidden] { display: none; }
  fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: 2px; min-width: 0; }
  legend { padding: 0; margin-bottom: 6px; font-size: var(--text-meta); color: var(--text-muted); }
  .option { display: flex; align-items: center; gap: 10px; padding: 6px 4px; border-radius: var(--radius-sm); cursor: pointer; }
  .option:hover { background: var(--tint-hover); }
  .option:has(input:disabled) { cursor: default; }
  .option input { accent-color: var(--text-primary); margin: 0; }
  .text { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: var(--text-small); }
  .meta, .count { font-size: var(--text-meta); color: var(--text-muted); }
  .foot { display: flex; align-items: center; gap: 10px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--tint-hover); }
  .foot .meta { margin-left: auto; }
  .reset { all: unset; cursor: pointer; font-size: var(--text-meta); color: var(--text-secondary); text-decoration: underline; text-underline-offset: 3px; }
  .reset:disabled { cursor: default; color: var(--text-muted); text-decoration: none; }
  .reset:focus-visible { outline: 2px solid var(--text-secondary); }
  .on { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin: -4px 4px 8px; font-size: var(--text-meta); color: var(--text-secondary); }
  .kind { display: inline-flex; align-items: center; gap: 2px; }
  .undo { all: unset; cursor: pointer; display: inline-flex; padding: 2px; border-radius: var(--radius-sm); color: var(--text-muted); }
  .undo:hover { color: var(--text-primary); }
  .undo:focus-visible { outline: 2px solid var(--text-secondary); }
</style>

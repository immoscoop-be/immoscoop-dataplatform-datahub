<script module lang="ts">
  import type { ParameterKind } from '../lib/query.js';

  /** An @name in the SQL that is not a Parameter, where it is, with the kind suggested for it. */
  export interface Missing {
    name: string;
    line: number;
    suggestedKind: ParameterKind | null;
  }
</script>

<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import { describe, kindOf, lineOf, namesOf } from '../lib/parameters.js';
  import type { Parameter } from '../lib/query.js';

  /**
   * The Parameters of a query (Parameters, DEC-UX-71): a second box under the editor, which folds open and
   * shut. Folded, a chip per Parameter with its value; open, a tile per Parameter with its kind, its value,
   * what a function gives today and the line of the SQL it is on. A Parameter that is not in the SQL is
   * grey: it is not sent. An @name in the SQL that is not a Parameter stands out; a click defines it.
   */
  let {
    parameters,
    sql,
    unused,
    missing,
    open = $bindable(true),
    readonly = false,
    onedit,
    ondefine,
    onadd,
  }: {
    parameters: readonly Parameter[];
    sql: string;
    /** The Parameters the Pre-flight found not in the SQL. */
    unused: readonly string[];
    missing: readonly Missing[];
    open?: boolean;
    /** A query of someone else, or a run being previewed: its values are shown, not changed. */
    readonly?: boolean;
    onedit: (name: string) => void;
    ondefine: (missing: Missing) => void;
    onadd: () => void;
  } = $props();

  const language = $derived(currentLanguage());
  const lineIn = (parameter: Parameter) =>
    namesOf(parameter)
      .map((name) => lineOf(sql, name))
      .find((line) => line !== null) ?? null;
  const shown = $derived(
    parameters.map((parameter) => {
      const line = lineIn(parameter);
      return { parameter, line, unused: unused.includes(parameter.name) || line === null, ...describe(parameter, language) };
    }),
  );
</script>

<div class="box" class:open>
  <div class="head">
    <button type="button" class="toggle" aria-expanded={open} aria-label={t('param.toggle')} onclick={() => (open = !open)}><Icon name="caret-down" /></button>
    <span class="label">{t('param.title')}</span>
    {#if !open}
      <span class="chips">
        {#each shown as entry (entry.parameter.name)}
          <button
            type="button"
            class="chip"
            class:unused={entry.unused}
            title={entry.unused ? t('param.unused') : t('param.line', { line: entry.line ?? 0 })}
            onclick={() => onedit(entry.parameter.name)}
          >
            <span class="mono">@{entry.parameter.name}</span>
            {#if entry.gives}<Icon name="function" />{/if}<span>{entry.gives ?? entry.value}</span>
          </button>
        {/each}
        {#each missing as entry (entry.name)}
          <button type="button" class="chip undefined" title={t('param.undefined', { line: entry.line })} disabled={readonly} onclick={() => ondefine(entry)}>
            <Icon name="warning-fill" /><span class="mono">@{entry.name}</span><span>{t('param.undefined.chip')}</span>
          </button>
        {/each}
      </span>
    {/if}
    <span class="grow"></span>
    {#if !readonly}<Button variant="outline" onclick={onadd}><Icon name="plus" />{t('param.add')}</Button>{/if}
  </div>
  {#if open}
    {#if shown.length === 0 && missing.length === 0}
      <p class="empty meta">{t('param.empty')}</p>
    {:else}
      <div class="tiles">
        {#each shown as entry (entry.parameter.name)}
          {@const kind = kindOf(entry.parameter.kind)}
          <button type="button" class="tile" class:unused={entry.unused} onclick={() => onedit(entry.parameter.name)}>
            <span class="tile-head"><span class="mono name">@{entry.parameter.name}</span><span class="kind" title={kind.type}><Icon name={kind.icon} />{t(kind.label)}</span></span>
            <span class="value" title={entry.value}>{entry.value}</span>
            {#if entry.gives}<span class="small"><Icon name="function" />{entry.gives}</span>{/if}
            <span class="small state">{entry.unused ? t('param.unused') : t('param.line', { line: entry.line ?? 0 })}</span>
          </button>
        {/each}
        {#each missing as entry (entry.name)}
          <button type="button" class="tile undefined" disabled={readonly} onclick={() => ondefine(entry)}>
            <span class="tile-head"><Icon name="warning-fill" /><span class="mono name">@{entry.name}</span></span>
            <span class="small state">{t('param.undefined', { line: entry.line })}</span>
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .box { border-radius: var(--radius-lg); background: var(--surface-sub); padding: 10px 14px 12px; }
  .head { display: flex; align-items: center; gap: 8px; min-height: 34px; flex-wrap: wrap; }
  .label { margin: 0; }
  .toggle { width: 26px; height: 26px; margin-left: -6px; border: 0; border-radius: var(--radius-sm); background: none; color: var(--text-secondary); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; }
  .toggle:hover { background: var(--tint-active); }
  .toggle :global(.icon) { transition: transform var(--motion-fold) ease; }
  .toggle[aria-expanded='false'] :global(.icon) { transform: rotate(-90deg); }
  .grow { flex: 1; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
  .chip { display: inline-flex; align-items: center; gap: 6px; font: var(--text-meta) var(--font-family); color: var(--text-secondary); background: var(--surface-solid);
    border: 0; border-radius: var(--radius-pill); padding: 3px 10px; cursor: pointer; }
  .chip .mono { color: var(--text-primary); }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin-top: 8px; }
  .tile { all: unset; box-sizing: border-box; display: flex; flex-direction: column; gap: 4px; min-width: 0; padding: 9px 12px 10px; border-radius: var(--radius-md);
    background: var(--surface-solid); cursor: pointer; outline: 1px solid transparent; }
  .tile:hover { outline-color: var(--tint-active); }
  .tile:focus-visible, .chip:focus-visible { outline: 2px solid var(--text-secondary); }
  .tile-head { display: flex; align-items: center; gap: 7px; }
  .name { font-size: var(--text-small); font-weight: var(--weight-medium); }
  .kind { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-meta); color: var(--text-secondary); background: var(--surface-sub); padding: 1px 8px; border-radius: var(--radius-pill); }
  .value { font: var(--text-small) var(--font-mono); color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .small { display: flex; align-items: center; gap: 4px; font-size: var(--text-meta); color: var(--text-muted); }
  /* Not in the SQL: grey, it is not sent with the query. */
  .unused { background: none; outline: 1px dashed var(--tint-active); }
  .unused > * { opacity: .55; }
  .tile.unused .state { opacity: 1; }
  /* In the SQL but not a Parameter: it stands out, and the query cannot run. */
  .undefined { background: color-mix(in srgb, var(--signal-warn) 13%, var(--surface-solid)); outline: 1.5px solid var(--signal-warn); }
  .undefined .state, .chip.undefined, .chip.undefined .mono, .undefined :global(.icon) { color: var(--signal-warn); }
  .undefined:disabled { cursor: default; }
  .empty { margin: 6px 0 2px; }
</style>

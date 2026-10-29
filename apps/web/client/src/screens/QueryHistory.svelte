<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import type { Run } from '../lib/query.js';

  /**
   * The history of a query (DEC-UX-74): every run a variation of its values, its SQL or both, newest first,
   * one row each with Preview and Apply; it does not open to its details (DEC-UX-88). The run on screen
   * says so instead. At the bottom, when the query was started, and from which query.
   */
  let {
    runs,
    shown,
    flash = null,
    readonly = false,
    loading = false,
    start,
    when,
    onpreview,
    onapply,
    onmore,
  }: {
    /** The runs read so far, newest first; undefined while they come. */
    runs: readonly Run[] | undefined;
    /** The number of the run whose result is on screen. */
    shown: number | null;
    /** A run to point out, as one chosen in the panel. */
    flash?: number | null;
    /** A query of someone else: its runs are seen, not applied. */
    readonly?: boolean;
    loading?: boolean;
    /** The line at the bottom: when it started, on what or from which query. */
    start: string;
    when: (at: string) => string;
    onpreview: (run: Run) => void;
    onapply: (run: Run) => void;
    onmore: () => void;
  } = $props();

  const lowest = $derived(runs?.at(-1)?.number ?? 1);
  let list: HTMLElement | undefined = $state();
  $effect(() => {
    if (flash === null || !runs) return;
    list?.querySelector(`[data-run="${flash}"]`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  });
</script>

<p class="intro meta">{t('history.intro')}</p>
{#if runs && runs.length === 0}
  <p class="none">{t('history.none')}</p>
{:else if runs}
  <div class="list" bind:this={list}>
    {#each runs as run (run.number)}
      <div class="run" class:flash={flash === run.number} data-run={run.number}>
        <span class="number">{t('history.run', { number: run.number })}</span>
        <span class="meta">{when(run.startedAt)}{#if run.state === 'failed'} · {t('history.failed')}{/if}</span>
        <span class="acts">
          {#if shown === run.number}
            <span class="pill">{t('history.shown')}</span>
          {:else}
            <Button variant="outline" onclick={() => onpreview(run)}><Icon name="eye" />{t('history.preview')}</Button>
            {#if !readonly}<Button variant="outline" onclick={() => onapply(run)}><Icon name="arrow-counter-clockwise" />{t('history.apply')}</Button>{/if}
          {/if}
        </span>
      </div>
    {/each}
    {#if lowest > 1}
      <button type="button" class="more" disabled={loading} onclick={onmore}>{t('history.more', { count: lowest - 1 })}</button>
    {:else}
      <div class="start"><Icon name="flag" />{start}</div>
    {/if}
  </div>
{/if}

<style>
  .intro { display: block; margin: 0 2px 10px; line-height: 1.5; }
  .none { margin: 0; padding: 28px 22px; border-radius: var(--radius-md); background: var(--surface-sub); font-size: var(--text-small); }
  .list { display: flex; flex-direction: column; border-radius: var(--radius-md); outline: 1px solid var(--tint-active); overflow: hidden; }
  .run { display: grid; grid-template-columns: 110px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 9px 12px; font-size: var(--text-small); transition: background var(--motion-fold); }
  .run + .run { border-top: 1px solid var(--tint-hover); }
  .run:hover { background: var(--tint-hover); }
  .run.flash { background: color-mix(in srgb, var(--text-muted) 14%, transparent); }
  .number { font-weight: var(--weight-medium); }
  .acts { display: flex; gap: 8px; justify-content: flex-end; }
  .pill { font-size: var(--text-meta); color: var(--text-secondary); background: var(--surface-sub); padding: 3px 10px; border-radius: var(--radius-pill); }
  .more { border: 0; border-top: 1px solid var(--tint-hover); background: none; padding: 9px 12px; font: var(--text-small) var(--font-family); color: var(--text-secondary); text-align: left; cursor: pointer; }
  .more:hover { background: var(--tint-hover); }
  .more:focus-visible { outline: 2px solid var(--text-secondary); }
  .start { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-top: 1px solid var(--tint-hover); font-size: var(--text-meta); color: var(--text-muted); }
</style>

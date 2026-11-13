<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import { digitOf, type FlagMark, modLabel } from '../lib/flags.js';
  import { queryPath } from '../lib/routes.js';

  /**
   * The flagged queries on top of every screen of Query (DEC-UX-236): a tab per query in the order they were flagged,
   * with its number; one Cmd (Ctrl elsewhere) at the start of the row says which key goes with the numbers. The open
   * query stands out. A tab marks a run going, a result not seen yet, a run that failed and Broken; its × unflags it,
   * and dragging it changes its place, and its number with it. With nothing flagged, the row says how. At its right end,
   * the quick window (DEC-UX-237).
   */
  let {
    items,
    current,
    mac,
    onunflag,
    onmove,
    onquick,
  }: {
    /** The flagged queries in their order; a name not read yet is null. */
    items: readonly { id: string; name: string | null; mark: FlagMark }[];
    /** The query that is open, if any. */
    current: string | undefined;
    /** Cmd on a Mac, Ctrl elsewhere. */
    mac: boolean;
    onunflag: (id: string) => void;
    onmove: (from: number, to: number) => void;
    onquick: () => void;
  } = $props();

  const mod = $derived(modLabel(mac));
  const MARKS = { running: 'flags.running', new: 'flags.new', failed: 'flags.failed', broken: 'flags.broken' } as const;
  let dragged = $state<number | null>(null);
  let over = $state<number | null>(null);

  function drop(at: number): void {
    if (dragged !== null && dragged !== at) onmove(dragged, at);
    dragged = null;
    over = null;
  }
</script>

<nav class="flags" aria-label={t('flags.label')}>
  {#if items.length > 0}
    <span class="mod" title={t('flags.mod', { mod: mac ? '⌘' : 'Ctrl' })}>{mac ? '⌘' : 'Ctrl'}</span>
    <div class="list" role="list">
    {#each items as item, at (item.id)}
      {@const key = `${mod}${digitOf(at)}`}
      <div
        class="tab"
        class:current={item.id === current}
        class:dragging={dragged === at}
        class:before={over === at && dragged !== null && dragged > at}
        class:after={over === at && dragged !== null && dragged < at}
        draggable="true"
        role="listitem"
        ondragstart={(event) => {
          dragged = at;
          event.dataTransfer?.setData('text/plain', item.id);
          if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        }}
        ondragover={(event) => {
          if (dragged === null) return;
          event.preventDefault();
          over = at;
        }}
        ondragleave={() => over === at && (over = null)}
        ondrop={(event) => {
          event.preventDefault();
          drop(at);
        }}
        ondragend={() => {
          dragged = null;
          over = null;
        }}
      >
        <a
          class="open"
          href={queryPath(item.id)}
          aria-current={item.id === current ? 'page' : undefined}
          aria-keyshortcuts={mac ? `Meta+${digitOf(at)}` : `Control+${digitOf(at)}`}
          title={`${item.name ?? ''} · ${key}${item.mark ? ` · ${t(MARKS[item.mark])}` : ''}`}
        >
          <span class="key">{digitOf(at)}</span>
          <span class="name">{item.name ?? '…'}</span>
          {#if item.mark === 'running'}
            <span class="spin"><Icon name="circle-notch" label={t('flags.running')} /></span>
          {:else if item.mark === 'broken'}
            <span class="broken"><Icon name="link-break" label={t('flags.broken')} /></span>
          {:else if item.mark}
            <span class="dot" class:failed={item.mark === 'failed'} role="img" aria-label={t(MARKS[item.mark])}></span>
          {/if}
        </a>
        <button type="button" class="x" aria-label={t('flags.unflag', { name: item.name ?? '' })} title={t('flags.unflag', { name: item.name ?? '' })} onclick={() => onunflag(item.id)}
          ><Icon name="x" /></button
        >
      </div>
    {/each}
    </div>
  {:else}
    <span class="empty"><Icon name="flag" /><span>{t('flags.empty', { first: `${mod}1`, last: `${mod}0` })}</span></span>
  {/if}
  <button type="button" class="quick" aria-label={t('quick.title')} title={t('quick.hint')} onclick={onquick}
    ><Icon name="magnifying-glass" /><span class="kbd">{mac ? '⌘⇧P' : 'Ctrl+Shift+P'}</span></button
  >
</nav>

<style>
  .flags { display: flex; align-items: center; gap: 4px; padding: 4px; margin: -12px -14px 14px; border-radius: var(--radius-md); background: var(--surface-sub); min-height: 38px; flex: none; }
  .list { display: contents; }
  .mod { font-size: var(--text-small); font-weight: var(--weight-medium); color: var(--text-muted); padding: 0 4px 0 8px; flex: none; }
  .tab { position: relative; display: flex; align-items: center; flex: 0 1 200px; min-width: 64px; border-radius: var(--radius-sm); color: var(--text-secondary); }
  .tab:hover { background: var(--tint-hover); color: var(--text-primary); }
  .tab.current { background: var(--card); color: var(--text-primary); }
  .tab.dragging { opacity: var(--opacity-out-of-focus); }
  .tab.before::before, .tab.after::after { content: ''; position: absolute; top: 6px; bottom: 6px; width: 2px; border-radius: var(--radius-mark); background: var(--text-primary); }
  .tab.before::before { left: -3px; }
  .tab.after::after { right: -3px; }
  .open { display: flex; align-items: center; gap: 7px; flex: 1; min-width: 0; padding: 6px 4px 6px 8px; color: inherit; text-decoration: none; font-size: var(--text-small); }
  .open:focus-visible { outline: 2px solid var(--text-secondary); outline-offset: -2px; border-radius: var(--radius-sm); }
  .key { font-size: var(--text-meta); font-weight: var(--weight-medium); color: var(--text-muted); flex: none; }
  .current .key { color: var(--text-primary); }
  .name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dot { width: 7px; height: 7px; border-radius: var(--radius-pill); background: var(--text-primary); flex: none; }
  .dot.failed { background: var(--signal-urgent); }
  .broken { display: inline-flex; color: var(--signal-urgent); flex: none; }
  .spin { display: inline-flex; color: var(--text-muted); flex: none; animation: turn var(--motion-spin) infinite; }
  @keyframes turn { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
  .x { display: none; width: 22px; height: 22px; margin-right: 4px; border: 0; border-radius: var(--radius-chip); background: none; color: var(--text-muted); align-items: center; justify-content: center; padding: 0; cursor: pointer; flex: none; }
  .tab:hover .x, .tab:focus-within .x { display: inline-flex; }
  .tab:hover .dot, .tab:focus-within .dot { display: none; }
  .x:hover { background: var(--tint-active); color: var(--text-primary); }
  .empty { display: flex; align-items: center; gap: 8px; padding: 4px 8px; color: var(--text-muted); font-size: var(--text-small); }
  .quick { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; color: var(--text-muted); font: var(--text-meta) var(--font-family); padding: 6px 8px; border-radius: var(--radius-sm); cursor: pointer; flex: none; }
  .quick:hover { background: var(--tint-hover); color: var(--text-primary); }
  .kbd { font-weight: var(--weight-medium); background: var(--card); border-radius: var(--radius-mark); padding: 1px 5px; }
</style>

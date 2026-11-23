<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import { digitOf, type FlagMark, keyed, modLabel } from '../lib/flags.js';
  import { projectPath } from '../lib/projects.js';
  import { queryPath } from '../lib/routes.js';

  /**
   * The row on top of every screen of Query while a Project is active (DEC-UX-317, DEC-UX-319): first a tab for its
   * details, its name and how many are in it, without a key; then a tab per query in the one order of the Project. The
   * first ten carry Cmd+1 to Cmd+0 (Ctrl elsewhere), any further one no key, and the tabs scroll sideways, their edges
   * fading, behind "All 14" (DEC-UX-283, OP-UX-96). The open query, or the details, stands out. A tab marks a run going,
   * a result not seen yet, a run that failed and Broken; its × takes the query out of the Project (DEC-UX-291); dragging
   * it changes its place, and its number with it, for everyone in it (OP-UX-95). There are no flagged queries
   * (DEC-UX-316), and no button for the quick window (DEC-UX-284).
   */
  let {
    items,
    current,
    details = false,
    mac,
    project,
    pop = $bindable(null),
    onremove,
    onmove,
  }: {
    /** The queries of the Project in their order; who made each, and locked where the User may not see one of its
     * Resources (OP-UX-97). */
    items: readonly { id: string; name: string | null; mark: FlagMark; by?: string | null; locked?: boolean }[];
    /** The query that is open, if any. */
    current: string | undefined;
    /** The details of the Project are open: its tab stands out. */
    details?: boolean;
    /** Cmd on a Mac, Ctrl elsewhere. */
    mac: boolean;
    /** The active Project, with how many are in it. */
    project: { id: string; name: string; people: number };
    /** The pop-out that is open: the whole row. */
    pop?: 'all' | null;
    onremove: (id: string) => void;
    onmove: (from: number, to: number) => void;
  } = $props();

  const mod = $derived(modLabel(mac));
  const MARKS = { running: 'flags.running', new: 'flags.new', failed: 'flags.failed', broken: 'flags.broken' } as const;
  let dragged = $state<number | null>(null);
  let over = $state<number | null>(null);
  let bar = $state<HTMLElement>();
  let tabs = $state<HTMLElement>();

  function drop(at: number): void {
    if (dragged !== null && dragged !== at) onmove(dragged, at);
    dragged = null;
    over = null;
  }

  // The open query in view, also far along the row (DEC-UX-283).
  $effect(() => {
    void current;
    void items.length;
    tabs?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  });

  // A click elsewhere, or Escape, closes the pop-out.
  $effect(() => {
    if (!pop) return;
    const away = (event: MouseEvent) => {
      if (bar && event.target instanceof Node && !bar.contains(event.target)) pop = null;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        pop = null;
      }
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', escape);
    };
  });

  function tabTitle(item: (typeof items)[number], at: number): string {
    const parts = [item.name ?? ''];
    if (keyed(at)) parts.push(`${mod}${digitOf(at)}`);
    if (item.by) parts.push(t('row.by', { name: item.by }));
    if (item.locked) parts.push(t('row.locked'));
    else if (item.mark) parts.push(t(MARKS[item.mark]));
    return parts.join(' · ');
  }
</script>

<nav class="flags" bind:this={bar} aria-label={t('row.label.project', { name: project.name })}>
  <!-- The details of the Project, its first tab, without a key (DEC-UX-319). -->
  <a class="switch" class:current={details} href={projectPath(project.id)} aria-current={details ? 'page' : undefined} title={t('row.details', { name: project.name })}>
    <Icon name="folders-fill" />
    <span class="clip">{project.name}</span>
    <span class="people" title={t('row.people', { count: project.people })}><Icon name="users" />{project.people}</span>
  </a>
  {#if items.length > 0}
    <span class="mod" title={t('flags.mod', { mod: mac ? '⌘' : 'Ctrl' })}>{mac ? '⌘' : 'Ctrl'}</span>
  {/if}
  <div class="tabs" class:many={items.length > 8} bind:this={tabs} role="list">
    {#each items as item, at (item.id)}
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
          href={item.locked ? projectPath(project.id) : queryPath(item.id)}
          aria-current={item.id === current ? 'page' : undefined}
          aria-keyshortcuts={keyed(at) ? (mac ? `Meta+${digitOf(at)}` : `Control+${digitOf(at)}`) : undefined}
          title={tabTitle(item, at)}
        >
          {#if keyed(at)}<span class="key">{digitOf(at)}</span>{:else}<span class="nokey" aria-hidden="true"></span>{/if}
          <span class="name">{item.name ?? '…'}</span>
          {#if item.locked}
            <span class="lock"><Icon name="lock-simple" label={t('row.locked')} /></span>
          {:else if item.mark === 'running'}
            <span class="spin"><Icon name="circle-notch" label={t('flags.running')} /></span>
          {:else if item.mark === 'broken'}
            <span class="broken"><Icon name="link-break" label={t('flags.broken')} /></span>
          {:else if item.mark}
            <span class="dot" class:failed={item.mark === 'failed'} role="img" aria-label={t(MARKS[item.mark])}></span>
          {/if}
        </a>
        <button
          type="button"
          class="x"
          aria-label={t('row.remove', { name: item.name ?? '', project: project.name })}
          title={t('row.remove.hint', { project: project.name, by: item.by ?? '' })}
          onclick={() => onremove(item.id)}><Icon name="x" /></button
        >
      </div>
    {/each}
  </div>
  <div class="end">
    {#if items.length > 6}
      <button type="button" class="all" aria-haspopup="menu" aria-expanded={pop === 'all'} title={t('row.all.hint')} onclick={() => (pop = pop === 'all' ? null : 'all')}
        ><span>{t('row.all', { count: items.length })}</span><Icon name="caret-down" /></button
      >
    {/if}
  </div>

  {#if pop === 'all'}
    <div class="pop end" role="menu" aria-label={t('row.all.hint')}>
      <div class="pop-h">{project.name} · {t('row.queries', { count: items.length })}</div>
      {#each items as item, at (item.id)}
        <a class="opt" class:on={item.id === current} role="menuitem" href={item.locked ? projectPath(project.id) : queryPath(item.id)} onclick={() => (pop = null)}>
          <span class="kbd" class:none={!keyed(at)}>{mod}{keyed(at) ? digitOf(at) : '0'}</span>
          <span class="grow">
            <span class="title">{item.name ?? '…'}</span>
            {#if item.by}
              <span class="meta">{t('row.by', { name: item.by })}{item.locked ? ` · ${t('row.locked')}` : item.mark ? ` · ${t(MARKS[item.mark])}` : ''}</span>
            {:else if item.mark}
              <span class="meta">{t(MARKS[item.mark])}</span>
            {/if}
          </span>
        </a>
      {/each}
      <div class="foot"><span class="meta">{t('row.all.foot.project')}</span></div>
    </div>
  {/if}
</nav>

<style>
  .flags { position: relative; display: flex; align-items: center; gap: 4px; padding: 4px; margin: -12px -14px 14px; border-radius: var(--radius-md); background: var(--surface-sub); min-height: 38px; flex: none; }
  .switch { display: inline-flex; align-items: center; gap: 7px; flex: 0 1 auto; max-width: 240px; color: var(--text-secondary); font: var(--weight-medium) var(--text-small) var(--font-family); padding: 6px 9px; border-radius: var(--radius-sm); text-decoration: none; }
  .switch:hover { background: var(--tint-hover); color: var(--text-primary); }
  .switch.current { background: var(--card); color: var(--text-primary); }
  .switch:focus-visible { outline: 2px solid var(--text-secondary); outline-offset: -2px; }
  .clip { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .people { display: inline-flex; align-items: center; gap: 3px; color: var(--text-muted); font-weight: var(--weight-regular); font-size: var(--text-meta); flex: none; }
  .mod { font-size: var(--text-small); font-weight: var(--weight-medium); color: var(--text-muted); padding: 0 4px 0 8px; flex: none; }
  .tabs { display: flex; align-items: center; gap: 4px; flex: 1 1 auto; min-width: 0; overflow-x: auto; scrollbar-width: none; }
  .tabs::-webkit-scrollbar { display: none; }
  /* Past what fits, the tabs scroll sideways, their edges fading (DEC-UX-283). */
  .tabs.many { mask-image: linear-gradient(to right, transparent, var(--text-primary) 14px, var(--text-primary) calc(100% - 14px), transparent); padding: 0 6px; }
  .tab { position: relative; display: flex; align-items: center; flex: 0 1 190px; min-width: 124px; border-radius: var(--radius-sm); color: var(--text-secondary); }
  .tab:hover { background: var(--tint-hover); color: var(--text-primary); }
  .tab.current { background: var(--card); color: var(--text-primary); }
  .tab.dragging { opacity: var(--opacity-out-of-focus); }
  .tab.before::before, .tab.after::after { content: ''; position: absolute; top: 6px; bottom: 6px; width: 2px; border-radius: var(--radius-mark); background: var(--text-primary); }
  .tab.before::before { left: -3px; }
  .tab.after::after { right: -3px; }
  .open { display: flex; align-items: center; gap: 7px; flex: 1; min-width: 0; padding: 6px 4px 6px 8px; color: inherit; text-decoration: none; font-size: var(--text-small); }
  .open:focus-visible { outline: 2px solid var(--text-secondary); outline-offset: -2px; border-radius: var(--radius-sm); }
  .key { font-size: var(--text-meta); font-weight: var(--weight-medium); color: var(--text-muted); flex: none; min-width: 8px; }
  .nokey { width: 8px; flex: none; }
  .current .key { color: var(--text-primary); }
  .name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dot { width: 7px; height: 7px; border-radius: var(--radius-pill); background: var(--text-primary); flex: none; }
  .dot.failed { background: var(--signal-urgent); }
  .broken { display: inline-flex; color: var(--signal-urgent); flex: none; }
  .lock { display: inline-flex; color: var(--text-muted); flex: none; }
  .spin { display: inline-flex; color: var(--text-muted); flex: none; animation: turn var(--motion-spin) infinite; }
  @keyframes turn { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
  .x { display: none; width: 22px; height: 22px; margin-right: 4px; border: 0; border-radius: var(--radius-chip); background: none; color: var(--text-muted); align-items: center; justify-content: center; padding: 0; cursor: pointer; flex: none; }
  .tab:hover .x, .tab:focus-within .x { display: inline-flex; }
  .tab:hover .dot, .tab:focus-within .dot { display: none; }
  .x:hover { background: var(--tint-active); color: var(--text-primary); }
  .end { display: flex; align-items: center; gap: 2px; flex: none; margin-left: auto; }
  .all { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; color: var(--text-secondary); font: var(--text-small) var(--font-family); padding: 6px 8px; border-radius: var(--radius-sm); cursor: pointer; flex: none; white-space: nowrap; }
  .all { font-size: var(--text-meta); gap: 5px; }
  .all:hover, .all[aria-expanded='true'] { background: var(--tint-hover); color: var(--text-primary); }
  .kbd { font-size: var(--text-meta); font-weight: var(--weight-medium); background: var(--card); border-radius: var(--radius-mark); padding: 1px 5px; }
  .pop { position: absolute; top: calc(100% + 6px); left: 4px; z-index: 40; width: 360px; max-height: min(520px, 70vh); overflow: auto; padding: 8px; border-radius: var(--radius-md); background: var(--surface-solid); box-shadow: var(--sheet-shadow); font-size: var(--text-small); }
  .pop.end { left: auto; right: 4px; }
  .pop-h { font-size: var(--text-meta); color: var(--text-muted); margin: 2px 8px 4px; }
  .opt { display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 8px; border: 0; border-radius: var(--radius-sm); background: none; color: var(--text-primary); font: inherit; text-align: left; cursor: pointer; text-decoration: none; }
  .opt:hover, .opt.on { background: var(--tint-hover); }
  .grow { flex: 1; min-width: 0; }
  .grow > span { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .meta { font-size: var(--text-meta); color: var(--text-muted); }
  .opt .kbd { background: var(--tint-hover); }
  .kbd.none { visibility: hidden; }
  .foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; padding: 8px 4px 2px; border-top: 1px solid var(--tint-hover); }
  .foot .meta { flex: 1 1 100%; line-height: 1.45; }
</style>

<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import { digitOf, type FlagMark, keyed, modLabel } from '../lib/flags.js';
  import { type ProjectItem, projectPath, withWhom } from '../lib/projects.js';
  import { queryPath } from '../lib/routes.js';

  /**
   * The row on top of every screen of Query (DEC-UX-236, DEC-UX-282): the queries of the Project the User works in, or,
   * in none, their own flagged queries. At its start a switch names which, and opens "Work in": the flagged queries,
   * every Project the User is in, New project and the page of the Project. A tab per query in the order of the row; the
   * first ten carry Cmd+1 to Cmd+0 (Ctrl elsewhere), any further one no key, and the tabs scroll sideways, their edges
   * fading, behind "All 14" (DEC-UX-283, OP-UX-96). The open query stands out. A tab marks a run going, a result not
   * seen yet, a run that failed and Broken; its × unflags it, or, in a Project, removes it from the Project (DEC-UX-291);
   * dragging it changes its place, and its number with it, in a Project for everyone in it (OP-UX-95). After the tabs,
   * for the open query not in the row: "Flag this query", or "Add to Credit leads Q4", or "Move to …" for a query of
   * another Project (OP-UX-93); in no Project also "Add to a project". No button for the quick window (DEC-UX-284).
   */
  type Pop = 'work' | 'all' | 'addp' | 'newproj';
  let {
    items,
    current,
    currentName = null,
    mac,
    project = null,
    flagged = [],
    projects = [],
    me,
    add = null,
    canAddToProject = false,
    pop = $bindable(null),
    onremove,
    onmove,
    onadd,
    onwork,
    onnewproject,
    onaddtoproject,
  }: {
    /** The queries of the row in their order; a name not read yet is null. In a Project, who made each, and locked
     * where the User may not see one of its Resources (OP-UX-97). */
    items: readonly { id: string; name: string | null; mark: FlagMark; by?: string | null; locked?: boolean }[];
    /** The query that is open, if any. */
    current: string | undefined;
    /** Its name, for "Put … in it". */
    currentName?: string | null;
    /** Cmd on a Mac, Ctrl elsewhere. */
    mac: boolean;
    /** The Project the User works in, with how many are in it; null in none. */
    project?: { id: string; name: string; people: number } | null;
    /** The flagged queries of the User, whether or not they work in a Project. */
    flagged?: readonly { id: string; name: string | null }[];
    /** Every Project the User is in. */
    projects?: readonly ProjectItem[];
    /** The ID of the User. */
    me: string;
    /** What the button after the tabs does for the open query, while it is not in the row; null for none. */
    add?: { kind: 'flag' } | { kind: 'add' } | { kind: 'move'; from: string } | null;
    /** The open query may go into a Project: a query the User writes. */
    canAddToProject?: boolean;
    /** The pop-out that is open; the quick window opens them too. */
    pop?: Pop | null;
    onremove: (id: string) => void;
    onmove: (from: number, to: number) => void;
    onadd: () => void;
    /** Work in a Project, or in none. */
    onwork: (id: string | null) => void;
    onnewproject: (fields: { name: string; description: string; putCurrent: boolean }) => Promise<void>;
    onaddtoproject: (fields: { to: string } | { name: string }, queries: string[]) => Promise<void>;
  } = $props();

  const mod = $derived(modLabel(mac));
  const MARKS = { running: 'flags.running', new: 'flags.new', failed: 'flags.failed', broken: 'flags.broken' } as const;
  let dragged = $state<number | null>(null);
  let over = $state<number | null>(null);
  let bar = $state<HTMLElement>();
  let tabs = $state<HTMLElement>();

  // New project: its name, what it is for, and whether the open query goes in.
  let newName = $state('');
  let newWhat = $state('');
  let putCurrent = $state(true);
  // Add to a project: where to, and which queries.
  let addTo = $state<string>('new');
  let addName = $state('');
  let ticked = $state<string[]>([]);
  let busy = $state(false);
  let failed = $state(false);

  const others = $derived(flagged.filter((one) => one.id !== current));

  function open(next: Pop | null): void {
    failed = false;
    if (next === 'newproj') {
      newName = '';
      newWhat = '';
      putCurrent = canAddToProject;
    }
    if (next === 'addp') {
      addTo = projects[0]?.id ?? 'new';
      addName = '';
      ticked = current ? [current] : [];
    }
    pop = pop === next ? null : next;
  }

  function drop(at: number): void {
    if (dragged !== null && dragged !== at) onmove(dragged, at);
    dragged = null;
    over = null;
  }

  function who(members: ProjectItem['members']): string {
    const shape = withWhom(members, me);
    if (shape.kind === 'alone') return t('row.withNobody');
    if (shape.kind === 'named') return t('row.withNames', { names: shape.names.join(t('row.and')) });
    return t('row.withMany', { count: shape.count });
  }

  async function makeProject(): Promise<void> {
    if (!newName.trim() || busy) return;
    busy = true;
    try {
      await onnewproject({ name: newName.trim(), description: newWhat.trim(), putCurrent: putCurrent && canAddToProject });
      pop = null;
    } catch (error) {
      console.error('The project could not be made', error);
      failed = true;
    } finally {
      busy = false;
    }
  }

  async function addToProject(): Promise<void> {
    if (ticked.length === 0 || busy || (addTo === 'new' && !addName.trim())) return;
    busy = true;
    try {
      await onaddtoproject(addTo === 'new' ? { name: addName.trim() } : { to: addTo }, ticked);
      pop = null;
    } catch (error) {
      console.error('The queries could not be added to the project', error);
      failed = true;
    } finally {
      busy = false;
    }
  }

  // The open query in view, also far along the row (DEC-UX-283).
  $effect(() => {
    void current;
    void items.length;
    tabs?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  });

  // A click elsewhere, or Escape, closes a pop-out.
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
    if (project && item.by) parts.push(t('row.by', { name: item.by }));
    if (item.locked) parts.push(t('row.locked'));
    else if (item.mark) parts.push(t(MARKS[item.mark]));
    return parts.join(' · ');
  }
</script>

<nav class="flags" bind:this={bar} aria-label={project ? t('row.label.project', { name: project.name }) : t('flags.label')}>
  <button
    type="button"
    class="switch"
    class:mine={!project}
    aria-haspopup="menu"
    aria-expanded={pop === 'work'}
    title={project ? t('row.switch.project', { name: project.name }) : t('row.switch.flagged.title')}
    onclick={() => open('work')}
  >
    {#if project}
      <Icon name="folders-fill" />
      <span class="clip">{project.name}</span>
      <span class="people" title={t('row.people', { count: project.people })}><Icon name="users" />{project.people}</span>
    {:else}
      <Icon name="flag-fill" />
      <span class="clip">{t('row.switch.flagged')}</span>
    {/if}
    <span class="caret"><Icon name="caret-down" /></span>
  </button>
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
          href={item.locked && project ? projectPath(project.id) : queryPath(item.id)}
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
          aria-label={project ? t('row.remove', { name: item.name ?? '', project: project.name }) : t('flags.unflag', { name: item.name ?? '' })}
          title={project ? t('row.remove.hint', { project: project.name, by: item.by ?? '' }) : t('row.unflag.hint')}
          onclick={() => onremove(item.id)}><Icon name="x" /></button
        >
      </div>
    {/each}
  </div>
  <div class="end">
    {#if add}
      <button
        type="button"
        class="add"
        title={add.kind === 'flag' ? t('flags.add.hint') : add.kind === 'move' ? t('row.move.hint', { from: add.from }) : t('row.add.hint')}
        onclick={onadd}
      >
        <Icon name={add.kind === 'flag' ? 'flag' : 'plus'} />
        <span>{add.kind === 'flag' ? t('flags.add') : t(add.kind === 'move' ? 'row.move' : 'row.add', { project: project?.name ?? '' })}</span>
        {#if keyed(items.length)}<span class="kbd">{mod}{digitOf(items.length)}</span>{/if}
      </button>
    {/if}
    {#if !project && canAddToProject}
      <button type="button" class="add" aria-haspopup="dialog" aria-expanded={pop === 'addp'} title={t('row.addp.hint')} onclick={() => open('addp')}
        ><Icon name="folder-simple-plus" /><span>{t('row.addp')}</span></button
      >
    {/if}
    {#if items.length > 6}
      <button type="button" class="all" aria-haspopup="menu" aria-expanded={pop === 'all'} title={t('row.all.hint')} onclick={() => open('all')}
        ><span>{t('row.all', { count: items.length })}</span><Icon name="caret-down" /></button
      >
    {/if}
  </div>

  {#if pop === 'work'}
    <div class="pop" role="menu" aria-label={t('row.work')}>
      <div class="pop-h">{t('row.work')}</div>
      <button type="button" class="opt" role="menuitemradio" aria-checked={!project} onclick={() => ((pop = null), onwork(null))}>
        <Icon name="flag-fill" />
        <span class="grow"><span class="title">{t('row.work.flagged')}</span><span class="meta">{t('row.work.flagged.meta', { count: flagged.length })}</span></span>
        {#if !project}<span class="check"><Icon name="check" /></span>{/if}
      </button>
      {#each projects as one (one.id)}
        <button type="button" class="opt" role="menuitemradio" aria-checked={project?.id === one.id} onclick={() => ((pop = null), onwork(one.id))}>
          <Icon name="folders-fill" />
          <span class="grow"><span class="title">{one.name}</span><span class="meta">{t('row.queries', { count: one.queries })} · {who(one.members)}</span></span>
          {#if project?.id === one.id}<span class="check"><Icon name="check" /></span>{/if}
        </button>
      {/each}
      <div class="sep"></div>
      <button type="button" class="opt" role="menuitem" onclick={() => open('newproj')}><Icon name="plus" /><span class="grow"><span class="title">{t('row.newProject')}</span></span></button>
      {#if project}
        <a class="opt" role="menuitem" href={projectPath(project.id)} onclick={() => (pop = null)}>
          <Icon name="arrow-square-out" />
          <span class="grow"><span class="title">{t('row.openPage', { name: project.name })}</span><span class="meta">{t('row.openPage.meta')}</span></span>
        </a>
      {/if}
    </div>
  {:else if pop === 'all'}
    <div class="pop end" role="menu" aria-label={t('row.all.hint')}>
      <div class="pop-h">{project ? project.name : t('row.work.flagged')} · {t('row.queries', { count: items.length })}</div>
      {#each items as item, at (item.id)}
        <a class="opt" class:on={item.id === current} role="menuitem" href={item.locked && project ? projectPath(project.id) : queryPath(item.id)} onclick={() => (pop = null)}>
          <span class="kbd" class:none={!keyed(at)}>{mod}{keyed(at) ? digitOf(at) : '0'}</span>
          <span class="grow">
            <span class="title">{item.name ?? '…'}</span>
            {#if project && item.by}
              <span class="meta">{t('row.by', { name: item.by })}{item.locked ? ` · ${t('row.locked')}` : item.mark ? ` · ${t(MARKS[item.mark])}` : ''}</span>
            {:else if item.mark}
              <span class="meta">{t(MARKS[item.mark])}</span>
            {/if}
          </span>
        </a>
      {/each}
      <div class="foot"><span class="meta">{project ? t('row.all.foot.project') : t('row.all.foot')}</span></div>
    </div>
  {:else if pop === 'addp'}
    <div class="pop end" role="dialog" aria-label={t('row.addp')}>
      <div class="pop-h">{t('row.addp')}</div>
      {#each projects as one (one.id)}
        <label class="opt"
          ><input type="radio" name="addp-to" value={one.id} bind:group={addTo} /><span class="grow"
            ><span class="title">{one.name}</span><span class="meta">{t('row.queries', { count: one.queries })} · {who(one.members)}</span></span
          ></label
        >
      {/each}
      <label class="opt"><input type="radio" name="addp-to" value="new" bind:group={addTo} /><span class="grow"><span class="title">{t('row.newProject')}</span></span></label>
      {#if addTo === 'new'}
        <div class="new"><input bind:value={addName} maxlength="80" placeholder={t('row.new.name.placeholder')} aria-label={t('row.new.name.label')} /></div>
      {/if}
      <div class="pop-h spaced">{t('row.addp.queries')}</div>
      {#if current}
        <label class="opt"
          ><input type="checkbox" value={current} bind:group={ticked} /><span class="grow"
            ><span class="title">{currentName ?? '…'}</span><span class="meta">{t('row.addp.open')}</span></span
          ></label
        >
      {/if}
      {#each others as one (one.id)}
        <label class="opt"
          ><input type="checkbox" value={one.id} bind:group={ticked} /><span class="grow"
            ><span class="title">{one.name ?? '…'}</span><span class="meta">{t('row.addp.flagged')}</span></span
          ></label
        >
      {/each}
      <div class="foot">
        <span class="meta">{failed ? t('row.failed') : t('row.addp.foot')}</span>
        <button type="button" class="quiet" onclick={() => (pop = null)}>{t('row.cancel')}</button>
        <button type="button" class="primary" disabled={busy || ticked.length === 0 || (addTo === 'new' && !addName.trim())} onclick={addToProject}
          >{t('row.addp.go', { count: ticked.length })}</button
        >
      </div>
    </div>
  {:else if pop === 'newproj'}
    <div class="pop" role="dialog" aria-label={t('row.newProject')}>
      <div class="pop-h">{t('row.newProject')}</div>
      <div class="fields">
        <label class="field"><span>{t('row.new.name.label')}</span><input bind:value={newName} maxlength="80" placeholder={t('row.new.name.placeholder')} /></label>
        <label class="field"><span>{t('row.new.what')}</span><textarea rows="2" maxlength="500" bind:value={newWhat} placeholder={t('row.new.what.placeholder')}></textarea></label>
      </div>
      {#if canAddToProject && current}
        <label class="opt"
          ><input type="checkbox" bind:checked={putCurrent} /><span class="grow"
            ><span class="title">{t('row.new.put', { name: currentName ?? '…' })}</span><span class="meta">{t('row.addp.open')}</span></span
          ></label
        >
      {/if}
      <div class="foot">
        <span class="meta">{failed ? t('row.failed') : t('row.new.foot')}</span>
        <button type="button" class="quiet" onclick={() => (pop = null)}>{t('row.cancel')}</button>
        <button type="button" class="primary" disabled={busy || !newName.trim()} onclick={makeProject}>{t('row.new.go')}</button>
      </div>
    </div>
  {/if}
</nav>

<style>
  .flags { position: relative; display: flex; align-items: center; gap: 4px; padding: 4px; margin: -12px -14px 14px; border-radius: var(--radius-md); background: var(--surface-sub); min-height: 38px; flex: none; }
  .switch { display: inline-flex; align-items: center; gap: 7px; flex: none; max-width: 240px; border: 0; background: var(--card); color: var(--text-primary); font: var(--weight-medium) var(--text-small) var(--font-family); padding: 6px 8px 6px 9px; border-radius: var(--radius-sm); cursor: pointer; }
  .switch:hover { background: var(--surface-float-hover); }
  .switch.mine { background: none; color: var(--text-secondary); }
  .switch.mine:hover { background: var(--tint-hover); color: var(--text-primary); }
  .clip { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .people { display: inline-flex; align-items: center; gap: 3px; color: var(--text-muted); font-weight: var(--weight-regular); font-size: var(--text-meta); flex: none; }
  .caret { display: inline-flex; color: var(--text-muted); flex: none; font-size: var(--text-meta); }
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
  .add, .all { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; color: var(--text-secondary); font: var(--text-small) var(--font-family); padding: 6px 8px; border-radius: var(--radius-sm); cursor: pointer; flex: none; white-space: nowrap; }
  .all { font-size: var(--text-meta); gap: 5px; }
  .add:hover, .all:hover, .all[aria-expanded='true'], .add[aria-expanded='true'] { background: var(--tint-hover); color: var(--text-primary); }
  .kbd { font-size: var(--text-meta); font-weight: var(--weight-medium); background: var(--card); border-radius: var(--radius-mark); padding: 1px 5px; }
  .pop { position: absolute; top: calc(100% + 6px); left: 4px; z-index: 40; width: 360px; max-height: min(520px, 70vh); overflow: auto; padding: 8px; border-radius: var(--radius-md); background: var(--surface-solid); box-shadow: var(--sheet-shadow); font-size: var(--text-small); }
  .pop.end { left: auto; right: 4px; }
  .pop-h { font-size: var(--text-meta); color: var(--text-muted); margin: 2px 8px 4px; }
  .pop-h.spaced { margin-top: 12px; }
  .opt { display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 8px; border: 0; border-radius: var(--radius-sm); background: none; color: var(--text-primary); font: inherit; text-align: left; cursor: pointer; text-decoration: none; }
  .opt:hover, .opt.on { background: var(--tint-hover); }
  .opt input { accent-color: var(--text-primary); margin: 0; flex: none; }
  .grow { flex: 1; min-width: 0; }
  .grow > span { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .meta { font-size: var(--text-meta); color: var(--text-muted); }
  .opt .kbd { background: var(--tint-hover); }
  .kbd.none { visibility: hidden; }
  .check { margin-left: auto; display: inline-flex; color: var(--text-primary); }
  .sep { height: 1px; background: var(--tint-hover); margin: 6px 4px; }
  .new { display: flex; padding: 4px 8px 2px 34px; }
  .new input, .field input, .field textarea { flex: 1; min-width: 0; width: 100%; box-sizing: border-box; font: inherit; padding: 6px 9px; border-radius: var(--radius-field); border: 1px solid var(--tint-active); background: var(--surface-sub); color: var(--text-primary); }
  .fields { display: grid; gap: 8px; padding: 2px 8px 6px; }
  .field { display: grid; gap: 4px; font-size: var(--text-meta); color: var(--text-secondary); }
  .field textarea { resize: vertical; }
  .foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; padding: 8px 4px 2px; border-top: 1px solid var(--tint-hover); }
  .foot .meta { flex: 1 1 100%; line-height: 1.45; }
  .quiet, .primary { border: 0; border-radius: var(--radius-pill); cursor: pointer; font: var(--weight-medium) var(--text-small) var(--font-family); padding: 7px 14px; }
  .quiet { margin-left: auto; background: none; color: var(--text-secondary); }
  .quiet:hover { background: var(--tint-hover); color: var(--text-primary); }
  .primary { background: var(--text-primary); color: var(--surface-solid); }
  .primary:disabled { opacity: var(--opacity-out-of-focus); cursor: default; }
</style>

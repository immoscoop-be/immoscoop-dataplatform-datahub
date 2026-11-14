<script lang="ts">
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import type { KnownTable } from '../lib/registry.js';

  /**
   * Find a table, for a power user (DEC-UX-224, FR-SR-58): the tables Data Hub knows from the dbt projects it follows,
   * by their name and the words of their description or columns, by layer and by project. A row unfolds to its columns.
   * The ones ticked come as a CTE each at the start of the SQL of this query (DEC-UX-225, FR-SR-59), shown before; a
   * table that is a Resource cannot be ticked, and starts a new query with it, under its own rules (DEC-UX-73).
   */
  let {
    queryName,
    sql,
    find,
    ctesOf,
    onadd,
    onresource,
    onclose,
  }: {
    queryName: string;
    sql: string;
    find: (words: string, filter: { layer?: string; project?: string }) => Promise<KnownTable[]>;
    ctesOf: (sql: string, tables: readonly string[]) => Promise<{ sql: string; ctes: string[] }>;
    /** The SQL with the CTEs of the tables ticked. */
    onadd: (sql: string) => void;
    /** A table that is a Resource: a new query with it. */
    onresource: (table: KnownTable) => void;
    onclose: () => void;
  } = $props();

  const LAYERS = ['', 'source', 'staging', 'intermediate', 'mart'] as const;
  const LAYER_KEYS = { '': 'find.layer.all', source: 'find.layer.source', staging: 'find.layer.staging', intermediate: 'find.layer.intermediate', mart: 'find.layer.mart' } as const;

  let words = $state('');
  let layer = $state<(typeof LAYERS)[number]>('');
  let project = $state('');
  let tables = $state<KnownTable[] | undefined>();
  /** Every project seen, to choose from. */
  let projects = $state<Record<string, string>>({});
  let picked = $state<KnownTable[]>([]);
  let unfolded = $state<string[]>([]);
  let busy = $state(false);
  let failed = $state(false);

  // The tables, once typing pauses.
  let asking = 0;
  $effect(() => {
    const filter = { ...(layer ? { layer } : {}), ...(project ? { project } : {}) };
    const looking = words.trim();
    const asked = ++asking;
    const timer = setTimeout(() => {
      find(looking, filter).then(
        (found) => {
          if (asked !== asking) return;
          tables = found;
          const seen = { ...projects };
          for (const table of found) seen[table.projectId] = table.projectName ?? table.projectId;
          projects = seen;
        },
        (error: unknown) => {
          console.error('The tables Data Hub knows could not be read', error);
          if (asked === asking) tables = [];
        },
      );
    }, 250);
    return () => clearTimeout(timer);
  });

  // The CTEs that come at the start of the SQL.
  let added = $state<{ sql: string; ctes: string[] } | null>(null);
  let adding = 0;
  $effect(() => {
    const keys = picked.map((table) => table.key);
    const asked = ++adding;
    added = null;
    if (keys.length === 0) return;
    ctesOf(sql, keys).then(
      (found) => asked === adding && (added = found),
      (error: unknown) => console.error('The CTEs of the tables could not be written', error),
    );
  });

  const isPicked = (table: KnownTable) => picked.some((entry) => entry.key === table.key);
  function toggle(table: KnownTable, on: boolean): void {
    picked = on ? [...picked, table] : picked.filter((entry) => entry.key !== table.key);
  }
  function unfold(table: KnownTable): void {
    unfolded = unfolded.includes(table.key) ? unfolded.filter((key) => key !== table.key) : [...unfolded, table.key];
  }
  async function add(): Promise<void> {
    busy = true;
    failed = false;
    try {
      onadd(added?.sql ?? (await ctesOf(sql, picked.map((table) => table.key))).sql);
    } catch (error) {
      console.error('The tables could not be added', error);
      failed = true;
    }
    busy = false;
  }
</script>

<Sheet title={t('find.title')} {onclose}>
  {#snippet top()}<div class="meta over"><Icon name="magnifying-glass" />{t('find.over', { name: queryName })}</div>{/snippet}
  <div class="body">
    <p class="why">{t('find.why')}</p>
    <input {...NO_PASSWORD_MANAGER} type="search" data-autofocus class="search" bind:value={words} placeholder={t('find.search')} aria-label={t('find.search')} />
    <div class="filters">
      <div class="layers" role="group" aria-label={t('find.layers')}>
        {#each LAYERS as option (option)}
          <button type="button" class="seg" class:on={layer === option} aria-pressed={layer === option} onclick={() => (layer = option)}>{t(LAYER_KEYS[option])}</button>
        {/each}
      </div>
      <label class="project meta">{t('find.project')}
        <select bind:value={project}>
          <option value="">{t('find.project.all')}</option>
          {#each Object.entries(projects) as [id, name] (id)}<option value={id}>{name}</option>{/each}
        </select>
      </label>
    </div>
    <div class="list">
      {#if tables === undefined}
        <p class="meta none">…</p>
      {:else}
        {#each tables as table (table.key)}
          {@const open = unfolded.includes(table.key)}
          <div class="row" class:on={isPicked(table)}>
            {#if table.resource}
              <span class="mark" title={t('find.resource')}><Icon name="table" /></span>
            {:else}
              <input type="checkbox" checked={isPicked(table)} aria-label={table.name} onchange={(event) => toggle(table, event.currentTarget.checked)} />
            {/if}
            <button type="button" class="open" aria-expanded={open} aria-label={t('find.columns', { name: table.name })} onclick={() => unfold(table)}>
              <span class="caret" class:open><Icon name="caret-right" /></span>
              <span class="name">{table.name}</span>
              <span class="pill">{table.layer}</span>
              <span class="where">{table.projectName ?? table.projectId} · {table.key.split('.').at(-2)}</span>
            </button>
            {#if table.description}<p class="desc" class:open>{table.description}</p>{/if}
            {#if table.resource}
              <div class="resource"><span class="pill strong">{t('find.resource')}</span><button type="button" class="text-link" onclick={() => onresource(table)}>{t('find.startWith')}</button></div>
            {/if}
            {#if open}
              <div class="columns">
                {#each table.columns as column (column.name)}
                  <div class="column">
                    <span class="mono">{column.name}{#if table.partition?.field === column.name}<span class="pill strong">{t('editor.partition')}</span>{/if}</span>
                    <span class="meta">{column.dataType ?? ''}</span>
                    <span class="text">{column.description}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {:else}
          <p class="meta none">{t('find.none')}</p>
        {/each}
      {/if}
    </div>
    {#if picked.length > 0}
      <div class="label">{t('newSet.ctes')}</div>
      <pre class="ctes">{added ? added.ctes.join(',\n\n') : '…'}</pre>
    {/if}
  </div>
  {#snippet foot()}
    {#if failed}<p class="failed" role="alert">{t('find.failed')}</p>{/if}
    <span class="meta stays">{t('find.foot')}</span>
    <Button variant="quiet" onclick={onclose}>{t('newSet.cancel')}</Button>
    <Button disabled={busy || picked.length === 0} onclick={add}><Icon name="plus" />{t('find.add', { count: picked.length })}</Button>
  {/snippet}
</Sheet>

<style>
  .over { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .body { flex: 1; min-height: 0; overflow: auto; padding: 0 2px; }
  .why { font-size: var(--text-small); line-height: 1.55; color: var(--text-secondary); margin: 10px 0 12px; }
  .search { width: 100%; box-sizing: border-box; font: var(--text-small) var(--font-family); color: var(--text-primary); background: var(--surface-sub); border: 0; border-radius: var(--radius-field); padding: 8px 10px; }
  .search:focus-visible { outline: 2px solid var(--text-secondary); }
  .filters { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin: 10px 0 6px; }
  .layers { display: flex; flex-wrap: wrap; gap: 2px; }
  .seg { font: var(--text-small) var(--font-family); color: var(--text-muted); cursor: pointer; padding: 3px 8px; border-radius: var(--radius-pill); border: 0; background: none; }
  .seg:hover { color: var(--text-primary); }
  .seg.on { color: var(--text-primary); font-weight: var(--weight-medium); background: var(--surface-sub); }
  .project select { font: var(--text-meta) var(--font-family); color: var(--text-primary); background: var(--surface-sub); border: 0; border-radius: var(--radius-pill); padding: 4px 8px; margin-left: 4px; }
  .list { display: grid; gap: 2px; }
  .row { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 0 8px; padding: 10px; border-radius: var(--radius-md); }
  .row:hover { background: var(--tint-hover); }
  .row.on { background: var(--surface-sub); }
  .row input { margin: 3px 0 0; accent-color: var(--text-primary); }
  .mark { color: var(--text-secondary); margin-top: 2px; }
  .open { all: unset; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; cursor: pointer; }
  .open:focus-visible { outline: 2px solid var(--text-secondary); outline-offset: 2px; border-radius: var(--radius-sm); }
  .caret { display: inline-flex; font-size: 12px; color: var(--text-muted); transition: transform var(--motion-fold) ease; }
  .caret.open { transform: rotate(90deg); }
  .name { font: var(--text-small) var(--font-mono); color: var(--text-primary); }
  .where { font-size: var(--text-meta); color: var(--text-muted); }
  .pill { font-size: 10px; color: var(--text-secondary); background: var(--tint-hover); padding: 2px 7px; border-radius: var(--radius-pill); }
  .pill.strong { color: var(--text-primary); background: var(--tint-active); margin-left: 6px; }
  .desc { grid-column: 2; margin: 3px 0 0; font-size: var(--text-small); line-height: 1.5; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .desc.open { white-space: normal; }
  .resource { grid-column: 2; display: flex; align-items: center; gap: 8px; margin-top: 5px; font-size: var(--text-meta); }
  .resource .pill.strong { margin-left: 0; }
  .text-link { all: unset; cursor: pointer; color: var(--text-primary); text-decoration: underline; text-underline-offset: 3px; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
  .columns { grid-column: 2; margin: 8px 0 2px; display: grid; gap: 3px; font-size: var(--text-meta); }
  .column { display: grid; grid-template-columns: minmax(130px, max-content) 64px minmax(0, 1fr); gap: 10px; align-items: baseline; }
  .column .mono { font-family: var(--font-mono); color: var(--text-primary); }
  .column .text { color: var(--text-muted); }
  .none { padding: 10px; }
  .label { margin: 12px 0 6px; }
  .ctes { margin: 0; padding: 10px 12px; border-radius: var(--radius-md); background: var(--surface-sub); font: 12px/1.6 var(--font-mono); color: var(--text-secondary); white-space: pre; overflow: auto; max-height: 160px; }
  .stays { flex: 1; }
  .failed { flex: 1 1 100%; margin: 0; font-size: var(--text-small); color: var(--signal-urgent); }
</style>

<script lang="ts">
  import Search from '@datahub/ui/components/Search.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import { when } from '../lib/moment.js';
  import type { QueryItem, Run } from '../lib/query.js';
  import { queryPath, queryRunsPath } from '../lib/routes.js';

  /**
   * The panel of Query (DEC-UX-20): the queries that ran, one item per query (DEC-UX-74), grouped by the
   * day of their last run and searchable, each labelled when it went to the Data Team (DEC-UX-116). The
   * query that is open unfolds to its last runs; a click on one opens it in its history. The Data Team also
   * has All: everyone's queries, with who ran them (DEC-LN-01). A new query is in it at once, as not run yet.
   */
  let {
    queries,
    everyone,
    dataTeam,
    current,
    runs,
    draft,
    onall,
  }: {
    /** The queries of the User; undefined while they come. */
    queries: readonly QueryItem[] | undefined;
    /** Everyone's queries, for the Data Team; undefined until asked. */
    everyone: readonly QueryItem[] | undefined;
    dataTeam: boolean;
    /** The query that is open. */
    current: string | undefined;
    /** The last runs of the query that is open, newest first. */
    runs: readonly Run[] | undefined;
    /** A new query being made, by its name, not run yet. */
    draft: string | null;
    /** Asks for everyone's queries, when the Data Team chooses All. */
    onall: () => void;
  } = $props();

  let search = $state('');
  let unfolded = $state(true);
  let filter = $state<'yours' | 'all'>('yours');
  $effect(() => {
    if (filter === 'all' && everyone === undefined) onall();
  });

  const LOCALES = { nl: 'nl-BE', en: 'en-GB' } as const;
  const shown = $derived(filter === 'all' ? everyone : queries);
  const words = $derived(search.trim().toLowerCase());
  const fits = (item: QueryItem) =>
    !words || [item.name, item.ownerName, ...item.resources.map((resource) => resource.displayName)].some((text) => text.toLowerCase().includes(words));

  /** The day of an item: of its last run, or when it was made. */
  const dayOf = (item: QueryItem) => new Date(item.lastRunAt ?? item.createdAt);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  function dayName(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86_400_000);
    if (sameDay(date, today)) return t('query.today');
    if (sameDay(date, yesterday)) return t('query.yesterday');
    return new Intl.DateTimeFormat(LOCALES[currentLanguage()], { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  }
  const groups = $derived.by(() => {
    const result: { day: string; items: QueryItem[] }[] = [];
    for (const item of (shown ?? []).filter(fits)) {
      const day = dayName(dayOf(item));
      const group = result.at(-1);
      if (group?.day === day) group.items.push(item);
      else result.push({ day, items: [item] });
    }
    return result;
  });

  function meta(item: QueryItem): string {
    const [first, ...more] = item.resources;
    const on = `${first?.displayName ?? ''}${more.length ? ` +${more.length}` : ''}`;
    const when = item.lastRunAt
      ? `${t('query.runs', { count: item.runs })} · ${new Intl.DateTimeFormat(LOCALES[currentLanguage()], { hour: '2-digit', minute: '2-digit' }).format(new Date(item.lastRunAt))}`
      : t('query.notRunYet');
    return [filter === 'all' ? item.ownerName : null, on, when].filter(Boolean).join(' · ');
  }
</script>

<div class="search"><Search bind:value={search} placeholder={t('query.search')} /></div>

{#if dataTeam}
  <div class="filter">
    <Segmented
      options={[
        { value: 'yours', label: t('query.filter.yours') },
        { value: 'all', label: t('query.filter.all') },
      ]}
      bind:value={filter}
      label={t('query.filter')}
      surface="sub"
    />
  </div>
{/if}

<p class="label">{t(filter === 'all' ? 'query.everyone' : 'query.yours')}</p>

{#if draft !== null && filter === 'yours'}
  <div class="item card current draft" aria-current="page">
    <span class="kind"><KindIcon kind="resource" /></span>
    <span class="text"><span class="name">{draft || t('query.new')}</span><span class="meta">{t('query.draft')}</span></span>
  </div>
{/if}

{#each groups as group (group.day)}
  <p class="day">{group.day}</p>
  {#each group.items as item (item.id)}
    {@const open = item.id === current && item.runs > 0 && !!runs?.length}
    <div class="entry">
      <a class="item card" class:current={item.id === current} class:unfolds={open} href={queryPath(item.id)} aria-current={item.id === current ? 'page' : undefined}>
        <span class="kind"><KindIcon kind="resource" /></span>
        <span class="text"><span class="name" title={item.name}>{item.name}</span><span class="meta" title={meta(item)}>{meta(item)}</span></span>
        {#if item.request?.state === 'waiting'}
          <span class="pill urgent">{t('query.toDataTeam')}</span>
        {:else if item.request?.state === 'accepted'}
          <span class="pill">{t('query.label.accepted')}</span>
        {:else if item.kind === 'preview'}
          <span class="pill">{t('query.label.preview')}</span>
        {/if}
      </a>
      {#if open}
        <button type="button" class="unfold" aria-expanded={unfolded} aria-label={t('query.itsRuns')} onclick={() => (unfolded = !unfolded)}><Icon name="caret-down" /></button>
        {#if unfolded}
          <nav class="runs" aria-label={t('query.itsRuns')}>
            {#each (runs ?? []).slice(0, 3) as run, index (run.number)}
              <a class="run" class:on={index === 0} href={queryRunsPath(item.id, run.number)}><span>{t('history.run', { number: run.number })}</span><span class="meta">{when(run.startedAt, currentLanguage())}</span></a>
            {/each}
            <a class="run all" href={queryRunsPath(item.id)}><span>{t('query.allRuns', { count: item.runs })}</span><Icon name="arrow-right" /></a>
          </nav>
        {/if}
      {/if}
    </div>
  {/each}
{/each}

{#if shown && groups.length === 0 && draft === null}
  <p class="meta empty">{t(words ? 'query.noMatch' : filter === 'all' ? 'query.noneAll' : 'query.none')}</p>
{/if}

<style>
  .search { margin: 16px 0 12px; }
  .filter { margin: 2px 0 8px; }
  .label { margin: 4px 4px 8px; font-size: var(--text-meta); color: var(--text-muted); }
  .day { margin: 14px 4px 7px; font-size: var(--text-meta); color: var(--text-muted); }
  .entry { position: relative; margin-bottom: 7px; }
  .item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: var(--radius-md); color: inherit; text-decoration: none; outline: 1px solid transparent; }
  .draft { margin-bottom: 7px; }
  .item.unfolds { padding-right: 40px; }
  .item:hover { outline-color: var(--tint-active); }
  .item.current { outline: 1.5px solid var(--text-muted); }
  .item:focus-visible { outline: 2px solid var(--text-secondary); }
  .kind { display: inline-flex; font-size: 16px; color: var(--text-secondary); }
  .text { flex: 1; min-width: 0; }
  .name { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--text-body); font-weight: var(--weight-medium); }
  .meta { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--text-meta); color: var(--text-muted); }
  .empty { padding: 8px 4px; white-space: normal; }
  .pill { flex: none; font-size: var(--text-meta); color: var(--text-secondary); background: var(--surface-sub); padding: 2px 8px; border-radius: var(--radius-pill); white-space: nowrap; }
  .pill.urgent { color: var(--signal-urgent); }
  .unfold { position: absolute; top: 9px; right: 6px; width: 26px; height: 26px; border: 0; border-radius: var(--radius-sm); background: none; color: var(--text-secondary);
    display: inline-flex; align-items: center; justify-content: center; font-size: 12px; cursor: pointer; }
  .unfold:hover { background: var(--tint-hover); }
  .unfold :global(.icon) { transition: transform var(--motion-fold) ease; }
  .unfold[aria-expanded='false'] :global(.icon) { transform: rotate(-90deg); }
  .runs { display: flex; flex-direction: column; gap: 1px; margin: 4px 0 2px 30px; }
  .run { display: flex; align-items: baseline; gap: 8px; font-size: var(--text-small); color: var(--text-secondary); text-decoration: none; padding: 4px 8px; border-radius: var(--radius-field); }
  .run:hover { background: var(--tint-hover); color: var(--text-primary); }
  .run:focus-visible { outline: 2px solid var(--text-secondary); }
  .run.on { color: var(--text-primary); font-weight: var(--weight-medium); }
  .run .meta { display: inline; font-weight: var(--weight-regular); }
  .run.all { align-items: center; color: var(--text-muted); font-size: var(--text-meta); }
</style>

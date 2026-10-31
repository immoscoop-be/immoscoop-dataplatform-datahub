<script lang="ts">
  import PanelFilter from '@datahub/ui/components/PanelFilter.svelte';
  import Search from '@datahub/ui/components/Search.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import { brokenText } from '../lib/broken.js';
  import { when } from '../lib/moment.js';
  import { isToday, isYesterday, type Period, periodOf, periodsOf } from '../lib/periods.js';
  import { type QueryClient, type QueryDay, type QueryItem, type Run, SHOWN, type Shown } from '../lib/query.js';
  import { lensPath, queryPath, queryRunsPath } from '../lib/routes.js';

  /**
   * The panel of Query (DEC-UX-20): the queries that ran, one item per query (DEC-UX-74), each labelled
   * when it went to the Data Team (DEC-UX-116). They are grouped per day in this week, per week back to
   * the first of last month, then per month, each period with how many it holds; only today is open, and
   * another period reads its queries when it is opened (DEC-UX-139). A search looks through all of them.
   * Previews, the queries of Lenses and hidden queries are left out until the User ticks them in the
   * filter that folds open next to the search; folded, one line says what it adds (DEC-UX-137,
   * DEC-UX-150). The eye on a query hides it for this User alone (DEC-UX-138). The query that is open has an arrow
   * that unfolds its last runs, folded at first (DEC-UX-140). The Data Team also has All: everyone's
   * queries, with who ran them (DEC-LN-01). A new query is in it at once, as not run yet.
   */
  let {
    client,
    dataTeam,
    current,
    runs,
    draft,
    version,
    onhidden,
  }: {
    client: Pick<QueryClient, 'list' | 'days' | 'hide'>;
    dataTeam: boolean;
    /** The query that is open. */
    current: string | undefined;
    /** The last runs of the query that is open, newest first. */
    runs: readonly Run[] | undefined;
    /** A new query being made, by its name, not run yet. */
    draft: string | null;
    /** Grows after a new query, a run or a Request: the panel reads its periods again. */
    version: number;
    /** A query was hidden or shown again from the panel. */
    onhidden?: (id: string, hidden: boolean) => void;
  } = $props();

  /** How long typing pauses before the search asks for the queries. */
  const PAUSE = 250;
  const LOCALES = { nl: 'nl-BE', en: 'en-GB' } as const;
  const KINDS: Record<Shown, { name: string; detail: string }> = {
    previews: { name: 'query.show.previews', detail: 'query.show.previews.detail' },
    lenses: { name: 'query.show.lenses', detail: 'query.show.lenses.detail' },
    hidden: { name: 'query.show.hidden', detail: 'query.show.hidden.detail' },
  };

  let search = $state('');
  let unfolded = $state(false);
  let scope = $state<'yours' | 'all'>('yours');
  let show = $state<Shown[]>([]);
  /** How many queries each day holds: undefined while they come, null when they could not be read. */
  let days = $state<QueryDay[] | null | undefined>();
  /** The queries of the periods read so far, by period; null when they could not be read. */
  let loaded = $state<Record<string, QueryItem[] | null>>({});
  /** The periods the User opened or folded; today is open until folded. */
  let opened = $state<Record<string, boolean>>({});
  /** What the search found, for these words. */
  let found = $state<{ words: string; items: QueryItem[] | null } | undefined>();
  /** Grows when a query is hidden or shown again here, to read the periods again. */
  let changed = $state(0);

  const all = $derived(scope === 'all');
  const shown = $derived(new Set(show));
  const words = $derived(search.trim().toLowerCase());
  const periods = $derived(days ? periodsOf(days, shown) : []);
  const totals = $derived(
    Object.fromEntries(SHOWN.map((kind) => [kind, (days ?? []).reduce((sum, day) => sum + day[kind], 0)])) as Record<Shown, number>,
  );
  const isOpen = (period: Period) => opened[period.key] ?? isToday(period);

  // The counts per day, again when the scope changes, after a run, or after hiding.
  $effect(() => {
    const asked = { all, version, changed };
    days = undefined;
    loaded = {};
    client.days(asked.all).then(
      (found) => {
        if (asked.all === all && asked.version === version && asked.changed === changed) days = found;
      },
      (error: unknown) => {
        console.error('The queries could not be counted', error);
        days = null;
      },
    );
  });

  // What the chips add changes what each period holds: they are read again.
  $effect(() => {
    void show;
    loaded = {};
  });

  // A period is read once it is open.
  $effect(() => {
    for (const period of periods) {
      if (!isOpen(period) || period.key in loaded) continue;
      loaded[period.key] = [];
      const key = period.key;
      const asked = { all, show: [...show] };
      client.list(asked.all, { from: period.from.toISOString(), to: period.to.toISOString(), show: asked.show }).then(
        (items) => {
          if (asked.all === all && asked.show.join() === show.join()) loaded[key] = items;
        },
        (error: unknown) => {
          console.error('The queries of a period could not be read', error);
          loaded[key] = null;
        },
      );
    }
  });

  // The search looks through every period, once typing pauses.
  $effect(() => {
    const asked = { words, all, show: [...show], version, changed };
    if (!asked.words) {
      found = undefined;
      return;
    }
    const timer = setTimeout(() => {
      client.list(asked.all, { q: asked.words, show: asked.show }).then(
        (items) => {
          if (asked.words === words && asked.all === all) found = { words: asked.words, items };
        },
        () => {
          if (asked.words === words) found = { words: asked.words, items: null };
        },
      );
    }, PAUSE);
    return () => clearTimeout(timer);
  });

  /** What the search found, in the periods they belong to, all open. */
  const foundGroups = $derived.by(() => {
    if (!found?.items) return [];
    const now = new Date();
    const groups = new Map<string, { period: Period; items: QueryItem[] }>();
    for (const item of found.items) {
      const period = periodOf(new Date(item.lastRunAt ?? item.createdAt), now);
      const group = groups.get(period.key) ?? { period: { ...period, count: 0 }, items: [] };
      group.items.push(item);
      group.period.count += 1;
      groups.set(period.key, group);
    }
    return [...groups.values()];
  });

  function label(period: Period): string {
    const locale = LOCALES[currentLanguage()];
    if (isToday(period)) return t('query.today');
    if (isYesterday(period)) return t('query.yesterday');
    if (period.kind === 'day') return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(period.from);
    if (period.kind === 'week') {
      const last = new Date(period.to.getFullYear(), period.to.getMonth(), period.to.getDate() - 1);
      return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).formatRange(period.from, last);
    }
    const thisYear = period.from.getFullYear() === new Date().getFullYear();
    return new Intl.DateTimeFormat(locale, { month: 'long', ...(thisYear ? {} : { year: 'numeric' }) }).format(period.from);
  }

  function meta(item: QueryItem): string {
    const [first, ...more] = item.resources;
    // The runs of a Lens are on the Lens, which hides what it reads beneath (FR-LE-14).
    const on = item.kind === 'lens' ? t('query.label.lens') : `${first?.displayName ?? ''}${more.length ? ` +${more.length}` : ''}`;
    const ran = item.lastRunAt
      ? `${t('query.runs', { count: item.runs })} · ${new Intl.DateTimeFormat(LOCALES[currentLanguage()], { hour: '2-digit', minute: '2-digit' }).format(new Date(item.lastRunAt))}`
      : t('query.notRunYet');
    return [all ? item.ownerName : null, on, ran].filter(Boolean).join(' · ');
  }

  async function hide(item: QueryItem) {
    const hidden = !item.hidden;
    try {
      await client.hide(item.id, hidden);
      changed += 1;
      onhidden?.(item.id, hidden);
    } catch (error) {
      console.error('The query could not be hidden', error);
    }
  }
</script>

{#snippet entry(item: QueryItem)}
  {@const open = item.id === current && item.runs > 0 && !!runs?.length && item.kind !== 'lens'}
  <div class="entry" class:hidden={item.hidden}>
    <a
      class="item card"
      class:current={item.id === current}
      class:unfolds={open}
      href={item.kind === 'lens' && item.lensOf ? lensPath(item.lensOf) : queryPath(item.id)}
      aria-current={item.id === current ? 'page' : undefined}
    >
      <span class="kind"><KindIcon kind={item.kind === 'lens' ? 'lens' : 'resource'} broken={brokenText(item.broken ?? null)} /></span>
      <span class="text"><span class="name" title={item.name}>{item.name}</span><span class="meta" title={meta(item)}>{meta(item)}</span></span>
      {#if item.request?.state === 'waiting'}
        <span class="pill urgent">{t('query.toDataTeam')}</span>
      {:else if item.request?.state === 'accepted'}
        <span class="pill">{t('query.label.accepted')}</span>
      {:else if item.kind === 'preview'}
        <span class="pill">{t('query.label.preview')}</span>
      {/if}
    </a>
    <span class="buttons">
      <button type="button" class="eye" aria-label={t(item.hidden ? 'query.unhide' : 'query.hide', { name: item.name })} title={t(item.hidden ? 'query.unhide.hint' : 'query.hide.hint')} onclick={() => hide(item)}
        ><Icon name={item.hidden ? 'eye' : 'eye-slash-fill'} /></button
      >
      {#if open}
        <button type="button" class="unfold" aria-expanded={unfolded} aria-label={t('query.itsRuns')} onclick={() => (unfolded = !unfolded)}><Icon name="caret-down" /></button>
      {/if}
    </span>
    {#if open && unfolded}
      <nav class="runs" aria-label={t('query.itsRuns')}>
        {#each (runs ?? []).slice(0, 3) as run, index (run.number)}
          <a class="run" class:on={index === 0} href={queryRunsPath(item.id, run.number)}><span>{t('history.run', { number: run.number })}</span><span class="meta">{when(run.startedAt, currentLanguage())}</span></a>
        {/each}
        <a class="run all" href={queryRunsPath(item.id)}><span>{t('query.allRuns', { count: item.runs })}</span><Icon name="arrow-right" /></a>
      </nav>
    {/if}
  </div>
{/snippet}

<!-- What the panel also shows folds open next to the search, as a small form (DEC-UX-150). -->
<PanelFilter
  id="query-show"
  label={t('query.show.toggle')}
  legend={t('query.show')}
  kinds={SHOWN.map((kind) => ({ value: kind, name: t(KINDS[kind].name), detail: t(KINDS[kind].detail), count: days ? totals[kind] : undefined }))}
  bind:chosen={show}
  defaults={[]}
>
  <Search bind:value={search} placeholder={t('query.search')} />
</PanelFilter>

{#if dataTeam}
  <div class="filter">
    <Segmented
      options={[
        { value: 'yours', label: t('query.filter.yours') },
        { value: 'all', label: t('query.filter.all') },
      ]}
      bind:value={scope}
      label={t('query.filter')}
      surface="sub"
    />
  </div>
{/if}

<p class="label">{t(all ? 'query.everyone' : 'query.yours')}</p>

{#if draft !== null && !all}
  <div class="item card current draft" aria-current="page">
    <span class="kind"><KindIcon kind="resource" /></span>
    <span class="text"><span class="name">{draft || t('query.new')}</span><span class="meta">{t('query.draft')}</span></span>
  </div>
{/if}

{#if words}
  {#if found?.words === words && found.items === null}
    <p class="meta empty" role="alert">{t('query.failed.list')}</p>
  {:else if found?.words === words && foundGroups.length === 0}
    <p class="meta empty">{t('query.noMatch')}</p>
  {/if}
  {#each foundGroups as group (group.period.key)}
    <p class="period found"><span>{label(group.period)}</span><span class="count">{group.period.count}</span></p>
    {#each group.items as item (item.id)}{@render entry(item)}{/each}
  {/each}
{:else if days === null}
  <p class="meta empty" role="alert">{t('query.failed.list')}</p>
{:else if days}
  {#each periods as period (period.key)}
    {@const open = isOpen(period)}
    {@const items = loaded[period.key]}
    <button type="button" class="period" aria-expanded={open} onclick={() => (opened = { ...opened, [period.key]: !open })}>
      <Icon name="caret-down" /><span>{label(period)}</span><span class="count">{period.count}</span>
    </button>
    {#if open}
      {#if items === null}
        <p class="meta empty" role="alert">{t('query.failed.list')}</p>
      {:else if items && items.length > 0}
        {#each items as item (item.id)}{@render entry(item)}{/each}
      {:else}
        <p class="meta empty">…</p>
      {/if}
    {/if}
  {/each}
  {#if periods.length === 0 && draft === null}
    <p class="meta empty">{t(all ? 'query.noneAll' : 'query.none')}</p>
  {/if}
{/if}

<style>
  .filter { margin: 2px 0 8px; }
  .count { color: var(--text-muted); }
  .label { margin: 4px 4px 8px; font-size: var(--text-meta); color: var(--text-muted); }
  .period { all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; gap: 6px; width: 100%; padding: 8px 4px; font-size: var(--text-meta); color: var(--text-muted); border-radius: var(--radius-sm); }
  .period:hover { color: var(--text-primary); }
  .period:focus-visible { outline: 2px solid var(--text-secondary); }
  .period :global(.icon) { font-size: 11px; transition: transform var(--motion-fold) ease; }
  .period[aria-expanded='false'] :global(.icon) { transform: rotate(-90deg); }
  .period.found { cursor: default; margin: 0; }
  .entry { position: relative; margin-bottom: 7px; }
  .item { display: flex; align-items: center; gap: 10px; padding: 9px 40px 9px 12px; border-radius: var(--radius-md); color: inherit; text-decoration: none; outline: 1px solid transparent; }
  .draft { margin-bottom: 7px; padding-right: 12px; }
  .item.unfolds { padding-right: 68px; }
  .item:hover { outline-color: var(--tint-active); }
  .item.current { outline: 1.5px solid var(--text-muted); }
  .item:focus-visible { outline: 2px solid var(--text-secondary); }
  .hidden .item { opacity: .6; }
  .kind { display: inline-flex; font-size: 16px; color: var(--text-secondary); }
  .text { flex: 1; min-width: 0; }
  .name { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--text-body); font-weight: var(--weight-medium); }
  .meta { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--text-meta); color: var(--text-muted); }
  .empty { padding: 8px 4px; white-space: normal; }
  .pill { flex: none; font-size: var(--text-meta); color: var(--text-secondary); background: var(--surface-sub); padding: 2px 8px; border-radius: var(--radius-pill); white-space: nowrap; }
  .pill.urgent { color: var(--signal-urgent); }
  .buttons { position: absolute; top: 9px; right: 6px; display: flex; gap: 2px; }
  .eye, .unfold { width: 26px; height: 26px; border: 0; border-radius: var(--radius-sm); background: none; color: var(--text-secondary);
    display: inline-flex; align-items: center; justify-content: center; font-size: 13px; cursor: pointer; }
  .eye:hover, .unfold:hover { background: var(--tint-hover); }
  /* The eye shows when the pointer is on a query, or on a hidden one, to show it again (DEC-UX-138). */
  .eye { opacity: 0; }
  .entry:hover .eye, .eye:focus-visible, .hidden .eye { opacity: 1; }
  .unfold { font-size: 12px; }
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

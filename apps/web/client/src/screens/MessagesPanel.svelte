<script lang="ts">
  import { untrack } from 'svelte';
  import Search from '@datahub/ui/components/Search.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import { command, useScreenCommands } from '../lib/commands.svelte.js';
  import { type Counts, type Filter, type FilterKind, type FilterOn, MARK_TEXTS, MESSAGE_MARKS, type View, VIEW_TEXTS } from '../lib/messages.js';
  import { MARK_ICONS } from './MarksButton.svelte';

  /**
   * The panel of the Message Centre (FR-CV-06, DEC-UX-29): a search, then the marks of the User, each only while a
   * Message holds it, with how many (DEC-UX-360); the views, For you first; the kinds, Questions, Remarks, Signals,
   * Requests and what Data Hub tells; and the kinds of object, with a line between the groups (DEC-UX-361). A kind or a
   * kind of object chosen again lets go of it. A mark opened stays in the panel, at 0, until another view is chosen
   * (DEC-UX-366).
   */
  let {
    filter,
    counts,
    onfilter,
  }: {
    filter: Filter;
    /** The counts of the view, once read. */
    counts: Counts | undefined;
    onfilter: (filter: Filter) => void;
  } = $props();

  // The search starts as the panel was left; the User's typing goes from there.
  let search = $state(untrack(() => filter.search ?? ''));
  // The search is sent a moment after the User stops typing.
  $effect(() => {
    const words = search.trim();
    if (words === (filter.search ?? '')) return;
    const timer = setTimeout(() => onfilter({ ...filter, search: words || undefined }), 350);
    return () => clearTimeout(timer);
  });

  const VIEWS: readonly { view: View; icon: IconName; count?: 'forYou' | 'unread' | 'written' }[] = [
    { view: 'forYou', icon: 'tray', count: 'forYou' },
    { view: 'unread', icon: 'circle', count: 'unread' },
    { view: 'written', icon: 'pencil-simple-line', count: 'written' },
    { view: 'everything', icon: 'globe-simple' },
  ];
  /** The kinds by their names, which are never translated; what Data Hub tells is a sentence. */
  const KINDS: readonly { kind: FilterKind; icon: IconName; name?: string }[] = [
    { kind: 'question', icon: 'question', name: 'Questions' },
    { kind: 'remark', icon: 'chat-text', name: 'Remarks' },
    { kind: 'signal', icon: 'warning-diamond', name: 'Signals' },
    { kind: 'request', icon: 'seal-question', name: 'Requests' },
    { kind: 'dataHub', icon: 'bell-simple' },
  ];
  /** The marks shown: each while a Message holds it, or while it is the view (DEC-UX-360, DEC-UX-366). */
  const marks = $derived(MESSAGE_MARKS.filter((mark) => (counts?.marks?.[mark] ?? 0) > 0 || filter.mark === mark));
  // In the quick window: each mark shown and each other view, with how many it holds, as a click on it in the panel (DEC-UX-255).
  useScreenCommands(() => ({
    group: 'Messages',
    rows: [
      ...marks
        .filter((mark) => mark !== filter.mark)
        .map((mark) =>
          command(`messages:markView:${mark}`, MARK_ICONS[mark].on, t('quick.messages.view', { name: t(MARK_TEXTS[mark].name) }), () => onfilter({ ...filter, mark }), {
            meta: String(counts?.marks?.[mark] ?? 0),
            words: t('quick.messages.view.words'),
          }),
        ),
      ...VIEWS.filter((item) => item.view !== filter.view || filter.mark).map((item) =>
        command(`messages:view:${item.view}`, item.icon, t('quick.messages.view', { name: t(VIEW_TEXTS[item.view].name) }), () => onfilter({ ...filter, view: item.view, mark: undefined }), {
          ...(item.count && counts ? { meta: String(counts[item.count]) } : {}),
          words: t('quick.messages.view.words'),
        }),
      ),
    ],
  }));
  const OBJECTS: readonly { on: FilterOn; icon: IconName; name?: string }[] = [
    { on: 'collection', icon: 'stack', name: 'Collections' },
    { on: 'resource', icon: 'table', name: 'Resources' },
    { on: 'lens', icon: 'aperture', name: 'Lenses' },
    { on: 'query', icon: 'terminal-window' },
  ];
</script>

<div class="search"><Search bind:value={search} placeholder={t('messages.search')} /></div>
<nav aria-label={t('section.messages')}>
  {#if marks.length > 0}
    {#each marks as mark (mark)}
      {@const count = counts?.marks?.[mark] ?? 0}
      <button type="button" class="filter" class:on={filter.mark === mark} class:zero={count === 0} aria-current={filter.mark === mark ? 'true' : undefined} onclick={() => onfilter({ ...filter, mark })}>
        <Icon name={MARK_ICONS[mark].on} /><span>{t(MARK_TEXTS[mark].name)}</span><span class="count">{count}</span>
      </button>
    {/each}
    <hr />
  {/if}
  {#each VIEWS as item (item.view)}
    {@const on = !filter.mark && filter.view === item.view}
    <button type="button" class="filter" class:on aria-current={on ? 'true' : undefined} onclick={() => onfilter({ ...filter, view: item.view, mark: undefined })}>
      <Icon name={item.icon} /><span>{t(VIEW_TEXTS[item.view].name)}</span>{#if item.count && counts}<span class="count">{counts[item.count]}</span>{:else if item.count}<span class="count"><Loading inline /></span>{/if}
    </button>
  {/each}
  <hr />
  <div class="label">{t('messages.kind')}</div>
  {#each KINDS as item (item.kind)}
    <button
      type="button"
      class="filter"
      class:on={filter.kind === item.kind}
      aria-pressed={filter.kind === item.kind}
      onclick={() => onfilter({ ...filter, kind: filter.kind === item.kind ? undefined : item.kind })}
    >
      <Icon name={item.icon} /><span>{item.name ?? t('messages.fromDataHub')}</span>{#if counts}<span class="count">{counts.kinds[item.kind]}</span>{/if}
    </button>
  {/each}
  <hr />
  <div class="label">{t('messages.on')}</div>
  {#each OBJECTS as item (item.on)}
    <button type="button" class="filter" class:on={filter.on === item.on} aria-pressed={filter.on === item.on} onclick={() => onfilter({ ...filter, on: filter.on === item.on ? undefined : item.on })}>
      <Icon name={item.icon} /><span>{item.name ?? t('messages.on.query')}</span>{#if counts}<span class="count">{counts.on[item.on]}</span>{/if}
    </button>
  {/each}
</nav>

<style>
  .search { margin: 16px 0 10px; }
  nav { display: flex; flex-direction: column; gap: 1px; }
  .filter { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: var(--radius-md); font-size: var(--text-small); color: var(--text-secondary); cursor: pointer; }
  .filter:hover { background: var(--tint-hover); color: var(--text-primary); }
  .filter:focus-visible { outline: 2px solid var(--text-secondary); }
  .filter.on { background: var(--card); color: var(--text-primary); font-weight: var(--weight-medium); }
  .filter :global(.icon) { font-size: 16px; flex: none; }
  .filter span:first-of-type { flex: 1; }
  .count { font-size: var(--text-meta); color: var(--text-muted); font-weight: var(--weight-regular); }
  .label { margin: 10px 10px 4px; font-size: var(--text-meta); font-weight: var(--weight-medium); color: var(--text-muted); }
  .zero { color: var(--text-muted); }
  /* A thin line between the groups: under the marks, and above Kind and On (DEC-UX-361). */
  hr { width: calc(100% - 20px); height: 1px; margin: 8px 10px 2px; border: 0; background: var(--tint-active); }
</style>

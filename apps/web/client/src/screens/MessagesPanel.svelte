<script lang="ts">
  import { untrack } from 'svelte';
  import Search from '@datahub/ui/components/Search.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import { type Counts, type Filter, type FilterKind, type FilterOn, type View, VIEW_TEXTS } from '../lib/messages.js';

  /**
   * The panel of the Message Centre (FR-CV-06, DEC-UX-29): a search, then the views, For you first;
   * the kinds, Questions, Remarks, Signals, Requests and what Data Hub tells; and the kinds of object.
   * A kind or a kind of object chosen again lets go of it.
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
  const OBJECTS: readonly { on: FilterOn; icon: IconName; name?: string }[] = [
    { on: 'collection', icon: 'stack', name: 'Collections' },
    { on: 'resource', icon: 'table', name: 'Resources' },
    { on: 'lens', icon: 'aperture', name: 'Lenses' },
    { on: 'query', icon: 'terminal-window' },
  ];
</script>

<div class="search"><Search bind:value={search} placeholder={t('messages.search')} /></div>
<nav aria-label={t('section.messages')}>
  {#each VIEWS as item (item.view)}
    <button type="button" class="filter" class:on={filter.view === item.view} aria-current={filter.view === item.view ? 'true' : undefined} onclick={() => onfilter({ ...filter, view: item.view })}>
      <Icon name={item.icon} /><span>{t(VIEW_TEXTS[item.view].name)}</span>{#if item.count && counts}<span class="count">{counts[item.count]}</span>{/if}
    </button>
  {/each}
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
  .label { margin: 14px 10px 4px; font-size: var(--text-meta); font-weight: var(--weight-medium); color: var(--text-muted); }
</style>

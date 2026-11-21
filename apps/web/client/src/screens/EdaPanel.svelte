<script lang="ts">
  import type { EdaListItem } from '@datahub/contracts/eda';
  import Search from '@datahub/ui/components/Search.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import type { Collection } from '../lib/catalogue.js';
  import type { EdaList } from '../lib/eda.js';
  import { edaPath, resourcePath } from '../lib/routes.js';

  /**
   * The panel of the section EDA, its index (FR-ED-03, DEC-ED-15): by Collection, the Resources the User sees with an
   * EDA, each with the dot of where it stands, In progress or Explored, and how many needed EDA-Probes it still has to
   * go; under them, Ready for an EDA, the Resources at 3 · Confirmed or above without one, as eda lists them. A
   * Resource opens its EDA; one ready for an EDA opens its Maturity, where Start the EDA is.
   */
  let {
    list,
    collections,
    current,
  }: {
    /** What eda lists: undefined while it comes, null when eda did not answer. */
    list: EdaList | null | undefined;
    /** The Collections the User sees, in the order of their panel, which the EDAs follow. */
    collections: readonly Collection[] | undefined;
    /** The Resource whose EDA is open. */
    current: string | undefined;
  } = $props();

  let search = $state('');
  const words = $derived(search.trim().toLocaleLowerCase());
  const matches = (name: string) => words === '' || name.toLocaleLowerCase().includes(words);

  /** The EDAs by Collection, in the order of the Collections, those without one last. */
  const grouped = $derived.by(() => {
    const groups = new Map<string, { name: string; items: EdaListItem[] }>();
    for (const eda of list?.edas ?? []) {
      if (!matches(eda.resource.displayName)) continue;
      const key = eda.resource.collection?.id ?? '';
      const group = groups.get(key) ?? { name: eda.resource.collection?.name ?? t('eda.panel.noCollection'), items: [] };
      group.items.push(eda);
      groups.set(key, group);
    }
    const order = (collections ?? []).map((collection) => collection.id);
    const rank = (key: string) => (key === '' ? Number.MAX_SAFE_INTEGER : order.indexOf(key) === -1 ? order.length : order.indexOf(key));
    return [...groups.entries()]
      .sort(([a, one], [b, other]) => rank(a) - rank(b) || one.name.localeCompare(other.name))
      .map(([key, group]) => ({ key, ...group, items: group.items.sort((a, b) => a.resource.displayName.localeCompare(b.resource.displayName)) }));
  });

  /** The Resources the User sees at 3 · Confirmed or above without an EDA, ready for one. */
  const ready = $derived((list?.ready ?? []).filter((item) => matches(item.resource.displayName)).sort((a, b) => a.resource.displayName.localeCompare(b.resource.displayName)));
</script>

<div class="search"><Search bind:value={search} placeholder={t('eda.panel.search')} /></div>
{#if list === undefined}
  <Loading />
{:else if list === null}
  <p class="meta failed">{t('eda.panel.failed')}</p>
{:else}
  <nav aria-label="EDA">
    {#each grouped as group (group.key)}
      <div class="panel-label">{group.name}</div>
      {#each group.items as eda (eda.resource.id)}
        {@const left = eda.needed.total - eda.needed.complete}
        <a class="item" class:on={eda.resource.id === current} href={edaPath(eda.resource.id)} aria-current={eda.resource.id === current ? 'page' : undefined}>
          <span class="dot {eda.status}" role="img" aria-label={t(eda.status === 'explored' ? 'eda.status.explored' : 'eda.status.inProgress')}></span>
          <span class="name" title={eda.resource.displayName}>{eda.resource.displayName}</span>
          {#if eda.status === 'inProgress' && left > 0}<span class="count" title={t('eda.panel.toGo.title', { count: left })}>{t('eda.panel.toGo', { count: left })}</span>{/if}
        </a>
      {/each}
    {/each}
    {#if grouped.length === 0 && words === ''}
      <p class="meta none">{t('eda.panel.none')}</p>
    {/if}
    {#if ready.length > 0}
      <div class="panel-label">{t('eda.panel.ready')}</div>
      {#each ready as { resource } (resource.id)}
        <a class="item ready" href={resourcePath(resource.id, 'maturity')} title={t('eda.panel.ready.title', { collection: resource.collection?.name ?? t('eda.panel.noCollection') })}>
          <Icon name="plus-circle" /><span class="name">{resource.displayName}</span>
        </a>
      {/each}
    {/if}
  </nav>
{/if}

<style>
  .search { margin-top: 12px; }
  nav { display: flex; flex-direction: column; gap: 2px; }
  .panel-label { font-size: var(--text-meta); color: var(--text-muted); margin: 18px 4px 8px; }
  .item { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: var(--radius-md); font-size: var(--text-small); color: var(--text-secondary); text-decoration: none; min-width: 0; }
  .item:hover { background: var(--tint-hover); color: var(--text-primary); }
  .item:focus-visible { outline: 2px solid var(--text-secondary); }
  .item.on { background: var(--card); color: var(--text-primary); font-weight: var(--weight-medium); }
  .name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .dot.inProgress { outline: 1.5px dashed var(--text-muted); outline-offset: -1.5px; }
  .dot.explored { outline: 1.5px solid var(--text-muted); outline-offset: -1.5px; }
  .count { flex: none; font-size: var(--text-meta); font-weight: var(--weight-regular); color: var(--text-muted); }
  .ready { color: var(--text-muted); }
  .ready :global(.icon) { flex: none; font-size: 14px; }
  .failed, .none { margin: 18px 4px 0; line-height: 1.5; }
</style>

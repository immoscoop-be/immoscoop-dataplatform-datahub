<script lang="ts">
  import ListItem from '@datahub/ui/components/ListItem.svelte';
  import Search from '@datahub/ui/components/Search.svelte';
  import TreeGroup from '@datahub/ui/components/TreeGroup.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import CollectionIcon from '@datahub/ui/marks/CollectionIcon.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import type { Collection, Resource } from '../lib/catalogue.js';
  import type { LensItem } from '../lib/query.js';
  import { collectionPath, lensPath, resourcePath } from '../lib/routes.js';

  /**
   * The panel of Collections, the index of the section (What is in the panel): every Collection the
   * User sees, All or Yours (DEC-UX-87), each unfolding to its Resources (FR-CO-18), then its Lenses,
   * without a label of their own (FR-CO-36). For the Data Team, "Without a Collection" is on top
   * (DEC-UX-16). Search filters the Collections, their Resources and their Lenses together (FR-CO-24).
   */
  let {
    collections,
    lenses = [],
    waiting,
    currentCollection,
    currentResource,
    currentLens,
    groups,
  }: {
    collections: readonly Collection[] | undefined;
    /** The Lenses the User sees, each in its Collection. */
    lenses?: readonly LensItem[] | undefined;
    waiting: readonly Resource[] | undefined;
    /** The Collection whose page is open, or that holds the Resource whose page is open. */
    currentCollection: string | undefined;
    currentResource: string | undefined;
    currentLens?: string | undefined;
    /** The fixed IDs of the groups of the User: their Collections are theirs. */
    groups: readonly string[];
  } = $props();

  /** How many items an unfolded Collection shows before "Show all" (FR-CO-23). */
  const FIRST = 8;

  let query = $state('');
  let filter: 'all' | 'yours' = $state('all');
  /** Which Collections the User unfolded; folded unless they did (DEC-UX-13). */
  let unfolded: Record<string, boolean> = $state({});
  let waitingOpen = $state(true);
  let all: Record<string, boolean> = $state({});
  let allLenses: Record<string, boolean> = $state({});

  // Opening a Collection, or a Resource in it, unfolds it in the panel (FR-CO-19, FR-CO-25).
  $effect(() => {
    if (currentCollection) {
      unfolded[currentCollection] = true;
    }
  });

  const words = $derived(query.trim().toLowerCase());
  const fits = (name: string) => name.toLowerCase().includes(words);
  const mine = (collection: Collection) => groups.includes(collection.ownerUnit.id);

  interface Shown {
    collection: Collection;
    /** Its items as the search leaves them: all of them, or only those that match. */
    items: Collection['resources'];
    lensItems: LensItem[];
    /** Unfolded by the search, to show what matches. */
    found: boolean;
  }
  const lensesOf = (collection: Collection) => (lenses ?? []).filter((lens) => lens.collectionId === collection.id).toSorted((a, b) => a.name.localeCompare(b.name));
  const shown: Shown[] = $derived(
    (collections ?? [])
      .filter((collection) => filter === 'all' || mine(collection))
      .flatMap((collection): Shown[] => {
        if (!words || fits(collection.name)) {
          return [{ collection, items: collection.resources, lensItems: lensesOf(collection), found: false }];
        }
        const items = collection.resources.filter((item) => fits(item.displayName));
        const lensItems = lensesOf(collection).filter((lens) => fits(lens.name));
        return items.length + lensItems.length > 0 ? [{ collection, items, lensItems, found: true }] : [];
      }),
  );
  const waitingShown = $derived((waiting ?? []).filter((resource) => !words || fits(resource.displayName)));
</script>

<div class="search"><Search bind:value={query} placeholder={t('collections.search')} /></div>

{#if waiting && waitingShown.length > 0}
  <TreeGroup icon="tray" name={t('collections.unassigned')} urgent bind:open={() => waitingOpen || Boolean(words), (open) => (waitingOpen = open)}>
    {#snippet meta()}<Chip variant="urgent">{waiting.length}</Chip>{t('collections.unassigned.meta')}{/snippet}
    {#each waitingShown as resource (resource.id)}
      <ListItem href={resourcePath(resource.id)} name={resource.displayName} level={resource.level} current={resource.id === currentResource} />
    {/each}
  </TreeGroup>
{/if}

<div class="filter">
  <Segmented
    options={[
      { value: 'all', label: t('collections.filter.all') },
      { value: 'yours', label: t('collections.filter.yours') },
    ]}
    bind:value={filter}
    label={t('collections.filter')}
    surface="sub"
  />
</div>

{#each shown as { collection, items, lensItems, found } (collection.id)}
  {@const first = all[collection.id] || found ? items : items.slice(0, FIRST)}
  {@const firstLenses = allLenses[collection.id] || found ? lensItems : lensItems.slice(0, FIRST)}
  <TreeGroup
    href={collectionPath(collection.id)}
    name={collection.name}
    current={collection.id === currentCollection}
    bind:open={() => found || (unfolded[collection.id] ?? false), (open) => (unfolded[collection.id] = open)}
  >
    {#snippet mark()}<CollectionIcon name={collection.icon} />{/snippet}
    {#snippet meta()}
      {t('collections.count', { count: collection.resources.length })}
      {#if mine(collection)}
        · <Icon name={collection.visibility === 'public' ? 'globe-simple-fill' : 'lock-simple-fill'} />{t(
          collection.visibility === 'public' ? 'collections.public' : 'collections.private',
        )}
      {/if}
    {/snippet}
    {#each first as item (item.id)}
      <ListItem href={resourcePath(item.id)} name={item.displayName} level={item.level} current={item.id === currentResource} published={item.published} deprecated={item.deprecated} />
    {/each}
    {#if first.length < items.length}
      <button type="button" class="more" onclick={() => (all[collection.id] = true)}>{t('collections.showAll', { count: items.length })}</button>
    {/if}
    {#each firstLenses as lens (lens.id)}
      <ListItem href={lensPath(lens.id)} kind="lens" name={lens.name} level={lens.level} current={lens.id === currentLens} published={lens.state === 'published'} />
    {/each}
    {#if firstLenses.length < lensItems.length}
      <button type="button" class="more" onclick={() => (allLenses[collection.id] = true)}>{t('collections.showAll', { count: lensItems.length })}</button>
    {/if}
  </TreeGroup>
{/each}

{#if collections && words && shown.length === 0 && waitingShown.length === 0}
  <p class="meta empty">{t('collections.noMatch')}</p>
{:else if collections && !words && shown.length === 0}
  <p class="meta empty">{t(filter === 'yours' ? 'collections.noneYours' : 'collections.none')}</p>
{/if}

<style>
  .search { margin: 16px 0 12px; }
  .filter { margin: 2px 0 8px; }
  .more { all: unset; display: block; cursor: pointer; padding: 6px 8px 4px 38px; font-size: var(--text-meta); color: var(--text-muted); }
  .more:hover { color: var(--text-primary); }
  .more:focus-visible { outline: 2px solid var(--text-secondary); }
  .empty { padding: 8px 4px; }
</style>

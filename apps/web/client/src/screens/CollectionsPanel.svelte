<script lang="ts">
  import ListItem from '@datahub/ui/components/ListItem.svelte';
  import PanelFilter from '@datahub/ui/components/PanelFilter.svelte';
  import Search from '@datahub/ui/components/Search.svelte';
  import TreeFolder from '@datahub/ui/components/TreeFolder.svelte';
  import TreeGroup from '@datahub/ui/components/TreeGroup.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import CollectionIcon from '@datahub/ui/marks/CollectionIcon.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import type { Collection, Resource } from '../lib/catalogue.js';
  import type { LensItem } from '../lib/query.js';
  import { brokenText } from '../lib/broken.js';
  import { dragOf, dropOf, isOver, type Mover } from '../lib/dragging.svelte.js';
  import { contents, counted, lensFolder, pathTo } from '../lib/folders.js';
  import { collectionPath, folderPath, lensPath, resourcePath } from '../lib/routes.js';

  /**
   * The panel of Collections, the index of the section (What is in the panel): every Collection the
   * User sees, All or Yours, chosen first in the filter next to the search (DEC-UX-87, DEC-UX-161), each unfolding to its Resources (FR-CO-18), then its Lenses,
   * without a label of their own (FR-CO-36). For the Data Team, "Without a Collection" is on top
   * (DEC-UX-16). Search filters the Collections, their Resources and their Lenses together (FR-CO-24).
   * The filter next to it shows Resources, Lenses or both: with one kind left out, a Collection without
   * the other leaves the panel, and with only Lenses each Collection unfolds to them (DEC-UX-151).
   * An unfolded Collection shows its folders first, each folding to what it holds, then what sits at its top
   * (DEC-UX-156); the Owner Unit and the Data Team drag a Resource, a Lens or a folder onto another folder, or
   * onto the Collection for its top (DEC-UX-157). While searching, what matches shows without its folders.
   */
  let {
    collections,
    lenses = [],
    waiting,
    currentCollection,
    currentResource,
    currentLens,
    currentFolder,
    groups,
    onmove,
  }: {
    collections: readonly Collection[] | undefined;
    /** The Lenses the User sees, each in its Collection. */
    lenses?: readonly LensItem[] | undefined;
    waiting: readonly Resource[] | undefined;
    /** The Collection whose page is open, or that holds the Resource whose page is open. */
    currentCollection: string | undefined;
    currentResource: string | undefined;
    currentLens?: string | undefined;
    /** The folder whose page is open. */
    currentFolder?: string | undefined;
    /** The fixed IDs of the groups of the User: their Collections are theirs. */
    groups: readonly string[];
    onmove: Mover;
  } = $props();

  /** How many items an unfolded Collection shows before "Show all" (FR-CO-23). */
  const FIRST = 8;
  type Kind = 'resources' | 'lenses';
  const KINDS: readonly Kind[] = ['resources', 'lenses'];
  const TEXTS: Record<Kind, { name: string; detail: string }> = {
    resources: { name: 'collections.show.resources', detail: 'collections.show.resources.detail' },
    lenses: { name: 'collections.show.lenses', detail: 'collections.show.lenses.detail' },
  };

  let query = $state('');
  let filter: 'all' | 'yours' = $state('all');
  /** What the Collections unfold to: Resources, Lenses or both (DEC-UX-151). */
  let show = $state<Kind[]>([...KINDS]);
  /** Which Collections the User unfolded; folded unless they did (DEC-UX-13). */
  let unfolded: Record<string, boolean> = $state({});
  /** Whether "Without a Collection" is unfolded; folded unless the User unfolds it (DEC-UX-133). */
  let waitingOpen = $state(false);
  let all: Record<string, boolean> = $state({});
  let allLenses: Record<string, boolean> = $state({});
  /** Which folders the User unfolded; folded unless they did, or what is open is in it. */
  let openFolders: Record<string, boolean> = $state({});

  // Opening a Collection, or a Resource in it, unfolds it in the panel (FR-CO-19, FR-CO-25); so does
  // opening a Resource that waits for "Without a Collection".
  $effect(() => {
    if (currentCollection) {
      unfolded[currentCollection] = true;
    }
  });
  $effect(() => {
    if (currentResource && waiting?.some((resource) => resource.id === currentResource)) {
      waitingOpen = true;
    }
  });
  // The folder whose page is open unfolds, and so does every folder around what is open.
  $effect(() => {
    const collection = collections?.find((candidate) => candidate.id === currentCollection);
    if (!collection) return;
    const from =
      currentFolder ??
      (currentResource ? collection.resources.find((item) => item.id === currentResource)?.folderId : currentLens ? lensFolder(collection, currentLens) : null);
    for (const folder of from ? pathTo(collection, from) : []) {
      openFolders[folder.id] = true;
    }
  });

  const words = $derived(query.trim().toLowerCase());
  const fits = (name: string) => name.toLowerCase().includes(words);
  const mine = (collection: Collection) => groups.includes(collection.ownerUnit.id);

  interface Shown {
    collection: Collection;
    /** The Collection with only the Resources the filter shows, and its Lenses the filter shows: what its folders hold. */
    view: Collection;
    lensView: LensItem[];
    /** Its items at its top, or while searching all those that match, without their folders. */
    items: Collection['resources'];
    lensItems: LensItem[];
    /** Unfolded by the search, to show what matches. */
    found: boolean;
    /** What the search found, without its folders. */
    flat: boolean;
  }
  const lensesOf = (collection: Collection) => (lenses ?? []).filter((lens) => lens.collectionId === collection.id).toSorted((a, b) => a.name.localeCompare(b.name));
  const inScope = $derived((collections ?? []).filter((collection) => filter === 'all' || mine(collection)));
  const withResources = $derived(show.includes('resources'));
  const withLenses = $derived(show.includes('lenses'));
  /** With one kind left out, only the Collections that hold the other stay (DEC-UX-151). */
  const narrowed = $derived(!withResources || !withLenses);
  const shown: Shown[] = $derived(
    inScope.flatMap((collection): Shown[] => {
      const resources = withResources ? collection.resources : [];
      const its = withLenses ? lensesOf(collection) : [];
      const view = { ...collection, resources };
      if (!words || fits(collection.name)) {
        if (narrowed && resources.length + its.length === 0) return [];
        const top = contents(view, its, null);
        // Only Lenses: each Collection unfolds to them, as few as they are.
        return [{ collection, view, lensView: its, items: top.resources, lensItems: top.lenses, found: !withResources, flat: false }];
      }
      const items = resources.filter((item) => fits(item.displayName));
      const lensItems = its.filter((lens) => fits(lens.name));
      return items.length + lensItems.length > 0 ? [{ collection, view, lensView: its, items, lensItems, found: true, flat: true }] : [];
    }),
  );
  const waitingShown = $derived(withResources ? (waiting ?? []).filter((resource) => !words || fits(resource.displayName)) : []);
  const counts = $derived({
    resources: inScope.reduce((sum, collection) => sum + collection.resources.length, 0),
    lenses: inScope.reduce((sum, collection) => sum + lensesOf(collection).length, 0),
  });
</script>

<!-- What the Collections unfold to, Resources, Lenses or both, folds open next to the search (DEC-UX-150, DEC-UX-151). -->
<PanelFilter
  id="collections-show"
  label={t('collections.show.toggle')}
  legend={t('collections.show')}
  kinds={KINDS.map((kind) => ({ value: kind, name: t(TEXTS[kind].name), detail: t(TEXTS[kind].detail), count: collections ? counts[kind] : undefined }))}
  bind:chosen={show}
  defaults={KINDS}
  atLeastOne
  choice={{
    legend: t('collections.filter'),
    options: [
      { value: 'all', name: t('collections.filter.all'), detail: t('collections.filter.all.detail') },
      { value: 'yours', name: t('collections.filter.yours'), detail: t('collections.filter.yours.detail') },
    ],
    initial: 'all',
  }}
  bind:picked={filter}
>
  <Search bind:value={query} placeholder={t('collections.search')} />
</PanelFilter>

{#if waiting && waitingShown.length > 0}
  <TreeGroup icon="tray" name={t('collections.unassigned')} urgent bind:open={() => waitingOpen || Boolean(words), (open) => (waitingOpen = open)}>
    {#snippet meta()}<Chip variant="urgent">{waiting.length}</Chip>{t('collections.unassigned.meta')}{/snippet}
    {#each waitingShown as resource (resource.id)}
      <ListItem href={resourcePath(resource.id)} name={resource.displayName} level={resource.level} current={resource.id === currentResource} />
    {/each}
  </TreeGroup>
{/if}


<!-- What a folder holds, or the folders at the top of a Collection: its folders, each folding, then its Resources and Lenses. -->
{#snippet tree(collection: Collection, view: Collection, lensView: LensItem[], folderId: string | null)}
  {@const inside = contents(view, lensView, folderId)}
  {#each inside.folders as folder (folder.id)}
    <TreeFolder
      href={folderPath(collection.id, folder.id)}
      name={folder.name}
      count={counted(contents(view, lensView, folder.id))}
      current={folder.id === currentFolder}
      drop={isOver(collection, folder.id)}
      bind:open={() => openFolders[folder.id] ?? false, (open) => (openFolders[folder.id] = open)}
      {...dragOf({ kind: 'folder', id: folder.id, name: folder.name, collectionId: collection.id, from: folder.parentId }, collection.canManage)}
      {...collection.canManage ? dropOf(collection, folder, onmove) : {}}
    >
      {@render tree(collection, view, lensView, folder.id)}
    </TreeFolder>
  {/each}
  {#if folderId !== null}
    {#each inside.resources as item (item.id)}
      <ListItem
        href={resourcePath(item.id)}
        name={item.displayName}
        level={item.level}
        current={item.id === currentResource}
        published={item.published}
        deprecated={item.deprecated}
        {...dragOf({ kind: 'resource', id: item.id, name: item.displayName, collectionId: collection.id, from: folderId }, collection.canManage)}
      />
    {/each}
    {#each inside.lenses as lens (lens.id)}
      <ListItem
        href={lensPath(lens.id)}
        kind="lens"
        name={lens.name}
        level={lens.level}
        current={lens.id === currentLens}
        published={lens.state !== 'waiting' && lens.state !== 'refused'}
        broken={brokenText(lens.broken)}
        {...dragOf({ kind: 'lens', id: lens.id, name: lens.name, collectionId: collection.id, from: folderId }, collection.canManage)}
      />
    {/each}
  {/if}
{/snippet}

{#each shown as { collection, view, lensView, items, lensItems, found, flat } (collection.id)}
  {@const first = all[collection.id] || found ? items : items.slice(0, FIRST)}
  {@const firstLenses = allLenses[collection.id] || found ? lensItems : lensItems.slice(0, FIRST)}
  <TreeGroup
    href={collectionPath(collection.id)}
    name={collection.name}
    current={collection.id === currentCollection}
    bind:open={() => found || (unfolded[collection.id] ?? false), (open) => (unfolded[collection.id] = open)}
    drop={isOver(collection, null)}
    {...collection.canManage ? dropOf(collection, null, onmove) : {}}
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
    {#if !flat}{@render tree(collection, view, lensView, null)}{/if}
    {#each first as item (item.id)}
      <ListItem
        href={resourcePath(item.id)}
        name={item.displayName}
        level={item.level}
        current={item.id === currentResource}
        published={item.published}
        deprecated={item.deprecated}
        {...dragOf({ kind: 'resource', id: item.id, name: item.displayName, collectionId: collection.id, from: item.folderId }, collection.canManage)}
      />
    {/each}
    {#if first.length < items.length}
      <button type="button" class="more" onclick={() => (all[collection.id] = true)}>{t('collections.showAll', { count: items.length })}</button>
    {/if}
    {#each firstLenses as lens (lens.id)}
      <ListItem
        href={lensPath(lens.id)}
        kind="lens"
        name={lens.name}
        level={lens.level}
        current={lens.id === currentLens}
        published={lens.state !== 'waiting' && lens.state !== 'refused'}
        broken={brokenText(lens.broken)}
        {...dragOf({ kind: 'lens', id: lens.id, name: lens.name, collectionId: collection.id, from: lensFolder(collection, lens.id) }, collection.canManage)}
      />
    {/each}
    {#if firstLenses.length < lensItems.length}
      <button type="button" class="more" onclick={() => (allLenses[collection.id] = true)}>{t('collections.showAll', { count: lensItems.length })}</button>
    {/if}
  </TreeGroup>
{/each}

{#if collections && words && shown.length === 0 && waitingShown.length === 0}
  <p class="meta empty">{t('collections.noMatch')}</p>
{:else if collections && !words && shown.length === 0 && narrowed && inScope.length > 0}
  <p class="meta empty">{t('collections.noneShown')}</p>
{:else if collections && !words && shown.length === 0}
  <p class="meta empty">{t(filter === 'yours' ? 'collections.noneYours' : 'collections.none')}</p>
{/if}

<style>
  .more { all: unset; display: block; cursor: pointer; padding: 6px 8px 4px 38px; font-size: var(--text-meta); color: var(--text-muted); }
  .more:hover { color: var(--text-primary); }
  .more:focus-visible { outline: 2px solid var(--text-secondary); }
  .empty { padding: 8px 4px; }
</style>

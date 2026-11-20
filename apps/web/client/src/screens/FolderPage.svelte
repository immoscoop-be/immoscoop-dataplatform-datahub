<script lang="ts">
  import Breadcrumb, { type Step } from '@datahub/ui/components/Breadcrumb.svelte';
  import InPlaceHead from '@datahub/ui/components/InPlaceHead.svelte';
  import Callout from '@datahub/ui/containers/Callout.svelte';
  import MenuButton, { type MenuChoice } from '@datahub/ui/containers/MenuButton.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import CollectionIcon from '@datahub/ui/marks/CollectionIcon.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import IconButton from '@datahub/ui/primitives/IconButton.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import { Refused } from '../lib/api.js';
  import type { Catalogue, Collection, CollectionItem, CollectionResource, Folder } from '../lib/catalogue.js';
  import { dropOf, isOver, type Mover } from '../lib/dragging.svelte.js';
  import { contents, counted, holdsText, pathTo } from '../lib/folders.js';
  import type { LensItem } from '../lib/query.js';
  import { collectionPath, folderPath, newLensForPath } from '../lib/routes.js';
  import { command, place, useScreenCommands } from '../lib/commands.svelte.js';
  import type { QuickRow } from '../lib/quick.js';
  import ContentsTable from './ContentsTable.svelte';
  import NotFound from './NotFound.svelte';

  /**
   * The page of a folder of a Collection (FR-CO-38 to FR-CO-40, DEC-UX-156), laid out as the page of its Collection
   * (DEC-UX-315): the path above it, its name and description, which the Owner Unit and the Data Team change in place
   * (DEC-UX-162), the same "New", here a folder in it or a Lens, and Delete; and what it holds in the same table, its
   * folders first, then its Resources and Lenses together, A to Z. A whole row opens what it is with a click; the Owner
   * Unit and the Data Team drag it onto a folder, here, in the panel or in the path, to move it (DEC-UX-157). Delete
   * stays on: on a folder that holds something, it says so and deletes nothing. Whoever takes Resources out of the
   * Collection does so at the end of a row, as on the page of the Collection (DEC-UX-212).
   */
  let {
    collection,
    folderId,
    lenses,
    catalogue,
    removes = null,
    own = [],
    go,
    onchanged,
    onmove,
  }: {
    /** Its Collection: undefined while the Collections come, null when the User does not see it. */
    collection: Collection | null | undefined;
    folderId: string;
    lenses: readonly LensItem[] | undefined;
    catalogue: Catalogue;
    /** How far the User takes Resources out of a Collection (`resources.remove`, DEC-UX-212, DEC-PL-08): every one, or theirs while not published. */
    removes?: 'theirs' | 'every' | null;
    /** The fixed IDs of the groups of the User, for a Collection that does not say whose it is. */
    own?: readonly string[];
    go: (path: string) => void;
    /** The folders changed: the Collections are read again. */
    onchanged: () => Promise<void>;
    onmove: Mover;
  } = $props();

  const folder = $derived(collection?.folders.find((candidate) => candidate.id === folderId));
  /** The Collection is of one of the User's Owner Units. */
  const owned = $derived(collection !== undefined && collection !== null && (collection.owned ?? own.includes(collection.ownerUnit.id)));
  /** A column for ⊖ when the User takes out any of them: every one, or, of their own Collection, those not published (DEC-UX-214). */
  const removing = $derived(removes === 'every' || (removes === 'theirs' && owned));
  const inside = $derived(collection && folder ? contents(collection, lenses ?? [], folder.id) : undefined);
  const manage = $derived(collection?.canManage ?? false);

  /** The Resources of the Collection with their last change, for the list. */
  let details: ReadonlyMap<string, CollectionResource> = $state(new Map());
  $effect(() => {
    const wanted = collection?.id;
    if (!wanted) return;
    catalogue.collectionResources(wanted).then(
      (found) => {
        if (collection?.id === wanted) details = new Map(found.map((resource) => [resource.id, resource]));
      },
      (error: unknown) => console.error('The Resources of the Collection could not be read', error),
    );
  });

  let making = $state(false);
  /** Delete on a folder that is not empty: it says what it still holds, or that it holds what the User does not see. */
  let warning: 'holds' | 'hidden' | undefined = $state();
  // Once what it held is moved out, the warning has done its work.
  $effect(() => {
    if (warning === 'holds' && inside && counted(inside) === 0) warning = undefined;
  });
  $effect(() => {
    void folderId;
    [making, warning] = [false, undefined];
  });

  /** Where something dragged onto a step of the path goes, for those who may move it. */
  const targetOf = (shown: Collection, at: Folder | null): Step['target'] =>
    manage ? { over: isOver(shown, at?.id ?? null), ...dropOf(shown, at, onmove) } : undefined;

  async function make(wanted: string): Promise<boolean> {
    if (!collection || !folder) return false;
    try {
      await catalogue.makeFolder(collection.id, wanted, folder.id);
      await onchanged();
      making = false;
      return true;
    } catch (error) {
      console.error('The folder could not be made', error);
      return false;
    }
  }

  /** Its name or description, changed in place (FR-CO-42, DEC-UX-162); a sentence when it is refused. */
  async function change(changes: { name?: string; description?: string }): Promise<string | undefined> {
    if (!collection || !folder) return undefined;
    if (changes.name !== undefined && changes.name.length > 80) return t('folder.problem.name');
    await catalogue.changeFolder(collection.id, folder.id, changes);
    await onchanged();
    return undefined;
  }

  /** Takes a Resource out of the Collection: it leaves this folder too, back to Without a Collection (DEC-UX-212). */
  async function takeOut(item: CollectionItem) {
    try {
      await catalogue.removeResource(item.id);
      await onchanged();
    } catch (error) {
      console.error(`${item.displayName} could not be removed from the Collection`, error);
    }
  }

  async function remove() {
    if (!collection || !folder || !inside) return;
    if (counted(inside) > 0) {
      warning = 'holds';
      return;
    }
    try {
      await catalogue.deleteFolder(collection.id, folder.id);
      go(folder.parentId ? folderPath(collection.id, folder.parentId) : collectionPath(collection.id));
      await onchanged();
    } catch (error) {
      if (error instanceof Refused && error.code === 'not_empty') {
        warning = 'hidden';
      } else {
        console.error('The folder could not be deleted', error);
      }
    }
  }

  /** What "New" makes here: a folder in this one, or a Lens, as on the page of its Collection (DEC-UX-310, DEC-UX-315). */
  const choices = $derived.by((): MenuChoice[] => {
    const into = collection;
    const here = folder;
    if (!manage || !into || !here) return [];
    return [
      { key: 'folder', icon: 'folder-simple-plus', label: t('collection.new.folder'), hint: t('collection.new.folder.hint', { name: here.name }), run: () => (making = true) },
      { key: 'lens', icon: 'aperture', label: 'Lens', hint: t('collection.new.lens.hint'), run: () => go(newLensForPath(into.id)) },
    ];
  });

  // In the quick window: a folder in it and deleting it, for who manages its Collection, and back to the Collection (DEC-UX-240).
  useScreenCommands(() => {
    const here = folder;
    const into = collection;
    if (!here || !into) return null;
    const rows: QuickRow[] = [];
    if (manage) {
      rows.push(command('folder:new', 'folder-simple-plus-fill', t('folder.new'), () => (making = true), { meta: t('quick.folder.new.meta', { name: here.name }), words: t('quick.folder.words') }));
      rows.push(place('folder:lens', 'aperture', t('quick.collection.lens'), () => go(newLensForPath(into.id)), { meta: t('quick.collection.lens.meta'), words: t('quick.collection.lens.words') }));
      rows.push(command('folder:delete', 'trash', t('quick.folder.delete'), () => void remove(), { meta: t('quick.folder.delete.meta'), words: t('quick.folder.delete.words') }));
    }
    rows.push(place('folder:collection', 'stack', into.name, () => go(collectionPath(into.id)), { meta: t('quick.folder.collection.meta'), words: t('quick.resource.collection.words') }));
    return { group: t('quick.group.folder'), where: `${into.name} · ${here.name}`, rows };
  });
</script>

{#if collection === null || (collection && !folder)}
  <NotFound />
{:else if collection && folder && inside}
  {@const shown = collection}
  <Breadcrumb
    steps={[
      { label: 'Collections', href: '/collections' },
      { label: shown.name, href: collectionPath(shown.id), target: targetOf(shown, null) },
      ...pathTo(shown, folder.id)
        .slice(0, -1)
        .map((step) => ({ label: step.name, href: folderPath(shown.id, step.id), target: targetOf(shown, step) })),
      { label: folder.name },
    ]}
  />
  <div class="head">
    <CollectionIcon name="folder-open" large />
    <div class="what">
      <!-- Its name and description, edited in place by its Owner Unit and the Data Team (DEC-UX-162). -->
      <InPlaceHead
        name={folder.name}
        description={folder.description}
        canEdit={manage}
        nameLabel={t('folder.field.name')}
        descriptionLabel={t('folder.field.description')}
        onsave={change}
      />
    </div>
    {#if manage}
      <div class="actions">
        <MenuButton icon="plus" text={t('collection.new')} label={t('collection.new')} {choices} />
        <IconButton icon="trash" label={t('folder.delete')} onclick={remove} />
      </div>
    {/if}
  </div>
  <div class="status-row">
    <Chip><CollectionIcon name={shown.icon} />{t('folder.in', { collection: shown.name })}</Chip>
    <Chip>{holdsText(inside)}</Chip>
  </div>

  {#if warning}
    <Callout icon="warning-fill" tone="warning">
      <b>{t('folder.notEmpty', { name: folder.name })}</b>
      {warning === 'hidden' ? t('folder.notEmpty.hidden') : t('folder.notEmpty.holds', { holds: holdsText(inside) })}
      {#snippet action()}<button type="button" class="text-link" onclick={() => (warning = undefined)}>{t('folder.ok')}</button>{/snippet}
    </Callout>
  {/if}

  <!-- The same table as on the page of its Collection, without a heading or a line of explanation (DEC-UX-315). -->
  <ContentsTable
    collection={shown}
    {inside}
    folderId={folder.id}
    lenses={lenses ?? []}
    {details}
    {manage}
    {removing}
    {removes}
    {owned}
    {making}
    onmake={make}
    oncancel={() => (making = false)}
    onremove={takeOut}
    {go}
    {onmove}
    label={t('collection.contents', { name: folder.name })}
    empty={t(manage ? 'folder.nothing.manage' : 'folder.nothing')}
  />
{:else}
  <Loading />
{/if}

<style>
  .head { display: flex; align-items: flex-start; gap: 14px; margin-top: 10px; }
  .what { flex: 1; min-width: 0; }
  .actions { display: flex; gap: 8px; align-items: center; flex: none; }
  .status-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
  .text-link { all: unset; cursor: pointer; font-size: var(--text-small); color: var(--text-secondary); text-decoration: underline; text-underline-offset: 3px; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
</style>

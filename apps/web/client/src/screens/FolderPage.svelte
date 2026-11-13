<script lang="ts">
  import Breadcrumb, { type Step } from '@datahub/ui/components/Breadcrumb.svelte';
  import InPlaceHead from '@datahub/ui/components/InPlaceHead.svelte';
  import Callout from '@datahub/ui/containers/Callout.svelte';
  import Table from '@datahub/ui/containers/Table.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { levelName } from '@datahub/ui/foundations/levels.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago } from '@datahub/ui/foundations/when.js';
  import CollectionIcon from '@datahub/ui/marks/CollectionIcon.svelte';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import IconButton from '@datahub/ui/primitives/IconButton.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import { renderLog } from '@datahub/contracts/log';
  import { Refused } from '../lib/api.js';
  import { brokenText } from '../lib/broken.js';
  import type { Catalogue, Collection, CollectionResource, Folder } from '../lib/catalogue.js';
  import { dragging, dragOf, dropOf, isOver, type Mover } from '../lib/dragging.svelte.js';
  import { contents, counted, holdsText, pathTo } from '../lib/folders.js';
  import { removable } from '../lib/permissions.js';
  import type { LensItem } from '../lib/query.js';
  import { collectionPath, folderPath, lensPath, resourcePath } from '../lib/routes.js';
  import { command, place, useScreenCommands } from '../lib/commands.svelte.js';
  import type { QuickRow } from '../lib/quick.js';
  import { rowOf } from '../lib/rows.js';
  import NewFolderRow from './NewFolderRow.svelte';
  import NotFound from './NotFound.svelte';

  /**
   * The page of a folder of a Collection (FR-CO-38 to FR-CO-40, DEC-UX-156): the path above it, its name and
   * what it holds, its folders first, then its Resources and Lenses, each A to Z. A whole row opens what it is
   * with a click; the Owner Unit and the Data Team drag it onto a folder, here, in the panel or in the path, to
   * move it (DEC-UX-157), make and delete folders, and change the name and description of this one in place (DEC-UX-162). Delete stays on: on a folder that holds
   * something, it says so and deletes nothing. A Data Admin takes a Resource out of the Collection at the end of its row,
   * as on the page of the Collection (DEC-UX-212).
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
  const assigns = $derived(removes === 'every' || (removes === 'theirs' && owned));
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
  async function takeOut(item: { id: string; displayName: string }) {
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

  // In the quick window: a folder in it and deleting it, for who manages its Collection, and back to the Collection (DEC-UX-240).
  useScreenCommands(() => {
    const here = folder;
    const into = collection;
    if (!here || !into) return null;
    const rows: QuickRow[] = [];
    if (manage) {
      rows.push(command('folder:new', 'folder-simple-plus-fill', t('folder.new'), () => (making = true), { meta: t('quick.folder.new.meta', { name: here.name }), words: t('quick.folder.words') }));
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
        <Button variant="outline" onclick={() => (making = true)}><Icon name="folder-simple-plus-fill" />{t('folder.new')}</Button>
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

  <div class="section-head">
    <h2>{t('folder.contents')}</h2>
    {#if manage && counted(inside) > 0}<span class="meta">{t('folder.dragHint')}</span>{/if}
  </div>
  {#if counted(inside) === 0 && !making}
    <p class="meta empty">{t(manage ? 'folder.nothing.manage' : 'folder.nothing')}</p>
  {:else}
    <Table label={t('folder.contents')}>
      {#snippet head()}
        <tr>
          <th>{t('collection.column.name')}</th>
          <th>{t('folder.level')}</th>
          <th>{t('collection.column.change')}</th>
          {#if assigns}<th><span class="hidden">{t('collection.column.remove')}</span></th>{/if}
        </tr>
      {/snippet}
      {#if making}<NewFolderRow columns={assigns ? 4 : 3} onmake={make} oncancel={() => (making = false)} />{/if}
      {#each inside.folders as sub (sub.id)}
        <tr
          class="row"
          class:drop={isOver(shown, sub.id)}
          class:dragging={dragging.item?.id === sub.id}
          {...rowOf(folderPath(shown.id, sub.id), go)}
          {...dragOf({ kind: 'folder', id: sub.id, name: sub.name, collectionId: shown.id, from: sub.parentId }, manage)}
          {...manage ? dropOf(shown, sub, onmove) : {}}
        >
          <td>
            <span class="name"><span class="folder" role="img" aria-label={t('folder.kind')}><Icon name="folder-fill" /></span><span>{sub.name}</span><span class="meta in-name">{t('folder.items', { count: counted(contents(shown, lenses ?? [], sub.id)) })}</span></span>
          </td>
          <td class="muted">—</td>
          <td class="muted">{t('folder.made', { name: sub.createdBy, time: ago(sub.createdAt, currentLanguage()) })}</td>
          {#if assigns}<td></td>{/if}
        </tr>
      {/each}
      {#each inside.resources as item (item.id)}
        {@const change = details.get(item.id)?.lastChange}
        <tr
          class="row"
          class:quiet={!item.published}
          class:dragging={dragging.item?.id === item.id}
          {...rowOf(resourcePath(item.id), go)}
          {...dragOf({ kind: 'resource', id: item.id, name: item.displayName, collectionId: shown.id, from: item.folderId }, manage)}
        >
          <td>
            <span class="name"><KindIcon kind="resource" /><span>{item.displayName}</span></span>
            {#if item.deprecated}<span class="deprecated">{t('status.deprecated')}</span>{/if}
          </td>
          <td><span class="level"><MaturityIcon level={item.level} tooltip={false} />{levelName(item.level)}</span></td>
          <td class="muted">
            {#if change}
              {@const text = renderLog(change.logId, change.params, currentLanguage())}
              <span class="change"><span class="change-text" title={text}>{text}</span><span class="when">&nbsp;· {ago(change.at, currentLanguage())}</span></span>
            {/if}
          </td>
          {#if assigns}
            <td class="remove">
              {#if removable(removes, owned, item.published)}<IconButton icon="minus-circle" label={t('collection.remove', { name: item.displayName })} onclick={() => takeOut(item)} />{/if}
            </td>
          {/if}
        </tr>
      {/each}
      {#each inside.lenses as lens (lens.id)}
        <tr
          class="row"
          class:quiet={lens.state === 'waiting' || lens.state === 'refused'}
          class:dragging={dragging.item?.id === lens.id}
          {...rowOf(lensPath(lens.id), go)}
          {...dragOf({ kind: 'lens', id: lens.id, name: lens.name, collectionId: shown.id, from: folder.id }, manage)}
        >
          <td><span class="name"><KindIcon kind="lens" broken={brokenText(lens.broken)} /><span>{lens.name}</span></span></td>
          <td><span class="level"><MaturityIcon level={lens.level} tooltip={false} />{levelName(lens.level)}</span></td>
          <td class="muted">{t('folder.made', { name: lens.authorName, time: ago(lens.createdAt, currentLanguage()) })}</td>
          {#if assigns}<td></td>{/if}
        </tr>
      {/each}
      {#snippet after()}<p class="meta foot">{t('folder.order')}</p>{/snippet}
    </Table>
  {/if}
{:else}
  <Loading />
{/if}

<style>
  .remove { width: 1%; }
  .hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .head { display: flex; align-items: flex-start; gap: 14px; margin-top: 10px; }
  .what { flex: 1; min-width: 0; }
  .actions { display: flex; gap: 8px; align-items: center; flex: none; }
  .status-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
  .section-head { display: flex; align-items: baseline; gap: 12px; margin: 26px 0 12px; }
  .section-head h2 { font-size: var(--text-section); font-weight: var(--weight-medium); margin: 0; flex: 1; }
  .name { display: flex; align-items: center; gap: 8px; font-weight: var(--weight-medium); }
  .name :global(.kind) { font-size: 14px; color: var(--text-muted); }
  .folder { display: inline-flex; font-size: 17px; color: var(--text-secondary); }
  .in-name { font-weight: var(--weight-regular); margin-left: 4px; }
  .level { display: inline-flex; align-items: center; gap: 7px; color: var(--text-secondary); white-space: nowrap; }
  .deprecated { display: block; margin-top: 2px; font-size: var(--text-meta); color: var(--signal-warn); }
  .muted { color: var(--text-muted); }
  .change { display: flex; max-width: 400px; }
  .change-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .when { flex: none; white-space: nowrap; }
  .foot { margin: 8px 10px 2px; }
  .empty { margin: 0; }
  .text-link { all: unset; cursor: pointer; font-size: var(--text-small); color: var(--text-secondary); text-decoration: underline; text-underline-offset: 3px; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
</style>

<script lang="ts">
  import Table from '@datahub/ui/containers/Table.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { levelName } from '@datahub/ui/foundations/levels.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago } from '@datahub/ui/foundations/when.js';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import IconButton from '@datahub/ui/primitives/IconButton.svelte';
  import { renderLog } from '@datahub/contracts/log';
  import { brokenText } from '../lib/broken.js';
  import type { Collection, CollectionItem, CollectionResource } from '../lib/catalogue.js';
  import { dragging, dragOf, dropOf, isOver, type Mover } from '../lib/dragging.svelte.js';
  import { contents, counted, holdsText, type Contents } from '../lib/folders.js';
  import { removable } from '../lib/permissions.js';
  import type { LensItem } from '../lib/query.js';
  import { folderPath, lensPath, resourcePath } from '../lib/routes.js';
  import { rowOf } from '../lib/rows.js';
  import NewFolderRow from './NewFolderRow.svelte';

  /**
   * What sits at the top of a Collection, or in one of its folders, in one table, the same on both pages (DEC-UX-311,
   * DEC-UX-315): its folders first, then its Resources and Lenses together, A to Z, each with the icon of its kind.
   * Its columns are Name, Level, Status and Last change: a folder says what it holds, a Resource whether it is
   * published, a Lens what it is built on (OP-UX-115). A whole row opens what it is; for the Owner Unit and the Data
   * Team it moves with a drag onto a folder (DEC-UX-157). Whoever takes Resources out of the Collection has the button
   * at the end of a row (DEC-UX-212, DEC-UX-214). No heading and no line of explanation.
   */
  let {
    collection,
    inside,
    folderId,
    lenses,
    details,
    manage,
    removing,
    removes,
    owned,
    making,
    onmake,
    oncancel,
    onremove,
    go,
    onmove,
    label,
    empty,
  }: {
    /** The Collection as the panel has it: where its folders, Resources and Lenses sit. */
    collection: Collection;
    /** What sits here. */
    inside: Contents;
    /** The folder this is, or null at the top of the Collection. */
    folderId: string | null;
    /** Every Lens of the Collection the User sees, to say what each folder holds. */
    lenses: readonly LensItem[];
    /** The Resources of the Collection with their last change. */
    details: ReadonlyMap<string, CollectionResource>;
    /** The User makes folders here and moves what is in it: its Owner Unit and the Data Team. */
    manage: boolean;
    /** A column for the button that takes a Resource out of the Collection. */
    removing: boolean;
    removes: 'theirs' | 'every' | null;
    /** The Collection is of one of the User's Owner Units. */
    owned: boolean;
    /** A folder being made, as the first row. */
    making: boolean;
    onmake: (name: string) => Promise<boolean>;
    oncancel: () => void;
    onremove: (item: CollectionItem) => void;
    go: (path: string) => void;
    onmove: Mover;
    label: string;
    /** What it says when nothing sits here. */
    empty: string;
  } = $props();

  type Entry = { kind: 'resource'; name: string; item: CollectionItem } | { kind: 'lens'; name: string; item: LensItem };
  const byName = (a: Entry, b: Entry) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  /** Its Resources and Lenses together, A to Z, after its folders. */
  const entries = $derived(
    [
      ...inside.resources.map((item): Entry => ({ kind: 'resource', name: item.displayName, item })),
      ...inside.lenses.map((item): Entry => ({ kind: 'lens', name: item.name, item })),
    ].toSorted(byName),
  );
  const columns = $derived(removing ? 5 : 4);
  const when = (at: string) => ago(at, currentLanguage());
</script>

<div class="contents">
{#if counted(inside) === 0 && !making}
  <p class="meta empty">{empty}</p>
{:else}
  <Table {label}>
    {#snippet head()}
      <tr>
        <th>{t('collection.column.name')}</th>
        <th>Level</th>
        <th>{t('collection.column.status')}</th>
        <th>{t('collection.column.change')}</th>
        {#if removing}<th><span class="hidden">{t('collection.column.remove')}</span></th>{/if}
      </tr>
    {/snippet}
    {#if making}<NewFolderRow {columns} {onmake} {oncancel} />{/if}
    {#each inside.folders as sub (sub.id)}
      <tr
        class="row"
        class:drop={isOver(collection, sub.id)}
        class:dragging={dragging.item?.id === sub.id}
        {...rowOf(folderPath(collection.id, sub.id), go)}
        {...dragOf({ kind: 'folder', id: sub.id, name: sub.name, collectionId: collection.id, from: sub.parentId }, manage)}
        {...manage ? dropOf(collection, sub, onmove) : {}}
      >
        <td><span class="name"><span class="folder" role="img" aria-label={t('folder.kind')}><Icon name="folder-fill" /></span><span>{sub.name}</span></span></td>
        <td></td>
        <td class="muted">{holdsText(contents(collection, lenses, sub.id))}</td>
        <td class="muted">{t('folder.made', { name: sub.createdBy, time: when(sub.createdAt) })}</td>
        {#if removing}<td></td>{/if}
      </tr>
    {/each}
    {#each entries as entry (entry.item.id)}
      {#if entry.kind === 'resource'}
        {@const item = entry.item}
        {@const change = details.get(item.id)?.lastChange}
        <tr
          class="row"
          class:quiet={!item.published}
          class:dragging={dragging.item?.id === item.id}
          {...rowOf(resourcePath(item.id), go)}
          {...dragOf({ kind: 'resource', id: item.id, name: item.displayName, collectionId: collection.id, from: item.folderId ?? null }, manage)}
        >
          <td>
            <span class="name"><KindIcon kind="resource" /><span>{item.displayName}</span></span>
            {#if item.deprecated}<span class="note">{t('status.deprecated')}</span>{/if}
          </td>
          <td><span class="level"><MaturityIcon level={item.level} tooltip={false} />{levelName(item.level)}</span></td>
          <td>{t(item.published ? 'status.published' : 'status.notPublished')}</td>
          <td class="muted">
            {#if change}
              {@const text = renderLog(change.logId, change.params, currentLanguage())}
              <span class="change"><span class="change-text" title={text}>{text}</span><span class="when">&nbsp;· {when(change.at)}</span></span>
            {/if}
          </td>
          {#if removing}
            <td class="remove">
              {#if removable(removes, owned, item.published)}<IconButton icon="minus-circle" label={t('collection.remove', { name: item.displayName })} onclick={() => onremove(item)} />{/if}
            </td>
          {/if}
        </tr>
      {:else}
        {@const lens = entry.item}
        <tr
          class="row"
          class:quiet={lens.state === 'waiting' || lens.state === 'refused'}
          class:dragging={dragging.item?.id === lens.id}
          {...rowOf(lensPath(lens.id), go)}
          {...dragOf({ kind: 'lens', id: lens.id, name: lens.name, collectionId: collection.id, from: folderId }, manage)}
        >
          <td>
            <span class="name"><KindIcon kind="lens" broken={brokenText(lens.broken)} /><span>{lens.name}</span></span>
            {#if lens.state === 'waiting'}<span class="note">{t('collection.lenses.waiting')}</span>{:else if lens.state === 'refused'}<span class="note">{t('lens.state.refused')}</span>{:else if lens.state === 'stopped'}<span class="note">{t('status.stopped')}</span>{/if}
          </td>
          <td><span class="level"><MaturityIcon level={lens.level} tooltip={false} />{levelName(lens.level)}</span></td>
          <td class="muted">{t('collection.lensOn', { names: lens.resources.map((resource) => resource.displayName).join(', ') })}</td>
          <td class="muted">{t('folder.made', { name: lens.authorName, time: when(lens.createdAt) })}</td>
          {#if removing}<td></td>{/if}
        </tr>
      {/if}
    {/each}
  </Table>
{/if}
</div>

<style>
  .contents { margin-top: 18px; }
  .name { display: flex; align-items: center; gap: 8px; font-weight: var(--weight-medium); }
  .name :global(.kind) { font-size: 14px; color: var(--text-muted); }
  .folder { display: inline-flex; font-size: 17px; color: var(--text-secondary); }
  .level { display: inline-flex; align-items: center; gap: 7px; color: var(--text-secondary); white-space: nowrap; }
  .note { display: block; margin-top: 2px; font-size: var(--text-meta); color: var(--signal-warn); }
  .muted { color: var(--text-muted); }
  .change { display: flex; max-width: 400px; }
  .change-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .when { flex: none; white-space: nowrap; }
  .remove { width: 1%; }
  .hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .empty { margin: 0; }
</style>

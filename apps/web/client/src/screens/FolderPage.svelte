<script lang="ts">
  import Breadcrumb, { type Step } from '@datahub/ui/components/Breadcrumb.svelte';
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
  import { renderLog } from '@datahub/contracts/log';
  import { Refused } from '../lib/api.js';
  import { brokenText } from '../lib/broken.js';
  import type { Catalogue, Collection, CollectionResource, Folder } from '../lib/catalogue.js';
  import { dragging, dragOf, dropOf, isOver, type Mover } from '../lib/dragging.svelte.js';
  import { contents, counted, holdsText, pathTo } from '../lib/folders.js';
  import type { LensItem } from '../lib/query.js';
  import { collectionPath, folderPath, lensPath, resourcePath } from '../lib/routes.js';
  import { rowOf } from '../lib/rows.js';
  import NewFolderRow from './NewFolderRow.svelte';
  import NotFound from './NotFound.svelte';

  /**
   * The page of a folder of a Collection (FR-CO-38 to FR-CO-40, DEC-UX-156): the path above it, its name and
   * what it holds, its folders first, then its Resources and Lenses, each A to Z. A whole row opens what it is
   * with a click; the Owner Unit and the Data Team drag it onto a folder, here, in the panel or in the path, to
   * move it (DEC-UX-157), and make, rename and delete folders. Delete stays on: on a folder that holds
   * something, it says so and deletes nothing.
   */
  let {
    collection,
    folderId,
    lenses,
    catalogue,
    go,
    onchanged,
    onmove,
  }: {
    /** Its Collection: undefined while the Collections come, null when the User does not see it. */
    collection: Collection | null | undefined;
    folderId: string;
    lenses: readonly LensItem[] | undefined;
    catalogue: Catalogue;
    go: (path: string) => void;
    /** The folders changed: the Collections are read again. */
    onchanged: () => Promise<void>;
    onmove: Mover;
  } = $props();

  const folder = $derived(collection?.folders.find((candidate) => candidate.id === folderId));
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
  let renaming = $state(false);
  let name = $state('');
  let problem = $state('');
  /** Delete on a folder that is not empty: it says what it still holds, or that it holds what the User does not see. */
  let warning: 'holds' | 'hidden' | undefined = $state();
  // Once what it held is moved out, the warning has done its work.
  $effect(() => {
    if (warning === 'holds' && inside && counted(inside) === 0) warning = undefined;
  });
  $effect(() => {
    void folderId;
    [making, renaming, warning] = [false, false, undefined];
  });

  /** The name is ready to type over as soon as the field is there. */
  const chosen = (input: HTMLInputElement) => {
    input.focus();
    input.select();
  };

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

  async function rename(event: KeyboardEvent) {
    if (!collection || !folder) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      renaming = false;
      return;
    }
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const wanted = name.trim();
    if (wanted.length < 1 || wanted.length > 80) {
      problem = t('folder.problem.name');
      return;
    }
    try {
      if (wanted !== folder.name) {
        await catalogue.renameFolder(collection.id, folder.id, wanted);
        await onchanged();
      }
      renaming = false;
    } catch (error) {
      console.error('The folder could not be renamed', error);
      problem = t('folder.problem.failed');
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
      {#if renaming}
        <input class="page-title rename" bind:value={name} aria-label={t('folder.renameLabel')} maxlength="80" {@attach chosen} onkeydown={rename} />
        <p class="meta hint">{problem || t('folder.renameHint')}</p>
      {:else}
        <h1 class="page-title">{folder.name}</h1>
      {/if}
    </div>
    {#if manage}
      <div class="actions">
        <Button variant="outline" onclick={() => (making = true)}><Icon name="folder-simple-plus-fill" />{t('folder.new')}</Button>
        <Button
          variant="outline"
          onclick={() => {
            [name, problem, renaming] = [folder.name, '', true];
          }}><Icon name="pencil-simple-fill" />{t('folder.rename')}</Button
        >
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
        </tr>
      {/snippet}
      {#if making}<NewFolderRow columns={3} onmake={make} oncancel={() => (making = false)} />{/if}
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
        </tr>
      {/each}
      {#snippet after()}<p class="meta foot">{t('folder.order')}</p>{/snippet}
    </Table>
  {/if}
{/if}

<style>
  .head { display: flex; align-items: flex-start; gap: 14px; margin-top: 10px; }
  .what { flex: 1; min-width: 0; }
  .rename { display: block; width: min(100%, 520px); box-sizing: border-box; margin: 0; padding: 2px 8px; background: var(--surface-solid); color: var(--text-primary); border: 1.5px solid var(--text-muted); border-radius: var(--radius-sm); }
  .rename:focus { outline: none; border-color: var(--text-secondary); }
  .hint { margin: 6px 0 0; }
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

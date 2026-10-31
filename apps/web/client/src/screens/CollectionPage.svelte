<script lang="ts">
  import { tick } from 'svelte';
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import LogList from '@datahub/ui/components/LogList.svelte';
  import MarkdownText from '@datahub/ui/components/MarkdownText.svelte';
  import Table from '@datahub/ui/containers/Table.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { levelName } from '@datahub/ui/foundations/levels.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago } from '@datahub/ui/foundations/when.js';
  import CollectionIcon from '@datahub/ui/marks/CollectionIcon.svelte';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import { renderLog } from '@datahub/contracts/log';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import MessagesButton from './MessagesButton.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import IconButton from '@datahub/ui/primitives/IconButton.svelte';
  import { NotFound as Missing, Refused } from '../lib/api.js';
  import type { Catalogue, Collection, CollectionFields, CollectionResource, LogEntry, OwnerUnit, Resource } from '../lib/catalogue.js';
  import type { requestOf } from '../lib/grain.js';
  import type { Identity } from '../lib/identity.js';
  import type { Registry } from '../lib/registry.js';
  import type { LensItem } from '../lib/query.js';
  import { brokenText } from '../lib/broken.js';
  import { dragging, dragOf, dropOf, isOver, type Mover } from '../lib/dragging.svelte.js';
  import { contents, counted, holdsText } from '../lib/folders.js';
  import { collectionPath, folderPath, lensPath, newLensForPath, resourcePath } from '../lib/routes.js';
  import { rowOf } from '../lib/rows.js';
  import AddResources from './AddResources.svelte';
  import CollectionForm, { type Saved } from './CollectionForm.svelte';
  import NewFolderRow from './NewFolderRow.svelte';
  import NotFound from './NotFound.svelte';

  /**
   * The page of a Collection (Page of a Collection, FR-CO-25 to FR-CO-31): what it is, what needs
   * attention, its Resources, the Lenses its Owner Unit added to it (FR-CO-28) and its recent history.
   * Its Owner Unit and the Data Team edit it in place; the Data Team adds Resources in a sheet and
   * removes them. Without an ID, it is an empty Collection being made (FR-CO-12). Under its head stands
   * its intro (FR-CO-41); it shows only what sits at its top, its folders first (FR-CO-38), and a whole row
   * opens with a click and, for its Owner Unit and the Data Team, moves with a drag onto a folder (FR-CO-40).
   */
  let {
    id,
    lenses,
    catalogue,
    identity,
    registry,
    dataTeam,
    own,
    waiting,
    go,
    onchanged,
    onmove,
    listed,
    messages,
  }: {
    id: string | undefined;
    /** Its Lenses the User sees; undefined while query has not told them. */
    lenses?: readonly LensItem[] | undefined;
    catalogue: Catalogue;
    identity: Identity;
    registry: Registry;
    dataTeam: boolean;
    /** The fixed IDs of the groups of the User. */
    own: readonly string[];
    waiting: readonly Resource[] | undefined;
    go: (path: string) => void;
    /** Something changed that the panel shows: the Collections, or the Resources that wait. */
    onchanged: () => Promise<void>;
    /** Moves something of the Collection into one of its folders (FR-CO-40). */
    onmove: Mover;
    /** The Collection as the panel has it, read again after every move: where its Resources and Lenses sit. */
    listed?: Collection | undefined;
    /** "Messages" with their number, which opens the slide-in (FR-CV-07); left out while they are read. */
    messages?: { count: number | null; href: string };
  } = $props();

  /** The Collection: undefined while it comes, null when it does not exist or may not be seen. */
  let collection: Collection | null | undefined = $state();
  let resources: readonly CollectionResource[] | undefined = $state();
  let log: readonly LogEntry[] | undefined = $state();
  let editing = $state(false);
  let adding = $state(false);
  let making = $state(false);
  let groups: readonly OwnerUnit[] | null | undefined = $state();

  async function load(wanted: string) {
    try {
      const [found, held, entries] = await Promise.all([catalogue.collection(wanted), catalogue.collectionResources(wanted), catalogue.collectionLog(wanted)]);
      if (wanted === id) {
        [collection, resources, log] = [found, held, entries];
      }
    } catch (error) {
      if (wanted !== id) {
        return;
      }
      if (error instanceof Missing) {
        collection = null;
      } else {
        console.error(`The Collection ${wanted} could not be read`, error);
      }
    }
  }

  $effect(() => {
    const wanted = id;
    [collection, resources, log, editing, adding, making] = [undefined, undefined, undefined, wanted === undefined, false, false];
    if (wanted) {
      load(wanted);
    }
  });
  // The groups to choose an Owner Unit from, read when editing starts (TR-CO-03, FR-CO-35).
  $effect(() => {
    if (editing && groups === undefined) {
      (dataTeam ? identity.domainGroups() : identity.groups()).then(
        (found) => (groups = found),
        () => (groups = null),
      );
    }
  });

  async function save(fields: CollectionFields): Promise<Saved> {
    try {
      if (!collection) {
        const created = await catalogue.createCollection(fields);
        await onchanged();
        go(collectionPath(created.id));
        return 'saved';
      }
      const before = collection;
      const changed = Object.fromEntries(
        Object.entries(fields).filter(([key, value]) => (key === 'ownerUnit' ? before.ownerUnit.id : before[key as keyof Collection]) !== value),
      );
      if (Object.keys(changed).length > 0) {
        await catalogue.changeCollection(before.id, changed);
        await Promise.all([load(before.id), onchanged()]);
      }
      editing = false;
      return 'saved';
    } catch (error) {
      if (error instanceof Refused && error.code === 'name_taken') {
        return 'nameTaken';
      }
      console.error('The Collection could not be saved', error);
      return 'failed';
    }
  }

  /** "Edit the intro": the head turns into fields, at the intro (DEC-UX-158). */
  async function editIntro() {
    editing = true;
    await tick();
    const field = document.getElementById('intro') as HTMLTextAreaElement | null;
    field?.scrollIntoView?.({ block: 'center' });
    field?.focus({ preventScroll: true });
    field?.setSelectionRange(0, 0);
    if (field) field.scrollTop = 0;
  }

  async function make(name: string): Promise<boolean> {
    if (!collection) return false;
    try {
      await catalogue.makeFolder(collection.id, name, null);
      await Promise.all([load(collection.id), onchanged()]);
      making = false;
      return true;
    } catch (error) {
      console.error('The folder could not be made', error);
      return false;
    }
  }

  async function dissolve() {
    if (!collection) {
      return;
    }
    try {
      await catalogue.dissolveCollection(collection.id);
      await onchanged();
      go('/collections');
    } catch (error) {
      console.error('The Collection could not be dissolved', error);
    }
  }

  async function add(items: ReturnType<typeof requestOf>[]): Promise<{ outcome: 'added' | 'elsewhere' | 'refused' | 'failed'; message?: string }> {
    if (!collection) {
      return { outcome: 'failed' };
    }
    try {
      resources = await catalogue.addResources(collection.id, items);
      adding = false;
      await Promise.all([load(collection.id), onchanged()]);
      return { outcome: 'added' };
    } catch (error) {
      if (error instanceof Refused && error.code === 'in_another_collection') {
        await onchanged();
        return { outcome: 'elsewhere' };
      }
      console.error('The Resources could not be added', error);
      return error instanceof Refused && error.code === 'invalid_request' ? { outcome: 'refused', message: error.detail } : { outcome: 'failed' };
    }
  }

  async function remove(resource: CollectionResource) {
    if (!collection) {
      return;
    }
    try {
      await catalogue.removeResource(resource.id);
      await Promise.all([load(collection.id), onchanged()]);
    } catch (error) {
      console.error(`${resource.displayName} could not be removed`, error);
    }
  }

  const published = $derived(new Set(collection?.resources.filter((item) => item.published).map((item) => item.id)));
  /** What sits at its top: its folders, and the Resources and Lenses in none (FR-CO-38). */
  const placed = $derived(listed && listed.id === collection?.id ? listed : collection);
  const top = $derived(placed ? contents(placed, lenses ?? [], null) : undefined);
  const atTop = $derived(new Set(top?.resources.map((item) => item.id)));
  const topResources = $derived(collection?.folders.length ? (resources ?? []).filter((resource) => atTop.has(resource.id)) : resources);
  const unpublished = $derived((resources ?? []).filter((resource) => !published.has(resource.id)));
  const names = $derived(
    new Intl.ListFormat(currentLanguage() === 'nl' ? 'nl-BE' : 'en-GB').format(
      unpublished.length > 3 ? [...unpublished.slice(0, 3).map((resource) => resource.displayName), t('collection.more', { count: unpublished.length - 3 })] : unpublished.map((resource) => resource.displayName),
    ),
  );
</script>

{#if id === undefined}
  <Breadcrumb steps={[{ label: 'Collections', href: '/collections' }, { label: t('collections.new') }]} />
  <CollectionForm {groups} {dataTeam} {own} onsave={save} oncancel={() => go('/collections')} />
{:else if collection === null}
  <NotFound />
{:else if collection}
  {@const shown = collection}
  {@const here = placed ?? collection}
  <Breadcrumb steps={[{ label: 'Collections', href: '/collections' }, { label: shown.name }]} />
  {#if editing}
    {#key shown.id}
      <CollectionForm
        collection={shown}
        {groups}
        {dataTeam}
        held={shown.resources.length}
        onsave={save}
        oncancel={() => (editing = false)}
        ondissolve={dissolve}
      />
    {/key}
  {:else}
    <div class="head">
      <CollectionIcon name={shown.icon} large />
      <div class="what">
        <h1 class="page-title">{shown.name}</h1>
        <p class="prose">{shown.description}</p>
      </div>
      <div class="actions">
        {#if messages}<MessagesButton href={messages.href} count={messages.count} />{/if}
        {#if shown.canManage}<Button variant="outline" onclick={() => (editing = true)}><Icon name="pencil-simple-fill" />{t('collection.edit')}</Button>{/if}
        {#if dataTeam}<Button variant="outline" onclick={() => (adding = true)}><Icon name="plus-circle-fill" />{t('collection.addResources')}</Button>{/if}
      </div>
    </div>
    <div class="status-row">
      <Chip><Icon name="users-three-fill" />{t('collection.owner', { owner: shown.ownerUnit.name })}</Chip>
      <Chip>
        <Icon name={shown.visibility === 'public' ? 'globe-simple-fill' : 'lock-simple-fill'} />{t(shown.visibility === 'public' ? 'collections.public' : 'collections.private')}
      </Chip>
    </div>
    <!-- The intro its Owner Unit writes, in Markdown, under the head; without one, nothing shows (DEC-UX-158). -->
    {#if shown.intro.trim()}
      <section class="intro card" aria-label={t('collection.intro')}>
        <div class="intro-head">
          <p class="label">{t('collection.intro')}</p>
          {#if shown.canManage}<button type="button" class="text-link" onclick={editIntro}><Icon name="pencil-simple-fill" /><span>{t('collection.intro.edit')}</span></button>{/if}
        </div>
        <MarkdownText source={shown.intro} />
      </section>
    {/if}
  {/if}

  {#if shown.canManage && unpublished.length > 0 && !editing}
    <section class="attention card" aria-label={t('collection.attention')}>
      <div class="label">{t('collection.attention')}</div>
      <div class="line">
        <span class="sign"><Icon name="eye-slash-fill" /></span>
        <p>{t('collection.attention.unpublished', { count: unpublished.length, names, owner: shown.ownerUnit.name })}</p>
      </div>
    </section>
  {/if}

  {#if top && (here.folders.length > 0 || (shown.canManage && !editing))}
    <!-- Its folders, each with what it holds; a whole row opens it, and something dragged onto it goes in (DEC-UX-156, DEC-UX-157). -->
    <div class="section-head">
      <h2>{t('collection.folders')}</h2>
      {#if shown.canManage && !editing}
        <button type="button" class="text-link" onclick={() => (making = true)}><Icon name="folder-simple-plus-fill" /><span>{t('folder.new')}</span></button>
      {/if}
    </div>
    {#if top.folders.length === 0 && !making}
      <p class="meta empty">{t('collection.folders.none')}</p>
    {:else}
      <Table label={t('collection.folders')}>
        {#snippet head()}
          <tr>
            <th>{t('collection.column.name')}</th>
            <th>{t('collection.folders.holds')}</th>
            <th>{t('collection.column.change')}</th>
          </tr>
        {/snippet}
        {#if making}<NewFolderRow columns={3} onmake={make} oncancel={() => (making = false)} />{/if}
        {#each top.folders as folder (folder.id)}
          <tr
            class="row"
            class:drop={isOver(here, folder.id)}
            class:dragging={dragging.item?.id === folder.id}
            {...rowOf(folderPath(shown.id, folder.id), go)}
            {...dragOf({ kind: 'folder', id: folder.id, name: folder.name, collectionId: shown.id, from: null }, shown.canManage)}
            {...shown.canManage ? dropOf(here, folder, onmove) : {}}
          >
            <td><span class="name"><span class="folder" role="img" aria-label={t('folder.kind')}><Icon name="folder-fill" /></span><span>{folder.name}</span></span></td>
            <td class="muted">{holdsText(contents(here, lenses ?? [], folder.id))}</td>
            <td class="muted">{t('folder.made', { name: folder.createdBy, time: ago(folder.createdAt, currentLanguage()) })}</td>
          </tr>
        {/each}
      </Table>
    {/if}
  {/if}

  <div class="section-head">
    <h2>Resources</h2>
    {#if dataTeam && !editing}
      <button type="button" class="text-link" onclick={() => (adding = true)}><Icon name="plus-circle-fill" /><span>{t('collection.addResources')}</span></button>
    {/if}
  </div>
  {#if resources && resources.length === 0}
    <p class="meta empty">{t(shown.canManage ? 'collection.resources.none' : 'collection.resources.nonePublished')}</p>
  {:else if topResources && topResources.length === 0}
    <p class="meta empty">{t('collection.resources.inFolders', { name: shown.name, count: resources?.length ?? 0 })}</p>
  {:else if topResources}
    <Table label="Resources">
      {#snippet head()}
        <tr>
          <th>{t('collection.column.name')}</th>
          <th>Level</th>
          <th>{t('collection.column.publication')}</th>
          <th>Signals</th>
          <th>{t('collection.column.change')}</th>
          {#if dataTeam}<th><span class="hidden">{t('collection.column.remove')}</span></th>{/if}
        </tr>
      {/snippet}
      {#each topResources as resource (resource.id)}
        <tr
          class="row"
          class:quiet={!published.has(resource.id)}
          class:dragging={dragging.item?.id === resource.id}
          {...rowOf(resourcePath(resource.id), go)}
          {...dragOf({ kind: 'resource', id: resource.id, name: resource.displayName, collectionId: shown.id, from: null }, shown.canManage)}
        >
          <td><span class="name"><KindIcon kind="resource" /><span>{resource.displayName}</span></span></td>
          <td>
            <span class="level"><MaturityIcon level={resource.level} tooltip={false} />{levelName(resource.level)}</span>
            {#if resource.deprecated}<span class="deprecated">{t('status.deprecated')}</span>{/if}
          </td>
          <td class="muted">{t(resource.published ? 'status.published' : 'status.notPublished')}</td>
          <td class="muted">—</td>
          <td class="muted">
            {#if resource.lastChange}
              {@const text = renderLog(resource.lastChange.logId, resource.lastChange.params, currentLanguage())}
              <span class="change"><span class="change-text" title={text}>{text}</span><span class="when">&nbsp;· {ago(resource.lastChange.at, currentLanguage())}</span></span>
            {/if}
          </td>
          {#if dataTeam}
            <td class="remove">
              <IconButton icon="minus-circle" label={t('collection.remove', { name: resource.displayName })} onclick={() => remove(resource)} />
            </td>
          {/if}
        </tr>
      {/each}
      {#snippet after()}{#if here.folders.length > 0}<p class="meta foot">{t('collection.resources.top')}</p>{/if}{/snippet}
    </Table>
  {/if}

  {#if lenses && top}
    <div class="section-head">
      <h2>{t('collection.lenses')}</h2>
      {#if shown.canManage && !editing}<a class="text-link" href={newLensForPath(shown.id)}><Icon name="plus-circle-fill" /><span>{t('collection.addLens')}</span></a>{/if}
    </div>
    {#if lenses.length === 0}
      <p class="meta empty">{t('collection.lenses.none')}</p>
    {:else if top.lenses.length === 0}
      <p class="meta empty">{t('collection.lenses.top', { name: shown.name, count: lenses.length })}</p>
    {:else}
      <Table label={t('collection.lenses')}>
        {#snippet head()}
          <tr>
            <th>{t('collection.lenses.name')}</th>
            <th>{t('collection.lenses.builtOn')}</th>
            <th>{t('collection.lenses.level')}</th>
            <th>{t('collection.lenses.madeBy')}</th>
          </tr>
        {/snippet}
        {#each top.lenses as lens (lens.id)}
          <tr
            class="row"
            class:quiet={lens.state === 'waiting' || lens.state === 'refused'}
            class:dragging={dragging.item?.id === lens.id}
            {...rowOf(lensPath(lens.id), go)}
            {...dragOf({ kind: 'lens', id: lens.id, name: lens.name, collectionId: shown.id, from: null }, shown.canManage)}
          >
            <td>
              <span class="name"><KindIcon kind="lens" broken={brokenText(lens.broken)} /><span>{lens.name}</span></span>
              {#if lens.state === 'waiting'}<span class="deprecated">{t('collection.lenses.waiting')}</span>{:else if lens.state === 'refused'}<span class="deprecated">{t('lens.state.refused')}</span>{:else if lens.state === 'stopped'}<span class="deprecated">{t('status.stopped')}</span>{/if}
            </td>
            <td class="muted">{lens.resources.map((resource) => resource.displayName).join(', ')}</td>
            <td><span class="level"><MaturityIcon level={lens.level} tooltip={false} />{levelName(lens.level)}</span></td>
            <td class="muted">{lens.authorName}</td>
          </tr>
        {/each}
      </Table>
      <p class="meta note">{t('collection.lenses.note', { owner: shown.ownerUnit.name })}</p>
    {/if}
  {/if}

  <div class="section-head"><h2>{t('collection.history')}</h2></div>
  {#if log}
    <div class="history card"><LogList entries={log.slice(0, 8)} /></div>
  {/if}

  {#if adding && waiting}
    <AddResources collection={shown.name} {waiting} {catalogue} {registry} onadd={add} onclose={() => (adding = false)} />
  {/if}
{/if}

<style>
  .deprecated { display: block; margin-top: 2px; font-size: var(--text-meta); color: var(--signal-warn); }
  .head { display: flex; align-items: flex-start; gap: 14px; margin-top: 10px; }
  .what { flex: 1; min-width: 0; }
  .prose { margin: 6px 0 0; max-width: 68ch; line-height: 1.65; color: var(--text-secondary); }
  .actions { display: flex; gap: 8px; align-items: center; flex: none; }
  .status-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
  .attention { margin-top: 16px; border-radius: var(--radius-lg); padding: 14px 18px; }
  .label { font-size: var(--text-meta); color: var(--text-muted); margin-bottom: 8px; }
  .line { display: flex; align-items: center; gap: 10px; padding: 7px 0; font-size: var(--text-small); }
  .sign { display: inline-flex; font-size: 16px; color: var(--signal-warn); flex: none; }
  .line p { flex: 1; margin: 0; line-height: 1.5; }
  .section-head { display: flex; align-items: center; gap: 6px; margin: 26px 0 12px; }
  .section-head h2 { font-size: var(--text-section); font-weight: var(--weight-medium); flex: 1; margin: 0; }
  .text-link { all: unset; font-size: var(--text-small); color: var(--text-secondary); display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
  .text-link:hover span { text-decoration: underline; text-underline-offset: 3px; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
  .name { display: flex; align-items: center; gap: 8px; color: inherit; font-weight: var(--weight-medium); }
  .folder { display: inline-flex; font-size: 17px; color: var(--text-secondary); }
  .foot { margin: 8px 10px 2px; }
  .intro { margin-top: 16px; padding: 16px 20px; border-radius: var(--radius-lg); }
  .intro-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .intro-head .label { flex: 1; margin: 0; }
  .name :global(.kind) { font-size: 14px; color: var(--text-muted); }
  .level { display: inline-flex; align-items: center; gap: 7px; color: var(--text-secondary); white-space: nowrap; }
  .muted { color: var(--text-muted); }
  .change { display: flex; max-width: 400px; }
  .change-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .when { flex: none; white-space: nowrap; }
  .remove { width: 1%; }
  .hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .history { border-radius: var(--radius-lg); padding: 10px 18px; }
  .history :global(.log) { margin-top: 0; }
  .empty { margin: 0; }
  .note { display: block; margin: 10px 4px 0; line-height: 1.5; }
</style>

<script lang="ts">
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import LogList from '@datahub/ui/components/LogList.svelte';
  import Table from '@datahub/ui/containers/Table.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { levelName } from '@datahub/ui/foundations/levels.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago, day } from '@datahub/ui/foundations/when.js';
  import CollectionIcon from '@datahub/ui/marks/CollectionIcon.svelte';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import { renderLog } from '@datahub/contracts/log';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import IconButton from '@datahub/ui/primitives/IconButton.svelte';
  import { NotFound as Missing, Refused } from '../lib/api.js';
  import type { Catalogue, Collection, CollectionFields, CollectionResource, LogEntry, OwnerUnit, Resource } from '../lib/catalogue.js';
  import type { requestOf } from '../lib/grain.js';
  import type { Identity } from '../lib/identity.js';
  import type { Registry } from '../lib/registry.js';
  import { collectionPath, resourcePath } from '../lib/routes.js';
  import AddResources from './AddResources.svelte';
  import CollectionForm, { type Saved } from './CollectionForm.svelte';
  import NotFound from './NotFound.svelte';

  /**
   * The page of a Collection (Page of a Collection, FR-CO-25 to FR-CO-31): what it is, what needs
   * attention, its Resources and its recent history. Its Owner Unit and the Data Team edit it in
   * place; the Data Team adds Resources in a sheet and removes them. Without an ID, it is an empty
   * Collection being made (FR-CO-12). Lenses come with their part.
   */
  let {
    id,
    catalogue,
    identity,
    registry,
    dataTeam,
    own,
    waiting,
    go,
    onchanged,
  }: {
    id: string | undefined;
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
  } = $props();

  /** The Collection: undefined while it comes, null when it does not exist or may not be seen. */
  let collection: Collection | null | undefined = $state();
  let resources: readonly CollectionResource[] | undefined = $state();
  let log: readonly LogEntry[] | undefined = $state();
  let editing = $state(false);
  let adding = $state(false);
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
    [collection, resources, log, editing, adding] = [undefined, undefined, undefined, wanted === undefined, false];
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
        {#if shown.canManage}<Button variant="outline" onclick={() => (editing = true)}><Icon name="pencil-simple-fill" />{t('collection.edit')}</Button>{/if}
        {#if dataTeam}<Button variant="outline" onclick={() => (adding = true)}><Icon name="plus-circle-fill" />{t('collection.addResources')}</Button>{/if}
      </div>
    </div>
    <div class="status-row">
      <Chip><Icon name="users-three-fill" />{t('collection.owner', { owner: shown.ownerUnit.name })}</Chip>
      <Chip>
        <Icon name={shown.visibility === 'public' ? 'globe-simple-fill' : 'lock-simple-fill'} />{t(shown.visibility === 'public' ? 'collections.public' : 'collections.private')}
      </Chip>
      <Chip><Icon name="table" />{t('collections.count', { count: shown.resources.length })}</Chip>
      <Chip><Icon name="calendar-blank-fill" />{t('collection.created', { date: day(shown.createdAt, currentLanguage()), name: shown.createdBy })}</Chip>
    </div>
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

  <div class="section-head">
    <h2>Resources</h2>
    {#if dataTeam && !editing}
      <button type="button" class="text-link" onclick={() => (adding = true)}><Icon name="plus-circle-fill" /><span>{t('collection.addResources')}</span></button>
    {/if}
  </div>
  {#if resources && resources.length === 0}
    <p class="meta empty">{t(shown.canManage ? 'collection.resources.none' : 'collection.resources.nonePublished')}</p>
  {:else if resources}
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
      {#each resources as resource (resource.id)}
        <tr class:quiet={!published.has(resource.id)}>
          <td><a class="name" href={resourcePath(resource.id)}><KindIcon kind="resource" /><span>{resource.displayName}</span></a></td>
          <td><span class="level"><MaturityIcon level={resource.level} tooltip={false} />{levelName(resource.level)}</span></td>
          <td class="muted">{published.has(resource.id) ? '' : t('status.notPublished')}</td>
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
    </Table>
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
  .name { display: flex; align-items: center; gap: 8px; color: inherit; text-decoration: none; font-weight: var(--weight-medium); }
  .name:hover span { text-decoration: underline; text-underline-offset: 3px; }
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
</style>

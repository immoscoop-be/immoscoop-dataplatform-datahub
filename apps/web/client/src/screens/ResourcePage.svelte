<script lang="ts">
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import ObjectHeader from '@datahub/ui/components/ObjectHeader.svelte';
  import StatusRow from '@datahub/ui/components/StatusRow.svelte';
  import Callout from '@datahub/ui/containers/Callout.svelte';
  import Tabs from '@datahub/ui/containers/Tabs.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import Sentence from '@datahub/ui/foundations/Sentence.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import type { Card, Catalogue, Collection, LogEntry, Related, ResourceDetail } from '../lib/catalogue.js';
  import type { Registry } from '../lib/registry.js';
  import { collectionPath } from '../lib/routes.js';
  import RelationsSheet from './RelationsSheet.svelte';
  import ResourceColumns from './ResourceColumns.svelte';
  import ResourceLineage from './ResourceLineage.svelte';
  import ResourceOverview from './ResourceOverview.svelte';

  /**
   * The page of a Resource (Detail page of a Resource): its name and Key, its state in a status row, and
   * its tabs Overview, Columns, Lineage, History and Preview (DEC-UX-90). Its Owner Unit and the Data Team
   * edit what Data Hub keeps about it in place (FR-RC-15); a Data Admin changes its grain and relations
   * (DEC-UX-107). A Resource without a Collection says so, and only the Data Team sees it. "Query",
   * "Messages", "Ask a question", History and Preview are there and still empty: they come with Query
   * and the Messages.
   */
  let {
    resource,
    log,
    collection,
    catalogue,
    registry,
    dataTeam,
    onchange,
  }: {
    resource: ResourceDetail;
    log: readonly LogEntry[] | undefined;
    collection: Collection | undefined;
    catalogue: Catalogue;
    registry: Registry;
    dataTeam: boolean;
    /** The Resource as it is after a change, for the rest of the app. */
    onchange: (resource: ResourceDetail) => void;
  } = $props();

  // The tabs of a Resource (DEC-UX-90).
  const TABS = [
    { id: 'overview', label: 'resource.tab.overview' },
    { id: 'columns', label: 'resource.tab.columns' },
    { id: 'lineage', label: 'resource.tab.lineage' },
    { id: 'history', label: 'resource.tab.history' },
    { id: 'preview', label: 'resource.tab.preview' },
  ] as const;
  let tab: string = $state('overview');

  let entries = $derived(log);
  let related: Related[] | undefined = $state();
  let relating = $state(false);

  // Read again for another Resource: what it relates to, and the first tab.
  let readFor: string | undefined;
  $effect(() => {
    const id = resource.id;
    if (readFor === id) {
      return;
    }
    readFor = id;
    tab = 'overview';
    related = undefined;
    relating = false;
    catalogue.related(id).then(
      (found) => resource.id === id && (related = found),
      (error: unknown) => console.error(`What ${resource.displayName} relates to could not be read`, error),
    );
  });

  /** Its Owner Unit and the Data Team edit it, once it is in a Collection and has an Owner (FR-RC-15). */
  const canEdit = $derived(resource.collectionId !== null && collection?.canManage === true);

  const LOCALES = { nl: 'nl-BE', en: 'en-GB' } as const;
  const came = $derived(new Intl.DateTimeFormat(LOCALES[currentLanguage()], { day: 'numeric', month: 'short' }).format(new Date(resource.registeredAt)));

  /** Shows the Resource as catalogue gives it back, with its Log, after a change. */
  async function changed(updated: ResourceDetail) {
    onchange(updated);
    entries = await catalogue.log(updated.id).catch(() => entries);
    related = await catalogue.related(updated.id).catch(() => related);
  }

  async function saveCard(changes: Partial<Card>): Promise<boolean> {
    try {
      await changed(await catalogue.editResource(resource.id, changes));
      return true;
    } catch (error) {
      console.error(`${resource.displayName} could not be changed`, error);
      return false;
    }
  }

  async function saveFields(fields: { name: string; businessDescription: string }[]): Promise<boolean> {
    try {
      await changed(await catalogue.describeFields(resource.id, fields));
      return true;
    } catch (error) {
      console.error(`The fields of ${resource.displayName} could not be changed`, error);
      return false;
    }
  }

  async function saveRelations(details: Record<string, unknown>): Promise<boolean> {
    try {
      await changed(await catalogue.relate(resource.id, details));
      relating = false;
      return true;
    } catch (error) {
      console.error(`The relations of ${resource.displayName} could not be changed`, error);
      return false;
    }
  }
</script>

<Breadcrumb
  steps={[
    { label: 'Collections', href: '/collections' },
    collection ? { label: collection.name, href: collectionPath(collection.id) } : { label: t('collections.unassigned') },
  ]}
/>
<div class="head">
  <div class="name">
    <ObjectHeader name={resource.displayName} key={resource.key} copyLabel={t('resource.copyKey')} />
  </div>
  <div class="actions">
    <Button variant="outline" disabled title={t('resource.later')}><Icon name="terminal-window-fill" />{t('resource.query')}</Button>
    <Button variant="outline" disabled title={t('resource.later')}><Icon name="chat-circle-text-fill" />{t('resource.messages')}</Button>
    <Button disabled title={t('resource.later')}><Icon name="chat-circle-dots-fill" />{t('resource.ask')}</Button>
  </div>
</div>
<StatusRow level={resource.level} published={false} owner={collection?.ownerUnit.name ?? null} />

{#if resource.collectionId === null}
  <Callout icon="tray-fill">
    <b>{t('resource.waiting.title')}</b>
    <Sentence
      key="resource.waiting.text"
      values={{ date: came }}
      names={{ exposure: resource.exposures[0] ?? '', project: resource.projectName ?? resource.projectId }}
    />
  </Callout>
{:else if collection}
  <Callout icon="eye-slash-fill">
    <b>{t('resource.unpublished.title')}</b>
    {t('resource.unpublished.text', { owner: collection.ownerUnit.name, collection: collection.name })}
  </Callout>
{/if}

<Tabs label={resource.displayName} current={tab} tabs={TABS.map(({ id, label }) => ({ id, label: t(label) }))} onselect={(id) => (tab = id)}>
  {#if tab === 'overview'}
    <ResourceOverview {resource} log={entries} {related} {canEdit} onsave={saveCard} />
  {:else if tab === 'columns'}
    <ResourceColumns {resource} {canEdit} relate={dataTeam && resource.collectionId !== null} onsave={saveFields} onrelate={() => (relating = true)} />
  {:else if tab === 'lineage'}
    <ResourceLineage {resource} {catalogue} />
  {:else}
    <p class="meta soon">{t('resource.soon')}</p>
  {/if}
</Tabs>

{#if relating}
  <RelationsSheet {resource} {registry} onsave={saveRelations} onclose={() => (relating = false)} />
{/if}

<style>
  b { font-weight: var(--weight-medium); }
  .head { display: flex; align-items: flex-start; gap: 14px; }
  .name { flex: 1; min-width: 0; }
  .actions { display: flex; gap: 8px; align-items: center; flex: none; margin-top: 10px; }
  .soon { display: flex; justify-content: center; padding: 40px; font-size: var(--text-body); margin: 0; }
</style>

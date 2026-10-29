<script lang="ts">
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import ObjectHeader from '@datahub/ui/components/ObjectHeader.svelte';
  import StatusRow from '@datahub/ui/components/StatusRow.svelte';
  import Callout from '@datahub/ui/containers/Callout.svelte';
  import Tabs from '@datahub/ui/containers/Tabs.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { levelName } from '@datahub/ui/foundations/levels.js';
  import Sentence from '@datahub/ui/foundations/Sentence.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import MessagesButton from './MessagesButton.svelte';
  import { cardsOf } from '../lib/learning.js';
  import { useLearning } from '../lib/learning-context.js';
  import type { Card, Catalogue, Collection, LogEntry, Related, ResourceDetail } from '../lib/catalogue.js';
  import type { QueryClient, Storage } from '../lib/query.js';
  import type { Registry } from '../lib/registry.js';
  import { collectionPath, newQueryPath, resourcePath } from '../lib/routes.js';
  import DeprecateSheet from './DeprecateSheet.svelte';
  import LearningPop from './LearningPop.svelte';
  import LearningRef from './LearningRef.svelte';
  import PublishSheet from './PublishSheet.svelte';
  import RelationsSheet from './RelationsSheet.svelte';
  import ResourceColumns from './ResourceColumns.svelte';
  import ResourceHistory from './ResourceHistory.svelte';
  import ResourceLineage from './ResourceLineage.svelte';
  import ResourceOverview from './ResourceOverview.svelte';
  import ResourcePreview from './ResourcePreview.svelte';

  /**
   * The page of a Resource (Detail page of a Resource): its name and Key, its state in a status row, and
   * its tabs Overview, Columns, Lineage, History and Preview (DEC-UX-90). Its Owner Unit and the Data Team
   * edit what Data Hub keeps about it in place (FR-RC-15); a Data Admin changes its grain and relations
   * (DEC-UX-107). A Resource without a Collection says so, and only the Data Team sees it. Its Owner
   * publishes it, the first Confirmation (FR-SR-49); once published, its Owner Unit and the Data Team
   * deprecate it (FR-SR-50), and mark seen what changed since its last Confirmation (FR-MR-12). Its
   * Preview shows its first rows (FR-SR-38); its History, the queries that used it, only for its Owner
   * Unit and the Data Team (DEC-SR-41). "Messages" and "Ask a question" are there and still empty: they
   * come with the Messages.
   */
  let {
    resource,
    log,
    collection,
    collections,
    catalogue,
    registry,
    queries,
    dataTeam,
    groups,
    onchange,
    onrun,
    messages,
  }: {
    resource: ResourceDetail;
    log: readonly LogEntry[] | undefined;
    collection: Collection | undefined;
    /** Every Collection the User sees, for a Resource to use instead of a deprecated one. */
    collections: readonly Collection[] | undefined;
    catalogue: Catalogue;
    registry: Registry;
    queries: QueryClient;
    dataTeam: boolean;
    /** The groups of the User: its Owner publishes it (FR-SR-16). */
    groups: readonly string[];
    /** The Resource as it is after a change, for the rest of the app. */
    onchange: (resource: ResourceDetail) => void;
    /** After a run of its Preview, for the panel of Query. */
    onrun?: () => void;
    /** "Messages" with their number, which opens the slide-in (FR-CV-07); left out while they are read. */
    messages?: { count: number | null; href: string };
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
  /** Its size and partitions from BigQuery (FR-SR-39); null where BigQuery does not tell them. */
  let storage: Storage | null | undefined = $state();
  let relating = $state(false);
  let sheet: 'publish' | 'deprecate' | undefined = $state();
  let failed = $state(false);

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
    storage = undefined;
    relating = false;
    sheet = undefined;
    failed = false;
    catalogue.related(id).then(
      (found) => resource.id === id && (related = found),
      (error: unknown) => console.error(`What ${resource.displayName} relates to could not be read`, error),
    );
    queries.storage(id).then(
      (found) => resource.id === id && (storage = found),
      (error: unknown) => {
        if (resource.id === id) storage = null;
        console.error(`The size of ${resource.displayName} could not be read`, error);
      },
    );
  });

  /** Its Owner Unit and the Data Team edit it, once it is in a Collection and has an Owner (FR-RC-15). */
  const canEdit = $derived(resource.collectionId !== null && collection?.canManage === true);
  /** Only its Owner Unit and the Data Team see the queries on it (DEC-SR-41). */
  const tabs = $derived(TABS.filter(({ id }) => id !== 'history' || dataTeam || canEdit));
  /** Only its Owner publishes it: a member of the Owner Unit of its Collection (FR-SR-16). */
  const isOwner = $derived(collection !== undefined && groups.includes(collection.ownerUnit.id));
  /** The published Resources the User sees, to use instead of this one. */
  const others = $derived(
    (collections ?? []).flatMap((one) => one.resources.filter((item) => item.published && item.id !== resource.id).map((item) => ({ ...item, collection: one.name }))),
  );

  const LOCALES = { nl: 'nl-BE', en: 'en-GB' } as const;
  const came = $derived(new Intl.DateTimeFormat(LOCALES[currentLanguage()], { day: 'numeric', month: 'short' }).format(new Date(resource.registeredAt)));
  const day = (value: string) => new Intl.DateTimeFormat(LOCALES[currentLanguage()], { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  const CHANGE_KEYS = { added: 'resource.change.added', removed: 'resource.change.removed', retyped: 'resource.change.retyped' } as const;
  /** What changed since its last Confirmation, in one sentence, as the warning says it (DEC-UX-64). */
  const changedText = $derived(
    resource.changes
      .map((change) => t(CHANGE_KEYS[change.change], { field: change.field, old: change.old ?? '', new: change.new ?? '', date: day(change.at) }))
      .join('; '),
  );
  const reason = $derived(resource.deprecation ? resource.deprecation.reason.replace(/([^.!?])$/, '$1.') : '');

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

  /** Publishes it, marks its changes seen, deprecates it or takes that away: each a step that is logged. */
  async function act(step: () => Promise<ResourceDetail>): Promise<boolean> {
    failed = false;
    try {
      await changed(await step());
      sheet = undefined;
      return true;
    } catch (error) {
      console.error(`${resource.displayName} could not be changed`, error);
      failed = true;
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

  /** The Learning Centre explains its Level, its grain, its model type and "Mark as seen" (FR-LR-35). */
  const learning = useLearning();
  const levelCards = $derived(learning ? cardsOf('level', learning.shown).length : 0);
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
    {#if resource.published && canEdit}
      {#if resource.deprecation}
        <Button variant="outline" onclick={() => act(() => catalogue.undeprecate(resource.id))}><Icon name="arrow-counter-clockwise" />{t('resource.takeAway')}</Button>
      {:else}
        <Button variant="outline" onclick={() => (sheet = 'deprecate')}><Icon name="archive-fill" />{t('resource.deprecate')}</Button>
      {/if}
    {/if}
    <Button variant="outline" href={newQueryPath(resource.id)}><Icon name="terminal-window-fill" />{t('resource.query')}</Button>
    {#if messages}<MessagesButton href={messages.href} count={messages.count} />{/if}
    {#if !resource.published && isOwner}
      <!-- For its Owner, while it is not published, "Publish" takes the place of "Ask a question" (DEC-UX-31). -->
      <Button onclick={() => (sheet = 'publish')}><Icon name="globe-simple-fill" />{t('resource.publish')}</Button>
    {:else}
      <!-- "Ask a question" opens the slide-in with Question chosen (DEC-UX-29). -->
      {#if messages}<Button href={messages.href}><Icon name="chat-circle-dots-fill" />{t('resource.ask')}</Button>{/if}
    {/if}
  </div>
</div>
{#snippet levelPop(close: () => void)}<LearningPop place="level" {close} />{/snippet}
<StatusRow
  level={resource.level}
  published={resource.published}
  owner={collection?.ownerUnit.name ?? null}
  deprecated={resource.deprecation?.reason ?? null}
  explainLevel={levelCards ? { label: t('learning.pop.head', { count: levelCards }), active: learning?.window?.from === 'level', pop: levelPop } : undefined}
/>
{#if failed}<p class="failed" role="alert">{t('resource.actionFailed')}</p>{/if}

{#if resource.collectionId === null}
  <Callout icon="tray-fill">
    <b>{t('resource.waiting.title')}</b>
    <Sentence
      key="resource.waiting.text"
      values={{ date: came }}
      names={{ exposure: resource.exposures[0] ?? '', project: resource.projectName ?? resource.projectId }}
    />
  </Callout>
{:else if collection && !resource.published}
  <Callout icon="eye-slash-fill">
    <b>{t('resource.unpublished.title')}</b>
    {t('resource.unpublished.text', { owner: collection.ownerUnit.name, collection: collection.name })}
  </Callout>
{/if}
{#if resource.deprecation}
  <!-- Who deprecated it, when, why and what to use instead; it stays usable (DEC-UX-101). -->
  <Callout icon="archive-fill">
    <b>{t('resource.deprecated.title')}</b>
    {t('resource.deprecated.text', { by: resource.deprecation.by, date: day(resource.deprecation.at), reason })}
    {t('resource.deprecated.still')}
    {#snippet action()}
      {#if resource.deprecation?.insteadOf}
        <Button variant="outline" href={resourcePath(resource.deprecation.insteadOf.id)}>{t('resource.deprecated.use', { name: resource.deprecation.insteadOf.displayName })}</Button>
      {/if}
    {/snippet}
  </Callout>
{/if}
{#if resource.changes.length > 0}
  <!-- A change since the last Confirmation, for everyone who sees it; the Level stays (DEC-UX-64). -->
  <Callout icon="warning-circle-fill" tone="warning">
    <b>{t('resource.changed.title')}</b>
    {t('resource.changed.text', { changes: changedText, level: levelName(resource.level) })}
    {#snippet action()}
      {#if canEdit}
        <LearningRef place="changesSeen" shape="pill" focusable={false}>
          {#snippet children(mark)}<Button variant="outline" onclick={() => act(() => catalogue.markSeen(resource.id))}>{t('resource.changed.seen')}{@render mark?.()}</Button>{/snippet}
        </LearningRef>
      {/if}
    {/snippet}
  </Callout>
{/if}

<Tabs label={resource.displayName} current={tab} tabs={tabs.map(({ id, label }) => ({ id, label: t(label) }))} onselect={(id) => (tab = id)}>
  {#if tab === 'overview'}
    <ResourceOverview {resource} log={entries} {related} {storage} {canEdit} onsave={saveCard} />
  {:else if tab === 'columns'}
    <ResourceColumns {resource} {canEdit} relate={dataTeam && resource.collectionId !== null} onsave={saveFields} onrelate={() => (relating = true)} />
  {:else if tab === 'lineage'}
    <ResourceLineage {resource} {catalogue} />
  {:else if tab === 'history' && (dataTeam || canEdit)}
    <ResourceHistory {resource} client={queries} />
  {:else if tab === 'preview'}
    <ResourcePreview {resource} client={queries} {storage} {onrun} />
  {/if}
</Tabs>

{#if relating}
  <RelationsSheet {resource} {registry} onsave={saveRelations} onclose={() => (relating = false)} />
{/if}
{#if sheet === 'publish' && collection}
  <PublishSheet
    {resource}
    {collection}
    onpublish={() => act(() => catalogue.publish(resource.id))}
    onfields={() => {
      sheet = undefined;
      tab = 'columns';
    }}
    onclose={() => (sheet = undefined)}
  />
{:else if sheet === 'deprecate' && collection}
  <DeprecateSheet
    {resource}
    {collection}
    {others}
    ondeprecate={(why, instead) => act(() => catalogue.deprecate(resource.id, why, instead))}
    onclose={() => (sheet = undefined)}
  />
{/if}

<style>
  b { font-weight: var(--weight-medium); }
  .head { display: flex; align-items: flex-start; gap: 14px; }
  .name { flex: 1; min-width: 0; }
  .actions { display: flex; gap: 8px; align-items: center; flex: none; margin-top: 10px; }
  .failed { margin: 8px 0 0; font-size: var(--text-small); color: var(--signal-urgent); }
</style>

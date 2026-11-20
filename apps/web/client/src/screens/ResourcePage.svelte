<script lang="ts">
  import { tick, untrack } from 'svelte';
  import type { GapScope } from '@datahub/contracts/gaps';
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
  import type { CardChanges, Catalogue, Collection, DescribeAttribute, KnownGap, LogEntry, Related, ResourceDetail } from '../lib/catalogue.js';
  import { can, canWith, reach, removable, type Permissions } from '../lib/permissions.js';
  import type { Conversation, WrittenKind } from '../lib/messages.js';
  import type { QueryClient, Storage } from '../lib/query.js';
  import type { Registry } from '../lib/registry.js';
  import { collectionPath, newQueryPath, type ResourceSpot, resourcePath } from '../lib/routes.js';
  import { command, place, useScreenCommands, view } from '../lib/commands.svelte.js';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import type { QuickRow } from '../lib/quick.js';
  import { Refused } from '../lib/api.js';
  import { checklistOf } from '../lib/journey.js';
  import { FLOW_PLACES, type FlowStepId, isFlowStep } from '../lib/flowBox.js';
  import { flowBox } from '../lib/flowBox.svelte.js';
  import type { requestOf } from '../lib/grain.js';
  import { missingWords, roleWords } from '../lib/typeFields.js';
  import AddResources from './AddResources.svelte';
  import LearningPop from './LearningPop.svelte';
  import LearningRef from './LearningRef.svelte';
  import PublishSheet from './PublishSheet.svelte';
  import RelationsSheet, { type RelationsStart } from './RelationsSheet.svelte';
  import ResourceColumns from './ResourceColumns.svelte';
  import ResourceHistory from './ResourceHistory.svelte';
  import ResourceLineage from './ResourceLineage.svelte';
  import ResourceOverview, { type OverviewPart } from './ResourceOverview.svelte';
  import ResourcePreview from './ResourcePreview.svelte';

  /**
   * The page of a Resource (Detail page of a Resource): its name and Key, its state in a status row, and
   * its tabs Overview, Columns, Lineage, History and Preview (DEC-UX-90). Its Owner Unit and the Data Team
   * edit what Data Hub keeps about it in place (FR-RC-15); a Data Admin changes its model type, grain and relations
   * (DEC-UX-107, DEC-CO-27). A field of its model type that is gone shows as a warning for everyone (FR-RC-29), and a
   * model type that is incomplete as one for the Data Team (FR-CO-45); each reopens the steps of its relations. A Resource without a Collection says so, and only the Data Team sees it. Its Owner
   * publishes it, the first Confirmation (FR-SR-49); once published, its Owner Unit and the Data Team
   * deprecate it (FR-SR-50), and mark seen what changed since its last Confirmation (FR-MR-12). Its
   * Preview shows its first rows (FR-SR-38); its History, the queries that used it, only for who sees the queries
   * of others on it (DEC-SR-41). What it offers follows the Permissions of the User and the flags catalogue sends
   * (FR-PL-14). "Messages" and "Ask a question" are there and still empty: they
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
    permissions,
    groups,
    onchange,
    onrun,
    messages,
    threads,
    at,
    onguide,
  }: {
    resource: ResourceDetail;
    log: readonly LogEntry[] | undefined;
    collection: Collection | undefined;
    /** Every Collection the User sees, for a Resource to use instead of a deprecated one. */
    collections: readonly Collection[] | undefined;
    catalogue: Catalogue;
    registry: Registry;
    queries: QueryClient;
    /** The Permissions of the User (FR-PL-14). */
    permissions: Permissions;
    /** The groups of the User: its Owner publishes it (FR-SR-16). */
    groups: readonly string[];
    /** The Resource as it is after a change, for the rest of the app. */
    onchange: (resource: ResourceDetail) => void;
    /** After a run of its Preview, for the panel of Query. */
    onrun?: () => void;
    /** "Messages" with their number, which opens the slide-in (FR-CV-07); left out while they are read. */
    /** Its Messages: how many, where, the kinds the User may write on it, and writing one of a kind (DEC-UX-257). */
    messages?: { count: number | null; href: string; kinds?: readonly WrittenKind[]; write?: (kind: WrittenKind) => void };
    /** The Questions, Remarks and Signals on it, the newest first, for its Summary; undefined while they are read. */
    threads?: readonly Conversation[];
    /** The spot its address opens on: a tab, or a part of its Overview, as a link from Claude names it (DEC-CL-19). */
    at?: ResourceSpot;
    /** Opens the Flow Box on it, which takes whoever may describe it through the steps required to publish (FR-MR-20). */
    onguide?: () => void;
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
  /** The steps of its relations, open where they were asked to open (DEC-CO-27); undefined while closed. */
  let relating: RelationsStart | undefined = $state();
  let sheet: 'publish' | undefined = $state();
  /** The part of the Overview on screen, which a deprecation opens on its Danger zone (DEC-UX-176). */
  let part: OverviewPart = $state('summary');
  /** The sheet that adds it to a Collection, while it waits (DEC-UX-131). */
  let adding = $state(false);
  let failed = $state(false);

  /** Opens a spot: one of its tabs, or a part of its Overview; with none, the Overview on its Summary. */
  function goTo(spot: ResourceSpot | undefined) {
    if (spot === 'columns' || spot === 'lineage' || spot === 'history' || spot === 'preview') {
      tab = spot;
      part = 'summary';
    } else {
      tab = 'overview';
      part = spot ?? 'summary';
    }
  }
  // Another spot on the same Resource, from a link: the page goes there.
  let spotFor: string | undefined;
  $effect(() => {
    const key = `${resource.id}:${at ?? ''}`;
    if (spotFor !== undefined && spotFor !== key && untrack(() => readFor) === resource.id) {
      goTo(at);
    }
    spotFor = key;
  });

  // Read again for another Resource: what it relates to, and the first tab on its Summary.
  let readFor: string | undefined;
  $effect(() => {
    const id = resource.id;
    if (readFor === id) {
      return;
    }
    readFor = id;
    goTo(untrack(() => at));
    related = undefined;
    storage = undefined;
    relating = undefined;
    sheet = undefined;
    adding = false;
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

  /** Who manages its Collection, once it is in one and has an Owner (FR-RC-15). */
  const canEdit = $derived(resource.collectionId !== null && collection?.canManage === true);
  /**
   * What the User may describe of it, attribute by attribute (DEC-PL-03): as catalogue says, or else what their
   * Permission group allows where they manage its Collection.
   */
  const describes = (attribute: DescribeAttribute): boolean =>
    resource.canDescribe ? resource.canDescribe[attribute] === true : canEdit && canWith(permissions, 'resources.describe', 'attributes', attribute);
  /** Deprecating it, and undoing that (`resources.deprecate`): as catalogue says, or where they manage its Collection. */
  const canDeprecate = $derived(resource.canDeprecate ?? (canEdit && can(permissions, 'resources.deprecate')));
  /** The queries on it: for who sees every query, or the queries on the Resources of their Owner Units (DEC-SR-41, `queries.seeOthers`). */
  const seesQueries = $derived(reach(permissions, 'queries.seeOthers') === 'every' || (reach(permissions, 'queries.seeOthers') === 'theirs' && canEdit));
  const tabs = $derived(TABS.filter(({ id }) => (id !== 'history' || seesQueries) && (id !== 'preview' || can(permissions, 'resources.preview'))));
  /** Only its Owner publishes it: a member of the Owner Unit of its Collection, who may publish (FR-SR-16, DEC-PL-06). */
  const isOwner = $derived(collection !== undefined && (collection.owned ?? groups.includes(collection.ownerUnit.id)));
  const mayPublish = $derived(resource.canPublish ?? (isOwner && can(permissions, 'resources.publish')));
  /** The Flow Box guides whoever may describe it while it is not published (FR-MR-20, DEC-UX-302). */
  const guides = $derived(
    onguide !== undefined && !resource.published && resource.collectionId !== null && (['description', 'keyFields', 'behaviour', 'pitfalls', 'availableSince', 'gaps'] as const).some((attribute) => describes(attribute)),
  );
  /** While a step required to publish is open, Publish warns first, with the open steps and "Guide me" (DEC-MR-20, FR-MR-21). */
  let warning = $state(false);
  const openSteps = $derived(resource.journey ? checklistOf(resource.journey).open : []);
  function publish() {
    if (resource.journey && !resource.journey.ready) warning = true;
    else sheet = 'publish';
  }
  /** A step of the warning, or of the Flow Box: its place, opened for editing (DEC-UX-303). */
  function toStep(step: FlowStepId) {
    warning = false;
    flowBox.aimAt(resource.id, step);
    const place = FLOW_PLACES[step];
    if (place) goTo(place);
  }
  // The Flow Box led here to publish: the publication, or the warning while a step is still open.
  $effect(() => {
    if (flowBox.aim?.resource !== resource.id) return;
    untrack(() => {
      if (flowBox.take(resource.id, ['publish'])) publish();
    });
  });
  let warningBox: HTMLElement | undefined = $state();
  $effect(() => {
    if (warning) void tick().then(() => warningBox?.querySelector<HTMLElement>('button')?.focus());
  });
  /** Adding it to a Collection, and its grain and model type, are the work of a Data Admin (`resources.assign`). */
  const assigns = $derived(resource.canAssign ?? can(permissions, 'resources.assign'));
  /** Taking it out of its Collection (`resources.remove`, DEC-PL-08): every one, or one of their Owner Units while not published. */
  const canRemove = $derived(resource.collectionId !== null && (resource.canRemove ?? removable(reach(permissions, 'resources.remove'), isOwner, resource.published)));
  /** Its Owner Unit may no longer take it out once it is published: the Danger zone says who does now (DEC-UX-214). */
  const removedByTeam = $derived(!canRemove && resource.published && isOwner && reach(permissions, 'resources.remove') === 'theirs');
  /** The published Resources the User sees, to use instead of this one. */
  const others = $derived(
    (collections ?? []).flatMap((one) => one.resources.filter((item) => item.published && item.id !== resource.id).map((item) => ({ ...item, collection: one.name }))),
  );

  /**
   * Adds it to the Collection chosen in the sheet, with its grain and relations (FR-CO-31, DEC-UX-131),
   * then reads it again, now with its Owner, and with its Log and the Entities it now relates to (FR-RC-09).
   * A Resource added meanwhile elsewhere is told so.
   */
  async function addTo(items: ReturnType<typeof requestOf>[], into?: string): Promise<{ outcome: 'added' | 'elsewhere' | 'refused' | 'failed'; message?: string }> {
    if (!into) {
      return { outcome: 'failed' };
    }
    try {
      await catalogue.addResources(into, items);
    } catch (error) {
      if (error instanceof Refused && error.code === 'in_another_collection') {
        return { outcome: 'elsewhere' };
      }
      console.error(`${resource.displayName} could not be added`, error);
      return error instanceof Refused && error.code === 'invalid_request' ? { outcome: 'refused', message: error.detail } : { outcome: 'failed' };
    }
    adding = false;
    const id = resource.id;
    await changed(await catalogue.resource(id).catch(() => ({ ...resource, collectionId: into })));
    return { outcome: 'added' };
  }

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
  /**
   * The roles of its model type whose field is gone, removed or renamed in dbt, each with when it went where its changes
   * tell (FR-RC-29, DEC-RC-23); and what its model type still misses, for the Data Team (FR-CO-45).
   */
  const gone = $derived(
    (resource.typeState?.gone ?? []).map((one) => {
      const removed = resource.changes.find((change) => change.field === one.field && change.change === 'removed');
      const values: Record<string, string> = removed ? { role: roleWords(one.role), date: day(removed.at) } : { role: roleWords(one.role) };
      return { key: removed ? 'resource.gone.removed' : 'resource.gone.left', values, names: { field: one.field } };
    }),
  );
  const goneText = $derived(gone.map((one) => t(one.key, { ...one.values, ...one.names })).join('; '));
  const LIST_LOCALES = { nl: 'nl-BE', en: 'en-GB' } as const;
  const missingText = $derived(new Intl.ListFormat(LIST_LOCALES[currentLanguage()]).format((resource.typeState?.missing ?? []).map(missingWords)));
  /** What one row is is the work of a Data Admin, for a Resource in a Collection (DEC-CO-27). */
  const relates = $derived(assigns && resource.collectionId !== null);

  /** Shows the Resource as catalogue gives it back, with its Log, after a change. */
  async function changed(updated: ResourceDetail) {
    onchange(updated);
    entries = await catalogue.log(updated.id).catch(() => entries);
    related = await catalogue.related(updated.id).catch(() => related);
  }

  async function saveCard(changes: CardChanges): Promise<boolean> {
    try {
      await changed(await catalogue.editResource(resource.id, changes));
      return true;
    } catch (error) {
      console.error(`${resource.displayName} could not be changed`, error);
      return false;
    }
  }

  /** Adds, changes or removes one Known Gap, then shows the Resource as it is now; its Log follows (FR-RC-21). */
  async function gap(step: () => Promise<unknown>): Promise<boolean> {
    try {
      await step();
      void changed(await catalogue.resource(resource.id));
      return true;
    } catch (error) {
      console.error(`A Known Gap of ${resource.displayName} could not be changed`, error);
      return false;
    }
  }
  const gaps = {
    add: (text: string, scope: GapScope | null) => gap(() => catalogue.addGap(resource.id, text, scope)),
    change: (known: KnownGap, text: string, scope: GapScope | null) => gap(() => catalogue.changeGap(resource.id, known.id, text, scope)),
    remove: (known: KnownGap) => gap(() => catalogue.removeGap(resource.id, known.id)),
  };
  /** Nothing to add to its pitfalls or Known Gaps, kept with who and when (DEC-MR-16); the Resource is read again. */
  const nothing = (step: 'pitfalls' | 'gaps') => gap(() => catalogue.recordStep(resource.id, step, 'nothing'));

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
  /**
   * Publishes it with the declaration ticked. The catalogue decides whether it is ready (DEC-MR-15): when it refuses,
   * the Resource is read again, so that the sheet shows what is open now, also what changed since it opened.
   */
  async function publishIt(declaration: string): Promise<boolean> {
    if (await act(() => catalogue.publish(resource.id, declaration))) {
      return true;
    }
    try {
      await changed(await catalogue.resource(resource.id));
    } catch (error) {
      console.error(`${resource.displayName} could not be read again`, error);
    }
    return false;
  }

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

  /** Deprecates it, or takes that away, from the Danger zone of its Overview, which says when it fails (DEC-UX-176). */
  async function mark(step: () => Promise<ResourceDetail>): Promise<boolean> {
    try {
      await changed(await step());
      return true;
    } catch (error) {
      console.error(`${resource.displayName} could not be changed`, error);
      return false;
    }
  }

  async function saveRelations(details: Record<string, unknown>): Promise<boolean> {
    try {
      await changed(await catalogue.relate(resource.id, details));
      relating = undefined;
      return true;
    } catch (error) {
      console.error(`The relations of ${resource.displayName} could not be changed`, error);
      return false;
    }
  }

  /** The Learning Centre explains its Level, its grain, its model type and "Mark as seen" (FR-LR-35). */
  const learning = useLearning();
  const levelCards = $derived(learning ? cardsOf('level', learning.shown).length : 0);

  /**
   * What can be done to it from the quick window (DEC-UX-240): the buttons of its head and callouts, as they show, and
   * its other tabs; the parts of its Overview come from the Overview.
   */
  const TAB_ICONS: Record<string, IconName> = { overview: 'list-numbers', columns: 'columns', lineage: 'graph', history: 'clock-counter-clockwise', preview: 'table' };
  useScreenCommands((go) => {
    const rows: QuickRow[] = [];
    if (can(permissions, 'queries.make')) rows.push(place('resource:query', 'terminal-window-fill', t('quick.resource.query'), () => go(newQueryPath(resource.id)), { meta: t('quick.resource.query.meta'), words: t('quick.resource.query.words') }));
    if (!resource.published && mayPublish) rows.push(command('resource:publish', 'globe-simple-fill', t('quick.resource.publish'), publish, { meta: t('quick.resource.publish.meta'), words: t('quick.resource.publish.words') }));
    if (guides && onguide) rows.push(command('resource:guide', 'signpost-fill', t('quick.resource.guide'), onguide, { meta: t('quick.resource.guide.meta'), words: t('quick.resource.guide.words') }));
    if (messages) {
      const href = messages.href;
      rows.push(place('resource:ask', 'chat-circle-dots-fill', t('resource.ask'), () => go(href), { meta: t('quick.messages.meta', { count: messages.count ?? 0 }), words: t('quick.messages.words') }));
      // A Remark or a Signal straight away: the Messages open on that kind, the cursor in its text (DEC-UX-257).
      const write = messages.write;
      if (write && messages.kinds?.includes('remark')) rows.push(command('resource:remark', 'chat-text', t('quick.resource.remark'), () => write('remark'), { words: t('quick.resource.remark.words') }));
      if (write && messages.kinds?.includes('signal')) rows.push(command('resource:signal', 'warning-diamond', t('quick.resource.signal'), () => write('signal'), { meta: t('quick.resource.signal.meta'), words: t('quick.resource.signal.words') }));
    }
    if (resource.collectionId === null && assigns && collections) rows.push(command('resource:add', 'folder-plus-fill', t('resource.waiting.add'), () => (adding = true), { meta: t('quick.resource.add.meta'), words: t('quick.resource.add.words') }));
    const instead = resource.deprecation?.insteadOf;
    if (instead) rows.push(place('resource:instead', 'arrow-right', t('resource.deprecated.use', { name: instead.displayName }), () => go(resourcePath(instead.id)), { meta: t('quick.resource.instead.meta'), words: t('quick.resource.instead.words') }));
    if (resource.changes.length > 0 && describes('description')) rows.push(command('resource:seen', 'check-circle-fill', t('quick.resource.seen'), () => void act(() => catalogue.markSeen(resource.id)), { meta: changedText, words: t('quick.resource.seen.words') }));
    if (relates && goneText) rows.push(command('resource:gone', 'warning-circle-fill', t('resource.gone.choose'), () => (relating = 'fields'), { meta: goneText, words: t('quick.resource.relations.words') }));
    if (relates && missingText) rows.push(command('resource:complete', 'list-checks', t('resource.incomplete.complete'), () => (relating = 'type'), { meta: missingText, words: t('quick.resource.relations.words') }));
    if (tab === 'columns' && (assigns || describes('entityMapping')) && resource.collectionId !== null) rows.push(command('resource:relations', 'graph-fill', t('resource.editRelations'), () => (relating = 'type'), { meta: t('resource.editRelations.title'), words: t('quick.resource.relations.words') }));
    for (const one of tabs) if (one.id !== tab) rows.push(view(`resource:tab:${one.id}`, TAB_ICONS[one.id] ?? 'list-numbers', t(one.label), () => (tab = one.id), { words: t('quick.tab.words') }));
    if (collection) {
      const into = collection;
      rows.push(place('resource:collection', 'stack', into.name, () => go(collectionPath(into.id)), { meta: t('quick.resource.collection.meta'), words: t('quick.resource.collection.words') }));
    }
    return { group: t('quick.group.resource'), where: `Resource · ${resource.displayName}`, rows };
  });
</script>

<Breadcrumb
  steps={[
    { label: 'Collections', href: '/collections' },
    collection ? { label: collection.name, href: collectionPath(collection.id) } : { label: t('collections.unassigned') },
  ]}
/>
<svelte:document onclick={(event) => warning && !(event.target as Element).closest('.publish') && (warning = false)} />

<div class="head">
  <div class="name">
    <!-- Its full name in its own case, as BigQuery knows it: the Key is kept in lower case. -->
    <ObjectHeader name={resource.displayName} key={resource.fullName ?? resource.key} copyLabel={t('resource.copyKey')} />
  </div>
  <div class="actions">
    {#if can(permissions, 'queries.make')}<Button variant="outline" href={newQueryPath(resource.id)}><Icon name="terminal-window-fill" />{t('resource.query')}</Button>{/if}
    {#if messages}<MessagesButton href={messages.href} count={messages.count} />{/if}
    {#if !resource.published && mayPublish}
      <!-- For its Owner, while it is not published, "Publish" takes the place of "Ask a question" (DEC-UX-31). -->
      <span class="publish">
        <Button onclick={publish}><Icon name="globe-simple-fill" />{t('resource.publish')}</Button>
        {#if warning}
          <!-- Not ready yet: what is open, each with the way to its place, and "Guide me" (DEC-MR-20, FR-MR-21). -->
          <div class="warning" role="dialog" aria-labelledby="publish-warning" tabindex="-1" bind:this={warningBox} onkeydown={(event) => event.key === 'Escape' && (warning = false)}>
            <p class="warning-title" id="publish-warning"><Icon name="warning-circle-fill" />{t('publish.warn.title')}</p>
            <p class="warning-lead">{t('publish.warn.lead', { count: openSteps.length, total: resource.journey?.steps.filter((step) => step.mark === 'required' && step.id !== 'publish').length ?? openSteps.length })}</p>
            <ul class="warning-steps">
              {#each openSteps as line (line.step)}
                <li><button type="button" onclick={() => isFlowStep(line.step) && toStep(line.step)}><b>{line.name}</b><span>{line.what}</span></button></li>
              {/each}
            </ul>
            <div class="warning-acts">
              {#if guides && onguide}
                {@const open = onguide}
                <Button onclick={() => {
                  warning = false;
                  open();
                }}><Icon name="signpost-fill" />{t('publish.warn.guide')}</Button>
              {/if}
              <Button variant="quiet" onclick={() => (warning = false)}>{t('publish.warn.myself')}</Button>
            </div>
            <p class="warning-claude">{t('publish.warn.claude')}</p>
          </div>
        {/if}
      </span>
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
    {#snippet action()}
      <!-- The Data Team adds it to a Collection from here too (DEC-UX-131). -->
      {#if assigns && collections}<Button onclick={() => (adding = true)}><Icon name="folder-plus-fill" />{t('resource.waiting.add')}</Button>{/if}
    {/snippet}
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
      {#if canDeprecate}
        <!-- Taken away in the Danger zone of its Overview (DEC-UX-176). -->
        <Button
          variant="quiet"
          onclick={() => {
            tab = 'overview';
            part = 'danger';
          }}><Icon name="warning-octagon" />{t('overview.danger')}</Button>
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
      {#if describes('description')}
        <LearningRef place="changesSeen" shape="pill" focusable={false}>
          {#snippet children(mark)}<Button variant="outline" onclick={() => act(() => catalogue.markSeen(resource.id))}>{t('resource.changed.seen')}{@render mark?.()}</Button>{/snippet}
        </LearningRef>
      {/if}
    {/snippet}
  </Callout>
{/if}

{#if goneText}
  <!-- A field of its model type that is gone, for everyone; the Level stays, and it goes once a field holds the role again (DEC-UX-264). -->
  <Callout icon="warning-circle-fill" tone="warning">
    <b>{t('resource.gone.title')}</b>
    {#each gone as one, index (index)}{#if index > 0}; {/if}<Sentence key={one.key} values={one.values} names={one.names} />{/each}. {t('resource.gone.level', { level: levelName(resource.level) })}
    {#snippet action()}
      {#if relates}<Button variant="outline" onclick={() => (relating = 'fields')}>{t('resource.gone.choose')}</Button>{/if}
    {/snippet}
  </Callout>
{/if}
{#if relates && missingText}
  <!-- Its model type misses a field it asks for, or it has none yet: for the Data Team only (DEC-UX-265). -->
  <Callout icon="list-checks" tone="warning">
    <b>{t('resource.incomplete.title')}</b>
    {missingText}. {t('resource.incomplete.text')}
    {#snippet action()}
      <Button variant="outline" onclick={() => (relating = 'type')}>{t('resource.incomplete.complete')}</Button>
    {/snippet}
  </Callout>
{/if}

<Tabs label={resource.displayName} current={tab} tabs={tabs.map(({ id, label }) => ({ id, label: t(label) }))} onselect={(id) => (tab = id)}>
  {#if tab === 'overview'}
    <ResourceOverview
      {resource}
      log={entries}
      {related}
      {storage}
      {threads}
      messagesHref={messages?.href}
      {describes}
      {canDeprecate}
      onsave={saveCard}
      {gaps}
      {nothing}
      oncolumns={() => (tab = 'columns')}
      onpublish={!resource.published && mayPublish && collection ? publish : undefined}
      {others}
      ondeprecate={(why, instead) => mark(() => catalogue.deprecate(resource.id, why, instead))}
      onundeprecate={() => mark(() => catalogue.undeprecate(resource.id))}
      removeFrom={canRemove ? (collection?.name ?? null) : null}
      removeLater={removedByTeam ? (collection?.name ?? null) : null}
      onremove={() => mark(async () => (await catalogue.removeResource(resource.id), catalogue.resource(resource.id)))}
      onchangetype={relates ? () => (relating = resource.details.modelType ? 'change' : 'type') : undefined}
      firstRowOf={(field) => queries.firstRow(resource.id, field).catch(() => null)}
      bind:part
    />
  {:else if tab === 'columns'}
    <ResourceColumns
      {resource}
      canEdit={describes('description')}
      relate={(assigns || describes('entityMapping')) && resource.collectionId !== null}
      onsave={saveFields}
      onrelate={() => (relating = 'type')}
      ongaps={() => {
        tab = 'overview';
        part = 'gaps';
      }}
    />
  {:else if tab === 'lineage'}
    <ResourceLineage {resource} {catalogue} />
  {:else if tab === 'history' && seesQueries}
    <ResourceHistory {resource} client={queries} canQuery={can(permissions, 'queries.make')} />
  {:else if tab === 'preview' && can(permissions, 'resources.preview')}
    <ResourcePreview {resource} client={queries} {storage} {onrun} canQuery={can(permissions, 'queries.make')} />
  {/if}
</Tabs>

{#if adding && collections}
  <AddResources into={collections} waiting={[resource]} {catalogue} {registry} onadd={addTo} onclose={() => (adding = false)} />
{/if}
{#if relating}
  <RelationsSheet {resource} {registry} {assigns} start={relating} onsave={saveRelations} onclose={() => (relating = undefined)} />
{/if}
{#if sheet === 'publish' && collection}
  <PublishSheet
    {resource}
    {collection}
    onpublish={publishIt}
    onfields={() => {
      sheet = undefined;
      tab = 'columns';
    }}
    onpart={(open) => {
      sheet = undefined;
      if (open === 'columns') tab = 'columns';
      else {
        tab = 'overview';
        part = open;
      }
    }}
    onclose={() => (sheet = undefined)}
  />
{/if}

<style>
  b { font-weight: var(--weight-medium); }
  .head { display: flex; align-items: flex-start; gap: 14px; }
  .name { flex: 1; min-width: 0; }
  .actions { display: flex; gap: 8px; align-items: center; flex: none; margin-top: 10px; }
  /* Publish while a step is open: a pop-out under the button (DEC-MR-20). */
  .publish { position: relative; display: inline-flex; }
  .warning { position: absolute; top: calc(100% + 8px); right: 0; z-index: 12; width: 340px; display: grid; gap: 10px; padding: 16px; border-radius: var(--radius-lg); background: var(--surface-solid); outline: 1px solid var(--tint-active); box-shadow: var(--sheet-shadow); }
  .warning-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: var(--text-section); font-weight: var(--weight-medium); }
  .warning-title :global(.icon) { color: var(--signal-warn); font-size: 18px; }
  .warning-lead { margin: 0; font-size: var(--text-small); color: var(--text-secondary); }
  .warning-steps { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
  .warning-steps button { all: unset; box-sizing: border-box; width: 100%; display: grid; gap: 1px; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--surface-sub); font-size: var(--text-small); cursor: pointer; }
  .warning-steps button:hover { outline: 1px solid var(--tint-active); }
  .warning-steps button:focus-visible { outline: 2px solid var(--text-secondary); }
  .warning-steps b { font-weight: var(--weight-medium); }
  .warning-steps span { font-size: var(--text-meta); color: var(--text-muted); }
  .warning-acts { display: flex; flex-wrap: wrap; gap: 8px; }
  .warning-claude { margin: 0; font-size: var(--text-meta); line-height: 1.5; color: var(--text-muted); }
  .failed { margin: 8px 0 0; font-size: var(--text-small); color: var(--signal-urgent); }
</style>

<script lang="ts" module>
  /** The parts of the Overview, each a page of its own (DEC-UX-168). */
  export type OverviewPart = 'summary' | 'description' | 'behaviour' | 'gaps' | 'querying' | 'entities' | 'maturity' | 'changes' | 'danger';
</script>

<script lang="ts">
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import type { GapScope } from '@datahub/contracts/gaps';
  import type { SummarySource } from '@datahub/contracts/summary';
  import FactsList from '@datahub/ui/components/FactsList.svelte';
  import LogList from '@datahub/ui/components/LogList.svelte';
  import MarkdownEditor from '@datahub/ui/components/MarkdownEditor.svelte';
  import MarkdownText from '@datahub/ui/components/MarkdownText.svelte';
  import EditBar from '@datahub/ui/containers/EditBar.svelte';
  import Grid from '@datahub/ui/containers/Grid.svelte';
  import SubTile from '@datahub/ui/containers/SubTile.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import { levelName } from '@datahub/ui/foundations/levels.js';
  import { moveFocus } from '@datahub/ui/foundations/roving.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import OriginTag from '@datahub/ui/marks/OriginTag.svelte';
  import Field from '@datahub/ui/primitives/Field.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import type { CardChanges, DescribeAttribute, KnownGap, LogEntry, Related, ResourceDetail } from '../lib/catalogue.js';
  import { carriersOf, nounOf } from '../lib/grain.js';
  import type { Conversation } from '../lib/messages.js';
  import type { Storage } from '../lib/query.js';
  import { sizeText } from '../lib/size.js';
  import { command, useScreenCommands, view } from '../lib/commands.svelte.js';
  import type { QuickRow } from '../lib/quick.js';
  import LearningRef from './LearningRef.svelte';
  import OverviewDanger from './OverviewDanger.svelte';
  import OverviewGaps from './OverviewGaps.svelte';
  import OverviewMaturity from './OverviewMaturity.svelte';
  import OverviewSummary from './OverviewSummary.svelte';

  /**
   * The Overview of a Resource, in parts, each a page of its own, with a navigation on the left under the tabs
   * (DEC-UX-168): the Summary first, which it opens on (FR-RC-19); then its Description, with the Business Description
   * in Markdown (FR-RC-20); its Known behaviour; its Known Gaps, one by one (FR-RC-21); how to query it, with its size
   * and partitions from BigQuery (FR-SR-39), key fields and Parameters; the Entities it relates to; its maturity and
   * Publication; and its recent history. Who may describe it edits each part in place, on its own page, attribute by
   * attribute as their Permission group allows (FR-RC-15, DEC-PL-03); what comes from dbt, and what the Data Team gave when adding it, stands next to it, read-only.
   * The Messages are no part of their own: "Messages" in the header opens them, and the Summary takes them (FR-RC-22).
   * Maturity explains every Level, passed or what it takes (FR-MR-16). Apart at the end, for who may deprecate it,
   * the Danger zone, where it is deprecated (DEC-UX-176). Intended use and pitfalls are Markdown (FR-RC-23).
   */
  let {
    resource,
    log,
    related,
    storage,
    threads,
    messagesHref,
    describes,
    canDeprecate,
    onsave,
    gaps,
    oncolumns,
    onpublish,
    others,
    ondeprecate,
    onundeprecate,
    removeFrom = null,
    removeLater = null,
    onremove,
    part = $bindable('summary'),
  }: {
    resource: ResourceDetail;
    log: readonly LogEntry[] | undefined;
    related: readonly Related[] | undefined;
    /** Its size and partitions from BigQuery; null where BigQuery does not tell them, undefined while read. */
    storage: Storage | null | undefined;
    /** The threads on it, the newest first, for its Summary; undefined while they are read. */
    threads: readonly Conversation[] | undefined;
    /** Where "Messages" opens them. */
    messagesHref: string | undefined;
    /** Whether the User may describe an attribute of it (`resources.describe`, DEC-PL-03). */
    describes: (attribute: DescribeAttribute) => boolean;
    /** Whether the User may deprecate it, and undo that (`resources.deprecate`). */
    canDeprecate: boolean;
    onsave: (changes: CardChanges) => Promise<boolean>;
    /** Adds, changes and removes one Known Gap; each answers whether it worked. */
    gaps: {
      add: (text: string, scope: GapScope | null) => Promise<boolean>;
      change: (gap: KnownGap, text: string, scope: GapScope | null) => Promise<boolean>;
      remove: (gap: KnownGap) => Promise<boolean>;
    };
    /** Opens the tab Columns, from its Summary. */
    oncolumns: () => void;
    /** Opens its publication, for its Owner while it is not published; from Maturity. */
    onpublish: (() => void) | undefined;
    /** The published Resources the User sees, to use instead of this one once deprecated. */
    others: readonly { id: string; displayName: string; collection: string }[];
    ondeprecate: (reason: string, insteadOf: string | null) => Promise<boolean>;
    onundeprecate: () => Promise<boolean>;
    /** The name of its Collection, when the User may take it out of it (`resources.remove`, DEC-UX-212, DEC-PL-08); null otherwise. */
    removeFrom?: string | null;
    /** The name of its Collection, when only the Data Team takes it out now that it is published (DEC-UX-214); null otherwise. */
    removeLater?: string | null;
    /** Takes it out of its Collection; answers whether it worked. */
    onremove?: () => Promise<boolean>;
    /** The part on screen, which the page can open, such as the Danger zone from a deprecation. */
    part?: Part;
  } = $props();

  type Part = OverviewPart;
  type Editable = 'description' | 'behaviour' | 'querying';

  const PARTS: readonly { id: Part; icon: IconName; label: string }[] = [
    { id: 'summary', icon: 'list-numbers', label: 'overview.summary' },
    { id: 'description', icon: 'text-align-left', label: 'resource.description' },
    { id: 'behaviour', icon: 'compass', label: 'resource.behaviour' },
    { id: 'gaps', icon: 'circle-dashed', label: 'resource.gaps' },
    { id: 'querying', icon: 'funnel', label: 'overview.querying' },
    { id: 'entities', icon: 'graph', label: 'overview.entities' },
    { id: 'maturity', icon: 'seal-check', label: 'resource.maturity' },
    { id: 'changes', icon: 'clock-counter-clockwise', label: 'overview.changes' },
    { id: 'danger', icon: 'warning-octagon', label: 'overview.danger' },
  ];
  /** The Danger zone is for who may deprecate it only. */
  /** The Danger zone shows for whoever may deprecate it, or take it out of its Collection (DEC-UX-176, DEC-UX-212). */
  const dangers = $derived(canDeprecate || (removeFrom !== null && onremove !== undefined) || removeLater !== null);
  const shown = $derived(PARTS.filter((one) => one.id !== 'danger' || dangers));
  /** Which attributes each part edits: Known Behaviour holds the intended use, the pitfalls and since when it is reliable. */
  const EDITS: Record<Editable, readonly DescribeAttribute[]> = { description: ['description'], behaviour: ['behaviour', 'pitfalls', 'availableSince'], querying: ['keyFields'] };
  const mayEdit = (which: Editable) => EDITS[which].some((attribute) => describes(attribute));

  let editing: Editable | null = $state(null);
  // Another Resource opens on its Summary: the page sets the part, and what was being edited goes.
  // svelte-ignore state_referenced_locally
  let shownFor = resource.id;
  $effect(() => {
    if (shownFor !== resource.id) {
      shownFor = resource.id;
      editing = null;
    }
  });

  function open(next: Part) {
    part = next;
    editing = null;
  }

  function go(target: Exclude<SummarySource, 'messages'>) {
    if (target === 'columns') oncolumns();
    else open(target);
  }

  function navKeys(event: KeyboardEvent) {
    const index = moveFocus(event, '[role="tab"]');
    if (index !== undefined) open(shown[index]!.id);
  }

  const card = $derived(resource.card);
  const details = $derived(resource.details);
  /** A Business Description is written from 2 · Described on (DEC-MR-10). */
  const described = $derived(resource.level >= 2);
  /** The description of the table from dbt, when it changed in the last 30 days (FR-RC-17). */
  const tableChanged = $derived(resource.descriptionChanges.find((change) => change.field === null));
  const UNIT_KEYS = { hour: 'grain.unit.hour', day: 'grain.unit.day', month: 'grain.unit.month', year: 'grain.unit.year' } as const;
  const LOCALES = { nl: 'nl-BE', en: 'en-GB' } as const;
  const list = (names: readonly string[]) => new Intl.ListFormat(LOCALES[currentLanguage()], { type: 'conjunction' }).format(names);
  const day = (value: string) => new Intl.DateTimeFormat(LOCALES[currentLanguage()], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
  /** Its size in all, and about how much a partition holds where it has them (FR-SR-39). */
  const size = $derived(sizeText(storage, details.partition?.unit));

  // Editing in place, one part at a time.
  let saving = $state(false);
  let failed = $state(false);
  let draft = $state({ businessDescription: '', intendedUse: '', pitfalls: '', reliableSince: '' as string, keyFields: [] as string[], parameters: [] as string[] });

  function start(which: Editable) {
    draft = {
      businessDescription: card.businessDescription,
      intendedUse: card.intendedUse,
      pitfalls: card.pitfalls,
      reliableSince: card.reliableSince ?? '',
      keyFields: [...card.keyFields],
      parameters: [...card.parameters],
    };
    failed = false;
    editing = which;
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    const changes: CardChanges =
      editing === 'description'
        ? { businessDescription: draft.businessDescription }
        : editing === 'behaviour'
          ? {
              ...(describes('behaviour') ? { intendedUse: draft.intendedUse } : {}),
              ...(describes('pitfalls') ? { pitfalls: draft.pitfalls } : {}),
              ...(describes('availableSince') ? { reliableSince: draft.reliableSince || null } : {}),
            }
          : { keyFields: draft.keyFields, parameters: draft.parameters };
    saving = true;
    const ok = await onsave(changes);
    saving = false;
    failed = !ok;
    if (ok) editing = null;
  }

  /** The mappings that relate it to others, each with the Resources that carry its identity (FR-RC-09). */
  const shownRelated = $derived(related ?? []);
  const joined = $derived(shownRelated.filter((mapping) => mapping.resources.length > 0));
  /** The picture: this Resource, each identity it shares, and the Resources that carry it; six at most. */
  const picture = $derived.by(() => {
    const rows: { identity: string; name: string }[] = [];
    for (const mapping of joined) {
      for (const other of mapping.resources) {
        if (rows.length < 6 && !rows.some((row) => row.identity === mapping.identity && row.name === other.displayName)) {
          rows.push({ identity: mapping.identity, name: other.displayName });
        }
      }
    }
    const height = Math.max(60, rows.length * 40 + 10);
    const identities = [...new Set(rows.map((row) => row.identity))].map((identity) => {
      const at = rows.flatMap((row, index) => (row.identity === identity ? [index * 40 + 25] : []));
      return { identity, noun: nounOf(identity), y: at.reduce((sum, y) => sum + y, 0) / at.length, targets: at };
    });
    return { rows, height, identities, middle: height / 2 };
  });
  const clip = (text: string, length: number) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);

  // In the quick window: editing the part on screen, for who may, and its other parts (DEC-UX-240).
  useScreenCommands(() => {
    const rows: QuickRow[] = [];
    const which = part === 'description' || part === 'behaviour' || part === 'querying' ? part : null;
    const label = t((PARTS.find((one) => one.id === part) ?? PARTS[0]!).label);
    if (which && mayEdit(which) && editing !== which) rows.push(command(`overview:edit`, 'pencil-simple-fill', t('quick.overview.edit', { name: label }), () => start(which), { words: t('quick.overview.edit.words') }));
    for (const one of shown) if (one.id !== part) rows.push(view(`overview:${one.id}`, one.icon, t(one.label), () => open(one.id), { meta: t('quick.overview.meta'), words: t('quick.tab.words') }));
    return { group: t('quick.group.resource'), rows };
  });
</script>

{#snippet head(title: string, lead: string, which?: Editable)}
  <div class="head">
    <div class="what">
      <h2>{title}</h2>
      <p class="lead">{lead}</p>
    </div>
    {#if which && mayEdit(which) && editing !== which}<button type="button" class="edit" onclick={() => start(which)}><Icon name="pencil-simple-fill" />{t('resource.edit')}</button>{/if}
  </div>
{/snippet}

{#snippet editBar()}
  <EditBar text={t('resource.editing')} cancelLabel={t('collection.cancel')} saveLabel={t('collection.save')} {saving} oncancel={() => (editing = null)} />
  {#if failed}<p class="failed" role="alert">{t('resource.saveFailed')}</p>{/if}
{/snippet}

{#snippet chips(names: readonly string[])}
  {#each names as name (name)}<span class="code">{name}</span>{:else}<p class="empty">{t('resource.noneChosen')}</p>{/each}
{/snippet}

{#snippet chosen(key: 'keyFields' | 'parameters')}
  <div class="chosen">
    {#each draft[key] as name (name)}
      <span class="code">{name}<button type="button" aria-label={t('resource.removeField', { name })} onclick={() => (draft[key] = draft[key].filter((other) => other !== name))}>×</button></span>
    {/each}
    <select
      class="add"
      aria-label={key === 'keyFields' ? t('resource.keyFields') : t('resource.parameters')}
      value=""
      onchange={(event) => {
        const name = (event.currentTarget as HTMLSelectElement).value;
        if (name) {
          draft[key] = [...draft[key], name];
        }
        (event.currentTarget as HTMLSelectElement).value = '';
      }}
    >
      <option value="">+ {t('resource.addField')}</option>
      {#each resource.fields.filter((field) => !draft[key].includes(field.name)) as field (field.name)}<option value={field.name}>{field.name}</option>{/each}
    </select>
  </div>
{/snippet}

{#snippet modelAndGrain()}
  {#if details.modelType || details.grain.length > 0}
    <div class="model">
      {#if details.modelType}
        <LearningRef place="modelType" shape="chip">
          {#snippet children(mark)}<span class="code">{t('resource.modelType', { type: details.modelType ?? '' })}{@render mark?.()}</span>{/snippet}
        </LearningRef>
      {/if}
      {#if details.grain.length > 0}
        <LearningRef place="grain" shape="chip">
          {#snippet children(mark)}<span class="code" title={details.grainSentence || undefined}>{t('resource.grain', { fields: details.grain.join(' × ') })}{@render mark?.()}</span>{/snippet}
        </LearningRef>
      {/if}
      <OriginTag origin="dataTeam" />
    </div>
  {/if}
{/snippet}

{#snippet dbtDescription(hint: boolean)}
  <SubTile label={t('description.dbt')}>
    {#snippet aside()}<OriginTag origin="dbt" />{/snippet}
    <p class="prose">{resource.description || t('resource.noDescription')}</p>
    {#if hint}<p class="hint">{#if tableChanged}{t('resource.dbt.changed', { date: day(tableChanged.at) })} {/if}{t('resource.dbt.notEdited')}</p>{/if}
  </SubTile>
{/snippet}

<div class="overview">
  <div class="nav" role="tablist" aria-label={t('overview.parts')} aria-orientation="vertical" tabindex="-1" onkeydown={navKeys}>
    {#each shown as { id, icon, label } (id)}
      {#if id === 'danger'}<div class="separator" role="presentation"></div>{/if}
      <button type="button" role="tab" class="item" class:on={part === id} aria-selected={part === id} tabindex={part === id ? 0 : -1} onclick={() => open(id)}>
        <Icon name={icon} /><span class="name">{t(label)}</span>
        {#if id === 'summary'}<span class="note">{t('overview.startHere')}</span>{/if}
        {#if id === 'gaps' && card.knownGaps.length > 0}<span class="note">{card.knownGaps.length}</span>{/if}
        {#if id === 'maturity' && resource.changes.length > 0}<span class="dot" role="img" aria-label={t('overview.changedSince')}></span>{/if}
      </button>
      {#if id === 'summary'}<div class="separator" role="presentation"></div>{/if}
    {/each}
  </div>

  <div class="body" role="tabpanel" aria-label={t((shown.find((one) => one.id === part) ?? PARTS[0]!).label)}>
    {#if part === 'summary'}
      {@render head(t('overview.summary'), t('overview.summary.lead', { name: resource.displayName }))}
      <OverviewSummary {resource} {related} {threads} {log} {size} {messagesHref} ongo={go} />
    {:else if part === 'description'}
      {@render head(t('resource.description'), t('overview.description.lead', { name: resource.displayName }), described ? 'description' : undefined)}
      {#if editing === 'description'}
        <form onsubmit={save} novalidate>
          {@render editBar()}
          <div class="side-by-side">
            <div>
              <div class="tag-line"><span class="label">{t('description.business')}</span><OriginTag origin="owner" /></div>
              <MarkdownEditor id="business-description" bind:value={draft.businessDescription} label={t('description.business')} note={t('overview.description.note')} maxlength={4000} />
            </div>
            {@render dbtDescription(true)}
          </div>
        </form>
      {:else}
        {#if card.businessDescription}
          <section class="business">
            <div class="tag-line"><span class="label">{t('description.business')}</span><OriginTag origin="owner" /></div>
            <div class="markdown"><MarkdownText source={card.businessDescription} /></div>
          </section>
        {:else if describes('description') && described}
          <button type="button" class="text-link" onclick={() => start('description')}>{t('resource.addBusiness')}</button>
        {:else if describes('description')}
          <p class="hint">{t('resource.business.notYet')}</p>
        {/if}
        {@render dbtDescription(false)}
        {@render modelAndGrain()}
      {/if}
    {:else if part === 'behaviour'}
      {@render head(t('resource.behaviour'), t('overview.behaviour.lead'), 'behaviour')}
      {#if editing === 'behaviour'}
        <form onsubmit={save} novalidate>
          {@render editBar()}
          <!-- Only what the User may describe is a field (DEC-PL-03). -->
          <div class="pair">
            {#if describes('behaviour')}<div><div class="label">{t('resource.intendedUse')}</div><MarkdownEditor id="intended-use" bind:value={draft.intendedUse} label={t('resource.intendedUse')} maxlength={2000} /></div>{/if}
            {#if describes('pitfalls')}<div><div class="label">{t('resource.pitfalls')}</div><MarkdownEditor id="pitfalls" bind:value={draft.pitfalls} label={t('resource.pitfalls')} maxlength={2000} /></div>{/if}
          </div>
          {#if describes('availableSince')}<div class="reliable"><Field label={t('resource.reliableSince')}><input {...NO_PASSWORD_MANAGER} type="date" bind:value={draft.reliableSince} /></Field></div>{/if}
        </form>
      {:else}
        <Grid min="var(--tile-min)" tight>
          <SubTile>
            <div class="said"><Icon name="check-circle-fill" />{t('resource.intendedUse')}</div>
            {#if card.intendedUse}<div class="markdown"><MarkdownText source={card.intendedUse} /></div>{:else}<p class="text">{t('resource.nothingYet')}</p>{/if}
          </SubTile>
          <SubTile>
            <div class="said"><Icon name="warning-fill" />{t('resource.pitfalls')}</div>
            {#if card.pitfalls}<div class="markdown"><MarkdownText source={card.pitfalls} /></div>{:else}<p class="text">{t('resource.nothingYet')}</p>{/if}
          </SubTile>
          <SubTile>
            <div class="said"><Icon name="calendar-blank-fill" />{t('resource.reliableSince')}</div>
            <p class="text">{card.reliableSince ? day(card.reliableSince) : t('resource.nothingYet')}</p>
          </SubTile>
        </Grid>
      {/if}
    {:else if part === 'gaps'}
      {@render head(t('resource.gaps'), t('overview.gaps.lead'))}
      <OverviewGaps gaps={card.knownGaps} fields={resource.fields} canEdit={describes('gaps')} onadd={gaps.add} onchange={gaps.change} onremove={gaps.remove} />
    {:else if part === 'querying'}
      {@render head(t('overview.querying'), t('overview.querying.lead'), 'querying')}
      {#if editing === 'querying'}
        <form onsubmit={save} novalidate>
          {@render editBar()}
          <SubTile label={t('resource.keyFields')}>
            {@render chosen('keyFields')}
            <div class="label second">{t('resource.parameters')}</div>
            {@render chosen('parameters')}
          </SubTile>
        </form>
      {:else}
        <Grid min="var(--tile-min)" tight>
          <SubTile label={t('resource.storage')} span="all">
            {#snippet aside()}<OriginTag origin={details.origins.partition === 'dbt' || details.origins.clusterBy === 'dbt' ? 'dbt' : 'dataTeam'} />{/snippet}
            {#if details.partition || details.clusterBy.length > 0}
              <FactsList>
                {#if details.partition}
                  <dt>{t('resource.partitioned')}</dt>
                  <dd>
                    {t('resource.partitionedBy', { field: details.partition.field, unit: details.partition.unit ? t(UNIT_KEYS[details.partition.unit]) : t('grain.unit.range') })}{#if storage?.partitions}{' · '}{t('resource.partitions', { count: storage.partitions })}{/if}
                  </dd>
                {/if}
                {#if details.clusterBy.length > 0}
                  <dt>{t('resource.clustered')}</dt><dd>{t('resource.clusteredBy', { fields: list(details.clusterBy) })}</dd>
                {/if}
                {#if size}<dt>{t('resource.size')}</dt><dd>{size}</dd>{:else if storage === undefined}<dt>{t('resource.size')}</dt><dd><Loading inline /></dd>{/if}
              </FactsList>
              {#if size && storage?.beneath}<p class="cheap beneath" title={storage.key}>{t('resource.beneath', { key: storage.key })}</p>{/if}
              <p class="cheap">
                {#if details.partition && details.partitionFilter !== 'none'}{t('resource.filterRequired', { field: details.partition.field })}
                {:else if details.partition}{t('resource.filterFirst', { field: details.partition.field })}{/if}
                {#if details.clusterBy[0]}{t('resource.clusterThen', { field: details.clusterBy[0] })}{/if}
              </p>
            {:else}
              {#if storage === undefined}
                <FactsList><dt>{t('resource.size')}</dt><dd><Loading inline /></dd></FactsList>
              {:else if size}
                <FactsList><dt>{t('resource.size')}</dt><dd>{size}</dd></FactsList>
                {#if storage?.beneath}<p class="cheap beneath" title={storage.key}>{t('resource.beneath', { key: storage.key })}</p>{/if}
              {/if}
              <p class="empty" class:cheap={size !== null}>{t('resource.notStored')}</p>
            {/if}
          </SubTile>
          <SubTile label={t('resource.keyFields')}>
            <div class="chosen">{@render chips(card.keyFields)}</div>
            <div class="label second">{t('resource.parameters')}</div>
            <div class="chosen">{@render chips(card.parameters)}</div>
          </SubTile>
        </Grid>
      {/if}
    {:else if part === 'entities'}
      {@render head(t('overview.entities'), t('overview.entities.lead'))}
      <SubTile label={t('resource.entities')}>
        {#snippet aside()}<OriginTag origin="dataTeam" />{/snippet}
        {#if related === undefined}
          <Loading />
        {:else if shownRelated.length === 0}
          <p class="empty">{t('resource.entity.none')}</p>
        {:else}
          <div class="entities" class:drawn={picture.rows.length > 0}>
            <div>
              {#each shownRelated as mapping (mapping.field)}
                <div class="entity"><span class="code">{mapping.identity}</span>{t('resource.entity.on', { field: mapping.field })}</div>
                <p class="empty">
                  {#if mapping.resources.length > 0}{t('resource.entity.joins', { names: list(carriersOf(mapping)) })}
                  {:else}{t('resource.entity.alone')}{/if}
                  {#if !mapping.inDomainModel}{t('resource.entity.stranger')}{/if}
                </p>
              {/each}
            </div>
            {#if picture.rows.length > 0}
              <svg viewBox="0 0 330 {picture.height}" width="100%" role="img" aria-label={t('resource.entity.picture', { name: resource.displayName, identities: list(picture.identities.map((one) => one.noun)) })}>
                {#each picture.identities as one (one.identity)}
                  <path class="link" d="M118 {picture.middle} C 125 {picture.middle}, 125 {one.y}, 132 {one.y}" />
                  {#each one.targets as y (y)}<path class="link" d="M192 {one.y} C 200 {one.y}, 198 {y}, 206 {y}" />{/each}
                {/each}
                <rect x="2" y={picture.middle - 17} width="116" height="34" rx="12" class="self" />
                <text x="60" y={picture.middle + 4} text-anchor="middle" class="self-name">{clip(resource.displayName, 18)}</text>
                {#each picture.identities as one (one.identity)}
                  <rect x="132" y={one.y - 10} width="60" height="20" rx="10" class="identity" />
                  <text x="162" y={one.y + 3.5} text-anchor="middle" class="identity-name">{clip(one.noun, 11)}</text>
                {/each}
                {#each picture.rows as row, index (index)}
                  <rect x="206" y={index * 40 + 10} width="120" height="30" rx="12" class="other" />
                  <text x="266" y={index * 40 + 29} text-anchor="middle" class="other-name">{clip(row.name, 19)}</text>
                {/each}
              </svg>
            {/if}
          </div>
        {/if}
      </SubTile>
    {:else if part === 'maturity'}
      {@render head(t('resource.maturity'), t('overview.maturity.lead'))}
      <OverviewMaturity {resource} {onpublish} />
    {:else if part === 'changes'}
      {@render head(t('overview.changes'), t('overview.changes.lead'))}
      <SubTile>
        {#if log}{#if log.length > 0}<LogList entries={log.slice(0, 20)} />{:else}<p class="empty">{t('resource.nothingYet')}</p>{/if}{:else}<Loading />{/if}
      </SubTile>
    {:else if part === 'danger' && dangers}
      {@render head(t('overview.danger'), t('overview.danger.lead', { name: resource.displayName }))}
      <OverviewDanger {resource} {others} deprecates={canDeprecate} collection={removeFrom} later={removeLater} {ondeprecate} {onundeprecate} {onremove} />
    {/if}
  </div>
</div>

<style>
  .overview { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 18px; align-items: start; }
  .nav { position: sticky; top: 0; display: flex; flex-direction: column; gap: 2px; }
  .item { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius-md); font-size: var(--text-small); color: var(--text-secondary); cursor: pointer; }
  .item:hover { background: var(--tint-hover); color: var(--text-primary); }
  .item.on { background: var(--surface-sub); color: var(--text-primary); font-weight: var(--weight-medium); }
  .item:focus-visible { outline: 2px solid var(--text-secondary); }
  .item > :global(.icon) { font-size: 16px; flex: none; }
  .name { flex: 1; min-width: 0; }
  .note { font-size: var(--text-meta); color: var(--text-muted); font-weight: var(--weight-regular); }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--signal-warn); flex: none; }
  .separator { height: 1px; background: var(--tint-active); margin: 6px 10px; }
  .body { min-width: 0; }
  .head { display: flex; align-items: flex-start; gap: 10px; margin: 2px 0 14px; }
  .what { flex: 1; min-width: 0; }
  .head h2 { margin: 0; font-size: var(--text-section); font-weight: var(--weight-medium); }
  .lead { margin: 4px 0 0; font-size: var(--text-small); color: var(--text-secondary); line-height: 1.5; max-width: 72ch; }
  .edit { all: unset; display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: var(--radius-sm); font-size: var(--text-meta); color: var(--text-muted); cursor: pointer; }
  .edit:hover { color: var(--text-primary); background: var(--tint-hover); }
  .edit:focus-visible { outline: 2px solid var(--text-secondary); }
  .text-link { all: unset; display: inline-block; margin: 0 0 12px; font-size: var(--text-small); color: var(--text-secondary); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
  .tag-line { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .label { font-size: var(--text-meta); color: var(--text-muted); }
  .business { padding: 2px 2px 14px; }
  .markdown { font-size: var(--text-body); max-width: 72ch; }
  .prose { margin: 0; line-height: 1.65; color: var(--text-secondary); white-space: pre-line; }
  .side-by-side { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(240px, 1fr); gap: 16px; align-items: start; }
  .pair .label { margin-bottom: 6px; }
  .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
  .reliable { max-width: 240px; margin-top: 14px; }
  .model { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 12px; }
  .code { display: inline-flex; align-items: center; gap: 4px; font: var(--text-meta) var(--font-mono); color: var(--text-secondary); background: var(--surface-solid); padding: 3px 8px; border-radius: var(--radius-chip); }
  .code button { all: unset; cursor: pointer; color: var(--text-muted); }
  .code button:focus-visible { outline: 2px solid var(--text-secondary); }
  .chosen { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .second { margin-top: 12px; margin-bottom: 8px; }
  .add { font: var(--text-meta) var(--font-family); color: var(--text-secondary); background: transparent; border: 1px dashed var(--tint-active); border-radius: var(--radius-chip); padding: 3px 6px; }
  .said { display: flex; align-items: center; gap: 6px; font-size: var(--text-small); font-weight: var(--weight-medium); margin-bottom: 6px; }
  .said :global(.icon) { color: var(--text-secondary); }
  .text { margin: 0; font-size: var(--text-small); color: var(--text-secondary); line-height: 1.6; white-space: pre-line; }
  .empty { margin: 0; font-size: var(--text-small); color: var(--text-muted); line-height: 1.5; }
  .cheap { margin: 10px 0 0; font-size: var(--text-meta); color: var(--text-secondary); line-height: 1.6; }
  /* The name of the table beneath stays on one line, cut off rather than wrapped or spilling over. */
  .beneath { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .entities { display: grid; gap: 14px; align-items: center; }
  .entities.drawn { grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); }
  .entities svg { max-width: 440px; justify-self: center; }
  .entity { display: flex; align-items: center; gap: 6px; font-size: var(--text-meta); font-weight: var(--weight-medium); }
  .entity + .empty { margin: 4px 0 12px; }
  .link { fill: none; stroke: var(--tint-active); stroke-width: 1.5; }
  .self { fill: var(--text-primary); }
  .self-name { fill: var(--surface-solid); font-size: 10px; font-weight: var(--weight-medium); }
  .identity { fill: var(--surface-solid); stroke: var(--tint-active); }
  .identity-name { fill: var(--text-secondary); font-size: 8.5px; }
  .other { fill: var(--surface-solid); }
  .other-name { fill: var(--text-primary); font-size: 10px; }
  input { width: 100%; box-sizing: border-box; font: var(--text-small) var(--font-family); line-height: 1.5; color: var(--text-primary); background: var(--surface-solid); border: 1px solid var(--tint-active); border-radius: var(--radius-field); padding: 8px 10px; resize: vertical; }
  input:focus { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
  .hint { margin: 8px 0 0; font-size: var(--text-meta); color: var(--text-muted); line-height: 1.5; }
  .failed { margin: 8px 0; font-size: var(--text-small); color: var(--signal-urgent); }
  form { display: block; }
</style>

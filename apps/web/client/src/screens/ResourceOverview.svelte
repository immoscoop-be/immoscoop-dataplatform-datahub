<script lang="ts">
  import DescriptionPair from '@datahub/ui/components/DescriptionPair.svelte';
  import FactsList from '@datahub/ui/components/FactsList.svelte';
  import LogList from '@datahub/ui/components/LogList.svelte';
  import MaturityLadder from '@datahub/ui/components/MaturityLadder.svelte';
  import EditBar from '@datahub/ui/containers/EditBar.svelte';
  import Grid from '@datahub/ui/containers/Grid.svelte';
  import SubTile from '@datahub/ui/containers/SubTile.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { levelName } from '@datahub/ui/foundations/levels.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import OriginTag from '@datahub/ui/marks/OriginTag.svelte';
  import Field from '@datahub/ui/primitives/Field.svelte';
  import { formatBytes } from '@datahub/ui/foundations/bytes.js';
  import type { Card, LogEntry, Related, ResourceDetail } from '../lib/catalogue.js';
  import { nounOf } from '../lib/grain.js';
  import type { Storage } from '../lib/query.js';
  import LearningRef from './LearningRef.svelte';

  /**
   * The Overview of a Resource, in tiles (Detail page of a Resource): its two descriptions with its model
   * type and grain, its maturity, its publication, its Known Behaviour and Known Gaps, its key fields and
   * Parameters, how it is stored with its size and partitions from BigQuery (FR-SR-39), the Entities it
   * relates to, and its recent history. Its Owner Unit and
   * the Data Team edit what Data Hub keeps about it in place (FR-RC-15); what comes from dbt and what
   * the Data Team gave when adding it stands next to it, read-only. Stability and Monitoring are not in v1.
   */
  let {
    resource,
    log,
    related,
    storage,
    canEdit,
    onsave,
  }: {
    resource: ResourceDetail;
    log: readonly LogEntry[] | undefined;
    related: readonly Related[] | undefined;
    /** Its size and partitions from BigQuery; null where BigQuery does not tell them, undefined while read. */
    storage: Storage | null | undefined;
    canEdit: boolean;
    onsave: (changes: Partial<Card>) => Promise<boolean>;
  } = $props();

  const card = $derived(resource.card);
  const details = $derived(resource.details);
  /** A Business Description is written from 2 · Described on (DEC-MR-10). */
  const described = $derived(resource.level >= 2);
  const undescribed = $derived(resource.fields.filter((field) => field.description.trim() === '').length);
  /** The description of the table from dbt, when it changed in the last 30 days (FR-RC-17). */
  const tableChanged = $derived(resource.descriptionChanges.find((change) => change.field === null));
  const LEVEL_KEYS: Record<number, string> = { 2: 'resource.level.2', 3: 'resource.level.3', 4: 'resource.level.4' };
  const UNIT_KEYS = { hour: 'grain.unit.hour', day: 'grain.unit.day', month: 'grain.unit.month', year: 'grain.unit.year' } as const;
  const LOCALES = { nl: 'nl-BE', en: 'en-GB' } as const;
  const list = (names: readonly string[]) => new Intl.ListFormat(LOCALES[currentLanguage()], { type: 'conjunction' }).format(names);
  const day = (value: string) => new Intl.DateTimeFormat(LOCALES[currentLanguage()], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
  /** Its size in all, and about how much a partition holds where it has them (FR-SR-39). */
  const size = $derived.by(() => {
    if (!storage || storage.bytes === null) return null;
    const language = currentLanguage();
    const bytes = formatBytes(storage.bytes, language);
    const unit = details.partition?.unit;
    return storage.partitions && unit ? t('resource.sizePer', { bytes, per: formatBytes(storage.bytes / storage.partitions, language), unit: t(UNIT_KEYS[unit]) }) : t('resource.sizeOf', { bytes });
  });

  // Editing in place: a copy of the card, saved in one go.
  let editing = $state(false);
  let saving = $state(false);
  let failed = $state(false);
  let draft: Card = $state({ businessDescription: '', intendedUse: '', pitfalls: '', knownGaps: [], reliableSince: null, keyFields: [], parameters: [] });

  function start() {
    draft = { ...card, knownGaps: card.knownGaps.length > 0 ? [...card.knownGaps] : [''], keyFields: [...card.keyFields], parameters: [...card.parameters] };
    failed = false;
    editing = true;
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    saving = true;
    const { businessDescription, ...rest } = draft;
    const changes: Partial<Card> = { ...rest, reliableSince: draft.reliableSince || null, ...(described ? { businessDescription } : {}) };
    const ok = await onsave(changes);
    saving = false;
    failed = !ok;
    editing = !ok;
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
</script>

{#snippet published()}
  <!-- Who published it and when, and who confirmed it last and when (FR-RC-12). -->
  <dt>{t('resource.published')}</dt>
  <dd>{resource.publication ? t('resource.published.by', { date: day(resource.publication.publishedAt), name: resource.publication.publishedBy }) : t('resource.notYet')}</dd>
  <dt>{t('resource.confirmed')}</dt>
  <dd>{resource.publication ? t('resource.published.by', { date: day(resource.publication.confirmedAt), name: resource.publication.confirmedBy }) : t('resource.notYet')}</dd>
{/snippet}

{#snippet edit(onclick: () => void)}
  {#if canEdit && !editing}<button type="button" class="edit" {onclick}><Icon name="pencil-simple-fill" />{t('resource.edit')}</button>{/if}
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

{#snippet entities(drawn: boolean)}
  {#if shownRelated.length === 0}
    <p class="empty">{t('resource.entity.none')}</p>
  {:else}
    <div class="entities" class:drawn={drawn && picture.rows.length > 0}>
      <div>
        {#each shownRelated as mapping (mapping.field)}
          <div class="entity"><span class="code">{nounOf(mapping.identity)}</span>{t('resource.entity.on', { field: mapping.field })}</div>
          <p class="empty">
            {#if mapping.resources.length > 0}{t('resource.entity.joins', { names: list(mapping.resources.map((other) => other.displayName)) })}
            {:else}{t('resource.entity.alone')}{/if}
            {#if !mapping.inDomainModel}{t('resource.entity.stranger')}{/if}
          </p>
        {/each}
      </div>
      {#if drawn && picture.rows.length > 0}
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
{/snippet}

{#if editing}
  <form onsubmit={save} novalidate>
    <EditBar text={t('resource.editing')} cancelLabel={t('collection.cancel')} saveLabel={t('collection.save')} {saving} oncancel={() => (editing = false)} />
    {#if failed}<p class="failed" role="alert">{t('resource.saveFailed')}</p>{/if}
    <Grid min="var(--tile-min)" tight>
      <SubTile label={t('resource.description')} span="all">
        <DescriptionPair business={draft.businessDescription} dbt={resource.description} none={t('resource.noDescription')}>
          {#snippet edit()}
            {#if described}
              <textarea bind:value={draft.businessDescription} rows="4" maxlength="4000" aria-label={t('description.business')}></textarea>
              <p class="hint">{t('resource.business.hint')}</p>
            {:else}
              <p class="empty">{t('resource.business.notYet')}</p>
            {/if}
          {/snippet}
          {#snippet below()}
            <p class="hint">{#if tableChanged}{t('resource.dbt.changed', { date: day(tableChanged.at) })} {/if}{t('resource.dbt.notEdited')}</p>
          {/snippet}
        </DescriptionPair>
        {@render modelAndGrain()}
      </SubTile>
      <SubTile label={t('resource.behaviour')}>
        <Field label={t('resource.intendedUse')}><textarea bind:value={draft.intendedUse} rows="3" maxlength="2000"></textarea></Field>
        <Field label={t('resource.pitfalls')}><textarea bind:value={draft.pitfalls} rows="3" maxlength="2000"></textarea></Field>
      </SubTile>
      <SubTile label={t('resource.gaps')}>
        {#each draft.knownGaps as _, index (index)}
          <Field label={t('resource.gap', { number: index + 1 })}><textarea bind:value={draft.knownGaps[index]} rows="3" maxlength="1000"></textarea></Field>
        {/each}
        {#if draft.knownGaps.length < 20}
          <button type="button" class="add-gap" onclick={() => (draft.knownGaps = [...draft.knownGaps, ''])}>{t('resource.addGap')}</button>
        {/if}
      </SubTile>
      <SubTile label={t('resource.publication')}>
        <FactsList>
          {@render published()}
        </FactsList>
        <div class="reliable">
          <Field label={t('resource.reliableSince')}><input type="date" value={draft.reliableSince ?? ''} oninput={(event) => (draft.reliableSince = (event.currentTarget as HTMLInputElement).value || null)} /></Field>
        </div>
      </SubTile>
      <SubTile label={t('resource.keyFields')}>
        {@render chosen('keyFields')}
        <div class="label second">{t('resource.parameters')}</div>
        {@render chosen('parameters')}
      </SubTile>
      <SubTile label={t('resource.entities')}>
        {#snippet aside()}<OriginTag origin="dataTeam" />{/snippet}
        {@render entities(false)}
      </SubTile>
    </Grid>
  </form>
{:else}
  <Grid min="var(--tile-min)" tight>
    <SubTile label={t('resource.description')} span="all">
      {#snippet aside()}{@render edit(start)}{/snippet}
      <DescriptionPair business={card.businessDescription} dbt={resource.description} none={t('resource.noDescription')} />
      {#if canEdit && described && !card.businessDescription}
        <button type="button" class="text-link" onclick={start}>{t('resource.addBusiness')}</button>
      {/if}
      {@render modelAndGrain()}
    </SubTile>

    <SubTile label={t('resource.maturity')}>
      <MaturityLadder level={resource.level} />
      <div class="level">{levelName(resource.level)}</div>
      <div class="meta">
        {#if LEVEL_KEYS[resource.level]}{t(LEVEL_KEYS[resource.level]!)}{:else}{t('resource.undescribed', { undescribed, count: resource.fields.length })}{/if}
      </div>
    </SubTile>

    <SubTile label={t('resource.publication')}>
      {#snippet aside()}{@render edit(start)}{/snippet}
      <FactsList>
        {@render published()}
        <dt>{t('resource.reliableSince')}</dt><dd>{card.reliableSince ? day(card.reliableSince) : '–'}</dd>
      </FactsList>
    </SubTile>

    <SubTile label={t('resource.behaviour')}>
      {#snippet aside()}{@render edit(start)}{/snippet}
      <div class="said"><Icon name="check-circle-fill" />{t('resource.intendedUse')}</div>
      <p class="text">{card.intendedUse || t('resource.nothingYet')}</p>
      <div class="said"><Icon name="warning-fill" />{t('resource.pitfalls')}</div>
      <p class="text last">{card.pitfalls || t('resource.nothingYet')}</p>
    </SubTile>

    <SubTile label={t('resource.gaps')}>
      {#snippet aside()}{@render edit(start)}{/snippet}
      {#each card.knownGaps as gap, index (index)}
        <div class="gap"><Icon name="circle-dashed-fill" /><span>{gap}</span></div>
      {:else}
        <p class="empty">{t('resource.nothingYet')}</p>
      {/each}
    </SubTile>

    <SubTile label={t('resource.keyFields')}>
      {#snippet aside()}{@render edit(start)}{/snippet}
      <div class="chosen">{@render chips(card.keyFields)}</div>
      <div class="label second">{t('resource.parameters')}</div>
      <div class="chosen">{@render chips(card.parameters)}</div>
    </SubTile>

    <SubTile label={t('resource.storage')} span={2}>
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
          {#if size}<dt>{t('resource.size')}</dt><dd>{size}</dd>{/if}
        </FactsList>
        {#if size && storage?.beneath}<p class="cheap beneath" title={storage.key}>{t('resource.beneath', { key: storage.key })}</p>{/if}
        <p class="cheap">
          {#if details.partition && details.partitionFilter !== 'none'}{t('resource.filterRequired', { field: details.partition.field })}
          {:else if details.partition}{t('resource.filterFirst', { field: details.partition.field })}{/if}
          {#if details.clusterBy[0]}{t('resource.clusterThen', { field: details.clusterBy[0] })}{/if}
        </p>
      {:else}
        {#if size}
          <FactsList><dt>{t('resource.size')}</dt><dd>{size}</dd></FactsList>
          {#if storage?.beneath}<p class="cheap beneath" title={storage.key}>{t('resource.beneath', { key: storage.key })}</p>{/if}
        {/if}
        <p class="empty" class:cheap={size !== null}>{t('resource.notStored')}</p>
      {/if}
    </SubTile>

    <SubTile label={t('resource.entities')} span="all">
      {#snippet aside()}<OriginTag origin="dataTeam" />{/snippet}
      {@render entities(true)}
    </SubTile>

    <SubTile label={t('resource.history')} span="all">
      {#if log}<LogList entries={log.slice(0, 5)} />{/if}
    </SubTile>
  </Grid>
{/if}

<style>
  .edit { all: unset; display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: var(--radius-sm); font-size: var(--text-meta); color: var(--text-muted); cursor: pointer; }
  .edit:hover { color: var(--text-primary); background: var(--tint-hover); }
  .edit:focus-visible { outline: 2px solid var(--text-secondary); }
  .text-link { all: unset; display: inline-block; margin-top: 10px; font-size: var(--text-small); color: var(--text-secondary); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
  .model { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 12px; }
  .code { display: inline-flex; align-items: center; gap: 4px; font: var(--text-meta) var(--font-mono); color: var(--text-secondary); background: var(--surface-solid); padding: 3px 8px; border-radius: var(--radius-chip); }
  .code button { all: unset; cursor: pointer; color: var(--text-muted); }
  .code button:focus-visible { outline: 2px solid var(--text-secondary); }
  .chosen { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .second { margin-top: 12px; }
  .add { font: var(--text-meta) var(--font-family); color: var(--text-secondary); background: transparent; border: 1px dashed var(--tint-active); border-radius: var(--radius-chip); padding: 3px 6px; }
  .level { font-size: 14px; font-weight: var(--weight-medium); margin-top: 6px; }
  .meta { display: block; }
  .said { display: flex; align-items: center; gap: 6px; font-size: var(--text-meta); font-weight: var(--weight-medium); }
  .said :global(.icon) { color: var(--text-secondary); }
  .text { font-size: var(--text-meta); color: var(--text-secondary); margin: 3px 0 10px 20px; line-height: 1.5; white-space: pre-line; }
  .text.last { margin-bottom: 0; }
  .gap { display: flex; gap: 8px; font-size: var(--text-meta); line-height: 1.5; margin-bottom: 10px; white-space: pre-line; }
  .gap :global(.icon) { color: var(--text-muted); margin-top: 2px; flex: none; }
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
  textarea, input { width: 100%; box-sizing: border-box; font: var(--text-small) var(--font-family); line-height: 1.5; color: var(--text-primary); background: var(--surface-solid); border: 1px solid var(--tint-active); border-radius: var(--radius-field); padding: 8px 10px; resize: vertical; }
  textarea:focus, input:focus { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
  .hint { margin: 6px 0 0; font-size: var(--text-meta); color: var(--text-muted); line-height: 1.5; }
  .reliable { margin-top: 12px; }
  .add-gap { font: var(--text-meta) var(--font-family); color: var(--text-secondary); background: transparent; border: 1px dashed var(--tint-active); border-radius: var(--radius-chip); padding: 3px 8px; cursor: pointer; }
  .failed { margin: 8px 0; font-size: var(--text-small); color: var(--signal-urgent); }
  form { display: block; }
</style>

<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import { levelName } from '@datahub/ui/foundations/levels.js';
  import Sentence from '@datahub/ui/foundations/Sentence.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import { cardinalityOf, type Draft, type FieldDraft, type MappingKind, MODEL_TYPES, strangers, subjectOf, subjectsOf, UNITS } from '../lib/grain.js';
  import type { DomainModelView } from '../lib/registry.js';

  /**
   * One Resource at the second step of adding it (FR-CO-33, FR-CO-34): how it is stored and what one row
   * is, on a quiet surface, then the mapping of every field. Each value says where it came from; what the
   * Data Admin changes is theirs. The cardinality is shown, never asked (DEC-RC-08).
   */
  let {
    draft = $bindable(),
    model,
    show,
  }: {
    draft: Draft;
    /** The Domain Model in use; null when the collector did not answer (EC-AR-05). */
    model: DomainModelView | null;
    /** All fields, or only those with a mapping. */
    show: 'all' | 'mapped';
  } = $props();

  const types = $derived(new Map((model?.relationTypes ?? []).map((type) => [type.name, type.cardinality])));
  const identities = $derived(new Set(model?.identities ?? []));
  const names = $derived(draft.fields.map((field) => field.name));
  const mapped = $derived(draft.fields.filter((field) => field.kind !== 'none').length);
  const fromModel = $derived(draft.fields.filter((field) => field.kind !== 'none' && field.origin === 'domainModel').length);
  const subjects = $derived(subjectsOf(draft));
  const unknown = $derived(new Set(strangers(draft, identities)));
  const datalist = $derived(`identities-${draft.id}`);

  /** The words and icon of where a value came from. */
  const ORIGINS: Record<string, { icon: IconName; key: string; quiet?: boolean }> = {
    dbt: { icon: 'file-text', key: 'grain.origin.dbt' },
    test: { icon: 'file-text', key: 'grain.origin.test' },
    domainModel: { icon: 'graph', key: 'grain.origin.domainModel' },
    suggested: { icon: 'graph', key: 'grain.origin.suggested' },
    name: { icon: 'lightbulb', key: 'grain.origin.name', quiet: true },
    here: { icon: 'user', key: 'grain.origin.chosen' },
    written: { icon: 'user', key: 'grain.origin.written' },
    bigQuery: { icon: 'lock-simple', key: 'grain.origin.bigQuery' },
    optional: { icon: 'info', key: 'grain.origin.optional', quiet: true },
  };

  function setMapping(field: FieldDraft, value: string) {
    const kind: MappingKind = value === 'none' || value === 'is' || value === 'performedBy' ? value : 'relation';
    field.kind = kind;
    field.relationType = kind === 'relation' ? value : null;
    field.origin = 'here';
  }

  function remove<K extends 'clusterBy' | 'grain'>(key: K, name: string) {
    draft[key] = draft[key].filter((other) => other !== name);
    draft.origins[key] = 'here';
  }

  function add<K extends 'clusterBy' | 'grain'>(key: K, event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    if (select.value && !draft[key].includes(select.value)) {
      draft[key] = [...draft[key], select.value];
      draft.origins[key] = 'here';
    }
    select.value = '';
  }

  function partitionField(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    draft.partition = value ? { field: value, unit: draft.partition?.unit ?? 'day' } : null;
    draft.origins.partition = 'here';
    if (!draft.partition) {
      draft.partitionFilter = 'none';
      draft.filterLocked = false;
    }
  }

  const UNIT_KEYS = { hour: 'grain.unit.hour', day: 'grain.unit.day', month: 'grain.unit.month', year: 'grain.unit.year' } as const;
  const GROUP_KEYS = { one: 'grain.map.one', many: 'grain.map.many', either: 'grain.map.either' } as const;
  const LEFT_OUT: Record<string, string> = { array: 'grain.kind.array', struct: 'grain.kind.struct', json: 'grain.kind.json', bytes: 'grain.kind.bytes' };
  const list = (items: string[]) => new Intl.ListFormat(currentLanguage() === 'nl' ? 'nl-BE' : 'en-GB').format(items);
</script>

{#snippet origin(kind: string, title?: string)}
  {@const shown = ORIGINS[kind]}
  <!-- Always a cell, also without an origin, so that each row of the storage keeps its three columns. -->
  <span class="origin" class:quiet={shown?.quiet} title={shown ? title : undefined}>{#if shown}<Icon name={shown.icon} />{t(shown.key)}{/if}</span>
{/snippet}

<div class="block">
  <div class="head">
    <span class="kind"><KindIcon kind="resource" /></span>
    <span class="item-title name">{draft.displayName}</span>
    <span class="level"><MaturityIcon level={draft.level} tooltip={false} />{levelName(draft.level)}</span>
  </div>
  <p class="meta built">
    {#if draft.builtOn?.colleciones && draft.builtOn.action}
      <Sentence key="grain.built.event" names={{ event: `${draft.builtOn.entity}.${draft.builtOn.action}` }} />
    {:else if draft.builtOn?.colleciones}
      <Sentence key="grain.built.colleciones" names={{ model: draft.builtOn.name }} />
    {:else if draft.builtOn}
      <Sentence key="grain.built.model" names={{ model: draft.builtOn.name }} />
    {/if}
    · {t('grain.counts', { fields: names.length, mapped })}
  </p>

  <div class="store" role="group" aria-label={t('grain.store')}>
    <span class="meta">{t('grain.partition')}</span>
    <span class="value">
      <select class="mono" aria-label={t('grain.partition.column')} value={draft.partition?.field ?? ''} onchange={partitionField}>
        <option value="">{t('grain.partition.none')}</option>
        {#each names as name (name)}<option value={name}>{name}</option>{/each}
      </select>
      {#if draft.partition}
        <select
          aria-label={t('grain.partition.unit')}
          value={draft.partition.unit ?? ''}
          onchange={(event) => {
            if (draft.partition) {
              const unit = (event.currentTarget as HTMLSelectElement).value;
              draft.partition = { ...draft.partition, unit: UNITS.find((one) => one === unit) ?? null };
              draft.origins.partition = 'here';
            }
          }}
        >
          {#each UNITS as unit (unit)}<option value={unit}>{t(UNIT_KEYS[unit])}</option>{/each}
          <option value="">{t('grain.unit.range')}</option>
        </select>
      {/if}
    </span>
    {@render origin(draft.origins.partition ?? (draft.partition ? 'here' : ''), t('grain.origin.dbt.title'))}

    <span class="meta">{t('grain.cluster')}</span>
    <span class="value">
      {#each draft.clusterBy as name (name)}
        <span class="chip">{name}<button type="button" aria-label={t('grain.remove', { name })} onclick={() => remove('clusterBy', name)}>×</button></span>
      {/each}
      {#if draft.clusterBy.length < 4}
        <select class="add" aria-label={t('grain.addColumn')} onchange={(event) => add('clusterBy', event)}>
          <option value="">+ {t('grain.addColumn')}</option>
          {#each names.filter((name) => !draft.clusterBy.includes(name)) as name (name)}<option value={name}>{name}</option>{/each}
        </select>
      {/if}
    </span>
    {@render origin(draft.origins.clusterBy ?? '')}

    <span class="meta">{t('grain.filter')}</span>
    <label class="value check">
      <input
        type="checkbox"
        checked={draft.partitionFilter !== 'none'}
        disabled={!draft.partition || draft.filterLocked}
        onchange={(event) => {
          draft.partitionFilter = (event.currentTarget as HTMLInputElement).checked ? 'dataHub' : 'none';
          draft.origins.partitionFilter = 'here';
        }}
      />{t('grain.filter.required')}
    </label>
    {#if draft.filterLocked}{@render origin('bigQuery', t('grain.origin.bigQuery.title'))}{:else if draft.partition}{@render origin(
        draft.partitionFilter === 'dataHub' ? 'here' : 'optional',
        t('grain.origin.optional.title', { field: draft.partition.field }),
      )}{:else}{@render origin('')}{/if}

    <span class="rule" aria-hidden="true"></span>

    <span class="meta">Grain</span>
    <span class="value">
      {#each draft.grain as name (name)}
        <span class="chip">{name}<button type="button" aria-label={t('grain.remove', { name })} onclick={() => remove('grain', name)}>×</button></span>
      {/each}
      <select class="add" aria-label={t('grain.addField')} onchange={(event) => add('grain', event)}>
        <option value="">+ {t('grain.addField')}</option>
        {#each names.filter((name) => !draft.grain.includes(name)) as name (name)}<option value={name}>{name}</option>{/each}
      </select>
    </span>
    {@render origin(draft.origins.grain ?? '')}

    <span class="meta">{t('grain.sentence')}</span>
    <span class="value"><input class="sentence" bind:value={draft.grainSentence} maxlength="200" aria-label={t('grain.sentence.label')} /></span>
    {@render origin(draft.grainSentence.trim() ? 'written' : '')}

    <span class="meta">{t('grain.modelType')}</span>
    <span class="value">
      <select
        aria-label={t('grain.modelType')}
        value={draft.modelType ?? ''}
        onchange={(event) => {
          const value = (event.currentTarget as HTMLSelectElement).value;
          draft.modelType = MODEL_TYPES.find((type) => type === value) ?? null;
          draft.origins.modelType = 'here';
        }}
      >
        <option value="">{t('grain.modelType.none')}</option>
        {#each MODEL_TYPES as type (type)}<option value={type}>{type}</option>{/each}
      </select>
    </span>
    {@render origin(draft.origins.modelType === 'domainModel' ? 'suggested' : (draft.origins.modelType ?? ''))}
  </div>

  <!-- What the proposal was made from; recorded mappings, as Edit relations shows them, were not proposed. -->
  {#if model && draft.builtOn}
    <p class="check-line">
      <Icon name={draft.builtOn?.colleciones ? 'graph' : 'lightbulb'} />
      <span>{draft.builtOn?.colleciones ? t('grain.fromModel', { count: fromModel }) : t('grain.notModel')}</span>
    </p>
  {/if}

  <table class="fields">
    <thead>
      <tr><th>{t('grain.column.field')}</th><th>Mapping</th><th>{t('grain.column.identity')}</th></tr>
    </thead>
    <tbody>
      {#each draft.fields as field (field.name)}
        {#if show === 'all' || field.kind !== 'none'}
          {@const shown = cardinalityOf(draft, field, types)}
          {@const subject = subjectOf(draft, field)}
          <tr class:none={field.kind === 'none'}>
            <td>
              <span class="field">
                <code>{field.name}</code>
                {#if field.dataType}<span class="meta">{field.dataType.toLowerCase()}</span>{/if}
                {#if draft.grain.includes(field.name)}
                  <span class="grain-mark" title={t('grain.mark.title')}><Icon name="key" />grain</span>
                {/if}
              </span>
              {#if field.description}<span class="description">{field.description}</span>{/if}
            </td>
            <td>
              <select
                class="map"
                aria-label={t('grain.map.label', { field: field.name })}
                value={field.kind === 'relation' ? (field.relationType ?? '') : field.kind}
                onchange={(event) => setMapping(field, (event.currentTarget as HTMLSelectElement).value)}
              >
                <option value="none">{t('grain.map.none')}</option>
                <option value="is">is</option>
                {#each ['one', 'many', 'either'] as const as cardinality (cardinality)}
                  {@const group = (model?.relationTypes ?? []).filter((type) => type.cardinality === cardinality)}
                  {#if group.length > 0}
                    <optgroup label={t(GROUP_KEYS[cardinality])}>
                      {#each group as type (type.name)}<option value={type.name} title={type.description}>{type.name}</option>{/each}
                    </optgroup>
                  {/if}
                {/each}
                {#if field.kind === 'relation' && field.relationType && !types.has(field.relationType)}
                  <option value={field.relationType}>{field.relationType}</option>
                {/if}
                <optgroup label={t('grain.map.action')}><option value="performedBy">{t('grain.map.performedBy')}</option></optgroup>
              </select>
            </td>
            <td>
              {#if field.kind !== 'none'}
                <input
                  class="identity"
                  value={field.identity}
                  placeholder="entity.identity"
                  list={datalist}
                  aria-label={t('grain.identity.label', { field: field.name })}
                  oninput={(event) => {
                    field.identity = (event.currentTarget as HTMLInputElement).value.trim();
                    field.origin = 'here';
                  }}
                />
                <span class="under">
                  {@render origin(field.origin === 'name' ? 'name' : field.origin, field.origin === 'name' ? t('grain.origin.name.title') : undefined)}
                </span>
                {#if field.kind !== 'is' && subject}
                  {#if subjects.length > 1}
                    <label class="from"
                      >{t('grain.startsFrom')}
                      <select
                        class="mono"
                        aria-label={t('grain.subject.label', { field: field.name })}
                        value={subject.name}
                        onchange={(event) => (field.subject = (event.currentTarget as HTMLSelectElement).value)}
                      >
                        {#each subjects as one (one.name)}<option value={one.name}>{one.identity}</option>{/each}
                      </select></label
                    >
                  {:else}
                    <span class="from">{t('grain.startsFrom')} <code>{subject.identity}</code></span>
                  {/if}
                {/if}
                {#if shown}
                  <span class="card">{#if shown.badge}<b class="badge">{shown.badge}</b>{/if}<span>{t(shown.key, shown.values)}</span></span>
                {/if}
                {#if !/^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/.test(field.identity)}
                  <span class="note warn"><Icon name="warning" /><span>{t('grain.identity.missing')}</span></span>
                {:else if model && unknown.has(field.identity.split('.')[0] ?? '')}
                  <span class="note"><Icon name="info" /><span><Sentence key="grain.stranger" names={{ entity: field.identity.split('.')[0] ?? '' }} /></span></span>
                {/if}
              {/if}
            </td>
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>
  <datalist id={datalist}>
    {#each model?.identities ?? [] as identity (identity)}<option value={identity}></option>{/each}
  </datalist>
  {#if draft.leftOut.length > 0}
    <p class="check-line">
      <Icon name="brackets-square" />
      <span>{t('grain.leftOut', { names: list(draft.leftOut.map((column) => column.name)), kinds: list([...new Set(draft.leftOut.map((column) => t(LEFT_OUT[column.reason] ?? 'grain.kind.struct')))]) })}</span>
    </p>
  {/if}
</div>

<style>
  .block { padding: 14px 0 6px; border-top: 1px solid var(--tint-active); }
  .block:first-child { border-top: 0; padding-top: 6px; }
  .head { display: flex; align-items: center; gap: 8px; }
  .kind { display: inline-flex; font-size: 14px; color: var(--text-muted); }
  .name { flex: 1; min-width: 0; }
  .level { display: inline-flex; align-items: center; gap: 7px; color: var(--text-secondary); white-space: nowrap; font-size: var(--text-small); }
  .built { display: block; margin: 4px 0 6px 23px; }
  .store { display: grid; grid-template-columns: 112px 1fr auto; align-items: center; gap: 8px 12px; margin: 0 0 10px 23px; padding: 10px 12px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .value { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: var(--text-small); }
  .store select, .sentence { font: var(--text-small) var(--font-family); color: var(--text-primary); background: var(--surface-solid); border: 1px solid var(--tint-active); border-radius: var(--radius-sm); padding: 4px 6px; }
  .store .mono { font-family: var(--font-mono); }
  .store .add { border-style: dashed; color: var(--text-secondary); background: none; font-size: var(--text-meta); }
  .sentence { width: 220px; padding: 4px 8px; }
  .chip { display: inline-flex; align-items: center; font: var(--text-meta) var(--font-mono); color: var(--text-secondary); background: var(--surface-solid); padding: 3px 8px; border-radius: var(--radius-chip); }
  .chip button { all: unset; cursor: pointer; margin-left: 4px; color: var(--text-muted); }
  .chip button:focus-visible { outline: 2px solid var(--text-secondary); }
  .check { gap: 8px; cursor: pointer; }
  .check input { accent-color: var(--text-primary); }
  .check input:disabled { cursor: not-allowed; }
  .rule { grid-column: 1 / -1; height: 1px; background: var(--tint-active); margin: 2px 0; }
  .origin { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-meta); color: var(--text-secondary); white-space: nowrap; }
  .origin.quiet { color: var(--text-muted); }
  .check-line { display: flex; gap: 10px; align-items: flex-start; margin: 0 0 6px; padding: 3px 0; font-size: var(--text-small); line-height: 1.5; }
  .check-line :global(.icon) { font-size: 17px; margin-top: 1px; color: var(--text-secondary); }
  .fields { width: 100%; border-collapse: collapse; font-size: var(--text-small); }
  th { text-align: left; font-weight: var(--weight-regular); font-size: var(--text-meta); color: var(--text-muted); padding: 6px 8px 6px 0; }
  th:nth-child(2) { width: 150px; }
  th:nth-child(3) { width: 360px; }
  td { padding: 8px 8px 8px 0; vertical-align: top; border-top: 1px solid var(--tint-hover); }
  .field { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; }
  .field code { font: var(--text-small) var(--font-mono); color: var(--text-primary); }
  .description { display: block; margin-top: 2px; font-size: var(--text-meta); color: var(--text-secondary); line-height: 1.45; }
  .map, .identity { width: 100%; box-sizing: border-box; font: var(--text-small)/1.4 var(--font-mono); color: var(--text-primary); background: var(--surface-solid);
    border: 1px solid var(--tint-active); border-radius: var(--radius-sm); padding: 5px 7px; }
  .none .map { font-family: var(--font-family); color: var(--text-muted); }
  .grain-mark { display: inline-flex; align-items: center; gap: 3px; font-size: var(--text-meta); color: var(--text-secondary); background: var(--surface-sub); border-radius: var(--radius-pill); padding: 0 7px 0 5px; }
  .under { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin-top: 4px; }
  .from { display: flex; align-items: center; gap: 6px; margin-top: 5px; font-size: var(--text-meta); color: var(--text-secondary); white-space: nowrap; }
  .from code { font: var(--text-meta) var(--font-mono); color: var(--text-primary); }
  .from select { width: auto; min-width: 0; padding: 1px 4px; font: var(--text-meta) var(--font-mono); border: 1px solid var(--tint-active); border-radius: var(--radius-sm); background: var(--surface-solid); color: var(--text-primary); }
  .card { display: flex; align-items: baseline; gap: 6px; margin-top: 5px; font-size: var(--text-meta); color: var(--text-secondary); line-height: 1.4; }
  .badge { flex: none; font: var(--weight-medium) 10.5px/1.5 var(--font-mono); padding: 0 5px; border-radius: var(--radius-chip); border: 1px solid var(--tint-active); color: var(--text-primary); }
  .note { display: flex; align-items: flex-start; gap: 6px; margin-top: 5px; font-size: var(--text-meta); line-height: 1.4; color: var(--text-secondary); }
  .note.warn { color: var(--signal-warn); }
</style>

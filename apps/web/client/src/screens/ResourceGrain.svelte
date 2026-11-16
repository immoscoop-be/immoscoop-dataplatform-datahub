<script lang="ts">
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import Sentence from '@datahub/ui/foundations/Sentence.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import { type Draft, ORIGINS, UNITS } from '../lib/grain.js';
  import ResourceDraftHead from './ResourceDraftHead.svelte';

  /**
   * One Resource at the step of its grain and storage (FR-CO-33, FR-CO-34, DEC-UX-262): its model type as a chip with
   * "Change", then on a quiet surface what one row is, its grain and "One row per", and below a thin line how it is
   * stored. Each value says where it came from; what the Data Admin changes is theirs. Data Hub does not check the grain
   * against the data (DEC-RC-15). For `other`, "One row per" is what one row is, and required (DEC-RC-21).
   */
  let {
    draft = $bindable(),
    onchangetype,
  }: {
    draft: Draft;
    /** Back to the step of the model type. */
    onchangetype: () => void;
  } = $props();

  const names = $derived(draft.fields.map((field) => field.name));

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
</script>

{#snippet origin(kind: string, title?: string)}
  {@const shown = ORIGINS[kind]}
  <!-- Always a cell, also without an origin, so that each row keeps its three columns. -->
  <span class="origin" class:quiet={shown?.quiet} title={shown ? title : undefined}>{#if shown}<Icon name={shown.icon} />{t(shown.key)}{/if}</span>
{/snippet}

<div class="block">
  <ResourceDraftHead {draft} />

  <div class="store" role="group" aria-label={t('grain.store')}>
    <div class="type">
      <span class="meta">{t('grain.modelType')}</span>
      {#if draft.modelType}<span class="chip">{draft.modelType}</span>{:else}<span class="meta">{t('grain.modelType.none')}</span>{/if}
      <button type="button" class="text-link" onclick={onchangetype}>{t('grain.change')}</button>
    </div>

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
    <span class="value">
      <input {...NO_PASSWORD_MANAGER} class="sentence" bind:value={draft.grainSentence} maxlength="200" aria-label={t('grain.sentence.label')} />
      {#if draft.modelType === 'other'}<span class="required"><Sentence key="grain.sentence.required" names={{ type: 'other' }} /></span>{/if}
    </span>
    {@render origin(draft.grainSentence.trim() ? 'written' : '')}

    <span class="rule" aria-hidden="true"></span>

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
  </div>
</div>

<style>
  .block { padding: 6px 0; }
  .store { display: grid; grid-template-columns: 112px 1fr auto; align-items: center; gap: 8px 12px; margin: 0 0 10px 23px; padding: 10px 12px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .type { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--text-small); }
  .value { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: var(--text-small); }
  .store select, .sentence { font: var(--text-small) var(--font-family); color: var(--text-primary); background: var(--surface-solid); border: 1px solid var(--tint-active); border-radius: var(--radius-sm); padding: 4px 6px; }
  .store .mono { font-family: var(--font-mono); }
  .store .add { border-style: dashed; color: var(--text-secondary); background: none; font-size: var(--text-meta); }
  .sentence { width: 220px; padding: 4px 8px; }
  .required { font-size: var(--text-meta); color: var(--text-muted); }
  .chip { display: inline-flex; align-items: center; font: var(--text-meta) var(--font-mono); color: var(--text-secondary); background: var(--surface-solid); padding: 3px 8px; border-radius: var(--radius-chip); }
  .chip button { all: unset; cursor: pointer; margin-left: 4px; color: var(--text-muted); }
  .chip button:focus-visible { outline: 2px solid var(--text-secondary); }
  .text-link { all: unset; cursor: pointer; font-size: var(--text-small); color: var(--text-secondary); text-decoration: underline; text-underline-offset: 3px; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
  .check { gap: 8px; cursor: pointer; }
  .check input { accent-color: var(--text-primary); }
  .check input:disabled { cursor: not-allowed; }
  .rule { grid-column: 1 / -1; height: 1px; background: var(--tint-active); margin: 2px 0; }
  .origin { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-meta); color: var(--text-secondary); white-space: nowrap; }
  .origin.quiet { color: var(--text-muted); }
</style>

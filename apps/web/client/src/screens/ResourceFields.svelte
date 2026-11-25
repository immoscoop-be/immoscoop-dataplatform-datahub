<script lang="ts">
  import { rolesFor } from '@datahub/contracts/model-types';
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import Sentence from '@datahub/ui/foundations/Sentence.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { cardinalityOf, type Draft, type FieldDraft, holdRole, type MappingKind, ORIGINS, roleOf, strangers, subjectOf, subjectsOf } from '../lib/grain.js';
  import type { DomainModelView } from '../lib/registry.js';
  import { needLines, ROLE_KEYS, shortOf } from '../lib/typeFields.js';
  import ResourceDraftHead from './ResourceDraftHead.svelte';

  /**
   * One Resource at the step of its fields and relations (FR-CO-33, FR-CO-44, DEC-UX-262). On top, what its model type
   * asks for, a line per field it needs, chosen or missing. Then the table of its fields: in the column "For the <type>"
   * right after each field, what the field is for its model type, offered only the roles its type fits; a role one
   * field holds moves when it is chosen on another. Then the mapping of every field: each value says where it came
   * from, and the cardinality is shown, never asked (DEC-RC-08).
   */
  let {
    draft = $bindable(),
    model,
    show,
    fixed = false,
    onchangetype,
  }: {
    draft: Draft;
    /** The Domain Model in use; null when the collector did not answer (EC-AR-05). */
    model: DomainModelView | null;
    /** All fields, or only those with a mapping. */
    show: 'all' | 'mapped';
    /**
     * The model type and its fields are shown but not changed: for who may map fields (entityMapping) but not
     * assign, as only a Data Admin changes them (DEC-PL-03).
     */
    fixed?: boolean;
    /** Back to the step of the model type. */
    onchangetype: () => void;
  } = $props();

  const types = $derived(new Map((model?.relationTypes ?? []).map((type) => [type.name, type.cardinality])));
  const identities = $derived(new Set(model?.identities ?? []));
  const fromModel = $derived(draft.fields.filter((field) => field.kind !== 'none' && field.origin === 'domainModel').length);
  const subjects = $derived(subjectsOf(draft));
  const unknown = $derived(new Set(strangers(draft, identities)));
  const datalist = $derived(`identities-${draft.id}`);
  const typed = $derived(draft.modelType !== null && draft.modelType !== 'other');
  const column = $derived(t('fields.column.role', { type: draft.modelType ?? '' }));
  const lines = $derived(
    needLines(
      draft.modelType,
      draft.typeFields,
      draft.fields.map((field) => ({ name: field.name, dataType: field.dataType })),
      draft.grainSentence,
    ),
  );

  function setMapping(field: FieldDraft, value: string) {
    const kind: MappingKind = value === 'none' || value === 'is' || value === 'performedBy' ? value : 'relation';
    field.kind = kind;
    field.relationType = kind === 'relation' ? value : null;
    field.origin = 'here';
  }

  const GROUP_KEYS = { one: 'grain.map.one', many: 'grain.map.many', either: 'grain.map.either' } as const;
  const LEFT_OUT: Record<string, string> = { array: 'grain.kind.array', struct: 'grain.kind.struct', json: 'grain.kind.json', bytes: 'grain.kind.bytes' };
  const STATE_ICONS = { ok: 'check-circle', missing: 'warning-circle-fill', optional: 'circle-dashed' } as const;
  const list = (items: string[]) => new Intl.ListFormat(currentLanguage() === 'nl' ? 'nl-BE' : 'en-GB').format(items);
</script>

{#snippet origin(kind: string, title?: string)}
  {@const shown = ORIGINS[kind]}
  <span class="origin" class:quiet={shown?.quiet} title={shown ? title : undefined}>{#if shown}<Icon name={shown.icon} />{t(shown.key)}{/if}</span>
{/snippet}

<div class="block">
  <ResourceDraftHead {draft} />

  <!-- What its model type asks for, chosen or missing (FR-CO-44). -->
  <div class="needs" role="group" aria-label={t('fields.needs')}>
    <div class="type">
      <span class="meta">{t('grain.modelType')}</span>
      {#if draft.modelType}<span class="chip">{draft.modelType}</span>{:else}<span class="meta">{t('grain.modelType.none')}</span>{/if}
      {#if !fixed}<button type="button" class="text-link" onclick={onchangetype}>{t('grain.change')}</button>{/if}
      {#if draft.modelType}<span class="def">{shortOf(draft.modelType)}</span>{/if}
    </div>
    {#if draft.modelType === 'other'}
      {@const written = draft.grainSentence.trim()}
      <div class="line" class:missing={!written}>
        <Icon name={written ? STATE_ICONS.ok : STATE_ICONS.missing} />
        <b>{t('grain.sentence')}</b>
        {#if written}<span class="chip">{written}</span>{@render origin('before')}{:else}<span class="meta">{t('fields.need.sentence')}</span>{/if}
        <span class="req">{t('fields.need.required')}</span>
      </div>
    {/if}
    {#each lines as line (line.label)}
      <div class="line {line.state}">
        <Icon name={STATE_ICONS[line.state]} />
        <b>{t(line.label)}</b>
        {#if line.unmarked.length > 0}
          <span class="meta"><Sentence key="fields.need.unmarked" values={{ column }} names={{ fields: list(line.unmarked) }} /></span>
        {:else if line.fields.length > 0}
          {#each line.fields as held (held.field)}<span class="chip">{held.field}</span>{/each}
          {@render origin(line.fields[0]?.origin ?? '')}
        {:else if line.gone.length > 0}
          <span class="meta"><Sentence key="fields.need.gone" values={{ column }} names={{ field: list(line.gone.map((one) => one.field)) }} /></span>
        {:else}
          <span class="meta">{t('fields.need.notChosen', { column })}</span>
        {/if}
        <span class="req">{t(line.need)}</span>
      </div>
    {/each}
  </div>

  <!-- What the proposal was made from; recorded mappings, as Edit relations shows them, were not proposed. -->
  {#if model && draft.builtOn}
    <p class="check-line">
      <Icon name={draft.builtOn?.colleciones ? 'graph' : 'lightbulb'} />
      <span>{draft.builtOn?.colleciones ? t('grain.fromModel', { count: fromModel }) : t('grain.notModel')}</span>
    </p>
  {/if}

  <table class="fields" class:typed>
    <thead>
      <tr>
        <th>{t('grain.column.field')}</th>
        {#if typed}<th>{column}</th>{/if}
        <th>Mapping</th>
        <th>{t('grain.column.identity')}</th>
      </tr>
    </thead>
    <tbody>
      {#each draft.fields as field (field.name)}
        {#if show === 'all' || field.kind !== 'none'}
          {@const shown = cardinalityOf(draft, field, types)}
          {@const subject = subjectOf(draft, field)}
          {@const offered = rolesFor(draft.modelType, field.dataType)}
          {@const role = roleOf(draft, field.name)}
          <tr class:none={field.kind === 'none'}>
            <td>
              <span class="field">
                <code>{field.name}</code>
                {#if field.dataType}<span class="meta">{field.dataType.toLowerCase()}</span>{/if}
                {#if draft.grain.includes(field.name)}
                  <span class="grain-mark" title={t('grain.mark.title')}><Icon name="key" />{t('overview.row.grain')}</span>
                {/if}
              </span>
              {#if field.description}<span class="description">{field.description}</span>{/if}
            </td>
            {#if typed}
              <td>
                <select
                  class="role"
                  class:set={role !== null}
                  aria-label={t('fields.role.label', { field: field.name })}
                  value={role ?? ''}
                  disabled={fixed || offered.length === 0}
                  onchange={(event) => {
                    const value = (event.currentTarget as HTMLSelectElement).value;
                    holdRole(draft, field.name, offered.find((one) => one === value) ?? null);
                  }}
                >
                  <option value="">—</option>
                  {#each offered as one (one)}<option value={one}>{t(ROLE_KEYS[one])}</option>{/each}
                </select>
              </td>
            {/if}
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
                <input {...NO_PASSWORD_MANAGER}
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
  .block { padding: 6px 0; }
  .needs { display: flex; flex-direction: column; gap: 6px; margin: 0 0 10px 23px; padding: 10px 12px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .type, .line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--text-small); }
  .def { color: var(--text-secondary); }
  .line > :global(.icon) { font-size: 16px; color: var(--text-secondary); }
  .line b { font-weight: var(--weight-medium); }
  .line.missing > :global(.icon), .line.missing .req { color: var(--signal-warn); font-weight: var(--weight-medium); }
  .req { font-size: var(--text-meta); color: var(--text-muted); }
  .chip { display: inline-flex; align-items: center; font: var(--text-meta) var(--font-mono); color: var(--text-secondary); background: var(--surface-solid); padding: 3px 8px; border-radius: var(--radius-chip); }
  .text-link { all: unset; cursor: pointer; font-size: var(--text-small); color: var(--text-secondary); text-decoration: underline; text-underline-offset: 3px; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
  .origin { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-meta); color: var(--text-secondary); white-space: nowrap; }
  .origin.quiet { color: var(--text-muted); }
  .check-line { display: flex; gap: 10px; align-items: flex-start; margin: 0 0 6px; padding: 3px 0; font-size: var(--text-small); line-height: 1.5; }
  .check-line :global(.icon) { font-size: 17px; margin-top: 1px; color: var(--text-secondary); }
  .fields { width: 100%; border-collapse: collapse; font-size: var(--text-small); }
  th { text-align: left; font-weight: var(--weight-regular); font-size: var(--text-meta); color: var(--text-muted); padding: 6px 8px 6px 0; }
  th:nth-child(2) { width: 150px; }
  th:nth-child(3) { width: 360px; }
  .typed th:nth-child(2) { width: 196px; }
  .typed th:nth-child(3) { width: 150px; }
  .typed th:nth-child(4) { width: 304px; }
  td { padding: 8px 8px 8px 0; vertical-align: top; border-top: 1px solid var(--tint-hover); }
  .field { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; }
  .field code { font: var(--text-small) var(--font-mono); color: var(--text-primary); }
  .description { display: block; margin-top: 2px; font-size: var(--text-meta); color: var(--text-secondary); line-height: 1.45; }
  .map, .identity, .role { width: 100%; box-sizing: border-box; font: var(--text-small)/1.4 var(--font-mono); color: var(--text-primary); background: var(--surface-solid);
    border: 1px solid var(--tint-active); border-radius: var(--radius-sm); padding: 5px 7px; }
  .role { font-family: var(--font-family); }
  .role:disabled { color: var(--text-muted); background: transparent; border-color: transparent; }
  .role.set { border-color: var(--text-muted); font-weight: var(--weight-medium); }
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

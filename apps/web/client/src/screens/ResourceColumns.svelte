<script lang="ts">
  import EditBar from '@datahub/ui/containers/EditBar.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import OriginTag from '@datahub/ui/marks/OriginTag.svelte';
  import type { Field, ResourceDetail } from '../lib/catalogue.js';
  import { nounOf } from '../lib/grain.js';

  /**
   * The Columns of a Resource (Columns table): each field with its type, its Business Description next
   * to its description from dbt, its Entity, and what it serves as, the partition, a cluster column with
   * its place, a Parameter. Its Owner Unit and the Data Team edit the Business Descriptions in place
   * (FR-RC-16), from 2 · Described on (DEC-MR-10); a Data Admin opens step 2 of adding with Edit relations
   * (DEC-UX-107).
   */
  let {
    resource,
    canEdit,
    relate,
    onsave,
    onrelate,
  }: {
    resource: ResourceDetail;
    canEdit: boolean;
    /** Whether the User may change the grain and relations: a Data Admin. */
    relate: boolean;
    onsave: (fields: { name: string; businessDescription: string }[]) => Promise<boolean>;
    onrelate: () => void;
  } = $props();

  const details = $derived(resource.details);
  const mapped = $derived(new Map(details.mappings.map((mapping) => [mapping.field, mapping])));
  const editable = $derived(canEdit && resource.level >= 2);

  /** What a field serves as, in the order of the design: the partition, a cluster column, a Parameter. */
  function roles(field: Field): { label: string; strong: boolean }[] {
    const cluster = details.clusterBy.indexOf(field.name);
    return [
      ...(details.partition?.field === field.name ? [{ label: t('resource.role.partition'), strong: true }] : []),
      ...(cluster >= 0 ? [{ label: t('resource.role.cluster', { number: cluster + 1 }), strong: true }] : []),
      ...(resource.card.parameters.includes(field.name) ? [{ label: t('resource.role.parameter'), strong: false }] : []),
    ];
  }

  let editing = $state(false);
  let saving = $state(false);
  let failed = $state(false);
  let texts: Record<string, string> = $state({});

  function start() {
    texts = Object.fromEntries(resource.fields.map((field) => [field.name, field.businessDescription]));
    failed = false;
    editing = true;
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    const changed = resource.fields
      .filter((field) => (texts[field.name] ?? '').trim() !== field.businessDescription)
      .map((field) => ({ name: field.name, businessDescription: (texts[field.name] ?? '').trim() }));
    if (changed.length === 0) {
      editing = false;
      return;
    }
    saving = true;
    const ok = await onsave(changed);
    saving = false;
    failed = !ok;
    editing = !ok;
  }
</script>

{#snippet pills(field: Field)}
  {#each roles(field) as role (role.label)}<span class="pill" class:strong={role.strong}>{role.label}</span>{/each}
{/snippet}

{#if editing}
  <form onsubmit={save} novalidate>
    <EditBar text={t('resource.fields.editing')} cancelLabel={t('collection.cancel')} saveLabel={t('collection.save')} {saving} oncancel={() => (editing = false)} />
    {#if failed}<p class="failed" role="alert">{t('resource.saveFailed')}</p>{/if}
    <div class="rows">
      <div class="row headrow">
        <span class="label">{t('resource.column.field')}</span>
        <span class="label">{t('description.business')} <OriginTag origin="owner" /></span>
        <span class="label">{t('description.dbt')} <OriginTag origin="dbt" /></span>
      </div>
      {#each resource.fields as field (field.name)}
        <div class="row">
          <div>
            <div class="mono name">{field.name}</div>
            <div class="type">{field.dataType ?? ''}</div>
            <div class="roles">{@render pills(field)}</div>
          </div>
          <textarea bind:value={texts[field.name]} rows="3" maxlength="2000" aria-label={`${t('description.business')} · ${field.name}`} placeholder={t('resource.fields.placeholder')}></textarea>
          <p class="dbt">{field.description || '–'}</p>
        </div>
      {/each}
    </div>
    <p class="note">{t('resource.fields.note')}</p>
  </form>
{:else}
  <div class="top">
    <p class="meta">{t('resource.columns.text')}</p>
    {#if relate}<button type="button" class="edit" title={t('resource.editRelations.title')} onclick={onrelate}><Icon name="graph-fill" />{t('resource.editRelations')}</button>{/if}
    {#if editable}<button type="button" class="edit" onclick={start}><Icon name="pencil-simple-fill" />{t('resource.edit')}</button>{/if}
  </div>
  <div class="scroll">
    <table aria-label={t('resource.tab.columns')}>
      <thead>
        <tr>
          <th>{t('resource.column.name')}</th>
          <th>{t('resource.column.type')}</th>
          <th>{t('description.business')} <OriginTag origin="owner" /></th>
          <th>{t('description.dbt')} <OriginTag origin="dbt" /></th>
          <th>{t('resource.column.entity')}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each resource.fields as field (field.name)}
          {@const mapping = mapped.get(field.name)}
          <tr>
            <td class="mono">{field.name}</td>
            <td class="type">{field.dataType ?? ''}</td>
            {#if field.businessDescription}<td>{field.businessDescription}</td>{:else}<td class="none" aria-label={t('resource.noBusiness')}>–</td>{/if}
            <td class="dbt">{field.description || '–'}</td>
            <td>{#if mapping}<span class="code" title={mapping.identity}>{nounOf(mapping.identity)}</span>{/if}</td>
            <td><span class="roles">{@render pills(field)}</span></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .top { display: flex; align-items: center; gap: 12px; margin: 0 6px 4px; }
  .top .meta { flex: 1; margin: 0; }
  .edit { all: unset; display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: var(--radius-sm); font-size: var(--text-meta); color: var(--text-muted); cursor: pointer; }
  .edit:hover { color: var(--text-primary); background: var(--tint-hover); }
  .edit:focus-visible { outline: 2px solid var(--text-secondary); }
  .scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: var(--text-small); }
  th { font-size: var(--text-meta); color: var(--text-muted); font-weight: var(--weight-regular); text-align: left; padding: 8px 10px; white-space: nowrap; }
  td { padding: 10px; border-top: 1px solid var(--tint-hover); vertical-align: top; line-height: 1.5; }
  .type { color: var(--text-muted); font-size: var(--text-meta); }
  .dbt { color: var(--text-secondary); }
  .none { color: var(--text-muted); }
  .code { display: inline-flex; font: var(--text-meta) var(--font-mono); color: var(--text-secondary); background: var(--surface-sub); padding: 3px 8px; border-radius: var(--radius-chip); }
  .roles { display: inline-flex; flex-wrap: wrap; gap: 4px; }
  .pill { font-size: 10px; color: var(--text-secondary); background: var(--tint-hover); padding: 2px 7px; border-radius: var(--radius-pill); white-space: nowrap; }
  .pill.strong { color: var(--text-primary); background: var(--tint-active); }
  .rows { margin-top: 8px; }
  .row { display: grid; grid-template-columns: minmax(140px, 0.8fr) minmax(0, 1.6fr) minmax(0, 1.3fr); gap: 18px; padding: 14px 6px; border-top: 1px solid var(--tint-hover); }
  .headrow { border-top: 0; padding-bottom: 6px; }
  .headrow .label { display: inline-flex; align-items: center; gap: 8px; margin: 0; }
  .name { font-size: var(--text-small); }
  .roles:not(:empty) { margin-top: 6px; }
  .row .dbt { margin: 0; font-size: var(--text-small); line-height: 1.5; }
  textarea { width: 100%; box-sizing: border-box; font: var(--text-small) var(--font-family); line-height: 1.5; color: var(--text-primary); background: var(--surface-solid); border: 1px solid var(--tint-active); border-radius: var(--radius-field); padding: 8px 10px; resize: vertical; }
  textarea:focus { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
  .note { margin: 14px 6px 0; font-size: var(--text-meta); color: var(--text-muted); line-height: 1.5; }
  .failed { margin: 8px 0; font-size: var(--text-small); color: var(--signal-urgent); }
  @media (max-width: 900px) { .row { grid-template-columns: 1fr; gap: 8px; } .headrow { display: none; } }
</style>

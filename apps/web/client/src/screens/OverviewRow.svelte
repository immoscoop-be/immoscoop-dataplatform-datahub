<script lang="ts">
  import SubTile from '@datahub/ui/containers/SubTile.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import Sentence from '@datahub/ui/foundations/Sentence.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import OriginTag from '@datahub/ui/marks/OriginTag.svelte';
  import type { ResourceDetail } from '../lib/catalogue.js';
  import { needLines, shortOf } from '../lib/typeFields.js';
  import LearningRef from './LearningRef.svelte';

  /**
   * What one row is, at the end of the Description of a Resource (FR-RC-28, DEC-RC-24, DEC-UX-263): its model type with
   * its definition in one line, its grain with its sentence, then each field its model type asks for, by its role, such
   * as "When it happened `eventDate`". A role whose field is gone shows so, in the signal colour (FR-RC-29). All of it
   * from the Data Team; a Data Admin changes the model type from its head.
   */
  let {
    resource,
    onchangetype,
  }: {
    resource: ResourceDetail;
    /** Opens the steps from the model type on, for who may (`resources.assign`); undefined for anyone else. */
    onchangetype?: () => void;
  } = $props();

  const details = $derived(resource.details);
  const typeFields = $derived(details.typeFields ?? []);
  const fields = $derived(resource.fields.map((field) => ({ name: field.name, dataType: field.dataType })));
  const lines = $derived(needLines(details.modelType, typeFields, fields, details.grainSentence));
  const LOCALES = { nl: 'nl-BE', en: 'en-GB' } as const;
  const day = (value: string) => new Intl.DateTimeFormat(LOCALES[currentLanguage()], { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  const list = (items: string[]) => new Intl.ListFormat(LOCALES[currentLanguage()]).format(items);
  /** When a field went, where the changes since its last Confirmation tell. */
  const removedAt = (field: string) => resource.changes.find((change) => change.field === field && change.change === 'removed')?.at;
</script>

<SubTile>
  <div class="head">
    <span class="label">{t('overview.row')}</span>
    <OriginTag origin="dataTeam" />
    <span class="space"></span>
    {#if onchangetype}
      <button type="button" class="text-link" onclick={onchangetype}><Icon name="pencil-simple" />{t(details.modelType ? 'overview.row.change' : 'overview.row.choose')}</button>
    {/if}
  </div>
  <dl class="facts">
    <dt>{t('grain.modelType')}</dt>
    <dd>
      {#if details.modelType}
        <LearningRef place="modelType" shape="chip">
          {#snippet children(mark)}<span class="code">{details.modelType}{@render mark?.()}</span>{/snippet}
        </LearningRef>
        <span>{shortOf(details.modelType)}</span>
      {:else}
        <span class="muted">{t('overview.row.none')}</span>
      {/if}
    </dd>
    {#if details.grain.length > 0 || details.grainSentence}
      <dt><LearningRef place="grain">{#snippet children(mark)}<span>{t('overview.row.grain')}{@render mark?.()}</span>{/snippet}</LearningRef></dt>
      <dd>
        {#each details.grain as name (name)}<span class="code">{name}</span>{/each}
        {#if details.grainSentence}<span>{t('overview.row.sentence', { sentence: details.grainSentence })}</span>{/if}
      </dd>
    {/if}
    {#each lines as line (line.label)}
      {#if line.state !== 'optional' || line.gone.length > 0}
        <dt>{t(line.label)}</dt>
        <dd>
          {#each line.fields as held (held.field)}
            {#if held.role === 'addsUp'}<span><Sentence key="overview.row.addsUp" names={{ field: held.field }} /></span>
            {:else if held.role === 'uniqueCount'}<span><Sentence key="overview.row.uniqueCount" names={{ field: held.field }} /></span>
            {:else}<span class="code">{held.field}</span>{/if}
          {/each}
          {#each line.gone as one (one.field)}
            {@const at = removedAt(one.field)}
            <span class="gone"><Icon name="warning-circle-fill" />{#if at}<Sentence key="overview.row.gone" values={{ date: day(at) }} names={{ field: one.field }} />{:else}<Sentence key="overview.row.left" names={{ field: one.field }} />{/if}</span>
          {/each}
          {#if line.unmarked.length > 0}
            <span class="gone"><Icon name="warning-circle-fill" /><Sentence key="overview.row.unmarked" names={{ fields: list(line.unmarked) }} /></span>
          {:else if line.state === 'missing' && line.fields.length === 0 && line.gone.length === 0}
            <span class="gone"><Icon name="warning-circle-fill" />{t('grain.modelType.none')}</span>
          {/if}
        </dd>
      {/if}
    {/each}
  </dl>
</SubTile>

<style>
  .head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .label { font-size: var(--text-meta); color: var(--text-muted); }
  .space { flex: 1; }
  .text-link { all: unset; display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-meta); color: var(--text-secondary); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
  .facts { display: grid; grid-template-columns: 112px 1fr; gap: 6px 10px; margin: 0; font-size: var(--text-small); line-height: 1.45; }
  dt { color: var(--text-muted); }
  dd { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; color: var(--text-primary); min-width: 0; }
  .code { display: inline-flex; align-items: center; gap: 4px; font: var(--text-meta) var(--font-mono); color: var(--text-secondary); background: var(--surface-solid); padding: 3px 8px; border-radius: var(--radius-chip); }
  .muted { color: var(--text-muted); }
  .gone { display: inline-flex; align-items: center; gap: 4px; color: var(--signal-warn); }
</style>

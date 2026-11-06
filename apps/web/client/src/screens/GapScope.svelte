<script lang="ts">
  import type { GapScope } from '@datahub/contracts/gaps';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import { spanOf, valuesOf } from '../lib/gaps.js';

  /**
   * The scope of a Known Gap (FR-RC-24, DEC-UX-177): as chips under its text, one per kind, or as one line under it in
   * the Summary (FR-RC-25). A field that left the Resource since says so (EC-RC-01).
   */
  let { scope, known, line = false }: { scope: GapScope; known: ReadonlySet<string>; line?: boolean } = $props();
</script>

{#snippet name(field: string)}
  <span class="mono" class:gone={!known.has(field)} title={known.has(field) ? undefined : t('gaps.gone', { name: field })}>{field}</span>
{/snippet}

{#if line}
  <span class="line">
    {#if scope.period}<span>{spanOf(scope.period)}</span>{/if}
    {#if scope.fields?.length}<span>{t('gaps.fieldsWord')} {#each scope.fields as field, index (field)}{index > 0 ? ', ' : ''}{@render name(field)}{/each}</span>{/if}
    {#if scope.rows}<span>{@render name(scope.rows.field)} {scope.rows.is === 'empty' ? t('gaps.isEmpty') : `${t('gaps.is')} ${valuesOf(scope.rows.values)}`}</span>{/if}
  </span>
{:else}
  <span class="chips">
    {#if scope.period}<span class="chip"><Icon name="calendar-blank" /><span class="kind">{t('gaps.period')}</span> {spanOf(scope.period)}</span>{/if}
    {#if scope.fields?.length}<span class="chip"><Icon name="columns" /><span class="kind">{t('gaps.fields')}</span> {#each scope.fields as field, index (field)}{index > 0 ? ', ' : ''}{@render name(field)}{/each}</span>{/if}
    {#if scope.rows}<span class="chip"><Icon name="rows" /><span class="kind">{t('gaps.rows')}</span> {@render name(scope.rows.field)} <span class="kind">{scope.rows.is === 'empty' ? t('gaps.isEmpty') : t('gaps.is')}</span>{#if scope.rows.is === 'oneOf'}{' '}<span class="mono">{valuesOf(scope.rows.values)}</span>{/if}</span>{/if}
  </span>
{/if}

<style>
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 2px 0 6px; }
  .chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px 3px 7px; border-radius: var(--radius-pill); background: var(--surface-solid); font-size: var(--text-meta); color: var(--text-primary); }
  .chip > :global(.icon) { font-size: 13px; color: var(--text-muted); }
  .kind { color: var(--text-muted); }
  .mono { font-family: var(--font-mono); }
  .gone { text-decoration: line-through; color: var(--text-muted); }
  .line { display: block; margin-top: 2px; font-size: var(--text-meta); color: var(--text-muted); }
  .line > span + span::before { content: ' · '; }
</style>

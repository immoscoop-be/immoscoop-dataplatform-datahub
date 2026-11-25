<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import type { Reporting } from '../lib/messages.js';

  /**
   * "Seems wrong?" next to a description from dbt, after its tag "From dbt" (DEC-UX-338): it opens the form that tells
   * the Data Team, in the Messages of the Resource (FR-CV-17). Quiet; on Columns only the flag, on the row the pointer
   * is on. For who may write Messages on the Resource.
   */
  let { reporting, field, compact = false }: { reporting: Reporting | undefined; field: string | null; compact?: boolean } = $props();
</script>

{#if reporting?.report}
  {@const report = reporting.report}
  <button type="button" class="seems" class:compact title={t('dbtReport.seemsWrong.title')} aria-label={compact ? t('dbtReport.seemsWrong.title') : undefined} onclick={() => report(field)}>
    <Icon name="flag" />{#if !compact}<span>{t('dbtReport.seemsWrong')}</span>{/if}
  </button>
{/if}

<style>
  .seems { all: unset; display: inline-flex; align-items: center; gap: 4px; margin-left: 6px; font-size: var(--text-meta); color: var(--text-muted); cursor: pointer; white-space: nowrap; vertical-align: baseline; }
  .seems:hover { color: var(--text-primary); text-decoration: underline; }
  .seems:focus-visible { outline: 2px solid var(--text-secondary); border-radius: var(--radius-sm); }
  /* On Columns, the flag shows on the row the pointer is on, and while it has the focus. */
  .compact { opacity: 0; transition: opacity var(--motion-ring); }
  :global(tr:hover) .compact,
  .compact:focus-visible { opacity: 1; }
</style>

<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { day } from '@datahub/ui/foundations/when.js';
  import type { Reporting } from '../lib/messages.js';

  /**
   * Under a description from dbt reported as wrong, for every reader, with the Request (FR-CV-17, DEC-UX-338): that the
   * Data Team is looking at it, or that it is to be corrected in dbt. It goes once refused, or once dbt changed it.
   */
  let { reporting, field, short = false }: { reporting: Reporting | undefined; field: string | null; short?: boolean } = $props();
  const reported = $derived(reporting?.reported.get(field ?? ''));
  const language = $derived(currentLanguage());
</script>

{#if reported}
  {@const date = day(reported.at, language)}
  <span class="reported" class:short role="note">
    <Icon name="flag-fill" />
    <span>{short ? t('dbtReport.reported.short', { date }) : reported.state === 'accepted' ? t('dbtReport.accepted', { date }) : t('dbtReport.reported', { date })}</span>
    <a href={reported.href}>{t('dbtReport.see')}</a>
  </span>
{/if}

<style>
  .reported { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin: 8px 0 0; font-size: var(--text-meta); line-height: 1.4; color: var(--signal-warn); }
  .reported :global(.icon) { flex: none; }
  .short { margin-top: 4px; }
  a { color: inherit; }
</style>

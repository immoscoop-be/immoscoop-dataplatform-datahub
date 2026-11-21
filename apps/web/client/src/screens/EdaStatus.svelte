<script lang="ts">
  import type { EdaStatus } from '@datahub/contracts/eda';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';

  /** Where an EDA stands, as a chip beside its title (DEC-ED-20, DEC-UX-321): In progress, dashed, until its EDA-Setup is complete, then Explored. */
  let { status }: { status: EdaStatus } = $props();
</script>

{#if status === 'explored'}
  <span class="status explored"><Icon name="seal-check-fill" />{t('eda.status.explored')}</span>
{:else}
  <span class="status progress"><Icon name="hourglass-medium" />{t('eda.status.inProgress')}</span>
{/if}

<style>
  .status { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; font-size: var(--text-meta); font-weight: var(--weight-medium); padding: 2px 8px;
    border-radius: var(--radius-pill); color: var(--text-secondary); }
  .status :global(.icon) { font-size: 13px; }
  .progress { outline: 1.5px dashed var(--text-muted); outline-offset: -1.5px; }
  .explored { background: var(--tint-hover); }
</style>

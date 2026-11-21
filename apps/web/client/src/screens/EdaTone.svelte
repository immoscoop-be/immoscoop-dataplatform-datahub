<script lang="ts">
  import type { DataHubReading } from '@datahub/contracts/eda';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import { READING_LOOK } from '../lib/eda.js';

  /**
   * Data Hub's reading of a result as a chip (FR-ED-11): As expected, quiet; Look at this, in the colour of a state that
   * calls for action; For you to judge, in the colour of what informs. A tone judges a result, never navigation.
   */
  let { reading }: { reading: DataHubReading } = $props();

  const look = $derived(READING_LOOK[reading]);
</script>

<span class="tone {look.tone}"><Icon name={look.icon} />{t(look.text)}</span>

<style>
  .tone { --tone-informative: var(--col-slate); display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; font-size: var(--text-meta); font-weight: var(--weight-medium);
    padding: 2px 8px; border-radius: var(--radius-pill); }
  :global([data-theme='dark']) .tone { --tone-informative: color-mix(in srgb, var(--col-slate) 45%, var(--text-primary)); }
  .tone :global(.icon) { font-size: 13px; }
  .healthy { color: var(--text-secondary); background: var(--tint-hover); }
  .attention { color: var(--signal-warn); background: color-mix(in srgb, var(--signal-warn) 14%, var(--surface-solid)); }
  .informative { color: var(--tone-informative); background: color-mix(in srgb, var(--tone-informative) 13%, var(--surface-solid)); }
</style>

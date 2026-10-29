<script lang="ts">
  import Icon from '../foundations/Icon.svelte';
  import type { IconName } from '../foundations/icons.js';
  import { t } from '../foundations/texts.svelte.js';

  /**
   * What an item is, by its icon (DEC-UX-11): a table for a Resource, an aperture for a Lens. Its kind is a name, never translated.
   * A Broken item carries a red dot on it, with what is missing on hover (Broken mark, DEC-UX-81).
   */
  let { kind, broken = null }: { kind: 'resource' | 'lens'; broken?: string | null } = $props();

  const KINDS: Record<typeof kind, { icon: IconName; name: string }> = {
    resource: { icon: 'table', name: 'Resource' },
    lens: { icon: 'aperture', name: 'Lens' },
  };
  const shown = $derived(KINDS[kind]);
</script>

<span
  class="kind"
  class:broken={broken !== null}
  role="img"
  aria-label={broken === null ? shown.name : t('kind.broken', { kind: shown.name, missing: broken })}
  title={broken ?? undefined}><Icon name={shown.icon} /></span
>

<style>
  .kind { display: inline-flex; flex: none; }
  .broken { position: relative; }
  .broken::after { content: ''; position: absolute; top: -2px; right: -4px; width: 7px; height: 7px; border-radius: 50%; background: var(--signal-urgent); box-shadow: 0 0 0 1.5px var(--surface-solid); }
</style>

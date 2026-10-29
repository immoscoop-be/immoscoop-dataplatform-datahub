<script lang="ts">
  import Icon from '../foundations/Icon.svelte';
  import type { IconName } from '../foundations/icons.js';

  /** What an item is, by its icon (DEC-UX-11): a table for a Resource, an aperture for a Lens. Its kind is a name, never translated. */
  let { kind }: { kind: 'resource' | 'lens' } = $props();

  const KINDS: Record<typeof kind, { icon: IconName; name: string }> = {
    resource: { icon: 'table', name: 'Resource' },
    lens: { icon: 'aperture', name: 'Lens' },
  };
  const shown = $derived(KINDS[kind]);
</script>

<span class="kind" role="img" aria-label={shown.name}><Icon name={shown.icon} /></span>

<style>
  .kind { display: inline-flex; flex: none; }
</style>

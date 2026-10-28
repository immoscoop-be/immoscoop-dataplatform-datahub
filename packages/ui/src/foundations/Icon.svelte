<script lang="ts">
  import { ICONS, type IconName } from './icons.js';

  /** An icon of the interface, as large as the text around it; with a label it is read out, without one it is not. */
  let { name, label }: { name: IconName; label?: string } = $props();
</script>

<span class="icon" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>{@html ICONS[name]}</span>

<style>
  .icon { display: inline-flex; width: 1em; height: 1em; flex: none; }
  .icon :global(svg) { display: block; width: 100%; height: 100%; }
</style>

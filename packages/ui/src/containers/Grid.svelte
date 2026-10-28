<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A grid always 100% wide: its tiles have a minimum width and grow until there is room for another
   * column, so there is never an empty strip on the right (Grid). The minimum is chosen per screen.
   */
  let { min = 'var(--tile-min-compact)', fill = false, children }: { min?: string; fill?: boolean; children: Snippet } = $props();
</script>

<div class="grid" class:fill style:--grid-min={min}>
  {@render children()}
</div>

<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(var(--grid-min), 1fr)); gap: var(--space-tile-gap); }
  /* Keeps every column, also when there are fewer tiles than columns */
  .fill { grid-template-columns: repeat(auto-fill, minmax(var(--grid-min), 1fr)); }
</style>

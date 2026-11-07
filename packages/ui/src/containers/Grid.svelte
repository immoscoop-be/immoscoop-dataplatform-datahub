<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A grid always 100% wide: its tiles have a minimum width and grow until there is room for another
   * column, so there is never an empty strip on the right (Grid). The minimum is chosen per screen;
   * inside the content of tabs the tiles stand closer.
   */
  let {
    min = 'var(--tile-min-compact)',
    fill = false,
    tight = false,
    children,
  }: { min?: string; fill?: boolean; tight?: boolean; children: Snippet } = $props();
</script>

<div class="grid" class:fill class:tight style:--grid-min={min}>
  {@render children()}
</div>

<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(var(--grid-min), 1fr)); gap: var(--space-tile-gap); }
  /* Keeps every column, also when there are fewer tiles than columns */
  .fill { grid-template-columns: repeat(auto-fill, minmax(var(--grid-min), 1fr)); }
  .tight { gap: 10px; }
</style>

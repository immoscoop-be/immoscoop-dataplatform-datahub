<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A card in a grid that grows to fill its width (Tile); with an address it opens what it shows, and
   * its outline says so on hover.
   */
  let { href, children }: { href?: string; children: Snippet } = $props();
</script>

{#if href}
  <a class="tile card link" {href}>{@render children()}</a>
{:else}
  <div class="tile card">{@render children()}</div>
{/if}

<style>
  .tile { display: block; min-width: 0; border-radius: var(--radius-lg); padding: 16px; outline: 1px solid transparent; color: inherit; text-decoration: none; }
  .link { cursor: pointer; }
  .link:hover { outline-color: var(--tint-active); }
  .link:focus-visible { outline: 2px solid var(--text-secondary); }
</style>

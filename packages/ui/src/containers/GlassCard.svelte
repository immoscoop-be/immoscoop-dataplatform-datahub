<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A card of glass over a photo or the background: it blurs what lies behind it, and is nearly
   * opaque where a browser cannot blur (DEC-UX-35). The card of the sign-in, or the smaller one that
   * tells the story of a photo.
   */
  let { as = 'div', story = false, children }: { as?: 'div' | 'main' | 'figure'; story?: boolean; children: Snippet } = $props();
</script>

<svelte:element this={as} class="glass" class:story>
  {@render children()}
</svelte:element>

<style>
  .glass { position: relative; margin: 0; padding: 30px 34px; border-radius: var(--radius-sign-in); -webkit-backdrop-filter: var(--blur-glass); backdrop-filter: var(--blur-glass);
    background: var(--glass); border: 1px solid var(--glass-edge); box-shadow: var(--glass-shadow); }
  .story { padding: 14px 18px; border-radius: var(--radius-surface); background: var(--glass-story); }
  @supports not (backdrop-filter: blur(1px)) { .glass { background: var(--glass-solid); } }
</style>

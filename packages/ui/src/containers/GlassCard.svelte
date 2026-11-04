<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A card of glass over the background: it blurs what lies behind it, and is nearly opaque where a
   * browser cannot blur (DEC-UX-35). The card of the sign-in.
   */
  let { as = 'div', children }: { as?: 'div' | 'main' | 'figure'; children: Snippet } = $props();
</script>

<svelte:element this={as} class="glass">
  {@render children()}
</svelte:element>

<style>
  .glass { position: relative; margin: 0; padding: 30px 34px; border-radius: var(--radius-sign-in); -webkit-backdrop-filter: var(--blur-glass); backdrop-filter: var(--blur-glass);
    background: var(--glass); border: 1px solid var(--glass-edge); box-shadow: var(--glass-shadow); }
  @supports not (backdrop-filter: blur(1px)) { .glass { background: var(--glass-solid); } }
</style>

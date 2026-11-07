<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Labels and their values, such as Published and Confirmed (Facts list): the page gives `dt` and `dd` pairs. */
  let { children }: { children: Snippet } = $props();
</script>

<dl class="facts">{@render children()}</dl>

<style>
  .facts { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; font-size: var(--text-small); line-height: 1.5; }
  .facts :global(dt) { color: var(--text-muted); }
  .facts :global(dd) { margin: 0; min-width: 0; overflow-wrap: anywhere; }
</style>

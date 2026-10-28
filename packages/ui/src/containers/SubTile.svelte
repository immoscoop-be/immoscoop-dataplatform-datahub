<script lang="ts">
  import type { Snippet } from 'svelte';

  /** A tile inside a reading surface, tinted rather than bordered (Tabs), with its label on top. */
  let { label, children }: { label?: string; children: Snippet } = $props();
</script>

<section class="sub-tile">
  {#if label}<div class="label">{label}</div>{/if}
  {@render children()}
</section>

<style>
  .sub-tile { padding: 16px 18px; border-radius: var(--radius-lg); background: var(--surface-sub); }
</style>

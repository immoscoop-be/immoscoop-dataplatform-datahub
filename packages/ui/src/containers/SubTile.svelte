<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A tile inside a reading surface, tinted rather than bordered (Sub-tile), with its label on top and,
   * next to it, what the screen puts there, such as where its value comes from. It may span the
   * grid it is in. The tiles of My page are rounder.
   */
  let {
    label,
    round = false,
    span,
    aside,
    children,
  }: { label?: string; round?: boolean; span?: 'all' | 2; aside?: Snippet; children: Snippet } = $props();
</script>

<section class="sub-tile" class:round style:grid-column={span === 'all' ? '1 / -1' : span ? `span ${span}` : undefined}>
  {#if aside}
    <div class="head">{#if label}<div class="label">{label}</div>{/if}{@render aside()}</div>
  {:else if label}
    <div class="label">{label}</div>
  {/if}
  {@render children()}
</section>

<style>
  .sub-tile { padding: 16px 18px; border-radius: var(--radius-md); background: var(--surface-sub); min-width: 0; }
  .round { border-radius: var(--radius-lg); }
  .head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .head .label { flex: 1; margin: 0; }
</style>

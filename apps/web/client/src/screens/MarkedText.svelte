<script lang="ts">
  import type { Marked } from '../lib/query.js';

  /** A text with the words a question shares marked (DEC-UX-23); the plain text where none are given. */
  let { pieces, plain }: { pieces: readonly Marked[] | null | undefined; plain: string } = $props();
</script>

{#if pieces}{#each pieces as piece, index (index)}{#if piece.shared}<mark>{piece.text}</mark>{:else}{piece.text}{/if}{/each}{:else}{plain}{/if}

<style>
  mark { background: color-mix(in srgb, var(--col-teal) 22%, transparent); color: inherit; border-radius: var(--radius-mark); padding: 0 2px; }
</style>

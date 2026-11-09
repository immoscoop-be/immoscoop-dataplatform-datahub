<script lang="ts">
  import { markedPieces } from '@datahub/contracts/messages';

  /**
   * A text of a Learning Card with its marks, strong and names as code, the marks of the Message Catalogue
   * (DEC-LR-24). Built from its parts, never as HTML, so that nothing a card holds lays the page out.
   */
  let { text }: { text: string } = $props();
  const pieces = $derived(markedPieces(text));
</script>

{#snippet named(text: string, code: boolean)}{#if code}<code>{text}</code>{:else}{text}{/if}{/snippet}
{#each pieces as piece, index (index)}{#if piece.strong}<b>{@render named(piece.text, piece.code)}</b>{:else}{@render named(piece.text, piece.code)}{/if}{/each}

<style>
  b { font-weight: var(--weight-medium); }
  code { font-family: var(--font-mono); font-size: 0.92em; }
</style>

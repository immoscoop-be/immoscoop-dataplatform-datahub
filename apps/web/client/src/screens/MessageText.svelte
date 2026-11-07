<script lang="ts">
  import { type MarkedPiece, textBlocks } from '@datahub/contracts/messages';

  /**
   * The laid-out text of a Message from the Message Catalogue, as it shows when the Message is opened
   * (FR-CV-11, FR-CV-15): paragraphs, items, quotes, strong, struck and names as code. Built from its parts,
   * never as HTML, so that nothing a value holds lays the page out.
   */
  let { text }: { text: string } = $props();
  const parts = $derived(textBlocks(text));
</script>

{#snippet marked(piece: MarkedPiece)}{#if piece.code}<code>{piece.text}</code>{:else}{piece.text}{/if}{/snippet}
{#snippet struck(piece: MarkedPiece)}{#if piece.struck}<del>{@render marked(piece)}</del>{:else}{@render marked(piece)}{/if}{/snippet}
{#snippet line(pieces: MarkedPiece[])}{#each pieces as piece, index (index)}{#if piece.strong}<b>{@render struck(piece)}</b>{:else}{@render struck(piece)}{/if}{/each}{/snippet}

<div class="text">
  {#each parts as block, index (index)}
    {#if block.kind === 'items'}
      <ul>{#each block.items as item, at (at)}<li>{@render line(item)}</li>{/each}</ul>
    {:else if block.kind === 'quote'}
      <blockquote>{#each block.lines as quoted, at (at)}{#if at > 0}<br />{/if}{@render line(quoted)}{/each}</blockquote>
    {:else}
      <p>{#each block.lines as plain, at (at)}{#if at > 0}<br />{/if}{@render line(plain)}{/each}</p>
    {/if}
  {/each}
</div>

<style>
  .text { font-size: var(--text-small); line-height: 1.55; }
  p, ul, blockquote { margin: 8px 0 0; }
  p:first-child { margin-top: 0; }
  ul { padding-left: 18px; }
  li + li { margin-top: 3px; }
  blockquote { padding-left: 12px; border-left: 2px solid var(--tint-active); color: var(--text-primary); }
  b { font-weight: var(--weight-medium); }
  del { color: var(--text-muted); text-decoration: line-through; }
  code { font-family: var(--font-mono); font-size: 0.95em; }
</style>

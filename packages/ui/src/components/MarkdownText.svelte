<script lang="ts">
  import { type Inline, parseMarkdown } from '../foundations/markdown.js';

  /**
   * A text in Markdown, as its writer meant it (Markdown text, DEC-UX-158): headings, paragraphs, lists,
   * bold, italic, code and links. The page is built from its pieces, never from HTML: HTML in it shows as
   * the text it is (TR-CO-08). A link to another site opens in a new tab.
   */
  let { source }: { source: string } = $props();

  const blocks = $derived(parseMarkdown(source));
  const outside = (href: string) => /^(https?:)?\/\//i.test(href);
</script>

{#snippet pieces(content: readonly Inline[])}{#each content as piece, index (index)}{#if piece.kind === 'text'}{piece.text}{:else if piece.kind === 'code'}<code>{piece.text}</code>{:else if piece.kind === 'strong'}<strong>{@render pieces(piece.children)}</strong>{:else if piece.kind === 'em'}<em>{@render pieces(piece.children)}</em>{:else if outside(piece.href)}<a href={piece.href} target="_blank" rel="noopener noreferrer">{@render pieces(piece.children)}</a>{:else}<a href={piece.href}>{@render pieces(piece.children)}</a>{/if}{/each}{/snippet}

<div class="md">
  {#each blocks as block, index (index)}
    {#if block.kind === 'heading'}
      <h3>{@render pieces(block.content)}</h3>
    {:else if block.kind === 'paragraph'}
      <p>{@render pieces(block.content)}</p>
    {:else if block.kind === 'code'}
      <pre><code>{block.text}</code></pre>
    {:else if block.ordered}
      <ol>{#each block.items as item, at (at)}<li>{@render pieces(item)}</li>{/each}</ol>
    {:else}
      <ul>{#each block.items as item, at (at)}<li>{@render pieces(item)}</li>{/each}</ul>
    {/if}
  {/each}
</div>

<style>
  .md { font-size: var(--text-small); line-height: 1.6; color: var(--text-secondary); max-width: 76ch; overflow-wrap: anywhere; }
  h3 { font-size: var(--text-body); font-weight: var(--weight-medium); color: var(--text-primary); margin: 12px 0 4px; }
  h3:first-child { margin-top: 0; }
  p { margin: 0 0 8px; }
  ul, ol { margin: 0 0 8px; padding-left: 20px; }
  .md > :last-child { margin-bottom: 0; }
  a { color: var(--text-primary); text-underline-offset: 3px; }
  strong { color: var(--text-primary); font-weight: var(--weight-medium); }
  code { font-family: var(--font-mono); font-size: .92em; background: var(--surface-sub); padding: 1px 5px; border-radius: var(--radius-pill); }
  pre { margin: 0 0 8px; padding: 8px 12px; background: var(--surface-sub); border-radius: var(--radius-sm); overflow-x: auto; }
  pre code { background: none; padding: 0; border-radius: 0; }
</style>

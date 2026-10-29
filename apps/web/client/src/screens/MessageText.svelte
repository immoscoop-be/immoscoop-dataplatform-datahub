<script lang="ts" module>
  /** A piece of a line, with its marks: strong, struck, a name as code; a backslash keeps the next mark as text. */
  export type Inline = { text: string; strong: boolean; struck: boolean; code: boolean };
  export type Block = { kind: 'paragraph' | 'quote'; lines: Inline[][] } | { kind: 'items'; items: Inline[][] };

  const MARKS = [
    ['**', 'strong'],
    ['~~', 'struck'],
    ['`', 'code'],
  ] as const;

  /** The marks of a line, in the small part of Markdown the Message Catalogue uses (FR-CV-11). */
  export function inline(line: string): Inline[] {
    const pieces: Inline[] = [];
    const on = { strong: false, struck: false, code: false };
    let text = '';
    const flush = () => {
      if (text) pieces.push({ text, ...on });
      text = '';
    };
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '\\' && i + 1 < line.length) {
        text += line[i + 1];
        i++;
        continue;
      }
      // Within a name as code, only its closing mark counts; a mark opens only when it closes later on the line.
      const found = MARKS.find(([mark, name]) => line.startsWith(mark, i) && (on.code ? name === 'code' : on[name] || line.indexOf(mark, i + mark.length) > i));
      if (found) {
        flush();
        on[found[1]] = !on[found[1]];
        i += found[0].length - 1;
      } else {
        text += line[i];
      }
    }
    flush();
    return pieces;
  }

  /** The blocks of a laid-out text: paragraphs, items and the words of a person as a quote, in the order they come. */
  export function blocks(rich: string): Block[] {
    const out: Block[] = [];
    for (const part of rich.split(/\n{2,}/)) {
      let last: Block | undefined;
      for (const line of part.split('\n')) {
        const kind = line.startsWith('- ') ? 'items' : line.startsWith('> ') ? 'quote' : 'paragraph';
        const pieces = inline(kind === 'paragraph' ? line : line.slice(2));
        if (last && last.kind === kind) {
          if (last.kind === 'items') last.items.push(pieces);
          else last.lines.push(pieces);
        } else {
          last = kind === 'items' ? { kind, items: [pieces] } : { kind, lines: [pieces] };
          out.push(last);
        }
      }
    }
    return out;
  }
</script>

<script lang="ts">
  /**
   * The laid-out text of a Message from the Message Catalogue, as it shows when the Message is opened
   * (FR-CV-11, FR-CV-15): paragraphs, items, quotes, strong, struck and names as code. Built from its parts,
   * never as HTML, so that nothing a value holds lays the page out.
   */
  let { text }: { text: string } = $props();
  const parts = $derived(blocks(text));
</script>

{#snippet marked(piece: Inline)}{#if piece.code}<code>{piece.text}</code>{:else}{piece.text}{/if}{/snippet}
{#snippet struck(piece: Inline)}{#if piece.struck}<del>{@render marked(piece)}</del>{:else}{@render marked(piece)}{/if}{/snippet}
{#snippet line(pieces: Inline[])}{#each pieces as piece, index (index)}{#if piece.strong}<b>{@render struck(piece)}</b>{:else}{@render struck(piece)}{/if}{/each}{/snippet}

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

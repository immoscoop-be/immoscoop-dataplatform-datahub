<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A simple table in a card: a head and rows, nothing more (Table). The page gives the head and the
   * rows; a row with the class `quiet` is in a lighter grey, such as a Resource that is not published.
   */
  let { label, head, children, after }: { label: string; head: Snippet; children: Snippet; after?: Snippet } = $props();
</script>

<div class="table card">
  <table aria-label={label}>
    <thead>{@render head()}</thead>
    <tbody>{@render children()}</tbody>
  </table>
  {@render after?.()}
</div>

<style>
  .table { border-radius: var(--radius-lg); padding: 6px 12px 8px; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: var(--text-small); }
  .table :global(th) { font-size: var(--text-meta); color: var(--text-muted); font-weight: var(--weight-regular); text-align: left; padding: 8px 10px; white-space: nowrap; }
  .table :global(td) { padding: 10px; border-top: 1px solid var(--tint-hover); vertical-align: middle; }
  .table :global(tr.quiet td:first-child a) { color: var(--text-muted); }
</style>

<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A simple table in a card: a head and rows, nothing more (Table). The page gives the head and the
   * rows; a row with the class `quiet` is in a lighter grey, such as a Resource that is not published. A row
   * with the class `row` opens with a click anywhere on it; `dragging` is the row being dragged, and `drop`
   * the folder it would go into (DEC-UX-157).
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
  .table :global(tr.quiet td:first-child .name) { color: var(--text-muted); }
  .table :global(tr.row) { cursor: pointer; }
  .table :global(tr.row:hover td), .table :global(tr.drop td) { background: var(--tint-hover); }
  .table :global(tr.row:focus-visible) { outline: 2px solid var(--text-secondary); outline-offset: -2px; }
  .table :global(tr.dragging td) { opacity: .4; }
  .table :global(tr.drop td) { box-shadow: inset 0 1.5px 0 var(--text-muted), inset 0 -1.5px 0 var(--text-muted); }
  .table :global(tr.drop td:first-child) { box-shadow: inset 1.5px 1.5px 0 var(--text-muted), inset 0 -1.5px 0 var(--text-muted); }
  .table :global(tr.drop td:last-child) { box-shadow: inset -1.5px 1.5px 0 var(--text-muted), inset 0 -1.5px 0 var(--text-muted); }
</style>

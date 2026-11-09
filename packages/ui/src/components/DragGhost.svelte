<script lang="ts">
  import Icon from '../foundations/Icon.svelte';
  import KindIcon from '../marks/KindIcon.svelte';

  /**
   * What is dragged, as it follows the pointer (DEC-UX-157): a small card with its icon and name. It stands
   * out of sight; the drag takes its picture when it starts, from the element with the ID `drag-ghost`.
   */
  let { item }: { item: { kind: 'resource' | 'lens' | 'folder'; name: string } | null } = $props();
</script>

<div id="drag-ghost" class="ghost card" aria-hidden="true">
  {#if item}
    <span class="icon">{#if item.kind === 'folder'}<Icon name="folder-fill" />{:else}<KindIcon kind={item.kind} />{/if}</span><span>{item.name}</span>
  {/if}
</div>

<style>
  .ghost { position: fixed; top: -200px; left: -400px; z-index: 40; display: flex; align-items: center; gap: 8px; padding: 8px 12px; max-width: 320px; border-radius: var(--radius-sm);
    box-shadow: 0 0 0 1px var(--tint-active); font-size: var(--text-small); font-weight: var(--weight-medium); white-space: nowrap; pointer-events: none; }
  .icon { display: inline-flex; font-size: 15px; color: var(--text-secondary); }
</style>

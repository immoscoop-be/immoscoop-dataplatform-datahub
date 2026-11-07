<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../foundations/Icon.svelte';

  /**
   * A box whose head folds its body away (Fold box, DEC-UX-76): the arrow folds and unfolds it, the
   * rest of the head is the head's own, such as a link to what it is.
   */
  let {
    open = $bindable(true),
    toggleLabel,
    head,
    children,
  }: { open?: boolean; toggleLabel: string; head: Snippet; children: Snippet } = $props();
</script>

<div class="fold" class:open>
  <div class="head">
    {@render head()}
    <button type="button" class="toggle" aria-expanded={open} aria-label={toggleLabel} onclick={() => (open = !open)}>
      <span class="caret"><Icon name="caret-down" /></span>
    </button>
  </div>
  {#if open}<div class="body">{@render children()}</div>{/if}
</div>

<style>
  .head { display: flex; align-items: center; padding: 0 6px 0 0; }
  .toggle { width: 28px; height: 28px; flex: none; display: flex; align-items: center; justify-content: center; border: 0; background: none; border-radius: var(--radius-sm); cursor: pointer; }
  .toggle:hover { background: var(--tint-hover); }
  .caret { display: inline-flex; color: var(--text-muted); font-size: 14px; transition: transform var(--motion-fold); }
  .fold:not(.open) .caret { transform: rotate(-90deg); }
</style>

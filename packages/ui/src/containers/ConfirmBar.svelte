<script lang="ts">
  import type { Snippet } from 'svelte';
  import Button from '../primitives/Button.svelte';

  /**
   * A declaration and the button it unlocks, in one bar (Confirm bar, DEC-UX-63): the checkbox and its
   * sentence on the left, the button at the right end. The button is off until the box is ticked, and
   * ticking it marks the bar, so that it is clear the two are one. Off as a whole, nothing can be ticked.
   */
  let {
    declaration,
    disabled = false,
    busy = false,
    onconfirm,
    children,
  }: {
    declaration: string;
    /** When what it confirms is not possible yet. */
    disabled?: boolean;
    /** While it acts. */
    busy?: boolean;
    onconfirm: () => void;
    children: Snippet;
  } = $props();

  let ticked = $state(false);
</script>

<div class="bar" class:ticked={ticked && !disabled}>
  <label>
    <input type="checkbox" bind:checked={ticked} {disabled} />
    <span>{declaration}</span>
  </label>
  <Button disabled={disabled || !ticked || busy} onclick={onconfirm}>{@render children()}</Button>
</div>

<style>
  .bar { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 14px; border-radius: var(--radius-md); background: var(--surface-sub); border: 1px solid var(--tint-active); }
  .bar.ticked { border-color: var(--text-primary); }
  label { flex: 1; min-width: 0; display: flex; gap: 10px; align-items: flex-start; font-size: var(--text-small); line-height: 1.45; cursor: pointer; }
  input { flex: none; margin: 3px 0 0; accent-color: var(--text-primary); }
  input:disabled + span { color: var(--text-muted); }
  .bar :global(.button) { flex: none; }
</style>

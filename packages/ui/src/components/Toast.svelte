<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../foundations/Icon.svelte';

  /**
   * A short line on screen that says what just happened, such as where something moved (Toast, DEC-UX-157):
   * at the bottom in the middle, for a few seconds, read out by a screen reader. A new `key` shows it again.
   */
  let {
    key,
    children,
    tone = 'done',
    duration = 3600,
  }: { key: number; children: Snippet; tone?: 'done' | 'failed'; duration?: number } = $props();

  let shown = $state(false);
  $effect(() => {
    if (key === 0) return;
    shown = true;
    const timer = setTimeout(() => (shown = false), duration);
    return () => clearTimeout(timer);
  });
</script>

<div class="toast card" role="status" hidden={!shown}>
  {#if shown}<span class="sign" class:failed={tone === 'failed'}><Icon name={tone === 'failed' ? 'warning-circle-fill' : 'check-circle-fill'} /></span><span>{@render children()}</span>{/if}
</div>

<style>
  .toast { position: fixed; z-index: 40; left: 50%; bottom: 24px; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; padding: 10px 16px;
    border-radius: var(--radius-pill); box-shadow: 0 0 0 1px var(--tint-active); font-size: var(--text-small); animation: in var(--motion-fade) ease-out; }
  .toast[hidden] { display: none; }
  .sign { display: inline-flex; font-size: 16px; color: var(--text-secondary); }
  .sign.failed { color: var(--signal-warn); }
  .toast :global(b) { font-weight: var(--weight-medium); }
  @keyframes in { from { opacity: 0; transform: translate(-50%, 6px); } }
</style>

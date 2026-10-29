<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../foundations/Icon.svelte';
  import { t } from '../foundations/texts.svelte.js';

  /**
   * A task over its page, from the right (Sheet): the page stays visible behind it, dimmed. "Close",
   * a click beside it or Escape closes it (Lay over). Its head names the task; its foot holds what
   * the task comes to.
   */
  let {
    title,
    wide = false,
    roomy = false,
    onclose,
    top,
    head,
    children,
    foot,
  }: {
    title: string;
    /** Wider, for a task with a table, such as the grain and relations of Resources (DEC-UX-58). */
    wide?: boolean;
    /** Somewhat wider, for a declaration and its button side by side, such as publishing (DEC-UX-63). */
    roomy?: boolean;
    onclose: () => void;
    /** What stands above its title, such as its steps. */
    top?: Snippet;
    head?: Snippet;
    children: Snippet;
    foot: Snippet;
  } = $props();

  let sheet: HTMLElement | undefined = $state();
  $effect(() => {
    // The focus goes into the sheet, and back to where it came from when it closes.
    const before = document.activeElement as HTMLElement | null;
    sheet?.focus();
    return () => before?.focus?.();
  });
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onclose()} />

<div class="backdrop" aria-hidden="true" onclick={onclose}></div>
<div class="sheet" class:wide class:roomy role="dialog" aria-modal="true" aria-label={title} tabindex="-1" bind:this={sheet}>
  {@render top?.()}
  <div class="head">
    <div class="titles">
      <h2>{title}</h2>
      {@render head?.()}
    </div>
    <button type="button" class="close" aria-label={t('sheet.close')} onclick={onclose}><Icon name="x" /></button>
  </div>
  <div class="body">{@render children()}</div>
  <div class="foot">{@render foot()}</div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 30; background: var(--sheet-backdrop); }
  .sheet { position: fixed; z-index: 31; top: 20px; right: 20px; bottom: 20px; width: 460px; max-width: calc(100vw - 40px); display: flex; flex-direction: column;
    border-radius: var(--radius-xl); background: var(--surface-solid); box-shadow: var(--sheet-shadow); padding: 22px 22px 18px; outline: none; }
  .wide { width: 840px; }
  .roomy { width: 560px; }
  .head { display: flex; align-items: flex-start; gap: 8px; }
  .titles { flex: 1; min-width: 0; }
  h2 { font-size: 19px; font-weight: var(--weight-medium); margin: 0; }
  .close { width: 32px; height: 32px; border-radius: var(--radius-sm); border: 0; background: none; display: flex; align-items: center; justify-content: center;
    color: var(--text-secondary); cursor: pointer; font-size: 16px; }
  .close:hover { background: var(--tint-hover); }
  .body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .foot { display: flex; align-items: center; gap: 10px; padding-top: 14px; border-top: 1px solid var(--tint-hover); }
</style>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../foundations/Icon.svelte';
  import type { IconName } from '../foundations/icons.js';
  import { t } from '../foundations/texts.svelte.js';

  /**
   * A window over a page that stays usable behind it, undimmed (Floating window, DEC-UX-30): it opens in the
   * lower right, moves by its head, and "Fold" shrinks it to its head. Close, or Escape within it, closes it
   * (Lay over), and the focus goes back to where it was opened from.
   */
  let {
    title,
    meta,
    icon,
    wide = false,
    onclose,
    children,
    foot,
  }: {
    title: string;
    /** What stands above its title, such as what it belongs to. */
    meta?: string;
    icon?: IconName;
    /** Somewhat wider, for a form, such as a Parameter. */
    wide?: boolean;
    onclose: () => void;
    children: Snippet;
    foot?: Snippet;
  } = $props();

  let folded = $state(false);
  let win: HTMLElement | undefined = $state();
  /** Where it was moved to; until then, the lower right. */
  let place = $state<{ left: number; top: number } | null>(null);

  $effect(() => {
    const before = document.activeElement as HTMLElement | null;
    return () => before?.focus?.();
  });

  /**
   * It hangs on the page itself, as a pop-out does: in a frame with a backdrop filter, as the main area has
   * over a picture, a fixed window would be placed from that frame, and moving it would jump aside.
   */
  function portal(node: HTMLElement): () => void {
    document.body.appendChild(node);
    return () => node.remove();
  }

  /** Moves it by its head, kept within the window of the browser. */
  function grab(event: PointerEvent): void {
    if (!win || (event.target as HTMLElement).closest('button, a, input')) return;
    const box = win.getBoundingClientRect();
    const dx = event.clientX - box.left;
    const dy = event.clientY - box.top;
    const head = event.currentTarget as HTMLElement;
    head.setPointerCapture?.(event.pointerId);
    const move = (moved: PointerEvent) => {
      place = { left: Math.max(0, Math.min(innerWidth - box.width, moved.clientX - dx)), top: Math.max(0, Math.min(innerHeight - 48, moved.clientY - dy)) };
    };
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', () => head.removeEventListener('pointermove', move), { once: true });
  }
</script>

<div
  class="float"
  class:folded
  class:wide
  role="dialog"
  aria-modal="false"
  aria-label={title}
  tabindex="-1"
  bind:this={win}
  {@attach portal}
  style:left={place ? `${place.left}px` : null}
  style:top={place ? `${place.top}px` : null}
  style:right={place ? 'auto' : null}
  style:bottom={place ? 'auto' : null}
  onkeydown={(event) => event.key === 'Escape' && onclose()}
>
  <div class="head" role="presentation" title={t('float.move')} onpointerdown={grab}>
    <span class="grip" aria-hidden="true"><Icon name="dots-six-vertical" /></span>
    {#if icon}<span class="icon" aria-hidden="true"><Icon name={icon} /></span>{/if}
    <div class="titles">
      {#if meta}<div class="meta">{meta}</div>{/if}
      <div class="title">{title}</div>
    </div>
    <button type="button" class="button" aria-expanded={!folded} aria-label={t(folded ? 'float.unfold' : 'float.fold')} onclick={() => (folded = !folded)}>
      <Icon name={folded ? 'arrows-out-simple' : 'minus'} />
    </button>
    <button type="button" class="button" aria-label={t('sheet.close')} onclick={onclose}><Icon name="x" /></button>
  </div>
  {#if !folded}
    <div class="body">{@render children()}</div>
    {#if foot}<div class="foot">{@render foot()}</div>{/if}
  {/if}
</div>

<style>
  .float { --card: var(--surface-solid); position: fixed; z-index: 25; right: 24px; bottom: 24px; width: 400px; max-width: calc(100vw - 48px); max-height: calc(100vh - 48px); display: flex; flex-direction: column;
    box-sizing: border-box; border-radius: var(--radius-xl); background: var(--surface-solid); outline: 1px solid var(--tint-active); box-shadow: var(--sheet-shadow); padding: 10px 14px 12px; }
  .float:focus { outline: 1px solid var(--tint-active); }
  .wide { width: 470px; }
  .head { display: flex; align-items: center; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--tint-active); cursor: grab; user-select: none; touch-action: none; }
  .folded .head { border-bottom: 0; padding-bottom: 0; }
  .grip { display: inline-flex; font-size: 16px; color: var(--text-muted); }
  .icon { display: inline-flex; font-size: 17px; color: var(--text-secondary); }
  .titles { flex: 1; min-width: 0; }
  .meta { font-size: var(--text-meta); color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .title { font-weight: var(--weight-medium); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .button { width: 30px; height: 30px; flex: none; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: var(--radius-sm); background: none;
    color: var(--text-secondary); cursor: pointer; font-size: 15px; }
  .button:hover { background: var(--tint-hover); }
  .button:focus-visible { outline: 2px solid var(--text-secondary); }
  .body { overflow: auto; min-height: 0; }
  .foot { display: flex; align-items: center; gap: 10px; padding-top: 10px; margin-top: 10px; border-top: 1px solid var(--tint-hover); }
</style>

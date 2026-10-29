<script lang="ts">
  import { setContext, type Snippet } from 'svelte';
  import { EXPLAINED } from './explained.js';

  /**
   * A system text, chip or button that the Learning Centre explains, with its pop-out (Explain on rest, Pop-out,
   * DEC-UX-56, DEC-UX-57): the pop-out opens only when the pointer rests on it for a second, so passing over the
   * page opens nothing; keyboard focus opens it at once; a tap on its marker opens it. It is a text bubble under
   * what it explains, or above it near the foot of the window, its arrow on the marker. It stays while the
   * pointer is on it, and closes when the pointer leaves, on Escape or on scrolling. Hovering tints what it
   * explains, so its extent shows; it stays tinted while what it opened is open. A button inside keeps its own
   * action: only its marker opens the pop-out when tapped.
   */
  let {
    label,
    shape = 'text',
    focusable = true,
    active = false,
    children,
    pop,
  }: {
    /** What the pop-out is, for a screen reader. */
    label: string;
    /** The rounding of what it explains, for its tint. */
    shape?: 'text' | 'chip' | 'pill';
    /** Whether it takes the focus itself; not when it holds a button, which does. */
    focusable?: boolean;
    /** Stays tinted, as while the card it opened is open. */
    active?: boolean;
    /** What it explains, with the marker after its text. */
    children: Snippet;
    /** What the pop-out holds; it is given a way to close it. */
    pop: Snippet<[() => void]>;
  } = $props();

  /** How long the pointer rests before the pop-out opens, and how long it may leave before it closes. */
  const REST = 1000;
  const LEAVE = 250;

  let shown = $state(false);
  let host: HTMLElement | undefined = $state();
  let bubble: HTMLElement | undefined = $state();
  let place = $state({ left: 0, top: 0, arrow: 28, side: 'below' as 'below' | 'above' });
  let resting: ReturnType<typeof setTimeout> | undefined;
  let leaving: ReturnType<typeof setTimeout> | undefined;

  function open(): void {
    clearTimeout(resting);
    clearTimeout(leaving);
    shown = true;
  }
  function close(): void {
    clearTimeout(resting);
    clearTimeout(leaving);
    shown = false;
  }
  setContext(EXPLAINED, { tap: () => (shown ? close() : open()) });

  /** Under what it explains, or above it when there is no room below; the arrow on the marker. */
  function position(): void {
    if (!host || !bubble) return;
    const box = host.getBoundingClientRect();
    const mark = (host.querySelector('.mark') ?? host).getBoundingClientRect();
    const [width, height] = [bubble.offsetWidth, bubble.offsetHeight];
    const centre = mark.left + mark.width / 2;
    const left = Math.max(12, Math.min(innerWidth - width - 12, centre - 28));
    const below = box.bottom + 10 + height <= innerHeight - 12 || box.top - 10 - height < 12;
    place = { left, top: below ? box.bottom + 10 : box.top - 10 - height, arrow: centre - left, side: below ? 'below' : 'above' };
  }

  $effect(() => {
    if (!shown || !bubble) return;
    position();
    const scrolled = (event: Event) => {
      if (!bubble?.contains(event.target as Node)) close();
    };
    addEventListener('scroll', scrolled, true);
    addEventListener('resize', close);
    return () => {
      removeEventListener('scroll', scrolled, true);
      removeEventListener('resize', close);
    };
  });
  $effect(() => () => {
    clearTimeout(resting);
    clearTimeout(leaving);
  });

  /** The bubble hangs on the page itself, so that nothing around what it explains cuts it off. */
  function portal(node: HTMLElement): () => void {
    document.body.appendChild(node);
    return () => node.remove();
  }

  const keyboard = (target: EventTarget | null) => {
    try {
      return target instanceof Element && target.matches(':focus-visible');
    } catch {
      return false;
    }
  };
  const within = (node: EventTarget | null) => node instanceof Node && (host?.contains(node) || bubble?.contains(node));

  function rest(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return;
    clearTimeout(leaving);
    if (!shown) resting = setTimeout(open, REST);
  }
  function leave(): void {
    clearTimeout(resting);
    if (shown) leaving = setTimeout(close, LEAVE);
  }
  function key(event: KeyboardEvent): void {
    if (event.key === 'Escape' && shown) {
      event.stopPropagation();
      close();
    } else if (focusable && event.target === host && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      if (shown) close();
      else open();
    } else if (event.key === 'Tab' && !event.shiftKey && shown && bubble) {
      // Tab goes on into the pop-out, which hangs at the end of the page.
      const first = bubble.querySelector<HTMLElement>('a[href], button:not([disabled])');
      if (first) {
        event.preventDefault();
        first.focus();
      }
    }
  }
  function back(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    close();
    (focusable ? host : host?.querySelector<HTMLElement>('button, a[href]'))?.focus();
  }
</script>

{#if focusable}
  <span
    class="explained {shape}"
    class:open={shown || active}
    bind:this={host}
    role="button"
    tabindex="0"
    aria-haspopup="dialog"
    aria-expanded={shown}
    onpointerenter={rest}
    onpointerleave={leave}
    onfocusin={(event) => keyboard(event.target) && open()}
    onfocusout={(event) => !within(event.relatedTarget) && close()}
    onkeydown={key}>{@render children()}</span
  >
{:else}
  <!-- What it holds, a button, takes the focus and the keys; this only listens to them. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <span
    class="explained {shape}"
    class:open={shown || active}
    bind:this={host}
    onpointerenter={rest}
    onpointerleave={leave}
    onfocusin={(event) => keyboard(event.target) && open()}
    onfocusout={(event) => !within(event.relatedTarget) && close()}
    onkeydown={key}>{@render children()}</span
  >
{/if}

{#if shown}
  <div
    class="bubble {place.side}"
    role="dialog"
    aria-label={label}
    tabindex="-1"
    bind:this={bubble}
    {@attach portal}
    style:left="{place.left}px"
    style:top="{place.top}px"
    style:--arrow-x="{place.arrow}px"
    onpointerenter={() => clearTimeout(leaving)}
    onpointerleave={leave}
    onfocusout={(event) => !within(event.relatedTarget) && close()}
    onkeydown={back}
  >
    {@render pop(close)}
  </div>
{/if}

<style>
  .explained { position: relative; display: inline-flex; align-items: center; cursor: help; border-radius: var(--radius-mark); }
  .explained.chip { border-radius: var(--radius-chip); }
  .explained.pill { border-radius: var(--radius-pill); }
  .explained::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; transition: background-color var(--motion-ring); }
  .explained:hover::after, .explained.open::after, .explained:focus-visible::after { background: var(--tint-active); }
  .explained:focus-visible { outline: 2px solid var(--text-secondary); }
  .bubble { position: fixed; z-index: 30; width: 400px; max-width: calc(100vw - 24px); box-sizing: border-box; padding: 8px; border-radius: var(--radius-lg); background: var(--surface-solid);
    border: 1px solid var(--tint-active); box-shadow: var(--sheet-shadow); font-size: var(--text-small); }
  .bubble:focus { outline: none; }
  .bubble::before { content: ''; position: absolute; left: var(--arrow-x, 28px); width: 12px; height: 12px; background: var(--surface-solid); transform: translateX(-50%) rotate(45deg); }
  .below::before { top: -7px; border-left: 1px solid var(--tint-active); border-top: 1px solid var(--tint-active); }
  .above::before { bottom: -7px; border-right: 1px solid var(--tint-active); border-bottom: 1px solid var(--tint-active); }
  @media (prefers-reduced-motion: no-preference) {
    .bubble { animation: appear var(--motion-fade) ease-out; }
    @keyframes appear { from { opacity: 0; } }
  }
</style>

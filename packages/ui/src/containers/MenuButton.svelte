<script lang="ts" module>
  import type { IconName } from '../foundations/icons.js';

  /** A choice of the menu: its icon, its words, a hint after them, and what it does. */
  export interface MenuChoice {
    key: string;
    icon: IconName;
    label: string;
    hint?: string;
    run: () => void;
  }
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import Icon from '../foundations/Icon.svelte';

  /**
   * Menu button (DEC-UX-294): an icon button with a small caret that opens a menu under it, aligned to its edge on the
   * side of the page. Its name shows on hover and is read out; it looks pressed while its menu is open. A click, Enter,
   * Space or the down arrow opens the menu on its first choice, the up arrow on its last; the arrows move through the
   * choices, Home and End jump, Enter or a click does one and closes the menu. Escape, Tab or a click beside it closes
   * the menu, and the focus goes back to the button, except after Tab or a click elsewhere. A line on top may say what
   * the choices act on.
   */
  let {
    icon,
    label,
    caption,
    choices,
    align = 'end',
  }: {
    icon: IconName;
    /** Its name, on hover and for a screen reader. */
    label: string;
    /** What the choices act on, on top of the menu. */
    caption?: string;
    choices: readonly MenuChoice[];
    /** The edge the menu is aligned to: the end of the button, at the right of the page, or its start. */
    align?: 'start' | 'end';
  } = $props();

  let open = $state(false);
  let root: HTMLSpanElement | undefined = $state();
  let button: HTMLButtonElement | undefined = $state();
  let menu: HTMLDivElement | undefined = $state();
  const id = `menu-${Math.random().toString(36).slice(2, 9)}`;

  const items = (): HTMLButtonElement[] => [...(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];

  async function show(at: 'first' | 'last' = 'first'): Promise<void> {
    open = true;
    await tick();
    const list = items();
    (at === 'first' ? list[0] : list.at(-1))?.focus();
  }

  function close(back = true): void {
    open = false;
    if (back) button?.focus();
  }

  function choose(choice: MenuChoice): void {
    close();
    choice.run();
  }

  function onbuttonkey(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      void show('first');
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      void show('last');
    }
  }

  function onmenukey(event: KeyboardEvent): void {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const go = (to: number) => {
      event.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (event.key === 'ArrowDown') go(at + 1);
    else if (event.key === 'ArrowUp') go(at - 1);
    else if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(list.length - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') close(false);
  }

  /** A click beside the button and its menu closes the menu. */
  function onwindowclick(event: MouseEvent): void {
    if (open && root && !root.contains(event.target as Node)) close(false);
  }
</script>

<svelte:window onclick={onwindowclick} />

<span class="menu-button" bind:this={root}>
  <button
    bind:this={button}
    type="button"
    class="opener"
    aria-label={label}
    title={label}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls={id}
    onclick={() => (open ? close() : void show())}
    onkeydown={onbuttonkey}
  >
    <Icon name={icon} /><span class="caret"><Icon name="caret-down" /></span>
  </button>
  {#if open}
    <div bind:this={menu} {id} class="menu" class:start={align === 'start'} role="menu" aria-label={label} tabindex="-1" onkeydown={onmenukey}>
      {#if caption}<p class="caption">{caption}</p>{/if}
      {#each choices as choice (choice.key)}
        <button type="button" role="menuitem" tabindex="-1" onclick={() => choose(choice)}>
          <Icon name={choice.icon} /><span class="choice">{choice.label}</span>{#if choice.hint}<span class="hint">{choice.hint}</span>{/if}
        </button>
      {/each}
    </div>
  {/if}
</span>

<style>
  .menu-button { position: relative; display: inline-flex; flex: none; }
  .opener { height: 32px; padding: 0 6px 0 8px; display: inline-flex; align-items: center; gap: 2px; border: 0; border-radius: var(--radius-sm); background: none;
    color: var(--text-secondary); cursor: pointer; font-size: 16px; }
  .opener:hover { background: var(--tint-hover); color: var(--text-primary); }
  .opener[aria-expanded='true'] { background: var(--tint-active); color: var(--text-primary); }
  .caret { display: inline-flex; font-size: 10px; color: var(--text-muted); }
  .menu { position: absolute; z-index: 30; top: calc(100% + 6px); right: 0; width: max-content; min-width: 260px; padding: 6px; border-radius: var(--radius-md);
    background: var(--surface-solid); outline: 1px solid var(--tint-active); box-shadow: var(--sheet-shadow); }
  .menu.start { right: auto; left: 0; }
  .caption { margin: 0; padding: 8px 8px 4px; white-space: nowrap; font-size: var(--text-meta); color: var(--text-muted); }
  .menu button { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 8px; border-radius: var(--radius-sm);
    font-size: var(--text-small); color: var(--text-primary); cursor: pointer; }
  .menu button:hover, .menu button:focus-visible { background: var(--tint-hover); }
  .menu button:focus-visible { outline: 2px solid var(--text-secondary); outline-offset: -2px; }
  .menu button :global(.icon) { color: var(--text-secondary); }
  .hint { margin-left: auto; padding-left: 14px; font-size: var(--text-meta); color: var(--text-muted); }
</style>

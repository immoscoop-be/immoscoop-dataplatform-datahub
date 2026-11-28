<script lang="ts" module>
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import type { MessageMark } from '../lib/messages.js';

  /** The icon of each mark, outlined while it is off and filled once set, in the colour of the text (DEC-UX-363). */
  export const MARK_ICONS: Readonly<Record<MessageMark, { off: IconName; on: IconName }>> = {
    followUp: { off: 'flag', on: 'flag-fill' },
    important: { off: 'warning-circle', on: 'warning-circle-fill' },
    starred: { off: 'star', on: 'star-fill' },
  };
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import { MARK_TEXTS, MESSAGE_MARKS } from '../lib/messages.js';

  /**
   * The marks of the User on a Message (FR-CV-19, DEC-UX-361): one button that shows every mark set, filled, in their
   * order, never a number in their place (DEC-UX-362); with none, an outlined flag. It opens a dropdown of the marks,
   * each with its icon, its name and a check when set: a click sets or takes it off at once and the dropdown stays open
   * for another; Escape, Tab or a click beside it closes it. The arrows move through the marks, as in a Menu button.
   * In the head of a Message it is an outline button, with "Mark" while none is set; on its line in the list a quiet one.
   * Marks are personal, and it does not say so (DEC-UX-365).
   */
  let {
    marks,
    onmark,
    inHead = false,
  }: {
    /** The marks set, in their order. */
    marks: readonly MessageMark[];
    onmark: (mark: MessageMark, on: boolean) => void;
    /** In the head of a Message: an outline button, with its word while no mark is set. */
    inHead?: boolean;
  } = $props();

  let open = $state(false);
  let root: HTMLSpanElement | undefined = $state();
  let button: HTMLButtonElement | undefined = $state();
  let menu: HTMLDivElement | undefined = $state();
  const id = `marks-${Math.random().toString(36).slice(2, 9)}`;
  const set = $derived(MESSAGE_MARKS.filter((mark) => marks.includes(mark)));
  const label = $derived(set.length ? `${t('messages.marks')}: ${set.map((mark) => t(MARK_TEXTS[mark].name)).join(', ')}` : t('messages.marks'));

  const items = (): HTMLButtonElement[] => [...(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitemcheckbox"]') ?? [])];

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

  /** A click beside the button and its dropdown closes it. */
  function onwindowclick(event: MouseEvent): void {
    if (open && root && !root.contains(event.target as Node)) close(false);
  }
</script>

<svelte:window onclick={onwindowclick} />

<span class="marks" class:open class:set={set.length > 0} class:head={inHead} bind:this={root}>
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
    {#if set.length > 0}
      {#each set as mark (mark)}<Icon name={MARK_ICONS[mark].on} />{/each}
    {:else}
      <Icon name="flag" />{#if inHead}<span class="word">{t('messages.marks.mark')}</span>{/if}
    {/if}
    <span class="caret"><Icon name="caret-down" /></span>
  </button>
  {#if open}
    <div bind:this={menu} {id} class="menu" role="menu" aria-label={t('messages.marks')} tabindex="-1" onkeydown={onmenukey}>
      {#each MESSAGE_MARKS as mark (mark)}
        {@const on = set.includes(mark)}
        <button type="button" role="menuitemcheckbox" aria-checked={on} tabindex="-1" onclick={() => onmark(mark, !on)}>
          <Icon name={on ? MARK_ICONS[mark].on : MARK_ICONS[mark].off} /><span class="name">{t(MARK_TEXTS[mark].name)}</span><span class="check"><Icon name="check" /></span>
        </button>
      {/each}
    </div>
  {/if}
</span>

<style>
  .marks { position: relative; display: inline-flex; flex: none; }
  .opener { height: 26px; padding: 0 6px; display: inline-flex; align-items: center; gap: 3px; border: 0; border-radius: var(--radius-pill); background: none;
    color: var(--text-primary); font-size: 15px; cursor: pointer; }
  .marks:not(.set) .opener { color: var(--text-muted); }
  .opener:hover, .opener[aria-expanded='true'] { background: var(--tint-active); color: var(--text-primary); }
  .opener:focus-visible { outline: 2px solid var(--text-secondary); }
  .caret { display: inline-flex; font-size: 10px; color: var(--text-muted); }
  .head .opener { height: 32px; padding: 0 10px; gap: 5px; outline: 1px solid var(--tint-active); background: var(--card); }
  .head .opener:hover, .head .opener[aria-expanded='true'] { background: var(--tint-active); }
  .head .opener:focus-visible { outline: 2px solid var(--text-secondary); }
  .word { font: var(--weight-medium) var(--text-small) var(--font-family); }
  .menu { position: absolute; z-index: 40; top: calc(100% + 6px); right: 0; width: max-content; min-width: 220px; padding: 6px; border-radius: var(--radius-md);
    background: var(--surface-solid); outline: 1px solid var(--tint-active); box-shadow: var(--sheet-shadow); }
  .menu button { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border-radius: var(--radius-sm);
    font-size: var(--text-small); color: var(--text-primary); cursor: pointer; }
  .menu button:hover, .menu button:focus-visible { background: var(--tint-hover); }
  .menu button:focus-visible { outline: 2px solid var(--text-secondary); outline-offset: -2px; }
  .menu button > :global(.icon) { font-size: 16px; }
  .name { flex: 1; }
  .check { display: inline-flex; visibility: hidden; color: var(--text-secondary); }
  [aria-checked='true'] .check { visibility: visible; }
</style>

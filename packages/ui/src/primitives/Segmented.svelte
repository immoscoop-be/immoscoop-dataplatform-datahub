<script lang="ts" generics="T extends string">
  import Icon from '../foundations/Icon.svelte';
  import type { IconName } from '../foundations/icons.js';
  import { moveFocus } from '../foundations/roving.js';

  /**
   * Two to four choices, one of them on, each with an icon if it has one; choosing one switches what
   * it controls. The arrows choose too.
   */
  let {
    options,
    value = $bindable(),
    label,
    surface = 'solid',
    onchange,
  }: {
    options: readonly { value: T; label: string; icon?: IconName }[];
    value: T;
    label: string;
    /** The surface it stands out from: a white one, or the tint of a tile. */
    surface?: 'solid' | 'sub';
    onchange?: (value: T) => void;
  } = $props();

  function choose(next: T) {
    if (next !== value) {
      value = next;
      onchange?.(next);
    }
  }

  function key(event: KeyboardEvent) {
    const index = moveFocus(event, '[role="radio"]');
    const option = index === undefined ? undefined : options[index];
    if (option) {
      choose(option.value);
    }
  }
</script>

<div class="segmented {surface}" role="radiogroup" aria-label={label} tabindex="-1" onkeydown={key}>
  {#each options as option (option.value)}
    <button
      type="button"
      class="seg"
      class:on={option.value === value}
      role="radio"
      aria-checked={option.value === value}
      tabindex={option.value === value ? 0 : -1}
      onclick={() => choose(option.value)}
    >
      {#if option.icon}<Icon name={option.icon} />{/if}{option.label}
    </button>
  {/each}
</div>

<style>
  .segmented { display: inline-flex; gap: 2px; padding: 3px; border-radius: var(--radius-pill); }
  .solid { background: var(--surface-solid); }
  .sub { background: var(--surface-sub); }
  .seg { display: inline-flex; align-items: center; gap: 5px; font: var(--text-small) var(--font-family); color: var(--text-muted); cursor: pointer; padding: 3px 8px; border-radius: var(--radius-pill); border: 0; background: none; }
  .seg:hover { color: var(--text-primary); }
  .seg.on { color: var(--text-primary); font-weight: var(--weight-medium); background: var(--card); }
</style>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { moveFocus } from '../foundations/roving.js';

  interface Tab {
    readonly id: string;
    readonly label: string;
    /** A tab that has an address of its own is a link. */
    readonly href?: string;
  }

  /**
   * Real tabs: rounded at the top, flowing into their content with concave corners; the content is
   * a reading surface (Tabs). The tab that is on shows its pane. The arrows move between the tabs;
   * Enter opens the one with the focus.
   */
  let {
    tabs,
    current,
    label,
    top = '20px',
    onselect,
    children,
  }: {
    tabs: readonly Tab[];
    current: string;
    label: string;
    /** The space above the row of tabs, as the screen has it. */
    top?: string;
    onselect?: (id: string) => void;
    children: Snippet;
  } = $props();

  const currentLabel = $derived(tabs.find((tab) => tab.id === current)?.label);
</script>

<div class="tabs" role="tablist" aria-label={label} tabindex="-1" style:margin-top={top} onkeydown={(event) => moveFocus(event, '[role="tab"]')}>
  {#each tabs as tab (tab.id)}
    {#if tab.href}
      <a
        class="tab"
        class:on={tab.id === current}
        href={tab.href}
        role="tab"
        aria-selected={tab.id === current}
        tabindex={tab.id === current ? 0 : -1}
        onclick={() => onselect?.(tab.id)}>{tab.label}</a
      >
    {:else}
      <button
        type="button"
        class="tab"
        class:on={tab.id === current}
        role="tab"
        aria-selected={tab.id === current}
        tabindex={tab.id === current ? 0 : -1}
        onclick={() => onselect?.(tab.id)}>{tab.label}</button
      >
    {/if}
  {/each}
</div>
<div class="content card" role="tabpanel" aria-label={currentLabel}>
  {@render children()}
</div>

<style>
  .tabs { display: flex; gap: 2px; padding: 0 26px; position: relative; flex-wrap: wrap; }
  .tab { font: var(--text-body) var(--font-family); color: var(--text-muted); padding: 9px 16px 10px; border-radius: var(--radius-tab) var(--radius-tab) 0 0;
    cursor: pointer; display: inline-flex; align-items: center; gap: 5px; position: relative; z-index: 1; border: 0; background: none; text-decoration: none; }
  .tab:hover { color: var(--text-primary); background: var(--surface-float-hover); }
  .tab.on { color: var(--text-primary); font-weight: var(--weight-medium); background: var(--card); z-index: 2; }
  .tab.on::before, .tab.on::after { content: ''; position: absolute; bottom: 0; width: var(--flare-tab); height: var(--flare-tab); }
  .tab.on::before { left: calc(-1 * var(--flare-tab)); background: radial-gradient(circle at 0 0, transparent var(--flare-tab), var(--card) calc(var(--flare-tab) + .5px)); }
  .tab.on::after { right: calc(-1 * var(--flare-tab)); background: radial-gradient(circle at 100% 0, transparent var(--flare-tab), var(--card) calc(var(--flare-tab) + .5px)); }
  .content { border-radius: var(--radius-surface); padding: 16px; position: relative; z-index: 1; }
</style>

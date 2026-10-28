<script lang="ts">
  import type { Snippet } from 'svelte';
  import FoldBox from '../containers/FoldBox.svelte';
  import Icon from '../foundations/Icon.svelte';
  import type { IconName } from '../foundations/icons.js';
  import { t } from '../foundations/texts.svelte.js';

  /**
   * One group of a Tree, in a card of its own: its icon, name and meta link to it, when it has a page
   * of its own, and its arrow unfolds what it holds (Tree, DEC-UX-10). "Without a Collection" is in the urgent red: it is no
   * Collection, and it waits for the Data Team (DEC-UX-16).
   */
  let {
    href,
    icon,
    name,
    urgent = false,
    open = $bindable(true),
    meta,
    children,
  }: { href?: string; icon: IconName; name: string; urgent?: boolean; open?: boolean; meta: Snippet; children: Snippet } = $props();
</script>

<div class="group card" class:urgent class:open>
  <FoldBox bind:open toggleLabel={t('tree.toggle', { name })}>
    {#snippet head()}
      <svelte:element this={href ? 'a' : 'div'} class="link" {href}>
        <span class="icon"><Icon name={icon} /></span>
        <span class="text"><span class="item-title name">{name}</span><span class="meta">{@render meta()}</span></span>
      </svelte:element>
    {/snippet}
    <div class="children">{@render children()}</div>
  </FoldBox>
</div>

<style>
  .group { border-radius: var(--radius-md); margin-bottom: 7px; outline: 1px solid transparent; }
  .group:not(.open):hover { outline-color: var(--tint-active); }
  .link { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 10px 6px 10px 12px; color: inherit; text-decoration: none; border-radius: var(--radius-md); }
  .icon { width: 26px; height: 34px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; color: var(--text-secondary); }
  .text { flex: 1; min-width: 0; }
  .name { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta { display: flex; align-items: center; gap: 5px; }
  .children { display: grid; grid-template-columns: minmax(0, 1fr); padding: 0 6px 8px; }
  .urgent { background: color-mix(in srgb, var(--signal-urgent) 9%, var(--surface-solid)); outline: 1px solid color-mix(in srgb, var(--signal-urgent) 35%, transparent); }
  .urgent .name, .urgent .icon { color: var(--signal-urgent); }
</style>

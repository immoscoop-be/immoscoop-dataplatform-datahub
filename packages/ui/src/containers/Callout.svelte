<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../foundations/Icon.svelte';
  import type { IconName } from '../foundations/icons.js';

  /**
   * One line that tells a state, with an icon and at most one action (Callout, DEC-UX-64). The neutral
   * tone is the notice of a page, such as a Resource without a Collection.
   */
  let {
    icon,
    tone = 'neutral',
    action,
    children,
  }: { icon: IconName; tone?: 'neutral' | 'warning' | 'urgent' | 'fine'; action?: Snippet; children: Snippet } = $props();
</script>

<div class="callout {tone}" role="status">
  <span class="icon"><Icon name={icon} /></span>
  <p>{@render children()}</p>
  {@render action?.()}
</div>

<style>
  .callout { display: flex; align-items: center; gap: 12px; margin-top: 14px; padding: 12px 16px; border-radius: var(--radius-callout); background: var(--card); }
  .icon { display: inline-flex; font-size: 22px; color: var(--text-secondary); }
  .warning .icon { color: var(--signal-warn); }
  .urgent .icon { color: var(--signal-urgent); }
  p { flex: 1; margin: 0; font-size: var(--text-small); line-height: 1.5; }
</style>

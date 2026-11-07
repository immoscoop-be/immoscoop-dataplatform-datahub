<script lang="ts">
  import Icon from '../foundations/Icon.svelte';
  import type { IconName } from '../foundations/icons.js';

  /**
   * A button that is only an icon (Button, icon): its label is read out and shown on hover. With an
   * address it is a link.
   */
  let {
    icon,
    label,
    href,
    disabled = false,
    onclick,
  }: { icon: IconName; label: string; href?: string; disabled?: boolean; onclick?: (event: MouseEvent) => void } = $props();
</script>

{#if href}
  <a class="icon-button" {href} aria-label={label} title={label}><Icon name={icon} /></a>
{:else}
  <button type="button" class="icon-button" aria-label={label} title={label} {disabled} {onclick}><Icon name={icon} /></button>
{/if}

<style>
  .icon-button { width: 32px; height: 32px; flex: none; border-radius: var(--radius-sm); border: 0; background: none; display: flex; align-items: center;
    justify-content: center; color: var(--text-secondary); cursor: pointer; font-size: 16px; text-decoration: none; }
  .icon-button:hover { background: var(--tint-hover); color: var(--text-primary); }
  .icon-button:disabled { opacity: .4; cursor: not-allowed; }
</style>

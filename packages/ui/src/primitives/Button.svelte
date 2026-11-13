<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A button, or a link that looks like one: `primary` for the main action, `quiet` for the others,
   * `outline` for a quiet one on a reading surface, `danger` for one that cannot be undone, such as
   * revoking a key. Off, it says so and does nothing.
   */
  let {
    variant = 'primary',
    href,
    type = 'button',
    disabled = false,
    large = false,
    wide = false,
    label,
    title,
    form,
    onclick,
    children,
  }: {
    variant?: 'primary' | 'quiet' | 'outline' | 'danger';
    href?: string;
    type?: 'button' | 'submit';
    disabled?: boolean;
    /** The large button of the sign-in. */
    large?: boolean;
    wide?: boolean;
    label?: string;
    /** Said on hover, such as why it is off. */
    title?: string;
    /** The form it submits, when it stands outside it, such as in the foot of a sheet. */
    form?: string;
    onclick?: (event: MouseEvent) => void;
    children: Snippet;
  } = $props();
</script>

{#if href && !disabled}
  <a class="button {variant}" class:large class:wide {href} aria-label={label} {title} {onclick}>{@render children()}</a>
{:else}
  <button class="button {variant}" class:large class:wide {type} {form} {disabled} aria-label={label} {title} {onclick}>{@render children()}</button>
{/if}

<style>
  .button { display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: var(--radius-pill); cursor: pointer;
    font: var(--weight-medium) var(--text-small) var(--font-family); text-decoration: none; }
  .primary { background: var(--text-primary); color: var(--surface-solid); padding: 9px 16px; }
  .danger { background: var(--signal-urgent); color: var(--text-on-urgent); padding: 9px 16px; }
  .quiet, .outline { background: var(--tint-hover); color: var(--text-primary); padding: 8px 14px; }
  .quiet:hover { background: var(--tint-active); }
  .outline { background: var(--card); }
  .outline:hover { background: var(--tint-active); }
  .button:disabled { opacity: .4; cursor: not-allowed; }
  .large { padding: 14px 24px; font-size: 15px; }
  .wide { width: 100%; justify-content: center; }
</style>

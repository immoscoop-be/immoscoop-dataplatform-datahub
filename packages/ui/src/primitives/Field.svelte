<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A field with its label above (Field): the page puts the control in it, a text, a text area or a
   * select, and a hint or a problem under it. A problem is read out when it appears.
   */
  let {
    label,
    hint,
    problem,
    group = false,
    children,
  }: {
    label: string;
    hint?: string;
    problem?: string;
    /** For controls that are no single input, such as a segmented control or the icon picker. */
    group?: boolean;
    children: Snippet;
  } = $props();
</script>

<svelte:element this={group ? 'div' : 'label'} class="field" role={group ? 'group' : undefined} aria-label={group ? label : undefined}>
  <span class="label">{label}</span>
  {@render children()}
  {#if problem}<span class="problem" role="alert">{problem}</span>{:else if hint}<span class="hint">{hint}</span>{/if}
</svelte:element>

<style>
  .field { display: block; margin-bottom: 12px; }
  .field:last-child { margin-bottom: 0; }
  .label { display: block; font-size: var(--text-meta); color: var(--text-muted); margin-bottom: 5px; }
  .field :global(:is(input:not([type='search']), textarea, select)) { box-sizing: border-box; width: 100%; font: var(--text-small)/1.5 var(--font-family); color: var(--text-primary);
    background: var(--surface-solid); border: 1px solid var(--tint-active); border-radius: var(--radius-sm); padding: 8px 10px; resize: vertical; }
  .field :global(:is(input:not([type='search']), textarea, select):focus) { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
  .hint, .problem { display: block; margin-top: 6px; font-size: var(--text-meta); line-height: 1.5; color: var(--text-muted); }
  .problem { color: var(--signal-urgent); }
</style>

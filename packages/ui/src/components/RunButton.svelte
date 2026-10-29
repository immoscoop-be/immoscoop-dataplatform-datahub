<script lang="ts">
  import type { Snippet } from 'svelte';
  import { formatBytes } from '../foundations/bytes.js';
  import Icon from '../foundations/Icon.svelte';
  import { currentLanguage, t } from '../foundations/texts.svelte.js';

  /**
   * Run, with what the run reads in the button itself (Run button, DEC-UX-28): red with "Approve and run"
   * above the approval threshold. On rest, a pop-out says what it reads and how to read less (Explain on rest).
   */
  let {
    bytes,
    approve = false,
    disabled = false,
    busy = false,
    label,
    title,
    onclick,
    explain,
  }: {
    /** What the run reads at most; null while the Pre-flight is not known. */
    bytes: number | null;
    /** Above the approval threshold: its author approves it by running it (DEC-SR-29). */
    approve?: boolean;
    disabled?: boolean;
    busy?: boolean;
    /** In place of Run, such as for a query that goes to the Data Team. */
    label?: string;
    /** Said on hover when it is off. */
    title?: string;
    onclick: () => void;
    explain?: Snippet;
  } = $props();
</script>

<span class="anchor">
  <button type="button" class="run" class:approve disabled={disabled || busy} {title} aria-busy={busy} {onclick}>
    <Icon name="play-fill" />{label ?? t(approve ? 'run.approve' : 'run.run')}
    {#if bytes !== null}<span class="bytes">{formatBytes(bytes, currentLanguage())}</span>{/if}
  </button>
  {#if explain && !disabled}<span class="pop" role="tooltip">{@render explain()}</span>{/if}
</span>

<style>
  .anchor { position: relative; display: inline-block; }
  .run { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; border: 0; border-radius: var(--radius-pill); cursor: pointer; padding: 9px 16px;
    font: var(--weight-medium) var(--text-small) var(--font-family); background: var(--text-primary); color: var(--surface-solid); }
  .run.approve { background: var(--signal-urgent); color: var(--text-on-urgent); }
  .run:disabled { opacity: .45; cursor: not-allowed; }
  .run:focus-visible { outline: 2px solid var(--text-secondary); outline-offset: 2px; }
  .bytes { margin-left: 4px; padding-left: 9px; border-left: 1px solid color-mix(in srgb, currentColor 35%, transparent); font-weight: var(--weight-regular); opacity: .85; }
  .pop { display: none; position: absolute; right: 0; bottom: calc(100% + 10px); z-index: 5; width: 300px; padding: 12px 14px; border-radius: var(--radius-md);
    background: var(--surface-solid); box-shadow: var(--sheet-shadow); outline: 1px solid var(--tint-active); font-size: var(--text-small); line-height: 1.5; color: var(--text-secondary); white-space: normal; }
  .anchor:hover .pop, .anchor:focus-within .pop { display: block; }
  .pop :global(b) { font-weight: var(--weight-medium); color: var(--text-primary); }
  .approve + .pop :global(b) { color: var(--signal-urgent); }
</style>

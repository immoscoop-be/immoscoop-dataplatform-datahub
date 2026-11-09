<script lang="ts">
  import { t } from '../foundations/texts.svelte.js';

  /**
   * Three dots going back and forth where something will show, while Data Hub reads it (Loading, DEC-UX-165).
   * They show only after a moment, so that a quick answer shows none; with Reduce motion they stand still.
   * `inline` sits in a line of text or a small space, such as a count or a tile, instead of a page or a list.
   */
  let { label, inline = false }: { label?: string; inline?: boolean } = $props();
</script>

<span class="loading" class:inline role="progressbar" aria-label={label ?? t('loading')}>
  <span class="dot"></span><span class="dot"></span><span class="dot"></span>
</span>

<style>
  .loading { display: flex; justify-content: center; align-items: center; gap: 6px; padding: 28px 0; color: var(--text-muted); opacity: 0; animation: appear var(--delay-loading) step-end forwards; }
  .inline { display: inline-flex; gap: 4px; padding: 0; vertical-align: middle; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; animation: sway var(--motion-loading) infinite alternate; }
  .inline .dot { width: 5px; height: 5px; }
  .dot:nth-child(2) { animation-delay: var(--delay-loading-step); }
  .dot:nth-child(3) { animation-delay: calc(var(--delay-loading-step) * 2); }
  @keyframes appear { to { opacity: 1; } }
  @keyframes sway {
    from { transform: translateX(-4px); opacity: .35; }
    to { transform: translateX(4px); opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .dot { animation: none; opacity: .6; }
  }
</style>

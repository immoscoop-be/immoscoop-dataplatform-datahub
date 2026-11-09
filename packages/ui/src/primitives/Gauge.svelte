<script lang="ts">
  import { formatBytes } from '../foundations/bytes.js';
  import { currentLanguage } from '../foundations/texts.svelte.js';

  /**
   * A bar with the two thresholds and what a run reads (Gauge, DEC-SR-29): the approval threshold as a
   * mark, the threshold to the Data Team at its end. The fill takes the colour of its range: calm below the
   * first, the warning colour up to the second, urgent above it. It says nothing a screen reader needs:
   * the Pre-flight says it in words.
   */
  let { bytes, approve, request }: { bytes: number | null; approve: number; request: number } = $props();

  const share = $derived(bytes === null ? 0 : Math.min(bytes / request, 1));
  const range = $derived(bytes === null || bytes <= approve ? 'free' : bytes <= request ? 'approve' : 'request');
  const language = $derived(currentLanguage());
</script>

<span class="gauge" aria-hidden="true">
  <span class="bar">
    <span class="fill {range}" style:width="{share * 100}%"></span>
    <span class="mark" style:left="{(approve / request) * 100}%"></span>
    <span class="mark end"></span>
  </span>
  <span class="legend">
    <span>0</span>
    <span style:left="{(approve / request) * 100}%">{formatBytes(approve, language)}</span>
    <span class="end">{formatBytes(request, language)}</span>
  </span>
</span>

<style>
  .gauge { display: block; width: 130px; }
  .bar { position: relative; display: block; height: 6px; border-radius: var(--radius-sm); background: var(--tint-active); }
  .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: var(--radius-sm); background: var(--text-secondary); }
  .fill.approve { background: var(--signal-warn); }
  .fill.request { background: var(--signal-urgent); }
  .mark { position: absolute; top: -3px; width: 2px; height: 12px; margin-left: -1px; background: var(--text-primary); }
  .mark.end { left: 100%; }
  .legend { position: relative; display: block; height: 12px; margin-top: 4px; font-size: 10px; color: var(--text-muted); }
  .legend span { position: absolute; white-space: nowrap; }
  .legend .end { left: 100%; transform: translateX(-100%); }
</style>

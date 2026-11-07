<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A small label (Chip): a status in a row of them, a count next to a name, or a count in the urgent
   * red for what waits for the Data Team (DEC-UX-16). A Broken one is red with its dot (DEC-UX-81).
   */
  let { variant = 'status', children }: { variant?: 'status' | 'warn' | 'count' | 'urgent' | 'broken'; children: Snippet } = $props();
</script>

<span class="chip {variant}">{@render children()}</span>

<style>
  .chip { display: inline-flex; align-items: center; white-space: nowrap; }
  .status, .warn, .broken { gap: 5px; font-size: var(--text-meta); color: var(--text-secondary); background: var(--card); padding: 5px 10px; border-radius: var(--radius-pill); }
  .warn { color: var(--signal-warn); }
  .broken { color: var(--signal-urgent); }
  .broken::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--signal-urgent); }
  .count { font-size: 10px; background: var(--tint-hover); padding: 0 6px; border-radius: var(--radius-pill); }
  .urgent { min-width: 16px; height: 16px; padding: 0 5px; justify-content: center; border-radius: var(--radius-pill);
    background: var(--signal-urgent); color: var(--text-on-urgent); font-size: 10px; font-weight: var(--weight-semibold); }
</style>

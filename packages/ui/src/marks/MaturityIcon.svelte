<script lang="ts">
  import { levelName } from '../foundations/levels.js';
  import { t } from '../foundations/texts.svelte.js';

  /**
   * The Level of a Resource or Lens: six bars, filled up to it; after a drop, the previous Level as an
   * outlined bar in the signal colour (Maturity). Small and grey in a list, so the names lead; its
   * name on hover, unless the name stands next to it.
   */
  let {
    level,
    previous,
    small = false,
    tooltip = true,
  }: { level: number; previous?: number; small?: boolean; tooltip?: boolean } = $props();

  const BARS = [0, 1, 2, 3, 4, 5].map((index) => ({ index, height: 4 + index * 2.4, x: index * 5 }));
  const name = $derived(previous === undefined ? levelName(level) : t('maturity.was', { name: levelName(level), previous: levelName(previous) }));
</script>

<span class="maturity" class:small role="img" aria-label={t('maturity.label', { name })} data-name={tooltip ? name : undefined}>
  <svg width="30" height="16" viewBox="0 0 30 16" aria-hidden="true">
    {#each BARS as bar (bar.index)}
      {#if bar.index === previous}
        <rect class="was" x={bar.x + 0.5} y={16 - bar.height + 0.5} width="3" height={bar.height - 1} rx="1.2" />
      {:else}
        <rect class:on={bar.index <= level} x={bar.x} y={16 - bar.height} width="4" height={bar.height} rx="1.4" />
      {/if}
    {/each}
  </svg>
</span>

<style>
  .maturity { display: inline-flex; position: relative; flex: none; }
  rect { fill: var(--tint-active); }
  rect.on { fill: var(--text-primary); }
  rect.was { fill: none; stroke: var(--signal-warn); stroke-width: 1; }
  .small svg { width: 20px; height: 11px; }
  .small rect.on { fill: var(--text-muted); }
  .maturity[data-name]:hover::after { content: attr(data-name); position: absolute; right: 0; bottom: 22px; background: var(--text-primary); color: var(--surface-solid);
    font-size: 10px; font-weight: var(--weight-regular); padding: 3px 8px; border-radius: var(--radius-chip); white-space: nowrap; z-index: 5; }
</style>

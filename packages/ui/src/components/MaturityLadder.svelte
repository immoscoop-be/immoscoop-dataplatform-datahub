<script lang="ts">
  import { t } from '../foundations/texts.svelte.js';

  /** The six Levels drawn large, filled up to the current one, its number in bold (Maturity ladder). */
  let { level }: { level: number } = $props();

  const STEPS = [0, 1, 2, 3, 4, 5].map((step) => ({ step, x: 4 + step * 40, y: 96 - step * 16 }));
</script>

<svg class="ladder" viewBox="0 0 240 120" width="100%" role="img" aria-label={t('maturity.ladder', { level })}>
  {#each STEPS as { step, x, y } (step)}
    <rect class:on={step <= level} {x} {y} width="34" height={110 - y} rx="5" />
    <text class:current={step === level} x={x + 17} y={y - 6} text-anchor="middle">{step}</text>
  {/each}
</svg>

<style>
  .ladder { display: block; }
  rect { fill: var(--tint-active); }
  rect.on { fill: var(--text-primary); }
  text { font-family: var(--font-family); font-size: 9px; fill: var(--text-muted); }
  text.current { fill: var(--text-primary); font-weight: var(--weight-semibold); }
</style>

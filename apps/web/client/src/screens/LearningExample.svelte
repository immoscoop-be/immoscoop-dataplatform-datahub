<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import type { Card, ChartRequest } from '../lib/learning.js';
  import LearningText from './LearningText.svelte';

  /**
   * See it of a Learning Card (FR-LR-29): its example, drawn by the Chart Server from the figures of the card
   * as it is (DEC-LR-26), and beside it what to look at and what you see there. Pointing at a part of the
   * chart waits for the Chart Server (OP-LR-31).
   */
  let {
    see,
    theme,
    draw,
    compact = false,
  }: {
    see: NonNullable<Card['see']>;
    theme: 'light' | 'dark';
    /** Draws the example as a picture; null when it was not drawn. */
    draw: (chart: ChartRequest, theme: 'light' | 'dark') => Promise<string | null>;
    /** One column, in the floating window. */
    compact?: boolean;
  } = $props();

  /** The picture: undefined while it is drawn, null when it was not. */
  let picture: string | null | undefined = $state();
  $effect(() => {
    const [chart, drawn] = [see.chart, theme];
    picture = undefined;
    let current = true;
    draw(chart, drawn).then((found) => current && (picture = found));
    return () => {
      current = false;
    };
  });
</script>

<div class="see" class:compact>
  <figure class="figure card">
    {#if picture}
      <img src={picture} alt={see.youSee} />
    {:else if picture === null}
      <p class="meta failed">{t('learning.example.failed')}</p>
    {:else}
      <div class="drawing" aria-hidden="true"></div>
    {/if}
    <figcaption>{t('learning.example.drawn')}</figcaption>
  </figure>
  <div class="look">
    <div class="part card">
      <div class="label"><Icon name="eye" />{t('learning.lookAt')}</div>
      <p><LearningText text={see.lookAt} /></p>
    </div>
    <div class="part card">
      <div class="label"><Icon name="lightbulb" />{t('learning.youSee')}</div>
      <p><LearningText text={see.youSee} /></p>
    </div>
  </div>
</div>

<style>
  .see { display: grid; grid-template-columns: minmax(0, 3fr) minmax(240px, 2fr); gap: 14px; align-items: start; }
  .figure { margin: 0; border-radius: var(--radius-lg); padding: 18px 20px 12px; }
  .figure img { display: block; width: 100%; height: auto; }
  .figure figcaption { margin-top: 6px; font-size: var(--text-meta); color: var(--text-muted); }
  .drawing { aspect-ratio: 16 / 9; border-radius: var(--radius-md); background: var(--tint-hover); }
  .failed { margin: 24px 0; text-align: center; }
  .look { display: grid; gap: 10px; }
  .part { border-radius: var(--radius-lg); padding: 14px 18px; }
  .label { display: flex; align-items: center; gap: 6px; }
  .part p { margin: 4px 0 0; font-size: 14px; line-height: 1.6; }
  .compact { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .compact .figure { padding: 12px 14px 8px; }
  .compact .part { padding: 10px 14px; }
  .compact .part p { font-size: 13px; }
  @media (max-width: 1100px) {
    .see { grid-template-columns: minmax(0, 1fr); }
  }
</style>

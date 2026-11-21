<script lang="ts">
  import type { CategoriesResult } from '@datahub/contracts/eda';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { number, percent } from '../lib/eda.js';

  /**
   * Where the weight of a text lies (FR-ED-17, DEC-ED-33): a bar per value of its 10 heaviest, the heaviest first, each as
   * long as its share of the whole field; the others together, quieter; the empty values apart, hatched. The share
   * beside each, the weight of a value on hover. An illustration drawn for the EDA (DEC-UX-325).
   */
  let { result, field }: { result: CategoriesResult; /** The text it is set on. */ field: string } = $props();

  const language = $derived(currentLanguage());
  /** A bar never shorter than can be seen, so that a value of almost nothing is still there. */
  const width = (share: number) => `${Math.max(share * 100, share > 0 ? 0.6 : 0)}%`;
  const title = (value: string, weight: number, share: number) => t('eda.categories.chart.title', { value, weight: number(weight, language), share: percent(share, 1, language) });
</script>

<ul class="bars" aria-label={t('eda.categories.chart.label', { field })}>
  {#each result.top as one, index (index)}
    <li title={title(one.value, one.weight, one.share)}>
      <span class="value mono">{one.value}</span>
      <span class="bar"><span style:width={width(one.share)}></span></span>
      <span class="share">{percent(one.share, 1, language)}</span>
    </li>
  {/each}
  {#if result.others.values > 0}
    {@const others = t('eda.categories.chart.others', { count: result.others.values })}
    <li class="others" title={title(others, result.others.weight, result.others.share)}>
      <span class="value">{others}</span>
      <span class="bar"><span style:width={width(result.others.share)}></span></span>
      <span class="share">{percent(result.others.share, 1, language)}</span>
    </li>
  {/if}
  {#if result.empty.weight > 0}
    {@const empty = t('eda.categories.chart.empty')}
    <li class="empty" title={title(empty, result.empty.weight, result.empty.share)}>
      <span class="value">{empty}</span>
      <span class="bar"><span style:width={width(result.empty.share)}></span></span>
      <span class="share">{percent(result.empty.share, 1, language)}</span>
    </li>
  {/if}
</ul>

<style>
  .bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  li { display: grid; grid-template-columns: minmax(0, 110px) minmax(0, 1fr) 48px; gap: 8px; align-items: center; font-size: var(--text-small); }
  .value { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar { height: 10px; border-radius: var(--radius-pill); background: var(--surface-sub); overflow: hidden; }
  .bar span { display: block; height: 100%; border-radius: var(--radius-pill); background: var(--col-slate); }
  .share { text-align: right; font-variant-numeric: tabular-nums; color: var(--text-secondary); white-space: nowrap; }
  .others .value { color: var(--text-secondary); }
  .others .bar span { background: color-mix(in srgb, var(--col-slate) 45%, transparent); }
  .empty .value { color: var(--text-muted); font-style: italic; }
  .empty .bar span { background: repeating-linear-gradient(135deg, var(--signal-warn) 0 3px, color-mix(in srgb, var(--signal-warn) 35%, transparent) 3px 6px); }
</style>

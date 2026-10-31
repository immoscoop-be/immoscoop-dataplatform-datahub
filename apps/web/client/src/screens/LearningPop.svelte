<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago, day } from '@datahub/ui/foundations/when.js';
  import { cardsOf, type MarkerPlace, seenState, type Topic } from '../lib/learning.js';
  import { useLearning } from '../lib/learning-context.js';
  import { seePath } from '../lib/routes.js';
  import LearningText from './LearningText.svelte';

  /**
   * What the pop-out of a marker holds (FR-LR-36, DEC-UX-57): on its head, quietly, how many cards explain the
   * text; an item per written card, with its number and title, the gain of the card, the same sentence wherever
   * it appears, whether and when the User saw it, and "See it"; at its foot the way to the Learning Centre. A
   * click on an item opens the card in the floating window over the page.
   */
  let { place, close }: { place: MarkerPlace; close: () => void } = $props();

  const learning = useLearning();
  const language = $derived(currentLanguage());
  const topics = $derived(learning ? cardsOf(place, learning.shown) : []);
  onMount(() => learning?.want());

  const kindIcon = (topic: Topic): IconName => (topic.level === 'compass' ? 'compass' : topic.level === 'reading' ? 'chart-line' : 'book-open-text');
</script>

{#if learning}
  <div class="head"><span class="mark" aria-hidden="true">ⓘ</span>{t('learning.pop.head', { count: topics.length })}</div>
  <ul class="items">
    {#each topics as topic (topic.number)}
      {@const card = learning.cards.get(topic.number) ?? learning.shown.get(topic.number)}
      {@const seen = seenState(topic.number, learning.progress)}
      <li class="item">
        <button
          type="button"
          class="open"
          onclick={() => {
            learning.open(topic.number, place);
            close();
          }}
        >
          <span class="title"><Icon name={kindIcon(topic)} /><span><span class="number">{topic.number}</span>{topic.title[language]}</span></span>
          {#if card}<span class="gain"><LearningText text={card.gain} /></span>{/if}
          <span class="seen">
            {#if seen.kind === 'understood'}<Icon name="check-circle" />{t('learning.pop.understood', { day: day(seen.at, language) })}
            {:else if seen.kind === 'seen'}<Icon name="eye" />{t('learning.pop.seen', { when: ago(seen.at, language) })}
            {:else}{t('learning.pop.new')}{/if}
          </span>
        </button>
        {#if card?.see}<a class="see" href={seePath(topic.number)} onclick={close}><span>{t('learning.step.see')}</span><Icon name="arrow-right" /></a>{/if}
      </li>
    {/each}
  </ul>
  <div class="foot"><a class="centre" href="/learning" onclick={close}><span>{t('learning.pop.centre')}</span><Icon name="arrow-right" /></a></div>
{/if}

<style>
  .head { display: flex; align-items: center; gap: 6px; padding: 4px 6px 8px; font-size: var(--text-meta); color: var(--text-muted); }
  .mark { font-family: var(--font-symbol); font-size: 12px; line-height: 1; }
  .items { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
  .item { position: relative; border-radius: var(--radius-sm); background: var(--surface-sub); }
  .open { display: block; width: 100%; padding: 10px 12px; border: 0; border-radius: var(--radius-sm); background: none; font: inherit; color: inherit; text-align: left; cursor: pointer; }
  .open:hover { background: var(--tint-hover); }
  .open:focus-visible { outline: 2px solid var(--text-primary); outline-offset: -2px; }
  .title { display: flex; align-items: center; gap: 6px; padding-right: 64px; font-size: 12.5px; font-weight: var(--weight-medium); }
  .title > :global(.icon) { font-size: 14px; color: var(--text-secondary); flex: none; }
  .number { color: var(--text-muted); font-variant-numeric: tabular-nums; margin-right: 5px; font-weight: var(--weight-regular); }
  .gain { display: block; margin-top: 5px; color: var(--text-primary); line-height: 1.45; }
  .seen { display: flex; align-items: center; gap: 4px; margin-top: 6px; font-size: var(--text-meta); color: var(--text-muted); }
  .see { position: absolute; top: 9px; right: 12px; display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-meta); color: var(--text-secondary); text-decoration: none; }
  .see:hover span, .centre:hover span { text-decoration: underline; text-underline-offset: 3px; }
  .see:focus-visible, .centre:focus-visible { outline: 2px solid var(--text-secondary); }
  .foot { margin-top: 6px; padding: 8px 6px 4px; }
  .centre { display: inline-flex; align-items: center; gap: 5px; font-size: var(--text-meta); color: var(--text-secondary); text-decoration: none; }
</style>

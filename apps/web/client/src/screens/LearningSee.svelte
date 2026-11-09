<script lang="ts">
  import { onMount } from 'svelte';
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import { type Card, type ChartRequest, LEVELS, type Topic } from '../lib/learning.js';
  import { learningPath } from '../lib/routes.js';
  import LearningExample from './LearningExample.svelte';
  import LearningText from './LearningText.svelte';

  /**
   * See it of a Learning Card on a page of its own (FR-LR-29, learning-see), for whoever comes from a page of
   * Data Hub to see one example: the rule, the example and what to look at, then back to where they were or on
   * to the whole card.
   */
  let {
    topic,
    card,
    understood,
    theme,
    draw,
    onopen,
    onunderstand,
    onwhole,
    onback,
  }: {
    topic: Topic;
    /** The card in the language of the User, with See it. */
    card: Card & { see: NonNullable<Card['see']> };
    understood: boolean;
    theme: 'light' | 'dark';
    draw: (chart: ChartRequest, theme: 'light' | 'dark') => Promise<string | null>;
    /** The User sees See it of the card: it is seen (FR-LR-32). */
    onopen: () => void;
    onunderstand: (understood: boolean) => void;
    /** The whole card opens on a step: on See it, or on You can now once the User understands it. */
    onwhole: (step: 'see' | 'can') => void;
    onback: () => void;
  } = $props();

  const language = $derived(currentLanguage());
  const level = $derived(LEVELS.find((one) => one.id === topic.level)!);
  onMount(() => onopen());
</script>

<div class="flow">
  <button type="button" class="text-link back" onclick={onback}><Icon name="arrow-left" /><span>{t('learning.see.back')}</span></button>
  <Breadcrumb steps={[{ label: 'Learning Centre', href: '/learning' }, { label: level.name }, { label: `${topic.number} ${topic.title[language]}`, href: learningPath(topic.number) }]} />
  <div class="head">
    <h1 class="page-title"><span class="number">{t('learning.step.see')}</span>{topic.title[language]}</h1>
    {#if understood}
      <Button variant="outline" title={t('learning.understood.undo')} onclick={() => onunderstand(false)}><Icon name="check-circle-fill" />{t('learning.understood')}</Button>
    {:else}
      <Button
        href={learningPath(topic.number)}
        onclick={() => {
          onunderstand(true);
          onwhole('can');
        }}><Icon name="check-circle-fill" />{t('learning.understand')}</Button
      >
    {/if}
  </div>
  <p class="lead"><LearningText text={card.core.rule} /></p>
  <section class="pane" aria-label={t('learning.step.see')}>
    <LearningExample see={card.see} {theme} {draw} />
  </section>
  <nav class="next" aria-label={t('learning.see.ways')}>
    <div class="next-in">
      <div class="next-text"><b>{t('learning.see.one', { number: topic.number })}</b>{t('learning.see.more')}</div>
      <Button variant="outline" onclick={onback}>{t('learning.see.back')}</Button>
      <Button href={learningPath(topic.number)} onclick={() => onwhole('see')}>{t('learning.see.whole')}<Icon name="arrow-right" /></Button>
    </div>
  </nav>
</div>

<style>
  .flow { display: flex; flex-direction: column; min-height: 100%; }
  .back { margin-bottom: 10px; align-self: flex-start; }
  .head { display: flex; align-items: center; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
  .head .page-title { flex: 1; min-width: 280px; }
  .number { color: var(--text-muted); margin-right: 8px; font-weight: var(--weight-regular); }
  .lead { margin: 14px 0 18px; font-size: 15px; line-height: 1.65; }
  .pane { flex: 1; }
  .text-link { all: unset; font-size: var(--text-small); color: var(--text-secondary); display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
  .text-link:hover span { text-decoration: underline; text-underline-offset: 3px; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
  .next { position: sticky; bottom: -26px; margin: 22px 0 -26px; padding-bottom: 26px; }
  .next-in { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 12px 12px 18px; border-radius: var(--radius-lg); background: var(--surface-solid);
    outline: 1px solid var(--tint-hover); }
  .next-text { flex: 1; min-width: 240px; font-size: 13px; line-height: 1.45; color: var(--text-secondary); }
  .next-text b { display: block; font-size: 14px; color: var(--text-primary); font-weight: var(--weight-medium); margin-bottom: 1px; }
</style>

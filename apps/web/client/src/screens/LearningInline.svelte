<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago } from '@datahub/ui/foundations/when.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import { LEVELS, seenState, topicOf } from '../lib/learning.js';
  import { useLearning } from '../lib/learning-context.js';
  import { learningPath } from '../lib/routes.js';
  import LearningText from './LearningText.svelte';

  /**
   * What Data Hub writes itself carries the Learning Card that explains it, right under its text, under
   * "Understand what is happening here" (FR-LR-38, DEC-UX-79): the card with its number, title and whether the User
   * has seen it. A click opens it inline, in the Message: its core idea and what the User can do with it, with the
   * way to the whole card and "I understand it". It shows once its card is written (DEC-LR-29).
   */
  let { number }: { number: string } = $props();

  const learning = useLearning();
  const topic = $derived(topicOf(number));
  const card = $derived(learning?.cards.get(number) ?? learning?.shown.get(number));
  const seen = $derived(seenState(number, learning?.progress));
  const language = $derived(currentLanguage());
  let open = $state(false);
  onMount(() => learning?.want());

  // Opened, the card is seen, once what the User did with the cards is known (FR-LR-32).
  $effect(() => {
    if (open && learning?.progress) learning.seen(number);
  });
  const kindIcon = (level: string): IconName => (level === 'compass' ? 'compass' : level === 'reading' ? 'chart-line' : 'book-open-text');
</script>

{#if learning && topic && card}
  <div class="understand">
    <div class="label">{t('learning.inline.head')}</div>
    <div class="inline" class:open>
      <button type="button" class="attach" aria-expanded={open} onclick={() => (open = !open)}>
        <span class="kind"><Icon name={kindIcon(topic.level)} /></span>
        <span class="body">
          <span class="title"><span class="number">{topic.number}</span>{topic.title[language]}</span>
          <span class="meta">{t('learning.messages.meta', { level: LEVELS.find((one) => one.id === topic.level)?.name ?? '' })} · {t('learning.minutes', { minutes: card.minutes })}</span>
        </span>
        <span class="state">
          {#if seen.kind === 'understood'}<Icon name="check-circle-fill" />{t('learning.understood')}
          {:else if seen.kind === 'seen'}<Icon name="eye" />{t('learning.pop.seen', { when: ago(seen.at, language) })}
          {:else}<Icon name="circle" />{t('learning.pop.new')}{/if}
        </span>
        <span class="caret"><Icon name="caret-down" /></span>
      </button>
      {#if open}
        <div class="inline-body">
          <p class="rule"><LearningText text={card.core.rule} /></p>
          <p class="can"><b>{t('learning.step.can')}</b> <LearningText text={card.can.now} /></p>
          <div class="foot">
            <a class="text-link" href={learningPath(number)}><span>{t('learning.see.whole')}</span><Icon name="arrow-right" /></a>
            {#if seen.kind === 'understood'}
              <Button variant="outline" title={t('learning.understood.undo')} onclick={() => learning.understand(number, false)}><Icon name="check-circle-fill" />{t('learning.understood')}</Button>
            {:else}
              <Button variant="outline" onclick={() => learning.understand(number, true)}><Icon name="check-circle-fill" />{t('learning.understand')}</Button>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .understand { margin: 12px 0 4px; }
  .attach { display: flex; align-items: center; gap: 10px; width: 100%; margin-top: 8px; padding: 10px 12px; border: 0; border-radius: var(--radius-sm); outline: 1px solid var(--tint-active);
    background: var(--card); font: inherit; color: inherit; text-align: left; cursor: pointer; }
  .attach:hover { background: var(--tint-hover); }
  .attach:focus-visible { outline: 2px solid var(--text-secondary); }
  .kind { display: inline-flex; font-size: 20px; color: var(--text-secondary); flex: none; }
  .body { flex: 1; min-width: 0; display: grid; }
  .title { font-size: 13px; font-weight: var(--weight-medium); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .number { color: var(--text-muted); font-variant-numeric: tabular-nums; margin-right: 5px; font-weight: var(--weight-regular); }
  .state { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-meta); color: var(--text-secondary); white-space: nowrap; }
  .caret { display: inline-flex; margin-left: 8px; color: var(--text-muted); transition: transform var(--motion-fold); }
  .open .caret { transform: rotate(180deg); }
  .inline-body { margin-top: 8px; padding: 14px 16px; border-radius: var(--radius-md); background: var(--surface-sub); font-size: var(--text-small); line-height: 1.55; }
  .rule { margin: 0 0 10px; font-size: 14px; color: var(--text-primary); }
  .can { margin: 0 0 12px; color: var(--text-secondary); }
  .can b { font-weight: var(--weight-medium); color: var(--text-primary); }
  .foot { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .text-link { display: inline-flex; align-items: center; gap: 5px; font-size: var(--text-small); color: var(--text-secondary); text-decoration: none; }
  .text-link:hover span { text-decoration: underline; text-underline-offset: 3px; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
</style>

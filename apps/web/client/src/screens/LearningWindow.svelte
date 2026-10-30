<script lang="ts">
  import { onMount } from 'svelte';
  import FloatingWindow from '@datahub/ui/containers/FloatingWindow.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import { type Card, type ChartRequest, type Depth, nextStep, type Step, stepsOf, type Topic } from '../lib/learning.js';
  import { learningPath } from '../lib/routes.js';
  import LearningNext from './LearningNext.svelte';
  import LearningSteps from './LearningSteps.svelte';

  /**
   * A Learning Card opened from a pop-out, in a floating window over the page, so that the User stays where
   * they are (FR-LR-12, learning-float): on its head the graduation cap, "Learning Card", its number and title;
   * in it the same five steps as on its page, smaller, with "I understand it" beside them (DEC-UX-47); at its
   * foot "Next", and "Open in the Learning Centre", which opens the full page of the card.
   */
  let {
    topic,
    card,
    cards,
    understood,
    start,
    theme,
    draw,
    onstep,
    onunderstand,
    onclose,
  }: {
    topic: Topic;
    /** The card in the language of the User. */
    card: Card;
    cards: ReadonlyMap<string, Card>;
    understood: boolean;
    start: Step;
    theme: 'light' | 'dark';
    draw: (chart: ChartRequest, theme: 'light' | 'dark') => Promise<string | null>;
    onstep: (step: Step) => void;
    onunderstand: (understood: boolean) => void;
    onclose: () => void;
  } = $props();

  const steps = $derived(stepsOf(card));
  // svelte-ignore state_referenced_locally
  let step: Step = $state(steps.includes(start) ? start : 'why');
  let depth: Depth = $state('full');
  let top: HTMLElement | undefined = $state();
  const next = $derived(nextStep(steps, step, depth));

  function go(to: Step): void {
    step = to;
    onstep(to);
    const body = top?.closest('.body');
    if (body) body.scrollTop = 0;
  }
  onMount(() => onstep(step));
</script>

<FloatingWindow title={`${topic.number} ${topic.title[currentLanguage()]}`} meta="Learning Card" icon="graduation-cap-fill" wide {onclose}>
  <div class="window" bind:this={top}>
    <LearningSteps {card} {cards} {steps} {step} bind:depth compact {theme} {draw} ongo={go}>
      {#snippet understand()}
        {#if understood}
          <Button variant="outline" title={t('learning.understood.undo')} onclick={() => onunderstand(false)}><Icon name="check-circle-fill" />{t('learning.understood')}</Button>
        {:else}
          <Button
            onclick={() => {
              onunderstand(true);
              go('can');
            }}><Icon name="check-circle-fill" />{t('learning.understand')}</Button
          >
        {/if}
      {/snippet}
    </LearningSteps>
  </div>
  {#snippet foot()}
    <LearningNext {next} compact ongo={go}>
      <a class="open" href={learningPath(topic.number)} onclick={onclose}><span>{t('learning.window.open')}</span><Icon name="arrow-right" /></a>
    </LearningNext>
  {/snippet}
</FloatingWindow>

<style>
  .window { padding-top: 12px; }
  .open { display: inline-flex; align-items: center; gap: 5px; margin-top: 8px; font-size: var(--text-meta); color: var(--text-secondary); text-decoration: none; }
  .open:hover span { text-decoration: underline; text-underline-offset: 3px; }
  .open:focus-visible { outline: 2px solid var(--text-secondary); }
</style>

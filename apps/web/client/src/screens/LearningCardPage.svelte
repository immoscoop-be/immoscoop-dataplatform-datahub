<script lang="ts">
  import { onMount } from 'svelte';
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import { type Card, type ChartRequest, type Depth, LEVELS, nextStep, SECTIONS, type Step, stepsOf, type Topic } from '../lib/learning.js';
  import LearningNext from './LearningNext.svelte';
  import LearningSteps from './LearningSteps.svelte';
  import { command, place, useScreenCommands } from '../lib/commands.svelte.js';
  import type { QuickRow } from '../lib/quick.js';

  /**
   * The page of a Learning Card in five steps (FR-LR-27, DEC-LR-10): the way to it, its number and title, "I
   * understand it", the only button that is always there (FR-LR-28), the steps one at a time, and "Next" at the
   * foot of the window. A card without See it or questions yet, a minimal card, shows the steps it has (DEC-LR-23).
   */
  let {
    topic,
    card,
    cards,
    understood,
    start,
    theme,
    draw,
    messages,
    onstep,
    onunderstand,
  }: {
    topic: Topic;
    /** The card in the language of the User. */
    card: Card;
    /** Every written card in the language of the User, for where to go next. */
    cards: ReadonlyMap<string, Card>;
    understood: boolean;
    /** The step the page opens on. */
    start: Step;
    theme: 'light' | 'dark';
    draw: (chart: ChartRequest, theme: 'light' | 'dark') => Promise<string | null>;
    /** "Messages" on the card, with their number once they are read (FR-LR-06). */
    messages: { href: string; count: number | null };
    /** The User opened a step: the card is seen (FR-LR-32). */
    onstep: (step: Step) => void;
    onunderstand: (understood: boolean) => void;
  } = $props();

  const language = $derived(currentLanguage());
  const level = $derived(LEVELS.find((one) => one.id === topic.level)!);
  const section = $derived(SECTIONS.find((one) => one.number === topic.section));
  const steps = $derived(stepsOf(card));

  // svelte-ignore state_referenced_locally
  let step: Step = $state(steps.includes(start) ? start : 'why');
  let depth: Depth = $state('full');
  let top: HTMLElement | undefined = $state();
  const next = $derived(nextStep(steps, step, depth));

  function go(to: Step): void {
    step = to;
    onstep(to);
    const main = top?.closest('.main');
    if (main) main.scrollTop = 0;
  }
  onMount(() => onstep(step));

  function understand(): void {
    onunderstand(true);
    go('can');
  }

  // In the quick window: understood or not, the next step and every other, quick or full, and its Messages (DEC-UX-240).
  const STEP_NAMES = { why: 'learning.step.why', core: 'learning.step.core', see: 'learning.step.see', check: 'learning.step.check', can: 'learning.step.can' } as const;
  useScreenCommands((goTo) => {
    const rows: QuickRow[] = [];
    rows.push(understood ? command('card:understood', 'check-circle-fill', t('quick.card.undo'), () => onunderstand(false), { words: t('quick.card.words') }) : command('card:understood', 'check-circle-fill', t('learning.understand'), understand, { words: t('quick.card.words') }));
    if (next) {
      const to = next;
      rows.push(command('card:next', 'arrow-right', t('quick.card.next', { name: t(STEP_NAMES[to]) }), () => go(to), { words: t('quick.card.step.words') }));
    }
    for (const one of steps) if (one !== step && one !== next) rows.push(command(`card:step:${one}`, 'list-numbers', t('quick.card.step', { name: t(STEP_NAMES[one]) }), () => go(one), { words: t('quick.card.step.words') }));
    rows.push(depth === 'full' ? command('card:depth', 'arrows-in-line-vertical', t('quick.card.quick'), () => (depth = 'quick'), { meta: t('learning.depth.quick.about'), words: t('quick.card.depth.words') }) : command('card:depth', 'arrows-out-simple', t('quick.card.full'), () => (depth = 'full'), { meta: t('learning.depth.full.about'), words: t('quick.card.depth.words') }));
    rows.push(place('card:messages', 'chat-circle-text', 'Messages', () => goTo(messages.href), { meta: t('quick.messages.meta', { count: messages.count ?? 0 }), words: t('quick.messages.words') }));
    return { group: t('quick.group.card'), where: `${topic.number} ${topic.title[language]}`, rows };
  });
</script>

<div class="flow" bind:this={top}>
  <Breadcrumb steps={[{ label: 'Learning Centre', href: '/learning' }, { label: level.name }, ...(section ? [{ label: `${section.number} ${section.title[language]}` }] : [])]} />
  <div class="head">
    <h1 class="page-title"><span class="number">{topic.number}</span>{topic.title[language]}</h1>
    {#if understood}
      <Button variant="outline" title={t('learning.understood.undo')} onclick={() => onunderstand(false)}><Icon name="check-circle-fill" />{t('learning.understood')}</Button>
    {:else}
      <Button onclick={understand}><Icon name="check-circle-fill" />{t('learning.understand')}</Button>
    {/if}
  </div>

  <LearningSteps {card} {cards} {steps} {step} bind:depth {theme} {draw} ongo={go}>
    {#snippet foot()}
      <div class="quiet-foot">
        <a class="text-link" href={messages.href}><Icon name="chat-circle-text" /><span>Messages</span>{#if messages.count}<Chip variant="count">{messages.count}</Chip>{/if}</a>
        <span class="meta">{t('learning.source', { number: topic.number })}</span>
      </div>
    {/snippet}
  </LearningSteps>

  <LearningNext {next} ongo={go} />
</div>

<style>
  .flow { display: flex; flex-direction: column; min-height: 100%; }
  .flow > :global(.steps-block) { flex: 1; display: flex; flex-direction: column; }
  .head { display: flex; align-items: center; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
  .head .page-title { flex: 1; min-width: 280px; }
  .number { color: var(--text-muted); font-variant-numeric: tabular-nums; margin-right: 8px; font-weight: var(--weight-regular); }
  .quiet-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; padding: 6px 2px; }
  .text-link { all: unset; font-size: var(--text-small); color: var(--text-secondary); display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
  .text-link:hover span { text-decoration: underline; text-underline-offset: 3px; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import Grid from '@datahub/ui/containers/Grid.svelte';
  import Tile from '@datahub/ui/containers/Tile.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import { asSentence, type Card, type ChartRequest, LEVELS, QUICK, SECTIONS, type Step, STEP_TEXTS, STEPS, type Topic, topicOf } from '../lib/learning.js';
  import { learningPath } from '../lib/routes.js';
  import LearningExample from './LearningExample.svelte';
  import LearningText from './LearningText.svelte';

  /**
   * The page of a Learning Card in five steps (FR-LR-27, DEC-LR-10): Why now, Core idea, See it, Check your
   * understanding and You can now, one at a time, every step but the last ending with "Next". The User chooses
   * the depth: on the quick path See it and Check your understanding stay in the row, muted, and can still be
   * opened. The questions come one at a time and count nothing: the User predicts, then sees the answer and why
   * (FR-LR-30). Whether they understand it, the User says themselves (FR-LR-28). A card without See it or questions
   * yet, a minimal card, shows the steps it has (DEC-LR-23).
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
  /** The steps this card has: a minimal card has no See it and no questions yet. */
  const steps = $derived(STEPS.filter((one) => (one === 'see' ? card.see !== null : one === 'check' ? card.questions.length > 0 : true)));

  // svelte-ignore state_referenced_locally
  let step: Step = $state(steps.includes(start) ? start : 'why');
  let depth: 'quick' | 'full' = $state('full');
  let top: HTMLElement | undefined = $state();

  const offPath = (one: Step) => depth === 'quick' && !QUICK.includes(one);
  /** The step after this one on the chosen path; a step opened off the quick path goes on along it. */
  const next = $derived.by(() => {
    const path = steps.filter((one) => !offPath(one) || one === step);
    return path[path.indexOf(step) + 1];
  });
  const NEXT_TEXTS: Partial<Record<Step, string>> = { core: 'learning.next.core', see: 'learning.next.see', check: 'learning.next.check', can: 'learning.next.can' };

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

  /** The question shown, and the answer the User chose: null until they choose. */
  let asked = $state(0);
  let chosen: number | null = $state(null);
  const question = $derived(card.questions[asked % Math.max(card.questions.length, 1)]);
  function another(): void {
    asked = (asked + 1) % card.questions.length;
    chosen = null;
  }
  const optionIcon = (right: boolean, index: number): IconName =>
    chosen === null ? 'circle' : right ? (chosen === index ? 'check-circle-fill' : 'check-circle') : chosen === index ? 'x-circle-fill' : 'circle';

  const CHOICES = {
    deeper: { icon: 'arrow-down-right', label: 'learning.choice.deeper' },
    next: { icon: 'arrows-left-right', label: 'learning.choice.next' },
    apply: { icon: 'play', label: 'learning.choice.apply' },
  } as const satisfies Record<string, { icon: IconName; label: string }>;
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

  <div class="steps-row">
    <div class="steps" role="tablist" aria-label={t('learning.steps')}>
      {#each steps as one, index (one)}
        {#if index > 0}<span class="arrow" aria-hidden="true"><Icon name="arrow-right" /></span>{/if}
        <button
          type="button"
          class="step"
          class:on={one === step}
          class:done={index < steps.indexOf(step) && !offPath(one)}
          class:muted={offPath(one) && one !== step}
          role="tab"
          aria-selected={one === step}
          onclick={() => go(one)}
        >
          <span class="n">{#if index < steps.indexOf(step) && !offPath(one)}<Icon name="check" />{:else}<b>{index + 1}</b>{/if}</span>
          <span class="name">{t(STEP_TEXTS[one])}</span>
        </button>
      {/each}
    </div>
    <div class="depth" role="group" aria-label={t('learning.depth')}>
      <span class="meta">{t('learning.depth')}</span>
      <button type="button" class="seg" class:on={depth === 'quick'} aria-pressed={depth === 'quick'} title={t('learning.depth.quick.about')} onclick={() => (depth = 'quick')}>{t('learning.depth.quick')}</button>
      <button type="button" class="seg" class:on={depth === 'full'} aria-pressed={depth === 'full'} title={t('learning.depth.full.about')} onclick={() => (depth = 'full')}>{t('learning.depth.full')}</button>
    </div>
  </div>

  <div class="pane" role="tabpanel" aria-label={t(STEP_TEXTS[step])}>
    {#if step === 'why'}
      <blockquote class="quote card">
        <Icon name="quotes-fill" />
        <p><LearningText text={card.why.quote} /></p>
        <footer>{card.why.by}</footer>
      </blockquote>
      <p class="lead"><LearningText text={card.why.situation} /></p>
      <p class="promise"><b>{t('learning.promise')}</b> <LearningText text={card.why.promise} /></p>
    {:else if step === 'core'}
      <p class="rule"><LearningText text={card.core.rule} /></p>
      <div class="two">
        <div class="point card"><h3><Icon name="ticket" />{card.core.metaphor.title}</h3><p><LearningText text={card.core.metaphor.text} /></p></div>
        <div class="point card"><h3><Icon name="calculator" />{card.core.example.title}</h3><p><LearningText text={card.core.example.text} /></p></div>
      </div>
    {:else if step === 'see' && card.see}
      <LearningExample see={card.see} {theme} {draw} />
    {:else if step === 'check' && question}
      <p class="quiz-head">{t('learning.check.head')}</p>
      {#key asked}
        <div class="question card" class:answered={chosen !== null}>
          <div class="question-top">
            {#if question.tryIt}<span class="try"><Icon name="hand-pointing" />{t('learning.check.tryIt')}</span>{/if}
            <span class="meta">{t('learning.check.predict')}</span>
          </div>
          <h2><LearningText text={question.text} /></h2>
          {#if question.tryIt}
            <a class="text-link try-link" href={question.tryIt.href}><span>{question.tryIt.label}</span><Icon name="arrow-square-out" /></a>
          {/if}
          {#each question.options as option, index (index)}
            <button
              type="button"
              class="option"
              class:right={chosen !== null && option.right}
              class:chosen={chosen === index}
              class:wrong={chosen === index && !option.right}
              aria-disabled={chosen !== null}
              onclick={() => chosen === null && (chosen = index)}
            >
              <Icon name={optionIcon(option.right, index)} />
              <span class="option-text"><LearningText text={option.text} /></span>
              {#if chosen !== null && (option.right || chosen === index)}
                <span class="meta">{option.right ? t('learning.check.right') : t('learning.check.yours')}</span>
              {/if}
            </button>
          {/each}
          {#if chosen !== null}
            <p class="why" role="status"><LearningText text={asSentence(question.why)} /></p>
            {#if card.questions.length > 1}
              <div class="question-foot"><Button variant="outline" onclick={another}>{t('learning.check.another')}<Icon name="arrow-right" /></Button></div>
            {/if}
          {/if}
        </div>
      {/key}
    {:else if step === 'can'}
      <div class="can">
        <div class="field cannow card">
          <svg class="cheer" width="96" height="72" viewBox="0 0 96 72" aria-hidden="true">
            <circle class="ring" cx="38" cy="36" r="26" /><circle class="fill" cx="58" cy="36" r="26" />
            <g class="pop"><circle class="seal" cx="58" cy="48" r="11" /><path class="tick" d="M53 48l3.6 3.6 6.4-7.4" /></g>
          </svg>
          <div><div class="label">{t('learning.step.can')}</div><p><LearningText text={card.can.now} /></p></div>
        </div>
        <div class="field card"><div class="label">{t('learning.gain')}</div><p><LearningText text={card.gain} /></p></div>
      </div>
      <div class="section-head"><h2>{t('learning.choices')}</h2><span class="meta">{t('learning.choices.about')}</span></div>
      <Grid fill>
        {#each card.can.choices as choice, index (index)}
          {#if choice.kind === 'apply'}
            <Tile href={choice.href}>
              <div class="choice-kind"><Icon name={CHOICES.apply.icon} />{t(CHOICES.apply.label)}</div>
              <span class="item-title">{choice.label}</span>
              <p class="choice-text"><LearningText text={choice.text} /></p>
            </Tile>
          {:else}
            {@const target = topicOf(choice.card)}
            {@const written = cards.get(choice.card)}
            {#if target && written}
              <Tile href={learningPath(choice.card)}>
                <div class="choice-kind"><Icon name={CHOICES[choice.kind].icon} />{t(CHOICES[choice.kind].label)}</div>
                <span class="item-title"><span class="number">{target.number}</span>{target.title[language]}</span>
                <p class="choice-text"><LearningText text={asSentence(written.can.now)} /></p>
                <span class="meta">{LEVELS.find((one) => one.id === target.level)?.name} · {t('learning.minutes', { minutes: written.minutes })}</span>
              </Tile>
            {/if}
          {/if}
        {/each}
      </Grid>
      <div class="quiet-foot">
        <a class="text-link" href={messages.href}><Icon name="chat-circle-text" /><span>Messages</span>{#if messages.count}<Chip variant="count">{messages.count}</Chip>{/if}</a>
        <span class="meta">{t('learning.source', { number: topic.number })}</span>
      </div>
    {/if}
  </div>

  {#if next}
    <nav class="next" aria-label={t('learning.next')}>
      <div class="next-in">
        <div class="next-text"><b>{t('learning.next.to', { step: t(STEP_TEXTS[next]) })}</b>{t(NEXT_TEXTS[next] ?? 'learning.next.can')}</div>
        <Button onclick={() => go(next)}>{t('learning.next')}<Icon name="arrow-right" /></Button>
      </div>
    </nav>
  {/if}
</div>

<style>
  .flow { display: flex; flex-direction: column; min-height: 100%; }
  .head { display: flex; align-items: center; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
  .head .page-title { flex: 1; min-width: 280px; }
  .number { color: var(--text-muted); font-variant-numeric: tabular-nums; margin-right: 8px; font-weight: var(--weight-regular); }
  .steps-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 18px 0 22px; }
  .steps { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .step { display: inline-flex; align-items: center; gap: 8px; padding: 5px 14px 5px 5px; border: 0; border-radius: var(--radius-pill); background: none; font: var(--text-small) var(--font-family);
    color: var(--text-secondary); cursor: pointer; }
  .step:hover { background: var(--tint-hover); }
  .step:focus-visible { outline: 2px solid var(--text-secondary); }
  .n { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; outline: 1.5px solid var(--tint-active); outline-offset: -1.5px; color: var(--text-secondary); flex: none; }
  .n b { font-weight: var(--weight-medium); }
  .name { line-height: 1; padding-top: 3px; }
  .step.on { color: var(--text-primary); font-weight: var(--weight-medium); background: var(--card); }
  .step.on .n { background: var(--text-primary); color: var(--surface-solid); outline-color: var(--text-primary); }
  .step.done .n { background: color-mix(in srgb, var(--col-teal) 18%, var(--card)); outline-color: var(--col-teal-ink); color: var(--col-teal-ink); }
  .step.muted { opacity: 0.45; }
  .step.muted .n { outline-style: dashed; }
  .arrow { display: inline-flex; font-size: 14px; color: var(--text-muted); }
  .depth { display: inline-flex; align-items: center; gap: 2px; margin-left: auto; padding: 3px; border-radius: var(--radius-pill); background: var(--tint-hover); }
  .depth .meta { padding: 0 6px 0 8px; }
  .seg { border: 0; background: none; padding: 3px 10px; border-radius: var(--radius-pill); font: var(--text-small) var(--font-family); color: var(--text-secondary); cursor: pointer; }
  .seg.on { background: var(--card); color: var(--text-primary); font-weight: var(--weight-medium); }
  .seg:focus-visible { outline: 2px solid var(--text-secondary); }
  .pane { flex: 1; display: grid; gap: 14px; align-content: start; }
  .quote { margin: 0; border-radius: var(--radius-lg); padding: 24px 28px; }
  .quote > :global(.icon) { font-size: 26px; color: var(--col-teal-ink); }
  .quote p { margin: 6px 0 10px; font-size: 22px; line-height: 1.45; font-weight: var(--weight-medium); letter-spacing: -0.2px; }
  .quote footer { font-size: var(--text-meta); color: var(--text-muted); }
  .lead { margin: 2px 0; font-size: 15px; line-height: 1.65; }
  .promise { margin: 0; font-size: 15px; color: var(--text-secondary); }
  .promise b { font-weight: var(--weight-medium); color: var(--text-primary); }
  .rule { margin: 4px 0 6px; font-size: 24px; line-height: 1.45; font-weight: var(--weight-medium); letter-spacing: -0.2px; }
  .two { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
  .point { border-radius: var(--radius-lg); padding: 16px 20px; }
  .point h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font-size: 14px; font-weight: var(--weight-medium); }
  .point h3 :global(.icon) { font-size: 18px; color: var(--text-secondary); }
  .point p { margin: 0; font-size: 14px; line-height: 1.6; }
  .quiz-head { margin: 0; font-size: 13px; color: var(--text-secondary); }
  .question { border-radius: var(--radius-lg); padding: 16px 18px; }
  .question-top { display: flex; align-items: center; gap: 10px; margin-bottom: 2px; }
  .try { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: var(--radius-pill); font-size: var(--text-meta); color: var(--col-teal-ink);
    background: color-mix(in srgb, var(--col-teal) 14%, var(--card)); }
  .question h2 { font-size: 15px; font-weight: var(--weight-medium); margin: 2px 0 10px; line-height: 1.5; }
  .try-link { margin: 0 0 4px; }
  .option { display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 9px 12px; margin-top: 6px; border: 0; border-radius: var(--radius-sm); outline: 1px solid var(--tint-active);
    background: none; font: inherit; font-size: 13.5px; line-height: 1.45; color: inherit; text-align: left; cursor: pointer; }
  .option:hover { background: var(--tint-hover); }
  .option:focus-visible { outline: 2px solid var(--text-secondary); }
  .option > :global(.icon) { font-size: 16px; color: var(--text-muted); margin-top: 1px; flex: none; }
  .option-text { flex: 1; }
  .option .meta { white-space: nowrap; }
  .answered .option { cursor: default; }
  .answered .option:hover { background: none; }
  .option.right { outline: 1.5px solid var(--col-teal-ink); }
  .option.right > :global(.icon) { color: var(--col-teal-ink); }
  .option.chosen.wrong, .answered .option.chosen.wrong:hover { background: var(--tint-hover); }
  .option.chosen.wrong > :global(.icon) { color: var(--text-secondary); }
  .why { margin: 10px 2px 0; font-size: 12.5px; line-height: 1.55; color: var(--text-secondary); }
  .question-foot { display: flex; justify-content: flex-end; margin-top: 12px; }
  .can { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
  .field { border-radius: var(--radius-lg); padding: 18px 22px; }
  .field p { margin: 4px 0 0; font-size: 15px; line-height: 1.6; }
  .cannow { display: flex; align-items: center; gap: 16px; }
  .cannow p { font-size: 19px; line-height: 1.45; font-weight: var(--weight-medium); }
  .cheer { flex: none; display: block; }
  .cheer .ring { fill: none; stroke: var(--col-magenta); stroke-width: 2.5; }
  .cheer .fill { fill: color-mix(in srgb, var(--col-teal) 26%, transparent); }
  .cheer .seal { fill: var(--col-teal-ink); }
  .cheer .tick { fill: none; stroke: var(--surface-solid); stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
  @media (prefers-reduced-motion: no-preference) {
    .cheer .pop { transform-box: fill-box; transform-origin: center; animation: pop var(--motion-cheer) var(--delay-cheer) both; }
    @keyframes pop { from { transform: scale(0.2); opacity: 0; } }
  }
  .section-head { display: flex; align-items: center; gap: 6px; margin: 14px 0 0; }
  .section-head h2 { font-size: var(--text-section); font-weight: var(--weight-medium); flex: 1; margin: 0; }
  .choice-kind { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: var(--text-meta); color: var(--col-teal-ink); }
  .choice-text { margin: 6px 0; font-size: 12.5px; line-height: 1.5; color: var(--text-secondary); }
  .quiet-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; padding: 6px 2px; }
  .text-link { all: unset; font-size: var(--text-small); color: var(--text-secondary); display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
  .text-link:hover span { text-decoration: underline; text-underline-offset: 3px; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
  .next { position: sticky; bottom: -26px; margin: 22px 0 -26px; padding-bottom: 26px; }
  .next-in { display: flex; align-items: center; gap: 12px; padding: 12px 12px 12px 18px; border-radius: var(--radius-lg); background: var(--surface-solid);
    outline: 1px solid var(--tint-hover); }
  .next-text { flex: 1; min-width: 0; font-size: 13px; line-height: 1.45; color: var(--text-secondary); }
  .next-text b { display: block; font-size: 14px; color: var(--text-primary); font-weight: var(--weight-medium); margin-bottom: 1px; }
</style>

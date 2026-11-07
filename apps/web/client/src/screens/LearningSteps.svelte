<script lang="ts">
  import type { Snippet } from 'svelte';
  import Grid from '@datahub/ui/containers/Grid.svelte';
  import Tile from '@datahub/ui/containers/Tile.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import { asSentence, type Card, type ChartRequest, type Depth, LEVELS, offPath, type Step, STEP_TEXTS, topicOf } from '../lib/learning.js';
  import { learningPath } from '../lib/routes.js';
  import LearningExample from './LearningExample.svelte';
  import LearningText from './LearningText.svelte';

  /**
   * The five steps of a Learning Card, the same on its page and in the floating window, each a block that needs
   * nothing around it (Learning steps, DEC-UX-47): the row of steps with the depth, then the step. On the quick
   * path See it and Check your understanding stay in the row, muted, and can still be opened (FR-LR-27). The
   * questions come one at a time and count nothing: the User predicts, then sees the answer and why (FR-LR-30).
   * Compact, in a window, the row shows only the name of the current step, with "I understand it" beside it.
   */
  let {
    card,
    cards,
    steps,
    step,
    depth = $bindable('full'),
    compact = false,
    theme,
    draw,
    ongo,
    understand,
    foot,
  }: {
    /** The card in the language of the User. */
    card: Card;
    /** Every written card in the language of the User, for where to go next. */
    cards: ReadonlyMap<string, Card>;
    steps: readonly Step[];
    step: Step;
    depth?: Depth;
    compact?: boolean;
    theme: 'light' | 'dark';
    draw: (chart: ChartRequest, theme: 'light' | 'dark') => Promise<string | null>;
    ongo: (step: Step) => void;
    /** "I understand it", beside the steps in a window. */
    understand?: Snippet;
    /** The quiet foot of You can now. */
    foot?: Snippet;
  } = $props();

  const language = $derived(currentLanguage());

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

{#snippet depthChoice()}
  <div class="depth" role="group" aria-label={t('learning.depth')}>
    <span class="meta">{t('learning.depth')}</span>
    <button type="button" class="seg" class:on={depth === 'quick'} aria-pressed={depth === 'quick'} title={t('learning.depth.quick.about')} onclick={() => (depth = 'quick')}>{t('learning.depth.quick')}</button>
    <button type="button" class="seg" class:on={depth === 'full'} aria-pressed={depth === 'full'} title={t('learning.depth.full.about')} onclick={() => (depth = 'full')}>{t('learning.depth.full')}</button>
  </div>
{/snippet}

<div class="steps-block" class:compact>
  <div class="steps-row">
    <div class="steps" role="tablist" aria-label={t('learning.steps')}>
      {#each steps as one, index (one)}
        {#if index > 0}<span class="arrow" aria-hidden="true"><Icon name="arrow-right" /></span>{/if}
        <button
          type="button"
          class="step"
          class:on={one === step}
          class:done={index < steps.indexOf(step) && !offPath(one, depth)}
          class:muted={offPath(one, depth) && one !== step}
          role="tab"
          aria-selected={one === step}
          aria-label={compact ? t(STEP_TEXTS[one]) : undefined}
          onclick={() => ongo(one)}
        >
          <span class="n">{#if index < steps.indexOf(step) && !offPath(one, depth)}<Icon name="check" />{:else}<b>{index + 1}</b>{/if}</span>
          <span class="name">{t(STEP_TEXTS[one])}</span>
        </button>
      {/each}
    </div>
    {#if compact}{@render understand?.()}{:else}{@render depthChoice()}{/if}
  </div>
  {#if compact}{@render depthChoice()}{/if}

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
      <LearningExample see={card.see} {theme} {draw} {compact} />
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
      <Grid fill min={compact ? '100%' : undefined}>
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
      {@render foot?.()}
    {/if}
  </div>
</div>

<style>
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
  .number { color: var(--text-muted); font-variant-numeric: tabular-nums; margin-right: 8px; font-weight: var(--weight-regular); }
  .text-link { all: unset; font-size: var(--text-small); color: var(--text-secondary); display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
  .text-link:hover span { text-decoration: underline; text-underline-offset: 3px; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
  /* The same steps, smaller: in the floating window (DEC-UX-47) */
  .compact { --card: var(--surface-sub); display: grid; gap: 10px; }
  .compact .steps-row { margin: 0; flex-wrap: nowrap; }
  .compact .steps { flex-wrap: nowrap; flex: 1; min-width: 0; gap: 2px; }
  .compact .step { padding: 3px; gap: 6px; }
  .compact .step.on { padding-right: 10px; }
  .compact .step:not(.on) .name { display: none; }
  .compact .n { width: 22px; height: 22px; font-size: 11px; }
  .compact .arrow { font-size: 11px; }
  .compact .depth { margin: -4px 0 0; justify-self: start; }
  .compact .seg { font-size: 12px; padding: 2px 8px; }
  .compact .pane { gap: 10px; }
  .compact .lead, .compact .promise { font-size: 13.5px; line-height: 1.6; }
  .compact .quote { padding: 14px 16px; }
  .compact .quote p { font-size: 16px; }
  .compact .rule { font-size: 17px; }
  .compact .two, .compact .can { grid-template-columns: 1fr; gap: 8px; }
  .compact .point { padding: 10px 14px; }
  .compact .point p { font-size: 13px; }
  .compact .question { padding: 12px 14px; }
  .compact .question h2 { font-size: 13.5px; }
  .compact .field { padding: 12px 14px; }
  .compact .cannow p { font-size: 15px; }
  .compact .field p { font-size: 13.5px; }
  .compact .cheer { width: 64px; height: auto; }
</style>

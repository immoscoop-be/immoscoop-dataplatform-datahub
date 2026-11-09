<script lang="ts">
  import Grid from '@datahub/ui/containers/Grid.svelte';
  import Intro from '@datahub/ui/containers/Intro.svelte';
  import Tile from '@datahub/ui/containers/Tile.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago, daysAgo } from '@datahub/ui/foundations/when.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import {
    asSentence,
    type Card,
    continued,
    LEVELS,
    type LevelId,
    newAndChanged,
    type Progress,
    seenOf,
    STEP_TEXTS,
    suggestedCards,
    THINKING_TEXTS,
    type Topic,
    TOPICS,
  } from '../lib/learning.js';
  import { learningPath } from '../lib/routes.js';

  /**
   * The start screen of the Learning Centre (learning-start): the intro, until the User dismisses it; the card to
   * continue where they stopped; the cards suggested for them, of the Learning Levels Data Hub suggests and not
   * understood yet (DEC-LR-27); their path through the Learning Levels, each with the one silent count of the cards
   * seen (FR-LR-32); and the cards new or changed in the last 30 days. A priority shows only as "Suggested", never
   * as required (DEC-LR-18). The search and "How the Levels work" are not drawn yet (OP-UX-47).
   */
  let {
    shown,
    cards,
    progress,
    levels,
    intro,
    ondismiss,
    onshow,
    onlevel,
  }: {
    /** The written cards, by number, in English. */
    shown: ReadonlyMap<string, Card>;
    /** The same cards in the language of the User. */
    cards: ReadonlyMap<string, Card>;
    /** What the User did with the cards; undefined while catalogue has not told it. */
    progress: readonly Progress[] | undefined;
    /** The Learning Levels Data Hub suggests to the User. */
    levels: readonly LevelId[];
    intro: boolean;
    ondismiss: () => void;
    onshow: () => void;
    /** Unfolds a Learning Level in the panel. */
    onlevel: (level: LevelId) => void;
  } = $props();

  const language = $derived(currentLanguage());
  const done = $derived(progress ?? []);
  const last = $derived(continued(shown, done));
  const lastTopic = $derived(last ? TOPICS.find((topic) => topic.number === last.card) : undefined);
  const suggested = $derived(suggestedCards(levels, shown, done).filter((topic) => topic.number !== last?.card));
  const fresh = $derived(newAndChanged(shown));
  /** The first written card of the Compass, where the intro starts. */
  const firstCompass = $derived(TOPICS.find((topic) => topic.level === 'compass' && shown.has(topic.number)));
  const isSuggested = (topic: Topic) => levels.includes(topic.level) && (topic.priority === 'required' || topic.level === 'compass');
  const levelOf = (topic: Topic) => LEVELS.find((level) => level.id === topic.level)!;
  const kindIcon = (topic: Topic): IconName => (topic.level === 'compass' ? 'compass' : topic.level === 'reading' ? 'chart-line' : 'book-open-text');
  const facts = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' · ');
  const thinking = (topic: Topic) => (topic.thinking ? t(THINKING_TEXTS[topic.thinking]) : null);
</script>

{#snippet cardTile(topic: Topic, meta: string)}
  {@const card = cards.get(topic.number) ?? shown.get(topic.number)}
  <Tile href={learningPath(topic.number)}>
    <div class="tile-head">
      <span class="kind"><Icon name={kindIcon(topic)} /></span>
      <span class="item-title"><span class="number">{topic.number}</span>{topic.title[language]}</span>
    </div>
    {#if card}<p class="what">{asSentence(card.can.now)}</p>{/if}
    <div class="foot"><span class="level"><Icon name={levelOf(topic).icon as IconName} /></span><span class="meta">{meta}</span></div>
  </Tile>
{/snippet}

{#if intro}
  <Intro title={t('learning.intro.title')} {ondismiss}>
    {#snippet graphic()}
      <svg class="graphic" width="200" height="96" viewBox="0 0 200 96" aria-hidden="true">
        <rect class="back" x="58" y="22" width="70" height="52" rx="8" transform="rotate(-8 93 48)" />
        <rect class="front" x="72" y="20" width="70" height="52" rx="8" />
        <path class="lines" d="M84 36h40M84 46h46M84 56h28" />
        <circle class="seal" cx="142" cy="70" r="12" />
        <path class="tick" d="M136 70l4 4 8-8" />
        <circle class="dot one" cx="40" cy="34" r="4" /><circle class="dot one" cx="34" cy="62" r="4" /><circle class="dot two" cx="170" cy="30" r="4" />
      </svg>
    {/snippet}
    {t('learning.intro.text')}
    {#snippet actions()}
      {#if firstCompass}<Button variant="outline" href={learningPath(firstCompass.number)}><Icon name="compass" />{t('learning.intro.start')}</Button>{/if}
    {/snippet}
  </Intro>
{:else}
  <div class="bar">
    <h1 class="page-title">Learning Centre</h1>
    <button type="button" class="show" onclick={onshow}><Icon name="info-fill" /><span>{t('learning.intro.show')}</span></button>
  </div>
{/if}

{#if last && lastTopic}
  <div class="section-head"><h2>{t('learning.continue')}</h2><span class="meta">{t('learning.continue.about', { when: ago(last.lastAt, language) })}</span></div>
  <Grid fill>
    {@render cardTile(lastTopic, facts(isSuggested(lastTopic) && t('learning.suggested.one'), thinking(lastTopic), t('learning.stoppedAt', { step: t(STEP_TEXTS[last.step]) })))}
  </Grid>
{/if}

{#if suggested.length}
  <div class="section-head">
    <h2>{t('learning.suggested')}</h2>
    <span class="meta">{t('learning.suggested.about', { levels: LEVELS.filter((level) => levels.includes(level.id)).map((level) => level.name).join(', ') })}</span>
  </div>
  <Grid fill>
    {#each suggested as topic (topic.number)}
      {@render cardTile(topic, facts(t('learning.suggested.one'), thinking(topic), t('learning.minutes', { minutes: shown.get(topic.number)?.minutes ?? 0 })))}
    {/each}
  </Grid>
{/if}

<div class="section-head"><h2>{t('learning.path')}</h2><span class="meta">{t('learning.path.about')}</span></div>
<Grid fill>
  {#each LEVELS.filter((level) => level.id !== 'reading') as level (level.id)}
    {@const counted = seenOf(
      TOPICS.filter((topic) => topic.level === level.id),
      done,
    )}
    <button type="button" class="tile card path" onclick={() => onlevel(level.id)}>
      <div class="tile-head">
        <span class="kind"><Icon name={level.icon as IconName} /></span>
        <span class="item-title">{level.name}</span>
        <span class="meta">{level.step[language]}</span>
      </div>
      <p class="what">{level.about[language]}</p>
      <span class="meta">{t('learning.seen.of', counted)}</span>
      <span class="bar-seen" aria-hidden="true"><span style:width="{counted.of ? Math.round((100 * counted.seen) / counted.of) : 0}%"></span></span>
    </button>
  {/each}
</Grid>

{#if fresh.length}
  <div class="section-head"><h2>{t('learning.new')}</h2></div>
  <Grid fill>
    {#each fresh as { topic, card, added } (topic.number)}
      {@render cardTile(topic, added ? facts(t('learning.new.added'), isSuggested(topic) && t('learning.suggested.one'), thinking(topic)) : t('learning.new.changed', { when: daysAgo(card.changed, language) }))}
    {/each}
  </Grid>
{/if}

<style>
  .graphic .back { fill: var(--col-teal); fill-opacity: 0.14; stroke: var(--text-primary); stroke-width: 1.5; }
  .graphic .front { fill: var(--surface-solid); stroke: var(--text-primary); stroke-width: 1.5; }
  .graphic .lines { stroke: var(--text-secondary); stroke-width: 1.5; stroke-linecap: round; }
  .graphic .seal { fill: var(--col-teal); fill-opacity: 0.25; stroke: var(--col-teal-ink); stroke-width: 1.5; }
  .graphic .tick { fill: none; stroke: var(--col-teal-ink); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .graphic .dot.one { fill: var(--col-magenta); }
  .graphic .dot.two { fill: var(--col-teal-ink); }
  .bar { display: flex; align-items: center; gap: 14px; margin-bottom: 6px; }
  .bar .page-title { flex: 1; font-size: 24px; }
  .show { all: unset; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; font-size: var(--text-small); color: var(--text-secondary); }
  .show:hover span { text-decoration: underline; text-underline-offset: 3px; }
  .show:focus-visible { outline: 2px solid var(--text-secondary); }
  .section-head { display: flex; align-items: center; gap: 6px; margin: 26px 0 12px; }
  .section-head h2 { font-size: var(--text-section); font-weight: var(--weight-medium); flex: 1; margin: 0; }
  .tile-head { display: flex; gap: 10px; align-items: center; min-width: 0; }
  .tile-head .item-title { flex: 1; font-size: 14px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kind { display: inline-flex; font-size: 17px; color: var(--text-secondary); flex: none; }
  .number { color: var(--text-muted); font-variant-numeric: tabular-nums; margin-right: 5px; font-weight: var(--weight-regular); }
  .what { margin: 8px 0 12px; font-size: var(--text-meta); line-height: 1.5; color: var(--text-secondary); }
  .foot { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .level { display: inline-flex; font-size: 15px; color: var(--text-secondary); flex: none; }
  .path { display: block; width: 100%; min-width: 0; border: 0; border-radius: var(--radius-lg); padding: 16px; outline: 1px solid transparent; font: inherit; color: inherit; text-align: left; cursor: pointer; }
  .path:hover { outline-color: var(--tint-active); }
  .path:focus-visible { outline: 2px solid var(--text-secondary); }
  .bar-seen { display: block; height: 4px; border-radius: var(--radius-pill); background: var(--tint-active); overflow: hidden; margin-top: 10px; }
  .bar-seen span { display: block; height: 100%; background: var(--text-secondary); }
</style>

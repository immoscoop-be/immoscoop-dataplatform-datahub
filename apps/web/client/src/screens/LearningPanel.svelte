<script lang="ts">
  import Search from '@datahub/ui/components/Search.svelte';
  import TreeGroup from '@datahub/ui/components/TreeGroup.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { type Card, LEVELS, type LevelId, type Progress, SECTIONS, seenOf, type Topic, TOPICS } from '../lib/learning.js';
  import { learningPath } from '../lib/routes.js';

  /**
   * The panel of the Learning Centre, the index of every Learning Card (FR-LR-03): the Compass, the four Learning
   * Levels from easy to advanced and the Reading Cards, each unfolding to its sections and their cards; on top the
   * one silent count of the cards seen (FR-LR-32, DEC-UX-51). A card to be written is listed, without a page yet.
   * Search covers the numbers and titles of the cards. A Learning Level gets no colour: its icon tells its audience
   * (DEC-UX-62).
   */
  let {
    shown,
    progress,
    current,
    unfold,
  }: {
    /** The written cards, by number. */
    shown: ReadonlyMap<string, Card>;
    progress: readonly Progress[];
    /** The card whose page is open: its Learning Level unfolds. */
    current: string | undefined;
    /** A Learning Level to unfold, asked for by the start screen. */
    unfold?: { id: LevelId } | undefined;
  } = $props();

  const language = $derived(currentLanguage());
  let query = $state('');
  let unfolded: Partial<Record<LevelId, boolean>> = $state({});

  $effect(() => {
    const level = TOPICS.find((topic) => topic.number === current)?.level;
    if (level) unfolded[level] = true;
  });
  $effect(() => {
    if (unfold) unfolded[unfold.id] = true;
  });

  const words = $derived(query.trim().toLowerCase());
  const fits = (topic: Topic) => !words || `${topic.number} ${topic.title[language]} ${topic.title.en}`.toLowerCase().includes(words);
  const understood = $derived(new Set(progress.filter((entry) => entry.understoodAt).map((entry) => entry.card)));
  const total = $derived(seenOf(TOPICS, progress));

  /** The icon of the kind of a card: a book, a compass for one of the Compass, a chart for a Reading Card. */
  const KIND: Record<string, { icon: IconName; label: string }> = {
    compass: { icon: 'compass', label: 'learning.kind.compass' },
    reading: { icon: 'chart-line', label: 'learning.kind.reading' },
  };
  const kindOf = (topic: Topic) => KIND[topic.level] ?? { icon: 'book-open-text' as IconName, label: 'learning.kind.card' };
</script>

<p class="meta count">{t('learning.seen.total', { seen: total.seen, of: total.of })}</p>
<div class="search"><Search bind:value={query} placeholder={t('learning.search')} /></div>

{#each LEVELS as level (level.id)}
  {@const topics = TOPICS.filter((topic) => topic.level === level.id)}
  {@const found = topics.filter(fits)}
  {@const counted = seenOf(topics, progress)}
  {#if found.length > 0}
    <TreeGroup icon={level.icon as IconName} name={level.name} bind:open={() => Boolean(words) || (unfolded[level.id] ?? false), (open) => (unfolded[level.id] = open)}>
      {#snippet meta()}{level.step[language]} · {t('learning.seen.of', counted)}{/snippet}
      {#each SECTIONS.filter((section) => section.level === level.id) as section (section.number)}
        {@const inSection = found.filter((topic) => topic.section === section.number)}
        {#if inSection.length > 0}
          {@const sectionSeen = seenOf(
            topics.filter((topic) => topic.section === section.number),
            progress,
          )}
          {#if level.id !== 'reading'}
            <div class="section"><span>{section.number} {section.title[language]}</span><span title={t('learning.seen.of', sectionSeen)}>{sectionSeen.seen}/{sectionSeen.of}</span></div>
          {/if}
          {#each inSection as topic (topic.number)}
            {@const kind = kindOf(topic)}
            {#if shown.has(topic.number)}
              <a class="entry" class:current={topic.number === current} href={learningPath(topic.number)} aria-current={topic.number === current ? 'page' : undefined}>
                <span class="kind" role="img" aria-label={t(kind.label)}><Icon name={kind.icon} /></span>
                <span class="name"><span class="number">{topic.number}</span>{topic.title[language]}</span>
                {#if understood.has(topic.number)}<span class="done" role="img" aria-label={t('learning.understood')}><Icon name="check-circle-fill" /></span>{/if}
              </a>
            {:else}
              <span class="entry unwritten" title={t('learning.toWrite')}>
                <span class="kind" role="img" aria-label={t(kind.label)}><Icon name={kind.icon} /></span>
                <span class="name"><span class="number">{topic.number}</span>{topic.title[language]}</span>
              </span>
            {/if}
          {/each}
        {/if}
      {/each}
    </TreeGroup>
  {/if}
{/each}

<style>
  .count { margin: 16px 4px 0; }
  .search { margin: 10px 0 12px; }
  .section { display: flex; justify-content: space-between; gap: 8px; padding: 8px 8px 4px 16px; font-size: var(--text-meta); color: var(--text-muted); }
  .entry { display: flex; align-items: center; gap: 8px; padding: 4px 8px 4px 16px; min-height: 26px; border-radius: var(--radius-sm); font-size: var(--text-small); color: var(--text-secondary); text-decoration: none; }
  a.entry:hover { color: var(--text-primary); }
  a.entry:focus-visible { outline: 2px solid var(--text-secondary); }
  .entry.current { color: var(--text-primary); font-weight: var(--weight-medium); }
  .unwritten .name { color: var(--text-muted); opacity: 0.75; }
  .kind { display: inline-flex; font-size: 14px; color: var(--text-muted); flex: none; }
  .current .kind { color: var(--text-primary); }
  .name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .number { color: var(--text-muted); font-variant-numeric: tabular-nums; margin-right: 5px; font-weight: var(--weight-regular); }
  .done { display: inline-flex; font-size: 14px; color: var(--text-secondary); flex: none; }
</style>

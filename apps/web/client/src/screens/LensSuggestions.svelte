<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import type { Collection } from '../lib/catalogue.js';
  import type { LensSuggestion, LensSuggestions, Marked } from '../lib/query.js';
  import { lensPath } from '../lib/routes.js';

  /**
   * The Lenses on the Resources of a query, to reuse before writing one's own (DEC-UX-22): first those on
   * exactly these, then those on these and more; in each group those that share most words with its
   * question first, the shared words marked in their name, question, what they show and tags (DEC-UX-23,
   * DEC-SR-42). Each with its Resources, those beyond the query marked "+", its Collection and maker, and
   * "Use this Lens". No count of use in v1 (OP-SR-21).
   */
  let {
    found,
    resources,
    collections,
  }: {
    /** undefined while query looks them up. */
    found: LensSuggestions | undefined;
    /** The Resources of the query, by ID. */
    resources: readonly string[];
    collections: readonly Collection[] | undefined;
  } = $props();

  const collectionOf = (id: string) => collections?.find((collection) => collection.id === id)?.name ?? '';
  const count = $derived(resources.length);
</script>

{#snippet text(pieces: Marked[] | undefined, plain: string)}
  {#if pieces}{#each pieces as piece, index (index)}{#if piece.shared}<mark>{piece.text}</mark>{:else}{piece.text}{/if}{/each}{:else}{plain}{/if}
{/snippet}

{#snippet card(lens: LensSuggestion, best: boolean)}
  <article class="lens" class:best aria-label={lens.name}>
    <div class="body">
      <div class="title">
        <KindIcon kind="lens" />
        <span class="name">{@render text(lens.marked?.name, lens.name)}</span>
        <MaturityIcon level={lens.level} small />
        {#if best}<span class="pill">{t('lenses.best')}</span>{/if}
      </div>
      {#if lens.question}<p class="question">{@render text(lens.marked?.question, lens.question)}</p>{/if}
      {#if lens.shows}<p class="shows">{@render text(lens.marked?.shows, lens.shows)}</p>{/if}
      <div class="uses">
        {#each lens.resources as resource (resource.id)}
          {@const on = resources.includes(resource.id)}
          <span class="use" class:on><KindIcon kind="resource" />{on ? '' : '+ '}{resource.displayName}</span>
        {/each}
      </div>
      {#if lens.tags.length || lens.shared}
        <div class="tags">
          {#each lens.tags as tag (tag)}<span class="tag" class:hit={lens.sharedTags.includes(tag)}>#{tag}</span>{/each}
          {#if lens.shared}<span class="meta">{t('lenses.shared', { count: lens.shared })}</span>{/if}
        </div>
      {/if}
      <div class="meta foot">{t('lenses.by', { collection: collectionOf(lens.collectionId), name: lens.authorName })}</div>
    </div>
    <Button href={lensPath(lens.id)}>{t('lenses.use')}</Button>
  </article>
{/snippet}

{#if found && found.exact.length + found.more.length === 0}
  <p class="none">{t('query.lenses.none')}</p>
{:else if found}
  <div class="group label">{t('lenses.exact', { count })}<span class="count">{found.exact.length}</span></div>
  {#each found.exact as lens, index (lens.id)}
    {@render card(lens, index === 0 && lens.shared > 0)}
  {:else}
    <p class="meta empty">{t('lenses.exact.none', { count })}</p>
  {/each}
  {#if found.more.length}
    <div class="group label">{t('lenses.more', { count })}<span class="count">{found.more.length}</span></div>
    {#each found.more as lens (lens.id)}
      {@render card(lens, false)}
    {/each}
  {/if}
{:else}
  <p class="meta checking"><Icon name="circle-dashed-fill" />{t('lenses.looking')}</p>
{/if}

<style>
  .none { margin: 14px 0 0; font-size: var(--text-small); color: var(--text-secondary); }
  .group { display: flex; align-items: center; gap: 6px; margin: 16px 0 8px; }
  .count { font-size: 10px; background: var(--tint-hover); padding: 0 6px; border-radius: var(--radius-pill); color: var(--text-secondary); }
  .empty { display: block; margin: 0 0 4px; }
  .checking { display: flex; align-items: center; gap: 6px; margin-top: 14px; }
  .lens { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: center; padding: 14px 16px; border-radius: var(--radius-md); background: var(--surface-sub); margin-bottom: 8px; }
  .best { outline: 1.5px solid var(--text-muted); }
  .title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--text-small); font-weight: var(--weight-medium); color: var(--text-primary); }
  .title :global(.kind) { color: var(--text-muted); }
  .pill { font-size: 10px; font-weight: var(--weight-regular); padding: 2px 7px; border-radius: var(--radius-pill); color: var(--surface-solid); background: var(--text-primary); }
  .question, .shows { font-size: var(--text-small); color: var(--text-secondary); line-height: 1.5; margin: 6px 0 0; }
  .question { color: var(--text-primary); }
  .uses { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .use { display: inline-flex; align-items: center; gap: 5px; font-size: var(--text-meta); padding: 3px 9px; border-radius: var(--radius-pill); color: var(--text-muted); outline: 1px dashed var(--tint-active); }
  .use.on { color: var(--text-primary); background: var(--surface-solid); outline: 1px solid var(--tint-active); }
  .tags { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
  .tag { font-size: var(--text-meta); color: var(--text-muted); }
  .tag.hit { color: var(--text-primary); background: color-mix(in srgb, var(--col-teal) 22%, transparent); border-radius: var(--radius-mark); padding: 0 4px; }
  .foot { display: block; margin-top: 8px; }
  mark { background: color-mix(in srgb, var(--col-teal) 22%, transparent); color: inherit; border-radius: var(--radius-mark); padding: 0 2px; }
</style>

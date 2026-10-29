<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import type { Collection } from '../lib/catalogue.js';
  import type { LensSuggestions } from '../lib/query.js';
  import LensCard from './LensCard.svelte';

  /**
   * The Lenses on the Resources of a query, to reuse before writing one's own (DEC-UX-22): first those on
   * exactly these, then those on these and more; in each group those that share most words with its
   * question first, the shared words marked in their name, question, what they show and tags (DEC-UX-23,
   * DEC-SR-42).
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

{#if found && found.exact.length + found.more.length === 0}
  <p class="none">{t('query.lenses.none')}</p>
{:else if found}
  <div class="group label">{t('lenses.exact', { count })}<span class="count">{found.exact.length}</span></div>
  {#each found.exact as lens, index (lens.id)}
    <LensCard {lens} collection={collectionOf(lens.collectionId)} {resources} best={index === 0 && lens.shared > 0} />
  {:else}
    <p class="meta empty">{t('lenses.exact.none', { count })}</p>
  {/each}
  {#if found.more.length}
    <div class="group label">{t('lenses.more', { count })}<span class="count">{found.more.length}</span></div>
    {#each found.more as lens (lens.id)}
      <LensCard {lens} collection={collectionOf(lens.collectionId)} {resources} />
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
</style>

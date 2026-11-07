<script lang="ts">
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import { brokenText } from '../lib/broken.js';
  import type { LensSuggestion } from '../lib/query.js';
  import { lensPath } from '../lib/routes.js';
  import MarkedText from './MarkedText.svelte';

  /**
   * A Lens offered to reuse (Lens card, DEC-UX-22, DEC-UX-23): its name, question and what it shows with the
   * words it shares with a question marked, its Level, its Resources when they are measured against those of
   * a query, its tags, its Collection and maker, and "Use this Lens". No count of use in v1 (OP-SR-21).
   */
  let {
    lens,
    collection,
    best = false,
    resources = null,
  }: {
    lens: LensSuggestion;
    collection: string;
    best?: boolean;
    /** The Resources of the query, by ID: those of the Lens beyond them are marked "+"; null shows none. */
    resources?: readonly string[] | null;
  } = $props();
</script>

<article class="lens" class:best aria-label={lens.name}>
  <div class="body">
    <div class="title">
      <KindIcon kind="lens" broken={brokenText(lens.broken)} />
      <span class="name"><MarkedText pieces={lens.marked?.name} plain={lens.name} /></span>
      <MaturityIcon level={lens.level} small />
      {#if best}<span class="pill">{t('lenses.best')}</span>{/if}
    </div>
    {#if lens.question}<p class="question"><MarkedText pieces={lens.marked?.question} plain={lens.question} /></p>{/if}
    {#if lens.shows}<p class="shows"><MarkedText pieces={lens.marked?.shows} plain={lens.shows} /></p>{/if}
    {#if resources}
      <div class="uses">
        {#each lens.resources as resource (resource.id)}
          {@const on = resources.includes(resource.id)}
          <span class="use" class:on><KindIcon kind="resource" />{on ? '' : '+ '}{resource.displayName}</span>
        {/each}
      </div>
    {/if}
    {#if lens.tags.length || lens.shared}
      <div class="tags">
        {#each lens.tags as tag (tag)}<span class="tag" class:hit={lens.sharedTags.includes(tag)}>#{tag}</span>{/each}
        {#if lens.shared}<span class="meta">{t('lenses.shared', { count: lens.shared })}</span>{/if}
      </div>
    {/if}
    <div class="meta foot">{t('lenses.by', { collection, name: lens.authorName })}</div>
  </div>
  <Button href={lensPath(lens.id)}>{t('lenses.use')}</Button>
</article>

<style>
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
</style>

<script lang="ts">
  import { renderLog } from '@datahub/contracts/log';
  import Intro from '@datahub/ui/containers/Intro.svelte';
  import Grid from '@datahub/ui/containers/Grid.svelte';
  import Tile from '@datahub/ui/containers/Tile.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago } from '@datahub/ui/foundations/when.js';
  import CollectionIcon from '@datahub/ui/marks/CollectionIcon.svelte';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import Avatar from '@datahub/ui/primitives/Avatar.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import { brokenText } from '../lib/broken.js';
  import type { Collection } from '../lib/catalogue.js';
  import { initialsOf } from '../lib/initials.js';
  import type { LensItem } from '../lib/query.js';
  import { collectionPath, lensPath, NEW_COLLECTION } from '../lib/routes.js';

  /**
   * The start screen of Collections (Start screen per section): the intro, until the User dismisses
   * it; under Yours the Collections of their groups, then the Lenses of the User and their Owner Units,
   * with when they last ran them, a waiting, stopped or Broken one saying so; what changed recently, or
   * was added; and the Lenses published lately in a public Collection (FR-CO-37, DEC-UX-126). It shows
   * what the panel cannot. The search by question comes in part 6d (OP-UX-45).
   */
  let {
    collections,
    lenses,
    groups,
    intro,
    ondismiss,
    onshow,
  }: {
    collections: readonly Collection[] | undefined;
    /** The Lenses the User sees; undefined while query has not told them. */
    lenses: readonly LensItem[] | undefined;
    groups: readonly string[];
    /** Whether the intro shows: the User has not dismissed this version of it. */
    intro: boolean;
    ondismiss: () => void;
    onshow: () => void;
  } = $props();

  /** How many tiles a row of Recently shows at most. */
  const RECENT = 6;

  let recently: 'updated' | 'added' = $state('updated');
  const yours = $derived((collections ?? []).filter((collection) => groups.includes(collection.ownerUnit.id)));
  const updated = $derived(
    (collections ?? [])
      .filter((collection) => collection.lastChange)
      .sort((a, b) => (b.lastChange?.at ?? '').localeCompare(a.lastChange?.at ?? ''))
      .slice(0, RECENT),
  );
  const added = $derived([...(collections ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, RECENT));

  /** How long a Lens is new, and how many new ones show (DEC-UX-126). */
  const NEW_DAYS = 30;
  const collectionOf = (lens: LensItem) => collections?.find((collection) => collection.id === lens.collectionId);
  const ofYours = (lens: LensItem) => {
    const unit = collectionOf(lens)?.ownerUnit.id;
    return unit !== undefined && groups.includes(unit);
  };
  const lensCount = (collection: Collection) => (lenses ?? []).filter((lens) => lens.collectionId === collection.id).length;
  /** The Lenses of the User and their Owner Units, the one they ran last first. */
  const yourLenses = $derived(
    (lenses ?? []).filter((lens) => lens.mine || ofYours(lens)).toSorted((a, b) => (b.lastRunAt ?? b.createdAt).localeCompare(a.lastRunAt ?? a.createdAt)),
  );
  /** Published in the last 30 days in a public Collection, outside the User's own Owner Units, newest first (DEC-UX-126). */
  const newLenses = $derived.by(() => {
    const since = new Date(Date.now() - NEW_DAYS * 86_400_000).toISOString();
    return (lenses ?? [])
      .filter((lens) => lens.state === 'published' && lens.publishedAt !== null && lens.publishedAt >= since && collectionOf(lens)?.visibility === 'public' && !ofYours(lens) && !lens.mine)
      .toSorted((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
      .slice(0, RECENT);
  });
</script>

{#if intro}
  <Intro title={t('collections.intro.title')} {ondismiss}>
    {#snippet graphic()}
      <svg class="graphic" width="200" height="96" viewBox="0 0 200 96" aria-hidden="true">
        <circle class="one" cx="72" cy="48" r="40" /><circle class="two" cx="128" cy="48" r="40" /><circle class="ring" cx="100" cy="48" r="40" />
        <circle class="dot one" cx="52" cy="36" r="4" /><circle class="dot one" cx="64" cy="62" r="4" /><circle class="dot" cx="90" cy="30" r="4" />
        <circle class="dot" cx="104" cy="64" r="4" /><circle class="dot" cx="116" cy="40" r="4" /><circle class="dot two" cx="142" cy="60" r="4" />
        <circle class="dot two" cx="150" cy="34" r="4" />
      </svg>
    {/snippet}
    {t('collections.intro.text')}
    {#snippet actions()}
      <Button href={NEW_COLLECTION}><Icon name="plus-circle-fill" />{t('collections.new')}</Button>
      <Button variant="outline" href="/query"><Icon name="terminal-window-fill" />{t('collections.intro.lens')}</Button>
    {/snippet}
  </Intro>
{:else}
  <div class="bar">
    <h1 class="page-title">Collections</h1>
    <button type="button" class="show" onclick={onshow}><Icon name="info-fill" /><span>{t('collections.intro.show')}</span></button>
    <Button href={NEW_COLLECTION}><Icon name="plus-circle-fill" />{t('collections.new')}</Button>
  </div>
{/if}

<div class="section-head">
  <h2>{t('collections.yours')}</h2>
  <span class="meta">{t('collections.yours.meta')}</span>
</div>
{#snippet lensTile(lens: LensItem, foot: 'yours' | 'new')}
  <Tile href={lensPath(lens.id)}>
    <div class="tile-head"><KindIcon kind="lens" broken={brokenText(lens.broken)} /><span class="item-title">{lens.name}</span></div>
    <p class="question">{lens.question || lens.shows}</p>
    <div class="lens-foot">
      <MaturityIcon level={lens.level} small />
      {#if foot === 'new'}
        <span class="meta">{t('collections.newLenses.by', { time: ago(lens.publishedAt ?? lens.createdAt, currentLanguage()), name: lens.authorName })}</span>
      {:else if lens.state === 'waiting'}
        <Chip><Icon name="hourglass-medium-fill" />{t('collections.lens.waiting')}</Chip>
        {#if lens.mine}<span class="meta">{t('collections.lens.onlyYou')}</span>{/if}
      {:else if lens.broken}
        <Chip variant="broken">{t('status.broken')}</Chip><span class="meta">{t('collections.lens.missing', { name: lens.broken.name })}</span>
      {:else if lens.state === 'stopped'}
        <Chip variant="warn"><Icon name="hourglass-medium-fill" />{t('status.stopped')}</Chip>
      {:else if lens.lastRunAt}
        <span class="meta">{t('collections.lens.ran', { time: ago(lens.lastRunAt, currentLanguage()) })}</span>
      {/if}
    </div>
  </Tile>
{/snippet}

{#if collections && yours.length === 0 && yourLenses.length === 0}
  <p class="meta empty">{t('collections.yours.none')}</p>
{:else}
  <Grid fill>
    {#each yours as collection (collection.id)}
      {@const count = lensCount(collection)}
      <Tile href={collectionPath(collection.id)}>
        <div class="tile-head"><CollectionIcon name={collection.icon} /><span class="item-title">{collection.name}</span></div>
        <p class="what">{count ? t('collections.countWithLenses', { resources: collection.resources.length, lenses: count }) : t('collections.count', { count: collection.resources.length })}</p>
        <span class="meta">{t('collections.ownedBy', { owner: collection.ownerUnit.name })}</span>
      </Tile>
    {/each}
    {#each yourLenses as lens (lens.id)}
      {@render lensTile(lens, 'yours')}
    {/each}
  </Grid>
{/if}

<div class="section-head">
  <h2>{t('collections.recently')}</h2>
  <Segmented
    options={[
      { value: 'updated', label: t('collections.recently.updated') },
      { value: 'added', label: t('collections.recently.added') },
    ]}
    bind:value={recently}
    label={t('collections.recently.label')}
  />
</div>
{#if collections && (recently === 'updated' ? updated : added).length === 0}
  <p class="meta empty">{t('collections.recently.none')}</p>
{:else}
  <Grid fill>
    {#if recently === 'updated'}
      {#each updated as collection (collection.id)}
        {@const change = collection.lastChange!}
        <Tile href={collectionPath(collection.id)}>
          <div class="tile-head"><CollectionIcon name={collection.icon} /><span class="item-title">{collection.name}</span></div>
          <p class="what">{renderLog(change.logId, change.params, currentLanguage())}</p>
          <div class="who"><Avatar size="mini" initials={initialsOf(change.params.actor ?? '')} /><span class="meta">{ago(change.at, currentLanguage())}</span></div>
        </Tile>
      {/each}
    {:else}
      {#each added as collection (collection.id)}
        <Tile href={collectionPath(collection.id)}>
          <div class="tile-head"><CollectionIcon name={collection.icon} /><span class="item-title">{collection.name}</span></div>
          <p class="what">{t('collections.recently.new', { count: collection.resources.length })}</p>
          <div class="who"><Avatar size="mini" initials={initialsOf(collection.createdBy)} /><span class="meta">{ago(collection.createdAt, currentLanguage())}</span></div>
        </Tile>
      {/each}
    {/if}
  </Grid>
{/if}

{#if lenses}
  <div class="section-head">
    <h2>{t('collections.newLenses')}</h2>
    <span class="meta">{t('collections.newLenses.meta')}</span>
  </div>
  {#if newLenses.length === 0}
    <p class="meta empty">{t('collections.newLenses.none')}</p>
  {:else}
    <Grid fill>
      {#each newLenses as lens (lens.id)}
        {@render lensTile(lens, 'new')}
      {/each}
    </Grid>
  {/if}
{/if}

<style>
  .graphic .one { fill: var(--col-magenta); fill-opacity: .14; }
  .graphic .two { fill: var(--col-teal); fill-opacity: .16; }
  .graphic .ring { fill: none; stroke: var(--text-primary); stroke-width: 1.5; }
  .graphic .dot { fill: var(--text-primary); fill-opacity: 1; }
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
  .tile-head .item-title { font-size: 14px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .what { font-size: var(--text-meta); color: var(--text-secondary); margin: 12px 0 10px; line-height: 1.5; }
  .who { display: flex; align-items: center; gap: 6px; }
  .empty { margin: 0; }
  .question { margin: 8px 0 12px; font-size: var(--text-meta); line-height: 1.5; color: var(--text-secondary); }
  .lens-foot { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .tile-head :global(.kind) { font-size: 18px; color: var(--text-muted); }
</style>

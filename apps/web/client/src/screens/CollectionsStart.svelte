<script lang="ts">
  import { renderLog } from '@datahub/contracts/log';
  import Intro from '@datahub/ui/containers/Intro.svelte';
  import Grid from '@datahub/ui/containers/Grid.svelte';
  import Tile from '@datahub/ui/containers/Tile.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago } from '@datahub/ui/foundations/when.js';
  import CollectionIcon from '@datahub/ui/marks/CollectionIcon.svelte';
  import Avatar from '@datahub/ui/primitives/Avatar.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import type { Collection } from '../lib/catalogue.js';
  import { initialsOf } from '../lib/initials.js';
  import { collectionPath, NEW_COLLECTION } from '../lib/routes.js';

  /**
   * The start screen of Collections (Start screen per section): the intro, until the User dismisses
   * it; the Collections of their groups; and what changed recently, or was added. It shows what the
   * panel cannot. The search by question and the Lenses come with their parts (FR-CO-37).
   */
  let {
    collections,
    groups,
    intro,
    ondismiss,
    onshow,
  }: {
    collections: readonly Collection[] | undefined;
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
{#if collections && yours.length === 0}
  <p class="meta empty">{t('collections.yours.none')}</p>
{:else}
  <Grid fill>
    {#each yours as collection (collection.id)}
      <Tile href={collectionPath(collection.id)}>
        <div class="tile-head"><CollectionIcon name={collection.icon} /><span class="item-title">{collection.name}</span></div>
        <p class="what">{t('collections.count', { count: collection.resources.length })}</p>
        <span class="meta">{t('collections.ownedBy', { owner: collection.ownerUnit.name })}</span>
      </Tile>
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
</style>

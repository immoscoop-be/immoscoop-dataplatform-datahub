<script lang="ts">
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import Search from '@datahub/ui/components/Search.svelte';
  import Table from '@datahub/ui/containers/Table.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { levelName } from '@datahub/ui/foundations/levels.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago, day } from '@datahub/ui/foundations/when.js';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import type { Catalogue, WithdrawnResource } from '../lib/catalogue.js';
  import { resourcePath } from '../lib/routes.js';
  import { rowOf } from '../lib/rows.js';

  /**
   * Withdrawn, a tool of Admin (FR-SR-55, DEC-UX-213): every Resource that dbt withdrew, the newest first, also those
   * without a Collection, which show in no other list (DEC-SR-45). Each with its Display Name and Key, its dbt project,
   * its Collection or "Without a Collection", its Level, and when and in which run it was withdrawn. A search on a name
   * or a Key, and a filter: all, those in a Collection, or those without one. A whole row opens the Resource.
   */
  let {
    catalogue,
    environment,
    go,
    oncount,
  }: {
    catalogue: Pick<Catalogue, 'withdrawn'>;
    /** The environment of Data Hub, such as uat. */
    environment: string;
    go: (path: string) => void;
    /** How many are withdrawn, for the panel of Admin. */
    oncount?: (count: number) => void;
  } = $props();

  type Shown = 'all' | 'inCollection' | 'without';

  let resources: WithdrawnResource[] | null | undefined = $state();
  let shown: Shown = $state('all');
  let search = $state('');

  $effect(() => {
    catalogue.withdrawn().then(
      (found) => {
        resources = found;
        oncount?.(found.length);
      },
      (error: unknown) => {
        console.error('The withdrawn Resources could not be read', error);
        resources = null;
      },
    );
  });

  const of = (wanted: Shown) => (resource: WithdrawnResource) =>
    wanted === 'all' || (wanted === 'inCollection' ? resource.collection !== null : resource.collection === null);
  const count = (wanted: Shown) => (resources ?? []).filter(of(wanted)).length;
  const words = $derived(search.trim().toLowerCase());
  const listed = $derived(
    (resources ?? []).filter(of(shown)).filter((resource) => !words || [resource.displayName, resource.key].some((text) => text.toLowerCase().includes(words))),
  );
  /** Within a day, how long ago; else the day. */
  const when = (at: string) => (Date.now() - new Date(at).getTime() < 24 * 60 * 60 * 1000 ? ago(at, currentLanguage()) : day(at, currentLanguage()));
</script>

<Breadcrumb steps={[{ label: 'Admin' }]} />
<div class="head">
  <div class="what">
    <h1 class="page-title">Withdrawn</h1>
    <p class="meta lead">{t('admin.withdrawn.lead', { environment })}</p>
  </div>
  <Chip><Icon name="cloud-fill" />Data Hub {environment}</Chip>
</div>

{#if resources === null}
  <p class="meta problem" role="alert">{t('admin.withdrawn.failed')}</p>
{:else if resources && resources.length === 0}
  <p class="meta empty">{t('admin.withdrawn.none', { environment })}</p>
{:else if resources}
  <div class="tools">
    <div class="find"><Search bind:value={search} placeholder={t('admin.withdrawn.search')} surface="solid" /></div>
    <Segmented
      options={[
        { value: 'all', label: `${t('admin.withdrawn.all')} ${count('all')}` },
        { value: 'inCollection', label: `${t('admin.withdrawn.inCollection')} ${count('inCollection')}` },
        { value: 'without', label: `${t('collections.unassigned')} ${count('without')}` },
      ]}
      value={shown}
      onchange={(value) => (shown = value)}
      label={t('admin.withdrawn.which')}
    />
  </div>
  <Table label="Withdrawn">
    {#snippet head()}
      <tr>
        <th>Resource</th>
        <th>{t('admin.withdrawn.column.project')}</th>
        <th>Collection</th>
        <th>Level</th>
        <th>{t('admin.withdrawn.column.when')}</th>
      </tr>
    {/snippet}
    {#each listed as resource (resource.id)}
      <tr class="row" {...rowOf(resourcePath(resource.id), go)}>
        <td>
          <span class="name">
            <KindIcon kind="resource" />
            <span class="clip">{resource.displayName}<span class="meta key" title={resource.key}>{resource.key}</span></span>
          </span>
        </td>
        <td class="muted">{resource.project}</td>
        <td>
          {#if resource.collection}<span class="collection"><Icon name="stack" />{resource.collection.name}</span>
          {:else}<span class="muted">{t('collections.unassigned')}</span>{/if}
        </td>
        <td><span class="level"><MaturityIcon level={resource.level} tooltip={false} />{levelName(resource.level)}</span></td>
        <td class="nowrap">
          {when(resource.withdrawnAt)}
          {#if resource.run}<span class="meta run">{t('admin.withdrawn.run', { run: resource.run })}</span>{/if}
        </td>
      </tr>
    {:else}
      <tr><td colspan="5" class="muted none">{t('admin.withdrawn.noMatch')}</td></tr>
    {/each}
    {#snippet after()}<p class="meta foot">{t('admin.withdrawn.foot')}</p>{/snippet}
  </Table>
{:else}
  <Loading />
{/if}

<style>
  .head { display: flex; align-items: flex-end; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
  .what { flex: 1; min-width: 280px; }
  .lead { display: block; margin-top: 4px; line-height: 1.5; max-width: 720px; }
  .tools { display: flex; align-items: center; gap: 10px; margin: 18px 0 12px; flex-wrap: wrap; }
  .find { flex: 1; max-width: 420px; min-width: 220px; }
  .problem, .empty { display: block; margin: 18px 0; }
  .name { display: inline-flex; align-items: flex-start; gap: 8px; font-weight: var(--weight-medium); min-width: 0; }
  .clip { min-width: 0; }
  .key { display: block; font-family: var(--font-mono); font-weight: var(--weight-regular); overflow-wrap: anywhere; }
  .collection { display: inline-flex; align-items: center; gap: 6px; }
  .collection :global(.icon) { color: var(--text-muted); }
  .level { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
  .muted { color: var(--text-muted); }
  .nowrap { white-space: nowrap; }
  .run { display: block; }
  .none { padding: 14px 10px; }
  .foot { display: block; padding: 8px 10px 2px; line-height: 1.5; }
</style>

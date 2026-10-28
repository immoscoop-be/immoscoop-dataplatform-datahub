<script lang="ts">
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import LogList from '@datahub/ui/components/LogList.svelte';
  import MaturityLadder from '@datahub/ui/components/MaturityLadder.svelte';
  import ObjectHeader from '@datahub/ui/components/ObjectHeader.svelte';
  import StatusRow from '@datahub/ui/components/StatusRow.svelte';
  import Callout from '@datahub/ui/containers/Callout.svelte';
  import Grid from '@datahub/ui/containers/Grid.svelte';
  import SubTile from '@datahub/ui/containers/SubTile.svelte';
  import Tabs from '@datahub/ui/containers/Tabs.svelte';
  import { levelName } from '@datahub/ui/foundations/levels.js';
  import Sentence from '@datahub/ui/foundations/Sentence.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import OriginTag from '@datahub/ui/marks/OriginTag.svelte';
  import type { LogEntry, ResourceDetail } from '../lib/catalogue.js';

  /**
   * The page of a Resource that waits for a Collection, as the Data Team sees it (A Resource without a
   * Collection): it says that it is in no Collection, that only the Data Team sees it, and where it
   * came from. Its Overview shows what exists already: the description from dbt and the maturity,
   * with its recent history. The other tabs, the rest of the Overview and "Add to a collection" come
   * with parts 3 and 4.
   */
  let { resource, log }: { resource: ResourceDetail; log: readonly LogEntry[] | undefined } = $props();

  // The tabs of a Resource (DEC-UX-90).
  const TABS = [
    { id: 'overview', label: 'resource.tab.overview' },
    { id: 'columns', label: 'resource.tab.columns' },
    { id: 'lineage', label: 'resource.tab.lineage' },
    { id: 'history', label: 'resource.tab.history' },
    { id: 'preview', label: 'resource.tab.preview' },
  ] as const;
  let tab: string = $state('overview');

  const LOCALES = { nl: 'nl-BE', en: 'en-GB' } as const;
  const came = $derived(new Intl.DateTimeFormat(LOCALES[currentLanguage()], { day: 'numeric', month: 'short' }).format(new Date(resource.registeredAt)));
  const undescribed = $derived(resource.fields.filter((field) => field.description.trim() === '').length);
</script>

<Breadcrumb steps={[{ label: 'Collections', href: '/collections' }, { label: t('collections.unassigned') }]} />
<ObjectHeader name={resource.displayName} key={resource.key} copyLabel={t('resource.copyKey')}>
  <StatusRow level={resource.level} published={false} owner={null} />
</ObjectHeader>

{#if resource.collectionId === null}
  <Callout icon="tray-fill">
    <b>{t('resource.waiting.title')}</b>
    <Sentence
      key="resource.waiting.text"
      values={{ date: came }}
      names={{ exposure: resource.exposures[0] ?? '', project: resource.projectName ?? resource.projectId }}
    />
  </Callout>
{/if}

<Tabs label={resource.displayName} current={tab} tabs={TABS.map(({ id, label }) => ({ id, label: t(label) }))} onselect={(id) => (tab = id)}>
  {#if tab === 'overview'}
    <Grid min="var(--tile-min)" tight>
      <SubTile label={t('resource.description')} span="all">
        {#snippet aside()}<OriginTag origin="dbt" />{/snippet}
        {#if resource.description.trim()}
          <p class="prose">{resource.description}</p>
        {:else}
          <p class="empty">{t('resource.noDescription')}</p>
        {/if}
      </SubTile>
      <SubTile label={t('resource.maturity')}>
        <MaturityLadder level={resource.level} />
        <div class="level">{levelName(resource.level)}</div>
        <div class="meta">{t('resource.undescribed', { undescribed, count: resource.fields.length })}</div>
      </SubTile>
      <SubTile label={t('resource.history')} span={2}>
        {#if log}<LogList entries={log.slice(0, 5)} />{/if}
      </SubTile>
    </Grid>
  {:else}
    <p class="meta soon">{t('resource.soon')}</p>
  {/if}
</Tabs>

<style>
  b { font-weight: var(--weight-medium); }
  .prose { margin: 0; line-height: 1.65; color: var(--text-primary); }
  .empty { margin: 0; font-size: var(--text-small); color: var(--text-muted); line-height: 1.5; }
  .level { font-size: 14px; font-weight: var(--weight-medium); margin-top: 6px; }
  .meta { display: block; }
  .soon { display: flex; justify-content: center; padding: 40px; font-size: var(--text-body); margin: 0; }
</style>

<script lang="ts">
  import Table from '@datahub/ui/containers/Table.svelte';
  import { formatBytes } from '@datahub/ui/foundations/bytes.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import type { ResourceDetail } from '../lib/catalogue.js';
  import { brokenText } from '../lib/broken.js';
  import { when } from '../lib/moment.js';
  import type { QueryClient, QueryOnResource } from '../lib/query.js';
  import { lensPath, newQueryPath, queryPath } from '../lib/routes.js';

  /**
   * The tab History of a Resource (resource-history, DEC-UX-90): every query that used it, one row per
   * query, a Lens, a query or the previews of a User, with who made it, how many runs, its last run and what
   * that read; a row opens it, with its SQL. On top, the numbers of the last 30 days and "Query this
   * resource". Only its Owner Unit and the Data Team see it (DEC-SR-41, FR-SR-44).
   */
  let { resource, client }: { resource: ResourceDetail; client: QueryClient } = $props();

  let found = $state<{ summary: { queries: number; lenses: number; colleagues: number }; queries: QueryOnResource[] } | undefined>();
  let failed = $state(false);

  $effect(() => {
    const id = resource.id;
    found = undefined;
    failed = false;
    client.onResource(id).then(
      (answer) => resource.id === id && (found = answer),
      (error: unknown) => {
        failed = true;
        console.error(`The queries on ${resource.displayName} could not be read`, error);
      },
    );
  });

  const language = $derived(currentLanguage());
  const KINDS = { query: 'resource.history.kind.query', preview: 'resource.history.kind.preview', lens: 'resource.history.kind.lens' } as const;
</script>

{#if failed}
  <p class="meta">{t('query.runFailed')}</p>
{:else if found}
  <div class="numbers">
    <span class="number">{t('resource.history.queries', { count: found.summary.queries })}</span>
    <span class="number">{t('resource.history.lenses', { count: found.summary.lenses })}</span>
    <span class="number">{t('resource.history.colleagues', { count: found.summary.colleagues })}</span>
    <span class="grow"></span>
    <Button variant="outline" href={newQueryPath(resource.id)}><Icon name="terminal-window-fill" />{t('preview.query')}</Button>
  </div>
  {#if found.queries.length === 0}
    <p class="none">{t('resource.history.none')}</p>
  {:else}
    <Table label={t('resource.tab.history')}>
      {#snippet head()}
        <tr>
          <th>{t('resource.history.query')}</th>
          <th>{t('resource.history.kind')}</th>
          <th>{t('resource.history.owner')}</th>
          <th class="number-cell">{t('resource.history.runs')}</th>
          <th>{t('resource.history.last')}</th>
          <th class="number-cell">{t('resource.history.read')}</th>
        </tr>
      {/snippet}
      {#each found.queries as query (query.id)}
        <tr>
          <td>
            <a class="name" href={query.kind === 'lens' ? lensPath(query.id) : queryPath(query.id)}><KindIcon kind={query.kind === 'lens' ? 'lens' : 'resource'} broken={brokenText(query.broken ?? null)} />{query.name}</a>
          </td>
          <td>{t(KINDS[query.kind])}</td>
          <td>{query.mine ? t('resource.history.you') : query.ownerName}</td>
          <td class="number-cell">{query.runs}</td>
          <td>{query.lastRunAt ? when(query.lastRunAt, language) : ''}</td>
          <td class="number-cell">{query.lastState === 'failed' ? t('history.failed') : query.lastRead !== null ? formatBytes(query.lastRead, language) : formatBytes(query.lastEstimate, language)}</td>
        </tr>
      {/each}
    </Table>
  {/if}
  <p class="meta intro">{t('resource.history.intro')}</p>
{/if}

<style>
  .numbers { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
  .number { font-size: var(--text-small); color: var(--text-secondary); background: var(--surface-sub); padding: 6px 12px; border-radius: var(--radius-pill); }
  .grow { flex: 1; }
  .name { display: inline-flex; align-items: center; gap: 7px; color: var(--text-primary); text-decoration: none; font-weight: var(--weight-medium); }
  .name:hover { text-decoration: underline; text-underline-offset: 3px; }
  .number-cell { text-align: right; }
  .none { margin: 0; padding: 22px; border-radius: var(--radius-md); background: var(--surface-sub); font-size: var(--text-small); }
  .intro { display: block; margin: 10px 2px 0; line-height: 1.5; }
</style>

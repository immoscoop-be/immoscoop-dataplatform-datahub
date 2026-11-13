<script module lang="ts">
  import type { LogEntry, Related, ResourceDetail } from '../lib/catalogue.js';
  import type { Conversation } from '../lib/messages.js';
  import type { Storage } from '../lib/query.js';

  /** What the Summary of a Resource is made of, as its page reads it (TR-SR-26). */
  export interface SummaryData {
    resource: ResourceDetail;
    related: readonly Related[] | undefined;
    threads: readonly Conversation[] | undefined;
    log: readonly LogEntry[] | undefined;
    storage: Storage | null;
  }
</script>

<script lang="ts">
  import type { TableSuggestion } from '@datahub/ui/components/SqlEditor.svelte';
  import FloatingWindow from '@datahub/ui/containers/FloatingWindow.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import { messagesOnPath, resourcePath } from '../lib/routes.js';
  import { sizeText } from '../lib/size.js';
  import OverviewSummary from './OverviewSummary.svelte';

  /**
   * The Summary of a Resource named in the SQL of a query, in a floating window over it (DEC-UX-221, OP-UX-79): the
   * same parts in the same order as on its page, each with its weight, and "Open the Resource". The query stays as it
   * is, in view and usable behind it.
   */
  let {
    table,
    load,
    onclose,
  }: {
    /** The Resource as the editor names it: one of the query, or another the User may use. */
    table: TableSuggestion;
    load: (id: string) => Promise<SummaryData>;
    onclose: () => void;
  } = $props();

  let data = $state<SummaryData | null | undefined>();
  $effect(() => {
    const id = table.id;
    data = undefined;
    load(id).then(
      (found) => table.id === id && (data = found),
      (error: unknown) => {
        console.error(`The Summary of ${table.name} could not be read`, error);
        if (table.id === id) data = null;
      },
    );
  });
</script>

<FloatingWindow title={table.name} meta={t(table.other ? 'summary.window.other' : 'summary.window.of')} icon="table" wide {onclose}>
  <div class="body">
    <p class="lead">{t('summary.window.lead')}</p>
    {#if data === undefined}
      <Loading />
    {:else if data === null}
      <p class="lead">{t('summary.window.failed')}</p>
    {:else}
      <OverviewSummary
        resource={data.resource}
        related={data.related}
        threads={data.threads}
        log={data.log}
        size={sizeText(data.storage, data.resource.details.partition?.unit)}
        messagesHref={messagesOnPath({ kind: 'resource', id: table.id })}
        compact
      />
    {/if}
  </div>
  {#snippet foot()}
    <span class="stays">{t('summary.window.stays')}</span>
    <Button href={resourcePath(table.id)}><Icon name="arrow-square-out" />{t('summary.window.open')}</Button>
  {/snippet}
</FloatingWindow>

<style>
  .body { display: grid; gap: 10px; padding-top: 4px; }
  .lead { margin: 0; font-size: var(--text-meta); color: var(--text-muted); }
  .stays { flex: 1; font-size: var(--text-meta); color: var(--text-muted); }
</style>

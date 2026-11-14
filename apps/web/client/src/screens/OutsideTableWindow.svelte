<script lang="ts">
  import type { TableSuggestion } from '@datahub/ui/components/SqlEditor.svelte';
  import FloatingWindow from '@datahub/ui/containers/FloatingWindow.svelte';
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import { formatBytes } from '@datahub/ui/foundations/bytes.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import OriginTag from '@datahub/ui/marks/OriginTag.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import { when } from '../lib/moment.js';
  import type { OutsideTableInfo } from '../lib/query.js';

  /**
   * A table outside Data Hub named in the SQL of a power user's query, in a floating window over it (FR-SR-62,
   * DEC-UX-247): its description, layer and project from dbt; what BigQuery says of it now, its kind, partitioning,
   * cluster columns, size and last change; and its columns, partition and cluster columns first, each with its type and
   * description. It has no page in Data Hub: its full name is to copy (OP-UX-90). The query stays as it is behind it.
   */
  let {
    table,
    load,
    onclose,
  }: {
    /** The table as the editor names it: `id` is its Key. */
    table: TableSuggestion;
    load: (key: string) => Promise<OutsideTableInfo>;
    onclose: () => void;
  } = $props();

  let info = $state<OutsideTableInfo | null | undefined>();
  $effect(() => {
    const key = table.id;
    info = undefined;
    load(key).then(
      (found) => table.id === key && (info = found),
      (error: unknown) => {
        console.error(`What Data Hub knows of ${table.name} could not be read`, error);
        if (table.id === key) info = null;
      },
    );
  });

  const language = $derived(currentLanguage());
  const count = (value: number) => new Intl.NumberFormat(language === 'nl' ? 'nl-BE' : 'en-GB').format(value);
  const KINDS: Record<string, string> = {
    TABLE: 'outside.window.kind.TABLE',
    VIEW: 'outside.window.kind.VIEW',
    MATERIALIZED_VIEW: 'outside.window.kind.MATERIALIZED_VIEW',
    EXTERNAL: 'outside.window.kind.EXTERNAL',
    SNAPSHOT: 'outside.window.kind.SNAPSHOT',
  };
  const UNITS: Record<string, string> = { hour: 'grain.unit.hour', day: 'grain.unit.day', month: 'grain.unit.month', year: 'grain.unit.year', range: 'grain.unit.range' };

  const view = $derived(info?.bigquery?.type === 'VIEW');
  const kind = $derived.by(() => {
    if (!info) return '';
    const type = info.bigquery?.type;
    // A kind BigQuery may add later is shown as it names it.
    const name = type ? (type in KINDS ? t(KINDS[type]!) : type) : '';
    const made = info.materialized ? t('outside.window.made', { materialized: info.materialized }) : '';
    return [name, made, view ? t('outside.window.view') : ''].filter(Boolean).join(' · ');
  });
  const partitioned = $derived.by(() => {
    if (!info) return '';
    if (!info.partition) return t(view ? 'outside.window.viewPartition' : 'outside.window.noPartition');
    const unit = info.partition.unit && UNITS[info.partition.unit] ? t(UNITS[info.partition.unit]!) : null;
    return unit ? t('outside.window.unit', { field: info.partition.field, unit }) : info.partition.field;
  });
  const size = $derived.by(() => {
    const live = info?.bigquery;
    if (!live || live.bytes === null || view) return null;
    const bytes = formatBytes(live.bytes, language);
    const rows = count(live.rows ?? 0);
    return live.partitions ? t('outside.window.sizeLine', { bytes, rows, partitions: count(live.partitions) }) : t('outside.window.sizeNoPartitions', { bytes, rows });
  });

  let words = $state('');
  const shown = $derived.by(() => {
    const columns = info?.columns ?? [];
    const asked = words.trim().toLowerCase();
    return asked ? columns.filter((column) => `${column.name} ${column.description}`.toLowerCase().includes(asked)) : columns;
  });
  const top = $derived((info?.columns ?? []).filter((column) => !column.name.includes('.')).length);

  let copied = $state(false);
  async function copy(): Promise<void> {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.fullName);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch (error) {
      // A browser that refuses the clipboard leaves the full name to be selected in the window.
      console.error('The full name could not be copied', error);
    }
  }
</script>

<FloatingWindow
  title={table.name}
  meta={info ? [t('outside.window.notResource'), info.layer, info.projectName].filter(Boolean).join(' · ') : t('outside.window.notResource')}
  icon="cube"
  wide
  {onclose}
>
  <div class="body">
    <p class="lead">{t('outside.window.lead')}</p>
    {#if info === undefined}
      <Loading />
    {:else if info === null}
      <p class="lead">{t('outside.window.failed')}</p>
    {:else}
      <p class="desc"><OriginTag origin="dbt" /><span class:none={!info.description}>{info.description || t('outside.window.noDescription')}</span></p>
      <div class="facts">
        <span class="from">{info.bigquery ? t('outside.window.bigquery') : t('outside.window.dbtOnly')}</span>
        <dl>
          {#if kind}<dt>{t('outside.window.kind')}</dt><dd>{kind}</dd>{/if}
          <dt>{t('outside.window.partitioned')}</dt>
          <dd>{partitioned}{info.partition?.required ? ` · ${t('outside.window.required')}` : ''}</dd>
          {#if info.clusterBy.length > 0}<dt>{t('outside.window.clustered')}</dt><dd class="mono">{info.clusterBy.join(', ')}</dd>{/if}
          {#if size}<dt>{t('outside.window.size')}</dt><dd>{size}</dd>{/if}
          {#if info.bigquery?.modifiedAt}<dt>{t('outside.window.changed')}</dt><dd>{when(info.bigquery.modifiedAt, language)}</dd>{/if}
          <dt>{t('outside.window.fullName')}</dt><dd class="mono full">{info.fullName}</dd>
        </dl>
      </div>
      <div class="columns-head">
        <span class="label">{t('outside.window.columns')}</span><span class="count">{top}</span>
        <input {...NO_PASSWORD_MANAGER} type="search" class="filter" bind:value={words} placeholder={t('outside.window.filter')} aria-label={t('outside.window.filter')} />
      </div>
      <div class="columns">
        {#each shown as column (column.name)}
          <div class="column" class:nested={column.name.includes('.')}>
            <span
              ><span class="mono">{column.name}</span
              >{#if column.partition}<span class="pill">{t('editor.partition')}</span>{:else if column.cluster !== null}<span class="pill"
                  >{t('editor.cluster', { place: String(column.cluster) })}</span
                >{/if}</span
            >
            <span class="type">{column.type ?? ''}</span>
            <span class="text" class:none={!column.description}
              >{column.description || t('outside.window.noColumnDescription')}{#if column.from === 'bigquery'}<span class="tag">{t('outside.window.fromBigQuery')}</span>{/if}</span
            >
          </div>
        {:else}
          <p class="lead">{t('outside.window.noMatch')}</p>
        {/each}
      </div>
      <p class="lead note">{t(info.bigquery ? 'outside.window.note' : 'outside.window.noteDbt')}</p>
    {/if}
  </div>
  {#snippet foot()}
    <span class="stays">{t('summary.window.stays')}</span>
    <Button variant="outline" onclick={copy}><Icon name="copy-fill" />{t(copied ? 'outside.window.copied' : 'outside.window.copy')}</Button>
  {/snippet}
</FloatingWindow>

<style>
  .body { display: grid; gap: 12px; padding-top: 4px; }
  .lead { margin: 0; font-size: var(--text-meta); color: var(--text-muted); }
  .desc { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; margin: 0; font-size: var(--text-small); line-height: 1.5; }
  .none { color: var(--text-muted); font-style: italic; }
  .facts { padding: 10px 12px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .from { display: inline-block; font-size: 10px; color: var(--text-muted); background: var(--card); padding: 1px 8px; border-radius: var(--radius-pill); margin-bottom: 6px; }
  dl { margin: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px 14px; font-size: var(--text-meta); line-height: 1.5; }
  dt { color: var(--text-muted); }
  dd { margin: 0; }
  .mono { font-family: var(--font-mono); }
  .full { overflow-wrap: anywhere; }
  .columns-head { display: flex; align-items: center; gap: 8px; }
  .label { font-size: var(--text-meta); color: var(--text-muted); }
  .count { font-size: 10px; background: var(--tint-hover); padding: 0 6px; border-radius: var(--radius-pill); }
  .filter { margin-left: auto; width: 180px; box-sizing: border-box; font: var(--text-meta) var(--font-family); color: var(--text-primary); background: var(--surface-sub); border: 0;
    border-radius: var(--radius-field); padding: 5px 10px; }
  .filter:focus-visible { outline: 2px solid var(--text-secondary); }
  /* One grid for every column, so that types and descriptions line up. */
  .columns { display: grid; grid-template-columns: minmax(130px, max-content) minmax(64px, max-content) minmax(0, 1fr); gap: 3px 10px; align-items: baseline; font-size: var(--text-meta); }
  .columns > .lead { grid-column: 1 / -1; }
  .column { display: contents; }
  .column .mono { color: var(--text-primary); }
  .column.nested .mono { padding-left: 14px; color: var(--text-secondary); }
  .type { color: var(--text-muted); }
  .text { color: var(--text-secondary); }
  .pill { margin-left: 6px; font-size: 10px; background: var(--tint-active); padding: 1px 7px; border-radius: var(--radius-pill); }
  .tag { margin-left: 4px; font-size: 10px; color: var(--text-muted); border: 1px solid var(--tint-active); padding: 0 6px; border-radius: var(--radius-pill); }
  .note { margin-top: -2px; }
  .stays { flex: 1; font-size: var(--text-meta); color: var(--text-muted); }
</style>

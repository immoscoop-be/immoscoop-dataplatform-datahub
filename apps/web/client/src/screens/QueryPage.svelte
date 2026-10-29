<script lang="ts">
  import DataGrid from '@datahub/ui/components/DataGrid.svelte';
  import Pager from '@datahub/ui/components/Pager.svelte';
  import RunButton from '@datahub/ui/components/RunButton.svelte';
  import SqlEditor, { CTE_LINE, type ErrorMark, type Suggestion } from '@datahub/ui/components/SqlEditor.svelte';
  import { formatBytes } from '@datahub/ui/foundations/bytes.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago } from '@datahub/ui/foundations/when.js';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import CopyButton from '@datahub/ui/primitives/CopyButton.svelte';
  import Gauge from '@datahub/ui/primitives/Gauge.svelte';
  import { NotFound as Missing } from '../lib/api.js';
  import type { Collection } from '../lib/catalogue.js';
  import type { Page, Preflight, Problem, Query, QueryClient, Run, Warning } from '../lib/query.js';
  import { NEW_QUERY, resourcePath } from '../lib/routes.js';
  import NotFound from './NotFound.svelte';

  /**
   * A query (query, DEC-UX-70 to DEC-UX-73): its name and question; on top of its frame "Reads only" and
   * its Resources; the SQL in an editor at the full width, in a box that folds; at the foot of the frame,
   * staying in view, the Pre-flight and Run; under it the result, a grid of 100 rows a page with its Query
   * ID (FR-SR-51, FR-LN-06). The Pre-flight follows the SQL while typing pauses (FR-SR-36). Only who made a
   * query writes and runs it; the Data Team reads everyone's (DEC-LN-01). The Parameters, the history of
   * runs, another set of Resources and the Lenses come with their parts.
   */
  let {
    id,
    client,
    collections,
    nonce,
    onran,
  }: {
    id: string;
    client: QueryClient;
    collections: readonly Collection[] | undefined;
    /** The nonce of the page, for the styles of the editor. */
    nonce: string | undefined;
    /** A run ended: the panel shows it. */
    onran: () => void;
  } = $props();

  /** How long typing pauses before the Pre-flight is asked again. */
  const PAUSE = 600;

  let query = $state<Query | null | undefined>();
  let sql = $state('');
  let preflight = $state<Preflight | null>(null);
  /** The SQL the Pre-flight is of: its marks hold only while the SQL is the same. */
  let checked = $state('');
  let checking = $state(false);
  let run = $state<Run | null>(null);
  let page = $state<Page | null>(null);
  let expired = $state(false);
  let failure = $state<string | null>(null);
  let running = $state(false);
  let paging = $state(false);
  let boxOpen = $state(true);
  let editor = $state<SqlEditor | undefined>();
  let loadedId: string | undefined;

  $effect(() => {
    if (id === loadedId) return;
    loadedId = id;
    query = undefined;
    preflight = null;
    page = null;
    run = null;
    expired = false;
    failure = null;
    client.get(id).then(
      async (found) => {
        if (loadedId !== id) return;
        query = found;
        sql = found.sql;
        run = found.lastRun;
        failure = found.lastRun?.state === 'failed' ? found.lastRun.error : null;
        if (found.mine && found.lastRun?.state === 'done') await show(found.lastRun, 1);
      },
      (error: unknown) => {
        if (error instanceof Missing) query = null;
        else console.error(`The query ${id} could not be read`, error);
      },
    );
  });

  // The Pre-flight follows the SQL, once typing pauses.
  let sequence = 0;
  $effect(() => {
    const text = sql;
    if (!query?.mine) return;
    const asked = ++sequence;
    checking = true;
    const timer = setTimeout(() => {
      client.preflight(id, text).then(
        (result) => {
          if (asked !== sequence) return;
          preflight = result;
          checked = text;
          checking = false;
        },
        (error: unknown) => {
          if (asked === sequence) checking = false;
          console.error('The Pre-flight could not be read', error);
        },
      );
    }, PAUSE);
    return () => clearTimeout(timer);
  });

  async function show(of: Run, number: number): Promise<void> {
    paging = true;
    const found = await client.rows(of.ref, number).catch((error: unknown) => {
      console.error('The rows could not be read', error);
      return undefined;
    });
    paging = false;
    if (found === undefined) return;
    expired = found === null;
    page = found;
  }

  async function start(): Promise<void> {
    if (!preflight) return;
    running = true;
    const outcome = await client.run(id, sql, preflight.range === 'approve').catch((error: unknown) => {
      console.error('The query could not run', error);
      return null;
    });
    running = false;
    if (!outcome) {
      failure = t('query.runFailed');
      return;
    }
    if (outcome.kind === 'ran') {
      run = outcome.run;
      page = outcome.page;
      expired = false;
      failure = null;
    } else if (outcome.kind === 'refused') {
      preflight = outcome.preflight;
      checked = sql;
    } else {
      run = outcome.run;
      page = null;
      failure = outcome.message;
    }
    onran();
  }

  const visible = $derived(query?.resources.flatMap((resource) => (resource.visible ? [resource] : [])) ?? []);
  const collectionName = (collectionId: string | null) => collections?.find((collection) => collection.id === collectionId)?.name ?? '';

  /** The columns of its Resources, partition and cluster columns first and marked (FR-SR-42, DEC-UX-115). */
  const suggestions: Suggestion[] = $derived(
    visible.flatMap((resource) =>
      resource.fields.map((field) => {
        const cluster = resource.clusterBy.indexOf(field.name);
        return {
          name: field.name,
          type: field.dataType,
          resource: resource.displayName,
          role: resource.partition?.field === field.name ? { kind: 'partition' as const } : cluster >= 0 ? { kind: 'cluster' as const, place: cluster + 1 } : null,
          description: field.description,
          businessDescription: field.businessDescription,
        };
      }),
    ),
  );

  /** The problems and warnings of the Pre-flight of the SQL as it is now. */
  const current = $derived(preflight && checked === sql ? preflight : null);
  const marks: ErrorMark[] = $derived(
    (current?.problems ?? []).flatMap((problem) =>
      problem.kind === 'outside' && problem.start !== null && problem.end !== null ? [{ from: problem.start, to: problem.end, message: t('query.problem.outside', { name: problem.name }) }] : [],
    ),
  );

  function said(problem: Problem | Warning): string {
    switch (problem.kind) {
      case 'empty':
        return t('query.problem.empty');
      case 'notVisible':
        return t('query.problem.notVisible', { name: problem.resource.displayName });
      case 'outside':
        return t('query.problem.outside', { name: problem.name });
      case 'notSelect':
        return t('query.problem.notSelect');
      case 'filterRequired':
        return t('query.problem.filterRequired', { name: problem.resource.displayName, column: problem.column });
      case 'invalid':
        return t('query.problem.invalid', { message: problem.message });
      case 'noPartitionFilter':
        return problem.bytesWithFilter === null
          ? t('query.warning.noFilter', { name: problem.resource.displayName, column: problem.column })
          : t('query.warning.noFilter.with', { name: problem.resource.displayName, column: problem.column, bytes: bytes(problem.bytesWithFilter) });
    }
  }
  const notes = $derived([...(current?.problems ?? []), ...(current?.warnings ?? [])]);
  const language = $derived(currentLanguage());
  const bytes = (value: number) => formatBytes(value, language);

  /** The box of the SQL folded: how many lines and CTEs (DEC-UX-76). */
  const summary = $derived(t('query.sqlSummary', { lines: sql.split('\n').length, ctes: sql.split('\n').filter((line) => CTE_LINE.test(line)).length }));
  /** Partitioned Resources it reads: they read less with a filter on their partition column. */
  const partitioned = $derived(visible.filter((resource) => resource.partition));
</script>

{#if query === null}
  <NotFound />
{:else if query}
  <header class="head">
    <div class="titles">
      <div class="meta">Query</div>
      <h1 class="page-title">{query.name}</h1>
      {#if query.question}<p class="question">{query.question}</p>{/if}
      {#if !query.mine}<p class="meta">{t('query.of', { name: query.ownerName })}</p>{/if}
    </div>
    <div class="actions">
      <Button variant="outline" href={NEW_QUERY}><Icon name="plus-circle-fill" />{t('query.new')}</Button>
      <Button disabled title={t('query.later')}>{t('query.makeLens')}</Button>
    </div>
  </header>

  <section class="frame card" aria-label={query.name}>
    <div class="scope">
      <span class="label">{t('query.readsOnly')}</span>
      <span class="chips">
        {#each query.resources as resource (resource.id)}
          {#if resource.visible}
            <a class="chip" href={resourcePath(resource.id)}>
              <KindIcon kind="resource" />{resource.displayName}{#if collectionName(resource.collectionId)}<span class="meta">· {collectionName(resource.collectionId)}</span>{/if}
              <MaturityIcon level={resource.level} small />
            </a>
          {:else}
            <span class="chip gone" title={t('query.problem.notVisible', { name: resource.displayName })}><Icon name="lock-simple" />{resource.displayName}</span>
          {/if}
        {/each}
        <button type="button" class="add" disabled title={t('query.later')}><Icon name="plus" />{t('query.resources.add')}</button>
      </span>
      <Button variant="quiet" disabled title={t('query.later')}>{t('query.lensesOn', { count: 0 })}</Button>
    </div>

    <div class="box">
      <div class="box-head">
        <button type="button" class="toggle" aria-expanded={boxOpen} aria-label={t(boxOpen ? 'editor.fold' : 'editor.unfold')} onclick={() => (boxOpen = !boxOpen)}><Icon name="caret-down" /></button>
        <span class="label">BigQuery SQL</span>
        {#if !boxOpen}<span class="meta">{summary}</span>{/if}
        <span class="grow"></span>
        {#if boxOpen && query.mine}
          <Button variant="outline" onclick={() => editor?.foldAll()}>{t('query.foldAll')}</Button>
          <Button variant="outline" title="Shift+Alt+F" onclick={() => editor?.formatSql()}>{t('query.format')}</Button>
        {/if}
      </div>
      <div class="sql" hidden={!boxOpen}>
        <SqlEditor bind:this={editor} bind:value={sql} {suggestions} {marks} label={t('query.sql', { name: query.name })} readonly={!query.mine} {nonce} />
      </div>
    </div>

    {#if query.mine}
      <div class="run-bar">
        {#if notes.length > 0}
          <ul class="notes" aria-live="polite">
            {#each notes as note, index (index)}
              <li class:problem={note.kind !== 'noPartitionFilter'}>
                <Icon name="warning-fill" /><span>{said(note)}</span>
                {#if (note.kind === 'filterRequired' || note.kind === 'noPartitionFilter') && note.fix}
                  {@const fix = note.fix}
                  <button type="button" class="text-link" onclick={() => (sql = fix)}>{t('query.addFilter')}</button>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
        <span class="preflight" aria-busy={checking}>
          <span class="meta">Pre-flight</span>
          {#if current?.bytes !== null && current?.bytes !== undefined}
            <Gauge bytes={current.bytes} approve={current.thresholds.approve} request={current.thresholds.request} />
            <span class="meta"
              >{[
                current.partitions !== null ? t('query.partitions', { count: current.partitions }) : t('query.reads', { bytes: bytes(current.bytes) }),
                partitioned.length === 1 && partitioned[0]?.partition ? t('query.through', { column: partitioned[0].partition.field }) : '',
              ]
                .filter(Boolean)
                .join(' ')}</span
            >
          {:else if checking || !current}
            <span class="meta">{t(checking ? 'query.checking' : 'query.notChecked')}</span>
          {/if}
        </span>
        <span class="grow"></span>
        {#if current?.range === 'request'}
          <RunButton bytes={current.bytes} approve disabled label={t('query.toDataTeam')} title={t('query.later')} onclick={() => undefined} />
        {:else}
          <RunButton
            bytes={current?.bytes ?? null}
            approve={current?.range === 'approve'}
            disabled={!current?.runnable || checking}
            busy={running}
            title={!current?.runnable ? t('query.cannotRun') : undefined}
            onclick={start}
          >
            {#snippet explain()}
              {#if current?.bytes !== null && current?.bytes !== undefined}
                <b>{t(current.range === 'approve' ? 'query.explain.approve' : 'query.explain.free', { bytes: bytes(current.bytes), approve: bytes(current.thresholds.approve), request: bytes(current.thresholds.request) })}</b>
                {t('query.explain.atMost')}
                {#if partitioned.length > 0}
                  {t('query.explain.less', { columns: partitioned.map((resource) => resource.partition?.field).join(', ') })}
                {/if}
              {/if}
            {/snippet}
          </RunButton>
        {/if}
      </div>
    {/if}
  </section>

  <section class="result card" aria-label={t('query.result')}>
    <div class="result-head">
      <h2>{run ? t('query.resultOf', { number: run.number }) : t('query.result')}</h2>
      <span class="tab-later" title={t('query.later')}>{t('query.history')}</span>
      {#if run}<span class="meta">{ago(run.startedAt, language)}</span>{/if}
    </div>
    {#if running}
      <p class="empty"><Icon name="play-fill" /><span>{t('query.running')}</span></p>
    {:else if failure}
      <p class="empty failed" role="alert"><Icon name="warning-fill" /><span><b>{t('query.failed')}</b> {failure}</span></p>
    {:else if expired && run}
      <p class="empty">
        <Icon name="info" /><span><b>{t('query.expired')}</b> {t('query.expired.text')}</span>
        {#if query.mine}<Button variant="outline" disabled={!current?.runnable} onclick={start}>{t('query.runAgain')}</Button>{/if}
      </p>
    {:else if page && run}
      <DataGrid columns={page.columns} rows={page.rows} first={(page.number - 1) * page.size + 1} label={t('query.resultOf', { number: run.number })} />
      <div class="foot">
        <span>{t('query.rows', { count: page.totalRows })}</span>
        {#if run.processedBytes !== null}<span class="dot">·</span><span>{t('query.read', { bytes: bytes(run.processedBytes) })}</span>{/if}
        {#if run.partitions !== null}<span class="dot">·</span><span>{t('query.partitions', { count: run.partitions })}</span>{/if}
        <span class="dot">·</span>
        <span class="ref">{t('query.ref')} <span class="mono">{run.ref}</span><CopyButton text={run.ref} label={t('query.copyRef')} /></span>
        <span class="pager"><Pager page={page.number} size={page.size} total={page.totalRows} busy={paging} onpage={(number) => run && show(run, number)} /></span>
      </div>
    {:else if run && !query.mine}
      <p class="empty"><Icon name="info" /><span>{t('query.notYours', { name: run.userName, ref: run.ref })}</span></p>
    {:else if !run}
      <p class="empty"><Icon name="play-fill" /><span><b>{t('query.notRun')}</b> {t('query.notRun.text')}</span></p>
    {/if}
  </section>
{/if}

<style>
  .head { display: flex; align-items: flex-start; gap: 16px; margin-top: 8px; }
  .titles { flex: 1; min-width: 0; }
  .question { margin: 4px 0 0; font-size: var(--text-small); color: var(--text-secondary); }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
  .frame { margin-top: 14px; border-radius: var(--radius-xl); padding: 14px 14px 0; display: flex; flex-direction: column; gap: 10px; }
  .scope { display: flex; align-items: flex-start; gap: 10px; padding: 2px 2px 0; }
  .scope > .label { flex: none; line-height: 26px; margin: 0; }
  .chips { flex: 1 1 0; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .chip { display: inline-flex; align-items: center; gap: 5px; font-size: var(--text-meta); color: var(--text-primary); background: var(--surface-sub); padding: 4px 10px; border-radius: var(--radius-pill); text-decoration: none; }
  .chip:hover { background: var(--tint-active); }
  .chip .meta { white-space: nowrap; }
  .chip.gone { color: var(--text-muted); }
  .add { display: inline-flex; align-items: center; gap: 5px; font: var(--text-meta) var(--font-family); color: var(--text-secondary); background: none; border: 1px dashed var(--tint-active); border-radius: var(--radius-pill); padding: 4px 10px; }
  .add:disabled { opacity: .55; cursor: not-allowed; }
  .box { border-radius: var(--radius-lg); background: var(--surface-sub); padding: 10px 14px 14px; }
  .box-head { display: flex; align-items: center; gap: 8px; min-height: 34px; margin-bottom: 6px; flex-wrap: wrap; }
  .box-head .label { margin: 0; }
  .toggle { width: 26px; height: 26px; margin-left: -6px; border: 0; border-radius: var(--radius-sm); background: none; color: var(--text-secondary); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; }
  .toggle:hover { background: var(--tint-active); }
  .toggle :global(.icon) { transition: transform var(--motion-fold) ease; }
  .toggle[aria-expanded='false'] :global(.icon) { transform: rotate(-90deg); }
  .grow { flex: 1; }
  .run-bar { position: sticky; bottom: 0; z-index: 4; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 2px -14px 0; padding: 12px 14px;
    border-top: 1px solid var(--tint-hover); border-radius: 0 0 var(--radius-xl) var(--radius-xl); background: var(--card); }
  .notes { flex: 1 1 100%; list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .notes li { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: var(--text-small); color: var(--signal-warn); }
  .text-link { all: unset; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
  .notes .text-link { color: var(--signal-warn); font-weight: var(--weight-medium); }
  .preflight { display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .result { margin-top: 14px; border-radius: var(--radius-xl); padding: 16px; }
  .result-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
  .result-head h2 { font-size: var(--text-body); font-weight: var(--weight-medium); margin: 0; }
  .tab-later { font-size: var(--text-small); color: var(--text-muted); opacity: .6; cursor: not-allowed; }
  .empty { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; margin: 0; padding: 28px 22px; border-radius: var(--radius-md); background: var(--surface-sub); font-size: var(--text-small); line-height: 1.5; }
  .empty > :global(.icon) { font-size: 22px; color: var(--text-secondary); flex: none; }
  .empty > span { flex: 1; min-width: 200px; }
  .empty b { font-weight: var(--weight-medium); }
  .failed > :global(.icon) { color: var(--signal-urgent); }
  .foot { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 6px; padding: 8px 10px 0; font-size: var(--text-meta); color: var(--text-muted); }
  .dot { color: var(--tint-active); }
  .ref { display: inline-flex; align-items: center; gap: 4px; color: var(--text-secondary); }
  .pager { margin-left: auto; }
</style>

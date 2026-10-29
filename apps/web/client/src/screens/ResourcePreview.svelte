<script lang="ts">
  import DataGrid from '@datahub/ui/components/DataGrid.svelte';
  import Pager from '@datahub/ui/components/Pager.svelte';
  import RunButton from '@datahub/ui/components/RunButton.svelte';
  import { formatBytes } from '@datahub/ui/foundations/bytes.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import CopyButton from '@datahub/ui/primitives/CopyButton.svelte';
  import type { ResourceDetail } from '../lib/catalogue.js';
  import { clock, when } from '../lib/moment.js';
  import { formatDay } from '../lib/parameters.js';
  import type { Page, Preflight, PreviewChoices, PreviewValues, PreviewWindow, QueryClient, QueryRequest, Run, Storage } from '../lib/query.js';
  import { newQueryPath } from '../lib/routes.js';

  /**
   * The Preview of a Resource (resource-preview, FR-SR-38): its first rows, newest first, in the grid of
   * Query (DEC-UX-98). Its Parameters choose which: its partition column, its newest 1, 4 or 12 partitions
   * that hold rows (DEC-SR-39), its first cluster column and the Parameters of its Card, at most 100 values
   * each (DEC-SR-37). Nothing to type. Every preview is a query: the Pre-flight says what it scans, it runs
   * by itself up to 100 MB, asks to be approved above, and above 1 GB goes to the Data Team (DEC-SR-29);
   * its result carries its Query ID, 100 rows a page. Under it, the way to Query; no export (DEC-UX-120).
   */
  let {
    resource,
    client,
    storage,
    onrun,
  }: {
    resource: ResourceDetail;
    client: QueryClient;
    storage: Storage | null | undefined;
    /** After a run, for the panel of Query, where the preview is a query of the User. */
    onrun?: () => void;
  } = $props();

  const WINDOWS: readonly PreviewWindow[] = [1, 4, 12];
  /** How long choosing pauses before the Pre-flight is asked. */
  const PAUSE = 250;

  let windowOf = $state<PreviewWindow>(4);
  let offered = $state<PreviewChoices | undefined>();
  let values = $state<PreviewValues>({});
  let checked = $state<{ key: string; preflight: Preflight; request: QueryRequest | null } | null>(null);
  let checking = $state(false);
  let run = $state<Run | null>(null);
  let page = $state<Page | null>(null);
  /** The choices the run on screen is of. */
  let shownKey = $state('');
  let running = $state(false);
  let paging = $state(false);
  let failure = $state<string | null>(null);
  let requestOpen = $state(false);
  let requestText = $state('');
  let sending = $state(false);
  let requestFailed = $state(false);

  const language = $derived(currentLanguage());
  const bytes = (value: number) => formatBytes(value, language);
  const keyOf = (window: PreviewWindow, chosen: PreviewValues) => JSON.stringify([window, Object.entries(chosen).filter(([, value]) => value !== null).sort()]);
  const key = $derived(keyOf(windowOf, values));
  const current = $derived(checked && checked.key === key ? checked : null);

  // The choices of the window, their values read once (DEC-SR-37); a value no longer offered goes back to all.
  $effect(() => {
    const id = resource.id;
    const window = windowOf;
    client.previewChoices(id, window).then(
      (found) => {
        if (resource.id !== id || windowOf !== window) return;
        offered = found;
        values = Object.fromEntries(
          found.choices.map((choice) => {
            const value = values[choice.field] ?? null;
            return [choice.field, value !== null && choice.values?.includes(value) ? value : null];
          }),
        );
      },
      (error: unknown) => console.error(`The choices of the Preview of ${resource.displayName} could not be read`, error),
    );
  });

  // The Pre-flight of what is chosen; up to 100 MB it runs by itself (DEC-SR-29).
  let sequence = 0;
  $effect(() => {
    if (!offered) return;
    const asked = ++sequence;
    const window = windowOf;
    const chosen = { ...values };
    const wanted = keyOf(window, chosen);
    checking = true;
    const timer = setTimeout(() => {
      client.previewPreflight(resource.id, window, chosen).then(
        (found) => {
          if (asked !== sequence) return;
          checked = { key: wanted, ...found };
          checking = false;
          if (found.preflight.runnable && found.preflight.range === 'free' && shownKey !== wanted) void start(false);
        },
        (error: unknown) => {
          if (asked === sequence) checking = false;
          console.error('The Pre-flight of the Preview could not be read', error);
        },
      );
    }, PAUSE);
    return () => clearTimeout(timer);
  });

  async function start(approve: boolean): Promise<void> {
    const window = windowOf;
    const chosen = { ...values };
    const wanted = keyOf(window, chosen);
    running = true;
    const outcome = await client.previewRun(resource.id, window, chosen, approve).catch((error: unknown) => {
      console.error('The Preview could not run', error);
      return null;
    });
    running = false;
    if (keyOf(windowOf, values) !== wanted) return;
    if (!outcome) {
      failure = t('query.runFailed');
      return;
    }
    if (outcome.kind === 'refused') {
      checked = { key: wanted, preflight: outcome.preflight, request: checked?.request ?? null };
      return;
    }
    shownKey = wanted;
    onrun?.();
    if (outcome.kind === 'ran') [run, page, failure] = [outcome.run, outcome.page, null];
    else [run, page, failure] = [outcome.run, null, outcome.message];
  }

  async function turn(number: number): Promise<void> {
    if (!run) return;
    paging = true;
    const found = await client.rows(run.ref, number).catch(() => undefined);
    paging = false;
    if (found) page = found;
  }

  async function send(): Promise<void> {
    sending = true;
    requestFailed = false;
    const request = await client.previewRequest(resource.id, windowOf, { ...values }, requestText).catch((error: unknown) => {
      console.error('The Request could not be sent', error);
      return null;
    });
    sending = false;
    if (!request) {
      requestFailed = true;
      return;
    }
    if (checked) checked = { ...checked, request };
    requestOpen = false;
  }

  const since = (at: string) => (new Date(at).toDateString() === new Date().toDateString() ? clock(at, language) : when(at, language));
  const preflight = $derived(current?.preflight ?? null);
  const scanned = $derived.by(() => {
    if (!preflight || preflight.bytes === null) return '';
    const partitions = preflight.partitions;
    const total = storage?.partitions ?? null;
    const counted = partitions === null ? '' : total !== null ? t('preview.partitionsOf', { count: partitions, total }) : t('query.partitions', { count: partitions });
    return [t('preview.scans', { bytes: bytes(preflight.bytes) }), counted].filter(Boolean).join(' · ');
  });
  /** What keeps it from running, each once: the SQL of a Preview is not the User's to change. */
  const notes = $derived([...new Set((preflight?.problems ?? []).map((problem) => (problem.kind === 'invalid' ? t('query.problem.invalid', { message: problem.message }) : t('query.cannotRun'))))]);
  const shown = $derived(shownKey === key && run !== null);
</script>

<div class="preview">
  <div class="bar">
    <span class="label">{t('preview.parameters')}</span>
    {#if offered?.window}
      {@const window = offered.window}
      <label class="choice">
        <span class="mono">{window.field}</span><span class="role">{t('preview.role.partition')}</span>
        <select bind:value={windowOf}>
          {#each WINDOWS as count (count)}<option value={count}>{t('preview.window', { count })}</option>{/each}
        </select>
        {#if window.from}<span class="meta">{t('preview.since', { date: formatDay(window.from.slice(0, 10), language) })}</span>{/if}
      </label>
    {/if}
    {#each offered?.choices ?? [] as choice (choice.field)}
      <label class="choice">
        <span class="mono">{choice.field}</span>{#if choice.role === 'cluster'}<span class="role">{t('preview.role.cluster')}</span>{/if}
        <select value={values[choice.field] ?? ''} onchange={(event) => (values = { ...values, [choice.field]: event.currentTarget.value || null })}>
          <option value="">{t('preview.all')}</option>
          {#each choice.values ?? [] as value (value)}<option {value}>{value}</option>{/each}
        </select>
      </label>
    {/each}
    <span class="grow"></span>
    <span class="scans meta" aria-busy={checking}>
      {#if scanned}<Icon name="gauge-fill" />{scanned}{:else if checking || !offered}{t('query.checking')}{/if}
    </span>
    {#if preflight && preflight.runnable && preflight.range === 'request' && current?.request?.state === 'waiting'}
      <span class="waiting"><Icon name="hourglass-medium-fill" />{t('query.request.waiting', { time: since(current.request.sentAt) })}</span>
    {:else if preflight && preflight.runnable && preflight.range === 'request' && current?.request?.state !== 'accepted'}
      <RunButton bytes={preflight.bytes} approve icon="paper-plane-tilt" label={t('query.request.send')} open={requestOpen} onclick={() => (requestOpen = !requestOpen)}>
        {#snippet popout()}
          <span class="request">
            <span><b>{t('query.request.large')}</b> {t('query.request.why', { request: bytes(preflight?.thresholds.request ?? 0) })}</span>
            <label class="word"><span>{t('query.request.word')}</span><textarea rows="2" maxlength="500" bind:value={requestText}></textarea></label>
            <Button wide disabled={sending} onclick={send}><Icon name="paper-plane-tilt" />{t('query.request.sendIt')}</Button>
            <span class="after" class:failed={requestFailed}>{t(requestFailed ? 'query.request.failed' : 'query.request.after')}</span>
          </span>
        {/snippet}
      </RunButton>
    {:else if preflight && preflight.runnable && preflight.range !== 'free' && !(shown && !running)}
      <RunButton bytes={preflight.bytes} approve busy={running} onclick={() => start(true)} />
    {/if}
  </div>
  {#if notes.length > 0}<p class="notes" role="alert"><Icon name="warning-fill" />{notes.join(' ')}</p>{/if}

  {#if running}
    <p class="empty"><Icon name="play-fill" /><span>{t('preview.running')}</span></p>
  {:else if failure}
    <p class="empty failed" role="alert"><Icon name="warning-fill" /><span><b>{t('query.failed')}</b> {failure}</span></p>
  {:else if shown && run && page && page.totalRows === 0}
    <p class="empty"><Icon name="info" /><span>{t('preview.none')}</span></p>
  {:else if shown && run && page}
    <DataGrid columns={page.columns} rows={page.rows} first={(page.number - 1) * page.size + 1} label={t('preview.label', { name: resource.displayName })} />
    <div class="foot">
      <span>{t('query.rows', { count: page.totalRows })}</span>
      {#if offered?.window}<span class="dot">·</span><span>{t('preview.window', { count: windowOf }).toLocaleLowerCase()}, {t('preview.newestFirst')}</span>{/if}
      {#if run.processedBytes !== null}<span class="dot">·</span><span>{t('query.read', { bytes: bytes(run.processedBytes) })}</span>{/if}
      <span class="dot">·</span>
      <span class="ref">{t('query.ref')} <span class="mono">{run.ref}</span><CopyButton text={run.ref} label={t('query.copyRef')} /></span>
      <span class="pager"><Pager page={page.number} size={page.size} total={page.totalRows} busy={paging} onpage={turn} /></span>
    </div>
  {/if}

  <div class="tile">
    <Icon name="terminal-window-fill" />
    <div class="text"><b>{t('preview.own')}</b><p>{t('preview.own.text')}</p></div>
    <Button variant="outline" href={newQueryPath(resource.id)}>{t('preview.query')}</Button>
  </div>
</div>

<style>
  .preview { display: flex; flex-direction: column; gap: 12px; }
  .bar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .bar > .label { margin: 0; }
  .choice { display: inline-flex; align-items: center; gap: 7px; font-size: var(--text-small); }
  .role { font-size: var(--text-meta); color: var(--text-primary); background: var(--tint-active); padding: 1px 8px; border-radius: var(--radius-pill); }
  select { font: var(--text-small) var(--font-family); color: var(--text-primary); background: var(--surface-sub); border: 0; border-radius: var(--radius-field); padding: 6px 8px; max-width: 220px; }
  select:focus-visible { outline: 2px solid var(--text-secondary); }
  .grow { flex: 1; }
  .scans { display: inline-flex; align-items: center; gap: 6px; }
  .waiting { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-small); color: var(--text-secondary); }
  .request { display: flex; flex-direction: column; gap: 10px; }
  .word { display: flex; flex-direction: column; gap: 4px; font-size: var(--text-meta); color: var(--text-muted); }
  .word textarea { box-sizing: border-box; width: 100%; resize: vertical; font: var(--text-small) var(--font-family); color: var(--text-primary); background: var(--surface-sub); border: 0; border-radius: var(--radius-field); padding: 7px 9px; }
  .after { font-size: var(--text-meta); color: var(--text-muted); }
  .after.failed { color: var(--signal-urgent); }
  .notes { display: flex; align-items: center; gap: 6px; margin: 0; font-size: var(--text-small); color: var(--signal-warn); }
  .empty { display: flex; gap: 12px; align-items: flex-start; margin: 0; padding: 28px 22px; border-radius: var(--radius-md); background: var(--surface-sub); font-size: var(--text-small); line-height: 1.5; }
  .empty > :global(.icon) { font-size: 22px; color: var(--text-secondary); flex: none; }
  .empty b { font-weight: var(--weight-medium); }
  .failed > :global(.icon) { color: var(--signal-urgent); }
  .foot { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 0 10px; font-size: var(--text-meta); color: var(--text-muted); }
  .dot { color: var(--tint-active); }
  .ref { display: inline-flex; align-items: center; gap: 4px; color: var(--text-secondary); }
  .pager { margin-left: auto; }
  .tile { display: flex; align-items: center; gap: 14px; margin-top: 4px; padding: 14px 16px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .tile > :global(.icon) { font-size: 20px; color: var(--text-secondary); flex: none; }
  .text { flex: 1; min-width: 0; font-size: var(--text-small); }
  .text b { font-weight: var(--weight-medium); }
  .text p { margin: 2px 0 0; color: var(--text-secondary); line-height: 1.5; }
</style>

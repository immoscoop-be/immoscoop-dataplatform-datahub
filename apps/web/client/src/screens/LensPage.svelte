<script lang="ts">
  import { renderLog } from '@datahub/contracts/log';
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import DataGrid from '@datahub/ui/components/DataGrid.svelte';
  import Pager from '@datahub/ui/components/Pager.svelte';
  import RunButton from '@datahub/ui/components/RunButton.svelte';
  import Callout from '@datahub/ui/containers/Callout.svelte';
  import FoldBox from '@datahub/ui/containers/FoldBox.svelte';
  import SubTile from '@datahub/ui/containers/SubTile.svelte';
  import Tabs from '@datahub/ui/containers/Tabs.svelte';
  import { formatBytes } from '@datahub/ui/foundations/bytes.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { levelName } from '@datahub/ui/foundations/levels.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import CopyButton from '@datahub/ui/primitives/CopyButton.svelte';
  import type { Collection } from '../lib/catalogue.js';
  import { missingText } from '../lib/broken.js';
  import { when } from '../lib/moment.js';
  import { describe, formatDay, isFunction, kindOf, suggestedOf } from '../lib/parameters.js';
  import type { Lens, LensParameter, LensValue as Value, Page, Parameter, Preflight, QueryClient, Run } from '../lib/query.js';
  import { collectionPath, editLensPath, queryPath, resourcePath } from '../lib/routes.js';
  import LensValue from './LensValue.svelte';

  /**
   * The page of a Lens (lens, DEC-UX-26), under Collections (DEC-UX-66): its name with the icon of its Level
   * and what it shows (DEC-UX-106), and two tabs. Run: its Parameters, filled in with their defaults, each
   * changed without touching the SQL and put back with Default (FR-LE-04, FR-LE-13), and Run with the
   * Pre-flight in it (DEC-UX-28); it runs only when the User runs it (DEC-LE-12), and its result is the grid
   * of Query with what it read and its Query ID (DEC-LE-08), marked as for the old values once one changes
   * (FR-LE-12). About: its question, what it shows, who made it, its tags, its steps as its author wrote
   * them (DEC-UX-121), what it is built on and its Level, its Parameters and its history. No SQL (FR-LE-14).
   * For its Owner Unit, "Open in Query" and "Edit" (DEC-UX-27, DEC-LE-18). A Broken Lens (DEC-UX-81) and one
   * that stopped (DEC-UX-125) say so in a chip and a callout on top, with "Open its query" for its Owner
   * Unit; Run is off and no result shows.
   */
  let {
    lens,
    client,
    collection,
    onchanged,
    onopened,
  }: {
    lens: Lens;
    client: QueryClient;
    collection: Collection | undefined;
    /** The Lens stopped or broke when it was checked: it is read again. */
    onchanged: () => void;
    /** "Open in Query" gave the query to open (DEC-LE-18). */
    onopened: (queryId: string) => void;
  } = $props();

  /** How long changing a value pauses before the Pre-flight is asked. */
  const PAUSE = 400;

  /** The value a Parameter holds by default, as the page keeps it. */
  const defaultOf = (parameter: LensParameter): Value => (parameter.kind === 'period' ? { value: parameter.value, to: parameter.to } : parameter.value);

  let tab = $state('run');
  let open = $state(true);
  let values = $state<Record<string, Value>>({});
  let preflight = $state<Preflight | null>(null);
  let checking = $state(false);
  let running = $state(false);
  let failure = $state<string | null>(null);
  let run = $state<Run | null>(null);
  let page = $state<Page | null>(null);
  /** The values the result on screen ran with. */
  let ranWith = $state('');
  let paging = $state(false);
  let opening = $state(false);
  let openFailed = $state(false);

  /** It does not run now: it misses what it reads, or it waits for the Data Team after it grew (DEC-UX-81, DEC-UX-125). */
  const halted = $derived(lens.broken !== null || lens.state === 'stopped');

  // Another Lens: its defaults, and nothing run yet (DEC-LE-12).
  let shownFor: string | undefined;
  $effect(() => {
    if (shownFor === lens.id) return;
    shownFor = lens.id;
    values = Object.fromEntries(lens.parameters.map((parameter) => [parameter.name, defaultOf(parameter)]));
    [run, page, failure, preflight, ranWith, tab] = [null, null, null, null, '', 'run'];
  });

  const language = $derived(currentLanguage());
  const bytes = (value: number) => formatBytes(value, language);
  const key = $derived(JSON.stringify(values));
  const changed = (parameter: LensParameter) => JSON.stringify(values[parameter.name]) !== JSON.stringify(defaultOf(parameter));

  // The Pre-flight of what is chosen, once choosing pauses (FR-SR-36).
  let sequence = 0;
  $effect(() => {
    const chosen = $state.snapshot(values) as Record<string, Value>;
    const id = lens.id;
    const asked = ++sequence;
    if (halted) {
      checking = false;
      return;
    }
    checking = true;
    const timer = setTimeout(() => {
      client.lensPreflight(id, chosen).then(
        (found) => {
          if (asked !== sequence) return;
          checking = false;
          if ('kind' in found) onchanged();
          else preflight = found;
        },
        (error: unknown) => {
          if (asked === sequence) checking = false;
          console.error('The Pre-flight of the Lens could not be read', error);
        },
      );
    }, PAUSE);
    return () => clearTimeout(timer);
  });

  /** A Parameter with the value the User chose, to say what a value is. */
  const withValue = (parameter: LensParameter, value: Value | undefined): Parameter => {
    if (parameter.kind === 'period') {
      const period = (value ?? { value: parameter.value, to: parameter.to }) as { value: string; to: string };
      return { ...parameter, value: period.value, to: period.to };
    }
    return { ...parameter, value: value ?? parameter.value } as Parameter;
  };

  /** A value as it reads: a suggested function by its name, any other as written; with the function sign. */
  function shown(parameter: Parameter): { text: string; fn: boolean } {
    const raw = parameter.kind === 'date' || parameter.kind === 'number' || parameter.kind === 'decimal' || parameter.kind === 'text' ? parameter.value : null;
    if (raw !== null && isFunction(parameter.kind, raw)) {
      const suggested = suggestedOf(raw);
      return { text: suggested ? t(suggested.label) : raw, fn: true };
    }
    return { text: describe(parameter, language).value, fn: false };
  }

  async function start(): Promise<void> {
    const chosen = $state.snapshot(values) as Record<string, Value>;
    const ran = JSON.stringify(chosen);
    running = true;
    failure = null;
    const outcome = await client.lensRun(lens.id, chosen, preflight?.range === 'approve').catch((error: unknown) => {
      console.error('The Lens could not run', error);
      return null;
    });
    running = false;
    if (!outcome) {
      failure = t('lens.run.failed');
      return;
    }
    if (outcome.kind === 'halted') {
      onchanged();
      return;
    }
    if (outcome.kind === 'refused') {
      preflight = outcome.preflight;
      return;
    }
    ranWith = ran;
    if (outcome.kind === 'ran') [run, page] = [outcome.run, outcome.page];
    else [run, page, failure] = [outcome.run, null, outcome.message];
  }

  /** "Open in Query": its query for its author, a query of their own for anyone else of its Owner Unit (DEC-LE-18). */
  async function openQuery(): Promise<void> {
    opening = true;
    openFailed = false;
    try {
      onopened(await client.openLens(lens.id));
    } catch (error) {
      console.error('The query of the Lens could not be opened', error);
      openFailed = true;
    } finally {
      opening = false;
    }
  }

  async function turn(number: number): Promise<void> {
    if (!run) return;
    paging = true;
    const found = await client.rows(run.ref, number).catch(() => undefined);
    paging = false;
    if (found) page = found;
  }

  /** What the result ran with, in the names Users see. */
  const ranText = $derived.by(() => {
    if (!run) return '';
    return lens.parameters
      .map((parameter) => {
        const used = run?.parameters.find((one) => one.name === parameter.name);
        return used ? `${parameter.label} ${shown(used).text}` : '';
      })
      .filter(Boolean)
      .join(', ');
  });
  const stale = $derived(run !== null && ranWith !== key);
  const level = $derived(levelName(lens.level));
  const day = (at: string) => formatDay(at.slice(0, 10), language);
  /** What a Broken Lens misses, as people read it: a table or a column (FR-LE-17). */
  const missing = $derived(missingText(lens.broken) ?? '');
  /** Its history, newest first: every version, from which query (DEC-LE-18), when it stopped, and its Log (FR-SR-52). */
  const history = $derived(
    [
      ...lens.versions.map((version) => ({
        at: version.madeAt,
        text:
          version.version === 1
            ? t('lens.about.made', { name: version.madeByName, query: version.fromQuery })
            : t('lens.about.version', { version: version.version, name: version.madeByName, query: version.fromQuery }),
        link: version.version === 1 && lens.mine && lens.fromQuery ? queryPath(lens.fromQuery.id) : null,
      })),
      ...(lens.stoppedAt && lens.stoppedReads !== null ? [{ at: lens.stoppedAt, text: t('lens.about.stopped', { bytes: bytes(lens.stoppedReads) }), link: null }] : []),
      ...lens.log.map((entry) => ({ at: entry.at, text: renderLog(entry.logId, entry.params, language), link: null })),
    ].toSorted((a, b) => b.at.localeCompare(a.at)),
  );
  const TABS = [
    { id: 'run', label: 'lens.tab.run' },
    { id: 'about', label: 'lens.tab.about' },
  ] as const;
</script>

{#snippet openAction()}
  <Button variant="outline" disabled={opening} onclick={openQuery}>{t('lens.openQuery')}</Button>
{/snippet}

{#snippet approveExplain()}
  <!-- Above 100 MB its User approves the run, and learns how many partitions it reads (DEC-UX-28, FR-SR-40). -->
  {#if preflight?.bytes !== null && preflight?.bytes !== undefined}
    <b>{t('lens.run.approve', { bytes: bytes(preflight.bytes), approve: bytes(preflight.thresholds.approve) })}</b>
    {#if preflight.partitions !== null}{t('query.partitions', { count: preflight.partitions })}.{/if}
    {t('query.explain.atMost')}
  {/if}
{/snippet}

<Breadcrumb steps={[{ label: 'Collections', href: '/collections' }, collection ? { label: collection.name, href: collectionPath(collection.id) } : { label: '' }]} />
<div class="head">
  <div class="titles">
    <div class="title-row">
      <h1 class="page-title"><KindIcon kind="lens" />{lens.name}<MaturityIcon level={lens.level} /></h1>
      {#if lens.broken}<Chip variant="broken">{t('status.broken')}</Chip>{:else if lens.state === 'stopped'}<Chip variant="warn"><Icon name="hourglass-medium-fill" />{t('status.stopped')}</Chip>{/if}
    </div>
    {#if lens.shows}<p class="shows">{lens.shows}</p>{/if}
  </div>
  <div class="actions">
    <Button variant="outline" disabled title={t('resource.later')}><Icon name="chat-circle-text-fill" />{t('resource.messages')}</Button>
    {#if lens.canManage}
      <Button variant="outline" disabled={opening} title={t('lens.openInQuery.hint')} onclick={openQuery}><Icon name="terminal-window-fill" />{t('lens.openInQuery')}</Button>
      <Button variant="outline" href={editLensPath(lens.id)}><Icon name="pencil-simple-fill" />{t('lens.edit')}</Button>
    {/if}
  </div>
</div>
{#if openFailed}<p class="failed" role="alert">{t('lens.openInQuery.failed')}</p>{/if}
{#if lens.broken}
  <Callout icon="link-break-fill" tone="urgent" action={lens.canManage ? openAction : undefined}>
    <b>{t('lens.broken.title')}</b>
    {t('lens.broken.text', { missing, date: day(lens.broken.since) })}
    {lens.canManage ? t('lens.broken.owner') : ''}
  </Callout>
{:else if lens.state === 'stopped'}
  <Callout icon="hourglass-medium-fill" tone="warning" action={lens.canManage ? openAction : undefined}>
    <b>{t('lens.stopped.title')}</b>
    {t('lens.stopped.text', { bytes: bytes(lens.stoppedReads ?? lens.reads), date: day(lens.stoppedAt ?? lens.createdAt) })}
    {lens.canManage ? t('lens.stopped.owner') : ''}
  </Callout>
{/if}

<Tabs label={lens.name} current={tab} tabs={TABS.map(({ id, label }) => ({ id, label: t(label) }))} onselect={(id) => (tab = id)}>
  {#if tab === 'run'}
    <section class="request card" aria-label={t('preview.parameters')}>
      <FoldBox bind:open toggleLabel={t('preview.parameters')}>
        {#snippet head()}
          <span class="summary">
            <span class="label">{t('preview.parameters')}</span>
            {#if !open}
              {#each lens.parameters as parameter (parameter.name)}
                {@const value = shown(withValue(parameter, values[parameter.name]))}
                <span class="chip"><span class="meta">{parameter.label}</span>{#if value.fn}<Icon name="function" />{/if}{value.text}</span>
              {/each}
            {/if}
          </span>
        {/snippet}
        <div class="parameters">
          {#each lens.parameters as parameter (parameter.name)}
            {@const value = values[parameter.name]}
            <div class="parameter" class:changed={changed(parameter)}>
              <span class="name">{parameter.label}{#if changed(parameter)}<button type="button" class="reset" onclick={() => (values = { ...values, [parameter.name]: defaultOf(parameter) })}>{t('lens.default')}</button>{/if}</span>
              {#if parameter.kind === 'period'}
                {@const period = value as { value: string; to: string }}
                <span class="period">
                  <LensValue kind="date" value={period.value} label={parameter.label} onchange={(next) => (values = { ...values, [parameter.name]: { ...period, value: String(next) } })} />
                  <LensValue kind="date" value={period.to} label={parameter.label} onchange={(next) => (values = { ...values, [parameter.name]: { ...period, to: String(next) } })} />
                </span>
              {:else}
                <LensValue
                  kind={parameter.kind}
                  value={value as string | string[] | boolean}
                  list={parameter.kind === 'choice' || parameter.kind === 'several' ? parameter.list : []}
                  label={parameter.label}
                  onchange={(next) => (values = { ...values, [parameter.name]: next })}
                />
              {/if}
              {#if changed(parameter)}
                {@const fallback = shown(parameter)}
                <span class="meta was">{t('lens.default.was', { value: fallback.text })}</span>
              {/if}
            </div>
          {:else}
            <p class="meta">{t('lens.field.parameters.none')}</p>
          {/each}
        </div>
      </FoldBox>
      <div class="run">
        {#if preflight && preflight.range === 'request'}
          <span class="meta too">{t('lens.run.tooLarge', { request: bytes(preflight.thresholds.request) })}</span>
        {/if}
        <RunButton
          bytes={preflight?.bytes ?? null}
          approve={preflight?.range === 'approve'}
          busy={running}
          disabled={halted || checking || !preflight?.runnable || preflight.range === 'request'}
          title={halted ? t('lens.run.halted') : checking ? t('query.checking') : undefined}
          onclick={start}
          explain={preflight?.range === 'approve' ? approveExplain : undefined}
        />
      </div>
    </section>

    <section class="result" aria-label={t('query.result')}>
      {#if lens.broken}
        <!-- Its last result is not shown, so that nobody takes it for today's (DEC-UX-81). -->
        <Callout icon="link-break-fill" tone="urgent"><b>{t('lens.result.broken')}</b> {t('lens.result.broken.text', { missing })}</Callout>
      {:else if lens.state === 'stopped'}
        <Callout icon="hourglass-medium-fill"><b>{t('lens.result.stopped')}</b> {t('lens.result.stopped.text')}</Callout>
      {:else if failure}
        <Callout icon="warning-fill" tone="urgent"><b>{t('query.failed')}</b> {failure}</Callout>
      {:else if !run || !page}
        <Callout icon="play-fill"><b>{t('lens.result.notRun')}</b> {t('lens.result.notRun.text')}</Callout>
      {:else}
        {#if stale}
          <Callout icon="arrow-counter-clockwise"><b>{t('lens.result.changed')}</b> {t('lens.result.changed.text')}</Callout>
        {:else}
          <p class="meta ran">{t('lens.result.ran', { time: when(run.startedAt, language), values: ranText })}</p>
        {/if}
        <div class="grid" class:stale>
          <DataGrid columns={page.columns} rows={page.rows} first={(page.number - 1) * page.size + 1} label={t('preview.label', { name: lens.name })} />
        </div>
        <div class="foot">
          <span>{t('query.rows', { count: page.totalRows })}</span>
          {#if run.processedBytes !== null}<span class="dot">·</span><span>{t('query.read', { bytes: bytes(run.processedBytes) })}</span>{/if}
          <span class="dot">·</span>
          <span class="ref">{t('query.ref')} <span class="mono">{run.ref}</span><CopyButton text={run.ref} label={t('query.copyRef')} /></span>
          <span class="pager"><Pager page={page.number} size={page.size} total={page.totalRows} busy={paging} onpage={turn} /></span>
        </div>
      {/if}
    </section>
  {:else}
    <div class="about">
      <SubTile>
        <div class="label">{t('lens.field.question')}</div>
        <p>{lens.question || t('lens.about.none')}</p>
        <div class="label">{t('lens.field.shows')}</div>
        <p>{lens.shows || t('lens.about.none')}</p>
        <div class="label">{t('lens.about.madeBy')}</div>
        <p>{t('lens.about.madeOn', { name: lens.authorName, date: day(lens.createdAt) })}</p>
        {#if lens.tags.length}<span class="tags">{#each lens.tags as word (word)}<span class="tag">#{word}</span>{/each}</span>{/if}
      </SubTile>
      <SubTile label={t('lens.field.steps')}>
        {#if lens.steps.length}
          <ol class="steps">{#each lens.steps as step, index (index)}<li>{step}</li>{/each}</ol>
          <p class="meta">{t('lens.about.steps.by')}</p>
        {:else}
          <p class="meta">{t('lens.about.steps.none')}</p>
        {/if}
      </SubTile>
      <SubTile label={t('lens.about.builtOn')}>
        {#each lens.resources as resource (resource.id)}
          <a class="built" href={resourcePath(resource.id)}><KindIcon kind="resource" /><span class="grow">{resource.displayName}</span><MaturityIcon level={resource.level} small /></a>
        {/each}
        <p class="meta">{t('lens.about.level', { level })}</p>
      </SubTile>
      <SubTile label={t('preview.parameters')}>
        {#if lens.parameters.length}
          <table class="params">
            <thead><tr><th>{t('lens.about.parameter')}</th><th>{t('lens.about.type')}</th><th>{t('lens.about.default')}</th></tr></thead>
            <tbody>
              {#each lens.parameters as parameter (parameter.name)}
                {@const value = shown(parameter)}
                <tr><td>{parameter.label}</td><td>{t(kindOf(parameter.kind).label)}</td><td>{#if value.fn}<Icon name="function" />{/if}{value.text}</td></tr>
              {/each}
            </tbody>
          </table>
          <p class="meta">{t('lens.about.functions')}</p>
        {:else}
          <p class="meta">{t('lens.field.parameters.none')}</p>
        {/if}
      </SubTile>
      <SubTile label={t('lens.about.history')}>
        {#each history as line, index (index)}
          <div class="line">
            <span class="grow">{#if line.link}<a href={line.link}>{line.text}</a>{:else}{line.text}{/if}</span>
            <span class="meta">{day(line.at)}</span>
          </div>
        {:else}
          <div class="line"><span class="grow">{t('lens.about.madeNoQuery', { name: lens.authorName })}</span><span class="meta">{day(lens.createdAt)}</span></div>
        {/each}
      </SubTile>
    </div>
  {/if}
</Tabs>

<style>
  b { font-weight: var(--weight-medium); }
  .head { display: flex; align-items: flex-start; gap: 14px; margin-top: 8px; }
  .titles { flex: 1; min-width: 0; }
  .title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .page-title { display: flex; align-items: center; gap: 10px; }
  .failed { margin: 8px 0 0; color: var(--signal-urgent); font-size: var(--text-small); }
  .shows { margin: 4px 0 0; font-size: var(--text-small); color: var(--text-secondary); }
  .actions { display: flex; gap: 8px; flex: none; margin-top: 6px; }
  .request { border-radius: var(--radius-xl); padding: 6px 14px 12px; display: grid; gap: 8px; }
  .summary { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 6px 0; }
  .summary .label { margin: 0; }
  .chip { display: inline-flex; align-items: center; gap: 5px; font-size: var(--text-small); padding: 3px 10px; border-radius: var(--radius-pill); background: var(--surface-sub); }
  .parameters { display: flex; flex-wrap: wrap; gap: 14px 22px; padding: 4px 4px 2px; }
  .parameter { display: grid; gap: 5px; align-content: start; }
  .name { display: flex; align-items: center; gap: 8px; font-size: var(--text-meta); color: var(--text-secondary); }
  .changed .name { color: var(--text-primary); font-weight: var(--weight-medium); }
  .reset { all: unset; cursor: pointer; font-size: var(--text-meta); color: var(--text-muted); text-decoration: underline; text-underline-offset: 2px; }
  .reset:hover { color: var(--text-primary); }
  .period { display: inline-flex; gap: 6px; }
  .was { font-size: var(--text-meta); }
  .run { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
  .too { color: var(--signal-urgent); }
  .result { margin-top: 14px; display: grid; gap: 10px; }
  .ran { margin: 0; }
  .grid.stale { opacity: .45; }
  .foot { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 0 10px; font-size: var(--text-meta); color: var(--text-muted); }
  .dot { color: var(--tint-active); }
  .ref { display: inline-flex; align-items: center; gap: 4px; color: var(--text-secondary); }
  .pager { margin-left: auto; }
  .about { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
  .about p { margin: 2px 0 12px; font-size: var(--text-small); line-height: 1.5; }
  .about .meta { display: block; margin: 8px 0 0; font-size: var(--text-meta); }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag { font-size: var(--text-meta); padding: 3px 9px; border-radius: var(--radius-pill); background: var(--surface-sub); color: var(--text-secondary); }
  .steps { margin: 0; padding-left: 20px; font-size: var(--text-small); line-height: 1.6; }
  .built { display: flex; align-items: center; gap: 8px; padding: 6px 0; color: var(--text-primary); text-decoration: none; font-size: var(--text-small); }
  .built:hover .grow { text-decoration: underline; text-underline-offset: 3px; }
  .grow { flex: 1; min-width: 0; }
  .params { width: 100%; border-collapse: collapse; font-size: var(--text-small); }
  .params th { text-align: left; font-weight: var(--weight-regular); color: var(--text-muted); font-size: var(--text-meta); padding: 0 8px 6px 0; }
  .params td { padding: 6px 8px 6px 0; border-top: 1px solid var(--tint-active); }
  .line { display: flex; gap: 10px; font-size: var(--text-small); padding: 4px 0; }
  .line a { color: inherit; }
</style>

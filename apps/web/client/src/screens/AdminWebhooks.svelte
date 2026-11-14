<script lang="ts">
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago } from '@datahub/ui/foundations/when.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import CopyButton from '@datahub/ui/primitives/CopyButton.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import { Refused } from '../lib/api.js';
  import type { DbtJob, DbtProject, Delivery, DeliveryReason, JobKind, NotChoosable, Registry, SetStatus, SourceJobTile } from '../lib/registry.js';
  import { command, useScreenCommands } from '../lib/commands.svelte.js';

  /**
   * Webhooks, the first tool of Admin (FR-AR-18, FR-AR-19, DEC-UX-130): per dbt project Data Hub follows its
   * Source Job, by name and ID, its kind and environment in dbt Cloud, whether it generates the docs, the last
   * run that delivered an Artifact Set and who set it. The page is the only place where they are set (DEC-AR-10):
   * "Change" opens a sheet with the jobs of that project, a CI job, a job without the docs or a job of another
   * environment not to be chosen; "Stop following" asks to confirm in the place of the tile; "Follow a dbt
   * project" opens a sheet with the dbt projects of the account not followed yet and, once one is chosen, its
   * jobs (DEC-UX-166). Under them the address dbt Cloud sends to, and the deliveries of the last 30 days, the
   * newest first, filtered by what Data Hub did, in a list that keeps to the height of the screen (DEC-UX-167):
   * one opened shows on the right, as a Message does in the Message Centre, with what it means and what to do.
   */
  let {
    registry,
    environment,
    ontolookat,
  }: {
    registry: Registry;
    /** The environment of Data Hub, such as uat. */
    environment: string;
    /** How many deliveries call for a look, for the panel. */
    ontolookat: (count: number) => void;
  } = $props();

  type Kind = 'recorded' | 'ignored' | 'refused' | 'failed';
  type Shown = 'all' | Kind;

  let tiles: SourceJobTile[] | null | undefined = $state();
  let webhookUrl = $state('');
  let deliveries: Delivery[] | null | undefined = $state();
  let shown: Shown = $state('all');
  let openedId: string | undefined = $state();
  let again: { runId: string; state: 'busy' | 'queued' | 'failed' } | undefined = $state();

  const kindOf = (delivery: Delivery): Kind => (delivery.outcome === 'recorded' && delivery.set?.status === 'failed' ? 'failed' : delivery.outcome);
  const count = (kind: Kind) => (deliveries ?? []).filter((delivery) => kindOf(delivery) === kind).length;
  const listed = $derived((deliveries ?? []).filter((delivery) => shown === 'all' || kindOf(delivery) === shown));
  const opened = $derived(listed.find((delivery) => delivery.id === openedId) ?? listed[0]);
  const projectOf = (projectId: string | null) => tiles?.find((tile) => tile.projectId === projectId)?.projectName ?? projectId ?? '';
  const when = (at: string) => ago(at, currentLanguage());
  const exactly = (at: string) => new Date(at).toLocaleString(currentLanguage() === 'nl' ? 'nl-BE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'medium' });

  async function load() {
    const [jobs, list] = await Promise.allSettled([registry.sourceJobs(), registry.deliveries()]);
    if (jobs.status === 'fulfilled') {
      tiles = jobs.value.projects;
      webhookUrl = jobs.value.webhookUrl;
    } else {
      console.error('The Source Jobs could not be read', jobs.reason);
      tiles = null;
    }
    if (list.status === 'fulfilled') {
      deliveries = list.value.deliveries;
      ontolookat(list.value.toLookAt);
    } else {
      console.error('The deliveries could not be read', list.reason);
      deliveries = null;
    }
  }
  $effect(() => {
    void registry;
    load();
  });

  /** Fetches and processes the run of a failed delivery again (FR-AR-14). */
  async function processAgain(runId: string) {
    again = { runId, state: 'busy' };
    try {
      await registry.reprocess(runId);
      again = { runId, state: 'queued' };
      await load();
    } catch (error) {
      console.error(`Run ${runId} could not be processed again`, error);
      again = { runId, state: 'failed' };
    }
  }

  // The sheet that changes a Source Job (FR-AR-18).
  let picking: SourceJobTile | undefined = $state();
  let offered: { environment: { id: string; name: string | null } | null; jobs: DbtJob[] } | null | undefined = $state();
  let choice: string | undefined = $state();
  let search = $state('');
  let saving = $state(false);
  let problem = $state('');

  async function pick(tile: SourceJobTile) {
    [picking, offered, choice, search, problem] = [tile, undefined, tile.job.id, '', ''];
    try {
      offered = await registry.jobsOf(tile.projectId);
    } catch (error) {
      console.error('The jobs could not be read', error);
      offered = null;
    }
  }

  const words = $derived(search.trim().toLowerCase());
  const groups = $derived.by(() => {
    const jobs = (offered?.jobs ?? []).filter((job) => !words || job.name.toLowerCase().includes(words) || job.id.includes(words));
    const names = [...new Set(jobs.map((job) => job.environmentName ?? t('admin.webhooks.noEnvironment')))];
    // The environment this Data Hub reads first.
    const own = offered?.environment?.name;
    names.sort((a, b) => (a === own ? -1 : b === own ? 1 : a.localeCompare(b)));
    return names.map((name) => ({ name, jobs: jobs.filter((job) => (job.environmentName ?? t('admin.webhooks.noEnvironment')) === name) }));
  });

  async function save() {
    if (!picking || !choice || choice === picking.job.id) {
      picking = undefined;
      return;
    }
    saving = true;
    problem = '';
    try {
      const saved = await registry.setSourceJob(picking.projectId, choice);
      tiles = (tiles ?? []).map((tile) => (tile.projectId === saved.projectId ? saved : tile));
      picking = undefined;
    } catch (error) {
      problem = error instanceof Refused ? error.detail || t('admin.webhooks.pick.failed') : t('admin.webhooks.pick.failed');
    } finally {
      saving = false;
    }
  }

  // Stop following a dbt project, after a confirmation in the place of its tile (DEC-UX-166).
  let stopping: string | undefined = $state();
  let stopBusy = $state(false);
  let stopProblem = $state('');

  async function stop(tile: SourceJobTile) {
    stopBusy = true;
    stopProblem = '';
    try {
      await registry.stopFollowing(tile.projectId);
      tiles = (tiles ?? []).filter((one) => one.projectId !== tile.projectId);
      stopping = undefined;
    } catch (error) {
      console.error(`${tile.projectId} could not be left`, error);
      stopProblem = error instanceof Refused ? error.detail || t('admin.webhooks.pick.failed') : t('admin.webhooks.pick.failed');
    } finally {
      stopBusy = false;
    }
  }

  // The sheet that follows a dbt project: its dbt projects not followed yet, then the jobs of the one chosen (DEC-UX-166).
  let adding = $state(false);
  let projects: DbtProject[] | null | undefined = $state();
  let project: DbtProject | undefined = $state();
  let projectJobs: DbtJob[] | null | undefined = $state();
  let firstJob: string | undefined = $state();
  let following = $state(false);
  let followProblem = $state('');

  async function startFollowing() {
    [adding, projects, project, projectJobs, firstJob, followProblem] = [true, undefined, undefined, undefined, undefined, ''];
    try {
      projects = (await registry.dbtProjects()).filter((one) => !one.following);
    } catch (error) {
      console.error('The dbt projects could not be read', error);
      projects = null;
    }
  }

  async function chooseProject(chosen: DbtProject) {
    [project, projectJobs, firstJob, followProblem] = [chosen, undefined, undefined, ''];
    try {
      const jobs = (await registry.jobsOf(chosen.id)).jobs;
      // The answer of another project chosen meanwhile is not shown.
      if (project?.id === chosen.id) projectJobs = jobs;
    } catch (error) {
      console.error('The jobs could not be read', error);
      if (project?.id === chosen.id) projectJobs = null;
    }
  }

  const projectGroups = $derived.by(() => {
    const jobs = projectJobs ?? [];
    const names = [...new Set(jobs.map((job) => job.environmentName ?? t('admin.webhooks.noEnvironment')))].sort((a, b) => a.localeCompare(b));
    return names.map((name) => ({ name, jobs: jobs.filter((job) => (job.environmentName ?? t('admin.webhooks.noEnvironment')) === name) }));
  });

  async function follow() {
    if (!project || !firstJob) return;
    following = true;
    followProblem = '';
    try {
      const saved = await registry.followProject(project.id, firstJob);
      tiles = [...(tiles ?? []), saved];
      adding = false;
    } catch (error) {
      followProblem = error instanceof Refused ? error.detail || t('admin.webhooks.pick.failed') : t('admin.webhooks.pick.failed');
    } finally {
      following = false;
    }
  }

  /** The line of a delivery in the list: its dbt project, and why it was ignored or refused, or how its set fares. */
  function excerpt(delivery: Delivery): string {
    if (delivery.outcome === 'refused') return t('admin.why.signature', { environment });
    const what = delivery.reason
      ? t(WHY[delivery.reason], { environment, status: delivery.runStatus ?? '' })
      : `${t('admin.deliveries.run', { run: delivery.runId ?? '' })} ${t(SET_TEXT[delivery.set?.status ?? 'pending'])}`;
    const project = delivery.projectId ? projectOf(delivery.projectId) : '';
    return project ? `${project} · ${what}` : what;
  }

  const KIND_TEXT: Record<Kind, string> = { recorded: 'admin.deliveries.recorded', ignored: 'admin.deliveries.ignored', refused: 'admin.deliveries.refused', failed: 'admin.deliveries.failed' };
  const JOB_KIND: Record<JobKind, string> = { merge: 'admin.kind.merge', ci: 'admin.kind.ci', scheduled: 'admin.kind.scheduled', other: 'admin.kind.other' };
  const SET_TEXT: Record<SetStatus, string> = { pending: 'admin.set.pending', processing: 'admin.set.processing', processed: 'admin.set.processed', failed: 'admin.set.failed' };
  const WHY: Record<DeliveryReason, string> = {
    notARun: 'admin.why.notARun',
    otherAccount: 'admin.why.otherAccount',
    notSucceeded: 'admin.why.notSucceeded',
    notSourceJob: 'admin.why.notSourceJob',
    otherProject: 'admin.why.otherProject',
    signature: 'admin.why.signature',
  };
  const TODO: Record<DeliveryReason, string> = {
    notARun: 'admin.todo.notARun',
    otherAccount: 'admin.todo.otherAccount',
    notSucceeded: 'admin.todo.notSucceeded',
    notSourceJob: 'admin.todo.notSourceJob',
    otherProject: 'admin.todo.otherProject',
    signature: 'admin.todo.signature',
  };
  const NOT_CHOOSABLE: Record<NotChoosable, string> = { ci: 'admin.notChoosable.ci', otherEnvironment: 'admin.notChoosable.otherEnvironment', noDocs: 'admin.notChoosable.noDocs' };

  // In the quick window: following another dbt project (DEC-UX-240).
  useScreenCommands(() => (tiles !== null ? { group: 'Webhooks', rows: [command('webhooks:follow', 'plus', t('admin.webhooks.follow'), () => void startFollowing(), { words: t('quick.webhooks.follow.words') })] } : null));
</script>

<Breadcrumb steps={[{ label: 'Admin' }]} />
<div class="head">
  <div class="what">
    <h1 class="page-title">Webhooks</h1>
    <p class="meta lead">{t('admin.webhooks.lead')}</p>
  </div>
  <Chip><Icon name="cloud-fill" />Data Hub {environment}</Chip>
</div>

<div class="section-head"><h2>Source Jobs</h2>{#if tiles !== null}<Button variant="outline" onclick={startFollowing}><Icon name="plus" />{t('admin.webhooks.follow')}</Button>{/if}</div>
<p class="meta explain">{t('admin.webhooks.sourceJobs', { environment })}</p>
{#if tiles === null}
  <p class="meta">{t('admin.webhooks.unavailable')}</p>
{:else if tiles && tiles.length === 0}
  <p class="meta explain">{t('admin.webhooks.none', { environment })}</p>
{:else if tiles}
  <div class="jobs">
    {#each tiles as tile (tile.projectId)}
      {#if stopping === tile.projectId}
        <section class="card job" aria-label={t('admin.webhooks.stop.title', { project: tile.projectName ?? tile.projectId })}>
          <div class="label">{tile.projectName ?? 'dbt project'} <span class="mono">· {tile.projectId}</span></div>
          <div class="stop-row">
            <span class="sign"><Icon name="warning-fill" /></span>
            <span><b>{t('admin.webhooks.stop.title', { project: tile.projectName ?? tile.projectId })}</b> {t('admin.webhooks.stop.text', { environment })}</span>
          </div>
          <div class="foot">
            <span class="meta warn" role={stopProblem ? 'alert' : undefined}>{stopProblem}</span>
            <span class="buttons">
              <Button variant="outline" onclick={() => (stopping = undefined)}>{t('admin.cancel')}</Button>
              <Button variant="danger" disabled={stopBusy} onclick={() => stop(tile)}>{t('admin.webhooks.stop')}</Button>
            </span>
          </div>
        </section>
      {:else}
      <section class="card job" aria-label={tile.projectName ?? tile.projectId}>
        <div class="label">{tile.projectName ?? 'dbt project'} <span class="mono">· {tile.projectId}</span></div>
        <div class="name"><span class="title">{tile.job.name ?? t('admin.webhooks.job', { id: tile.job.id })}</span><span class="mono id">{tile.job.id}</span></div>
        {#if tile.dbtCloud}
          <div class="tags">
            {#if tile.job.kind}<span class="tag">{t(JOB_KIND[tile.job.kind])}</span>{/if}
            {#if tile.job.environmentName}<span class="tag">{tile.job.environmentName}</span>{/if}
            {#if tile.job.generatesDocs !== null}<span class="tag" class:warn={!tile.job.generatesDocs}>{t(tile.job.generatesDocs ? 'admin.webhooks.docs' : 'admin.webhooks.noDocs')}</span>{/if}
          </div>
        {:else}
          <p class="meta">{t('admin.webhooks.dbtCloudDown')}</p>
        {/if}
        <div class="last">
          {#if tile.lastSet}
            {t('admin.webhooks.lastSet', { run: tile.lastSet.runId, when: when(tile.lastSet.receivedAt), status: t(SET_TEXT[tile.lastSet.status]) })}
          {:else}
            {t('admin.webhooks.noSet')}
          {/if}
        </div>
        <div class="foot">
          <span class="meta">{tile.setBy && tile.setAt ? t('admin.webhooks.setBy', { name: tile.setBy, when: when(tile.setAt) }) : t('admin.webhooks.fromConfig', { environment })}</span>
          <span class="buttons">
            <Button variant="quiet" onclick={() => ([stopping, stopProblem] = [tile.projectId, ''])}>{t('admin.webhooks.stop')}</Button>
            <Button variant="outline" onclick={() => pick(tile)}>{t('admin.webhooks.change')}</Button>
          </span>
        </div>
      </section>
      {/if}
    {/each}
  </div>
  {#if webhookUrl}
    <div class="card hook">
      <Icon name="webhooks-logo" />
      <span>{t('admin.webhooks.hook', { environment, count: tiles.length })}</span>
      <span class="mono url">{webhookUrl}</span>
      <CopyButton text={webhookUrl} label={t('admin.webhooks.copy')} />
    </div>
  {/if}
{:else}
  <Loading />
{/if}

<div class="section-head"><h2>{t('admin.deliveries')}</h2><span class="meta">{t('admin.deliveries.days')}</span></div>
{#if deliveries === null}
  <p class="meta">{t('admin.webhooks.unavailable')}</p>
{:else if deliveries && deliveries.length === 0}
  <section class="card empty">
    <Icon name="webhooks-logo" />
    <p class="none">{t('admin.deliveries.none')}</p>
    <p class="meta">{t('admin.deliveries.noneHint', { environment })}</p>
  </section>
{:else if deliveries}
  <div class="centre">
    <section class="card list" aria-label={t('admin.deliveries')}>
      <div class="chips">
        <Segmented
          options={[
            { value: 'all', label: `${t('admin.deliveries.all')} ${deliveries.length}` },
            { value: 'recorded', label: `${t('admin.deliveries.recorded')} ${count('recorded')}` },
            { value: 'ignored', label: `${t('admin.deliveries.ignored')} ${count('ignored')}` },
            { value: 'refused', label: `${t('admin.deliveries.refused')} ${count('refused')}` },
            { value: 'failed', label: `${t('admin.deliveries.failedShort')} ${count('failed')}` },
          ]}
          bind:value={shown}
          label={t('admin.deliveries.what')}
          surface="sub"
        />
      </div>
      {#each listed as delivery (delivery.id)}
        {@const kind = kindOf(delivery)}
        <button type="button" class="item" class:on={opened?.id === delivery.id} aria-pressed={opened?.id === delivery.id} onclick={() => (openedId = delivery.id)}>
          <span class="row"><span class="kind" class:signal={kind === 'refused' || kind === 'failed'}>{t(KIND_TEXT[kind])}</span><span class="meta when">{when(delivery.receivedAt)}</span></span>
          <span class="row who">
            {#if delivery.outcome === 'refused'}
              <b>{t('admin.deliveries.unknown')}</b>
            {:else if delivery.reason === 'notARun'}
              <b>{t('admin.deliveries.test')}</b>
            {:else}
              <b>{delivery.jobName ?? t('admin.webhooks.job', { id: delivery.jobId ?? '?' })}</b>{#if delivery.jobId}<span class="mono id">{delivery.jobId}</span>{/if}
            {/if}
          </span>
          <span class="excerpt">{excerpt(delivery)}</span>
        </button>
      {:else}
        <p class="meta empty-list">{t('admin.deliveries.noneShown')}</p>
      {/each}
    </section>

    {#if opened}
      {@const kind = kindOf(opened)}
      <section class="card detail" aria-label={t('admin.deliveries.opened')}>
        <div class="detail-head">
          <h2>{t(KIND_TEXT[kind])}</h2>
          <div class="meta">{exactly(opened.receivedAt)}</div>
        </div>
        {#if opened.outcome === 'refused'}
          <div class="why attention"><b>{t('admin.why.signature', { environment })}</b> {t('admin.why.signatureMore')}</div>
          <div class="label">{t('admin.todo')}</div>
          <p class="text">{t('admin.todo.signature')}</p>
        {:else}
          <dl class="facts">
            {#if opened.reason !== 'notARun'}
              <dt>{t('admin.fact.job')}</dt>
              <dd>{opened.jobName ?? '—'} <span class="mono id">{opened.jobId ?? ''}</span>{opened.sourceJob ? `, ${t('admin.fact.isSourceJob')}` : ''}</dd>
              <dt>{t('admin.fact.project')}</dt>
              <dd>{projectOf(opened.projectId)} <span class="mono id">{opened.projectId ?? ''}</span></dd>
              {#if opened.environmentName}<dt>{t('admin.fact.environment')}</dt><dd>{opened.environmentName}</dd>{/if}
              <dt>{t('admin.fact.run')}</dt>
              <dd><span class="mono">{opened.runId ?? '—'}</span>{opened.runStatus ? ` · ${opened.runStatus}` : ''}</dd>
            {/if}
            <dt>{t('admin.fact.event')}</dt>
            <dd><span class="mono">{opened.eventType ?? '—'}</span>{#if opened.accountId}{` · ${t('admin.fact.account')} `}<span class="mono">{opened.accountId}</span>{/if}{` · ${t('admin.fact.signed')}`}</dd>
          </dl>
          {#if opened.outcome === 'recorded'}
            <div class="label">{t('admin.did')}</div>
            <ol class="steps">
              <li><span>{t('admin.did.recorded')}</span><span class="meta">{when(opened.receivedAt)}</span></li>
              {#if opened.set?.status === 'processed'}
                <li><span>{t('admin.did.processed')}</span>{#if opened.set.processedAt}<span class="meta">{when(opened.set.processedAt)}</span>{/if}</li>
                <li><span>{t(opened.set.current ? 'admin.did.current' : 'admin.did.notCurrent', { project: projectOf(opened.projectId) })}</span></li>
              {:else if opened.set?.status === 'failed'}
                <li class="fail"><span>{t('admin.did.failed', { error: opened.set.error ?? '' })}</span></li>
                <li class="kept"><span>{t('admin.did.kept', { project: projectOf(opened.projectId) })}</span></li>
              {:else}
                <li><span>{t(opened.set?.status === 'processing' ? 'admin.did.processing' : 'admin.did.pending')}</span></li>
              {/if}
            </ol>
            {#if kind === 'failed' && opened.runId}
              {@const runId = opened.runId}
              <div class="why attention">{t('admin.todo.failed')}</div>
              <div class="actions">
                <Button variant="outline" disabled={again?.runId === runId && again.state === 'busy'} onclick={() => processAgain(runId)}><Icon name="arrows-clockwise" />{t('admin.again')}</Button>
                {#if again?.runId === runId && again.state === 'queued'}<span class="meta">{t('admin.again.queued')}</span>{/if}
                {#if again?.runId === runId && again.state === 'failed'}<span class="meta warn">{t('admin.again.failed')}</span>{/if}
              </div>
            {/if}
          {:else if opened.reason}
            <div class="why"><b>{t(WHY[opened.reason], { environment, status: opened.runStatus ?? '' })}</b></div>
            <div class="label">{t('admin.todo')}</div>
            <p class="text">{t(TODO[opened.reason], { environment })}</p>
          {/if}
        {/if}
      </section>
    {/if}
  </div>
{:else}
  <Loading />
{/if}

{#if picking}
  {@const tile = picking}
  <Sheet title={t('admin.webhooks.pick.title', { project: tile.projectName ?? tile.projectId })} onclose={() => (picking = undefined)}>
    {#snippet top()}<div class="meta">Webhooks · Data Hub {environment}</div>{/snippet}
    <p class="meta sheet-lead">{t('admin.webhooks.pick.lead', { project: tile.projectName ?? tile.projectId, id: tile.projectId, environment })}</p>
    {#if offered === undefined}
      <p class="meta">{t('admin.webhooks.pick.reading')} <Loading inline /></p>
    {:else if offered === null}
      <p class="meta">{t('admin.webhooks.dbtCloudDown')}</p>
    {:else}
      <input {...NO_PASSWORD_MANAGER} class="search" type="search" bind:value={search} placeholder={t('admin.webhooks.pick.search')} aria-label={t('admin.webhooks.pick.search')} />
      <div class="options" role="radiogroup" aria-label={t('admin.webhooks.pick.jobs')}>
        {#each groups as group (group.name)}
          <div class="group">{group.name}</div>
          {#each group.jobs as job (job.id)}
            <label class="option" class:off={job.notChoosable !== null}>
              <input type="radio" name="job" value={job.id} bind:group={choice} disabled={job.notChoosable !== null} />
              <span class="option-text">
                <span class="name"><span class="title">{job.name}</span><span class="mono id">{job.id}</span></span>
                <span class="tags">
                  <span class="tag">{t(JOB_KIND[job.kind])}</span>
                  {#if job.generatesDocs}<span class="tag">{t('admin.webhooks.docs')}</span>{/if}
                  {#if job.notChoosable}
                    <span class="meta">{t(NOT_CHOOSABLE[job.notChoosable])}</span>
                  {:else if job.lastRun?.at}
                    <span class="meta">{t('admin.webhooks.lastRun', { when: when(job.lastRun.at), status: job.lastRun.status ?? '' })}</span>
                  {/if}
                </span>
                {#if job.current}<span class="meta">{t('admin.webhooks.pick.now')}</span>{/if}
              </span>
            </label>
          {/each}
        {/each}
      </div>
    {/if}
    {#snippet foot()}
      <p class="meta note">{problem || t('admin.webhooks.pick.note', { environment })}</p>
      <Button variant="quiet" onclick={() => (picking = undefined)}>{t('admin.cancel')}</Button>
      <Button disabled={saving || !offered || choice === tile.job.id} onclick={save}>{t('admin.webhooks.pick.make')}</Button>
    {/snippet}
  </Sheet>
{/if}

{#if adding}
  <Sheet title={t('admin.webhooks.follow')} onclose={() => (adding = false)}>
    {#snippet top()}<div class="meta">Webhooks · Data Hub {environment}</div>{/snippet}
    <p class="meta sheet-lead">{t('admin.webhooks.follow.lead', { environment })}</p>
    {#if projects === undefined}
      <p class="meta">{t('admin.webhooks.follow.reading')} <Loading inline /></p>
    {:else if projects === null}
      <p class="meta">{t('admin.webhooks.dbtCloudDown')}</p>
    {:else if projects.length === 0}
      <p class="meta">{t('admin.webhooks.follow.all', { environment })}</p>
    {:else}
      <div class="options" role="radiogroup" aria-label={t('admin.webhooks.follow.projects')}>
        {#each projects as one (one.id)}
          <label class="option">
            <input type="radio" name="project" value={one.id} checked={project?.id === one.id} onchange={() => chooseProject(one)} />
            <span class="name"><span class="title">{one.name}</span><span class="mono id">{one.id}</span></span>
          </label>
        {/each}
      </div>
      {#if project}
        <div class="group jobs-of">{t('admin.webhooks.follow.jobsOf', { project: project.name })}</div>
        {#if projectJobs === undefined}
          <p class="meta"><Loading inline /></p>
        {:else if projectJobs === null}
          <p class="meta">{t('admin.webhooks.dbtCloudDown')}</p>
        {:else if projectJobs.length === 0}
          <p class="meta">{t('admin.webhooks.follow.noJobs')}</p>
        {:else}
          <div class="options" role="radiogroup" aria-label={t('admin.webhooks.pick.jobs')}>
            {#each projectGroups as group (group.name)}
              <div class="group">{group.name}</div>
              {#each group.jobs as job (job.id)}
                <label class="option" class:off={job.notChoosable !== null}>
                  <input type="radio" name="first-job" value={job.id} bind:group={firstJob} disabled={job.notChoosable !== null} />
                  <span class="option-text">
                    <span class="name"><span class="title">{job.name}</span><span class="mono id">{job.id}</span></span>
                    <span class="tags">
                      <span class="tag">{t(JOB_KIND[job.kind])}</span>
                      {#if job.generatesDocs}<span class="tag">{t('admin.webhooks.docs')}</span>{/if}
                      {#if job.notChoosable}
                        <span class="meta">{t(NOT_CHOOSABLE[job.notChoosable])}</span>
                      {:else if job.lastRun?.at}
                        <span class="meta">{t('admin.webhooks.lastRun', { when: when(job.lastRun.at), status: job.lastRun.status ?? '' })}</span>
                      {/if}
                    </span>
                  </span>
                </label>
              {/each}
            {/each}
          </div>
        {/if}
      {/if}
    {/if}
    {#snippet foot()}
      <p class="meta note">{followProblem || t('admin.webhooks.follow.note', { environment })}</p>
      <Button variant="quiet" onclick={() => (adding = false)}>{t('admin.cancel')}</Button>
      <Button disabled={following || !project || !firstJob} onclick={follow}>{t('admin.webhooks.follow.make')}</Button>
    {/snippet}
  </Sheet>
{/if}

<style>
  .head { display: flex; align-items: flex-end; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
  .what { flex: 1; min-width: 280px; }
  .lead { display: block; margin-top: 4px; line-height: 1.5; }
  .section-head { display: flex; align-items: baseline; gap: 12px; margin: 26px 0 12px; }
  .section-head h2 { font-size: var(--text-section); font-weight: var(--weight-medium); margin: 0; flex: 1; }
  .explain { display: block; line-height: 1.5; max-width: 760px; margin: -4px 0 12px; }
  .card { border-radius: var(--radius-xl); background: var(--surface-solid); }
  .jobs { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 14px; }
  .job { display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; border-radius: var(--radius-lg); }
  .label { font-size: var(--text-meta); color: var(--text-muted); }
  .name { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .title { font-weight: var(--weight-medium); }
  .id { font-size: var(--text-meta); color: var(--text-muted); }
  .tags { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .tag { font-size: var(--text-meta); padding: 2px 8px; border-radius: var(--radius-pill); background: var(--surface-sub); color: var(--text-secondary); }
  .tag.warn, .warn { color: var(--signal-warn); }
  .last { font-size: var(--text-small); color: var(--text-secondary); }
  .foot { display: flex; align-items: center; gap: 10px; justify-content: space-between; margin-top: auto; }
  .buttons { display: flex; align-items: center; gap: 6px; flex: none; }
  .stop-row { display: flex; gap: 10px; font-size: var(--text-small); line-height: 1.5; }
  .stop-row b { font-weight: var(--weight-medium); }
  .stop-row .sign { display: inline-flex; flex: none; color: var(--signal-urgent); font-size: 18px; }
  .jobs-of { margin-top: 16px; }
  .hook { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 14px; padding: 12px 16px; border-radius: var(--radius-lg); font-size: var(--text-small); }
  .url { flex: 1; min-width: 0; overflow-wrap: anywhere; color: var(--text-secondary); }
  .centre { display: grid; grid-template-columns: minmax(300px, 420px) minmax(0, 1fr); gap: 14px; align-items: start; }
  /* The deliveries keep to the height of the main frame, inside its padding, and scroll within themselves; their
     filter stays on top (DEC-UX-167). */
  .list { box-sizing: border-box; max-height: calc(100vh - 2 * var(--space-frame) - 52px); overflow-y: auto; padding: 0 8px 8px; }
  .chips { position: sticky; top: 0; z-index: 1; margin: 0 -8px 8px; padding: 12px 12px 8px; overflow-x: auto; background: var(--surface-solid); }
  .item { all: unset; box-sizing: border-box; text-align: left; display: flex; flex-direction: column; gap: 6px; width: 100%; padding: 12px; border-radius: var(--radius-md); cursor: pointer; }
  .item:hover { background: var(--tint-hover); }
  .item.on { background: var(--surface-sub); }
  .item:focus-visible { outline: 2px solid var(--text-secondary); }
  .row { display: flex; align-items: center; gap: 8px; font-size: var(--text-small); }
  .when { margin-left: auto; }
  .who b { font-weight: var(--weight-medium); }
  .kind { font-size: 10px; font-weight: var(--weight-medium); padding: 2px 8px; border-radius: var(--radius-pill); background: var(--tint-hover); color: var(--text-secondary); }
  .kind.signal { color: var(--signal-warn); background: color-mix(in srgb, var(--signal-warn) 13%, var(--surface-solid)); }
  .excerpt { font-size: var(--text-small); line-height: 1.5; color: var(--text-secondary); }
  .empty-list { padding: 12px; margin: 0; }
  .detail { padding: 18px 20px 20px; }
  .detail-head h2 { margin: 0; font-size: var(--text-section); font-weight: var(--weight-medium); }
  .facts { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 8px 16px; margin: 16px 0 0; font-size: var(--text-small); }
  .facts dt { color: var(--text-muted); }
  .facts dd { margin: 0; }
  .detail .label { margin-top: 18px; }
  .steps { margin: 8px 0 0; padding-left: 20px; display: grid; gap: 6px; font-size: var(--text-small); }
  .steps li span.meta { margin-left: 8px; }
  .steps .fail { color: var(--signal-warn); }
  .steps .kept { color: var(--text-secondary); }
  .why { margin-top: 16px; padding: 10px 12px; border-radius: var(--radius-md); background: var(--surface-sub); font-size: var(--text-small); line-height: 1.5; }
  .why b { font-weight: var(--weight-medium); }
  .why.attention { background: color-mix(in srgb, var(--signal-warn) 11%, var(--surface-solid)); }
  .text { margin: 6px 0 0; font-size: var(--text-small); line-height: 1.5; }
  .actions { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
  .empty { padding: 28px 20px; text-align: center; }
  .empty :global(.icon) { font-size: 26px; color: var(--text-muted); }
  .none { margin: 10px 0 4px; color: var(--text-primary); }
  .search { width: 100%; box-sizing: border-box; margin: 12px 0 6px; padding: 8px 12px; border-radius: var(--radius-field); border: 1px solid var(--tint-active); background: var(--surface-solid); color: var(--text-primary); font: inherit; font-size: var(--text-small); }
  .options { display: flex; flex-direction: column; gap: 4px; }
  .group { margin: 10px 4px 2px; font-size: var(--text-meta); font-weight: var(--weight-medium); color: var(--text-muted); }
  .option { display: flex; gap: 10px; align-items: flex-start; padding: 10px; border-radius: var(--radius-md); cursor: pointer; }
  .option:hover { background: var(--tint-hover); }
  .option.off { cursor: default; opacity: .7; }
  .option.off:hover { background: none; }
  .option input { accent-color: var(--text-primary); margin: 3px 0 0; }
  .option-text { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .note { flex: 1; margin: 0; line-height: 1.5; }
  .sheet-lead { display: block; margin: 6px 0 4px; line-height: 1.5; }
</style>

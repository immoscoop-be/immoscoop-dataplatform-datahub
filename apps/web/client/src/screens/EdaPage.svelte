<script lang="ts">
  import type { EdaView, ProbeKey } from '@datahub/contracts/eda';
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import Tabs from '@datahub/ui/containers/Tabs.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { levelName } from '@datahub/ui/foundations/levels.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { day } from '@datahub/ui/foundations/when.js';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import type { EdaClient } from '../lib/eda.js';
  import { edaPath, type EdaTab, resourcePath } from '../lib/routes.js';
  import { shortOf } from '../lib/typeFields.js';
  import EdaProbeDetail from './EdaProbeDetail.svelte';
  import EdaStatus from './EdaStatus.svelte';
  import EdaSteps from './EdaSteps.svelte';
  import NotFound from './NotFound.svelte';

  /**
   * The page of the EDA of a Resource (DEC-UX-321, FR-ED-04): a guiding page, whose picture is the progress of its
   * EDA-Setup and the quality of the EDA. Its status beside the title, In progress until the EDA-Setup is complete, then
   * Explored; its Level; the tabs Overview, still to come, Steps, and Profile, greyed until the EDA-Setup is complete,
   * each saying what will come there. On Steps, the detail of an EDA-Probe opens in place of the rows (DEC-UX-324).
   */
  let {
    id,
    tab,
    probe,
    client,
    onchanged,
  }: {
    /** The Resource whose EDA it is. */
    id: string;
    tab: EdaTab;
    /** The EDA-Probe whose detail is open on Steps. */
    probe: ProbeKey | null;
    client: EdaClient;
    /** After a run or a reading: the panel reads the EDAs again. */
    onchanged: () => void;
  } = $props();

  /** The EDA: undefined while it comes, null when the Resource has none or may not be seen. */
  let view: EdaView | null | undefined = $state();
  let failed = $state(false);

  $effect(() => {
    const asked = id;
    view = undefined;
    failed = false;
    client.get(asked).then(
      (found) => {
        if (asked === id) view = found;
      },
      (error: unknown) => {
        console.error(`The EDA of ${asked} could not be read`, error);
        if (asked === id) failed = true;
      },
    );
  });

  /** The EDA as it is after a run or a reading. */
  function changed(next: EdaView): void {
    view = next;
    onchanged();
  }

  const language = $derived(currentLanguage());
  const ran = $derived(view?.probes.some((one) => one.lastRun !== null) ?? false);
  const tabs = $derived([
    { id: 'overview', label: t('eda.tab.overview'), href: edaPath(id, 'overview') },
    { id: 'steps', label: t('eda.tab.steps'), href: edaPath(id) },
    {
      id: 'profile',
      label: t('eda.tab.profile'),
      href: edaPath(id, 'profile'),
      ...(view?.status === 'explored' ? {} : { muted: true, title: t('eda.tab.profile.soon') }),
    },
  ]);
</script>

{#if failed}
  <p class="meta failed" role="alert"><Icon name="warning-fill" />{t('eda.page.failed')}</p>
{:else if view === undefined}
  <Loading />
{:else if view === null}
  <NotFound />
{:else}
  {@const eda = view}
  {@const resource = eda.resource}
  <Breadcrumb
    steps={[
      { label: 'EDA', href: '/eda' },
      ...(resource.collection ? [{ label: resource.collection.name }] : []),
      ...(probe ? [{ label: resource.displayName, href: edaPath(id) }] : []),
    ]}
  />
  <div class="head">
    <div class="title">
      <h1 class="page-title">{resource.displayName}</h1>
      <p class="meta about">
        {t('eda.page.started', { date: day(eda.startedAt, language), name: eda.startedBy.name })}{#if resource.modelType}{' '}{shortOf(resource.modelType)}{/if}
      </p>
    </div>
    <Button variant="outline" href={resourcePath(id, 'maturity')}><Icon name="arrow-square-out" />{t('eda.page.openResource')}</Button>
  </div>
  <div class="facts">
    <EdaStatus status={eda.status} />
    <Chip><MaturityIcon level={resource.level} tooltip={false} />{levelName(resource.level)}</Chip>
    {#if !probe}
      <Chip><Icon name={ran ? 'check-circle-fill' : 'play-circle'} />{t(ran ? 'eda.page.ran' : 'eda.page.noRun')}</Chip>
    {/if}
  </div>
  <Tabs {tabs} current={tab} label={t('eda.tabs')}>
    {#if tab === 'steps'}
      {#if probe}
        {#key probe}
          <EdaProbeDetail view={eda} {probe} {client} onview={changed} />
        {/key}
      {:else}
        <EdaSteps view={eda} />
      {/if}
    {:else if tab === 'overview'}
      <div class="soon">
        <Icon name="layout" />
        <h3>{t('eda.overview.title')}</h3>
        <p>{t('eda.overview.text', { name: resource.displayName })}</p>
      </div>
    {:else}
      <div class="soon">
        <Icon name="chart-line" />
        {#if eda.status === 'explored'}
          <h3>{t('eda.profile.title.explored')}</h3>
          <p>{t('eda.profile.text.explored', { name: resource.displayName })}</p>
        {:else}
          <h3>{t('eda.profile.title')}</h3>
          <p>{t('eda.profile.text', { name: resource.displayName })}</p>
        {/if}
      </div>
    {/if}
  </Tabs>
{/if}

<style>
  .head { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
  .title { flex: 1; min-width: 280px; }
  .about { display: block; margin: 4px 0 0; line-height: 1.5; }
  .facts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
  .soon { padding: 40px 20px; text-align: center; color: var(--text-secondary); }
  .soon > :global(.icon) { font-size: 34px; color: var(--text-muted); }
  .soon h3 { font-size: 17px; font-weight: var(--weight-medium); margin: 10px 0 6px; color: var(--text-primary); }
  .soon p { max-width: 560px; margin: 0 auto; line-height: 1.55; font-size: var(--text-small); }
  .failed { display: flex; gap: 6px; align-items: center; margin-top: 20px; color: var(--signal-warn); }
</style>

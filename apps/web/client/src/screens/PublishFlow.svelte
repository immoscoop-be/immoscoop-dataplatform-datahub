<script lang="ts">
  import FlowBox from '@datahub/ui/containers/FlowBox.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import type { ResourceDetail } from '../lib/catalogue.js';
  import { type FlowStepId, flowOf, isFlowStep } from '../lib/flowBox.js';
  import type { ResourceSpot } from '../lib/routes.js';

  /**
   * The Flow Box of a Resource not published yet (FR-MR-20): its steps required to publish, the same as its Maturity,
   * then reading it back and publishing it, read from the Resource each time it changes (DEC-UX-306). A step leads to
   * its place, which opens for editing (DEC-UX-303); once it is published, it says so once (DEC-UX-302).
   */
  let {
    resource,
    collection,
    minimized,
    here,
    cardTitle,
    onstep,
    oncard,
    onobject,
    onminimize,
    onclose,
  }: {
    resource: ResourceDetail;
    /** The name of its Collection, which everyone who sees then sees it. */
    collection: string;
    minimized: boolean;
    /** The place of the page on screen, while it is the page of this Resource. */
    here: ResourceSpot | null;
    /** The title of a written Learning Card, in the language of the User. */
    cardTitle: (card: string) => string | undefined;
    onstep: (step: FlowStepId) => void;
    oncard: (card: string) => void;
    onobject: () => void;
    onminimize: (minimized: boolean) => void;
    onclose: () => void;
  } = $props();

  const flow = $derived(flowOf(resource, { here, cardTitle }));
</script>

<FlowBox
  title={t('flow.title')}
  object={{ label: resource.displayName, icon: 'table' }}
  steps={flow.steps}
  now={flow.now}
  progress={flow.progress}
  foot={flow.foot}
  {minimized}
  ended={flow.published ? ended : undefined}
  onstep={(step) => isFlowStep(step.id) && onstep(step.id)}
  {oncard}
  {onobject}
  {onminimize}
  {onclose}
/>

{#snippet ended()}
  <div class="ended">
    <span class="seal"><Icon name="check-circle-fill" /></span>
    <p class="title">{t('flow.published.title')}</p>
    <p>{t('flow.published.text', { name: resource.displayName, collection })}</p>
    <p class="more">{t('flow.published.more')}</p>
    <Button variant="outline" onclick={onclose}>{t('flowbox.close')}</Button>
  </div>
{/snippet}

<style>
  .ended { display: grid; justify-items: center; gap: 8px; }
  .seal { display: inline-flex; font-size: 40px; color: var(--text-primary); }
  .title { margin: 0; font-size: var(--text-section); font-weight: var(--weight-medium); }
  p { margin: 0; font-size: var(--text-small); line-height: 1.55; color: var(--text-primary); }
  .more { font-size: var(--text-meta); color: var(--text-muted); }
</style>

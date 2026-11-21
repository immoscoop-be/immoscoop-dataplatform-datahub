<script lang="ts">
  import type { EdaView, ProbeKey } from '@datahub/contracts/eda';
  import FlowBox from '@datahub/ui/containers/FlowBox.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import { edaFlowOf } from '../lib/edaFlow.js';

  /**
   * The guide of an EDA in progress (FR-ED-14, DEC-UX-327): the Flow Box with the flow Set up its EDA, its mark the
   * binoculars of the section, one step per needed EDA-Probe grouped under its EDA-Step, read from the EDA each time it
   * changes (TR-ED-09). The step to do now is the best next step of the EDA; Open the EDA-Probe leads to its detail,
   * where its step says it is open on the page.
   */
  let {
    view,
    minimized,
    here,
    cardTitle,
    onstep,
    oncard,
    onobject,
    onminimize,
    onclose,
  }: {
    view: EdaView;
    minimized: boolean;
    /** The EDA-Probe whose detail is open on the page, while it is the EDA of this Resource. */
    here: ProbeKey | null;
    /** The title of a written Learning Card, in the language of the User. */
    cardTitle: (card: string) => string | undefined;
    onstep: (probe: ProbeKey) => void;
    oncard: (card: string) => void;
    onobject: () => void;
    onminimize: (minimized: boolean) => void;
    onclose: () => void;
  } = $props();

  const flow = $derived(edaFlowOf(view, { here, cardTitle }));
</script>

<FlowBox
  title={t('eda.flow.title')}
  icon="binoculars-fill"
  object={{ label: view.resource.displayName, icon: 'table' }}
  steps={flow.steps}
  now={flow.now}
  progress={flow.progress}
  foot={flow.foot}
  {minimized}
  onstep={(step) => onstep(step.id as ProbeKey)}
  {oncard}
  {onobject}
  {onminimize}
  {onclose}
/>

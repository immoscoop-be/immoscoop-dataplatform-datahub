<script lang="ts">
  import type { EdaStep, EdaView } from '@datahub/contracts/eda';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import { EDA_STEPS, hasToAdd, probesOf, stepCount, STEP_TEXTS } from '../lib/eda.js';
  import EdaProbeCard from './EdaProbeCard.svelte';
  import EdaProbeList from './EdaProbeList.svelte';
  import EdaSide from './EdaSide.svelte';

  /**
   * The tab Steps of an EDA (DEC-UX-322, FR-ED-04), in two columns. On the left, 70%, a row per EDA-Step in the order
   * of DEC-ED-11, each saying how many of its needed EDA-Probes are complete, its EDA-Probes added as cards, and, while
   * it has EDA-Probes offered that are not added yet, coming ones too, one empty tile, Add probe, the same size as a
   * card, dotted and grey, with what an EDA-Probe is, at half opacity until it is hovered or focused (DEC-UX-331). The
   * tile opens the list to add an EDA-Probe at its EDA-Step (FR-ED-13). On the right, 30%, the state of its EDA-Setup.
   */
  let { view }: { view: EdaView } = $props();

  /** The EDA-Step whose tile opened the list to add an EDA-Probe, while it is open. */
  let listAt: EdaStep | null = $state(null);

  const grain = $derived(view.resource.fields.filter((field) => field.grain).map((field) => field.name));

  function stateOf(step: EdaStep): { icon: IconName; tone: 'done' | 'part' | 'none'; text: string } {
    const { needed, complete } = stepCount(view, step);
    if (needed === 0) return { icon: 'circle', tone: 'none', text: t('eda.step.noneNeeded') };
    return complete === needed
      ? { icon: 'check-circle-fill', tone: 'done', text: t('eda.step.needed', { complete, needed }) }
      : { icon: 'circle-half', tone: 'part', text: t('eda.step.needed', { complete, needed }) };
  }
</script>

<div class="layout">
  <div class="steps">
    {#each EDA_STEPS as step (step)}
      {@const state = stateOf(step)}
      {@const count = stepCount(view, step)}
      {@const added = probesOf(view, step).filter((probe) => probe.added)}
      {@const toAdd = hasToAdd(view, step)}
      <section class="step" aria-label={t(STEP_TEXTS[step].name)}>
        <header>
          <h3>{t(STEP_TEXTS[step].name)}</h3>
          <span class="need {state.tone}"><Icon name={state.icon} />{state.text}</span>
          <p>{t(STEP_TEXTS[step].about)}</p>
        </header>
        <div class="grid">
          {#each added as probe (probe.key)}
            <EdaProbeCard {probe} {view} />
          {/each}
          {#if toAdd}
            {@const left = count.needed - count.complete}
            <button type="button" class="add" onclick={() => (listAt = step)}>
              <Icon name="plus-circle" />
              <b>{t('eda.add')}</b>
              <span>{grain.length > 0 ? t('eda.add.what.grain', { grain: grain.join(', ') }) : t('eda.add.what')}</span>
              <small>{left > 0 ? t('eda.add.left', { count: left, step: t(STEP_TEXTS[step].name) }) : t('eda.add.more', { step: t(STEP_TEXTS[step].name) })}</small>
            </button>
          {/if}
        </div>
      </section>
    {/each}
  </div>
  <EdaSide {view} />
</div>

{#if listAt}
  <EdaProbeList {view} at={listAt} onclose={() => (listAt = null)} />
{/if}

<style>
  .layout { display: grid; grid-template-columns: minmax(0, 7fr) minmax(300px, 3fr); gap: 22px; align-items: start; }
  .step + .step { margin-top: 24px; }
  header { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; align-items: baseline; margin-bottom: 10px; }
  h3 { font-size: 16px; font-weight: var(--weight-medium); margin: 0; }
  header p { grid-column: 1 / -1; margin: 0; font-size: var(--text-small); color: var(--text-secondary); }
  .need { display: inline-flex; gap: 5px; align-items: center; font-size: var(--text-meta); }
  .need.done { color: var(--col-teal-ink); }
  .need.part { color: var(--signal-warn); }
  .need.none { color: var(--text-muted); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); grid-auto-rows: 1fr; gap: 12px; }
  .add { box-sizing: border-box; min-height: 300px; font: inherit; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 18px 22px;
    text-align: center; text-decoration: none; border-radius: var(--radius-md); border: 1.5px dashed color-mix(in srgb, var(--text-muted) 55%, transparent);
    background: color-mix(in srgb, var(--text-muted) 8%, transparent); color: var(--text-secondary); opacity: .5; transition: opacity var(--motion-fade), background var(--motion-fade); }
  .add > :global(.icon) { font-size: 28px; color: var(--text-muted); }
  .add b { font-size: 15px; font-weight: var(--weight-medium); color: var(--text-primary); }
  .add span { font-size: var(--text-small); line-height: 1.5; max-width: 30ch; }
  .add small { font-size: var(--text-meta); color: var(--text-muted); }
  /* Half opacity at rest, in full when hovered or focused, so that it weighs less than the cards beside it (DEC-UX-331). */
  .add:hover, .add:focus-visible { opacity: 1; }
  .add:hover { background: color-mix(in srgb, var(--text-muted) 14%, transparent); }
  .add:focus-visible { outline: 2px solid var(--text-secondary); }
  @media (max-width: 1180px) { .layout { grid-template-columns: 1fr; } }
</style>

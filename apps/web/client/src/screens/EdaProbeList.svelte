<script lang="ts">
  import { EDA_STEPS, PROBES, type EdaStep, type EdaView, type ProbeView } from '@datahub/contracts/eda';
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import Sentence from '@datahub/ui/foundations/Sentence.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import { askedOf, fitsFilter, type ListFilter, type ListState, listStateOf, overallReading, PROBE_ABOUT, PROBE_TEXTS, probesOf, READING_LOOK, stepCount, STEP_TEXTS, stillMissing } from '../lib/eda.js';
  import { askOf } from '../lib/edaWords.js';
  import { probePath } from '../lib/routes.js';

  /**
   * The list to add an EDA-Probe (FR-ED-13, DEC-UX-328): a sheet with a search, which has the focus at once, opened at the
   * EDA-Step of the tile Add probe, every EDA-Step in its order above and below it. Each EDA-Probe its model type is
   * offered, with its name, the question it asks of this Resource, Needed, Suggested or On request, and on the right its
   * state: added, with Data Hub's reading; set on part of what it needs; Open, to add it; or Coming, quieter, while Data
   * Hub does not run it, and still counted (DEC-ED-27). Filters show all, the needed ones, those Data Hub runs, or those
   * added. A click opens its detail, where Run adds it (FR-ED-06); a Coming one opens nothing.
   */
  let { view, at, onclose }: { view: EdaView; at: EdaStep; onclose: () => void } = $props();

  const id = $derived(view.resource.id);
  const type = $derived(view.resource.modelType ?? '—');

  let query = $state('');
  let filter: ListFilter = $state('all');

  const FILTERS: readonly { value: ListFilter; label: string }[] = [
    { value: 'all', label: 'eda.list.all' },
    { value: 'needed', label: 'eda.standing.needed' },
    { value: 'runs', label: 'eda.list.runs' },
    { value: 'added', label: 'eda.standing.added' },
  ];
  const ASKED_TEXTS = { needed: 'eda.standing.needed', suggested: 'eda.standing.suggested', onRequest: 'eda.standing.onRequest' } as const;
  const STATE_ICONS: Readonly<Record<ListState, IconName>> = { added: 'check-circle-fill', part: 'circle-half', open: 'plus-circle', coming: 'circle-dashed' };

  /** Words as the search compares them: lower case, without accents. */
  const plain = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

  /** What the search reads of an EDA-Probe: its name, its question, its EDA-Step, and what its detail says it does. */
  function wordsOf(probe: ProbeView): string {
    const ask = askOf(probe.key, view.resource);
    const step = STEP_TEXTS[PROBES[probe.key].step];
    const about = PROBE_ABOUT[probe.key];
    return plain([t(PROBE_TEXTS[probe.key]), t(ask.key, { ...ask.values, ...ask.names }), t(step.name), t(step.about), ...(about ? [t(about.does, { grain: '' }), t(about.why)] : [])].join(' '));
  }

  const words = $derived(plain(query).split(/\s+/).filter(Boolean));
  const groups = $derived(
    EDA_STEPS.map((step) => ({
      step,
      count: stepCount(view, step),
      probes: probesOf(view, step).filter((probe) => fitsFilter(probe, filter) && (words.length === 0 || words.every((word) => wordsOf(probe).includes(word)))),
    })).filter((group) => group.probes.length > 0),
  );

  /** What an EDA-Probe added and set on part of what it needs still misses, said under Open. */
  function partOf(probe: ProbeView): string {
    const missing = stillMissing(probe);
    if (!probe.lastRun || missing.length === 0) return t('eda.flow.notRun');
    const total = probe.applies.needs.length;
    return t(PROBES[probe.key].place === 'column' ? 'eda.list.part.keyFields' : 'eda.list.part.fields', { set: total - missing.length, total });
  }

  // The EDA-Step of the tile is in view as the sheet opens, the others above and below it.
  let list: HTMLElement | undefined = $state();
  $effect(() => {
    const group = list?.querySelector<HTMLElement>('[data-at]');
    if (group && list) list.scrollTop = group.offsetTop;
  });
</script>

<Sheet title={t('eda.list.title')} {onclose}>
  {#snippet top()}<div class="meta over"><Sentence key="eda.list.of" values={{ name: view.resource.displayName }} names={{ type }} /></div>{/snippet}
  {#snippet lead()}<span class="lead"><Icon name="plus-circle" /></span>{/snippet}
  <p class="why"><Sentence key="eda.list.why" names={{ type }} /></p>
  <label class="search">
    <Icon name="magnifying-glass" />
    <input {...NO_PASSWORD_MANAGER} type="search" data-autofocus bind:value={query} placeholder={t('eda.list.search')} aria-label={t('eda.list.search')} />
  </label>
  <div class="filters">
    <Segmented options={FILTERS.map((one) => ({ value: one.value, label: t(one.label) }))} bind:value={filter} label={t('eda.list.show')} surface="sub" />
  </div>
  <div class="list" bind:this={list}>
    {#each groups as group (group.step)}
      {@const from = group.step === at}
      <section class="group" class:at={from} aria-label={t(STEP_TEXTS[group.step].name)} data-at={from || undefined}>
        <div class="head">
          <b>{t(STEP_TEXTS[group.step].name)}</b>
          <span class="count" class:done={group.count.needed > 0 && group.count.complete === group.count.needed}>
            {group.count.needed === 0 ? t('eda.step.noneNeeded') : t('eda.list.count', { complete: group.count.complete, needed: group.count.needed })}
          </span>
          {#if from}<span class="from">{t('eda.list.fromTile')}</span>{/if}
        </div>
        <p class="about">{t(STEP_TEXTS[group.step].about)}</p>
        {#each group.probes as probe (probe.key)}
          {@const state = listStateOf(probe)}
          {@const ask = askOf(probe.key, view.resource)}
          {@const asked = askedOf(probe)}
          {@const reading = state === 'added' ? overallReading(probe.lastRun?.results ?? []) : null}
          {#snippet row()}
            <span class="mark {state}"><Icon name={STATE_ICONS[state]} /></span>
            <span class="text">
              <b>{t(PROBE_TEXTS[probe.key])}</b>
              <span class="question"><Sentence key={ask.key} values={ask.values} names={ask.names} /></span>
              <span class="asked {asked}" class:quiet={state === 'added'}>{t(ASKED_TEXTS[asked])}</span>
            </span>
            <span class="state">
              {#if state === 'coming'}
                <small class="coming"><Icon name="hourglass-medium" />{t('eda.coming')}</small>
              {:else if state === 'added'}
                {#if reading}<span class="reading {READING_LOOK[reading].tone}">{t(READING_LOOK[reading].text)}</span>{/if}
                <small>{t('eda.standing.added')}</small>
              {:else}
                <span class="go">{t('eda.list.open')}<Icon name="arrow-right" /></span>
                {#if state === 'part'}<small>{partOf(probe)}</small>{/if}
              {/if}
            </span>
          {/snippet}
          {#if state === 'coming'}
            <div class="row coming" aria-disabled="true" title={t('eda.list.coming.title')}>{@render row()}</div>
          {:else}
            <a class="row" href={probePath(id, probe.key)}>{@render row()}</a>
          {/if}
        {/each}
      </section>
    {:else}
      <p class="meta none">{t('eda.list.none')}</p>
    {/each}
  </div>
  {#snippet foot()}
    <span class="meta stays"><Sentence key="eda.list.foot" names={{ type }} /></span>
    <Button variant="quiet" onclick={onclose}>{t('sheet.close')}</Button>
  {/snippet}
</Sheet>

<style>
  .over { margin-bottom: 4px; }
  .lead { display: inline-flex; font-size: 22px; color: var(--text-secondary); }
  .why { margin: 10px 0; font-size: var(--text-small); line-height: 1.55; color: var(--text-secondary); }
  .search { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: var(--radius-field); background: var(--surface-sub); color: var(--text-muted); font-size: 15px; }
  .search input { all: unset; flex: 1; min-width: 0; font: var(--text-small) var(--font-family); color: var(--text-primary); }
  .search input::placeholder { color: var(--text-muted); }
  .filters { margin: 10px 0 6px; }
  .list { position: relative; flex: 1; min-height: 0; overflow: auto; margin: 0 -6px; padding: 0 6px; }
  .group { padding: 10px 6px 6px; border-radius: var(--radius-md); }
  .group + .group { margin-top: 6px; }
  .group.at { background: color-mix(in srgb, var(--surface-sub) 70%, transparent); }
  .head { display: flex; align-items: baseline; gap: 10px; padding: 0 6px; }
  .head b { font-size: var(--text-body); font-weight: var(--weight-medium); }
  .count { font-size: var(--text-meta); color: var(--signal-warn); }
  .count.done { color: var(--col-teal-ink); }
  .from { margin-left: auto; font-size: var(--text-meta); color: var(--text-muted); }
  .about { margin: 2px 6px 6px; font-size: var(--text-meta); color: var(--text-muted); }
  .row { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; gap: 10px; align-items: start; padding: 9px 8px; border-radius: var(--radius-md); color: inherit; text-decoration: none; }
  a.row:hover { background: var(--tint-hover); }
  a.row:focus-visible { outline: 2px solid var(--text-secondary); outline-offset: -2px; }
  .mark { display: inline-flex; margin-top: 1px; font-size: 18px; color: var(--text-secondary); }
  .mark.added { color: var(--col-teal-ink); }
  .mark.part { color: var(--signal-warn); }
  .mark.coming { color: var(--text-muted); opacity: 0.7; }
  .text { display: grid; gap: 2px; min-width: 0; }
  .text b { font-size: var(--text-small); font-weight: var(--weight-medium); }
  .question { font-size: var(--text-meta); line-height: 1.45; color: var(--text-secondary); }
  .asked { font-size: 10.5px; color: var(--text-muted); }
  .asked.needed { color: var(--signal-warn); }
  .asked.quiet { color: var(--text-muted); }
  .row.coming b, .row.coming .question { color: var(--text-muted); }
  .state { display: grid; justify-items: end; gap: 2px; padding-top: 1px; white-space: nowrap; }
  .state small { font-size: 10.5px; color: var(--text-muted); }
  .go { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-meta); color: var(--text-primary); }
  small.coming { display: inline-flex; align-items: center; gap: 4px; }
  .reading { --tone-informative: var(--col-slate); font-size: 10.5px; font-weight: var(--weight-medium); }
  :global([data-theme='dark']) .reading { --tone-informative: color-mix(in srgb, var(--col-slate) 45%, var(--text-primary)); }
  .reading.healthy { color: var(--col-teal-ink); }
  .reading.attention { color: var(--signal-warn); }
  .reading.informative { color: var(--tone-informative); }
  .none { margin: 16px 6px; }
  .stays { flex: 1; min-width: 0; }
</style>

<script lang="ts">
  import { FIELD_STEPS, PROBES, type CoverState, type EdaView, type FieldStep, type ProbeKey } from '@datahub/contracts/eda';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import Sentence from '@datahub/ui/foundations/Sentence.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import { MARK_ICONS, markOf, PROBE_TEXTS, type ProbeStanding, standingOf, STEP_TEXTS, stillMissing } from '../lib/eda.js';
  import { probePath } from '../lib/routes.js';
  import { roleWords } from '../lib/typeFields.js';
  import EdaStatus from './EdaStatus.svelte';

  /**
   * The right of the tab Steps (DEC-UX-322): the Resource and the state of its EDA-Setup. How many needed EDA-Probes
   * are complete, as a number and a bar; what the EDA covers in its four places (DEC-ED-16); the best next step with
   * Add this EDA-Probe; the EDA-Probes on the table as a whole, added, needed, suggested or on request, and coming
   * while Data Hub does not run them (FR-ED-05); and per field, in the order of the Resource Card, what covers it per
   * EDA-Step, the Key Fields marked with a key and what they still need dashed (DEC-UX-323).
   */
  let { view }: { view: EdaView } = $props();

  const id = $derived(view.resource.id);
  const name = $derived(view.resource.displayName);
  const segments = $derived(Array.from({ length: view.needed.total }, (_, index) => index < view.needed.complete));
  const added = $derived(view.probes.some((probe) => probe.added));
  const missing = $derived(view.probes.find((probe) => probe.needed && probe.added && !probe.complete && stillMissing(probe).length > 0));
  const coming = $derived(view.probes.filter((probe) => probe.needed && !probe.runs).length);
  const grain = $derived(view.resource.fields.filter((field) => field.grain).map((field) => field.name).join(', '));
  const date = $derived(view.probes.find((probe) => probe.key === 'volumeOverTime' || probe.key === 'dateRange')?.applies.fields[0] ?? '');

  type Place = { icon: IconName; label: string; value: string; state: 'none' | 'part' | 'done' | 'muted' };
  const placeOf = (needed: number, complete: number): Place['state'] => (needed === 0 ? 'muted' : complete === needed ? 'done' : complete === 0 ? 'none' : 'part');
  const places: Place[] = $derived.by(() => {
    const { rows, keyFields, columns, resources } = view.coverage.places;
    const counted = (place: { needed: number; complete: number }) => (place.needed === 0 ? t('eda.place.noneNeeded') : t('eda.place.needed', { complete: place.complete, needed: place.needed }));
    return [
      { icon: 'rows', label: t('eda.place.rows'), value: counted(rows), state: placeOf(rows.needed, rows.complete) },
      {
        icon: 'columns',
        label: t('eda.place.keyFields'),
        value:
          keyFields.total === 0
            ? t('eda.place.noKeyFields')
            : keyFields.started > keyFields.complete
              ? t('eda.place.started', { started: keyFields.started, complete: keyFields.complete })
              : t('eda.place.complete', { complete: keyFields.complete, total: keyFields.total }),
        state: placeOf(keyFields.total, keyFields.complete),
      },
      { icon: 'arrows-left-right', label: t('eda.place.columns'), value: counted(columns), state: placeOf(columns.needed, columns.complete) },
      { icon: 'link', label: t('eda.place.resources'), value: counted(resources), state: placeOf(resources.needed, resources.complete) },
    ];
  });

  /** Why the best next step helps, in a sentence with the fields of this Resource. */
  const NEXT_TEXTS: Partial<Record<ProbeKey, string>> = {
    grainHolds: 'eda.next.grainHolds',
    nullsPerKeyField: 'eda.next.nullsPerKeyField',
    volumeOverTime: 'eda.next.volumeOverTime',
    distributionOfNumbers: 'eda.next.distributionOfNumbers',
    distributionOfCategories: 'eda.next.distributionOfCategories',
    dateRange: 'eda.next.dateRange',
    disguisedNulls: 'eda.next.disguisedNulls',
  };

  const STANDING_TEXTS: Record<ProbeStanding, string> = {
    added: 'eda.standing.added',
    needed: 'eda.standing.needed',
    suggested: 'eda.standing.suggested',
    onRequest: 'eda.standing.onRequest',
  };
  const STANDING_ICONS: Record<ProbeStanding, IconName> = { added: 'check-circle-fill', needed: 'circle-dashed', suggested: 'circle', onRequest: 'circle' };
  const table = $derived(view.probes.filter((probe) => PROBES[probe.key].place === 'rows'));

  const STEP_SHORT: Record<FieldStep, string> = {
    gaps: 'eda.step.gaps.short',
    weight: 'eda.step.weight.short',
    correctness: 'eda.step.correctness.short',
    relations: 'eda.step.relations.short',
  };
  const COVER_TEXTS: Record<CoverState, string> = { covered: 'eda.cover.covered', needed: 'eda.cover.needed', free: 'eda.cover.free', none: 'eda.cover.none' };
  /** The four states of a field in an EDA-Step, as the legend names them. */
  const LEGEND: readonly { state: CoverState; text: string }[] = [
    { state: 'covered', text: 'eda.cover.covered.legend' },
    { state: 'needed', text: 'eda.cover.needed.legend' },
    { state: 'free', text: 'eda.cover.free.legend' },
    { state: 'none', text: 'eda.cover.none.legend' },
  ];
  const fields = $derived(
    view.coverage.fields.map((cover) => {
      const field = view.resource.fields.find((one) => one.name === cover.name);
      return { cover, field };
    }),
  );
</script>

<aside class="side" aria-label={t('eda.setup')}>
  <section class="tile">
    <div class="top"><h3>{t('eda.setup')}</h3><EdaStatus status={view.status} /></div>
    <p class="big"><b>{t('eda.setup.of', { complete: view.needed.complete, total: view.needed.total })}</b> {t('eda.setup.complete')}</p>
    {#if segments.length > 0}
      <div class="bar" role="img" aria-label={t('eda.setup.progress', { complete: view.needed.complete, total: view.needed.total })}>
        {#each segments as on, index (index)}<span class:on></span>{/each}
      </div>
    {/if}
    <p class="meta lead">
      {#if view.status === 'explored'}
        {t('eda.setup.done', { name })}
      {:else}
        {t('eda.setup.todo', { name })}
        {#if !added}{t('eda.setup.none')}{:else if missing}<Sentence key="eda.setup.misses" values={{ probe: t(PROBE_TEXTS[missing.key]) }} names={{ fields: stillMissing(missing).join(', ') }} />{/if}
        {#if coming > 0}{t('eda.setup.coming', { count: coming })}{/if}
      {/if}
    </p>
    <ul class="places">
      {#each places as place (place.label)}
        <li class={place.state}><Icon name={place.icon} /><span>{place.label}</span><b>{place.value}</b></li>
      {/each}
    </ul>
    {#if view.next}
      {@const next = view.next}
      {@const why = NEXT_TEXTS[next]}
      <div class="next">
        <span class="meta">{t('eda.next')}</span>
        <b>{t(PROBE_TEXTS[next])}</b>
        {#if why}<p><Sentence key={why} names={{ grain, date }} /></p>{/if}
        <Button href={probePath(id, next)}><Icon name="plus" />{t('eda.next.add')}</Button>
      </div>
    {:else if view.status !== 'explored'}
      <div class="next">
        <span class="meta">{t('eda.next')}</span>
        <p>{t('eda.next.coming')}</p>
      </div>
    {/if}
  </section>

  <section class="tile">
    <h3>{t('eda.table')}</h3>
    <ul class="table">
      {#each table as probe (probe.key)}
        {@const standing = standingOf(probe)}
        <li class={standing}>
          <Icon name={STANDING_ICONS[standing]} />
          {#if probe.runs}<a href={probePath(id, probe.key)}>{t(PROBE_TEXTS[probe.key])}</a>{:else}<span>{t(PROBE_TEXTS[probe.key])}</span>{/if}
          <small>{t(STANDING_TEXTS[standing])}{#if !probe.runs}{' · '}{t('eda.coming')}{/if}</small>
        </li>
      {/each}
    </ul>
  </section>

  <section class="tile">
    <div class="top">
      <h3>{t('eda.fields')}</h3>
      <span class="steps">{#each FIELD_STEPS as step (step)}<span title={t(STEP_TEXTS[step].name)}>{t(STEP_SHORT[step])}</span>{/each}</span>
    </div>
    <p class="meta lead">{t('eda.fields.about')}</p>
    <ul class="fields">
      {#each fields as { cover, field } (cover.name)}
        <li class:key={cover.keyField}>
          {#if cover.keyField}<span class="mark" title={t('resource.role.keyField')}><Icon name="key-fill" label={t('resource.role.keyField')} /></span>{:else}<span></span>{/if}
          <span class="kind" title={field?.dataType ?? ''}><Icon name={field ? MARK_ICONS[markOf(field)] : 'tag'} /></span>
          <span class="name"><span class="mono">{cover.name}</span>{#if field?.role}<small>{roleWords(field.role)}</small>{:else if field?.mapped}<small>{t('eda.field.mapped')}</small>{/if}</span>
          <span class="cells">
            {#each FIELD_STEPS as step (step)}
              <span class="cell {cover.steps[step]}" role="img" aria-label="{t(STEP_TEXTS[step].name)}: {t(COVER_TEXTS[cover.steps[step]])}" title="{t(STEP_TEXTS[step].name)}: {t(COVER_TEXTS[cover.steps[step]])}"></span>
            {/each}
          </span>
        </li>
      {/each}
    </ul>
    <div class="legend">
      {#each LEGEND as { state, text } (state)}
        <span><span class="cell {state}"></span>{t(text)}</span>
      {/each}
    </div>
  </section>
</aside>

<style>
  .side { display: flex; flex-direction: column; gap: 10px; position: sticky; top: 0; min-width: 0; }
  .tile { padding: 16px 18px; border-radius: var(--radius-md); background: var(--surface-sub); }
  h3 { font-size: 14px; font-weight: var(--weight-medium); margin: 0; }
  .top { display: flex; align-items: center; gap: 8px; }
  .top h3 { flex: 1; }
  .lead { display: block; margin: 6px 0 0; line-height: 1.5; }
  .big { margin: 10px 0 8px; font-size: var(--text-small); color: var(--text-secondary); }
  .big b { font-size: 22px; font-weight: var(--weight-medium); color: var(--text-primary); margin-right: 4px; }
  .bar { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 3px; }
  .bar span { height: 8px; border-radius: var(--radius-mark); background: color-mix(in srgb, var(--text-muted) 22%, transparent); }
  .bar span.on { background: var(--col-teal); }
  .places { list-style: none; margin: 12px 0 0; padding: 0; }
  .places li { display: grid; grid-template-columns: 20px 1fr auto; gap: 8px; align-items: center; padding: 6px 0; border-top: 1px solid var(--tint-active); font-size: var(--text-small); }
  .places li > :global(.icon) { color: var(--text-muted); font-size: 15px; }
  .places b { font-weight: var(--weight-medium); font-size: var(--text-meta); }
  .places .part b, .places .none b { color: var(--signal-warn); }
  .places .muted b { color: var(--text-muted); font-weight: var(--weight-regular); }
  .places .done b { color: var(--col-teal-ink); }
  .next { margin-top: 12px; padding: 12px; border-radius: var(--radius-md); background: var(--surface-solid); font-size: var(--text-small); }
  .next .meta { display: block; margin-bottom: 2px; }
  .next b { font-weight: var(--weight-medium); }
  .next p { margin: 4px 0 10px; color: var(--text-secondary); line-height: 1.5; }
  .table { list-style: none; margin: 8px 0 0; padding: 0; }
  .table li { display: grid; grid-template-columns: 18px 1fr auto; gap: 8px; align-items: center; padding: 5px 0; font-size: var(--text-small); }
  .table a { color: inherit; text-decoration: none; }
  .table a:hover { text-decoration: underline; text-underline-offset: 3px; }
  .table small { font-size: var(--text-meta); color: var(--text-muted); text-align: right; }
  .table .added > :global(.icon) { color: var(--col-teal-ink); }
  .table .needed > :global(.icon), .table .needed small { color: var(--signal-warn); }
  .table .suggested > :global(.icon), .table .onRequest > :global(.icon) { color: var(--text-muted); }
  .table .onRequest span, .table .onRequest a { color: var(--text-muted); }
  .steps { display: grid; grid-template-columns: repeat(4, 14px); gap: 4px; font-size: 10px; color: var(--text-muted); text-align: center; }
  .fields { list-style: none; margin: 10px 0 0; padding: 0; }
  .fields li { display: grid; grid-template-columns: 14px 16px 1fr auto; gap: 6px; align-items: center; padding: 6px 0; border-top: 1px solid var(--tint-active); }
  .mark { font-size: 12px; color: var(--text-primary); display: inline-flex; }
  .kind { font-size: 14px; color: var(--text-muted); display: inline-flex; }
  .fields li:not(.key) .kind { opacity: .6; }
  .name { min-width: 0; font-size: 12.5px; color: var(--text-muted); }
  .key .name .mono { color: var(--text-primary); font-weight: var(--weight-medium); }
  .name small { display: block; font-size: 10.5px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cells { display: grid; grid-template-columns: repeat(4, 14px); gap: 4px; }
  .cell { display: inline-block; width: 14px; height: 14px; border-radius: var(--radius-mark); }
  .cell.covered { background: var(--col-teal); }
  .cell.needed { border: 1.5px dashed var(--signal-warn); }
  .cell.free { background: color-mix(in srgb, var(--text-muted) 16%, transparent); }
  .cell.none { border: 1px solid color-mix(in srgb, var(--text-muted) 25%, transparent);
    background-image: linear-gradient(135deg, transparent 45%, color-mix(in srgb, var(--text-muted) 45%, transparent) 45%, color-mix(in srgb, var(--text-muted) 45%, transparent) 55%, transparent 55%); }
  .legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; font-size: 10.5px; color: var(--text-muted); }
  .legend > span { display: inline-flex; gap: 5px; align-items: center; }
  .legend .cell { width: 11px; height: 11px; }
  @media (max-width: 1180px) { .side { position: static; } }
</style>

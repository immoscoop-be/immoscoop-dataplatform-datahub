<script lang="ts">
  import { DISGUISED_DEFAULTS, PROBES, type CategoriesResult, type DisguisedLists, type DistributionResult, type EdaField, type EdaView, type OwnerReading, type ProbeKey } from '@datahub/contracts/eda';
  import { kindOf } from '@datahub/contracts/model-types';
  import RunButton from '@datahub/ui/components/RunButton.svelte';
  import MenuButton, { type MenuChoice } from '@datahub/ui/containers/MenuButton.svelte';
  import { formatBytes } from '@datahub/ui/foundations/bytes.js';
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import Sentence from '@datahub/ui/foundations/Sentence.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import LearningRef from './LearningRef.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import { disguisedListsOf, type EdaClient, MARK_ICONS, markOf, number, PROBE_ABOUT, PROBE_TERMS, PROBE_TEXTS, type RunAsk, sameLists, STEP_TEXTS } from '../lib/eda.js';
  import { when } from '../lib/moment.js';
  import { digPath, edaPath } from '../lib/routes.js';
  import EdaDisguisedLists from './EdaDisguisedLists.svelte';
  import EdaDrawing from './EdaDrawing.svelte';
  import EdaResult from './EdaResult.svelte';

  /**
   * The detail of an EDA-Probe (DEC-UX-324, FR-ED-06), in the tab Steps in place of its rows; the state of the
   * EDA-Setup belongs to those rows and is not repeated. On the left, 40%: what it does, with its drawing, which comes in
   * once and again on Replay; why it matters; its parameters, the fields it is set on among them; and Run, which adds it
   * to the EDA and runs it now, then Run again. A run reads through query as the User: above what runs freely the User
   * approves it, as for a query, and above what they may approve it does not run, with why. The left column folds to a
   * strip. On the right, 60%: before a run, where its result will come; after, the result of its last run, drawn by a
   * component of its own from the run alone (FR-ED-07 to FR-ED-11, OP-ED-12), whose rows with something to read lead to
   * Dig into (FR-ED-20).
   */
  let {
    view,
    probe,
    client,
    onview,
    go,
  }: {
    view: EdaView;
    probe: ProbeKey;
    client: EdaClient;
    /** The EDA as eda answers it after a run or a reading. */
    onview: (view: EdaView) => void;
    /** Goes to an address of the app, for Dig into a value chosen from a menu. */
    go?: (path: string) => void;
  } = $props();

  const language = $derived(currentLanguage());
  const id = $derived(view.resource.id);
  const spec = $derived(PROBES[probe]);
  const shown = $derived(view.probes.find((one) => one.key === probe));
  const name = $derived(t(PROBE_TEXTS[probe]));
  const lastRun = $derived(shown?.lastRun ?? null);
  const fieldsByName = $derived(new Map(view.resource.fields.map((field) => [field.name, field] as const)));
  const grain = $derived(view.resource.fields.filter((field) => field.grain).map((field) => field.name));

  // The left column: folded to a strip, and its drawing, which comes in once and again on Replay.
  let folded = $state(false);
  let play = $state(1);

  // The fields it is set on: as added, else as it applies to this Resource; more can be added, needed ones stay.
  // svelte-ignore state_referenced_locally
  let fields = $state<string[]>([...(shown?.added && shown.fields.length > 0 ? shown.fields : (shown?.applies.fields ?? []))]);
  const needs = $derived(shown?.applies.needs ?? []);
  /** Which fields an EDA-Probe can be set on besides those it needs: any field, the dates, the numbers or the texts (DEC-ED-17). */
  const FITS: Partial<Record<ProbeKey, 'any' | 'date' | 'number' | 'text'>> = {
    nullsPerKeyField: 'any',
    disguisedNulls: 'any',
    volumeOverTime: 'date',
    dateRange: 'date',
    distributionOfNumbers: 'number',
    distributionOfCategories: 'text',
  };
  const fits = (field: EdaField): boolean => {
    const kind = FITS[probe];
    return kind === 'any' || (kind !== undefined && kindOf(field.dataType) === kind);
  };
  /** The EDA-Probes set on dates, which add a date rather than a field. */
  const onDates = $derived(probe === 'volumeOverTime' || probe === 'dateRange');
  const addable = $derived(view.resource.fields.filter((field) => fits(field) && !fields.includes(field.name)));
  const choices: MenuChoice[] = $derived(
    addable.map((field) => ({ key: field.name, icon: MARK_ICONS[markOf(field)], label: field.name, run: () => (fields = view.resource.fields.map((one) => one.name).filter((one) => one === field.name || fields.includes(one))) })),
  );
  const chipIcon = (field: string): IconName => {
    if (probe === 'grainHolds') return 'fingerprint';
    const known = fieldsByName.get(field);
    if (!onDates && known?.keyField) return 'key';
    return known ? MARK_ICONS[markOf(known)] : 'tag';
  };

  // The bins of Distribution of numbers, which the User may change per field (DEC-ED-24): what was typed, else what
  // the EDA-Probe was set on, else what Data Hub chose in its last run. eda takes them as a number per field.
  let bins = $state<Record<string, { width?: string; tailFrom?: string }>>({});
  /** A parameter as the EDA-Probe was set on it: one number for every field, or one per field. */
  const setTo = (name: 'width' | 'tailFrom', field: string): number | undefined => {
    const value = shown?.params[name];
    return typeof value === 'number' ? value : typeof value === 'object' && value !== null ? (value as Record<string, number>)[field] : undefined;
  };
  const binsOf = (field: string) => {
    const data = lastRun?.results.find((result) => result.subject === field)?.data as DistributionResult | undefined;
    const known = (name: 'width' | 'tailFrom') => bins[field]?.[name] ?? String(setTo(name, field) ?? data?.[name] ?? '');
    return { width: known('width'), tailFrom: known('tailFrom'), start: data?.start ?? 0 };
  };
  function setBin(field: string, part: 'width' | 'tailFrom', value: string): void {
    bins = { ...bins, [field]: { ...bins[field], [part]: value } };
  }

  // Volume over time: the field whose sum is the volume, for an aggregate or a fact, and whether weekends may be empty.
  const addingRole = $derived(view.resource.modelType === 'aggregate' ? 'addsUp' : view.resource.modelType === 'fact' ? 'measure' : null);
  const adding = $derived(view.resource.fields.filter((field) => addingRole !== null && field.role === addingRole));
  /** The field that adds up, as eda takes it: the one set, or the first Key Field that adds up, else the first. */
  const measure = $derived(
    typeof shown?.params.measure === 'string' ? shown.params.measure : ((adding.find((field) => field.keyField) ?? adding[0])?.name ?? null),
  );
  // svelte-ignore state_referenced_locally
  let summed = $state(shown?.params.measure !== null);
  // svelte-ignore state_referenced_locally
  let weekends = $state(shown?.params.mayBeEmpty === 'weekends');
  /** The unit of a date: the week from a Monday for the period of an aggregate, a day otherwise (DEC-ED-23). */
  const weekly = (field: string | undefined) => (field ? fieldsByName.get(field)?.role === 'period' : false);
  const daily = $derived(fields.some((field) => !weekly(field)));

  // Distribution of categories: what it weighs each value by, a number that adds up, its role first, or rows (DEC-ED-33).
  // eda takes it as the name of a field, or null for rows; left out, eda starts from the number that adds up.
  const weighers = $derived.by(() => {
    const names = adding.map((field) => field.name);
    const set = shown?.params.weighedBy;
    return typeof set === 'string' && !names.includes(set) ? [...names, set] : names;
  });
  /** What it is weighed by now: as it was set, else as its last run weighed it, else the first Key Field that adds up. */
  const weighedNow = $derived.by((): string | null => {
    const set = shown?.params.weighedBy;
    if (typeof set === 'string' || set === null) return set;
    const ran = (lastRun?.results[0]?.data as CategoriesResult | undefined)?.weighedBy;
    if (ran !== undefined) return ran;
    return (adding.find((field) => field.keyField) ?? adding[0])?.name ?? null;
  });
  // svelte-ignore state_referenced_locally
  let weighedChoice = $state<string>(weighedNow ?? '');
  const weighed = $derived(weighedChoice === '' ? null : weighedChoice);
  const unique = $derived(view.resource.fields.find((field) => field.role === 'uniqueCount')?.name ?? null);

  // Disguised nulls: the values it looks for, kept per EDA as its parameters (DEC-ED-35): as it was set, else Data Hub's.
  // svelte-ignore state_referenced_locally
  let lists = $state<DisguisedLists>(disguisedListsOf(shown?.params));

  /** The parameters of the run: what the User changed, as eda takes them. */
  const params = $derived.by((): Record<string, unknown> | undefined => {
    if (probe === 'disguisedNulls') return shown?.params.lists !== undefined || !sameLists(lists, DISGUISED_DEFAULTS) ? { lists: $state.snapshot(lists) } : undefined;
    if (probe === 'volumeOverTime') {
      const set = { ...(measure && !summed ? { measure: null } : {}), ...(measure && summed && shown?.params.measure !== undefined ? { measure } : {}), ...(weekends && daily ? { mayBeEmpty: 'weekends' } : {}) };
      return Object.keys(set).length > 0 ? set : undefined;
    }
    if (probe === 'distributionOfCategories') return shown?.params.weighedBy !== undefined || weighed !== weighedNow ? { weighedBy: weighed } : undefined;
    if (probe !== 'distributionOfNumbers') return undefined;
    const per = (name: 'width' | 'tailFrom') =>
      Object.fromEntries(
        fields.flatMap((field) => {
          const typed = bins[field]?.[name] ?? (setTo(name, field) === undefined ? undefined : String(setTo(name, field)));
          const value = typed === undefined || typed.trim() === '' ? Number.NaN : Number(typed);
          return Number.isFinite(value) && (name !== 'width' || value > 0) ? [[field, value] as const] : [];
        }),
      );
    const width = per('width');
    const tailFrom = per('tailFrom');
    const set = { ...(Object.keys(width).length > 0 ? { width } : {}), ...(Object.keys(tailFrom).length > 0 ? { tailFrom } : {}) };
    return Object.keys(set).length > 0 ? set : undefined;
  });

  // A run: it ran, it waits for the approval of the User, or it does not run, with why.
  let running = $state(false);
  let approve = $state<number | null>(null);
  let refused = $state<string | null>(null);
  let failed = $state(false);

  async function run(approved = false): Promise<void> {
    running = true;
    refused = null;
    failed = false;
    const ask: RunAsk = { fields: [...fields], ...(params ? { params } : {}), ...(approved ? { approve: true } : {}) };
    try {
      const answer = await client.run(id, probe, ask);
      if (answer.state === 'ran') {
        approve = null;
        onview(answer.eda);
      } else if (answer.state === 'approve') {
        approve = answer.bytes;
      } else {
        approve = null;
        refused = answer.reason || t('eda.run.refused.unknown');
      }
    } catch (error) {
      console.error(`${probe} could not run`, error);
      failed = true;
    } finally {
      running = false;
    }
  }

  async function read(subject: string, reading: OwnerReading): Promise<boolean> {
    try {
      onview(await client.read(id, probe, subject, reading));
      return true;
    } catch (error) {
      console.error(`The reading of ${subject || 'the table'} could not be kept`, error);
      return false;
    }
  }

  const BLOCK_TEXTS: Readonly<Record<string, string>> = { noGrain: 'eda.block.noGrain', noRoleDate: 'eda.block.noRoleDate', nothing: 'eda.block.nothing' };
  const blocked = $derived(shown?.applies.block ?? null);

  const PLACE_TEXTS = { rows: 'eda.placeWord.rows', column: 'eda.placeWord.column', columns: 'eda.placeWord.columns', resource: 'eda.placeWord.resource' } as const;
  const LEVEL_TEXTS = { must: 'eda.level.must', should: 'eda.level.should', could: 'eda.level.could' } as const;

  const about = $derived(PROBE_ABOUT[probe]);
  /** The EDA-Probes on every Key Field, needed or not, whose fields say no "needed" of their own. */
  /** The term of the dictionary its name holds, whose ⓘ its title carries (DEC-UX-340). */
  const term = $derived(PROBE_TERMS[probe]);
  const onKeyFields = $derived(probe === 'nullsPerKeyField' || probe === 'disguisedNulls');
</script>

<a class="back" href={edaPath(id)}><Icon name="arrow-left" /><span>{t('eda.detail.back')}</span></a>
<header class="head">
  <span class="meta">{t(STEP_TEXTS[spec.step].name)} · {t(PLACE_TEXTS[spec.place])} · {t(shown?.needed ? 'eda.level.needed' : shown ? LEVEL_TEXTS[shown.level] : 'eda.level.could')}</span>
  {#if term}
    <h2><LearningRef place={term}>{#snippet children(mark)}<span>{name}{@render mark?.()}</span>{/snippet}</LearningRef></h2>
  {:else}<h2>{name}</h2>{/if}
</header>

{#if !shown || !about || !shown.runs}
  <section class="empty">
    <Icon name="hourglass-medium" />
    <b>{t('eda.detail.coming')}</b>
    <p>{t('eda.detail.coming.text')}</p>
  </section>
{:else}
  <div class="grid" class:folded class:ran={lastRun !== null}>
    <section class="about" aria-label={t('eda.detail.about')}>
      {#if folded}
        <button type="button" class="unfold" onclick={() => ((folded = false), (play += 1))} title={t('eda.detail.unfold')}><Icon name="caret-double-right" /><span>{t('eda.detail.about')}</span></button>
      {:else}
        <button type="button" class="fold" aria-expanded="true" title={t('eda.detail.fold')} aria-label={t('eda.detail.fold')} onclick={() => (folded = true)}><Icon name="caret-double-left" /></button>
        <figure class="drawing">
          <EdaDrawing {probe} fields={view.resource.fields} setOn={fields} {play} label={t('eda.detail.drawing', { name })} />
          <button type="button" class="replay" onclick={() => (play += 1)}><Icon name="arrow-counter-clockwise" />{t('eda.detail.replay')}</button>
        </figure>
        <h4>{t('eda.detail.does')}</h4>
        <p><Sentence key={about.does} names={{ grain: grain.join(', ') }} /></p>
        <h4>{t('eda.detail.why')}</h4>
        <p>{t(about.why)}</p>
        <div class="params">
          <h4>{t('eda.params')}</h4>
          <dl>
            <div>
              <dt>{t('eda.params.setOn')}</dt>
              <dd>
                {#each fields as field (field)}
                  <span class="chip"><Icon name={chipIcon(field)} /><span class="mono">{field}</span>{#if probe !== 'grainHolds' && !onKeyFields && needs.includes(field)}<span class="note">{t('eda.params.needed')}</span>{/if}{#if !needs.includes(field) && probe !== 'grainHolds'}<button type="button" class="remove" aria-label={t('eda.params.remove', { field })} onclick={() => (fields = fields.filter((one) => one !== field))}><Icon name="x" /></button>{/if}</span>
                {/each}
                {#if fields.length === 0}<span class="none">{t('eda.params.setOn.none')}</span>{/if}
                <small>{t(about.setOn)}</small>
                {#if choices.length > 0}
                  <span class="add"><MenuButton icon="plus" variant="outline" align="start" text={t(onDates ? 'eda.params.addDate' : 'eda.params.addField')} label={t(onDates ? 'eda.params.addDate' : 'eda.params.addField')} {choices} /></span>
                {/if}
              </dd>
            </div>
            {#if probe === 'grainHolds'}
              <div><dt>{t('eda.params.own')}</dt><dd><Sentence key="eda.params.grain.own" names={{ grain: grain.join(', ') }} /></dd></div>
            {:else if probe === 'nullsPerKeyField'}
              <div><dt>{t('eda.params.own')}</dt><dd>{t('eda.params.nulls.own')}</dd></div>
            {:else if probe === 'disguisedNulls'}
              <div>
                <dt>{t('eda.params.lookFor')}</dt>
                <dd><EdaDisguisedLists {lists} onchange={(next) => (lists = next)} /></dd>
              </div>
            {:else if probe === 'volumeOverTime'}
              <div><dt>{t('eda.params.counted')}</dt><dd>{t(daily ? 'eda.params.volume.day' : 'eda.params.volume.week')}</dd></div>
              <div>
                <dt>{t('eda.params.counts')}</dt>
                <dd>
                  <span class="check"><Icon name="check-square-fill" /><span>{t(daily ? 'eda.params.volume.rows.day' : 'eda.params.volume.rows.week')}</span></span>
                  {#if measure}
                    <label class="check"><input type="checkbox" bind:checked={summed} /><span><Sentence key="eda.params.volume.sum" names={{ field: measure }} /></span></label>
                  {/if}
                </dd>
              </div>
              <div>
                <dt>{t('eda.params.mayBeEmpty')}</dt>
                {#if daily}
                  <dd><label class="check"><input type="checkbox" bind:checked={weekends} /><span>{t('eda.params.volume.weekends')}</span></label><small>{t('eda.params.volume.empty.day')}</small></dd>
                {:else}
                  <dd class="quiet">{t('eda.params.volume.empty.week')}</dd>
                {/if}
              </div>
            {:else if probe === 'distributionOfNumbers'}
              <div>
                <dt>{t('eda.params.bins')}</dt>
                <dd>
                  {#each fields as field (field)}
                    {@const now = binsOf(field)}
                    <span class="bins">
                      {#if fields.length > 1}<span class="mono">{field}</span>{/if}
                      {t('eda.params.bins.width')}
                      <input {...NO_PASSWORD_MANAGER} type="number" min="0" step="any" aria-label={t('eda.params.bins.widthOf', { field })} value={now.width} placeholder={t('eda.params.bins.auto')} oninput={(event) => setBin(field, 'width', event.currentTarget.value)} />
                      {t('eda.params.bins.from', { start: number(now.start, language) })}
                      <input {...NO_PASSWORD_MANAGER} type="number" step="any" aria-label={t('eda.params.bins.tailOf', { field })} value={now.tailFrom} placeholder={t('eda.params.bins.auto')} oninput={(event) => setBin(field, 'tailFrom', event.currentTarget.value)} />
                      {t('eda.params.bins.tail')}
                    </span>
                  {/each}
                  <small>{t('eda.params.bins.about')}</small>
                </dd>
              </div>
            {:else if probe === 'distributionOfCategories'}
              <div>
                <dt>{t('eda.params.weighedBy')}</dt>
                <dd>
                  {#if weighers.length > 0}
                    <select class="weigh" aria-label={t('eda.params.weighedBy')} bind:value={weighedChoice}>
                      {#each weighers as field (field)}<option value={field}>{t('eda.params.categories.sum', { field })}</option>{/each}
                      <option value="">{t('eda.params.categories.rows')}</option>
                    </select>
                    <small>
                      {t('eda.params.categories.weighedBy')}{#if addingRole}{' '}{t('eda.params.categories.rowsAlike')}{/if}{#if unique}{' '}<Sentence key="eda.params.categories.unique" names={{ field: unique }} />{/if}
                    </small>
                  {:else}
                    {t('eda.params.categories.rows')}<small>{t('eda.params.categories.noSum')}</small>
                  {/if}
                </dd>
              </div>
              <div><dt>{t('eda.params.shows')}</dt><dd>{t('eda.params.categories.shows')}</dd></div>
            {:else if probe === 'dateRange'}
              <div><dt>{t('eda.params.upToDate')}</dt><dd>{t(daily ? 'eda.params.dateRange.day' : 'eda.params.dateRange.week')}</dd></div>
            {/if}
            <div>
              <dt>{t('eda.params.reads')}</dt>
              <dd>
                {#if fields.length > 0}<Sentence key="eda.params.reads.fields" names={{ fields: [...fields, ...(probe === 'distributionOfCategories' && weighed ? [weighed] : [])].join(', ') }} />{:else}{t('eda.params.reads.table')}{/if}
                {#if lastRun}{' '}{t('eda.params.reads.last', { bytes: formatBytes(lastRun.bytes, language) })}{/if}
              </dd>
            </div>
            {#if probe === 'nullsPerKeyField'}
              <div><dt>{t('eda.params.notHere')}</dt><dd class="quiet">{t('eda.params.nulls.not')}</dd></div>
            {:else if probe === 'disguisedNulls'}
              <div><dt>{t('eda.params.notHere')}</dt><dd class="quiet">{t('eda.params.disguised.not')}</dd></div>
            {:else if probe === 'distributionOfNumbers'}
              <div><dt>{t('eda.params.notHere')}</dt><dd class="quiet">{t('eda.params.distribution.not')}</dd></div>
            {:else if probe === 'distributionOfCategories'}
              <div><dt>{t('eda.params.notHere')}</dt><dd class="quiet">{t('eda.params.categories.not')}</dd></div>
            {:else if probe === 'dateRange'}
              <div><dt>{t('eda.params.notHere')}</dt><dd class="quiet">{t('eda.params.dateRange.not', { unit: daily ? 'day' : 'week' })}</dd></div>
            {/if}
          </dl>
        </div>
        <div class="run">
          {#if blocked}
            <Button disabled><Icon name="play-fill" />{t('eda.run')}</Button>
            <p class="note" role="status"><Icon name="warning-circle-fill" />{t(BLOCK_TEXTS[blocked] ?? 'eda.block.nothing')}</p>
          {:else if approve !== null}
            <RunButton bytes={approve} approve busy={running} onclick={() => run(true)} />
            <span class="meta">{t('eda.run.approve', { bytes: formatBytes(approve, language) })}</span>
          {:else}
            <Button variant={lastRun ? 'quiet' : 'primary'} disabled={running || fields.length === 0} onclick={() => run()}><Icon name="play-fill" />{t(lastRun ? 'eda.run.again' : 'eda.run')}</Button>
            {#if running}
              <span class="meta">{t('eda.run.running')} <Loading inline /></span>
            {:else if lastRun}
              <span class="meta">{t('eda.run.last', { when: when(lastRun.ranAt, language), name: lastRun.ranBy.name })}</span>
            {:else}
              <span class="meta">{t('eda.run.adds')}</span>
            {/if}
          {/if}
          {#if refused}<p class="note" role="alert"><Icon name="warning-fill" />{t('eda.run.refused', { reason: refused })}</p>{/if}
          {#if failed}<p class="note" role="alert"><Icon name="warning-fill" />{t('eda.run.failed')}</p>{/if}
        </div>
      {/if}
    </section>

    <div class="right">
      {#if !lastRun}
        <section class="empty">
          <Icon name="play-circle" />
          <b>{t('eda.detail.resultHere')}</b>
          <p><Sentence key={about.empty} values={{ name: view.resource.displayName }} names={{ grain: grain.join(', ') }} /></p>
        </section>
      {:else}
        <EdaResult {probe} run={lastRun} resource={view.resource} onread={read} digHref={(selection) => digPath(id, selection, probe)} {go} />
      {/if}
    </div>
  </div>
{/if}

<style>
  .back { display: inline-flex; align-items: center; gap: 5px; margin-bottom: 10px; font-size: var(--text-small); color: var(--text-secondary); text-decoration: none; }
  .back:hover span { text-decoration: underline; text-underline-offset: 3px; }
  .head { display: flex; flex-direction: column; gap: 2px; margin-bottom: 12px; }
  .head h2 { font-size: 20px; font-weight: var(--weight-medium); margin: 0; }
  .grid { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 6fr); gap: 16px; align-items: start; }
  .grid.folded { grid-template-columns: 44px minmax(0, 1fr); }
  .about { position: relative; padding: 14px 16px 16px; border-radius: var(--radius-md); background: var(--surface-sub); min-width: 0; }
  .folded .about { padding: 6px 0; display: flex; justify-content: center; }
  .fold { position: absolute; right: 8px; top: 8px; width: 28px; height: 28px; display: grid; place-items: center; border: 0; background: none; cursor: pointer;
    border-radius: var(--radius-pill); color: var(--text-muted); }
  .fold:hover, .unfold:hover, .replay:hover { color: var(--text-primary); background: var(--tint-hover); }
  .unfold { display: inline-flex; writing-mode: vertical-rl; gap: 8px; align-items: center; border: 0; background: none; cursor: pointer; font: var(--text-small) var(--font-family);
    color: var(--text-secondary); padding: 10px 0; border-radius: var(--radius-md); }
  .unfold :global(.icon) { writing-mode: horizontal-tb; }
  /* Replay stands in a strip of its own above the drawing, clear of the names of its columns. */
  .drawing { margin: 0 32px 0 0; padding: 26px 8px 8px; border-radius: var(--radius-md); background: var(--surface-solid); position: relative; max-width: 300px; }
  .replay { position: absolute; right: 8px; top: 6px; display: inline-flex; gap: 4px; align-items: center; border: 0; background: none; cursor: pointer;
    font: var(--text-meta) var(--font-family); color: var(--text-muted); padding: 2px 6px; border-radius: var(--radius-pill); }
  h4 { font-size: var(--text-small); font-weight: var(--weight-medium); margin: 12px 0 4px; }
  .about p { margin: 0; font-size: var(--text-small); line-height: 1.55; color: var(--text-secondary); }
  .params { margin-top: 14px; padding-top: 4px; border-top: 1px solid var(--tint-active); }
  dl { margin: 6px 0 0; display: grid; gap: 8px; }
  .params dl > div { display: grid; grid-template-columns: 74px 1fr; gap: 10px; font-size: var(--text-small); }
  .params dt { color: var(--text-muted); }
  .params dd { margin: 0; color: var(--text-secondary); line-height: 1.5; min-width: 0; }
  .params dd small { display: block; color: var(--text-muted); font-size: var(--text-meta); margin-top: 4px; }
  .params dd.quiet { color: var(--text-muted); }
  .chip { display: inline-flex; gap: 5px; align-items: center; margin: 0 6px 4px 0; padding: 2px 8px; border-radius: var(--radius-chip); background: var(--surface-solid);
    font-size: 12px; color: var(--text-primary); }
  .chip .note { margin-left: 2px; font-size: 10.5px; color: var(--text-muted); }
  .remove { display: inline-grid; place-items: center; border: 0; background: none; cursor: pointer; padding: 0; color: var(--text-muted); }
  .remove:hover { color: var(--text-primary); }
  .none { color: var(--text-muted); }
  .add { display: block; margin-top: 6px; }
  .check { display: flex; gap: 6px; align-items: flex-start; padding: 2px 0; }
  .check :global(.icon) { margin-top: 3px; color: var(--text-primary); }
  .check input { margin: 3px 0 0; accent-color: var(--text-primary); }
  label.check { cursor: pointer; }
  .bins { display: block; }
  .bins + .bins { margin-top: 4px; }
  .bins input { width: 64px; padding: 1px 6px; margin: 0 2px; border-radius: var(--radius-sm); border: 1px solid var(--tint-active); background: var(--surface-solid);
    font: var(--text-small) var(--font-family); color: var(--text-primary); }
  .run { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
  .note { display: flex; gap: 6px; align-items: flex-start; width: 100%; margin: 0; font-size: var(--text-small); line-height: 1.5; color: var(--signal-warn); }
  .note :global(.icon) { margin-top: 3px; flex: none; }
  .right { min-width: 0; }
  .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 420px; padding: 24px; text-align: center;
    border-radius: var(--radius-md); border: 1.5px dashed color-mix(in srgb, var(--text-muted) 45%, transparent); color: var(--text-secondary); }
  .empty > :global(.icon) { font-size: 30px; color: var(--text-muted); }
  .empty b { font-weight: var(--weight-medium); color: var(--text-primary); }
  .empty p { margin: 0; max-width: 40ch; font-size: var(--text-small); line-height: 1.5; }
  .weigh { max-width: 100%; font: var(--text-small) var(--font-family); padding: 5px 8px; border-radius: var(--radius-sm); border: 1px solid var(--tint-active); background: var(--surface-solid); color: var(--text-primary); }
</style>

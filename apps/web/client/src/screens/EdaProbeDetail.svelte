<script lang="ts">
  import { PROBES, type DistributionResult, type EdaField, type EdaView, type GrainResult, type NullsResult, type OwnerReading, type ProbeKey, type ResultView, type VolumeResult } from '@datahub/contracts/eda';
  import { kindOf } from '@datahub/contracts/model-types';
  import RunButton from '@datahub/ui/components/RunButton.svelte';
  import MenuButton, { type MenuChoice } from '@datahub/ui/containers/MenuButton.svelte';
  import { formatBytes } from '@datahub/ui/foundations/bytes.js';
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import Sentence from '@datahub/ui/foundations/Sentence.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import { asksReading, BLOCKS, type BlockDays, type EdaClient, MARK_ICONS, markOf, number, overallReading, percent, PROBE_ABOUT, PROBE_TEXTS, type RunAsk, STEP_TEXTS } from '../lib/eda.js';
  import { distributionConclusion, distributionSentence, grainConclusion, nullsConclusion, nullsWhy, volumeConclusion, volumeSentence } from '../lib/edaWords.js';
  import { when } from '../lib/moment.js';
  import { edaPath } from '../lib/routes.js';
  import { roleWords } from '../lib/typeFields.js';
  import EdaCalmChart from './EdaCalmChart.svelte';
  import EdaDistributionChart from './EdaDistributionChart.svelte';
  import EdaDrawing from './EdaDrawing.svelte';
  import EdaGrainChart from './EdaGrainChart.svelte';
  import EdaReading from './EdaReading.svelte';
  import EdaSaid from './EdaSaid.svelte';
  import EdaTone from './EdaTone.svelte';
  import EdaVolumeChart from './EdaVolumeChart.svelte';

  /**
   * The detail of an EDA-Probe (DEC-UX-324, FR-ED-06), in the tab Steps in place of its rows; the state of the
   * EDA-Setup belongs to those rows and is not repeated. On the left, 40%: what it does, with its drawing, which comes in
   * once and again on Replay; why it matters; its parameters, the fields it is set on among them; and Run, which adds it
   * to the EDA and runs it now, then Run again. A run reads through query as the User: above what runs freely the User
   * approves it, as for a query, and above what they may approve it does not run, with why. The left column folds to a
   * strip. On the right, 60%: before a run, where its result will come; after, the conclusion on top with Data Hub's
   * reading, the result drawn with what is wrong shaded, its numbers and examples, and the reading of who works on the
   * EDA (FR-ED-07 to FR-ED-11).
   */
  let {
    view,
    probe,
    client,
    onview,
  }: {
    view: EdaView;
    probe: ProbeKey;
    client: EdaClient;
    /** The EDA as eda answers it after a run or a reading. */
    onview: (view: EdaView) => void;
  } = $props();

  const language = $derived(currentLanguage());
  const id = $derived(view.resource.id);
  const spec = $derived(PROBES[probe]);
  const shown = $derived(view.probes.find((one) => one.key === probe));
  const name = $derived(t(PROBE_TEXTS[probe]));
  const lastRun = $derived(shown?.lastRun ?? null);
  const fieldsByName = $derived(new Map(view.resource.fields.map((field) => [field.name, field] as const)));
  const grain = $derived(view.resource.fields.filter((field) => field.grain).map((field) => field.name));
  /** Results in the order of the Resource Card (DEC-UX-323, DEC-UX-326). */
  const results = $derived.by(() => {
    const order = view.resource.fields.map((field) => field.name);
    return [...(lastRun?.results ?? [])].sort((a, b) => order.indexOf(a.subject) - order.indexOf(b.subject));
  });

  // The left column: folded to a strip, and its drawing, which comes in once and again on Replay.
  let folded = $state(false);
  let play = $state(1);

  // The fields it is set on: as added, else as it applies to this Resource; more can be added, needed ones stay.
  // svelte-ignore state_referenced_locally
  let fields = $state<string[]>([...(shown?.added && shown.fields.length > 0 ? shown.fields : (shown?.applies.fields ?? []))]);
  const needs = $derived(shown?.applies.needs ?? []);
  /** Which fields an EDA-Probe can be set on besides those it needs: any field, the dates, or the numbers (DEC-ED-17). */
  const fits = (field: EdaField): boolean =>
    probe === 'nullsPerKeyField' ? true : probe === 'volumeOverTime' ? kindOf(field.dataType) === 'date' : probe === 'distributionOfNumbers' ? kindOf(field.dataType) === 'number' : false;
  const addable = $derived(view.resource.fields.filter((field) => fits(field) && !fields.includes(field.name)));
  const choices: MenuChoice[] = $derived(
    addable.map((field) => ({ key: field.name, icon: MARK_ICONS[markOf(field)], label: field.name, run: () => (fields = view.resource.fields.map((one) => one.name).filter((one) => one === field.name || fields.includes(one))) })),
  );
  const chipIcon = (field: string): IconName => {
    if (probe === 'grainHolds') return 'fingerprint';
    const known = fieldsByName.get(field);
    if (probe !== 'volumeOverTime' && known?.keyField) return 'key';
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
    const data = results.find((result) => result.subject === field)?.data as DistributionResult | undefined;
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

  /** The parameters of the run: what the User changed, as eda takes them. */
  const params = $derived.by((): Record<string, unknown> | undefined => {
    if (probe === 'volumeOverTime') {
      const set = { ...(measure && !summed ? { measure: null } : {}), ...(measure && summed && shown?.params.measure !== undefined ? { measure } : {}), ...(weekends && daily ? { mayBeEmpty: 'weekends' } : {}) };
      return Object.keys(set).length > 0 ? set : undefined;
    }
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

  let days = $state<Record<string, BlockDays>>({});
  const unitsOf = (result: VolumeResult) => {
    const offered = BLOCKS.filter((block) => result.units.some((unit) => unit.days === block));
    return offered.length > 0 ? offered : ([7] as BlockDays[]);
  };

  const conclusion = $derived.by(() => {
    if (!lastRun || results.length === 0) return [];
    switch (probe) {
      case 'grainHolds':
        return grainConclusion((results[0] as ResultView).data as GrainResult, grain);
      case 'nullsPerKeyField':
        return nullsConclusion(results, language, (result) => ((result.data as NullsResult).role ? roleWords((result.data as NullsResult).role as NonNullable<NullsResult['role']>) : null));
      case 'volumeOverTime':
        return volumeConclusion(results, language);
      case 'distributionOfNumbers':
        return distributionConclusion(results, language);
      default:
        return [];
    }
  });
  const reading = $derived(overallReading(results));
  const readable = $derived(results.some((result) => asksReading(probe, result)));
</script>

<a class="back" href={edaPath(id)}><Icon name="arrow-left" /><span>{t('eda.detail.back')}</span></a>
<header class="head">
  <span class="meta">{t(STEP_TEXTS[spec.step].name)} · {t(PLACE_TEXTS[spec.place])} · {t(shown?.needed ? 'eda.level.needed' : shown ? LEVEL_TEXTS[shown.level] : 'eda.level.could')}</span>
  <h2>{name}</h2>
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
                  <span class="chip"><Icon name={chipIcon(field)} /><span class="mono">{field}</span>{#if (probe === 'volumeOverTime' || probe === 'distributionOfNumbers') && needs.includes(field)}<span class="note">{t('eda.params.needed')}</span>{/if}{#if !needs.includes(field) && probe !== 'grainHolds'}<button type="button" class="remove" aria-label={t('eda.params.remove', { field })} onclick={() => (fields = fields.filter((one) => one !== field))}><Icon name="x" /></button>{/if}</span>
                {/each}
                {#if fields.length === 0}<span class="none">{t('eda.params.setOn.none')}</span>{/if}
                <small>{t(about.setOn)}</small>
                {#if choices.length > 0}
                  <span class="add"><MenuButton icon="plus" variant="outline" align="start" text={t(probe === 'volumeOverTime' ? 'eda.params.addDate' : 'eda.params.addField')} label={t(probe === 'volumeOverTime' ? 'eda.params.addDate' : 'eda.params.addField')} {choices} /></span>
                {/if}
              </dd>
            </div>
            {#if probe === 'grainHolds'}
              <div><dt>{t('eda.params.own')}</dt><dd><Sentence key="eda.params.grain.own" names={{ grain: grain.join(', ') }} /></dd></div>
            {:else if probe === 'nullsPerKeyField'}
              <div><dt>{t('eda.params.own')}</dt><dd>{t('eda.params.nulls.own')}</dd></div>
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
            {/if}
            <div>
              <dt>{t('eda.params.reads')}</dt>
              <dd>
                {#if fields.length > 0}<Sentence key="eda.params.reads.fields" names={{ fields: fields.join(', ') }} />{:else}{t('eda.params.reads.table')}{/if}
                {#if lastRun}{' '}{t('eda.params.reads.last', { bytes: formatBytes(lastRun.bytes, language) })}{/if}
              </dd>
            </div>
            {#if probe === 'nullsPerKeyField'}
              <div><dt>{t('eda.params.notHere')}</dt><dd class="quiet">{t('eda.params.nulls.not')}</dd></div>
            {:else if probe === 'distributionOfNumbers'}
              <div><dt>{t('eda.params.notHere')}</dt><dd class="quiet">{t('eda.params.distribution.not')}</dd></div>
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
        <section class="result" aria-label={t('eda.detail.result')}>
          <div class="result-head">
            {#if reading}<EdaTone {reading} />{/if}
            <span class="meta">{t('eda.result.ran', { when: when(lastRun.ranAt, language), name: lastRun.ranBy.name, bytes: formatBytes(lastRun.bytes, language) })}</span>
          </div>
          <p class="conclusion"><EdaSaid parts={conclusion} /></p>

          {#if probe === 'grainHolds' && results[0]}
            {@const result = results[0]}
            {@const data = result.data as GrainResult}
            <figure class="chart">
              <figcaption><Sentence key="eda.grain.chart.caption" names={{ grain: grain.join(', ') }} /></figcaption>
              <EdaGrainChart result={data} grain={grain.join(', ')} />
            </figure>
            <div class="low">
              <dl class="numbers">
                <div><dt>{t('eda.grain.rows')}</dt><dd>{number(data.rows, language)}</dd></div>
                <div><dt>{t('eda.grain.values')}</dt><dd>{number(data.values, language)}</dd></div>
                <div><dt>{t('eda.grain.onMore')}</dt><dd class:warn={data.onMoreThanOne > 0}>{number(data.onMoreThanOne, language)}</dd></div>
                <div><dt>{t('eda.grain.covered')}</dt><dd class:warn={data.rowsCovered > 0}>{number(data.rowsCovered, language)}</dd></div>
                <div><dt>{t('eda.grain.emptyGrain')}</dt><dd class:warn={data.emptyGrain > 0}>{number(data.emptyGrain, language)}</dd></div>
              </dl>
              {#if data.examples.length > 0}
                {@const columns = Object.keys(data.examples[0]?.values ?? {})}
                <div class="examples">
                  <span class="meta">{t('eda.grain.examples', { count: data.examples.length, total: data.onMoreThanOne })}</span>
                  <table>
                    <thead><tr>{#each columns as column (column)}<th class="mono">{column}</th>{/each}<th class="num">{t('eda.grain.examples.rows')}</th></tr></thead>
                    <tbody>
                      {#each data.examples as example, index (index)}
                        <tr>{#each columns as column (column)}<td class="mono">{example.values[column] ?? '∅'}</td>{/each}<td class="num">{number(example.rows, language)}</td></tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}
            </div>
            <div class="reading"><EdaReading yours={result.yours} large label={t('eda.yours.of.table')} onread={(chosen) => read(result.subject, chosen)} /></div>
          {:else if probe === 'nullsPerKeyField'}
            <div class="nulls">
              <div class="nulls-head" aria-hidden="true"><span>{t('eda.nulls.field')}</span><span>{t('eda.nulls.bar')}</span><span>{t('eda.nulls.empty')}</span><span>Data Hub</span><span>{readable ? t('eda.yours') : ''}</span></div>
              <ul>
                {#each results as result (result.subject)}
                  {@const data = result.data as NullsResult}
                  {@const field = fieldsByName.get(result.subject)}
                  {@const share = data.rows > 0 ? (data.empty / data.rows) * 100 : 0}
                  {@const why = nullsWhy(data, data.role ? roleWords(data.role) : null)}
                  <li>
                    <span class="field">
                      {#if field?.keyField}<Icon name="key" label={t('resource.role.keyField')} />{/if}
                      {#if field}<Icon name={MARK_ICONS[markOf(field)]} />{/if}
                      <span><span class="mono">{result.subject}</span>{#if data.role}<small>{roleWords(data.role)}</small>{/if}</span>
                    </span>
                    <span class="bar" role="img" aria-label={t('eda.nulls.bar.label', { share: percent(data.empty, data.rows, language) })}>
                      <span class="filled" style:width="{100 - share}%"></span>{#if data.empty > 0}<span class="emptied" style:width="{Math.max(share, 1.2)}%"></span>{/if}
                    </span>
                    <span class="num"><b class:warn={data.empty > 0}>{percent(data.empty, data.rows, language)}</b><small>{t('eda.nulls.count', { empty: data.empty, rows: data.rows })}</small></span>
                    <span class="tone"><EdaTone reading={result.reading} /><small><Sentence key={why.key} values={why.values} /></small></span>
                    {#if asksReading(probe, result)}
                      <EdaReading yours={result.yours} label={t('eda.yours.of', { field: result.subject })} onread={(chosen) => read(result.subject, chosen)} />
                    {:else}
                      <span class="nothing">{t('eda.nulls.nothing')}</span>
                    {/if}
                  </li>
                {/each}
              </ul>
              <div class="legend"><span><span class="key filled"></span>{t('eda.nulls.filled')}</span><span><span class="key emptied"></span>{t('eda.nulls.emptied')}</span><span class="order">{t('eda.order')}</span></div>
            </div>
            {#if results.some((result) => (result.data as NullsResult).empty > 0)}
              <div class="hint"><Icon name="signpost" /><p><b>{t('eda.nulls.next')}</b> {t('eda.nulls.next.why')}</p><span class="meta">{t('eda.coming')}</span></div>
            {/if}
          {:else if probe === 'volumeOverTime'}
            <div class="blocks">
              {#each results as result (result.subject)}
                {@const data = result.data as VolumeResult}
                {@const field = fieldsByName.get(result.subject)}
                {@const offered = unitsOf(data)}
                {@const chosen = days[result.subject] ?? offered[0] ?? 7}
                <article class="block" aria-label={result.subject}>
                  <header>
                    <Icon name="calendar-blank" /><span class="mono">{result.subject}</span>
                    <small>{field?.role ? roleWords(field.role) : ''}{field?.role ? ' · ' : ''}{needs.includes(result.subject) ? t('eda.params.needed') : t('eda.block.added')}</small>
                    <EdaTone reading={result.reading} />
                  </header>
                  <p class="sentence"><EdaSaid parts={volumeSentence(data, language)} /></p>
                  <div class="drawn">
                    <span class="meta">{t('eda.volume.per')}</span>
                    <Segmented
                      label={t('eda.volume.per.label', { field: result.subject })}
                      options={offered.map((block) => ({ value: String(block), label: t('eda.volume.days', { count: block }) }))}
                      value={String(chosen)}
                      onchange={(value) => (days = { ...days, [result.subject]: Number(value) as BlockDays })}
                    />
                  </div>
                  <EdaVolumeChart result={data} days={chosen} field={result.subject} />
                  {#if data.units.length > 0}
                    <div class="calm">
                      <div class="calm-head"><b>{t('eda.volume.calm')}</b><span class="meta">{t('eda.volume.calm.about')}</span></div>
                      <EdaCalmChart units={data.units} />
                      <div class="calm-key"><span><i class="k-line"></i>{t('eda.volume.calm.range')}</span><span><i class="k-box"></i>{t('eda.volume.calm.middle')}</span><span><i class="k-median"></i>{t('eda.volume.calm.median')}</span><span><i class="k-sd"></i>{t('eda.volume.calm.sd')}</span></div>
                    </div>
                  {/if}
                  <div class="block-reading"><EdaReading yours={result.yours} label={t('eda.yours.of', { field: result.subject })} onread={(reading) => read(result.subject, reading)} /></div>
                </article>
              {/each}
            </div>
          {:else if probe === 'distributionOfNumbers'}
            <div class="blocks">
              {#each results as result (result.subject)}
                {@const data = result.data as DistributionResult}
                {@const field = fieldsByName.get(result.subject)}
                <article class="block" aria-label={result.subject}>
                  <header>
                    {#if field?.keyField}<Icon name="key" label={t('resource.role.keyField')} />{/if}<Icon name="hash" /><span class="mono">{result.subject}</span>
                    <small>{field?.role ? roleWords(field.role) : ''}{field?.role ? ' · ' : ''}{needs.includes(result.subject) ? t('eda.params.needed') : t('eda.block.added')}</small>
                    <EdaTone reading={result.reading} />
                  </header>
                  <p class="sentence"><EdaSaid parts={distributionSentence(data, language)} /></p>
                  <EdaDistributionChart result={data} field={result.subject} />
                  <dl class="numbers seven">
                    <div><dt>{t('eda.distribution.rows')}</dt><dd>{number(data.rows, language)}</dd></div>
                    <div><dt>{t('eda.distribution.low')}</dt><dd>{number(data.low, language)}</dd></div>
                    <div><dt>P25</dt><dd>{number(data.p25, language)}</dd></div>
                    <div><dt>{t('eda.distribution.median')}</dt><dd>{number(data.median, language)}</dd></div>
                    <div><dt>P75</dt><dd>{number(data.p75, language)}</dd></div>
                    <div><dt>{t('eda.distribution.high')}</dt><dd>{number(data.high, language)}</dd></div>
                    <div><dt>{t('eda.distribution.mean')}</dt><dd>{number(data.mean, language)}</dd></div>
                  </dl>
                  <div class="block-reading"><EdaReading yours={result.yours} label={t('eda.yours.of', { field: result.subject })} onread={(reading) => read(result.subject, reading)} /></div>
                </article>
              {/each}
            </div>
          {/if}
        </section>
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
  .drawing { margin: 0 32px 0 0; padding: 8px; border-radius: var(--radius-md); background: var(--surface-solid); position: relative; max-width: 300px; }
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
  .result { padding: 16px 18px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .result-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .result-head .meta { margin-left: auto; }
  .conclusion { font-size: 17px; line-height: 1.45; margin: 10px 0 16px; }
  .chart { margin: 0; padding: 12px 14px 8px; border-radius: var(--radius-md); background: var(--surface-solid); }
  .chart figcaption { font-size: var(--text-small); font-weight: var(--weight-medium); }
  .low { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 14px; align-items: flex-start; }
  .numbers { grid-template-columns: repeat(3, auto); gap: 8px 22px; }
  .numbers dt { font-size: var(--text-meta); color: var(--text-muted); }
  .numbers dd { margin: 2px 0 0; font-size: 18px; font-weight: var(--weight-medium); font-variant-numeric: tabular-nums; }
  .numbers dd.warn { color: var(--signal-warn); }
  .numbers.seven { grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px 12px; margin-top: 10px; }
  .numbers.seven dd { font-size: 16px; }
  .examples { flex: 1; min-width: 260px; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 12px; }
  th { text-align: left; font-weight: var(--weight-regular); color: var(--text-muted); font-size: var(--text-meta); padding: 3px 6px; }
  td { padding: 4px 6px; border-top: 1px solid var(--tint-active); }
  .num { text-align: right; }
  .reading { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--tint-active); }
  .nulls { border-radius: var(--radius-md); background: var(--surface-solid); padding: 6px 14px 10px; }
  .nulls-head, .nulls li { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(90px, 1.2fr) 92px 150px 224px; gap: 14px; align-items: center; }
  .nulls-head { padding: 8px 0 6px; font-size: var(--text-meta); color: var(--text-muted); border-bottom: 1px solid var(--tint-active); }
  .nulls ul { list-style: none; margin: 0; padding: 0; }
  .nulls li { padding: 10px 0; border-bottom: 1px solid var(--tint-hover); font-size: var(--text-small); }
  .field { display: flex; gap: 6px; align-items: flex-start; min-width: 0; }
  .field :global(.icon) { margin-top: 2px; color: var(--text-muted); flex: none; }
  .field .mono { font-weight: var(--weight-medium); }
  .field small, .num small, .tone small { display: block; font-size: var(--text-meta); color: var(--text-muted); }
  .bar { display: flex; height: 12px; border-radius: var(--radius-sm); overflow: hidden; background: var(--surface-sub); }
  .filled { background: var(--col-teal); }
  .emptied { background: repeating-linear-gradient(135deg, var(--signal-warn) 0 3px, color-mix(in srgb, var(--signal-warn) 35%, transparent) 3px 6px); }
  .num { text-align: left; }
  .num b { font-size: 16px; font-weight: var(--weight-medium); }
  .num b.warn { color: var(--signal-warn); }
  .nothing { font-size: var(--text-meta); color: var(--text-muted); }
  .legend { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 8px; font-size: var(--text-meta); color: var(--text-muted); }
  .legend > span { display: inline-flex; gap: 6px; align-items: center; }
  .legend .order { margin-left: auto; }
  .legend .key { width: 14px; height: 8px; border-radius: var(--radius-mark); display: inline-block; }
  .hint { display: flex; gap: 12px; align-items: center; margin-top: 12px; padding: 10px 12px; border-radius: var(--radius-md); background: var(--surface-solid); font-size: var(--text-small); }
  .hint > :global(.icon) { font-size: 20px; color: var(--text-secondary); }
  .hint p { flex: 1; margin: 0; line-height: 1.5; color: var(--text-secondary); }
  .hint b { font-weight: var(--weight-medium); color: var(--text-primary); }
  .blocks { display: grid; gap: 10px; }
  .block { padding: 14px 16px 12px; border-radius: var(--radius-md); background: var(--surface-solid); }
  .block header { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: var(--text-small); }
  .block header > :global(.icon) { color: var(--text-muted); }
  .block header .mono { font-weight: var(--weight-medium); }
  .block header small { flex: 1; margin-left: 4px; color: var(--text-muted); font-size: var(--text-meta); }
  .sentence { margin: 8px 0 4px; font-size: var(--text-small); line-height: 1.5; }
  .drawn, .calm-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 10px; font-size: var(--text-small); }
  .calm-head b { font-weight: var(--weight-medium); }
  .calm { margin-top: 10px; }
  .calm-key { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 4px; font-size: var(--text-meta); color: var(--text-muted); }
  .calm-key > span { display: inline-flex; gap: 6px; align-items: center; }
  .calm-key i { display: inline-block; }
  .k-line { width: 18px; height: 1.5px; background: var(--col-slate); }
  .k-box { width: 14px; height: 9px; border: 1.2px solid var(--col-slate); border-radius: var(--radius-mark); }
  .k-median { width: 2px; height: 12px; background: var(--text-primary); }
  .k-sd { width: 18px; height: 11px; border-radius: var(--radius-mark); background: color-mix(in srgb, var(--col-teal) 25%, transparent); }
  .block-reading { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--tint-active); }
  @media (max-width: 1300px) {
    .nulls-head { display: none; }
    .nulls li { grid-template-columns: 1fr 1fr; }
    .numbers.seven { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
</style>

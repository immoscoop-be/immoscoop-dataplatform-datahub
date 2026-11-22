<script lang="ts">
  import {
    appliesTo,
    type CategoriesResult,
    type DateRangeResult,
    type DisguisedResult,
    type DistributionResult,
    type EdaResource,
    type GrainResult,
    type NullsResult,
    type OwnerReading,
    type ProbeKey,
    type ResultView,
    type RunView,
    type Selection,
    type VolumeResult,
  } from '@datahub/contracts/eda';
  import { formatBytes } from '@datahub/ui/foundations/bytes.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import Sentence from '@datahub/ui/foundations/Sentence.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import { asksReading, BLOCKS, type BlockDays, MARK_ICONS, markOf, number, overallReading, percent } from '../lib/eda.js';
  import {
    categoriesConclusion,
    categoriesSentence,
    dateRangeConclusion,
    dateRangeSentence,
    dayOfDate,
    disguisedConclusion,
    disguisedWhy,
    distributionConclusion,
    distributionSentence,
    grainConclusion,
    isUpToDate,
    isWordOf,
    nothingName,
    nowWord,
    nullsConclusion,
    nullsWhy,
    periodName,
    periodsOf,
    saidNothingOf,
    selectionSaid,
    sinceWord,
    topOf,
    volumeConclusion,
    volumeSentence,
  } from '../lib/edaWords.js';
  import { when } from '../lib/moment.js';
  import { roleWords } from '../lib/typeFields.js';
  import EdaCalmChart from './EdaCalmChart.svelte';
  import EdaCategoriesChart from './EdaCategoriesChart.svelte';
  import EdaDateRangeChart from './EdaDateRangeChart.svelte';
  import EdaDistributionChart from './EdaDistributionChart.svelte';
  import EdaGrainChart from './EdaGrainChart.svelte';
  import EdaReading from './EdaReading.svelte';
  import EdaSaid from './EdaSaid.svelte';
  import EdaTone from './EdaTone.svelte';
  import EdaVolumeChart from './EdaVolumeChart.svelte';

  /**
   * The result of one run of an EDA-Probe (FR-ED-07 to FR-ED-11, DEC-UX-326), drawn from the run alone, so that it can
   * stand anywhere: on the detail of its EDA-Probe, and later beside the result of the same EDA-Probe on a selection of
   * rows (OP-ED-12). On top Data Hub's reading of the run and when it ran; the conclusion; then per EDA-Probe its blocks,
   * rows or chart, with what is wrong shaded, its numbers and examples, and the reading of who works on the EDA where
   * there is something to read. A run on a selection says on which rows, in words, above it all. It knows nothing of the
   * page, its form or its route: what the EDA-Probe needs on this Resource follows from the rules of the contracts.
   */
  let {
    probe,
    run,
    resource,
    selection,
    onread,
  }: {
    probe: ProbeKey;
    run: RunView;
    /** The Resource it ran on, for the order of its fields and their roles. */
    resource: EdaResource;
    /** The rows it ran on, if not those of the run; none, or no condition, is the whole table. */
    selection?: Selection;
    /** Keeps the reading of who works on the EDA of a subject, and answers whether it was kept; without it no reading is asked. */
    onread?: (subject: string, reading: OwnerReading) => Promise<boolean>;
  } = $props();

  const language = $derived(currentLanguage());
  const fieldsByName = $derived(new Map(resource.fields.map((field) => [field.name, field] as const)));
  const grain = $derived(resource.fields.filter((field) => field.grain).map((field) => field.name));
  /** The fields a needed one must be set on, by the same rule as eda (TR-ED-02). */
  const needs = $derived(appliesTo(probe, resource).needs);
  /** Results in the order of the Resource Card (DEC-UX-323, DEC-UX-326). */
  const results = $derived.by(() => {
    const order = resource.fields.map((field) => field.name);
    return [...run.results].sort((a, b) => order.indexOf(a.subject) - order.indexOf(b.subject));
  });
  /** The rows it ran on, in words; none for the whole table. */
  const where = $derived(selectionSaid(selection ?? run.selection, language));

  const read = (subject: string) => (reading: OwnerReading) => onread?.(subject, reading) ?? Promise.resolve(false);
  /** Whether a result asks for a reading here: when it has something to read, and a reading can be kept. */
  const asks = (result: ResultView) => onread !== undefined && asksReading(probe, result);

  let days = $state<Record<string, BlockDays>>({});
  const unitsOf = (result: VolumeResult) => {
    const offered = BLOCKS.filter((block) => result.units.some((unit) => unit.days === block));
    return offered.length > 0 ? offered : ([7] as BlockDays[]);
  };

  const roleOf = (result: ResultView) => {
    const role = (result.data as NullsResult | DisguisedResult).role;
    return role ? roleWords(role) : null;
  };
  const conclusion = $derived.by(() => {
    if (results.length === 0) return [];
    switch (probe) {
      case 'grainHolds':
        return grainConclusion((results[0] as ResultView).data as GrainResult, grain);
      case 'nullsPerKeyField':
        return nullsConclusion(results, language, roleOf);
      case 'volumeOverTime':
        return volumeConclusion(results, language);
      case 'distributionOfNumbers':
        return distributionConclusion(results, language);
      case 'distributionOfCategories':
        return categoriesConclusion(results, language);
      case 'dateRange':
        return dateRangeConclusion(results, language);
      case 'disguisedNulls':
        return disguisedConclusion(results, language, roleOf);
      default:
        return [];
    }
  });
  const reading = $derived(overallReading(results));
  const readable = $derived(results.some(asks));
</script>

<section class="result" aria-label={t('eda.detail.result')}>
  {#if where.length > 0}
    <p class="selection">
      <Icon name="funnel" />
      <span>{t('eda.selection.on')}{#each where as part, index (index)}{' '}{#if index > 0}{t('eda.selection.and')}{' '}{/if}<Sentence key={part.key} values={part.values} names={part.names} />{/each}</span>
    </p>
  {/if}
  <div class="result-head">
    {#if reading}<EdaTone {reading} />{/if}
    <span class="meta">{t('eda.result.ran', { when: when(run.ranAt, language), name: run.ranBy.name, bytes: formatBytes(run.bytes, language) })}</span>
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
    {#if asks(result)}<div class="reading"><EdaReading yours={result.yours} large label={t('eda.yours.of.table')} onread={read(result.subject)} /></div>{/if}
  {:else if probe === 'nullsPerKeyField'}
    <div class="rows">
      <div class="rows-head" aria-hidden="true"><span>{t('eda.nulls.field')}</span><span>{t('eda.nulls.bar')}</span><span>{t('eda.nulls.empty')}</span><span>Data Hub</span><span>{readable ? t('eda.yours') : ''}</span></div>
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
            {#if asks(result)}
              <EdaReading yours={result.yours} label={t('eda.yours.of', { field: result.subject })} onread={read(result.subject)} />
            {:else if onread}
              <span class="nothing">{t('eda.nulls.nothing')}</span>
            {:else}
              <span></span>
            {/if}
          </li>
        {/each}
      </ul>
      <div class="legend"><span><span class="key filled"></span>{t('eda.nulls.filled')}</span><span><span class="key emptied"></span>{t('eda.nulls.emptied')}</span><span class="order">{t('eda.order')}</span></div>
    </div>
    {#if results.some((result) => (result.data as NullsResult).empty > 0)}
      <div class="hint"><Icon name="signpost" /><p><b>{t('eda.nulls.next')}</b> {t('eda.nulls.next.why')}</p><span class="meta">{t('eda.coming')}</span></div>
    {/if}
  {:else if probe === 'disguisedNulls'}
    <div class="rows disguised">
      <div class="rows-head" aria-hidden="true"><span>{t('eda.nulls.field')}</span><span>{t('eda.disguised.found')}</span><span>{t('eda.disguised.saysNothing')}</span><span>Data Hub</span><span>{readable ? t('eda.yours') : ''}</span></div>
      <ul>
        {#each results as result (result.subject)}
          {@const data = result.data as DisguisedResult}
          {@const field = fieldsByName.get(result.subject)}
          {@const share = data.rows > 0 ? (data.saysNothing / data.rows) * 100 : 0}
          {@const why = disguisedWhy(data, data.role ? roleWords(data.role) : null)}
          {@const said = saidNothingOf(data)}
          <li>
            <span class="field">
              {#if field?.keyField}<Icon name="key" label={t('resource.role.keyField')} />{/if}
              {#if field}<Icon name={MARK_ICONS[markOf(field)]} />{/if}
              <span><span class="mono">{result.subject}</span>{#if data.role}<small>{roleWords(data.role)}</small>{/if}</span>
            </span>
            <span class="found">
              <span class="bar" role="img" aria-label={t('eda.disguised.bar.label', { share: percent(data.saysNothing, data.rows, language) })}>
                <span class="filled" style:width="{100 - share}%"></span>{#if data.saysNothing > 0}<span class="emptied" style:width="{Math.max(share, 1.2)}%"></span>{/if}
              </span>
              <span class="values">
                {#each said as one, index (index)}
                  {@const name = nothingName(one.value)}
                  <span class="value" title={t('eda.disguised.value', { value: name, rows: number(one.rows, language) })}><span class={isWordOf(one.value) ? 'word' : 'mono'}>{name}</span><small>{number(one.rows, language)}</small></span>
                {:else}
                  <span class="nothing">{t('eda.disguised.noneFound')}</span>
                {/each}
              </span>
            </span>
            <span class="num"><b class:warn={data.saysNothing > 0}>{percent(data.saysNothing, data.rows, language)}</b><small>{t('eda.disguised.count', { count: data.saysNothing })}</small></span>
            <span class="tone"><EdaTone reading={result.reading} /><small><Sentence key={why.key} values={why.values} /></small></span>
            {#if asks(result)}
              <EdaReading yours={result.yours} label={t('eda.yours.of', { field: result.subject })} onread={read(result.subject)} />
            {:else if onread}
              <span class="nothing">{t('eda.nulls.nothing')}</span>
            {:else}
              <span></span>
            {/if}
          </li>
        {/each}
      </ul>
      <div class="legend"><span><span class="key filled"></span>{t('eda.disguised.says')}</span><span><span class="key emptied"></span>{t('eda.disguised.saysNothing')}</span><span class="order">{t('eda.order')}</span></div>
    </div>
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
          {#if asks(result)}<div class="block-reading"><EdaReading yours={result.yours} label={t('eda.yours.of', { field: result.subject })} onread={read(result.subject)} /></div>{/if}
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
          {#if asks(result)}<div class="block-reading"><EdaReading yours={result.yours} label={t('eda.yours.of', { field: result.subject })} onread={read(result.subject)} /></div>{/if}
        </article>
      {/each}
    </div>
  {:else if probe === 'distributionOfCategories'}
    <div class="blocks">
      {#each results as result (result.subject)}
        {@const data = result.data as CategoriesResult}
        {@const field = fieldsByName.get(result.subject)}
        {@const top = topOf(data)}
        <article class="block" aria-label={result.subject}>
          <header>
            {#if field?.keyField}<Icon name="key" label={t('resource.role.keyField')} />{/if}<Icon name={field ? MARK_ICONS[markOf(field)] : 'tag'} /><span class="mono">{result.subject}</span>
            <small>{field?.role ? roleWords(field.role) : t('eda.block.noRole')}{field?.mapped ? ` · ${t('eda.field.mapped')}` : ''}</small>
            <EdaTone reading={result.reading} />
          </header>
          <p class="sentence"><EdaSaid parts={categoriesSentence(data, language)} /></p>
          <div class="weights">
            <div>
              <EdaCategoriesChart result={data} field={result.subject} />
              <p class="total">
                {#if data.weighedBy}<Sentence key="eda.categories.total.sum" values={{ total: number(data.total, language) }} names={{ field: data.weighedBy }} />{:else}{t('eda.categories.total.rows', { total: number(data.total, language) })}{/if}
              </p>
            </div>
            <dl class="numbers stack">
              <div><dt>{t('eda.categories.values')}</dt><dd>{number(data.values, language)}</dd></div>
              {#if data.values > 0}<div><dt>{t('eda.categories.top', { count: top.count })}</dt><dd>{percent(top.share, 1, language)}</dd></div>{/if}
              {#if data.small > 0}<div><dt>{t('eda.categories.smallCount')}</dt><dd>{number(data.small, language)}</dd></div>{/if}
              <div><dt>{t('eda.categories.emptyCount')}</dt><dd>{percent(data.empty.share, 1, language)}</dd></div>
            </dl>
          </div>
          {#if asks(result)}<div class="block-reading"><EdaReading yours={result.yours} label={t('eda.yours.of', { field: result.subject })} onread={read(result.subject)} /></div>{/if}
        </article>
      {/each}
    </div>
  {:else if probe === 'dateRange'}
    <div class="blocks">
      {#each results as result (result.subject)}
        {@const data = result.data as DateRangeResult}
        {@const field = fieldsByName.get(result.subject)}
        {@const late = !isUpToDate(data)}
        {@const before = data.beforeReliable ?? 0}
        <article class="block" aria-label={result.subject}>
          <header>
            <Icon name="calendar-blank" /><span class="mono">{result.subject}</span>
            <small>{field?.role ? `${roleWords(field.role)} · ` : ''}{t(data.unit === 'week' ? 'eda.dateRange.unit.week' : 'eda.dateRange.unit.day')}</small>
            <EdaTone reading={result.reading} />
          </header>
          {#if results.length > 1 || data.first === null}<p class="sentence"><EdaSaid parts={dateRangeSentence(data, language, result.subject)} /></p>{/if}
          {#if data.first !== null && data.last !== null}
            <EdaDateRangeChart result={data} field={result.subject} ranAt={run.ranAt} />
            <dl class="numbers range">
              <div>
                <dt>{t('eda.dateRange.first')}</dt>
                <dd>{periodName(data.unit, data.first, language)}{#if data.unit === 'week'}<small>{dayOfDate(data.first, language)}</small>{/if}</dd>
              </div>
              <div>
                <dt>{t('eda.dateRange.last')}</dt>
                <dd>
                  {periodName(data.unit, data.last, language)}
                  {#if data.unit === 'week'}
                    <small>{late ? dayOfDate(data.last, language) : t('eda.dateRange.last.since', { day: dayOfDate(data.last, language), since: sinceWord(data) })}</small>
                  {:else if !late}
                    <small>{sinceWord(data)}</small>
                  {/if}
                </dd>
              </div>
              <div>
                <dt>{t('eda.dateRange.between', { unit: data.unit })}</dt>
                <dd>{number(data.periods, language)}<small>{t('eda.dateRange.between.about')}</small></dd>
              </div>
              <div>
                <dt>{t('eda.dateRange.behindLabel')}</dt>
                <dd class:warn={late}>
                  {data.behind === 0 ? t('eda.dateRange.none') : periodsOf(data.unit, data.behind)}
                  <small>{t(data.behind === 0 ? 'eda.dateRange.behind.is' : 'eda.dateRange.behind.against', { now: nowWord(data.unit) })}</small>
                </dd>
              </div>
              <div>
                <dt>{t('eda.dateRange.beforeReliable')}</dt>
                {#if data.reliableSince}
                  <dd>{before > 0 ? periodsOf(data.unit, before) : t('eda.dateRange.none')}<small>{t('eda.dateRange.beforeReliable.on', { day: dayOfDate(data.reliableSince, language) })}</small></dd>
                {:else}
                  <dd class="unset">{t('eda.dateRange.beforeReliable.notSet')}<small>{t('eda.dateRange.beforeReliable.notSet.about')}</small></dd>
                {/if}
              </div>
            </dl>
          {/if}
          {#if asks(result)}
            <div class="block-reading"><EdaReading yours={result.yours} label={t('eda.yours.of', { field: result.subject })} onread={read(result.subject)} /></div>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
</section>

<style>
  .result { padding: 16px 18px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .selection { display: flex; gap: 6px; align-items: flex-start; margin: 0 0 10px; font-size: var(--text-small); line-height: 1.5; color: var(--text-secondary); }
  .selection :global(.icon) { margin-top: 3px; flex: none; color: var(--text-muted); }
  .result-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .result-head .meta { margin-left: auto; }
  .conclusion { font-size: 17px; line-height: 1.45; margin: 10px 0 16px; }
  .chart { margin: 0; padding: 12px 14px 8px; border-radius: var(--radius-md); background: var(--surface-solid); }
  .chart figcaption { font-size: var(--text-small); font-weight: var(--weight-medium); }
  .low { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 14px; align-items: flex-start; }
  dl { margin: 6px 0 0; display: grid; gap: 8px; }
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
  .reading { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--tint-active); }
  /* A row per field (DEC-UX-326): Nulls per Key Field and Disguised nulls. */
  .rows { border-radius: var(--radius-md); background: var(--surface-solid); padding: 6px 14px 10px; }
  .rows-head, .rows li { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(90px, 1.2fr) 92px 150px 224px; gap: 14px; align-items: center; }
  .disguised .rows-head, .disguised li { grid-template-columns: minmax(140px, 1fr) minmax(120px, 1.4fr) 104px 150px 190px; }
  .rows-head { padding: 8px 0 6px; font-size: var(--text-meta); color: var(--text-muted); border-bottom: 1px solid var(--tint-active); }
  .rows ul { list-style: none; margin: 0; padding: 0; }
  .rows li { padding: 10px 0; border-bottom: 1px solid var(--tint-hover); font-size: var(--text-small); }
  .field { display: flex; gap: 6px; align-items: flex-start; min-width: 0; }
  .field :global(.icon) { margin-top: 2px; color: var(--text-muted); flex: none; }
  .field .mono { font-weight: var(--weight-medium); }
  .disguised .field > span { min-width: 0; overflow-wrap: break-word; }
  .field small, .num small, .tone small { display: block; font-size: var(--text-meta); color: var(--text-muted); }
  .bar { display: flex; height: 12px; border-radius: var(--radius-sm); overflow: hidden; background: var(--surface-sub); }
  .filled { background: var(--col-teal); }
  .emptied { background: repeating-linear-gradient(135deg, var(--signal-warn) 0 3px, color-mix(in srgb, var(--signal-warn) 35%, transparent) 3px 6px); }
  .found { display: grid; gap: 6px; min-width: 0; }
  .values { display: flex; flex-wrap: wrap; gap: 4px; }
  .value { display: inline-flex; align-items: baseline; gap: 5px; padding: 2px 7px; border-radius: var(--radius-pill); border: 1px dashed var(--signal-warn); font-size: var(--text-meta); }
  .value small { color: var(--text-muted); font-variant-numeric: tabular-nums; }
  .value .word { font-style: italic; }
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
  .weights { display: grid; grid-template-columns: minmax(0, 1fr) 150px; gap: 18px; align-items: start; margin-top: 6px; }
  .total { margin: 6px 0 0; font-size: var(--text-meta); color: var(--text-muted); }
  .numbers.stack { grid-template-columns: 1fr; gap: 8px; margin: 0; }
  .numbers.range { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px 18px; margin-top: 8px; }
  .numbers small { display: block; font-size: 10.5px; font-weight: var(--weight-regular); color: var(--text-muted); }
  .numbers dd.unset { color: var(--text-muted); }
  @media (max-width: 1300px) {
    .rows-head { display: none; }
    .rows li, .disguised li { grid-template-columns: 1fr 1fr; }
    .numbers.seven { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
  @media (max-width: 960px) {
    .weights { grid-template-columns: 1fr; }
    .numbers.stack { grid-template-columns: repeat(4, auto); }
    .numbers.range { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
</style>

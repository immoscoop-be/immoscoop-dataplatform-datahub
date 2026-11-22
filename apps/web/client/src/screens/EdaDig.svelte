<script lang="ts">
  import type { DigField, DigResult, EdaView, RowCondition } from '@datahub/contracts/eda';
  import RunButton from '@datahub/ui/components/RunButton.svelte';
  import MenuButton, { type MenuChoice } from '@datahub/ui/containers/MenuButton.svelte';
  import { formatBytes } from '@datahub/ui/foundations/bytes.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import Sentence from '@datahub/ui/foundations/Sentence.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import { conditionOfValue, gapScopeOf, isOver, narrowings, restOf, sharesOf, strongestIn, withCondition, withoutCondition } from '../lib/dig.js';
  import { type EdaClient, number, percent, PROBE_TEXTS } from '../lib/eda.js';
  import { conditionSaid, digCommon, digGapText, ratioWord, saidText, selectionSaid, timesWord } from '../lib/edaWords.js';
  import { proposeGap, scopeLine } from '../lib/gaps.js';
  import { when } from '../lib/moment.js';
  import { type DigAt, digPath, edaPath, newQueryPath, probePath, resourcePath } from '../lib/routes.js';
  import { roleWords } from '../lib/typeFields.js';
  import EdaDigTime from './EdaDigTime.svelte';
  import EdaSaid from './EdaSaid.svelte';

  /**
   * Dig into what a result found (FR-ED-20, DEC-ED-36), on a page of its own in the tab Steps, as the detail of an
   * EDA-Probe, as drawn in eda-dig. On top the selection, as conditions in words, each taken off with its ×, and Narrow
   * it to add one; the rows it holds against all rows. It runs through query as the User when it opens, as a run of an
   * EDA-Probe does: above what runs freely the User approves it, and above what they may approve it does not run, with
   * why. Its result sets the selection against the rest of the table: a sentence of what the rows have in common; over
   * time, the share of the selection per period with its break; per other Key Field that is a text, the values that
   * differ most with their share in the selection and in the other rows, how many times as often, and whether that could
   * be chance; per number its median and mean in both. Then what to do with it: propose a Known Gap, which the User saves
   * on the Resource Card; dig further on the value that sets it most apart; or query the rows. Nothing of it is kept.
   */
  let {
    view,
    dig,
    client,
    go,
    canQuery = false,
  }: {
    view: EdaView;
    /** The selection of rows, and the EDA-Probe whose result it started from. */
    dig: DigAt;
    client: EdaClient;
    /** Goes to an address of the app, for a condition chosen to narrow it. */
    go: (path: string) => void;
    /** Whether the User may make a query (`queries.make`), for Query these rows. */
    canQuery?: boolean;
  } = $props();

  const language = $derived(currentLanguage());
  const id = $derived(view.resource.id);
  const selection = $derived(dig.selection);
  const fieldsByName = $derived(new Map(view.resource.fields.map((field) => [field.name, field] as const)));
  const said = $derived(selectionSaid(selection, language));
  /** Where it leads back to: the detail of the EDA-Probe it started from, else the EDA-Steps. */
  const back = $derived(dig.from ? { href: probePath(id, dig.from), label: t(PROBE_TEXTS[dig.from]) } : { href: edaPath(id), label: t('eda.detail.back') });

  // A dig: it ran, it waits for the approval of the User, or it does not run, with why (TR-ED-12).
  let found = $state<{ result: DigResult; ranAt: string; bytes: number } | null>(null);
  let running = $state(false);
  let approve = $state<number | null>(null);
  let refused = $state<string | null>(null);
  let failed = $state(false);

  async function run(approved = false): Promise<void> {
    running = true;
    refused = null;
    failed = false;
    try {
      const answer = await client.dig(id, selection, approved);
      if (answer.state === 'ran') {
        approve = null;
        found = { result: answer.result, ranAt: answer.ranAt, bytes: answer.bytes };
      } else if (answer.state === 'approve') {
        approve = answer.bytes;
      } else {
        approve = null;
        refused = answer.reason || t('eda.run.refused.unknown');
      }
    } catch (error) {
      console.error('The dig could not run', error);
      failed = true;
    } finally {
      running = false;
    }
  }
  // The page runs it as it opens: a dig is not kept (TR-ED-12).
  void run();

  /** The address of the selection with a condition taken off: with none left, back where it started. */
  const withoutAt = (index: number) => (selection.where.length > 1 ? digPath(id, withoutCondition(selection, index), dig.from) : back.href);
  const KIND_ICONS: Record<RowCondition['kind'], IconName> = { empty: 'circle-dashed', saysNothing: 'circle-dashed', equals: 'tag', range: 'calendar-blank' };
  /** What Narrow it offers, each leading to the selection with it added. */
  const narrowChoices: MenuChoice[] = $derived(
    narrowings(selection, found?.result ?? null, view.resource.fields).flatMap((condition) => {
      const next = withCondition(selection, condition);
      const words = conditionSaid(condition, language);
      return next && words ? [{ key: JSON.stringify(condition), icon: KIND_ICONS[condition.kind], label: saidText([words]), run: () => go(digPath(id, next, dig.from)) }] : [];
    }),
  );

  const roleOf = (field: string) => {
    const role = fieldsByName.get(field)?.role;
    return role ? roleWords(role) : '';
  };
  const middle = (value: number | null) => (value === null ? t('eda.dig.number.none') : number(value, language));
  const width = (share: number) => `${share > 0 ? Math.max(share * 100, 1.2) : 0}%`;

  const common = $derived(found ? digCommon(found.result, language) : []);
  const strongest = $derived(found ? strongestIn(found.result) : null);
  /** Dig further: the selection with the value that sets it most apart added. */
  const further = $derived.by(() => {
    if (!strongest) return null;
    const next = withCondition(selection, conditionOfValue(strongest.field, strongest.value.value));
    return next ? digPath(id, next, dig.from) : null;
  });
  /** The Known Gap it proposes: its why and its scope, saved on the Resource Card by the User (FR-ED-20). */
  const gap = $derived(found ? { text: digGapText(selection, found.result, language), scope: gapScopeOf(selection, found.result) } : null);
  const texts = (field: DigField): field is Extract<DigField, { kind: 'text' }> => field.kind === 'text';
</script>

<a class="back" href={back.href}><Icon name="arrow-left" /><span>{back.label}</span></a>
<header class="head">
  <span class="meta">{t('eda.dig.meta')}</span>
  <h2>{t('eda.dig.title')}{#each said as part, index (index)}{' '}{#if index > 0}{t('eda.selection.and')}{' '}{/if}<Sentence key={part.key} values={part.values} names={part.names} />{/each}</h2>
</header>

<div class="selection">
  {#each selection.where as condition, index (index)}
    {@const words = conditionSaid(condition, language)}
    <span class="condition">
      <Icon name="funnel" />
      {#if words}<span><Sentence key={words.key} values={words.values} names={words.names} /></span>{/if}
      <a class="remove" href={withoutAt(index)} aria-label={t('eda.dig.remove', { condition: words ? saidText([words]) : condition.field })} title={t('eda.dig.remove', { condition: words ? saidText([words]) : condition.field })}><Icon name="x" /></a>
    </span>
  {/each}
  {#if narrowChoices.length > 0}
    <MenuButton icon="plus" variant="outline" align="start" text={t('eda.dig.narrow')} label={t('eda.dig.narrow')} caption={t('eda.dig.narrow.caption')} choices={narrowChoices} />
  {/if}
  {#if found}
    {@const rows = found.result.rows}
    <span class="count"><b>{t('eda.page.rows', { count: rows.selected })}</b>{t('eda.dig.count', { share: percent(rows.selected, rows.total, language), rest: number(restOf(rows), language) })}</span>
  {/if}
</div>

{#if approve !== null}
  <div class="run">
    <RunButton bytes={approve} approve busy={running} onclick={() => run(true)} />
    <span class="meta">{t('eda.run.approve', { bytes: formatBytes(approve, language) })}</span>
  </div>
{:else if refused}
  <p class="note" role="alert"><Icon name="warning-fill" />{t('eda.run.refused', { reason: refused })}</p>
{:else if failed}
  <p class="note" role="alert"><Icon name="warning-fill" />{t('eda.run.failed')}</p>
  <div class="run"><Button variant="quiet" onclick={() => run()}><Icon name="play-fill" />{t('eda.run.again')}</Button></div>
{:else if running || !found}
  <p class="meta running">{t('eda.run.running')} <Loading inline /></p>
{:else}
  {@const result = found.result}
  <section class="result" aria-label={t('eda.dig.result')}>
    <div class="result-head"><span class="meta">{t('eda.dig.ran', { when: when(found.ranAt, language), bytes: formatBytes(found.bytes, language) })}</span></div>
    <p class="conclusion"><EdaSaid parts={common} /></p>

    {#if result.overTime}
      {@const time = result.overTime}
      <div class="block">
        <h3>
          {t('eda.dig.time')}
          <span class="meta">{#if roleOf(time.field)}<Sentence key="eda.dig.time.on" values={{ role: roleOf(time.field) }} names={{ field: time.field }} />{:else}<Sentence key="eda.dig.time.onField" names={{ field: time.field }} />{/if}</span>
        </h3>
        <EdaDigTime {time} />
      </div>
    {/if}

    {#if result.fields.length > 0}
      <div class="block">
        <h3>{t('eda.dig.fields')}</h3>
        {#each result.fields as field (field.field)}
          {#if texts(field)}
            <div class="field">
              <div class="field-head"><span class="mono">{field.field}</span>{#if roleOf(field.field)}<small>{roleOf(field.field)}</small>{/if}<span class="meta">{t('eda.dig.fields.differ')}</span></div>
              <ul class="values">
                {#each field.values as value, index (index)}
                  {@const shares = sharesOf(value, result.rows)}
                  {@const ratio = ratioWord(value.ratio, language)}
                  <li class:over={isOver(value)}>
                    {#if value.value === null}<span class="value word">{t('eda.dig.noValue')}</span>{:else}<span class="value mono">{value.value}</span>{/if}
                    <span class="bars" aria-hidden="true"><span class="bar selected" style:width={width(shares.selected)}></span><span class="bar rest" style:width={width(shares.rest)}></span></span>
                    <span class="pct"><b>{percent(shares.selected, 1, language)}</b><small>{t('eda.dig.share.selected')}</small></span>
                    <span class="pct"><b>{percent(shares.rest, 1, language)}</b><small>{t('eda.dig.share.rest')}</small></span>
                    {#if ratio === null}
                      <span class="ratio" title={t('eda.dig.ratio.only.title')}>{t('eda.dig.ratio.only')}</span>
                    {:else}
                      <span class="ratio" title={t('eda.dig.ratio.title', { ratio: timesWord(value.ratio ?? 0, language) })}>{ratio}</span>
                    {/if}
                    {#if value.real}
                      <span class="chance real"><Icon name="check-circle-fill" />{t('eda.dig.real')}</span>
                    {:else}
                      <span class="chance"><Icon name="shuffle" />{t('eda.dig.chance')}</span>
                    {/if}
                  </li>
                {/each}
              </ul>
            </div>
          {:else}
            <div class="number">
              <span class="mono">{field.field}</span>{#if roleOf(field.field)}<small>{roleOf(field.field)}</small>{:else}<span></span>{/if}
              <span>{t('eda.dig.number', { selected: middle(field.selected.median), rest: middle(field.rest.median), selectedMean: middle(field.selected.mean), restMean: middle(field.rest.mean) })}</span>
            </div>
          {/if}
        {/each}
        {#if result.fields.some(texts)}<p class="meta note-line">{t('eda.dig.note')}</p>{/if}
      </div>
    {/if}

    <div class="next">
      {#if gap}
        <div class="gap">
          <Icon name="bookmark-simple" />
          <div>
            <b>{t('eda.dig.gap')}</b>
            <p>“{gap.text}”{#if gap.scope}<span class="scope">{scopeLine(gap.scope)}</span>{/if}</p>
          </div>
          <Button href={resourcePath(id, 'gaps')} title={t('eda.dig.gap.about')} onclick={() => proposeGap(id, { text: gap.text, scope: gap.scope })}><Icon name="plus" />{t('eda.dig.gap.propose')}</Button>
        </div>
      {/if}
      {#if (further && strongest) || canQuery}
        <div class="acts">
          {#if further && strongest}
            <Button variant="outline" href={further}>
              <Icon name="funnel" />{#if strongest.value.value === null}{t('eda.dig.further.empty', { field: strongest.field })}{:else}{t('eda.dig.further', { value: strongest.value.value })}{/if}
            </Button>
          {/if}
          {#if canQuery}
            <Button variant="outline" href={newQueryPath(id)} title={t('eda.dig.query.about', { name: view.resource.displayName })}><Icon name="terminal-window-fill" />{t('eda.dig.query')}</Button>
          {/if}
        </div>
      {/if}
    </div>
  </section>
{/if}

<style>
  .back { display: inline-flex; align-items: center; gap: 5px; margin-bottom: 10px; font-size: var(--text-small); color: var(--text-secondary); text-decoration: none; }
  .back:hover span { text-decoration: underline; text-underline-offset: 3px; }
  .head { display: flex; flex-direction: column; gap: 2px; margin-bottom: 12px; }
  .head h2 { font-size: 20px; font-weight: var(--weight-medium); margin: 0; }
  .selection { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 6px 0 14px; }
  .condition { display: inline-flex; gap: 6px; align-items: center; padding: 5px 6px 5px 10px; border-radius: var(--radius-pill); background: var(--surface-sub); font-size: var(--text-small); }
  .condition > :global(.icon) { color: var(--text-muted); }
  .remove { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: var(--radius-pill); color: var(--text-muted); font-size: 11px; }
  .remove:hover { color: var(--text-primary); background: var(--tint-hover); }
  .count { margin-left: auto; font-size: var(--text-small); color: var(--text-secondary); }
  .count b { font-weight: var(--weight-medium); color: var(--text-primary); }
  .run { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
  .note { display: flex; gap: 6px; align-items: flex-start; margin: 8px 0 0; font-size: var(--text-small); line-height: 1.5; color: var(--signal-warn); }
  .note :global(.icon) { margin-top: 3px; flex: none; }
  .running { display: flex; gap: 6px; align-items: center; }
  .result { padding: 16px 18px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .result-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .result-head .meta { margin-left: auto; }
  .conclusion { font-size: 17px; line-height: 1.45; margin: 10px 0 16px; }
  .block { border-radius: var(--radius-md); background: var(--surface-solid); padding: 12px 14px; margin-top: 12px; }
  .block h3 { margin: 0 0 6px; font-size: var(--text-small); font-weight: var(--weight-medium); display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
  .field + .field, .field + .number { margin-top: 12px; }
  .field-head { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; font-size: var(--text-small); }
  .field-head .mono, .number .mono { font-weight: var(--weight-medium); }
  .field-head small, .number small { color: var(--text-muted); font-size: var(--text-meta); }
  .field-head .meta { margin-left: auto; }
  .values { list-style: none; margin: 6px 0 0; padding: 0; }
  .values li { display: grid; grid-template-columns: minmax(80px, 140px) minmax(120px, 1fr) 104px 104px 56px 120px; gap: 10px; align-items: center; padding: 6px 0; border-top: 1px solid var(--tint-hover);
    font-size: var(--text-small); }
  .value { min-width: 0; overflow-wrap: break-word; }
  .value.word { font-style: italic; color: var(--text-secondary); }
  .bars { display: grid; gap: 3px; }
  .bar { display: block; height: 7px; border-radius: var(--radius-pill); }
  .bar.selected { background: var(--signal-warn); }
  .bar.rest { background: var(--col-slate); opacity: .55; }
  .pct b { font-weight: var(--weight-medium); font-variant-numeric: tabular-nums; }
  .pct small { display: block; font-size: 10.5px; color: var(--text-muted); }
  .ratio { font-variant-numeric: tabular-nums; color: var(--text-secondary); }
  .over .ratio { color: var(--signal-warn); font-weight: var(--weight-medium); }
  .chance { display: inline-flex; gap: 4px; align-items: center; font-size: var(--text-meta); color: var(--text-muted); }
  .chance.real { color: var(--text-primary); }
  .number { display: grid; grid-template-columns: auto auto 1fr; gap: 8px; align-items: baseline; padding-top: 10px; border-top: 1px solid var(--tint-active); font-size: var(--text-small); }
  .note-line { display: block; margin: 8px 0 0; }
  .next { display: grid; gap: 10px; margin-top: 12px; }
  .gap { display: flex; gap: 12px; align-items: center; padding: 12px 14px; border-radius: var(--radius-md); background: var(--surface-solid); font-size: var(--text-small); }
  .gap > :global(.icon) { font-size: 20px; color: var(--text-secondary); flex: none; }
  .gap > div { flex: 1; min-width: 0; }
  .gap p { margin: 2px 0 0; line-height: 1.5; color: var(--text-secondary); }
  .gap b { font-weight: var(--weight-medium); }
  .scope { display: inline-block; margin-left: 6px; font-size: var(--text-meta); color: var(--text-muted); }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; }
  @media (max-width: 1100px) {
    .values li { grid-template-columns: minmax(80px, 1fr) minmax(100px, 1.4fr) 72px 72px; }
  }
</style>

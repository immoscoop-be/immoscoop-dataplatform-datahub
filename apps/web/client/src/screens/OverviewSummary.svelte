<script lang="ts">
  import { renderLog } from '@datahub/contracts/log';
  import { curate, SUMMARY, type SummaryPart, type SummarySource, type Weight, WEIGHTS } from '@datahub/contracts/summary';
  import MarkdownText from '@datahub/ui/components/MarkdownText.svelte';
  import { levelName } from '@datahub/ui/foundations/levels.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago } from '@datahub/ui/foundations/when.js';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import OriginTag from '@datahub/ui/marks/OriginTag.svelte';
  import type { LogEntry, Related, ResourceDetail } from '../lib/catalogue.js';
  import { nounOf } from '../lib/grain.js';
  import type { Conversation } from '../lib/messages.js';
  import { STATE_TEXTS } from '../lib/messages.js';
  import { resourcePath } from '../lib/routes.js';
  import { KIND_NAMES, STANDING_NAMES } from './MessageThread.svelte';

  /**
   * The Summary of a Resource, the first part of its Overview (FR-RC-19, DEC-UX-169): everything Data Hub knows about
   * it on one page, in the order to read it, each part numbered with its weight and a way to the part itself
   * (DEC-RC-17). A deprecation comes first; a part with nothing in it is left out. From its Messages it takes the Q&A of
   * the Owner and the Data Team, with the open Signals, and what colleagues noted, as Context (FR-RC-22, DEC-RC-18).
   * Claude reads the same Summary (FR-CL-25).
   */
  let {
    resource,
    related,
    threads,
    log,
    size,
    messagesHref,
    ongo,
  }: {
    resource: ResourceDetail;
    related: readonly Related[] | undefined;
    /** The threads on the Resource, the newest first; undefined while they are read. */
    threads: readonly Conversation[] | undefined;
    log: readonly LogEntry[] | undefined;
    /** Its size, as the part Querying says it; null when BigQuery does not tell it. */
    size: string | null;
    messagesHref: string | undefined;
    /** Opens a part of the Overview, or the Columns; the Messages are a link. */
    ongo: (target: Exclude<SummarySource, 'messages'>) => void;
  } = $props();

  const card = $derived(resource.card);
  const details = $derived(resource.details);
  const language = $derived(currentLanguage());
  const LOCALES = { nl: 'nl-BE', en: 'en-GB' } as const;
  const day = (value: string) => new Intl.DateTimeFormat(LOCALES[language], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
  const list = (names: readonly string[]) => new Intl.ListFormat(LOCALES[language], { type: 'conjunction' }).format(names);
  const WEIGHT_KEYS: Record<Weight, { name: string; means: string }> = {
    readFirst: { name: 'summary.weight.readFirst', means: 'summary.legend.readFirst' },
    beforeYouQuery: { name: 'summary.weight.beforeYouQuery', means: 'summary.legend.beforeYouQuery' },
    whenInterpreting: { name: 'summary.weight.whenInterpreting', means: 'summary.legend.whenInterpreting' },
    context: { name: 'summary.weight.context', means: 'summary.legend.context' },
  };
  const PART_KEYS: Record<SummaryPart, string> = {
    deprecated: 'summary.part.deprecated',
    whatItIs: 'summary.part.whatItIs',
    oneRow: 'summary.part.oneRow',
    useFor: 'summary.part.useFor',
    queryCheaply: 'summary.part.queryCheaply',
    joins: 'summary.part.joins',
    fields: 'summary.part.fields',
    watchOut: 'summary.part.watchOut',
    knownGaps: 'summary.part.knownGaps',
    qa: 'summary.part.qa',
    standing: 'summary.part.standing',
    colleagues: 'summary.part.colleagues',
    changes: 'summary.part.changes',
  };
  const CHANGE_KEYS = { added: 'resource.change.added', removed: 'resource.change.removed', retyped: 'resource.change.retyped' } as const;

  const curated = $derived(curate(threads ?? []));
  const joins = $derived((related ?? []).filter((mapping) => mapping.resources.length > 0));
  const described = $derived(resource.fields.filter((field) => field.businessDescription.trim() !== '').length);

  /** Whether a part has anything in it: a part without is left out (DEC-RC-17). */
  const has: Record<SummaryPart, () => boolean> = {
    deprecated: () => resource.deprecation !== null,
    whatItIs: () => Boolean(card.businessDescription || resource.description),
    oneRow: () => details.grain.length > 0 || details.modelType !== null,
    useFor: () => Boolean(card.intendedUse),
    queryCheaply: () => Boolean(details.partition || details.clusterBy.length > 0 || size || card.keyFields.length > 0 || card.parameters.length > 0),
    joins: () => joins.length > 0,
    fields: () => resource.fields.length > 0,
    watchOut: () => Boolean(card.pitfalls || card.reliableSince),
    knownGaps: () => card.knownGaps.length > 0,
    qa: () => curated.qa.length > 0,
    standing: () => true,
    colleagues: () => curated.colleagues.length > 0,
    changes: () => (log ?? []).length > 0,
  };
  const parts = $derived.by(() => {
    let number = 0;
    return SUMMARY.filter((entry) => has[entry.part]()).map((entry) => ({ ...entry, number: entry.part === 'deprecated' ? null : ++number }));
  });
  const WHERE: Record<SummarySource, string> = {
    description: 'resource.description',
    behaviour: 'resource.behaviour',
    gaps: 'resource.gaps',
    querying: 'overview.querying',
    entities: 'resource.entities',
    maturity: 'resource.maturity',
    changes: 'overview.changes',
    columns: 'resource.tab.columns',
    messages: 'messages.button',
  };
</script>

{#snippet said(thread: Conversation)}
  <li>
    <span class="kind" class:signal={thread.kind === 'signal'}>{KIND_NAMES[thread.kind]}</span>
    <span class="words">
      {#if thread.state && STATE_TEXTS[thread.state]}<b>{t(STATE_TEXTS[thread.state]!)}</b>,{' '}{/if}{thread.writer?.name}{#if thread.writer?.as}{' '}<span class="role">{STANDING_NAMES[thread.writer.as]}</span>{/if}, {ago(thread.createdAt, language)}: <span class="written">{thread.params.text}</span>
      {#each thread.replies.filter((reply) => reply.writer?.as) as reply (reply.id)}
        <span class="answer"><span class="role">{STANDING_NAMES[reply.writer!.as!]}</span> {reply.writer?.name}: <span class="written">{reply.params.text}</span></span>
      {/each}
    </span>
  </li>
{/snippet}

<div class="legend">
  {#each WEIGHTS as weight (weight)}<span class="weight {weight}">{t(WEIGHT_KEYS[weight].name)}</span><span class="means">{t(WEIGHT_KEYS[weight].means)}</span>{/each}
</div>

<ol class="parts">
  {#each parts as { part, weight, from, number } (part)}
    <li class="part" class:deprecated={part === 'deprecated'}>
      <div class="side">
        <span class="number">{#if number === null}<Icon name="archive-fill" />{:else}{number}{/if}</span>
        <span class="weight {weight}">{t(WEIGHT_KEYS[weight].name)}</span>
      </div>
      <div class="main">
        <div class="title">
          <h3>{t(PART_KEYS[part])}</h3>
          {#if from === 'messages' && messagesHref}
            <a class="go" href={messagesHref}>{t(WHERE.messages)}<Icon name="arrow-right" /></a>
          {:else if from && from !== 'messages'}
            <button type="button" class="go" onclick={() => ongo(from)}>{t(WHERE[from])}<Icon name="arrow-right" /></button>
          {/if}
        </div>
        {#if part === 'deprecated' && resource.deprecation}
          <p class="line">
            {t('resource.deprecated.text', { by: resource.deprecation.by, date: day(resource.deprecation.at), reason: resource.deprecation.reason })}
            {#if resource.deprecation.insteadOf}<a href={resourcePath(resource.deprecation.insteadOf.id)}>{t('resource.deprecated.use', { name: resource.deprecation.insteadOf.displayName })}</a>.{/if}
            {t('resource.deprecated.still')}
          </p>
        {:else if part === 'whatItIs'}
          {#if card.businessDescription}<MarkdownText source={card.businessDescription} />{/if}
          {#if resource.description}<p class="dbt" class:alone={!card.businessDescription}><OriginTag origin="dbt" /><span>{resource.description}</span></p>{/if}
        {:else if part === 'oneRow'}
          <p class="line">
            {#if details.grain.length > 0}{details.grainSentence || details.grain.join(' × ')}{#each details.grain as field (field)}{' '}<span class="code">{field}</span>{/each}{/if}
            {#if details.modelType}{details.grain.length > 0 ? ' · ' : ''}{t('resource.modelType', { type: details.modelType })}{/if}
          </p>
        {:else if part === 'useFor'}
          <p class="line written">{card.intendedUse}</p>
        {:else if part === 'queryCheaply'}
          {#if details.partition || details.clusterBy[0]}
            <p class="line">
              {#if details.partition && details.partitionFilter !== 'none'}{t('resource.filterRequired', { field: details.partition.field })}
              {:else if details.partition}{t('resource.filterFirst', { field: details.partition.field })}{/if}
              {#if details.clusterBy[0]}{t('resource.clusterThen', { field: details.clusterBy[0] })}{/if}
            </p>
          {/if}
          {#if size}<p class="line">{t('resource.size')}: {size}</p>{/if}
          {#if card.keyFields.length > 0 || card.parameters.length > 0}
            <p class="line">
              {#if card.keyFields.length > 0}{t('resource.keyFields')}{#each card.keyFields as field (field)}{' '}<span class="code">{field}</span>{/each}{/if}
              {#if card.parameters.length > 0}{card.keyFields.length > 0 ? ' · ' : ''}{t('resource.parameters')}{#each card.parameters as field (field)}{' '}<span class="code">{field}</span>{/each}{/if}
            </p>
          {/if}
        {:else if part === 'joins'}
          {#each joins as mapping (mapping.field)}
            <p class="line"><span class="code">{nounOf(mapping.identity)}</span> {t('resource.entity.on', { field: mapping.field })}: {t('resource.entity.joins', { names: list(mapping.resources.map((other) => other.displayName)) })}</p>
          {/each}
        {:else if part === 'fields'}
          <p class="line">{t('summary.fields', { count: resource.fields.length, described })}</p>
        {:else if part === 'watchOut'}
          {#if card.pitfalls}<p class="line written">{card.pitfalls}</p>{/if}
          {#if card.reliableSince}<p class="line">{t('summary.reliable', { date: day(card.reliableSince) })}</p>{/if}
        {:else if part === 'knownGaps'}
          <ul class="gaps">{#each card.knownGaps as gap (gap.id)}<li>{gap.text}</li>{/each}</ul>
        {:else if part === 'qa'}
          <ul class="threads">{#each curated.qa as thread (thread.id)}{@render said(thread)}{/each}</ul>
        {:else if part === 'standing'}
          <p class="line">
            <MaturityIcon level={resource.level} small />
            {levelName(resource.level)}{#if resource.publication}{' · '}{t('summary.published', { published: day(resource.publication.publishedAt), by: resource.publication.publishedBy, confirmed: day(resource.publication.confirmedAt), confirmedBy: resource.publication.confirmedBy })}{:else}{' · '}{t('summary.notPublished')}{/if}
          </p>
          {#if resource.changes.length > 0}
            <p class="line warn">
              {t('summary.changedSince')}
              {resource.changes.map((change) => t(CHANGE_KEYS[change.change], { field: change.field, old: change.old ?? '', new: change.new ?? '', date: day(change.at) })).join('; ')}
            </p>
          {/if}
        {:else if part === 'colleagues'}
          <ul class="threads">{#each curated.colleagues as thread (thread.id)}{@render said(thread)}{/each}</ul>
        {:else if part === 'changes'}
          <ul class="log">{#each (log ?? []).slice(0, 5) as entry, index (index)}<li><span class="text">{renderLog(entry.logId, entry.params, language)}</span><span class="at">{ago(entry.at, language)}</span></li>{/each}</ul>
        {/if}
      </div>
    </li>
  {/each}
</ol>

<style>
  .legend { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; margin: 0 0 12px; font-size: var(--text-meta); color: var(--text-muted); }
  .legend .weight:not(:first-child) { margin-left: 10px; }
  .weight { font-size: 10px; font-weight: var(--weight-medium); padding: 2px 8px; border-radius: var(--radius-pill); white-space: nowrap; }
  .readFirst { color: var(--surface-solid); background: var(--text-primary); }
  .beforeYouQuery { color: var(--text-primary); background: var(--tint-active); }
  .whenInterpreting { color: var(--text-primary); outline: 1px solid var(--text-muted); outline-offset: -1px; }
  .context { color: var(--text-muted); background: var(--tint-hover); }
  .parts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .part { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 14px; padding: 14px 16px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .part.deprecated { background: color-mix(in srgb, var(--signal-warn) 9%, var(--surface-sub)); }
  .side { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
  .number { font-size: 20px; font-weight: var(--weight-medium); line-height: 1; color: var(--text-primary); }
  .deprecated .number { color: var(--signal-warn); font-size: 18px; }
  .main { min-width: 0; }
  .title { display: flex; align-items: baseline; gap: 10px; margin-bottom: 6px; }
  .title h3 { flex: 1; margin: 0; font-size: var(--text-body); font-weight: var(--weight-medium); }
  .go { all: unset; display: inline-flex; align-items: center; gap: 5px; font-size: var(--text-small); color: var(--text-secondary); cursor: pointer; text-decoration: none; }
  .go:hover { color: var(--text-primary); text-decoration: underline; text-underline-offset: 3px; }
  .go:focus-visible { outline: 2px solid var(--text-secondary); outline-offset: 2px; }
  .line { margin: 0 0 6px; font-size: var(--text-small); line-height: 1.7; color: var(--text-secondary); }
  .written { white-space: pre-line; }
  .line:last-child { margin-bottom: 0; }
  .line a { color: var(--text-primary); text-underline-offset: 3px; }
  .warn { color: var(--signal-warn); }
  .dbt { display: flex; gap: 8px; align-items: baseline; margin: 8px 0 0; font-size: var(--text-small); line-height: 1.5; color: var(--text-secondary); }
  .dbt.alone { margin-top: 0; }
  .code { display: inline-block; font: var(--text-meta) var(--font-mono); color: var(--text-secondary); background: var(--surface-solid); padding: 1px 7px; border-radius: var(--radius-chip); }
  .gaps { margin: 0; padding-left: 18px; font-size: var(--text-small); line-height: 1.6; color: var(--text-secondary); }
  .gaps li { white-space: pre-line; }
  .threads { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: var(--text-small); line-height: 1.6; color: var(--text-secondary); }
  .threads li { display: flex; align-items: baseline; gap: 8px; }
  .threads b { color: var(--text-primary); font-weight: var(--weight-medium); }
  .words { min-width: 0; }
  .answer { display: block; margin-top: 2px; }
  .kind { flex: none; font-size: 10px; font-weight: var(--weight-medium); padding: 2px 8px; border-radius: var(--radius-pill); background: var(--tint-hover); color: var(--text-secondary); }
  .kind.signal { color: var(--signal-warn); background: color-mix(in srgb, var(--signal-warn) 13%, var(--surface-solid)); }
  .role { font-size: 10px; font-weight: var(--weight-medium); color: var(--text-primary); background: var(--tint-active); padding: 1px 7px; border-radius: var(--radius-pill); }
  .log { list-style: none; margin: 0; padding: 0; font-size: var(--text-small); }
  .log li { display: flex; gap: 10px; padding: 4px 0; color: var(--text-secondary); }
  .log .text { flex: 1; }
  .log .at { color: var(--text-muted); white-space: nowrap; }
</style>

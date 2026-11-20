<script lang="ts">
  import type { ModelType, TypeField, TypeRole } from '@datahub/contracts/model-types';
  import { dateFieldOf, dateFieldsOf } from '@datahub/contracts/reliable';
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import type { Card, CardChanges, Field } from '../lib/catalogue.js';
  import type { FirstRow } from '../lib/query.js';
  import LearningRef from './LearningRef.svelte';

  /**
   * Reliable Since, a tile of its own on top of the Known Gaps of a Resource (FR-RC-31, DEC-UX-296, DEC-UX-297): from
   * which day the whole table can be relied on, on its Date Field, with why not earlier; or from its first row. Under it
   * the time of its data as a line, before that day shaded; it draws no Known Gaps. Not set is empty, never one of the
   * two: who may describe it is asked to choose one, Save off until one is. Its Date Field comes from its table type;
   * another one chosen is called unusual (FR-RC-32, DEC-RC-32).
   */
  let {
    reliable,
    chosen,
    type,
    typeFields,
    fields,
    canEdit,
    onsave,
    firstRowOf,
  }: {
    reliable: Card['reliableSince'];
    /** The Date Field its Owner Unit or the Data Team chose; null takes the one its table type gives. */
    chosen: string | null;
    type: ModelType | null;
    typeFields: readonly TypeField[];
    fields: readonly Field[];
    /** Whether the User may set it (`availableSince`, DEC-PL-03). */
    canEdit: boolean;
    onsave: (changes: CardChanges) => Promise<boolean>;
    /** Reads its first row on a date field; undefined where nothing can (DEC-RC-33). */
    firstRowOf?: (field: string) => Promise<FirstRow | null>;
  } = $props();

  const LOCALES = { nl: 'nl-BE', en: 'en-GB' } as const;
  const day = (value: string) => new Intl.DateTimeFormat(LOCALES[currentLanguage()], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
  const name = `reliable-${Math.random().toString(36).slice(2, 9)}`;

  const dateField = $derived(dateFieldOf(chosen, type, typeFields, fields));
  const dates = $derived(dateFieldsOf(fields));
  const ROLES: Partial<Record<TypeRole, string>> = {
    happenedAt: 'reliable.role.happenedAt',
    occurredAt: 'reliable.role.occurredAt',
    period: 'reliable.role.period',
    createdAt: 'reliable.role.createdAt',
    updatedAt: 'reliable.role.updatedAt',
  };
  const roleText = (role: TypeRole) => t(ROLES[role] ?? 'reliable.role.period');

  // Its first row on its Date Field, read once it is known (DEC-RC-33).
  let first: FirstRow | null | undefined = $state();
  $effect(() => {
    const field = dateField.field;
    first = undefined;
    if (!field || !firstRowOf) {
      first = null;
      return;
    }
    let stale = false;
    firstRowOf(field).then(
      (found) => !stale && (first = found),
      () => !stale && (first = null),
    );
    return () => {
      stale = true;
    };
  });
  const firstDay = $derived(first?.day ?? null);

  // The form: nothing chosen until the User chooses (FR-RC-31).
  let editing = $state(false);
  let saving = $state(false);
  let failed = $state(false);
  let choice: '' | 'firstRow' | 'day' = $state('');
  let draftDay = $state('');
  let draftWhy = $state('');
  let draftField = $state('');

  function start() {
    choice = reliable?.from ?? '';
    draftDay = reliable?.day ?? '';
    draftWhy = reliable?.why ?? '';
    draftField = chosen ?? '';
    failed = false;
    editing = true;
  }

  /** Not set: the form shows at once for who may set it, nothing chosen. */
  const asking = $derived(canEdit && reliable === null && !editing);
  $effect(() => {
    if (asking) start();
  });

  /** The field the form would read it on, and whether it is unusual for its table type. */
  const formField = $derived(draftField || dateField.typeField?.field || '');
  const formUnusual = $derived(Boolean(draftField) && dateFieldOf(draftField, type, typeFields, fields).unusual);
  const problem = $derived.by(() => {
    if (!choice) return t('reliable.nothingChosen');
    if (choice === 'day') {
      if (!draftDay) return t('reliable.day');
      if (!draftWhy.trim()) return t('reliable.whyLabel');
      if (!formField) return t('reliable.dateField.choose');
    }
    return null;
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (problem) return;
    const changes: CardChanges = {
      reliableSince: choice === 'firstRow' ? { from: 'firstRow' } : { from: 'day', day: draftDay, why: draftWhy.trim() },
      ...((draftField || null) !== chosen ? { dateField: draftField || null } : {}),
    };
    saving = true;
    const ok = await onsave(changes);
    saving = false;
    failed = !ok;
    if (ok) editing = false;
  }

  // The line: from its first row to today, before Reliable Since shaded.
  const today = new Date().toISOString().slice(0, 10);
  const since = $derived(reliable?.from === 'day' ? reliable.day : null);
  const at = $derived.by(() => {
    if (!since) return 0;
    if (!firstDay) return 0.25;
    const start = Date.parse(firstDay);
    const span = Date.parse(today) - start;
    return span > 0 ? Math.min(1, Math.max(0, (Date.parse(since) - start) / span)) : 0;
  });
</script>

<section class="tile" id="reliable-since" aria-label={t('resource.reliableSince')}>
  <div class="head">
    <div class="said"><Icon name="calendar-check-fill" /><LearningRef place="reliableSince">{#snippet children(mark)}<span>{t('resource.reliableSince')}{@render mark?.()}</span>{/snippet}</LearningRef></div>
    {#if canEdit && reliable !== null && !editing}<Button variant="outline" onclick={start}><Icon name="pencil-simple-line" />{t('reliable.change')}</Button>{/if}
    {#if reliable === null}<span class="required">{t('reliable.required')}</span>{/if}
  </div>

  {#if reliable && !editing}
    {#if reliable.from === 'day' && reliable.day}
      <p class="value"><b>{day(reliable.day)}</b>{#if dateField.field}<span class="meta">{t('reliable.on', { field: dateField.field })}{#if dateField.source === 'type' && dateField.typeField}, {roleText(dateField.typeField.role)}{/if}</span>{/if}</p>
      <div class="why"><span class="meta">{t('reliable.why')}</span><p>{reliable.why || t('reliable.whyMissing')}</p></div>
    {:else}
      <p class="value"><b>{t('reliable.firstRow')}</b>{#if dateField.field}<span class="meta">{#if firstDay}{day(firstDay)}, {/if}{t('reliable.on', { field: dateField.field })}</span>{/if}</p>
      <p class="text">{t('reliable.firstRow.text')}</p>
    {/if}
    {#if reliable.setBy && reliable.setAt}<span class="meta">{t('reliable.setBy', { name: reliable.setBy, date: day(reliable.setAt) })}</span>{/if}
    {#if dateField.gone}
      <p class="warn" role="status"><Icon name="warning-fill" /><span>{t('reliable.gone', { field: dateField.field ?? '' })}</span></p>
    {:else if dateField.unusual && dateField.typeField}
      <p class="warn" role="status"><Icon name="warning-fill" /><span><b>{t('reliable.unusual.title')}</b> {t('reliable.unusual.text', { field: dateField.typeField.field, chosen: dateField.field ?? '' })}</span></p>
    {/if}
  {:else if reliable === null && !canEdit}
    <p class="none">{t('reliable.notSet')}</p>
    <p class="meta">{t('reliable.notSet.others')}</p>
  {:else if reliable === null}
    <p class="none">{t('reliable.notSet')}</p>
  {/if}

  {#if reliable && (since || reliable.from === 'firstRow')}
    <div class="line">
      <div class="track" role="img" aria-label={t('reliable.line.label', { since: since ? day(since) : t('reliable.firstRow') })}>
        {#if at > 0}<span class="before" style:width="{at * 100}%"></span>{/if}
      </div>
      <div class="ticks">
        {#if since}
          {#if at >= 0.18}<span class="tick" style:left="0">{firstDay ? t('reliable.line.first') : t('reliable.line.earlier')}{#if firstDay}<b>{day(firstDay)}</b>{/if}</span>{/if}
          <span class="tick mark" class:flip={at > 0.7} style:left={at > 0.7 ? undefined : `${at * 100}%`} style:right={at > 0.7 ? `${(1 - at) * 100}%` : undefined}>{t('reliable.line.since')}<b>{day(since)}</b></span>
        {:else}
          <span class="tick mark" style:left="0">{t('reliable.line.sinceFirst')}{#if firstDay}<b>{day(firstDay)}</b>{/if}</span>
        {/if}
        {#if at <= 0.7}<span class="tick end">{t('reliable.line.today')}<b>{day(today)}</b></span>{/if}
      </div>
      {#if at > 0}<p class="key"><span class="swatch" aria-hidden="true"></span>{t('reliable.line.before')}</p>{/if}
    </div>
  {/if}

  {#if editing}
    <form class="form" onsubmit={save} aria-label={t('resource.reliableSince')}>
      {#if reliable === null}<p class="ask">{t('reliable.ask')}</p>{/if}
      <label class="choice"
        ><input type="radio" {name} value="firstRow" bind:group={choice} /><span
          ><b>{t('reliable.firstRow')}</b><span class="meta">{firstDay ? t('reliable.choice.firstRow.hintDay', { day: day(firstDay) }) : t('reliable.choice.firstRow.hint')}</span></span
        ></label
      >
      <label class="choice"
        ><input type="radio" {name} value="day" bind:group={choice} disabled={dates.length === 0} /><span
          ><b>{t('reliable.choice.day')}</b><span class="meta">{dates.length === 0 ? t('reliable.dateField.none') : t('reliable.choice.day.hint')}</span></span
        ></label
      >
      {#if choice && dates.length > 0}
        <div class="later">
          {#if choice === 'day'}<label class="field"><span>{t('reliable.day')}</span><input {...NO_PASSWORD_MANAGER} type="date" bind:value={draftDay} /></label>{/if}
          <label class="field"
            ><span>{t('reliable.dateField')}</span>
            <select bind:value={draftField}>
              {#if dateField.typeField}
                <option value="">{t('reliable.dateField.type', { field: dateField.typeField.field, role: roleText(dateField.typeField.role) })}</option>
              {:else}
                <option value="" disabled>{t('reliable.dateField.choose')}</option>
              {/if}
              {#each dates.filter((one) => one !== dateField.typeField?.field) as one (one)}<option value={one}>{one}</option>{/each}
            </select></label
          >
        </div>
        <p class="meta note">{t('reliable.dateField.note')}</p>
        {#if formUnusual && dateField.typeField}
          <p class="warn indent" role="status"><Icon name="warning-fill" /><span><b>{t('reliable.unusual.title')}</b> {t('reliable.unusual.text', { field: dateField.typeField.field, chosen: draftField })}</span></p>
        {/if}
      {/if}
      {#if choice === 'day'}
        <label class="field"><span>{t('reliable.whyLabel')}</span><textarea {...NO_PASSWORD_MANAGER} rows="2" maxlength="1000" placeholder={t('reliable.whyPlaceholder')} bind:value={draftWhy}></textarea></label>
      {/if}
      {#if failed}<p class="failed" role="alert">{t('reliable.failed')}</p>{/if}
      <div class="foot">
        <span class="meta">{choice ? t('gaps.history') : t('reliable.nothingChosen')}</span>
        {#if reliable !== null}<Button variant="quiet" onclick={() => (editing = false)}>{t('collection.cancel')}</Button>{/if}
        <Button type="submit" disabled={saving || problem !== null}>{t('collection.save')}</Button>
      </div>
    </form>
  {/if}
</section>

<style>
  .tile { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; padding: 16px 18px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .head { display: flex; align-items: center; gap: 10px; }
  .said { flex: 1; display: flex; align-items: center; gap: 6px; font-size: var(--text-small); font-weight: var(--weight-medium); }
  .said > :global(.icon) { color: var(--text-secondary); }
  .required { display: inline-flex; align-items: center; gap: 5px; font-size: var(--text-meta); color: var(--text-secondary); }
  .required::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--text-primary); }
  .value { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin: 0; }
  .value b { font-size: var(--text-section); font-weight: var(--weight-medium); color: var(--text-primary); }
  .meta { font-size: var(--text-meta); color: var(--text-muted); }
  .why { display: flex; flex-direction: column; gap: 2px; max-width: 720px; }
  .why p, .text { margin: 0; font-size: var(--text-small); line-height: 1.55; color: var(--text-primary); white-space: pre-line; }
  .none { margin: 0; font-size: var(--text-small); color: var(--text-muted); }
  .warn { display: flex; gap: 8px; margin: 0; font-size: var(--text-small); line-height: 1.5; color: var(--text-secondary); max-width: 720px; }
  .warn > :global(.icon) { flex: none; margin-top: 2px; color: var(--signal-warn); }
  .warn b { font-weight: var(--weight-medium); color: var(--text-primary); }
  .indent { margin-left: 26px; }
  .line { margin-top: 4px; }
  .track { position: relative; height: 16px; border-radius: var(--radius-pill); background: var(--text-secondary); overflow: hidden; }
  .before { position: absolute; inset: 0 auto 0 0; background: repeating-linear-gradient(135deg, var(--tint-active) 0 4px, var(--surface-solid) 4px 8px); }
  .ticks { position: relative; height: 36px; margin-top: 6px; }
  .tick { position: absolute; top: 0; display: flex; flex-direction: column; font-size: var(--text-meta); color: var(--text-muted); white-space: nowrap; }
  .tick b { font-weight: var(--weight-medium); color: var(--text-secondary); }
  .tick.end { right: 0; text-align: right; align-items: flex-end; }
  .tick.mark { padding-left: 8px; border-left: 1.5px solid var(--text-primary); margin-top: -18px; padding-top: 18px; }
  .tick.mark.flip { padding-left: 0; padding-right: 8px; border-left: 0; border-right: 1.5px solid var(--text-primary); align-items: flex-end; }
  .tick.mark b { color: var(--text-primary); }
  .key { display: flex; align-items: center; gap: 8px; margin: 4px 0 0; font-size: var(--text-meta); color: var(--text-secondary); }
  .swatch { flex: none; width: 18px; height: 12px; border-radius: var(--radius-mark); background: repeating-linear-gradient(135deg, var(--tint-active) 0 4px, var(--surface-solid) 4px 8px); }
  .form { display: flex; flex-direction: column; gap: 12px; padding: 14px 16px; border-radius: var(--radius-md); background: var(--surface-solid); outline: 1.5px solid var(--text-secondary); outline-offset: -1.5px; }
  .ask { margin: 0; font-size: var(--text-small); font-weight: var(--weight-medium); }
  .choice { display: flex; align-items: flex-start; gap: 10px; font-size: var(--text-small); cursor: pointer; }
  .choice input { margin: 3px 0 0; accent-color: var(--text-primary); }
  .choice > span { display: flex; flex-direction: column; gap: 1px; }
  .choice b { font-weight: var(--weight-medium); }
  .later { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 10px; padding-left: 26px; }
  .note { margin: -6px 0 0 26px; }
  .field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
  .field > span { font-size: var(--text-meta); color: var(--text-muted); }
  textarea, input[type='date'], select { box-sizing: border-box; width: 100%; font: var(--text-small) var(--font-family); line-height: 1.5; color: var(--text-primary); background: var(--surface-solid); border: 1px solid var(--tint-active); border-radius: var(--radius-field); padding: 7px 10px; }
  textarea { resize: vertical; }
  textarea:focus, input[type='date']:focus, select:focus { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
  .foot { display: flex; align-items: center; gap: 8px; }
  .foot .meta { flex: 1; }
  .failed { margin: 0; font-size: var(--text-small); color: var(--signal-urgent); }
  @media (max-width: 900px) { .later { grid-template-columns: minmax(0, 1fr); } }
</style>

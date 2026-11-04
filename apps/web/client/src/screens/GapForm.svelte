<script lang="ts">
  import { DATE_TYPES, fieldsOf, type GapScope, hasScope } from '@datahub/contracts/gaps';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import IconButton from '@datahub/ui/primitives/IconButton.svelte';
  import type { Field } from '../lib/catalogue.js';

  /**
   * Adding or changing a Known Gap (FR-RC-24, DEC-UX-177): its why in plain text, then what narrows it down, each
   * optional and combined: a period, from and to, on a date field, its partition by default; fields, empty or
   * unreliable; and rows, a field with one of some values, typed, or empty. Each kind is a block of its own, taken
   * away with its ×. A field the gap named that left the Resource since stays to choose, marked so (EC-RC-01).
   */
  let {
    text: given = '',
    scope: before = null,
    fields,
    partition,
    busy,
    label,
    saveLabel,
    onsave,
    oncancel,
  }: {
    text?: string;
    scope?: GapScope | null;
    fields: readonly Field[];
    /** The partition field, for a period by default. */
    partition: string | null;
    busy: boolean;
    /** What the form is called, such as "A new Known Gap". */
    label: string;
    saveLabel: string;
    onsave: (text: string, scope: GapScope | null) => void;
    oncancel: () => void;
  } = $props();

  const MAX = 1000;
  // What is in the form, from the gap as it is.
  // svelte-ignore state_referenced_locally
  let text = $state(given);
  // svelte-ignore state_referenced_locally
  let period = $state(before?.period ? { ...before.period, from: before.period.from ?? '', to: before.period.to ?? '' } : null);
  // svelte-ignore state_referenced_locally
  let chosen: string[] | null = $state(before?.fields ? [...before.fields] : null);
  // svelte-ignore state_referenced_locally
  let rows = $state(before?.rows ? { field: before.rows.field, is: before.rows.is, values: before.rows.is === 'oneOf' ? [...before.rows.values] : [] } : null);
  let value = $state('');

  /** The fields of the Resource, and those the gap named that left it since. */
  const known = $derived(new Set(fields.map((field) => field.name)));
  // svelte-ignore state_referenced_locally
  const gone = fieldsOf(before).filter((name) => !fields.some((field) => field.name === name));
  const names = $derived([...fields.map((field) => field.name), ...gone]);
  const dates = $derived([
    ...fields.filter((field) => DATE_TYPES.includes((field.dataType ?? '').toUpperCase())).map((field) => field.name),
    ...(before?.period && !known.has(before.period.field) ? [before.period.field] : []),
  ]);
  const nameOf = (name: string) => (known.has(name) ? (name === partition ? t('gaps.partition', { name }) : name) : t('gaps.gone', { name }));

  function addPeriod() {
    period = { field: partition && dates.includes(partition) ? partition : (dates[0] ?? ''), from: '', to: '' };
  }
  function addRows() {
    rows = { field: names[0] ?? '', is: 'oneOf', values: [] };
  }
  function addValue(event?: KeyboardEvent) {
    if (event && event.key !== 'Enter' && event.key !== ',') return;
    event?.preventDefault();
    const typed = value.trim();
    if (rows && typed && !rows.values.includes(typed)) rows.values = [...rows.values, typed];
    value = '';
  }

  /** The scope as it would be saved, or why it cannot be yet. */
  const scope = $derived.by((): GapScope | null => {
    const made: GapScope = {};
    if (period) made.period = { field: period.field, from: period.from || null, to: period.to || null };
    if (chosen && chosen.length > 0) made.fields = [...chosen];
    if (rows) made.rows = rows.is === 'empty' ? { field: rows.field, is: 'empty' } : { field: rows.field, is: 'oneOf', values: [...rows.values] };
    return hasScope(made) ? made : null;
  });
  const problem = $derived.by(() => {
    if (!text.trim()) return 'text';
    if (period && !period.from && !period.to) return t('gaps.problem.open');
    if (period && period.from && period.to && period.from > period.to) return t('gaps.problem.order');
    if (rows && rows.is === 'oneOf' && rows.values.length === 0) return t('gaps.problem.values');
    return null;
  });

  function save(event: SubmitEvent) {
    event.preventDefault();
    addValue();
    if (!problem) onsave(text.trim(), scope);
  }
</script>

<form class="form" aria-label={label} onsubmit={save}>
  <label class="field">
    <span>{t('gaps.text')}</span>
    <!-- svelte-ignore a11y_autofocus -->
    <textarea bind:value={text} rows="2" maxlength={MAX} autofocus onkeydown={(event) => event.key === 'Escape' && oncancel()}></textarea>
  </label>
  <div class="add">
    <span class="meta">{t('gaps.narrow')}</span>
    <Button variant="outline" disabled={period !== null || dates.length === 0} title={dates.length === 0 ? t('gaps.noDates') : undefined} onclick={addPeriod}><Icon name="calendar-blank" />{t('gaps.period')}</Button>
    <Button variant="outline" disabled={chosen !== null} onclick={() => (chosen = [])}><Icon name="columns" />{t('gaps.fields')}</Button>
    <Button variant="outline" disabled={rows !== null} onclick={addRows}><Icon name="rows" />{t('gaps.rows')}</Button>
  </div>
  {#if period}
    <section class="block" aria-label={t('gaps.period')}>
      <div class="head"><Icon name="calendar-blank" /><b>{t('gaps.period')}</b><span class="meta">{t('gaps.period.hint')}</span><IconButton icon="x" label={t('gaps.remove.period')} onclick={() => (period = null)} /></div>
      <div class="grid">
        <label class="field"><span>{t('gaps.from')}</span><input type="date" bind:value={period.from} /></label>
        <label class="field"><span>{t('gaps.to')}</span><input type="date" bind:value={period.to} /></label>
        <label class="field"><span>{t('gaps.on.field')}</span><select bind:value={period.field}>{#each dates as name (name)}<option value={name}>{nameOf(name)}</option>{/each}</select></label>
      </div>
    </section>
  {/if}
  {#if chosen}
    <section class="block" aria-label={t('gaps.fields')}>
      <div class="head"><Icon name="columns" /><b>{t('gaps.fields')}</b><span class="meta">{t('gaps.fields.hint')}</span><IconButton icon="x" label={t('gaps.remove.fields')} onclick={() => (chosen = null)} /></div>
      <div class="values">
        {#each chosen as name (name)}
          <span class="code" class:gone={!known.has(name)}>{name}<button type="button" aria-label={t('gaps.removeValue', { value: name })} onclick={() => (chosen = (chosen ?? []).filter((other) => other !== name))}>×</button></span>
        {/each}
        <select
          aria-label={t('gaps.addField')}
          value=""
          onchange={(event) => {
            const picked = (event.currentTarget as HTMLSelectElement).value;
            if (picked && chosen && !chosen.includes(picked)) chosen = [...chosen, picked];
            (event.currentTarget as HTMLSelectElement).value = '';
          }}
        >
          <option value="">+ {t('gaps.addField')}</option>
          {#each fields.filter((field) => !chosen?.includes(field.name)) as field (field.name)}<option value={field.name}>{field.name}</option>{/each}
        </select>
      </div>
    </section>
  {/if}
  {#if rows}
    <section class="block" aria-label={t('gaps.rows')}>
      <div class="head"><Icon name="rows" /><b>{t('gaps.rows')}</b><span class="meta">{t('gaps.rows.hint')}</span><IconButton icon="x" label={t('gaps.remove.rows')} onclick={() => (rows = null)} /></div>
      <div class="grid">
        <label class="field"><span>{t('gaps.field')}</span><select bind:value={rows.field}>{#each names as name (name)}<option value={name}>{nameOf(name)}</option>{/each}</select></label>
        <label class="field"><span>{t('gaps.is')}</span><select bind:value={rows.is}><option value="oneOf">{t('gaps.oneOf')}</option><option value="empty">{t('gaps.empty')}</option></select></label>
        {#if rows.is === 'oneOf'}
          <div class="field">
            <span>{t('gaps.values')}</span>
            <div class="values">
              {#each rows.values as one (one)}
                <span class="code">{one}<button type="button" aria-label={t('gaps.removeValue', { value: one })} onclick={() => rows && (rows.values = rows.values.filter((other) => other !== one))}>×</button></span>
              {/each}
              <input type="text" bind:value aria-label={t('gaps.addValue')} placeholder={t('gaps.addValue')} maxlength="200" onkeydown={addValue} onblur={() => addValue()} />
            </div>
          </div>
        {/if}
      </div>
    </section>
  {/if}
  <div class="foot">
    <span class="meta" role={problem && problem !== 'text' ? 'status' : undefined}>{problem && problem !== 'text' ? problem : t('gaps.history')}</span>
    <Button variant="quiet" onclick={oncancel}>{t('collection.cancel')}</Button>
    <Button type="submit" disabled={busy || problem !== null}>{saveLabel}</Button>
  </div>
</form>

<style>
  .form { display: flex; flex-direction: column; gap: 12px; padding: 14px 16px; border-radius: var(--radius-md); outline: 1.5px solid var(--text-secondary); outline-offset: -1.5px; background: var(--surface-solid); }
  .field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
  .field > span { font-size: var(--text-meta); color: var(--text-muted); }
  textarea, input, select { box-sizing: border-box; width: 100%; font: var(--text-small) var(--font-family); line-height: 1.5; color: var(--text-primary); background: var(--surface-solid); border: 1px solid var(--tint-active); border-radius: var(--radius-field); padding: 7px 10px; }
  textarea { resize: vertical; }
  textarea:focus, input:focus, select:focus { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
  .add { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .add .meta { margin-right: 4px; }
  .meta { font-size: var(--text-meta); color: var(--text-muted); }
  .block { padding: 10px 12px 12px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: var(--text-small); }
  .head b { font-weight: var(--weight-medium); }
  .head .meta { flex: 1; }
  .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .values { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 5px 8px; border-radius: var(--radius-field); border: 1px solid var(--tint-active); background: var(--surface-solid); }
  .values input, .values select { flex: 1; width: auto; min-width: 100px; border: 0; padding: 2px 0; background: none; }
  .values input:focus, .values select:focus { outline: none; }
  .code { display: inline-flex; align-items: center; font: var(--text-meta) var(--font-mono); color: var(--text-primary); background: var(--surface-sub); padding: 2px 4px 2px 8px; border-radius: var(--radius-chip); }
  .code.gone { text-decoration: line-through; color: var(--text-muted); }
  .code button { border: 0; background: none; color: var(--text-muted); cursor: pointer; padding: 0 4px; font: inherit; }
  .foot { display: flex; align-items: center; gap: 8px; }
  .foot .meta { flex: 1; }
  @media (max-width: 900px) { .grid { grid-template-columns: minmax(0, 1fr); } }
</style>

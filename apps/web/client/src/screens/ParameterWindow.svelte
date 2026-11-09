<script lang="ts">
  import FloatingWindow from '@datahub/ui/containers/FloatingWindow.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import { dayOf, formatDay, isFunction, kindOf, KINDS, lineOf, NAME, namesOf, SUGGESTED } from '../lib/parameters.js';
  import type { Parameter, ParameterKind } from '../lib/query.js';
  import type { Missing } from './QueryParameters.svelte';

  /**
   * A Parameter made or changed in a floating window, one at a time (DEC-UX-71, DEC-UX-30): its name, its
   * kind from the standard list, and its value: a value, or an SQL function worked out at every run, with
   * what a suggested one gives today (DEC-UX-118). The list of a Choice is typed, one value a line
   * (DEC-UX-117). An @name of the SQL is defined here, its kind suggested from the column it is compared with.
   */
  let {
    queryName,
    parameter,
    defines,
    others,
    sql,
    readonly = false,
    onsave,
    onremove,
    onclose,
  }: {
    queryName: string;
    /** The Parameter to change; null for a new one. */
    parameter: Parameter | null;
    /** The @name of the SQL it defines, if it does. */
    defines: Missing | null;
    /** The other Parameters, whose names it cannot take. */
    others: readonly Parameter[];
    sql: string;
    readonly?: boolean;
    /** Saves it, in the place of the Parameter it was, by its name before, if it was one. */
    onsave: (next: Parameter, before: string | null) => void;
    onremove: (name: string) => void;
    onclose: () => void;
  } = $props();

  const SCALAR: readonly ParameterKind[] = ['date', 'number', 'decimal', 'text'];

  function initial() {
    const p = parameter;
    return {
      name: p?.name ?? defines?.name ?? '',
      kind: (p?.kind ?? defines?.suggestedKind ?? 'date') as ParameterKind,
      value: p && SCALAR.includes(p.kind) ? (p.value as string) : '',
      from: p?.kind === 'period' ? p.value : '',
      to: p?.kind === 'period' ? p.to : '',
      list: p?.kind === 'choice' || p?.kind === 'several' ? p.list.join('\n') : '',
      pick: p?.kind === 'choice' ? p.value : '',
      picks: p?.kind === 'several' ? [...p.value] : ([] as string[]),
      yes: p?.kind === 'yesno' ? p.value : false,
      /** The name it was saved under: a second save changes that one. */
      saved: p?.name ?? null,
    };
  }
  const form = $state(initial());
  /** What the last save said, for the form as it was then: a change takes it away. */
  const snapshot = $derived(JSON.stringify(form));
  let said = $state<{ at: string; problem: string | null } | null>(null);
  const problem = $derived(said && said.at === snapshot ? said.problem : null);
  const done = $derived(!!said && said.at === snapshot && said.problem === null);

  const language = $derived(currentLanguage());
  const values = $derived([...new Set(form.list.split('\n').map((line) => line.trim()).filter(Boolean))]);
  const sqlNames = (candidate: Parameter) => namesOf(candidate).map((name) => name.toLowerCase());
  const line = $derived(
    form.saved === null && defines
      ? defines.line
      : ((form.kind === 'period' ? [`${form.name}_from`, `${form.name}_to`] : [form.name]).map((name) => lineOf(sql, name)).find((found) => found !== null) ?? null),
  );

  /** What the window says about the Parameter: where it is in the SQL, or why it cannot be saved. */
  const notice = $derived.by(() => {
    if (problem) return { text: problem, warn: true };
    if (form.saved === null && defines) return { text: [t('param.state.define', { line: defines.line }), defines.suggestedKind ? t('param.state.suggested') : ''].filter(Boolean).join(' '), warn: true };
    if (form.saved === null) return { text: '', warn: false };
    return { text: line === null ? t('param.state.unused') : t('param.state.line', { line }), warn: false };
  });

  /** What a date or a function gives today, as the field says it. */
  function gives(value: string): string {
    const day = dayOf(value.trim());
    return day ? formatDay(day, language) : '…';
  }
  const hint = $derived.by(() => {
    const value = form.value.trim();
    const asks = kindOf(form.kind).hint;
    const field = asks ? t(asks) : '';
    if (form.kind === 'date' && value && isFunction('date', value)) {
      const day = dayOf(value);
      return `${day ? t('param.givesToday', { date: formatDay(day, language) }) : t('param.atEveryRun')} ${field}`;
    }
    if (SCALAR.includes(form.kind) && value && isFunction(form.kind, value)) return `${t('param.atEveryRun')} ${field}`;
    return field;
  });
  const periodHint = $derived.by(() => {
    const names = { from: `${form.name || 'name'}_from`, to: `${form.name || 'name'}_to` };
    const functions = isFunction('period', form.from.trim()) || isFunction('period', form.to.trim());
    const today = functions && form.from.trim() && form.to.trim() ? `${t('param.gives', { date: t('param.period', { from: gives(form.from), to: gives(form.to) }) })}. ` : '';
    return `${today}${t('param.hint.period', names)}`;
  });

  /** The Parameter as the form holds it, or why it cannot be one. */
  function build(): Parameter | string {
    const name = form.name.trim();
    if (!name) return t('param.giveName');
    if (!NAME.test(name)) return t('param.badName');
    const taken = new Set(others.filter((other) => other.name !== form.saved).flatMap(sqlNames));
    let next: Parameter;
    switch (form.kind) {
      case 'period':
        if (!form.from.trim() || !form.to.trim()) return t('param.giveValue');
        next = { name, kind: 'period', value: form.from.trim(), to: form.to.trim() };
        break;
      case 'choice':
        if (values.length === 0) return t('param.giveList');
        next = { name, kind: 'choice', value: values.includes(form.pick) ? form.pick : (values[0] as string), list: values };
        break;
      case 'several':
        if (values.length === 0) return t('param.giveList');
        next = { name, kind: 'several', value: values.filter((value) => form.picks.includes(value)), list: values };
        break;
      case 'yesno':
        next = { name, kind: 'yesno', value: form.yes };
        break;
      default:
        if (!form.value.trim()) return t('param.giveValue');
        next = { name, kind: form.kind, value: form.value.trim() } as Parameter;
    }
    const clash = sqlNames(next).find((sqlName) => taken.has(sqlName));
    return clash ? t('param.taken', { name: clash }) : next;
  }

  function save(): void {
    const next = build();
    if (typeof next === 'string') {
      said = { at: snapshot, problem: next };
      return;
    }
    onsave(next, form.saved);
    form.saved = next.name;
    said = { at: JSON.stringify(form), problem: null };
  }

  const title = $derived(form.saved !== null ? `@${form.saved}` : defines ? t('param.define', { name: defines.name }) : t('param.new'));
</script>

<FloatingWindow {title} meta={t('param.of', { name: queryName })} icon="sliders-horizontal" wide {onclose}>
  <div class="form">
    <div class="row">
      <label class="label" for="param-name">{t('param.name')}</label>
      <div>
        <input
          id="param-name"
          class="input"
          placeholder="dateFrom"
          spellcheck="false"
          autocomplete="off"
          disabled={readonly}
          value={form.name}
          oninput={(event) => {
            const typed = event.currentTarget.value.replace(/[^A-Za-z0-9_]/g, '');
            event.currentTarget.value = typed;
            form.name = typed;
          }}
        />
        {#if notice.text}<p class="hint" class:warn={notice.warn} role={notice.warn ? 'alert' : undefined}>{notice.text}</p>{/if}
      </div>
    </div>
    <div class="row">
      <span class="label">{t('param.kind')}</span>
      <div class="kinds" role="radiogroup" aria-label={t('param.kind')}>
        {#each KINDS as option (option.kind)}
          <button type="button" class="kind" class:on={form.kind === option.kind} role="radio" aria-checked={form.kind === option.kind} title={option.type} disabled={readonly} onclick={() => (form.kind = option.kind)}>
            <Icon name={option.icon} />{t(option.label)}
          </button>
        {/each}
      </div>
    </div>
    {#if SCALAR.includes(form.kind)}
      <div class="row">
        <label class="label" for="param-value">{t('param.value')}</label>
        <div>
          <input id="param-value" class="input mono" bind:value={form.value} list={form.kind === 'date' ? 'param-date-fns' : undefined} spellcheck="false" autocomplete="off" disabled={readonly}
            placeholder={{ date: 'DATE_TRUNC(CURRENT_DATE(), YEAR)', number: '10', decimal: '350000.50', text: '8000' }[form.kind as 'date']} />
          <p class="hint">{#if form.kind === 'date' && isFunction('date', form.value.trim()) && form.value.trim()}<Icon name="function" />{/if}{hint}</p>
        </div>
      </div>
    {:else if form.kind === 'period'}
      <div class="row">
        <span class="label">{t('param.value')}</span>
        <div class="pair">
          <label><span class="label">{t('param.from')}</span><input class="input mono" bind:value={form.from} list="param-date-fns" spellcheck="false" autocomplete="off" disabled={readonly} /></label>
          <label><span class="label">{t('param.to')}</span><input class="input mono" bind:value={form.to} list="param-date-fns" spellcheck="false" autocomplete="off" disabled={readonly} /></label>
          <p class="hint">{periodHint}</p>
        </div>
      </div>
    {:else if form.kind === 'choice' || form.kind === 'several'}
      <div class="row">
        <label class="label" for="param-list">{t('param.list')}</label>
        <div>
          <textarea id="param-list" class="input mono" rows="3" bind:value={form.list} spellcheck="false" disabled={readonly}></textarea>
          <p class="hint">{t('param.list.hint')}</p>
        </div>
      </div>
      <div class="row">
        <span class="label">{t('param.value')}</span>
        {#if form.kind === 'choice'}
          <select class="input" bind:value={form.pick} aria-label={t('param.value')} disabled={readonly || values.length === 0}>
            {#each values as value (value)}<option {value}>{value}</option>{/each}
          </select>
        {:else}
          <span class="picks">
            {#each values as value (value)}
              <button type="button" class="pick" class:on={form.picks.includes(value)} aria-pressed={form.picks.includes(value)} disabled={readonly}
                onclick={() => (form.picks = form.picks.includes(value) ? form.picks.filter((other) => other !== value) : [...form.picks, value])}>{value}</button>
            {/each}
          </span>
        {/if}
      </div>
    {:else}
      <div class="row">
        <label class="label" for="param-yes">{t('param.value')}</label>
        <select id="param-yes" class="input" value={form.yes ? 'yes' : 'no'} disabled={readonly} onchange={(event) => (form.yes = event.currentTarget.value === 'yes')}>
          <option value="yes">{t('param.yes')}</option>
          <option value="no">{t('param.no')}</option>
        </select>
      </div>
    {/if}
  </div>
  <datalist id="param-date-fns">
    {#each SUGGESTED as suggested (suggested.key)}<option value={suggested.sql}>{t(suggested.label)}</option>{/each}
  </datalist>

  {#snippet foot()}
    {#if !readonly}
      {#if form.saved !== null}
        <button type="button" class="remove" onclick={() => onremove(form.saved as string)}><Icon name="trash" /><span>{t('param.remove')}</span></button>
      {/if}
      {#if done}<span class="hint saved" role="status"><Icon name="check" /> {t('param.saved')}</span>{/if}
      <span class="grow"></span>
      <Button variant="primary" onclick={save}>{t(form.saved !== null ? 'param.save' : 'param.addIt')}</Button>
    {/if}
  {/snippet}
</FloatingWindow>

<style>
  .form { display: flex; flex-direction: column; gap: 12px; padding: 12px 3px 3px 0; min-width: 0; }
  .row { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 10px; align-items: start; }
  .label { font-size: var(--text-meta); color: var(--text-muted); }
  .row > .label { padding-top: 7px; }
  .hint { margin: 5px 0 0; font-size: var(--text-meta); line-height: 1.45; color: var(--text-muted); }
  .hint :global(.icon) { vertical-align: -1px; margin-right: 3px; }
  .hint.warn { color: var(--signal-warn); }
  .input { width: 100%; box-sizing: border-box; font: var(--text-small) var(--font-family); color: var(--text-primary); background: var(--surface-sub); border: 0; border-radius: var(--radius-field); padding: 7px 9px; }
  .input.mono { font-family: var(--font-mono); }
  .input:focus-visible { outline: 2px solid var(--text-secondary); outline-offset: 0; }
  textarea.input { resize: vertical; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .pair label { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .pair .hint { grid-column: 1 / -1; margin: 0; }
  .kinds { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; }
  .kind { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 7px; padding: 5px 9px; border-radius: var(--radius-field); cursor: pointer; font-size: var(--text-small); }
  .kind:hover { background: var(--tint-hover); }
  .kind:focus-visible { outline: 2px solid var(--text-secondary); }
  .kind.on { background: var(--surface-sub); outline: 1.5px solid var(--text-muted); font-weight: var(--weight-medium); }
  .kind :global(.icon) { font-size: 15px; color: var(--text-secondary); }
  .kind:disabled { cursor: default; }
  .picks { display: flex; flex-wrap: wrap; gap: 6px; }
  .pick { display: inline-flex; align-items: center; font: var(--text-meta) var(--font-family); padding: 3px 9px; border: 0; border-radius: var(--radius-pill); color: var(--text-muted);
    background: none; outline: 1px dashed var(--tint-active); cursor: pointer; }
  .pick.on { color: var(--text-primary); background: var(--surface-sub); outline: 1px solid var(--tint-active); }
  .remove { all: unset; display: inline-flex; align-items: center; gap: 5px; font-size: var(--text-small); color: var(--text-secondary); cursor: pointer; }
  .remove:hover { color: var(--signal-urgent); }
  .remove:focus-visible { outline: 2px solid var(--text-secondary); }
  .saved { margin: 0; display: inline-flex; align-items: center; gap: 4px; }
  .grow { flex: 1; }
</style>

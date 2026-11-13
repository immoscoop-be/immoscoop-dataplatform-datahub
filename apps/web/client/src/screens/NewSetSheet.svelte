<script lang="ts">
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { day } from '@datahub/ui/foundations/when.js';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Field from '@datahub/ui/primitives/Field.svelte';
  import type { Collection } from '../lib/catalogue.js';
  import type { LensSuggestions, NewQuery, Parameter, Query } from '../lib/query.js';

  /**
   * Another set of Resources is a new query, made in a sheet (DEC-UX-73): to add, a search over the
   * Resources the User may see; to remove, a warning when the SQL still reads it. Then the new set, its
   * name suggested from its Resources and the date (DEC-UX-21), the question carried along, and the Lenses
   * on the new set, which can be a very different list (DEC-UX-114). "Start the new query" takes the SQL and
   * its Parameters along; the old query stays as it was, with its history. Resources are ticked one or more at once,
   * up to ten in all, and each comes as a CTE at the start of the SQL, shown before (DEC-UX-225, FR-SR-59).
   */
  let {
    query,
    sql,
    parameters,
    collections,
    mode,
    resource,
    onclose,
    onstart,
    lensesOn,
    ctesOf,
  }: {
    query: Query;
    /** The SQL and Parameters as they are now, which the new query takes along. */
    sql: string;
    parameters: readonly Parameter[];
    collections: readonly Collection[] | undefined;
    mode: 'add' | 'remove';
    /** The Resource to add, chosen already, or the one to remove. */
    resource: string | null;
    onclose: () => void;
    onstart: (fields: NewQuery) => Promise<boolean>;
    /** The Lenses on a set of Resources, by the words of the question (FR-SR-47). */
    lensesOn: (resources: readonly string[], question: string) => Promise<LensSuggestions>;
    /** The SQL with a CTE at its start for each Resource added, and those CTEs (FR-SR-59). */
    ctesOf: (sql: string, resources: readonly string[]) => Promise<{ sql: string; ctes: string[] }>;
  } = $props();

  /** A query reads 1 to 10 Resources (FR-SR-45). */
  const MOST = 10;

  const current = $derived(query.resources.map((entry) => entry.id));
  /** Every Resource the User sees that the query does not read yet, with its Collection. */
  const choices = $derived(
    (collections ?? []).flatMap((collection) =>
      collection.resources.filter((item) => !item.withdrawn && !current.includes(item.id)).map((item) => ({ ...item, collection: collection.name })),
    ),
  );
  const initialPicks = () => (mode === 'add' && resource ? [resource] : []);
  let picks = $state<string[]>(initialPicks());
  let search = $state('');
  let named = $state(false);
  let name = $state('');
  const initialQuestion = () => query.question;
  let question = $state(initialQuestion());
  let busy = $state(false);
  let failed = $state(false);

  const found = $derived(
    choices.filter((choice) => picks.includes(choice.id) || !search.trim() || `${choice.displayName} ${choice.collection}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 12),
  );
  const set = $derived(mode === 'remove' ? current.filter((id) => id !== resource) : [...current, ...picks]);
  const full = $derived(current.length + picks.length >= MOST);
  function toggle(id: string, on: boolean): void {
    picks = on ? [...picks, id] : picks.filter((picked) => picked !== id);
  }

  /** A Resource the SQL already names, such as one picked among the suggestions, needs no CTE of its own. */
  const inSql = (id: string) => {
    const key = choices.find((choice) => choice.id === id)?.key ?? '';
    const text = sql.toLowerCase();
    return key !== '' && (text.includes(key) || text.includes(key.split('.').slice(1).join('.')));
  };
  // The CTEs that come at the start of the SQL, once the ticks pause (DEC-UX-225).
  let added = $state<{ sql: string; ctes: string[] } | null>(null);
  let adding = 0;
  $effect(() => {
    const ids = picks.filter((id) => !inSql(id));
    const asked = ++adding;
    added = null;
    if (mode !== 'add' || ids.length === 0) return;
    const timer = setTimeout(() => {
      ctesOf(sql, ids).then(
        (found) => asked === adding && (added = found),
        (error: unknown) => console.error('The CTEs of the Resources added could not be written', error),
      );
    }, 250);
    return () => clearTimeout(timer);
  });
  const nameOf = (id: string) => query.resources.find((entry) => entry.id === id)?.displayName ?? choices.find((choice) => choice.id === id)?.displayName ?? '';
  const removed = $derived(mode === 'remove' ? query.resources.find((entry) => entry.id === resource) : undefined);
  /** The table of the removed Resource, if the SQL still names it: in the new query, an error. */
  const stillRead = $derived.by(() => {
    if (!removed?.visible) return null;
    // The Key is in lower case; the SQL names the table in its own case.
    const text = sql.toLowerCase();
    const short = removed.key.split('.').slice(1).join('.');
    return text.includes(removed.key) || text.includes(short) ? (removed.key.split('.').at(-1) ?? removed.key) : null;
  });

  const suggested = $derived.by(() => {
    const names = set.map(nameOf).filter(Boolean);
    if (names.length === 0) return '';
    const list = names.length === 1 ? (names[0] as string) : `${names.slice(0, -1).join(', ')} ${t('query.and')} ${names.at(-1)}`;
    return t('query.name.suggested', { names: list, date: day(new Date(), currentLanguage()) });
  });
  $effect(() => {
    if (!named) name = suggested;
  });

  // The Lenses on the new set, once typing the question pauses.
  let lenses = $state<LensSuggestions | undefined>();
  let asking = 0;
  $effect(() => {
    const on = [...set];
    const words = question.trim();
    const asked = ++asking;
    if (on.length === 0) return;
    const timer = setTimeout(() => {
      lensesOn(on, words).then(
        (found) => asked === asking && (lenses = found),
        (error: unknown) => console.error('The Lenses on the new set could not be read', error),
      );
    }, 400);
    return () => clearTimeout(timer);
  });
  const lensLine = $derived.by(() => {
    if (!lenses) return null;
    const [exact, more] = [lenses.exact.length, lenses.more.length];
    if (exact + more === 0) return t('query.lenses.none');
    const first = exact ? t('newSet.lenses.exact', { count: exact }) : t('newSet.lenses.noneExact');
    return more ? `${first}${t('newSet.lenses.more', { count: more })}` : `${first}.`;
  });

  async function start(): Promise<void> {
    busy = true;
    try {
      const ids = mode === 'add' ? picks.filter((id) => !inSql(id)) : [];
      const withThem = ids.length === 0 ? sql : (added?.sql ?? (await ctesOf(sql, ids)).sql);
      failed = !(await onstart({ name: name.trim(), question: question.trim(), resources: set, sql: withThem, parameters, startedFrom: query.id }));
    } catch (error) {
      console.error('The new query could not be started', error);
      failed = true;
    }
    busy = false;
  }
</script>

<Sheet title={mode === 'add' ? t('newSet.addMany', { count: Math.max(1, picks.length) }) : t('newSet.removeTitle', { name: removed?.displayName ?? '' })} {onclose}>
  {#snippet top()}<div class="meta from"><Icon name="git-branch" />{t('newSet.from', { name: query.name })}</div>{/snippet}
  <div class="body">
    <p class="why">{t(mode === 'add' ? 'newSet.why.add' : 'newSet.why.remove', { name: query.name })}</p>
    {#if mode === 'add'}
      <div class="label">{t('newSet.add')}</div>
      <input {...NO_PASSWORD_MANAGER} type="search" class="search" bind:value={search} placeholder={t('query.resources.search')} aria-label={t('query.resources.search')} />
      <p class="meta tick">{t('newSet.tickMany')}</p>
      <div class="picks" role="group" aria-label={t('newSet.add')}>
        {#each found as choice (choice.id)}
          {@const on = picks.includes(choice.id)}
          <label class="pick" class:on>
            <input type="checkbox" value={choice.id} checked={on} disabled={!on && full} onchange={(event) => toggle(choice.id, event.currentTarget.checked)} />
            <span class="what"><span class="name">{choice.displayName}</span><span class="meta">{choice.collection}</span></span>
            <MaturityIcon level={choice.level} small />
          </label>
        {:else}
          <p class="meta">{t('query.resources.none')}</p>
        {/each}
      </div>
    {:else if stillRead}
      <p class="note"><Icon name="warning" /><span>{t('newSet.stillReads', { table: stillRead })}</span></p>
    {/if}

    {#if mode === 'add'}
      <div class="label set-label">{t('newSet.ctes')}</div>
      <pre class="ctes">{added ? added.ctes.join(',\n\n') : picks.some((id) => !inSql(id)) ? '…' : t('newSet.ctes.none')}</pre>
    {/if}

    <div class="label set-label">{t('newSet.set')}</div>
    <div class="set">
      {#each [...new Set([...current, ...set])] as id (id)}
        <span class="chip" class:removed={!set.includes(id)}><KindIcon kind="resource" />{current.includes(id) ? '' : '+ '}{nameOf(id)}</span>
      {/each}
    </div>

    <div class="fields">
      <Field label={t('query.name')} hint={named ? undefined : t('query.name.hint')}>
        <input {...NO_PASSWORD_MANAGER} type="text" bind:value={() => name, (value) => ((name = value), (named = true))} maxlength="120" required />
      </Field>
      <Field label={t('query.question')}>
        <textarea {...NO_PASSWORD_MANAGER} bind:value={question} rows="2" maxlength="500"></textarea>
      </Field>
    </div>
    {#if lensLine}
      <div class="lenses">
        <Icon name="aperture" />
        <div>
          <span>{lensLine}</span>
          {#if lenses && lenses.exact.length + lenses.more.length}
            <ul>{#each [...lenses.exact, ...lenses.more].slice(0, 5) as lens (lens.id)}<li>{lens.name}</li>{/each}</ul>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  {#snippet foot()}
    {#if failed}<p class="failed" role="alert">{t('newSet.failed')}</p>{/if}
    <span class="meta stays">{t('newSet.stays', { name: query.name })}</span>
    <Button variant="quiet" onclick={onclose}>{t('newSet.cancel')}</Button>
    <Button disabled={busy || !name.trim() || set.length === 0 || (mode === 'add' && picks.length === 0)} onclick={start}><Icon name="git-branch" />{t('newSet.start')}</Button>
  {/snippet}
</Sheet>

<style>
  .from { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .body { flex: 1; min-height: 0; overflow: auto; padding: 0 2px; }
  .why { font-size: var(--text-small); line-height: 1.55; color: var(--text-secondary); margin: 10px 0 14px; }
  .label { margin: 0 0 6px; }
  .set-label { margin-top: 14px; }
  .search { width: 100%; box-sizing: border-box; font: var(--text-small) var(--font-family); color: var(--text-primary); background: var(--surface-sub); border: 0; border-radius: var(--radius-field); padding: 8px 10px; margin-bottom: 6px; }
  .search:focus-visible { outline: 2px solid var(--text-secondary); }
  .picks { display: grid; gap: 2px; }
  .tick { margin: 0 0 6px; }
  .ctes { margin: 0; padding: 10px 12px; border-radius: var(--radius-md); background: var(--surface-sub); font: 12px/1.6 var(--font-mono); color: var(--text-secondary); white-space: pre; overflow: auto; max-height: 180px; }
  .pick { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: var(--radius-md); cursor: pointer; }
  .pick:hover { background: var(--tint-hover); }
  .pick.on { background: var(--surface-sub); outline: 1.5px solid var(--text-muted); }
  .pick input { accent-color: var(--text-primary); }
  .what { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .name { font-size: var(--text-small); }
  .note { display: flex; gap: 8px; align-items: flex-start; margin: 0; padding: 10px 12px; border-radius: var(--radius-md); background: color-mix(in srgb, var(--signal-warn) 13%, var(--surface-solid));
    font-size: var(--text-small); line-height: 1.5; }
  .note :global(.icon) { color: var(--signal-warn); font-size: 16px; margin-top: 2px; }
  .set { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { display: inline-flex; align-items: center; gap: 5px; font-size: var(--text-meta); padding: 3px 9px; border-radius: var(--radius-pill); color: var(--text-primary); background: var(--surface-sub); }
  .chip.removed { text-decoration: line-through; color: var(--text-muted); background: none; outline: 1px dashed var(--tint-active); }
  .fields { display: grid; gap: 12px; margin-top: 14px; }
  .fields input, .fields textarea { width: 100%; box-sizing: border-box; font: var(--text-small) var(--font-family); line-height: 1.5; color: var(--text-primary);
    background: var(--surface-solid); border: 1px solid var(--tint-active); border-radius: var(--radius-field); padding: 8px 10px; }
  .fields textarea { resize: vertical; }
  .lenses { display: flex; gap: 10px; align-items: flex-start; margin: 14px 0 4px; padding: 12px; border-radius: var(--radius-md); background: var(--surface-sub); font-size: var(--text-small); line-height: 1.5; }
  .lenses :global(.icon) { font-size: 16px; color: var(--text-secondary); margin-top: 2px; }
  .lenses ul { margin: 6px 0 0; padding-left: 18px; color: var(--text-secondary); }
  .stays { flex: 1; }
  .failed { flex: 1 1 100%; margin: 0; font-size: var(--text-small); color: var(--signal-urgent); }
</style>

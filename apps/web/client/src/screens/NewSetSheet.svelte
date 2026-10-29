<script lang="ts">
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { day } from '@datahub/ui/foundations/when.js';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Field from '@datahub/ui/primitives/Field.svelte';
  import type { Collection } from '../lib/catalogue.js';
  import type { NewQuery, Parameter, Query } from '../lib/query.js';

  /**
   * Another set of Resources is a new query, made in a sheet (DEC-UX-73): to add, a search over the
   * Resources the User may see; to remove, a warning when the SQL still reads it. Then the new set, its
   * name suggested from its Resources and the date (DEC-UX-21), the question carried along, and the Lenses
   * on the new set; until there are Lenses, none does (DEC-UX-114). "Start the new query" takes the SQL and
   * its Parameters along; the old query stays as it was, with its history.
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
  } = $props();

  const current = $derived(query.resources.map((entry) => entry.id));
  /** Every Resource the User sees that the query does not read yet, with its Collection. */
  const choices = $derived(
    (collections ?? []).flatMap((collection) =>
      collection.resources.filter((item) => !item.withdrawn && !current.includes(item.id)).map((item) => ({ ...item, collection: collection.name })),
    ),
  );
  const initialPick = () => (mode === 'add' ? resource : null);
  let pick = $state<string | null>(initialPick());
  let search = $state('');
  let named = $state(false);
  let name = $state('');
  const initialQuestion = () => query.question;
  let question = $state(initialQuestion());
  let busy = $state(false);
  let failed = $state(false);

  const found = $derived(
    choices.filter((choice) => choice.id === pick || !search.trim() || `${choice.displayName} ${choice.collection}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 12),
  );
  const set = $derived(mode === 'remove' ? current.filter((id) => id !== resource) : pick ? [...current, pick] : current);
  const nameOf = (id: string) => query.resources.find((entry) => entry.id === id)?.displayName ?? choices.find((choice) => choice.id === id)?.displayName ?? '';
  const removed = $derived(mode === 'remove' ? query.resources.find((entry) => entry.id === resource) : undefined);
  /** The table of the removed Resource, if the SQL still names it: in the new query, an error. */
  const stillRead = $derived.by(() => {
    if (!removed?.visible) return null;
    const short = removed.key.split('.').slice(1).join('.');
    return sql.includes(removed.key) || sql.includes(short) ? (removed.key.split('.').at(-1) ?? removed.key) : null;
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

  async function start(): Promise<void> {
    busy = true;
    failed = !(await onstart({ name: name.trim(), question: question.trim(), resources: set, sql, parameters, startedFrom: query.id }));
    busy = false;
  }
</script>

<Sheet title={mode === 'add' ? t('newSet.addTitle') : t('newSet.removeTitle', { name: removed?.displayName ?? '' })} {onclose}>
  {#snippet top()}<div class="meta from"><Icon name="git-branch" />{t('newSet.from', { name: query.name })}</div>{/snippet}
  <div class="body">
    <p class="why">{t(mode === 'add' ? 'newSet.why.add' : 'newSet.why.remove', { name: query.name })}</p>
    {#if mode === 'add'}
      <div class="label">{t('newSet.add')}</div>
      <input type="search" class="search" bind:value={search} placeholder={t('query.resources.search')} aria-label={t('query.resources.search')} />
      <div class="picks" role="radiogroup" aria-label={t('newSet.add')}>
        {#each found as choice (choice.id)}
          <label class="pick" class:on={pick === choice.id}>
            <input type="radio" name="new-set-pick" value={choice.id} bind:group={pick} />
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

    <div class="label set-label">{t('newSet.set')}</div>
    <div class="set">
      {#each [...new Set([...current, ...set])] as id (id)}
        <span class="chip" class:removed={!set.includes(id)}><KindIcon kind="resource" />{current.includes(id) ? '' : '+ '}{nameOf(id)}</span>
      {/each}
    </div>

    <div class="fields">
      <Field label={t('query.name')} hint={named ? undefined : t('query.name.hint')}>
        <input type="text" bind:value={() => name, (value) => ((name = value), (named = true))} maxlength="120" required />
      </Field>
      <Field label={t('query.question')}>
        <textarea bind:value={question} rows="2" maxlength="500"></textarea>
      </Field>
    </div>
    <p class="lenses"><Icon name="info" /><span>{t('query.lenses.none')}</span></p>
  </div>

  {#snippet foot()}
    {#if failed}<p class="failed" role="alert">{t('newSet.failed')}</p>{/if}
    <span class="meta stays">{t('newSet.stays', { name: query.name })}</span>
    <Button variant="quiet" onclick={onclose}>{t('newSet.cancel')}</Button>
    <Button disabled={busy || !name.trim() || set.length === 0 || (mode === 'add' && !pick)} onclick={start}><Icon name="git-branch" />{t('newSet.start')}</Button>
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
  .stays { flex: 1; }
  .failed { flex: 1 1 100%; margin: 0; font-size: var(--text-small); color: var(--signal-urgent); }
</style>

<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { day } from '@datahub/ui/foundations/when.js';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Field from '@datahub/ui/primitives/Field.svelte';
  import type { Catalogue, Collection, ResourceDetail } from '../lib/catalogue.js';

  /**
   * A new query (query-new, DEC-UX-22), in two halves. Left, the query: its name, required and suggested
   * from its Resources and the date until it is changed (FR-SR-45, DEC-UX-21); its question; and its
   * Resources, each with its Collection, its partition column and its Level, to remove or add. Right, the
   * Lenses that already use these Resources (FR-SR-47); until there are Lenses, it says none does
   * (DEC-UX-114). "Start your own" makes the query, with SQL that filters on the partition column.
   */
  let {
    initial,
    collections,
    catalogue,
    ondraft,
    onstart,
  }: {
    /** The Resource it starts on, from "Query" on its page (FR-SR-46). */
    initial: string | null;
    collections: readonly Collection[] | undefined;
    catalogue: Pick<Catalogue, 'resource'>;
    /** The name as it is now, for the panel, where the new query stands as not run yet. */
    ondraft: (name: string) => void;
    onstart: (fields: { name: string; question: string; resources: string[] }) => Promise<boolean>;
  } = $props();

  let chosen = $state<string[]>([]);
  let details = $state<Record<string, ResourceDetail>>({});
  let name = $state('');
  let named = $state(false);
  let question = $state('');
  let picking = $state(false);
  let search = $state('');
  let busy = $state(false);
  let failed = $state(false);

  $effect(() => {
    if (initial && chosen.length === 0) add(initial);
  });

  /** Every Resource the User sees, with its Collection, to choose from. */
  const choices = $derived(
    (collections ?? []).flatMap((collection) => collection.resources.map((resource) => ({ ...resource, collection: collection.name, collectionId: collection.id }))),
  );
  const nameOf = (id: string) => details[id]?.displayName ?? choices.find((choice) => choice.id === id)?.displayName ?? '';
  const collectionOf = (id: string) => choices.find((choice) => choice.id === id)?.collection ?? collections?.find((collection) => collection.id === details[id]?.collectionId)?.name ?? '';

  /** The name a query gets from its Resources and the date (DEC-UX-21): changed by hand, it stays. */
  const suggested = $derived.by(() => {
    const names = chosen.map(nameOf).filter(Boolean);
    if (names.length === 0) return '';
    const list = names.length === 1 ? (names[0] as string) : `${names.slice(0, -1).join(', ')} ${t('query.and')} ${names.at(-1)}`;
    return t('query.name.suggested', { names: list, date: day(new Date(), currentLanguage()) });
  });
  $effect(() => {
    if (!named) name = suggested;
  });
  $effect(() => ondraft(name));

  function add(id: string): void {
    if (!chosen.includes(id)) chosen = [...chosen, id];
    picking = false;
    search = '';
    if (!details[id]) {
      catalogue.resource(id).then(
        (resource) => (details = { ...details, [id]: resource }),
        () => undefined,
      );
    }
  }

  const found = $derived(
    choices.filter((choice) => !chosen.includes(choice.id) && (!search.trim() || `${choice.displayName} ${choice.collection}`.toLowerCase().includes(search.trim().toLowerCase()))).slice(0, 12),
  );

  async function start(): Promise<void> {
    busy = true;
    failed = !(await onstart({ name: name.trim(), question: question.trim(), resources: chosen }));
    busy = false;
  }
</script>

<header class="head">
  <div class="meta">Query</div>
  <h1 class="page-title">{t('query.new')}</h1>
</header>

<div class="halves">
  <section class="card own" aria-label={t('query.yourQuery')}>
    <h2>{t('query.yourQuery')}</h2>
    <Field label={t('query.name')} hint={named ? undefined : t('query.name.hint')}>
      <input type="text" bind:value={() => name, (value) => ((name = value), (named = true))} maxlength="120" required />
    </Field>
    <Field label={t('query.question')} hint={t('query.question.hint')}>
      <textarea bind:value={question} rows="3" maxlength="500"></textarea>
    </Field>
    <div class="label">{t('query.resources')}</div>
    <ul class="resources">
      {#each chosen as id (id)}
        {@const detail = details[id]}
        <li class="resource">
          <span class="what">
            <span class="name">{nameOf(id)}</span>
            <span class="meta"
              >{collectionOf(id)}{#if detail?.details.partition}
                · {t('query.partitionedBy', { column: detail.details.partition.field })}{/if}</span
            >
          </span>
          {#if detail}<MaturityIcon level={detail.level} />{/if}
          <button type="button" class="remove" aria-label={t('query.remove', { name: nameOf(id) })} onclick={() => (chosen = chosen.filter((other) => other !== id))}><Icon name="x" /></button>
        </li>
      {/each}
      <li>
        {#if picking}
          <div class="picker">
            <!-- svelte-ignore a11y_autofocus -->
            <input type="search" bind:value={search} placeholder={t('query.resources.search')} aria-label={t('query.resources.search')} autofocus onkeydown={(event) => event.key === 'Escape' && (picking = false)} />
            <ul class="found">
              {#each found as choice (choice.id)}
                <li><button type="button" onclick={() => add(choice.id)}><span class="name">{choice.displayName}</span><span class="meta">{choice.collection}</span><MaturityIcon level={choice.level} small /></button></li>
              {:else}
                <li class="meta none">{t('query.resources.none')}</li>
              {/each}
            </ul>
          </div>
        {:else}
          <button type="button" class="add" onclick={() => (picking = true)}><Icon name="plus" />{t('query.resources.add')}</button>
        {/if}
      </li>
    </ul>
    <p class="meta hint">{t('query.resources.hint')}</p>
  </section>

  <section class="card lenses" aria-label={t('query.lenses.title')}>
    <h2>{t('query.lenses.title')}</h2>
    <p class="meta intro">{t('query.lenses.intro')}</p>
    <p class="none">{t('query.lenses.none')}</p>
  </section>
</div>

<div class="foot">
  {#if failed}<p class="failed" role="alert">{t('query.startFailed')}</p>{/if}
  <span class="meta">{t('query.noneFits')}</span>
  <Button variant="outline" disabled={busy || !name.trim() || chosen.length === 0} onclick={start}>{t('query.startOwn')}</Button>
</div>

<style>
  .head { margin-top: 8px; }
  .halves { display: grid; grid-template-columns: minmax(300px, 380px) minmax(0, 1fr); gap: 14px; margin-top: 18px; align-items: start; }
  .card { border-radius: var(--radius-xl); padding: 18px 20px 20px; }
  h2 { font-size: var(--text-section); font-weight: var(--weight-medium); margin: 0 0 12px; }
  .own :global(.field) { margin-bottom: 14px; }
  input[type='text'], textarea, input[type='search'] { width: 100%; box-sizing: border-box; font: var(--text-small) var(--font-family); line-height: 1.5; color: var(--text-primary);
    background: var(--surface-solid); border: 1px solid var(--tint-active); border-radius: var(--radius-field); padding: 8px 10px; }
  textarea { resize: vertical; }
  input:focus, textarea:focus { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
  .resources { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; }
  .resource { display: flex; align-items: center; gap: 10px; padding: 9px 10px 9px 16px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .what { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .name { font-size: var(--text-small); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .remove { width: 24px; height: 24px; border: 0; border-radius: 50%; background: none; color: var(--text-muted); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: 12px; }
  .remove:hover { background: var(--tint-active); color: var(--text-primary); }
  .add { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 6px; width: 100%; padding: 10px 16px; border-radius: var(--radius-md); background: var(--surface-sub);
    font-size: var(--text-small); color: var(--text-muted); cursor: pointer; }
  .add:hover { color: var(--text-primary); }
  .add:focus-visible { outline: 2px solid var(--text-secondary); }
  .picker { display: grid; gap: 6px; }
  .found { list-style: none; margin: 0; padding: 4px; border-radius: var(--radius-md); background: var(--surface-solid); outline: 1px solid var(--tint-active); max-height: 260px; overflow: auto; }
  .found button { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 8px; border-radius: var(--radius-sm); cursor: pointer; }
  .found button:hover, .found button:focus-visible { background: var(--tint-hover); }
  .found .name { flex: 1; }
  .found .none { padding: 7px 8px; }
  .hint { margin: 12px 0 0; line-height: 1.5; }
  .intro { margin: -4px 0 16px; line-height: 1.5; }
  .none { margin: 0; padding: 14px 16px; border-radius: var(--radius-md); background: var(--surface-sub); font-size: var(--text-small); color: var(--text-secondary); }
  .foot { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 14px; flex-wrap: wrap; }
  .failed { flex: 1 1 100%; text-align: right; margin: 0; font-size: var(--text-small); color: var(--signal-urgent); }
  @media (max-width: 900px) { .halves { grid-template-columns: 1fr; } }
</style>

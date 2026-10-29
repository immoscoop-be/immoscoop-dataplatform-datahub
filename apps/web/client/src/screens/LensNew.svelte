<script lang="ts">
  import IconPicker from '@datahub/ui/components/IconPicker.svelte';
  import Callout from '@datahub/ui/containers/Callout.svelte';
  import { formatBytes } from '@datahub/ui/foundations/bytes.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { levelName } from '@datahub/ui/foundations/levels.js';
  import { currentLanguage, t, tParts } from '@datahub/ui/foundations/texts.svelte.js';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Field from '@datahub/ui/primitives/Field.svelte';
  import Gauge from '@datahub/ui/primitives/Gauge.svelte';
  import type { Catalogue, Collection } from '../lib/catalogue.js';
  import type { Group } from '../lib/identity.js';
  import { clock, when } from '../lib/moment.js';
  import { describe, isFunction, kindOf, suggestedOf } from '../lib/parameters.js';
  import type { Lens, LensParameter, Parameter, Preflight, Query, QueryClient, QueryRequest, Storage } from '../lib/query.js';
  import { lensPath, queryPath } from '../lib/routes.js';

  /**
   * Make it a lens (lens-new, DEC-UX-25): from a query of its author, still in Query. Left, the Lens: its
   * name and question from the query, what it shows, what it does step by step (DEC-UX-121), its tags, its
   * Parameters from the query, each with the name Users see (DEC-UX-75), the Collection it goes into, one
   * its author owns, or a new private one in the same step (DEC-UX-111), and its Resources with its Level.
   * Right, the size check: what one run reads, measured now, in three ranges (FR-LE-08): within range it
   * is published, large its author publishes it anyway, very large it goes to the Data Team (FR-LE-09).
   * A Lens that waits for the Data Team opens here as its author made it, frozen (lens-new-context, DEC-LE-05).
   */
  let {
    queryId,
    lens,
    client,
    catalogue,
    collections,
    me,
    dataTeam,
    loadGroups,
    onmade,
  }: {
    /** The query it is made from. */
    queryId?: string;
    /** A Lens that waits for the Data Team, shown as it was made. */
    lens?: Lens;
    client: QueryClient;
    catalogue: Pick<Catalogue, 'createCollection'>;
    collections: readonly Collection[] | undefined;
    me: { name: string; groups: readonly string[] };
    dataTeam: boolean;
    /** The groups of the User, to own a new Collection (DEC-CO-24). */
    loadGroups: () => Promise<Group[]>;
    onmade: (lens: Lens) => void;
  } = $props();

  let query = $state<Query | null | undefined>();
  let preflight = $state<Preflight | null>(null);
  let storage = $state<Record<string, Storage | null>>({});
  let name = $state('');
  let question = $state('');
  let shows = $state('');
  let steps = $state('');
  let tags = $state<string[]>([]);
  let tag = $state('');
  let labels = $state<Record<string, string>>({});
  let collectionId = $state('');
  let making = $state(false);
  let newName = $state('');
  let newOwner = $state('');
  let newIcon = $state<string | null>('lightbulb');
  let groups = $state<Group[] | null | undefined>();
  let text = $state('');
  let busy = $state(false);
  let failed = $state<string | null>(null);
  let resent = $state<QueryRequest | null>(null);

  const language = $derived(currentLanguage());
  const bytes = (value: number) => formatBytes(value, language);
  const frozen = $derived(lens !== undefined);
  const owned = $derived(
    (collections ?? [])
      .filter((collection) => collection.canManage && (dataTeam || me.groups.includes(collection.ownerUnit.id)))
      .toSorted((a, b) => Number(me.groups.includes(b.ownerUnit.id)) - Number(me.groups.includes(a.ownerUnit.id))),
  );
  /** A label as people read a name: dateFrom becomes "Date from". */
  const labelOf = (sqlName: string) => {
    const words = sqlName.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim().toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
  };

  // The query, measured now, with what each of its Resources holds (FR-LE-08).
  let loaded: string | undefined;
  $effect(() => {
    if (!queryId || loaded === queryId) return;
    const id = queryId;
    loaded = id;
    client.get(id).then(
      async (found) => {
        query = found;
        name = found.name;
        question = found.question;
        const checked = await client.preflight(id, found.sql, found.parameters).catch(() => null);
        preflight = checked;
        labels = Object.fromEntries(found.parameters.filter((parameter) => !checked?.unused.includes(parameter.name)).map((parameter) => [parameter.name, labelOf(parameter.name)]));
        for (const resource of found.resources) {
          if (resource.visible) client.storage(resource.id).then((facts) => (storage = { ...storage, [resource.id]: facts }), () => undefined);
        }
      },
      () => (query = null),
    );
  });
  $effect(() => {
    if (!collectionId && owned[0]) collectionId = owned[0].id;
  });
  $effect(() => {
    if (!frozen && collections && owned.length === 0) making = true;
  });
  // The groups to own a new Collection, read when it is made here (DEC-CO-24).
  $effect(() => {
    if (making && groups === undefined) {
      loadGroups().then(
        (found) => {
          groups = found;
          newOwner = found[0]?.id ?? '';
        },
        () => (groups = null),
      );
    }
  });
  $effect(() => {
    if (making && !newName) newName = t('lens.newCollection.name', { name: me.name.split(' ')[0] ?? me.name });
  });

  /** Its Parameters: the frozen Lens's, or those of the query its SQL uses (DEC-LE-01). */
  const parameters: LensParameter[] = $derived(
    lens ? lens.parameters : (query?.parameters ?? []).filter((parameter) => !preflight?.unused.includes(parameter.name)).map((parameter) => ({ ...parameter, label: labels[parameter.name] ?? parameter.name })),
  );
  /** What its Resources are, with their Collection and Level. */
  const resources = $derived(
    lens
      ? lens.resources.map((resource) => ({ id: resource.id, displayName: resource.displayName, level: resource.level, collection: collections?.find((one) => one.id === resource.collectionId)?.name ?? '' }))
      : (query?.resources ?? []).map((resource) =>
          resource.visible
            ? { id: resource.id, displayName: resource.displayName, level: resource.level, collection: collections?.find((one) => one.id === resource.collectionId)?.name ?? '' }
            : { id: resource.id, displayName: resource.displayName, level: 0, collection: '' },
        ),
  );
  const level = $derived(resources.length ? Math.min(...resources.map((resource) => resource.level)) : 0);
  const reads = $derived(lens ? lens.reads : (preflight?.bytes ?? null));
  const range = $derived(lens ? lens.range : (preflight?.range ?? null));
  const thresholds = $derived(preflight?.thresholds ?? { approve: 100_000_000, request: 1_000_000_000 });
  const partitioned = $derived((query?.resources ?? []).filter((resource) => resource.visible && resource.partition));
  const warning = $derived(preflight?.warnings.find((one) => one.bytesWithFilter !== null) ?? null);

  /** What a Parameter takes by default: a suggested function by its name, any other value as written. */
  function defaultOf(parameter: Parameter): { value: string; fn: boolean } {
    const raw = parameter.kind === 'period' ? parameter.value : parameter.kind === 'several' ? parameter.value.join(', ') : String(parameter.value);
    const fn = (parameter.kind === 'date' || parameter.kind === 'period' || parameter.kind === 'number' || parameter.kind === 'decimal' || parameter.kind === 'text') && isFunction(parameter.kind, raw);
    const suggested = fn ? suggestedOf(raw) : null;
    return { value: suggested ? t(suggested.label) : describe(parameter, language).value, fn };
  }

  function addTag(): void {
    const word = tag.trim().replace(/^#/, '').toLowerCase();
    if (word && !tags.includes(word) && tags.length < 10) tags = [...tags, word];
    tag = '';
  }

  const since = (at: string) => (new Date(at).toDateString() === new Date().toDateString() ? clock(at, language) : when(at, language));

  async function make(approve: boolean): Promise<void> {
    if (!query) return;
    busy = true;
    failed = null;
    try {
      let into = collectionId;
      if (making) {
        const made = await catalogue.createCollection({
          name: newName.trim(),
          description: t('lens.newCollection.description', { lens: name.trim() }),
          icon: newIcon ?? 'lightbulb',
          ownerUnit: newOwner,
          visibility: 'private',
        });
        into = made.id;
        // A second try goes into the Collection just made.
        making = false;
        collectionId = made.id;
      }
      const outcome = await client.makeLens({
        queryId: query.id,
        collectionId: into,
        name: name.trim(),
        question: question.trim(),
        shows: shows.trim(),
        steps: steps.split('\n').map((step) => step.trim()).filter(Boolean),
        tags,
        labels,
        approve,
        text: text.trim(),
      });
      if (outcome.kind === 'refused') preflight = outcome.preflight;
      else onmade(outcome.lens);
    } catch (error) {
      console.error('The Lens could not be made', error);
      failed = t('lens.make.failed');
    } finally {
      busy = false;
    }
  }

  async function sendAgain(): Promise<void> {
    if (!lens) return;
    busy = true;
    resent = await client.lensRequest(lens.id, text.trim()).catch(() => null);
    busy = false;
  }

  const request = $derived(resent ?? lens?.request ?? null);
  const ready = $derived(!busy && name.trim().length > 0 && (making ? newName.trim().length > 0 && newOwner !== '' : collectionId !== ''));
</script>

{#if query === null}
  <p class="meta">{t('lens.make.failed')}</p>
{:else if lens || query}
  {@const fromName = lens?.fromQuery?.name ?? query?.name ?? ''}
  {@const fromId = lens?.fromQuery?.id ?? query?.id}
  <div class="crumb meta">{#if fromId}<a href={queryPath(fromId)}>Query</a>{:else}Query{/if} · {fromName}</div>
  <header class="head">
    <h1 class="page-title">{lens ? lens.name : t('lens.make.title')}</h1>
    {#if !frozen && fromId}<Button variant="quiet" href={queryPath(fromId)}>{t('collection.cancel')}</Button>{/if}
  </header>
  {#if !frozen}
    <p class="from">{#each tParts('lens.make.from', {}, { name: fromName }) as part, index (index)}{#if 'name' in part}<b>{part.name}</b>{:else}{part.text}{/if}{/each}</p>
  {/if}
  {#if query?.lens}
    <Callout icon="info-fill">{t('lens.make.already')} <a href={lensPath(query.lens.id)}>{query.lens.name}</a></Callout>
  {/if}

  <div class="halves">
    <section class="card lens" aria-labelledby="the-lens">
      <h2 id="the-lens">{t('lens.make.lens')}</h2>
      <fieldset disabled={frozen}>
        <Field label={t('lens.field.name')}><input type="text" value={lens?.name ?? name} oninput={(event) => (name = event.currentTarget.value)} maxlength="120" required /></Field>
        <Field label={t('lens.field.question')} hint={t('lens.field.question.hint')}><input type="text" value={lens?.question ?? question} oninput={(event) => (question = event.currentTarget.value)} maxlength="500" /></Field>
        <Field label={t('lens.field.shows')}><textarea rows="2" maxlength="500" value={lens?.shows ?? shows} oninput={(event) => (shows = event.currentTarget.value)}></textarea></Field>
        <Field label={t('lens.field.steps')} hint={t('lens.field.steps.hint')}>
          <textarea rows="3" value={lens ? lens.steps.join('\n') : steps} oninput={(event) => (steps = event.currentTarget.value)}></textarea>
        </Field>
        <Field label={t('lens.field.tags')} group>
          <div class="tags">
            {#each lens?.tags ?? tags as word (word)}
              <span class="tag">#{word}{#if !frozen}<button type="button" aria-label={t('lens.field.tag.remove', { tag: word })} onclick={() => (tags = tags.filter((other) => other !== word))}><Icon name="x" /></button>{/if}</span>
            {/each}
            {#if !frozen}
              <input
                class="new-tag"
                type="text"
                placeholder="+ Tag"
                aria-label={t('lens.field.tag.add')}
                maxlength="30"
                bind:value={tag}
                onkeydown={(event) => {
                  if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
                    event.preventDefault();
                    addTag();
                  }
                }}
                onblur={addTag}
              />
            {/if}
          </div>
        </Field>
        <Field label={t('lens.field.parameters')} group hint={parameters.length ? t('lens.field.parameters.hint') : t('lens.field.parameters.none')}>
          {#each parameters as parameter (parameter.name)}
            {@const shown = defaultOf(parameter)}
            <div class="parameter">
              <span class="mono">@{parameter.name}</span>
              <input type="text" value={parameter.label} aria-label={t('lens.field.parameter.label', { name: parameter.name })} maxlength="60" oninput={(event) => (labels = { ...labels, [parameter.name]: event.currentTarget.value })} />
              <span class="kind"><Icon name={kindOf(parameter.kind).icon} />{t(kindOf(parameter.kind).label)}</span>
              <span class="default" title={shown.fn ? t('lens.value.function') : undefined}>{#if shown.fn}<Icon name="function" />{/if}{shown.value}</span>
            </div>
          {/each}
        </Field>
        {#if making}
          <div class="new-collection">
            <div class="label">{t('lens.newCollection.title')}</div>
            <p class="meta">{t(owned.length ? 'lens.newCollection.text' : 'lens.newCollection.none')}</p>
            {#if groups && groups.length === 0}
              <p class="meta">{t('lens.newCollection.noGroup')}</p>
            {:else}
              <Field label={t('collection.field.name')}><input type="text" bind:value={newName} maxlength="80" /></Field>
              <Field label={t('lens.newCollection.owner')}>
                <select bind:value={newOwner} disabled={!groups}>
                  {#each groups ?? [] as group (group.id)}<option value={group.id}>{group.name} · {group.email}</option>{/each}
                </select>
              </Field>
              <Field label={t('lens.newCollection.icon')} group><IconPicker bind:value={newIcon} /></Field>
            {/if}
            {#if owned.length}<button type="button" class="text-link" onclick={() => (making = false)}>{t('lens.newCollection.cancel')}</button>{/if}
          </div>
        {:else}
          <Field label={t('lens.field.collection')} hint={t('lens.field.collection.hint')}>
            <select value={lens?.collectionId ?? collectionId} onchange={(event) => (collectionId = event.currentTarget.value)}>
              {#each lens ? (collections ?? []).filter((one) => one.id === lens.collectionId) : owned as collection (collection.id)}
                <option value={collection.id}>{collection.name} · {collection.ownerUnit.name}</option>
              {/each}
            </select>
          </Field>
          {#if !frozen}<button type="button" class="text-link" onclick={() => (making = true)}>{t('lens.field.collection.new')}</button>{/if}
        {/if}
      </fieldset>
      <div class="label uses-label">{t('lens.uses')}</div>
      <div class="uses">
        {#each resources as resource (resource.id)}
          <span class="use"><KindIcon kind="resource" />{resource.displayName}{#if resource.collection}<span class="meta">· {resource.collection}</span>{/if}<MaturityIcon level={resource.level} small /></span>
        {/each}
      </div>
      {#if resources.length}<p class="meta level">{t('lens.uses.level', { level: levelName(level) })}</p>{/if}
    </section>

    <aside class="card size" aria-labelledby="size-check">
      <h2 id="size-check">{t('lens.size.title')}</h2>
      <p class="meta">{t('lens.size.intro')}</p>
      {#if reads !== null}
        <div class="reads">{bytes(reads)} <span class="meta">{t('lens.size.aRun')}</span></div>
        <Gauge bytes={reads} approve={thresholds.approve} request={thresholds.request} />
        {#if !frozen}
          <div class="per">
            {#each query?.resources ?? [] as resource (resource.id)}
              {#if resource.visible}
                {@const facts = storage[resource.id]}
                <div class="per-row">
                  <span>{resource.displayName}</span>
                  <span class="meta">
                    {#if resource.partition && partitioned.length === 1 && preflight?.partitions !== null && preflight?.partitions !== undefined && facts?.partitions}
                      {preflight.partitions >= facts.partitions
                        ? t('lens.size.allPartitions', { total: facts.partitions, field: resource.partition.field })
                        : t('lens.size.partitions', { count: preflight.partitions, total: facts.partitions, field: resource.partition.field })}
                    {:else if !resource.partition && facts?.bytes !== null && facts?.bytes !== undefined}
                      {t('lens.size.notPartitioned', { bytes: bytes(facts.bytes) })}
                    {/if}
                  </span>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      {/if}
      {#if !frozen && preflight && !preflight.runnable}
        <Callout icon="warning-fill" tone="warning">{t('lens.size.cannot')}</Callout>
        {#if query}<Button variant="outline" href={queryPath(query.id)}>{t('lens.size.back')}</Button>{/if}
      {:else if range === 'free'}
        <Callout icon="check-circle-fill" tone="fine"><b>{t('lens.size.free')}</b> {t('lens.size.free.text')}</Callout>
        {#if !frozen}<Button wide disabled={!ready} onclick={() => make(false)}>{t('lens.size.publish')}</Button>{/if}
      {:else if range === 'approve'}
        <Callout icon="warning-fill" tone="warning"><b>{t('lens.size.large')}</b> {t('lens.size.large.text', { approve: bytes(thresholds.approve) })}</Callout>
        {#if warning && warning.bytesWithFilter !== null}<p class="meta advice">{t('lens.size.less', { column: warning.column, bytes: bytes(warning.bytesWithFilter) })}</p>{/if}
        {#if !frozen && query}
          <div class="buttons">
            <Button disabled={!ready} onclick={() => make(true)}>{t('lens.size.publishAnyway')}</Button>
            <Button variant="quiet" href={queryPath(query.id)}>{t('lens.size.back')}</Button>
          </div>
        {/if}
      {:else if range === 'request'}
        <Callout icon="warning-circle-fill" tone="urgent"><b>{t('lens.size.veryLarge')}</b> {t('lens.size.veryLarge.text', { request: bytes(thresholds.request) })}</Callout>
        {#if warning && warning.bytesWithFilter !== null}<p class="meta advice">{t('lens.size.less', { column: warning.column, bytes: bytes(warning.bytesWithFilter) })}</p>{/if}
        {#if frozen && lens}
          {#if request}
            <Callout icon="hourglass-medium-fill">
              <b>{t('lens.size.sent', { name: lens.authorName, time: since(request.sentAt) })}</b>
              {lens.mine ? t('lens.size.sent.you') : t('lens.size.sent.other', { name: lens.authorName })}
            </Callout>
          {:else if lens.mine}
            <p class="meta failed" role="alert">{t('lens.size.notSent')}</p>
            <Field label={t('lens.size.word')}><textarea rows="2" maxlength="500" bind:value={text}></textarea></Field>
            <Button disabled={busy} onclick={sendAgain}><Icon name="paper-plane-tilt" />{t('lens.size.sendAgain')}</Button>
          {/if}
        {:else}
          <Field label={t('lens.size.word')}><textarea rows="2" maxlength="500" bind:value={text}></textarea></Field>
          <Button wide disabled={!ready} onclick={() => make(false)}><Icon name="paper-plane-tilt" />{t('lens.size.send')}</Button>
          <p class="meta">{t('lens.size.sendNote')}</p>
        {/if}
      {/if}
      {#if failed}<p class="failed" role="alert">{failed}</p>{/if}
      <p class="meta later">{t('lens.size.later')}</p>
    </aside>
  </div>
{/if}

<style>
  .crumb { margin-top: 8px; }
  .crumb a { color: inherit; }
  .head { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
  .head h1 { flex: 1; }
  .from { margin: 6px 0 0; font-size: var(--text-small); color: var(--text-secondary); }
  .halves { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 340px); gap: 14px; margin-top: 18px; align-items: start; }
  .card { border-radius: var(--radius-xl); padding: 18px 20px 20px; }
  h2 { font-size: var(--text-section); font-weight: var(--weight-medium); margin: 0 0 12px; }
  fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
  .lens :global(.field) { margin-bottom: 14px; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .tag { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-meta); padding: 3px 9px; border-radius: var(--radius-pill); background: var(--surface-sub); color: var(--text-secondary); }
  .tag button { all: unset; display: inline-flex; cursor: pointer; font-size: 10px; color: var(--text-muted); }
  .tag button:hover { color: var(--text-primary); }
  .lens .tags input.new-tag { width: 110px; padding: 3px 9px; border-radius: var(--radius-pill); font-size: var(--text-meta); }
  .parameter { display: grid; grid-template-columns: minmax(100px, auto) minmax(120px, 1fr) auto minmax(100px, auto); gap: 10px; align-items: center; padding: 7px 10px; border-radius: var(--radius-md);
    background: var(--surface-sub); margin-bottom: 6px; font-size: var(--text-small); }
  .lens .parameter input[type='text'] { padding: 4px 8px; }
  .kind, .default { display: inline-flex; align-items: center; gap: 5px; color: var(--text-secondary); font-size: var(--text-meta); }
  .new-collection { padding: 14px 16px 6px; border-radius: var(--radius-md); background: var(--surface-sub); margin-bottom: 14px; }
  .new-collection > p { margin: 4px 0 12px; line-height: 1.5; }
  .text-link { all: unset; display: inline-block; margin: -6px 0 14px; font-size: var(--text-meta); color: var(--text-secondary); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
  .uses-label { margin-top: 4px; }
  .uses { display: flex; flex-wrap: wrap; gap: 6px; }
  .use { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: var(--radius-md); background: var(--surface-sub); font-size: var(--text-small); }
  .level { display: block; margin: 8px 0 0; line-height: 1.5; }
  .size { display: flex; flex-direction: column; gap: 10px; }
  .size h2 { margin-bottom: 0; }
  .size > p { margin: 0; line-height: 1.5; }
  .reads { font-size: 26px; font-weight: var(--weight-medium); }
  .per { display: grid; gap: 6px; }
  .per-row { display: flex; justify-content: space-between; gap: 10px; font-size: var(--text-small); }
  .per-row .meta { text-align: right; }
  .advice { line-height: 1.5; }
  .buttons { display: flex; gap: 8px; flex-wrap: wrap; }
  .failed { color: var(--signal-urgent); font-size: var(--text-small); margin: 0; }
  .later { margin-top: 4px; }
  b { font-weight: var(--weight-medium); }
  @media (max-width: 1100px) { .halves { grid-template-columns: minmax(0, 1fr); } }
</style>

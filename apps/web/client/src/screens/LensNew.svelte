<script lang="ts">
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
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
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import { Refused } from '../lib/api.js';
  import type { Catalogue, Collection } from '../lib/catalogue.js';
  import { clock, when } from '../lib/moment.js';
  import { describe, isFunction, kindOf, suggestedOf } from '../lib/parameters.js';
  import type { Lens, LensField, LensParameter, Parameter, Preflight, Query, QueryClient, QueryField, QueryRequest, ResultColumn, Storage } from '../lib/query.js';
  import LensDeleteSheet from './LensDeleteSheet.svelte';
  import { lensPath, queryPath } from '../lib/routes.js';

  /**
   * Make it a lens (lens-new, DEC-UX-25): from a query of its author, still in Query. Left, the Lens: its
   * name and question from the query, what it shows, what it does step by step (DEC-UX-121), its tags, its
   * Parameters from the query, each with the name Users see (DEC-UX-75), the Collection it goes into, one
   * its author owns, or a new private one in the same step (DEC-UX-111), and its Resources with its Level.
   * Right, the size check: what one run reads, measured now, in three ranges (FR-LE-08): within range it
   * is published, large its author publishes it anyway, very large it goes to the Data Team (FR-LE-09).
   * A Lens that waits for the Data Team opens here as its author made it, frozen (lens-new-context, DEC-LE-05).
   * "Edit" opens a Lens here for its Owner Unit: what it tells and the names Users see, never its SQL, its
   * Parameters or its Collection, which change in its query (FR-LE-06, DEC-UX-27). A query that "New Lens"
   * started on a Collection offers that Collection first (DEC-UX-123).
   * Making it is a flow of four steps (DEC-UX-229): What it is, Tags, Parameters and Its fields, one at a time on the
   * left, with Back and Next; on the right, above the size check, the steps with how far each is, a click opening
   * one in any order. Only a name keeps it from being published. Its fields: each field of its result with its type
   * and a description, that of a field of its Resources of the same name, or one its author takes from another field
   * of its Resources or writes (DEC-UX-227, FR-LE-19). Edit is the same four steps (DEC-UX-231): a Lens made before its
   * fields had descriptions gets its columns from a Pre-flight, and the fields of its Resources from catalogue.
   */
  let {
    queryId,
    lens,
    editing,
    client,
    catalogue,
    collections,
    me,
    everyLens,
    canMake = true,
    loadGroups,
    onmade,
    ondeleted,
  }: {
    /** The query it is made from. */
    queryId?: string;
    /** A Lens that waits for the Data Team, shown as it was made. */
    lens?: Lens;
    /** A Lens its Owner Unit edits. */
    editing?: Lens;
    client: QueryClient;
    /** To make a new Collection, and to read the fields of the Resources of a Lens being edited (DEC-UX-231). */
    catalogue: Pick<Catalogue, 'createCollection' | 'resource'>;
    collections: readonly Collection[] | undefined;
    me: { name: string; groups: readonly string[] };
    /** The User manages every Lens (`lenses.manage`, every): a Lens may go into any Collection they manage. */
    everyLens: boolean;
    /** The User may make a query a Lens, and send its Request again (`lenses.make`). */
    canMake?: boolean;
    /** The Groups the User is in, by name, to own a new Collection (DEC-CO-24, DEC-UX-200). */
    loadGroups: () => Promise<readonly { id: string; name: string }[]>;
    onmade: (lens: Lens) => void;
    /** After its Owner Unit or the Data Team deleted the Lens being edited (FR-LE-18). */
    ondeleted?: (lens: { id: string; name: string; collectionId: string }) => void;
  } = $props();

  /** Whether the sheet that deletes the Lens being edited is open (DEC-UX-185). */
  let deleting = $state(false);
  /** Deletes the Lens being edited, with why (FR-LE-18); false when it did not. */
  async function remove(reason: string): Promise<boolean> {
    if (!editing) return false;
    try {
      const { lens: gone } = await client.deleteLens(editing.id, reason);
      ondeleted?.(gone);
      return true;
    } catch (error) {
      console.error('The Lens could not be deleted', error);
      return false;
    }
  }

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
  let groups = $state<readonly { id: string; name: string }[] | null | undefined>();
  let text = $state('');
  let busy = $state(false);
  let failed = $state<string | null>(null);
  let resent = $state<QueryRequest | null>(null);
  /** The step of making it that is open (DEC-UX-229). */
  let step = $state(1);
  /**
   * The description its author chose for a field: taken from a field of its Resources, or written (DEC-UX-227); for a
   * Lens being edited, also those it has, `named` when it came from a field of its Resources.
   */
  let chosen = $state<Record<string, Omit<LensField, 'name' | 'type'> & { named?: boolean }>>({});
  /** For a Lens being edited (DEC-UX-231): the columns of its result, and the fields of its Resources from catalogue. */
  let editColumns = $state<ResultColumn[]>([]);
  let editSources = $state<{ id: string; displayName: string; fields: readonly Pick<QueryField, 'name' | 'dataType' | 'description' | 'businessDescription'>[] }[]>([]);
  /** The field whose search of the fields of its Resources is open, and the words searched. */
  let picking = $state<string | null>(null);
  let words = $state('');

  const language = $derived(currentLanguage());
  const bytes = (value: number) => formatBytes(value, language);
  const frozen = $derived(lens !== undefined);
  /** The Lens as it is: frozen, or edited. */
  const existing = $derived(lens ?? editing);
  const owned = $derived(
    (collections ?? [])
      .filter((collection) => collection.canManage && (everyLens || me.groups.includes(collection.ownerUnit.id)))
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
  // What the Lens tells now, to edit (FR-LE-06).
  let editedId: string | undefined;
  $effect(() => {
    if (!editing || editedId === editing.id) return;
    editedId = editing.id;
    [name, question, shows, steps, tags, collectionId] = [editing.name, editing.question, editing.shows, editing.steps.join('\n'), [...editing.tags], editing.collectionId];
    labels = Object.fromEntries(editing.parameters.map((parameter) => [parameter.name, parameter.label]));
    // Its fields as kept, with their descriptions; a Lens made before has none, and its Pre-flight tells its columns (DEC-UX-231).
    const kept = editing.fields ?? [];
    chosen = Object.fromEntries(kept.filter((field) => field.description).map((field) => [field.name, { description: field.description, from: field.from, named: field.from !== null }]));
    const id = editing.id;
    if (kept.length) editColumns = kept.map(({ name: field, type }) => ({ name: field, type }));
    else {
      client.lensPreflight(id, {}).then(
        (checked) => {
          if (editedId === id && 'columns' in checked) editColumns = checked.columns ?? [];
        },
        () => undefined,
      );
    }
    Promise.allSettled(editing.resources.map((resource) => catalogue.resource(resource.id))).then((read) => {
      if (editedId !== id) return;
      editSources = read.flatMap((result) => (result.status === 'fulfilled' ? [{ id: result.value.id, displayName: result.value.displayName, fields: result.value.fields }] : []));
    });
  });
  // The Collection whose "New Lens" started the query comes first, when its author owns it (DEC-UX-123).
  $effect(() => {
    if (collectionId || existing || !query) return;
    const first = owned.find((collection) => collection.id === query?.forCollection) ?? owned[0];
    if (first) collectionId = first.id;
  });
  $effect(() => {
    if (!existing && collections && owned.length === 0) making = true;
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
    lens
      ? lens.parameters
      : editing
        ? editing.parameters.map((parameter) => ({ ...parameter, label: labels[parameter.name] ?? parameter.label }))
        : (query?.parameters ?? []).filter((parameter) => !preflight?.unused.includes(parameter.name)).map((parameter) => ({ ...parameter, label: labels[parameter.name] ?? parameter.name })),
  );
  /** What its Resources are, with their Collection and Level. */
  const resources = $derived(
    existing
      ? existing.resources.map((resource) => ({ id: resource.id, displayName: resource.displayName, level: resource.level, collection: collections?.find((one) => one.id === resource.collectionId)?.name ?? '' }))
      : (query?.resources ?? []).map((resource) =>
          resource.visible
            ? { id: resource.id, displayName: resource.displayName, level: resource.level, collection: collections?.find((one) => one.id === resource.collectionId)?.name ?? '' }
            : { id: resource.id, displayName: resource.displayName, level: 0, collection: '' },
        ),
  );
  const level = $derived(resources.length ? Math.min(...resources.map((resource) => resource.level)) : 0);
  const reads = $derived(existing ? existing.reads : (preflight?.bytes ?? null));
  const range = $derived(existing ? existing.range : (preflight?.range ?? null));
  const thresholds = $derived(preflight?.thresholds ?? { approve: 100_000_000, request: 1_000_000_000 });
  const partitioned = $derived((query?.resources ?? []).filter((resource) => resource.visible && resource.partition));
  const warning = $derived(preflight?.warnings.find((one) => one.bytesWithFilter !== null) ?? null);

  /** The fields of its Resources that have a description: the Business Description first, else the one from dbt. */
  const sourceFields = $derived(
    (editing ? editSources : (query?.resources ?? []).flatMap((resource) => (resource.visible ? [resource] : []))).flatMap((resource) =>
      resource.fields.flatMap((field) => {
        const description = field.businessDescription.trim() || field.description.trim();
        return description ? [{ resourceId: resource.id, resource: resource.displayName, name: field.name, type: field.dataType ?? '', description }] : [];
      }),
    ),
  );
  const resourceName = (id: string) => existing?.resources.find((resource) => resource.id === id)?.displayName ?? query?.resources.find((resource) => resource.id === id)?.displayName ?? '';

  /** A field of its result as its author sees it, with where its description comes from. */
  interface FieldRow {
    name: string;
    type: string;
    description: string;
    from: { resourceId: string; resource: string; field: string } | null;
    /** Named as a field of its Resources, taken from one, written, or without. */
    how: 'named' | 'taken' | 'written' | 'none';
    /** The other Resources that hold a field of this name. */
    others: string[];
  }

  /**
   * Its fields: the frozen Lens's, or each column of the result of its query as the Pre-flight tells them. A field
   * named as a field of its Resources takes that description, from the first Resource of the query that describes
   * it; nothing more is worked out from the SQL (DEC-UX-227).
   */
  const fieldRows: FieldRow[] = $derived(
    lens
      ? (lens.fields ?? []).map((field) => ({
          name: field.name,
          type: field.type,
          description: field.description,
          from: field.from ? { ...field.from, resource: resourceName(field.from.resourceId) } : null,
          how: field.description ? (field.from ? 'named' : 'written') : 'none',
          others: [],
        }))
      : (editing ? editColumns : (preflight?.columns ?? [])).map((column) => {
          const own = chosen[column.name];
          if (own) {
            const how = own.from ? (own.named ? 'named' : 'taken') : 'written';
            return { name: column.name, type: column.type, description: own.description, from: own.from ? { ...own.from, resource: resourceName(own.from.resourceId) } : null, how, others: [] };
          }
          const same = sourceFields.filter((field) => field.name.toLowerCase() === column.name.toLowerCase());
          const first = same[0];
          if (!first) return { name: column.name, type: column.type, description: '', from: null, how: 'none', others: [] };
          return {
            name: column.name,
            type: column.type,
            description: first.description,
            from: { resourceId: first.resourceId, resource: first.resource, field: first.name },
            how: 'named',
            others: [...new Set(same.slice(1).map((field) => field.resource))].filter((name) => name !== first.resource),
          };
        }),
  );
  const undescribed = $derived(fieldRows.filter((field) => field.description.trim() === '').length);

  /** The fields of its Resources the search finds, by name and words, grouped by Resource. */
  const found = $derived.by(() => {
    const asked = words.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const hits = sourceFields.filter((field) => asked.every((word) => `${field.name} ${field.description}`.toLowerCase().includes(word)));
    return [...new Set(hits.map((field) => field.resource))].map((resource) => ({ resource, fields: hits.filter((field) => field.resource === resource) }));
  });

  function pick(name: string): void {
    picking = picking === name ? null : name;
    words = '';
  }
  function take(name: string, field: { resourceId: string; name: string; description: string }): void {
    chosen = { ...chosen, [name]: { description: field.description, from: { resourceId: field.resourceId, field: field.name } } };
    picking = null;
  }
  function write(name: string, start: string): void {
    chosen = { ...chosen, [name]: { description: start, from: null } };
    picking = null;
  }

  /** The descriptions of its fields as they are sent: each field that has one, with where it comes from. */
  const described = () =>
    fieldRows.flatMap((field) =>
      field.description.trim() ? [{ name: field.name, description: field.description.trim(), from: field.from ? { resourceId: field.from.resourceId, field: field.from.field } : null }] : [],
    );

  /** What each step says on the right: how far it is (DEC-UX-229). */
  const collectionName = $derived(
    making ? newName.trim() : (collections ?? []).find((collection) => collection.id === (existing?.collectionId ?? collectionId))?.name ?? '',
  );
  const STEPS = ['lens.flow.what', 'lens.flow.tags', 'lens.flow.parameters', 'lens.flow.fields'] as const;
  const statusOf = (index: number): string => {
    if (index === 1) return [(lens?.name ?? name).trim() || t('lens.flow.status.noName'), collectionName].filter(Boolean).join(' · ');
    if (index === 2) return t('lens.flow.status.tags', { count: (lens?.tags ?? tags).length });
    if (index === 3) return t(editing ? 'lens.flow.status.parameters.edit' : 'lens.flow.status.parameters', { count: parameters.length });
    return fieldRows.length ? t('lens.flow.status.fields', { count: fieldRows.length }) : t('lens.flow.status.noFields');
  };

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
        fields: described(),
        approve,
        text: text.trim(),
      });
      if (outcome.kind === 'refused') preflight = outcome.preflight;
      else onmade(outcome.lens);
    } catch (error) {
      console.error('The Lens could not be made', error);
      // A Lens is made only on published Resources: say so, rather than that it failed (DEC-LE-22).
      // A Lens is made only on published Resources (DEC-LE-22): not on one not published, a table outside Data Hub or none (FR-SR-56).
      const why = { not_published: 'query.unpublished.hint', reads_outside: 'query.known.hint', no_resources: 'query.noResources.hint' } as const;
      const code = error instanceof Refused ? error.code : undefined;
      failed = code && code in why ? t(why[code as keyof typeof why]) : t('lens.make.failed');
    } finally {
      busy = false;
    }
  }

  /** Saves what the Lens tells; a name Users see left empty is the name of its Parameter. */
  async function save(): Promise<void> {
    if (!editing) return;
    busy = true;
    failed = null;
    try {
      onmade(
        await client.editLens(editing.id, {
          name: name.trim(),
          question: question.trim(),
          shows: shows.trim(),
          steps: steps.split('\n').map((step) => step.trim()).filter(Boolean),
          tags,
          labels: Object.fromEntries(Object.entries(labels).map(([parameter, label]) => [parameter, label.trim() || parameter])),
          // The descriptions of its fields, those of fields of its Resources of the same name included (DEC-UX-231).
          ...(fieldRows.length ? { fields: described() } : {}),
        }),
      );
    } catch (error) {
      console.error('The Lens could not be saved', error);
      failed = t('lens.edit.failed');
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
{:else if existing || query}
  {@const fromName = lens?.fromQuery?.name ?? query?.name ?? ''}
  {@const fromId = lens?.fromQuery?.id ?? query?.id}
  {#if editing}
    <div class="crumb meta">Collections · <a href={lensPath(editing.id)}>{editing.name}</a></div>
  {:else}
    <div class="crumb meta">{#if fromId}<a href={queryPath(fromId)}>Query</a>{:else}Query{/if} · {fromName}</div>
  {/if}
  <header class="head">
    <h1 class="page-title">{lens ? lens.name : editing ? t('lens.edit.title') : t('lens.make.title')}</h1>
    {#if editing}<Button variant="quiet" href={lensPath(editing.id)}>{t('collection.cancel')}</Button>
    {:else if !frozen && fromId}<Button variant="quiet" href={queryPath(fromId)}>{t('collection.cancel')}</Button>{/if}
  </header>
  {#if !existing}
    <p class="from">{#each tParts('lens.make.from', {}, { name: fromName }) as part, index (index)}{#if 'name' in part}<b>{part.name}</b>{:else}{part.text}{/if}{/each}</p>
  {/if}
  {#if query?.lens}
    <Callout icon="info-fill">{t('lens.make.already')} <a href={lensPath(query.lens.id)}>{query.lens.name}</a></Callout>
  {/if}

  {#snippet texts()}
    <Field label={t('lens.field.name')}><input {...NO_PASSWORD_MANAGER} type="text" value={lens?.name ?? name} oninput={(event) => (name = event.currentTarget.value)} maxlength="120" required /></Field>
    <Field label={t('lens.field.question')} hint={t('lens.field.question.hint')}><input {...NO_PASSWORD_MANAGER} type="text" value={lens?.question ?? question} oninput={(event) => (question = event.currentTarget.value)} maxlength="500" /></Field>
    <Field label={t('lens.field.shows')}><textarea {...NO_PASSWORD_MANAGER} rows="2" maxlength="500" value={lens?.shows ?? shows} oninput={(event) => (shows = event.currentTarget.value)}></textarea></Field>
    <Field label={t('lens.field.steps')} hint={t('lens.field.steps.hint')}>
      <textarea {...NO_PASSWORD_MANAGER} rows="3" value={lens ? lens.steps.join('\n') : steps} oninput={(event) => (steps = event.currentTarget.value)}></textarea>
    </Field>
  {/snippet}

  {#snippet tagsField()}
    <Field label={t('lens.field.tags')} group hint={editing ? undefined : t('lens.tags.hint')}>
      <div class="tags">
        {#each lens?.tags ?? tags as word (word)}
          <span class="tag">#{word}{#if !frozen}<button type="button" aria-label={t('lens.field.tag.remove', { tag: word })} onclick={() => (tags = tags.filter((other) => other !== word))}><Icon name="x" /></button>{/if}</span>
        {/each}
        {#if !frozen}
          <input {...NO_PASSWORD_MANAGER}
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
  {/snippet}

  {#snippet parametersField()}
    <Field label={t(editing ? 'lens.edit.parameters' : 'lens.field.parameters')} group hint={parameters.length ? t(editing ? 'lens.edit.parameters.hint' : 'lens.field.parameters.hint') : t('lens.field.parameters.none')}>
      {#each parameters as parameter (parameter.name)}
        {@const shown = defaultOf(parameter)}
        <div class="parameter">
          <span class="mono">@{parameter.name}</span>
          <input {...NO_PASSWORD_MANAGER} type="text" value={parameter.label} aria-label={t('lens.field.parameter.label', { name: parameter.name })} maxlength="60" oninput={(event) => (labels = { ...labels, [parameter.name]: event.currentTarget.value })} />
          <span class="kind"><Icon name={kindOf(parameter.kind).icon} />{t(kindOf(parameter.kind).label)}</span>
          <span class="default" title={shown.fn ? t('lens.value.function') : undefined}>{#if shown.fn}<Icon name="function" />{/if}{shown.value}</span>
        </div>
      {/each}
    </Field>
  {/snippet}

  {#snippet collectionField()}
    {#if making}
      <div class="new-collection">
        <div class="label">{t('lens.newCollection.title')}</div>
        <p class="meta">{t(owned.length ? 'lens.newCollection.text' : 'lens.newCollection.none')}</p>
        {#if groups && groups.length === 0}
          <p class="meta">{t('lens.newCollection.noGroup')}</p>
        {:else}
          <Field label={t('collection.field.name')}><input {...NO_PASSWORD_MANAGER} type="text" bind:value={newName} maxlength="80" /></Field>
          <Field label={t('lens.newCollection.owner')}>
            <select bind:value={newOwner} disabled={!groups}>
              {#each groups ?? [] as group (group.id)}<option value={group.id}>{group.name}</option>{/each}
            </select>
          </Field>
          <Field label={t('lens.newCollection.icon')} group><IconPicker bind:value={newIcon} /></Field>
        {/if}
        {#if owned.length}<button type="button" class="text-link" onclick={() => (making = false)}>{t('lens.newCollection.cancel')}</button>{/if}
      </div>
    {:else}
      <Field label={t(editing ? 'lens.edit.collection' : 'lens.field.collection')} hint={editing ? undefined : t('lens.field.collection.hint')}>
        <select value={existing?.collectionId ?? collectionId} disabled={editing !== undefined} onchange={(event) => (collectionId = event.currentTarget.value)}>
          {#each existing ? (collections ?? []).filter((one) => one.id === existing.collectionId) : owned as collection (collection.id)}
            <option value={collection.id}>{collection.name} · {collection.ownerUnit.name}</option>
          {/each}
        </select>
      </Field>
      {#if !existing}<button type="button" class="text-link" onclick={() => (making = true)}>{t('lens.field.collection.new')}</button>{/if}
    {/if}
  {/snippet}

  {#snippet uses()}
    <div class="label uses-label">{t('lens.uses')}</div>
    <div class="uses">
      {#each resources as resource (resource.id)}
        <span class="use"><KindIcon kind="resource" />{resource.displayName}{#if resource.collection}<span class="meta">· {resource.collection}</span>{/if}<MaturityIcon level={resource.level} small /></span>
      {/each}
    </div>
    {#if resources.length}<p class="meta level">{t('lens.uses.level', { level: levelName(level) })}</p>{/if}
  {/snippet}

  <!-- Its fields, as Users see them: named as a field of its Resources, taken from one, or written (DEC-UX-227, FR-LE-19) -->
  {#snippet fieldsList()}
    <p class="meta intro">{t(frozen ? 'lens.fields.hint.frozen' : 'lens.fields.hint')}</p>
    {#if fieldRows.length === 0}
      <p class="meta">{t('lens.fields.none')}</p>
    {/if}
    <div class="lf-list">
      {#each fieldRows as field (field.name)}
        <div class="lf-row" class:missing={field.how === 'none'}>
          <div class="lf-head"><span class="mono" title={field.name}>{field.name}</span><span class="meta">{field.type}</span></div>
          <div class="lf-desc">
            {#if field.how === 'written' && !frozen}
              <span class="lf-from"><Icon name="pencil-simple" />{t(editing ? 'lens.fields.writtenBy' : 'lens.fields.written')}</span>
              <textarea {...NO_PASSWORD_MANAGER} rows="2" maxlength="1000" aria-label={t('lens.fields.describe', { name: field.name })} value={field.description}
                oninput={(event) => (chosen = { ...chosen, [field.name]: { description: event.currentTarget.value, from: null } })}></textarea>
            {:else if field.how === 'written'}
              <span class="lf-from"><Icon name="pencil-simple" />{t('lens.fields.writtenBy')}</span>
              <p>{field.description}</p>
            {:else if field.from}
              <span class="lf-from">
                <Icon name="arrow-bend-down-right" />{t(field.how === 'taken' ? 'lens.fields.taken' : 'lens.fields.from', { resource: field.from.resource })} · <span class="mono">{field.from.field}</span>
                {#if field.others.length}<span class="pill" title={t('lens.fields.also.title')}>{t('lens.fields.also', { resources: field.others.join(', ') })}</span>{/if}
              </span>
              <p>{field.description}</p>
            {:else}
              <p class="lf-none">{#each tParts(frozen ? 'lens.fields.empty.frozen' : 'lens.fields.missing', {}, { name: field.name }) as part, index (index)}{#if 'name' in part}<span class="mono">{part.name}</span>{:else}{part.text}{/if}{/each}</p>
              {#if !frozen}
                <div class="lf-actions">
                  <Button variant="outline" onclick={() => pick(field.name)}><Icon name="magnifying-glass" />{t('lens.fields.pick')}</Button>
                  <Button variant="quiet" onclick={() => write(field.name, '')}>{t('lens.fields.write')}</Button>
                </div>
              {/if}
            {/if}
            {#if picking === field.name}
              <div class="lf-pick">
                <label class="search"><Icon name="magnifying-glass" /><input {...NO_PASSWORD_MANAGER} type="search" bind:value={words} placeholder={t('lens.fields.search')} aria-label={t('lens.fields.search')} /></label>
                <div class="lf-options">
                  {#each found as group (group.resource)}
                    <div class="lf-group">{group.resource}</div>
                    {#each group.fields as option (option.resourceId + option.name)}
                      <button type="button" class="lf-option" onclick={() => take(field.name, option)}><span class="mono">{option.name}</span><span class="meta">{option.type}</span><span class="lf-text" title={option.description}>{option.description}</span></button>
                    {/each}
                  {:else}
                    <p class="meta">{t('lens.fields.nothing')}</p>
                  {/each}
                </div>
                {#if field.how !== 'none'}<button type="button" class="text-link" onclick={() => write(field.name, field.description)}>{t('lens.fields.writeInstead')}</button>{/if}
              </div>
            {/if}
          </div>
          {#if !frozen && field.how !== 'none'}<button type="button" class="text-link lf-change" onclick={() => pick(field.name)}>{t('lens.fields.change')}</button>{/if}
        </div>
      {/each}
    </div>
  {/snippet}

  {#snippet nav(back: number | null, next: number | null)}
    <div class="nav">
      {#if back}<Button variant="outline" onclick={() => (step = back)}><Icon name="arrow-left" />{t('lens.flow.back')}</Button>{/if}
      <span class="grow"></span>
      {#if next}
        <Button variant="outline" onclick={() => (step = next)}>{t('lens.flow.next', { step: t(STEPS[next - 1] ?? 'lens.flow.what') })}<Icon name="arrow-right" /></Button>
      {:else if !frozen}
        <span class="meta">{t(editing ? 'lens.flow.save' : 'lens.flow.publish')}</span>
      {/if}
    </div>
  {/snippet}

  <div class="halves">
    <!-- One step at a time, when making it and when editing it (DEC-UX-229, DEC-UX-231). -->
    <section class="card lens" aria-labelledby="the-step">
        <div class="meta">{t('lens.flow.of', { step })}</div>
        <h2 id="the-step">{t(step === 4 ? 'lens.fields.title' : (STEPS[step - 1] ?? 'lens.flow.what'))}</h2>
        <fieldset disabled={frozen}>
          {#if step === 1}
            {@render texts()}
            {@render collectionField()}
          {:else if step === 2}
            {@render tagsField()}
          {:else if step === 3}
            {@render parametersField()}
          {/if}
        </fieldset>
        {#if step === 1}{@render uses()}{/if}
        {#if step === 4}{@render fieldsList()}{/if}
        {@render nav(step > 1 ? step - 1 : null, step < 4 ? step + 1 : null)}
      </section>
    <div class="side">
    <!-- The steps of making it, each with how far it is; a click opens one, in any order (DEC-UX-229). -->
    <nav class="card steps" aria-label={t('lens.flow.steps')}>
      {#each STEPS as title, index (title)}
        <button type="button" class="stepbtn" class:on={step === index + 1} aria-current={step === index + 1 ? 'step' : undefined} onclick={() => (step = index + 1)}>
          <span class="n">{index + 1}</span>
          <span class="t"><b>{t(title)}</b><span class="meta">{statusOf(index + 1)}{#if index === 3 && undescribed > 0}{' · '}<span class="warn">{t('lens.flow.status.undescribed', { count: undescribed })}</span>{/if}</span></span>
        </button>
      {/each}
    </nav>
    {#if editing}
      <aside class="card size" aria-labelledby="size-check">
        <h2 id="size-check">{t('lens.size.title')}</h2>
        <p class="meta">{t('lens.edit.size', { version: editing.version })}</p>
        <div class="reads">{bytes(editing.reads)} <span class="meta">{t('lens.size.aRun')}</span></div>
        <Gauge bytes={editing.reads} approve={thresholds.approve} request={thresholds.request} />
        <Callout icon="info-fill">{t('lens.edit.sql')}</Callout>
        <Button wide disabled={busy || name.trim() === ''} onclick={save}>{t('lens.edit.save')}</Button>
        <div class="delete"><Button variant="quiet" wide onclick={() => (deleting = true)}><Icon name="trash-fill" />{t('lens.delete.open')}</Button></div>
        {#if failed}<p class="failed" role="alert">{failed}</p>{/if}
      </aside>
    {:else}
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
        {#if frozen && lens && lens.state === 'refused'}
          <!-- Refused: unpublished, no longer frozen; its author changes it from its query (DEC-UX-128). -->
          <Callout icon="x-circle-fill" tone="urgent">
            <b>{t('lens.refused', { name: request?.decision?.writerName ?? 'Data Team', time: since(request?.decision?.at ?? lens.createdAt) })}</b>
            {#if request?.decision?.text}“{request.decision.text}”{/if}
            {t('lens.refused.text', { author: lens.mine ? t('messages.you') : lens.authorName })}
          </Callout>
          {#if fromId}<Button variant="outline" wide href={queryPath(fromId)}><Icon name="terminal-window-fill" />{t('lens.refused.query')}</Button>{/if}
        {:else if frozen && lens}
          {#if request}
            <Callout icon="hourglass-medium-fill">
              <b>{t('lens.size.sent', { name: lens.authorName, time: since(request.sentAt) })}</b>
              {lens.mine ? t('lens.size.sent.you') : t('lens.size.sent.other', { name: lens.authorName })}
            </Callout>
          {:else if lens.mine && canMake}
            <!-- Sending it again takes `lenses.make` (FR-PL-14). -->
            <p class="meta failed" role="alert">{t('lens.size.notSent')}</p>
            <Field label={t('lens.size.word')}><textarea {...NO_PASSWORD_MANAGER} rows="2" maxlength="500" bind:value={text}></textarea></Field>
            <Button disabled={busy} onclick={sendAgain}><Icon name="paper-plane-tilt" />{t('lens.size.sendAgain')}</Button>
          {/if}
        {:else}
          <Field label={t('lens.size.word')}><textarea {...NO_PASSWORD_MANAGER} rows="2" maxlength="500" bind:value={text}></textarea></Field>
          <Button wide disabled={!ready} onclick={() => make(false)}><Icon name="paper-plane-tilt" />{t('lens.size.send')}</Button>
          <p class="meta">{t('lens.size.sendNote')}</p>
        {/if}
      {/if}
      {#if failed}<p class="failed" role="alert">{failed}</p>{/if}
      <p class="meta later">{t('lens.size.later')}</p>
    </aside>
    {/if}
    </div>
  </div>
  <!-- "Delete this lens…" under Save opens its sheet (DEC-UX-185, FR-LE-18). -->
  {#if editing && deleting}<LensDeleteSheet name={editing.name} usedBy={editing.usedBy ?? 0} ondelete={remove} onclose={() => (deleting = false)} />{/if}
{:else}
  <Loading />
{/if}

<style>
  .delete { margin-top: 6px; }
  .delete :global(.button) { color: var(--signal-urgent); }
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
  /* Making it as a flow (DEC-UX-229): one step at a time on the left, the steps with how far each is above the size check */
  .lens > .meta:first-child { display: block; }
  .side { display: grid; gap: 14px; align-items: start; }
  .steps { border-radius: var(--radius-xl); padding: 8px; display: grid; gap: 2px; }
  .stepbtn { all: unset; box-sizing: border-box; display: flex; align-items: flex-start; gap: 10px; padding: 9px 10px; border-radius: var(--radius-md); cursor: pointer; }
  .stepbtn:hover { background: var(--tint-hover); }
  .stepbtn.on { background: var(--surface-sub); }
  .stepbtn:focus-visible { outline: 2px solid var(--text-secondary); }
  .n { display: inline-grid; place-items: center; flex: none; width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--tint-active); font-size: 11px; font-weight: var(--weight-medium); color: var(--text-secondary); }
  .stepbtn.on .n { background: var(--text-primary); border-color: var(--text-primary); color: var(--surface-solid); }
  .t { display: flex; flex-direction: column; gap: 1px; min-width: 0; font-size: var(--text-small); }
  .t .meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .warn { color: var(--signal-warn); }
  .nav { display: flex; align-items: center; gap: 8px; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--tint-hover); }
  .nav .grow { flex: 1; }
  /* Its fields, each with a description (DEC-UX-227) */
  .intro { display: block; line-height: 1.5; margin: 0 0 10px; }
  .lf-list { display: grid; gap: 6px; }
  .lf-row { display: grid; grid-template-columns: 150px minmax(0, 1fr) auto; gap: 4px 12px; align-items: start; padding: 10px 12px; border-radius: var(--radius-md); background: var(--surface-sub); font-size: var(--text-small); }
  .lf-head { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .lf-head .mono { overflow: hidden; text-overflow: ellipsis; }
  .lf-desc { min-width: 0; }
  .lf-desc p { margin: 2px 0 0; line-height: 1.5; color: var(--text-primary); }
  .lf-desc p.lf-none { color: var(--text-secondary); }
  .lf-from { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; font-size: var(--text-meta); color: var(--text-muted); }
  .pill { margin-left: 2px; font-size: 10px; color: var(--text-secondary); background: var(--tint-hover); padding: 2px 7px; border-radius: var(--radius-pill); }
  .lens .lf-desc textarea { width: 100%; box-sizing: border-box; margin-top: 4px; font-family: var(--font-family); font-size: var(--text-small); line-height: 1.5; color: var(--text-primary); background: var(--surface-solid); border: 0; border-radius: var(--radius-sm); padding: 6px 8px; resize: vertical; }
  .lf-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .lf-change { margin: 0; font-size: var(--text-meta); }
  .lf-pick { margin-top: 8px; padding: 8px; border-radius: var(--radius-md); background: var(--surface-solid); outline: 1px solid var(--tint-active); }
  .lf-pick .text-link { margin: 6px 0 0; }
  .search { display: flex; align-items: center; gap: 6px; padding: 5px 9px; border-radius: var(--radius-pill); background: var(--surface-sub); color: var(--text-muted); }
  .lens .search input { all: unset; flex: 1; min-width: 0; font-size: var(--text-small); color: var(--text-primary); }
  .lf-options { display: grid; gap: 2px; margin-top: 6px; max-height: 220px; overflow: auto; }
  .lf-options > .meta { padding: 6px 8px; margin: 0; }
  .lf-group { padding: 6px 8px 2px; font-size: var(--text-meta); color: var(--text-muted); }
  .lf-option { all: unset; box-sizing: border-box; display: grid; grid-template-columns: minmax(110px, max-content) 64px minmax(0, 1fr); gap: 10px; align-items: baseline; padding: 6px 8px; border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-meta); }
  .lf-option:hover, .lf-option:focus-visible { background: var(--tint-hover); }
  .lf-option .mono { color: var(--text-primary); }
  .lf-text { color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .later { margin-top: 4px; }
  b { font-weight: var(--weight-medium); }
  @media (max-width: 1100px) { .halves { grid-template-columns: minmax(0, 1fr); } }
</style>

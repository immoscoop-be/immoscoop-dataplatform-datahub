<script lang="ts" module>
  /** What saving came to: done, a name already in use, or a failure. */
  export type Saved = 'saved' | 'nameTaken' | 'failed';
</script>

<script lang="ts">
  import IconPicker from '@datahub/ui/components/IconPicker.svelte';
  import EditBar from '@datahub/ui/containers/EditBar.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Field from '@datahub/ui/primitives/Field.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import type { Collection, CollectionFields, OwnerUnit } from '../lib/catalogue.js';

  /**
   * The head of the page of a Collection turned into fields, in place, with the edit bar on top
   * (FR-CO-30): its name, description, Owner Unit, who sees it and its icon. Empty, it makes a new
   * Collection (FR-CO-12). The Owner Unit is one of the groups of whoever edits; the Data Team chooses
   * from every group of the domain (FR-CO-15, FR-CO-35). Dissolving is at the bottom, only for an
   * empty Collection (FR-CO-10).
   */
  let {
    collection,
    groups,
    dataTeam,
    own = [],
    held = 0,
    onsave,
    oncancel,
    ondissolve,
  }: {
    collection?: Collection;
    /** The groups to choose the Owner Unit from: undefined while they come, null when they did not. */
    groups: readonly OwnerUnit[] | null | undefined;
    dataTeam: boolean;
    /** The fixed IDs of the groups of the User: a new Collection takes the first of them by default. */
    own?: readonly string[];
    /** How many Resources it holds, withdrawn ones included. */
    held?: number;
    onsave: (fields: CollectionFields) => Promise<Saved>;
    oncancel: () => void;
    ondissolve?: () => void;
  } = $props();

  // The form starts from the Collection as it is, once; what the User types is theirs after that.
  // svelte-ignore state_referenced_locally
  const start = collection;
  let name = $state(start?.name ?? '');
  let description = $state(start?.description ?? '');
  let icon: string | null = $state(start?.icon ?? null);
  let visibility: 'private' | 'public' = $state(start?.visibility ?? 'private');
  let ownerUnit = $state(start?.ownerUnit.id ?? '');
  let saving = $state(false);
  let tried = $state(false);
  let taken: string | undefined = $state();
  let failed = $state(false);

  /** The groups to choose from, with the current Owner Unit in them even when the User is not in it. */
  const options = $derived.by(() => {
    const list = groups ?? [];
    return start && !list.some((group) => group.id === start.ownerUnit.id) ? [start.ownerUnit, ...list] : list;
  });
  // A new Collection takes a group of the User until they choose another, also from every group of the domain.
  $effect(() => {
    if (!ownerUnit && options[0]) {
      ownerUnit = (options.find((group) => own.includes(group.id)) ?? options[0]).id;
    }
  });
  const owner = $derived(options.find((group) => group.id === ownerUnit)?.name ?? '');

  const problems = $derived({
    name: name.trim().length < 1 || name.trim().length > 80 ? t('collection.problem.name') : taken === name.trim() ? t('collection.problem.nameTaken', { name: taken }) : undefined,
    description: description.trim().length < 1 || description.trim().length > 500 ? t('collection.problem.description') : undefined,
    icon: icon ? undefined : t('collection.problem.icon'),
    owner: ownerUnit ? undefined : t('collection.problem.owner'),
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    tried = true;
    failed = false;
    if (Object.values(problems).some(Boolean) || !icon) {
      return;
    }
    saving = true;
    const outcome = await onsave({ name: name.trim(), description: description.trim(), icon, ownerUnit, visibility });
    saving = false;
    if (outcome === 'nameTaken') {
      taken = name.trim();
    }
    failed = outcome === 'failed';
  }
</script>

<form class="card form" onsubmit={save} novalidate>
  <EditBar
    text={t(start ? 'collection.editing' : 'collection.making')}
    cancelLabel={t('collection.cancel')}
    saveLabel={t('collection.save')}
    {saving}
    {oncancel}
  />
  {#if failed}<p class="failed" role="alert">{t('collection.problem.failed')}</p>{/if}
  <div class="tiles">
    <div class="sub">
      <Field label={t('collection.field.name')} problem={tried || taken ? problems.name : undefined}>
        <input bind:value={name} maxlength="80" />
      </Field>
      <Field label={t('collection.field.description')} problem={tried ? problems.description : undefined}>
        <textarea bind:value={description} rows="3" maxlength="500"></textarea>
      </Field>
      <Field
        label={t('collection.field.owner')}
        hint={groups === null
          ? t('collection.field.owner.failed')
          : groups && options.length === 0
            ? t('collection.field.owner.none')
            : t(dataTeam ? 'collection.field.owner.hintDataTeam' : 'collection.field.owner.hint')}
        problem={tried && groups && options.length > 0 ? problems.owner : undefined}
      >
        <select bind:value={ownerUnit} disabled={!groups || options.length === 0}>
          {#each options as group (group.id)}
            <option value={group.id}>{group.name} · {group.email}</option>
          {/each}
        </select>
      </Field>
      <Field label={t('collection.field.visibility')} group>
        <Segmented
          options={[
            { value: 'private', label: t('collections.private'), icon: 'lock-simple-fill' },
            { value: 'public', label: t('collections.public'), icon: 'globe-simple-fill' },
          ]}
          bind:value={visibility}
          label={t('collection.field.visibility')}
        />
        <span class="explain">{visibility === 'public' ? t('collection.visibility.public') : t('collection.visibility.private', { owner })}</span>
      </Field>
    </div>
    <div class="sub">
      <Field label={t('icon.label')} group problem={tried ? problems.icon : undefined}>
        <IconPicker bind:value={icon} />
      </Field>
    </div>
  </div>
  {#if start && ondissolve}
    <div class="dissolve">
      <span class="trash"><Icon name="trash-fill" /></span>
      <p>
        <b>{t('collection.dissolve.title')}</b>
        {held > 0 ? t('collection.dissolve.full', { count: held }) : t('collection.dissolve.empty')}
      </p>
      <Button variant="quiet" disabled={held > 0} onclick={ondissolve}>{t('collection.dissolve')}</Button>
    </div>
  {/if}
</form>

<style>
  .form { margin-top: 10px; border-radius: var(--radius-xl); padding: 16px 18px 18px; }
  .tiles { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 10px; }
  .sub { border-radius: var(--radius-md); padding: 16px 18px; background: var(--surface-sub); min-width: 0; }
  .explain { display: block; margin-top: 6px; font-size: var(--text-meta); color: var(--text-muted); line-height: 1.5; }
  .failed { margin: 0 0 10px; font-size: var(--text-small); color: var(--signal-urgent); }
  .dissolve { display: flex; align-items: center; gap: 12px; margin-top: 12px; padding: 12px 16px; border-radius: var(--radius-callout); background: var(--surface-sub); }
  .trash { display: inline-flex; font-size: 22px; color: var(--text-secondary); }
  .dissolve p { flex: 1; margin: 0; font-size: var(--text-small); line-height: 1.5; }
  b { font-weight: var(--weight-medium); }
</style>

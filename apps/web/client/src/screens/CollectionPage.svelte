<script lang="ts">
  import { tick } from 'svelte';
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import InPlaceHead from '@datahub/ui/components/InPlaceHead.svelte';
  import LogList from '@datahub/ui/components/LogList.svelte';
  import MarkdownText from '@datahub/ui/components/MarkdownText.svelte';
  import MenuButton, { type MenuChoice } from '@datahub/ui/containers/MenuButton.svelte';
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import CollectionIcon from '@datahub/ui/marks/CollectionIcon.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import MessagesButton from './MessagesButton.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import { NotFound as Missing, Refused } from '../lib/api.js';
  import type { Catalogue, Collection, CollectionFields, CollectionItem, CollectionResource, LogEntry, Resource } from '../lib/catalogue.js';
  import type { requestOf } from '../lib/grain.js';
  import type { Identity } from '../lib/identity.js';
  import type { Registry } from '../lib/registry.js';
  import type { LensItem } from '../lib/query.js';
  import type { Mover } from '../lib/dragging.svelte.js';
  import { contents } from '../lib/folders.js';
  import { collectionPath, groupPath, newLensForPath, resourcePath } from '../lib/routes.js';
  import { command, place, useScreenCommands } from '../lib/commands.svelte.js';
  import type { QuickRow } from '../lib/quick.js';
  import AddResources from './AddResources.svelte';
  import CollectionForm, { type Saved } from './CollectionForm.svelte';
  import ContentsTable from './ContentsTable.svelte';
  import NotFound from './NotFound.svelte';

  /**
   * The page of a Collection (Page of a Collection, FR-CO-25 to FR-CO-31): what it is, its intro (FR-CO-41), what needs
   * attention, and what sits at its top in one table, the same as on the page of a folder: its folders first, then its
   * Resources and Lenses together, A to Z (FR-CO-38, DEC-UX-311). Its Owner Unit and the Data Team edit it from its
   * title, with "Edit more" for every field (DEC-UX-309); its head has Messages and one "New": a folder, a Lens, and,
   * for a Data Admin with `resources.assign`, Resources, in a sheet (DEC-UX-310, DEC-UX-313, FR-PL-14). Its history is
   * no part of the page: the quick window opens it in a sheet (DEC-UX-312). Without an ID, it is an empty Collection
   * being made (FR-CO-12).
   */
  let {
    id,
    lenses,
    catalogue,
    identity,
    registry,
    assigns,
    removes = null,
    anyOwnerUnit,
    own,
    waiting,
    go,
    onchanged,
    onmove,
    listed,
    messages,
  }: {
    id: string | undefined;
    /** Its Lenses the User sees; undefined while query has not told them. */
    lenses?: readonly LensItem[] | undefined;
    catalogue: Catalogue;
    identity: Identity;
    registry: Registry;
    /** The User may add Resources to it (`resources.assign`). */
    assigns: boolean;
    /** How far the User takes Resources out of a Collection (`resources.remove`, DEC-PL-08): every one, or theirs while not published. */
    removes?: 'theirs' | 'every' | null;
    /** The User may give it to any Group (`collections.make`, any group, FR-CO-35). */
    anyOwnerUnit: boolean;
    /** The fixed IDs of the groups of the User. */
    own: readonly string[];
    waiting: readonly Resource[] | undefined;
    go: (path: string) => void;
    /** Something changed that the panel shows: the Collections, or the Resources that wait. */
    onchanged: () => Promise<void>;
    /** Moves something of the Collection into one of its folders (FR-CO-40). */
    onmove: Mover;
    /** The Collection as the panel has it, read again after every move: where its Resources and Lenses sit. */
    listed?: Collection | undefined;
    /** "Messages" with their number, which opens the slide-in (FR-CV-07); left out while they are read. */
    messages?: { count: number | null; href: string };
  } = $props();

  /** The Collection: undefined while it comes, null when it does not exist or may not be seen. */
  let collection: Collection | null | undefined = $state();
  let resources: readonly CollectionResource[] | undefined = $state();
  let log: readonly LogEntry[] | undefined = $state();
  let editing = $state(false);
  let adding = $state(false);
  let making = $state(false);
  /** The history, in a sheet from the quick window (DEC-UX-312). */
  let history = $state(false);
  /** What was typed in place before "Edit more", which the form starts from (DEC-UX-309). */
  let typed: { name: string; description: string } | undefined = $state();
  let head: InPlaceHead | undefined = $state();
  /** The Groups to choose its Owner Unit from, by name (DEC-UX-200). */
  let groups: readonly { id: string; name: string }[] | null | undefined = $state();

  async function load(wanted: string) {
    try {
      const [found, held, entries] = await Promise.all([catalogue.collection(wanted), catalogue.collectionResources(wanted), catalogue.collectionLog(wanted)]);
      if (wanted === id) {
        [collection, resources, log] = [found, held, entries];
      }
    } catch (error) {
      if (wanted !== id) {
        return;
      }
      if (error instanceof Missing) {
        collection = null;
      } else {
        console.error(`The Collection ${wanted} could not be read`, error);
      }
    }
  }

  $effect(() => {
    const wanted = id;
    [collection, resources, log, editing, adding, making, history, typed] = [undefined, undefined, undefined, wanted === undefined, false, false, false, undefined];
    if (wanted) {
      load(wanted);
    }
  });
  // The Groups to choose an Owner Unit from, read when editing starts: those the User is in, or every Group
  // (TR-CO-03, FR-CO-35).
  $effect(() => {
    if (editing && groups === undefined) {
      (anyOwnerUnit ? identity.allGroups() : identity.groups()).then(
        (found) => (groups = found.filter((group) => anyOwnerUnit || group.isMember).map(({ id, name }) => ({ id, name }))),
        () => (groups = null),
      );
    }
  });

  async function save(fields: CollectionFields): Promise<Saved> {
    try {
      if (!collection) {
        const created = await catalogue.createCollection(fields);
        await onchanged();
        go(collectionPath(created.id));
        return 'saved';
      }
      const before = collection;
      const changed = Object.fromEntries(
        Object.entries(fields).filter(([key, value]) => (key === 'ownerUnit' ? before.ownerUnit.id : before[key as keyof Collection]) !== value),
      );
      if (Object.keys(changed).length > 0) {
        await catalogue.changeCollection(before.id, changed);
        await Promise.all([load(before.id), onchanged()]);
      }
      [editing, typed] = [false, undefined];
      return 'saved';
    } catch (error) {
      if (error instanceof Refused && error.code === 'name_taken') {
        return 'nameTaken';
      }
      console.error('The Collection could not be saved', error);
      return 'failed';
    }
  }

  /** Its name or description, changed in place (DEC-UX-162); a sentence when it is refused. */
  async function saveInPlace(shown: Collection, changes: { name?: string; description?: string }): Promise<string | undefined> {
    if (changes.description !== undefined && changes.description.length < 1) return t('collection.problem.description');
    try {
      await catalogue.changeCollection(shown.id, changes);
    } catch (error) {
      if (error instanceof Refused && error.code === 'name_taken') return t('collection.problem.nameTaken', { name: changes.name ?? '' });
      throw error;
    }
    await Promise.all([load(shown.id), onchanged()]);
    return undefined;
  }

  /** "Edit more", from the name and description in place: every field, starting from what was typed (DEC-UX-309). */
  function more(what: { name: string; description: string }) {
    [typed, editing] = [what, true];
  }

  /** "Edit the intro", from the quick window: the head turns into fields, at the intro (DEC-UX-158, OP-UX-116). */
  async function editIntro() {
    [typed, editing] = [undefined, true];
    await tick();
    const field = document.getElementById('intro') as HTMLTextAreaElement | null;
    field?.scrollIntoView?.({ block: 'center' });
    field?.focus({ preventScroll: true });
    field?.setSelectionRange(0, 0);
    if (field) field.scrollTop = 0;
  }

  async function make(name: string): Promise<boolean> {
    if (!collection) return false;
    try {
      await catalogue.makeFolder(collection.id, name, null);
      await Promise.all([load(collection.id), onchanged()]);
      making = false;
      return true;
    } catch (error) {
      console.error('The folder could not be made', error);
      return false;
    }
  }

  async function dissolve() {
    if (!collection) {
      return;
    }
    try {
      await catalogue.dissolveCollection(collection.id);
      await onchanged();
      go('/collections');
    } catch (error) {
      console.error('The Collection could not be dissolved', error);
    }
  }

  async function add(items: ReturnType<typeof requestOf>[]): Promise<{ outcome: 'added' | 'elsewhere' | 'refused' | 'failed'; message?: string }> {
    if (!collection) {
      return { outcome: 'failed' };
    }
    try {
      resources = await catalogue.addResources(collection.id, items);
      adding = false;
      await Promise.all([load(collection.id), onchanged()]);
      return { outcome: 'added' };
    } catch (error) {
      if (error instanceof Refused && error.code === 'in_another_collection') {
        await onchanged();
        return { outcome: 'elsewhere' };
      }
      console.error('The Resources could not be added', error);
      return error instanceof Refused && error.code === 'invalid_request' ? { outcome: 'refused', message: error.detail } : { outcome: 'failed' };
    }
  }

  async function remove(resource: CollectionItem) {
    if (!collection) {
      return;
    }
    try {
      await catalogue.removeResource(resource.id);
      await Promise.all([load(collection.id), onchanged()]);
    } catch (error) {
      console.error(`${resource.displayName} could not be removed`, error);
    }
  }

  /** The Collection is of one of the User's Owner Units. */
  const owned = $derived(collection !== undefined && collection !== null && (collection.owned ?? own.includes(collection.ownerUnit.id)));
  /** A column for ⊖ when the User takes out any of its Resources: every one, or, of their own, those not published (DEC-UX-214). */
  const removing = $derived(removes === 'every' || (removes === 'theirs' && owned));
  /** What sits at its top: its folders, and the Resources and Lenses in none (FR-CO-38). */
  const placed = $derived(listed && listed.id === collection?.id ? listed : collection);
  const top = $derived(placed ? contents(placed, lenses ?? [], null) : undefined);
  /** Its Resources with their last change, for the table. */
  const details = $derived(new Map((resources ?? []).map((resource) => [resource.id, resource])));
  /** Its Resources not published yet, A to Z, each on a line of its own under Needs attention (DEC-UX-314). */
  const unpublished = $derived(
    (resources ?? []).filter((resource) => !resource.published).toSorted((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })),
  );
  /** What "New" makes here, for who may (DEC-UX-310, DEC-UX-313). */
  const choices = $derived.by((): MenuChoice[] => {
    const shown = collection;
    if (!shown) return [];
    return [
      ...(shown.canManage ? [{ key: 'folder', icon: 'folder-simple-plus' as const, label: t('collection.new.folder'), hint: t('collection.new.folder.hint', { name: shown.name }), run: () => (making = true) }] : []),
      ...(assigns ? [{ key: 'resources', icon: 'table' as const, label: 'Resources', hint: t('collection.new.resources.hint'), run: () => (adding = true) }] : []),
      ...(shown.canManage ? [{ key: 'lens', icon: 'aperture' as const, label: 'Lens', hint: t('collection.new.lens.hint'), run: () => go(newLensForPath(shown.id)) }] : []),
    ];
  });

  // In the quick window: the buttons of its head, its folders and its Lenses, for who may (DEC-UX-240).
  useScreenCommands((go) => {
    const shown = collection;
    if (!shown) return null;
    const rows: QuickRow[] = [];
    if (shown.canManage && !editing) {
      rows.push(command('collection:rename', 'pencil-simple', t('quick.collection.rename'), () => head?.edit(), { meta: t('quick.collection.rename.meta'), words: t('quick.collection.rename.words') }));
      rows.push(command('collection:edit', 'pencil-simple-fill', t('quick.collection.edit'), () => more({ name: shown.name, description: shown.description }), { meta: t('quick.collection.edit.meta'), words: t('quick.collection.edit.words') }));
    }
    if (assigns) rows.push(command('collection:add', 'plus-circle-fill', t('collection.addResources'), () => (adding = true), { meta: t('quick.collection.add.meta'), words: t('quick.collection.add.words') }));
    if (shown.canManage && !editing) {
      rows.push(command('collection:folder', 'folder-simple-plus-fill', t('folder.new'), () => (making = true), { meta: t('quick.collection.folder.meta'), words: t('quick.folder.words') }));
      rows.push(place('collection:lens', 'aperture', t('quick.collection.lens'), () => go(newLensForPath(shown.id)), { meta: t('quick.collection.lens.meta'), words: t('quick.collection.lens.words') }));
      rows.push(command('collection:intro', 'text-align-left', t('collection.intro.edit'), () => void editIntro(), { words: t('quick.collection.intro.words') }));
    }
    rows.push(command('collection:history', 'clock-counter-clockwise', t('quick.collection.history'), () => (history = true), { meta: t('quick.collection.history.meta'), words: t('quick.collection.history.words') }));
    if (messages) {
      const href = messages.href;
      rows.push(place('collection:messages', 'chat-circle-dots-fill', 'Messages', () => go(href), { meta: t('quick.messages.meta', { count: messages.count ?? 0 }), words: t('quick.messages.words') }));
    }
    rows.push(place('collection:owner', 'users-three-fill', shown.ownerUnit.name, () => go(groupPath(shown.ownerUnit.id)), { meta: t('quick.owner.meta'), words: t('quick.owner.words') }));
    return { group: t('quick.group.collection'), where: `Collection · ${shown.name}`, rows };
  });
</script>

{#if id === undefined}
  <Breadcrumb steps={[{ label: 'Collections', href: '/collections' }, { label: t('collections.new') }]} />
  <CollectionForm {groups} {anyOwnerUnit} {own} onsave={save} oncancel={() => go('/collections')} />
{:else if collection === null}
  <NotFound />
{:else if collection}
  {@const shown = collection}
  {@const here = placed ?? collection}
  <Breadcrumb steps={[{ label: 'Collections', href: '/collections' }, { label: shown.name }]} />
  {#if editing}
    {#key shown.id}
      <CollectionForm
        collection={typed ? { ...shown, ...typed } : shown}
        {groups}
        {anyOwnerUnit}
        held={shown.resources.length}
        onsave={save}
        oncancel={() => ([editing, typed] = [false, undefined])}
        ondissolve={dissolve}
      />
    {/key}
  {:else}
    <div class="head">
      <CollectionIcon name={shown.icon} large />
      <div class="what">
        <!-- Its name and description, edited in place by its Owner Unit and the Data Team, with "Edit more" for every
             field; there is no Edit button (DEC-UX-162, DEC-UX-309). -->
        <InPlaceHead
          bind:this={head}
          name={shown.name}
          description={shown.description}
          canEdit={shown.canManage}
          nameLabel={t('collection.field.name')}
          descriptionLabel={t('collection.field.description')}
          onsave={(changes) => saveInPlace(shown, changes)}
          onmore={more}
        />
      </div>
      <div class="actions">
        {#if messages}<MessagesButton href={messages.href} count={messages.count} />{/if}
        <!-- One "New", its menu per role; a Message is written under Messages (DEC-UX-310, DEC-UX-313). -->
        {#if choices.length > 0}<MenuButton icon="plus" text={t('collection.new')} label={t('collection.new')} {choices} />{/if}
      </div>
    </div>
    <div class="status-row">
      <!-- Its Owner Unit is a Group, which opens on Groups (FR-UM-18). -->
      <a class="owner" href={groupPath(shown.ownerUnit.id)}><Chip><Icon name="users-three-fill" />{t('collection.owner', { owner: shown.ownerUnit.name })}</Chip></a>
      <Chip>
        <Icon name={shown.visibility === 'public' ? 'globe-simple-fill' : 'lock-simple-fill'} />{t(shown.visibility === 'public' ? 'collections.public' : 'collections.private')}
      </Chip>
    </div>
    <!-- The intro its Owner Unit writes, in Markdown, under the head; without one, nothing shows (DEC-UX-158). It is
         changed with Edit more or from the quick window (OP-UX-116). -->
    {#if shown.intro.trim()}
      <section class="intro card" aria-label={t('collection.intro')}>
        <p class="label">{t('collection.intro')}</p>
        <MarkdownText source={shown.intro} />
      </section>
    {/if}
  {/if}

  {#if shown.canManage && unpublished.length > 0 && !editing}
    <!-- Each Resource not published yet on a line of its own, with a link to it (DEC-UX-314). -->
    <section class="attention card" aria-label={t('collection.attention')}>
      <div class="label">{t('collection.attention')}</div>
      {#each unpublished as resource (resource.id)}
        <div class="line">
          <span class="sign"><Icon name="eye-slash-fill" /></span>
          <p><b>{resource.displayName}</b> {t('collection.attention.notPublished', { owner: shown.ownerUnit.name })}</p>
          <a class="open" href={resourcePath(resource.id)}>{t('collection.attention.open')}</a>
        </div>
      {/each}
    </section>
  {/if}

  {#if top}
    <ContentsTable
      collection={here}
      inside={top}
      folderId={null}
      lenses={lenses ?? []}
      {details}
      manage={shown.canManage}
      {removing}
      {removes}
      {owned}
      making={making && !editing}
      onmake={make}
      oncancel={() => (making = false)}
      onremove={remove}
      {go}
      {onmove}
      label={t('collection.contents', { name: shown.name })}
      empty={t(shown.canManage ? 'collection.resources.none' : 'collection.resources.nonePublished')}
    />
  {:else}
    <Loading />
  {/if}

  {#if history}
    <!-- The history, newest first, as long as it is (DEC-UX-312, OP-UX-117). -->
    <Sheet title={t('collection.history')} onclose={() => (history = false)}>
      {#snippet head()}<p class="meta">{shown.name}</p>{/snippet}
      {#if log}<LogList entries={log} />{:else}<Loading />{/if}
      {#snippet foot()}{#if log}<p class="meta">{t('collection.history.count', { count: log.length })}</p>{/if}{/snippet}
    </Sheet>
  {/if}

  {#if adding && waiting}
    <AddResources collection={shown.name} {waiting} {catalogue} {registry} onadd={add} onclose={() => (adding = false)} />
  {/if}
{:else}
  <Loading />
{/if}

<style>
  .head { display: flex; align-items: flex-start; gap: 14px; margin-top: 10px; }
  .what { flex: 1; min-width: 0; }
  .actions { display: flex; gap: 8px; align-items: center; flex: none; }
  .status-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
  .owner { display: inline-flex; color: inherit; text-decoration: none; border-radius: var(--radius-pill); }
  .owner:hover :global(.chip) { color: var(--text-primary); }
  .owner:focus-visible { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
  .attention { margin-top: 16px; border-radius: var(--radius-lg); padding: 14px 18px; }
  .label { font-size: var(--text-meta); color: var(--text-muted); margin: 0 0 8px; }
  .line { display: flex; align-items: center; gap: 10px; padding: 7px 0; font-size: var(--text-small); }
  .line + .line { border-top: 1px solid var(--tint-hover); }
  .line b { font-weight: var(--weight-medium); }
  .sign { display: inline-flex; font-size: 16px; color: var(--signal-warn); flex: none; }
  .line p { flex: 1; margin: 0; line-height: 1.5; }
  .open { flex: none; font-size: var(--text-small); color: var(--text-secondary); text-decoration: none; }
  .open:hover { color: var(--text-primary); text-decoration: underline; text-underline-offset: 3px; }
  .open:focus-visible { outline: 2px solid var(--text-secondary); outline-offset: 2px; }
  .intro { margin-top: 16px; padding: 16px 20px; border-radius: var(--radius-lg); }
</style>

<script lang="ts">
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import Search from '@datahub/ui/components/Search.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import { NotFound as Missing, Refused } from '../lib/api.js';
  import type { Catalogue, Collection, OwnedCollection } from '../lib/catalogue.js';
  import { isYours, listOf, managedBy, managesItself, matches, tagsOf, whomToAsk } from '../lib/groups.js';
  import type { GroupDetail, GroupFields, GroupSummary, Identity } from '../lib/identity.js';
  import { GROUPS, groupPath, myPagePath, NEW_GROUP } from '../lib/routes.js';
  import { place, useScreenCommands } from '../lib/commands.svelte.js';
  import GroupOpened from './GroupOpened.svelte';
  import NewGroupSheet from './NewGroupSheet.svelte';
  import NotFound from './NotFound.svelte';

  /**
   * Groups, reached from My page, with no place in the rail (DEC-UX-200, DEC-UX-202, FR-UM-18): the Groups the User
   * is in or manages on the left, each with what it owns or manages, its number of members and a tag for how the
   * User stands to it; a search finds a Group, or a colleague in one. With Manage every group, Yours or All shows
   * every Group, the others under "Other groups". One opened shows on the right, as a Permission group does on
   * Admin; without one in the address, the first of the list. New group is a sheet, for whoever may make groups.
   */
  let {
    identity,
    catalogue,
    environment,
    me,
    id,
    making = false,
    makes,
    every,
    collections,
    go,
    onmembership,
  }: {
    identity: Pick<Identity, 'groups' | 'allGroups' | 'group' | 'makeGroup' | 'changeGroup' | 'addMember' | 'removeMember' | 'deleteGroup' | 'people'>;
    catalogue: Pick<Catalogue, 'ownerUnitCollections'>;
    /** The environment of Data Hub, such as uat. */
    environment: string;
    /** The User, by Google ID, address and name. */
    me: { sub: string; email: string; name: string };
    /** The Group the address opens, or null for the first of the list. */
    id: string | null;
    /** The address asks for the sheet of a new Group. */
    making?: boolean;
    /** The User may make groups (`groups.manage`). */
    makes: boolean;
    /** The User may change every Group (`groups.all.manage`). */
    every: boolean;
    /** Every Collection the User sees, to say what a Group in the list is the Owner Unit of. */
    collections: readonly Collection[] | undefined;
    go: (path: string) => void;
    /** The Groups the User is in changed: their next Access Token carries them (FR-UM-19). */
    onmembership: () => void;
  } = $props();

  /** The Groups the User is in or manages: undefined while they come, null when identity did not answer. */
  let mine: GroupSummary[] | null | undefined = $state();
  /** Every Group, read for a User with Manage every group. */
  let all: GroupSummary[] | null | undefined = $state();
  let view = $state<'yours' | 'all'>('yours');
  let search = $state('');
  /** The Groups read in full, by id: for their members in the search, and what they manage. */
  let details: Record<string, GroupDetail> = $state({});
  /** The Group opened: undefined while it comes, null when there is none or it may not be seen. */
  let opened: { id: string; group?: GroupDetail | null } | undefined = $state();
  /** The Collections the Group opened is the Owner Unit of, as far as the User sees them; null when catalogue did not say. */
  let owned: { id: string; collections?: OwnedCollection[] | null } | undefined = $state();
  /** For a Group the User does not manage: two members of the Group that manages it, to ask (FR-UM-18). */
  let askers: { id: string; names?: string[] } | undefined = $state();

  const language = $derived(currentLanguage());

  /** Reads one Group in full, keeping it for the list. */
  async function readGroup(wanted: string): Promise<GroupDetail> {
    const group = await identity.group(wanted);
    details = { ...details, [wanted]: group };
    return group;
  }
  /** The Groups asked for in full in the background, once each. */
  const asked = new Set<string>();
  function want(wanted: string): void {
    if (asked.has(wanted)) return;
    asked.add(wanted);
    readGroup(wanted).catch((error: unknown) => console.error(`The Group ${wanted} could not be read`, error));
  }

  /** Reads the Groups of the User, and each in full, so that the search finds a colleague in them. */
  async function loadMine(): Promise<void> {
    try {
      const found = await identity.groups();
      mine = found;
      found.forEach((group) => want(group.id));
    } catch (error) {
      console.error('The Groups could not be read', error);
      mine = null;
    }
  }
  async function loadAll(): Promise<void> {
    try {
      all = await identity.allGroups();
    } catch (error) {
      console.error('Every Group could not be read', error);
      all = null;
    }
  }
  $effect(() => {
    loadMine();
  });
  // Every Group, for the choice Yours or All and for who may manage a Group (DEC-UX-201).
  $effect(() => {
    if (every && all === undefined) loadAll();
  });

  const words = $derived(search.trim());
  // The search finds a colleague too, in every Group shown, once their members are read.
  $effect(() => {
    if (view !== 'all' || words.length < 2 || !all) return;
    all.forEach((group) => want(group.id));
  });

  const yours = $derived(view === 'all' ? (all ?? []).filter(isYours) : (mine ?? []));
  const others = $derived(view === 'all' ? (all ?? []).filter((group) => !isYours(group)) : []);
  const shownYours = $derived(yours.filter((group) => matches(group, words, details[group.id])));
  const shownOthers = $derived(others.filter((group) => matches(group, words, details[group.id])));
  /** Every Group known, to name what a Group manages before it is read in full. */
  const known = $derived([...(mine ?? []), ...(all ?? [])]);
  const openedId = $derived(id ?? shownYours[0]?.id ?? shownOthers[0]?.id);

  $effect(() => {
    const wanted = openedId;
    if (!wanted || opened?.id === wanted) return;
    open(wanted);
  });

  /** Opens a Group: at once as it was read for the list, then as identity has it now, with what it owns. */
  function open(wanted: string): void {
    opened = { id: wanted, ...(details[wanted] ? { group: details[wanted] } : {}) };
    readGroup(wanted).then(
      (group) => opened?.id === wanted && (opened = { id: wanted, group }),
      (error: unknown) => {
        if (opened?.id !== wanted) return;
        if (!(error instanceof Missing)) console.error(`The Group ${wanted} could not be read`, error);
        opened = { id: wanted, group: error instanceof Missing ? null : (opened.group ?? null) };
      },
    );
    owned = { id: wanted };
    catalogue.ownerUnitCollections(wanted).then(
      (found) => owned?.id === wanted && (owned = { id: wanted, collections: found }),
      (error: unknown) => {
        console.error(`What ${wanted} owns could not be read`, error);
        if (owned?.id === wanted) owned = { id: wanted, collections: null };
      },
    );
  }

  // Who to ask, for a Group the User does not manage: two members of its managing Group (FR-UM-18).
  $effect(() => {
    const group = opened?.group;
    if (!group || group.mayChange || askers?.id === group.id) return;
    const wanted = group.id;
    askers = { id: wanted };
    const from = managesItself(group) ? Promise.resolve(group) : identity.group(group.managedBy.id);
    from.then(
      (manager) => askers?.id === wanted && (askers = { id: wanted, names: whomToAsk(manager.members, me.email) }),
      () => askers?.id === wanted && (askers = { id: wanted, names: [] }),
    );
  });

  /** What a Group in the list owns or manages, and how many members it has. */
  function metaOf(group: GroupSummary): string {
    const owns = (collections ?? []).filter((collection) => collection.ownerUnit.id === group.id).map((collection) => collection.name);
    const manages = managedBy(group, known, details[group.id]).map((one) => one.name);
    const parts = [
      ...(owns.length === 0 ? [] : [owns.length <= 2 ? t('group.owns', { names: listOf(owns, language) }) : t('group.ownsCount', { count: owns.length })]),
      ...(manages.length === 0 ? [] : [manages.length <= 2 ? t('group.manages', { names: listOf(manages, language) }) : t('group.managesCount', { count: manages.length })]),
    ];
    return [...(parts.length ? parts : [t('group.ownsNothing')]), t('group.members', { count: group.memberCount })].join(' · ');
  }

  /** A Group as identity has it after a change: in the list too, and the list read again when the User's place in it moved. */
  function changed(group: GroupDetail, how: { membership?: boolean; listing?: boolean } = {}): void {
    details = { ...details, [group.id]: group };
    if (opened?.id === group.id) opened = { id: group.id, group };
    const summary: GroupSummary = { id: group.id, name: group.name, sentence: group.sentence, managedBy: group.managedBy, memberCount: group.memberCount, isMember: group.isMember, mayChange: group.mayChange };
    mine = mine?.map((one) => (one.id === group.id ? summary : one));
    all = all?.map((one) => (one.id === group.id ? summary : one));
    if (how.membership) onmembership();
    if (how.membership || how.listing) {
      // The Group stays opened, also when it leaves the list of the User.
      if (id === null) go(groupPath(group.id));
      loadMine();
      if (every) loadAll();
    }
  }

  function deleted(group: GroupDetail): void {
    const rest = { ...details };
    delete rest[group.id];
    details = rest;
    mine = mine?.filter((one) => one.id !== group.id);
    all = all?.filter((one) => one.id !== group.id);
    opened = undefined;
    if (group.isMember) onmembership();
    go(GROUPS);
  }

  /** Makes a Group, with the User as its first member (FR-UM-13); answers why not, when identity refused. */
  async function make(fields: GroupFields): Promise<string | undefined> {
    let made: GroupDetail;
    try {
      made = await identity.makeGroup(fields);
    } catch (error) {
      console.error(`The Group ${fields.name} could not be made`, error);
      const code = error instanceof Refused ? error.code : undefined;
      return t(code === 'name_taken' ? 'group.nameTaken' : error instanceof Refused && error.status === 400 ? 'group.invalid' : 'group.failed');
    }
    details = { ...details, [made.id]: made };
    asked.add(made.id);
    onmembership();
    go(groupPath(made.id));
    loadMine();
    if (every) loadAll();
    return undefined;
  }

  // In the quick window: a new Group, for who may make one (DEC-UX-240).
  useScreenCommands((go) => (makes ? { group: 'Groups', rows: [place('groups:new', 'plus', t('group.new'), () => go(NEW_GROUP), { words: t('quick.group.new.words') })] } : null));
</script>

{#if id && opened?.id === id && opened.group === null}
  <NotFound />
{:else}
  <Breadcrumb steps={[{ label: t('rail.myPage'), href: myPagePath('profile') }]} />
  <div class="head">
    <div class="what">
      <h1 class="page-title">Groups</h1>
      <p class="meta lead">{t('group.lead')}</p>
    </div>
    {#if makes}<Button href={NEW_GROUP}><Icon name="plus" />{t('group.new')}</Button>{/if}
    <Chip><Icon name="cloud-fill" />Data Hub {environment}</Chip>
  </div>

  <div class="tools">
    <div class="find"><Search bind:value={search} placeholder={t('group.search')} surface="solid" /></div>
    {#if every && all}
      <Segmented
        options={[
          { value: 'yours', label: `${t('group.yours')} ${all.filter(isYours).length}` },
          { value: 'all', label: `${t('group.all')} ${all.length}` },
        ]}
        bind:value={view}
        label={t('group.which')}
      />
    {/if}
  </div>

  {#if mine === null || (view === 'all' && all === null)}
    <p class="meta problem">{t('admin.identityDown')}</p>
  {:else if mine && (view === 'yours' || all)}
    <div class="centre">
      <section class="card list" aria-label="Groups">
        {#each shownYours as group (group.id)}
          {@render item(group, true)}
        {/each}
        {#if shownOthers.length > 0}
          <div class="label others">{t('group.others')}</div>
          {#each shownOthers as group (group.id)}
            {@render item(group, false)}
          {/each}
        {/if}
        {#if shownYours.length === 0 && shownOthers.length === 0}
          <p class="meta none">{t(words ? 'group.noMatch' : 'group.none')}</p>
        {/if}
      </section>

      {#if opened?.group}
        {@const group = opened.group}
        {#key group.id}
          <GroupOpened
            {group}
            {me}
            {every}
            mine={mine.filter((one) => one.isMember)}
            {all}
            owned={owned?.id === group.id ? owned.collections : undefined}
            {collections}
            askers={askers?.id === group.id ? askers.names : undefined}
            {identity}
            onchanged={changed}
            ondeleted={deleted}
          />
        {/key}
      {:else if opened}
        <Loading />
      {/if}
    </div>
  {:else}
    <Loading />
  {/if}

  {#if making && makes && mine}
    <NewGroupSheet mine={mine.filter((one) => one.isMember)} onmake={make} onclose={() => go(GROUPS)} />
  {/if}
{/if}

{#snippet item(group: GroupSummary, ofUser: boolean)}
  <a class="item" class:on={group.id === openedId} aria-current={group.id === openedId ? 'true' : undefined} href={groupPath(group.id)}>
    <span class="item-icon" class:done={group.mayChange && ofUser}><Icon name="users-three-fill" /></span>
    <span>
      <b>{group.name}</b>
      <span class="meta line">{metaOf(group)}</span>
      {#if ofUser}
        {@const tags = tagsOf(group)}
        {#if tags.length > 0}
          <span class="sub">
            {#each tags as tag (tag.kind)}
              {#if tag.kind === 'in'}
                <span class="tag"><Icon name="user" />{t('group.tag.in')}</span>
              {:else if tag.kind === 'itself'}
                <span class="tag"><Icon name="pencil-simple" />{t('group.tag.itself')}</span>
              {:else}
                <span class="tag"><Icon name="pencil-simple" />{t('group.tag.through', { group: tag.manager })}</span>
              {/if}
            {/each}
          </span>
        {/if}
      {/if}
    </span>
  </a>
{/snippet}

<style>
  .head { display: flex; align-items: flex-end; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
  .what { flex: 1; min-width: 280px; }
  .lead { display: block; margin-top: 4px; line-height: 1.5; max-width: 760px; }
  .tools { display: flex; align-items: center; gap: 10px; margin: 18px 0 12px; flex-wrap: wrap; }
  .find { flex: 1; max-width: 420px; min-width: 220px; }
  .problem { display: block; margin: 12px 0; }
  .card { border-radius: var(--radius-xl); background: var(--surface-solid); }
  .centre { display: grid; grid-template-columns: minmax(230px, 300px) minmax(0, 1fr); gap: 14px; align-items: start; }
  .list { padding: 12px 8px 8px; }
  .item { box-sizing: border-box; display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 10px; width: 100%; padding: 12px 12px 12px 10px; border-radius: var(--radius-md); color: var(--text-primary); text-decoration: none; font-size: var(--text-small); }
  .item:hover { background: var(--tint-hover); }
  .item.on { background: var(--surface-sub); }
  .item:focus-visible { outline: 2px solid var(--text-secondary); }
  .item b { font-weight: var(--weight-medium); }
  .item-icon { display: inline-flex; margin-top: 1px; font-size: 17px; color: var(--text-muted); }
  .item-icon.done { color: var(--text-secondary); }
  .line { display: block; }
  .sub { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; margin-top: 3px; }
  .tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: var(--radius-pill); background: var(--tint-hover); font-size: var(--text-meta); color: var(--text-secondary); }
  .label { font-size: var(--text-meta); color: var(--text-muted); }
  .others { margin: 14px 8px 6px; }
  .none { display: block; padding: 6px 8px; line-height: 1.5; }
</style>

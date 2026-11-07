<script lang="ts">
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import Search from '@datahub/ui/components/Search.svelte';
  import Toast from '@datahub/ui/components/Toast.svelte';
  import Table from '@datahub/ui/containers/Table.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t, tParts } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago } from '@datahub/ui/foundations/when.js';
  import Avatar from '@datahub/ui/primitives/Avatar.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import type { Identity, PermissionGroup, UserOfAdmin } from '../lib/identity.js';
  import { initialsOf } from '../lib/initials.js';
  import UserSheet from './UserSheet.svelte';

  /**
   * Users, a tool of Admin (FR-PL-06, DEC-UX-190): everyone who signed in to this environment, with their Permission
   * group, their Owner Units, what they use (the web app, Claude, Excel) and when they last signed in. A search finds
   * a User by name or address; a filter shows one Permission group, each with its count. A User who can no longer
   * sign in stays listed, greyed; a new one is marked new, with "the default" next to their group. A row opens the
   * User in a sheet over the page, where their Permission group changes (FR-PL-07); saved, the row says so and a
   * toast says it takes effect within 15 minutes (FR-PL-11).
   */
  let {
    identity,
    environment,
    me,
    ownerUnits,
    filter = null,
    user = undefined,
    groupsHref,
    oncount,
  }: {
    identity: Pick<Identity, 'users' | 'user' | 'moveUser' | 'permissionGroups'>;
    /** The environment of Data Hub, such as uat. */
    environment: string;
    /** The Google ID of the User signed in, who cannot change their own Permission group (FR-PL-08). */
    me: string;
    /** The names of the Owner Units by the id of their group, from the Collections the User sees. */
    ownerUnits: ReadonlyMap<string, string>;
    /** The Permission group to show, as a group opened on Permission groups asks. */
    filter?: string | null;
    /** The User to open, as the address names them, such as from a Message (FR-PL-12). */
    user?: string;
    /** Permission groups, when the User may open it. */
    groupsHref?: string;
    /** How many Users there are, for the panel of Admin. */
    oncount?: (count: number) => void;
  } = $props();

  /** A User is new for a week after their first sign-in. */
  const NEW_FOR = 7 * 24 * 60 * 60 * 1000;

  let users: UserOfAdmin[] | null | undefined = $state();
  let groups: PermissionGroup[] | null | undefined = $state();
  let search = $state('');
  // svelte-ignore state_referenced_locally
  let shown: string = $state(filter ?? 'all');
  let opened: string | undefined = $state();
  /** The Users whose Permission group was changed here, which their row says (DEC-UX-189). */
  let changedHere: string[] = $state([]);
  let saved = $state({ key: 0, name: '', group: '' });

  async function load() {
    try {
      [users, groups] = await Promise.all([identity.users(), identity.permissionGroups()]);
    } catch (error) {
      console.error('The Users could not be read', error);
      users = null;
    }
  }
  $effect(() => {
    load();
  });
  $effect(() => {
    if (users) oncount?.(users.length);
  });
  $effect(() => {
    if (filter) shown = filter;
  });
  $effect(() => {
    if (user) opened = user;
  });

  const language = $derived(currentLanguage());
  const counts = $derived(Object.fromEntries((groups ?? []).map((group) => [group.id, (users ?? []).filter((user) => user.permissionGroup.id === group.id).length])));
  const defaultGroup = $derived(groups?.find((group) => group.isDefault));
  const words = $derived(search.trim().toLowerCase());
  const latest = (user: UserOfAdmin) => new Date(user.lastLoginAt ?? user.createdAt).getTime();
  const listed = $derived(
    (users ?? [])
      .filter((user) => shown === 'all' || user.permissionGroup.id === shown)
      .filter((user) => !words || [user.name, user.email].some((text) => text.toLowerCase().includes(words)))
      .toSorted((one, other) => latest(other) - latest(one)),
  );
  const isNew = (user: UserOfAdmin) => Date.now() - new Date(user.createdAt).getTime() < NEW_FOR;
  const unitsOf = (user: UserOfAdmin) => user.groups.flatMap((group) => ownerUnits.get(group) ?? []);
  const openedUser = $derived(users?.find((user) => user.googleId === opened));

  function open(user: UserOfAdmin) {
    opened = user.googleId;
  }

  function moved(user: UserOfAdmin) {
    users = (users ?? []).map((one) => (one.googleId === user.googleId ? user : one));
    changedHere = [...changedHere.filter((id) => id !== user.googleId), user.googleId];
    opened = undefined;
    saved = { key: saved.key + 1, name: user.name, group: user.permissionGroup.name };
  }
</script>

<Breadcrumb steps={[{ label: 'Admin' }]} />
<div class="head">
  <div class="what">
    <h1 class="page-title">Users</h1>
    <p class="meta lead">
      {#if defaultGroup}
        {#each tParts('admin.users.lead', { environment }, { group: defaultGroup.name }) as part, index (index)}{#if 'name' in part}{#if groupsHref}<a class="text-link" href={groupsHref}>{part.name}</a>{:else}{part.name}{/if}{:else}{part.text}{/if}{/each}
      {:else}
        {t('admin.users.leadNoDefault', { environment })}
      {/if}
    </p>
  </div>
  <Chip><Icon name="cloud-fill" />Data Hub {environment}</Chip>
</div>

{#if users === null}
  <p class="meta problem">{t('admin.identityDown')}</p>
{:else if users && groups}
  <div class="tools">
    <div class="find"><Search bind:value={search} placeholder={t('admin.users.search')} surface="solid" /></div>
    <Segmented
      options={[{ value: 'all', label: `${t('admin.users.all')} ${users.length}` }, ...groups.map((group) => ({ value: group.id, label: `${group.name} ${counts[group.id] ?? 0}` }))]}
      bind:value={shown}
      label={t('admin.users.which')}
    />
  </div>
  <Table label="Users">
    {#snippet head()}
      <tr>
        <th>User</th>
        <th>Permission group</th>
        <th>Owner Units</th>
        <th>{t('admin.users.column.uses')}</th>
        <th>{t('admin.users.column.last')}</th>
      </tr>
    {/snippet}
    {#each listed as user (user.googleId)}
      {@const units = unitsOf(user)}
      <tr
        class="row"
        class:gone={!user.active}
        class:on={opened === user.googleId}
        tabindex="0"
        aria-label={user.name}
        onclick={() => open(user)}
        onkeydown={(event) => event.key === 'Enter' && event.target === event.currentTarget && open(user)}
      >
        <td>
          <span class="who">
            <Avatar initials={initialsOf(user.name || user.email)} size="mini" />
            <span>
              <span class="name">{user.name}</span>
              {#if user.googleId === me}<span class="pill">{t('users.you')}</span>{/if}
              {#if !user.active}<span class="pill">{t('admin.users.gone')}</span>{:else if isNew(user)}<span class="pill">{t('admin.users.new')}</span>{/if}
              <span class="meta email">{user.email}</span>
            </span>
          </span>
        </td>
        <td>
          <span class="tag"><Icon name="shield-check" />{user.permissionGroup.name}</span>
          {#if changedHere.includes(user.googleId)}<span class="chg">{t('admin.users.changedByYou')}</span>{:else if isNew(user) && user.permissionGroup.id === defaultGroup?.id}<span class="meta"> {t('admin.users.theDefault')}</span>{/if}
        </td>
        <td class:muted={units.length === 0}>{units.length > 0 ? units.join(', ') : t('users.none')}</td>
        <td>
          <span class="uses">
            <span class:off={!user.uses.web}><Icon name="browser" label={t(user.uses.web ? 'admin.users.uses.web' : 'admin.users.uses.noWeb')} /></span>
            <span class:off={!user.uses.claude}><Icon name="plugs-connected" label={t(user.uses.claude ? 'admin.users.uses.claude' : 'admin.users.uses.noClaude')} /></span>
            <span class:off={!user.uses.excel}><Icon name="key" label={t(user.uses.excel ? 'admin.users.uses.excel' : 'admin.users.uses.noExcel')} /></span>
          </span>
        </td>
        <td class="nowrap" class:muted={!user.active}>{user.lastLoginAt ? ago(user.lastLoginAt, language) : t('users.never')}</td>
      </tr>
    {:else}
      <tr><td colspan="5" class="muted none">{t(words ? 'admin.users.noMatch' : 'admin.users.none')}</td></tr>
    {/each}
    {#snippet after()}<p class="meta foot">{t('admin.users.foot')}</p>{/snippet}
  </Table>
{:else}
  <Loading />
{/if}

{#if openedUser && groups}
  {#key openedUser.googleId}
    <UserSheet
      user={openedUser}
      {groups}
      self={openedUser.googleId === me}
      ownerUnits={unitsOf(openedUser)}
      {counts}
      {identity}
      onsaved={moved}
      onclose={() => (opened = undefined)}
    />
  {/key}
{/if}

<Toast key={saved.key}>{t('admin.users.saved', { name: saved.name, group: saved.group })}</Toast>

<style>
  .head { display: flex; align-items: flex-end; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
  .what { flex: 1; min-width: 280px; }
  .lead { display: block; margin-top: 4px; line-height: 1.5; max-width: 720px; }
  .text-link { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
  .tools { display: flex; align-items: center; gap: 10px; margin: 18px 0 12px; flex-wrap: wrap; }
  .find { flex: 1; max-width: 420px; min-width: 220px; }
  .problem { display: block; margin: 12px 0; }
  .on td { background: var(--surface-sub); }
  .gone td { color: var(--text-muted); }
  .who { display: inline-flex; align-items: center; gap: 10px; }
  .name { font-weight: var(--weight-medium); }
  .email { display: block; }
  .pill { margin-left: 6px; font-size: 10px; color: var(--text-secondary); background: var(--tint-hover); padding: 2px 7px; border-radius: var(--radius-pill); white-space: nowrap; }
  .tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: var(--radius-pill); background: var(--tint-hover); font-size: var(--text-meta); color: var(--text-secondary); white-space: nowrap; }
  .chg { margin-left: 6px; font-size: var(--text-meta); background: var(--surface-sub); color: var(--text-secondary); padding: 1px 8px; border-radius: var(--radius-pill); white-space: nowrap; }
  .uses { display: inline-flex; gap: 8px; font-size: 15px; color: var(--text-secondary); }
  .uses span { display: inline-flex; }
  .uses .off { color: var(--tint-active); }
  .muted { color: var(--text-muted); }
  .nowrap { white-space: nowrap; }
  .none { padding: 14px 10px; }
  .foot { display: block; margin: 8px 10px 2px; line-height: 1.5; }
</style>

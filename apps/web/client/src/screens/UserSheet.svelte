<script lang="ts">
  import FactsList from '@datahub/ui/components/FactsList.svelte';
  import Callout from '@datahub/ui/containers/Callout.svelte';
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago, day } from '@datahub/ui/foundations/when.js';
  import Avatar from '@datahub/ui/primitives/Avatar.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import { Refused } from '../lib/api.js';
  import type { GroupMove, Identity, PermissionGroup, UserOfAdmin } from '../lib/identity.js';
  import { initialsOf } from '../lib/initials.js';
  import { changesBetween } from '../lib/permissions.js';
  import { groupPath } from '../lib/routes.js';
  import ChangeList from './ChangeList.svelte';

  /**
   * One User opened on Users, in a sheet over the list (User sheet, FR-PL-07): who they are, since when, how they
   * use Data Hub and their Groups, read-only here, each the way to it on Groups, where they change (DEC-UX-200). Under it their Permission group
   * as a choice of every group, the current one marked "now" and the default "default"; choosing another shows,
   * before it is saved, what the User gains and loses, and that their Groups stay. Then the history of their
   * Permission group. Nobody changes their own (FR-PL-08): for yourself the choice is greyed, with why. identity
   * refuses that too, and moving the last User out of Admin; the sheet says so.
   */
  let {
    user,
    groups,
    self,
    counts,
    identity,
    onsaved,
    onclose,
  }: {
    user: UserOfAdmin;
    groups: readonly PermissionGroup[];
    /** The User opened is the one signed in. */
    self: boolean;
    /** How many Users each Permission group has, by its id. */
    counts: Readonly<Record<string, number>>;
    identity: Pick<Identity, 'user' | 'moveUser'>;
    /** The User as identity keeps them after the change. */
    onsaved: (user: UserOfAdmin) => void;
    onclose: () => void;
  } = $props();

  const language = $derived(currentLanguage());
  // svelte-ignore state_referenced_locally
  let chosen = $state(user.permissionGroup.id);
  let history: GroupMove[] | null | undefined = $state();
  let saving = $state(false);
  let problem = $state('');

  $effect(() => {
    const id = user.googleId;
    identity.user(id).then(
      (found) => user.googleId === id && (history = found.history),
      (error: unknown) => {
        console.error(`The history of ${user.name} could not be read`, error);
        if (user.googleId === id) history = null;
      },
    );
  });

  const now = $derived(groups.find((group) => group.id === user.permissionGroup.id));
  const next = $derived(groups.find((group) => group.id === chosen));
  const lines = $derived(now && next && next.id !== now.id ? changesBetween(now.permissions, next.permissions) : undefined);
  const nameOf = (group: string | null) => groups.find((one) => one.id === group)?.name ?? group ?? '';
  const list = (names: readonly string[]) => new Intl.ListFormat(language === 'nl' ? 'nl-BE' : 'en-GB').format(names);
  const uses = $derived(
    [user.uses.web ? t('users.uses.web') : null, user.uses.claude ? t('users.uses.claude') : null, user.uses.excel ? t('users.uses.excel') : null].filter((one) => one !== null),
  );

  /** One move in the history: the default at the first sign-in, or from one group to another, and by whom. */
  function moved(move: GroupMove): string {
    if (move.from === null) return t('users.history.first', { group: nameOf(move.to) });
    return move.by ? t('users.history.movedBy', { from: nameOf(move.from), to: nameOf(move.to), by: move.by }) : t('users.history.moved', { from: nameOf(move.from), to: nameOf(move.to) });
  }

  async function save() {
    if (!next || chosen === user.permissionGroup.id) return;
    saving = true;
    problem = '';
    try {
      onsaved(await identity.moveUser(user.googleId, chosen));
    } catch (error) {
      console.error(`The Permission group of ${user.name} could not be changed`, error);
      problem =
        error instanceof Refused && error.code === 'own_group'
          ? t('users.sheet.ownGroup')
          : error instanceof Refused && error.code === 'last_admin'
            ? t('users.sheet.lastAdmin', { group: now?.name ?? '' })
            : t('users.sheet.failed');
    }
    saving = false;
  }
</script>

<Sheet title={user.name} {onclose}>
  {#snippet lead()}<span class="initials"><Avatar initials={initialsOf(user.name || user.email)} size="large" /></span>{/snippet}
  {#snippet head()}<div class="meta">{user.email}{#if self} <span class="pill">{t('users.you')}</span>{/if}</div>{/snippet}
  <div class="body">
    <FactsList>
      <dt>{t('users.fact.since')}</dt>
      <dd>{t('users.fact.sinceFirst', { day: day(user.createdAt, language) })}</dd>
      <dt>{t('users.fact.last')}</dt>
      <dd>{user.lastLoginAt ? ago(user.lastLoginAt, language) : t('users.never')}</dd>
      <dt>{t('users.fact.uses')}</dt>
      <dd>{uses.length > 0 ? list(uses) : t('users.uses.nothing')}</dd>
      <dt>Groups</dt>
      <dd>
        {#each user.groups as group, index (group.id)}{#if index > 0}{', '}{/if}<a class="text-link" href={groupPath(group.id)}>{group.name}</a>{:else}{t('users.none')}{/each}
        <span class="meta">· {t('users.onGroups')}</span>
      </dd>
    </FactsList>

    <div class="label">Permission group</div>
    {#if self}
      <Callout icon="lock-simple-fill">{t('users.self')}</Callout>
    {/if}
    <div class="groups" role="radiogroup" aria-label="Permission group" aria-disabled={self ? 'true' : undefined}>
      {#each groups as group (group.id)}
        <label class="option" class:off={self}>
          <input type="radio" name="permission-group" value={group.id} bind:group={chosen} disabled={self} />
          <span>
            <span class="title">{group.name}{#if group.id === user.permissionGroup.id} <span class="pill now">{t('users.now')}</span>{/if}{#if group.isDefault} <span class="pill">{t('users.default')}</span>{/if}</span>
            <span class="meta line">{t('users.group.line', { sentence: group.sentence, count: counts[group.id] ?? group.users })}</span>
          </span>
        </label>
      {/each}
    </div>

    {#if lines}
      <div class="label">{t('users.changes', { name: user.name })}</div>
      <ChangeList {lines} />
    {/if}

    <div class="label">{t('users.history')}</div>
    {#if history === undefined}
      <Loading />
    {:else if history === null}
      <p class="meta">{t('users.history.failed')}</p>
    {:else}
      <ul class="log">
        {#each history as move, index (index)}
          <li><span class="when">{day(move.at, language)}</span><span>{moved(move)}</span></li>
        {:else}
          <li><span class="when"></span><span class="meta">{t('users.history.none')}</span></li>
        {/each}
      </ul>
    {/if}
  </div>
  {#snippet foot()}
    {#if self}
      <p class="meta note"></p>
      <Button variant="quiet" onclick={onclose}>{t('users.close')}</Button>
    {:else}
      <p class="meta note" class:problem role={problem ? 'alert' : undefined}>{problem || t('users.takesEffect')}</p>
      <Button variant="quiet" onclick={onclose}>{t('admin.cancel')}</Button>
      <Button disabled={saving || chosen === user.permissionGroup.id} onclick={save}>{t('users.save')}</Button>
    {/if}
  {/snippet}
</Sheet>

<style>
  .initials { display: inline-flex; }
  .text-link { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
  .body { flex: 1; min-height: 0; overflow-y: auto; padding: 10px 6px 12px; }
  .label { margin: 20px 0 6px; font-size: var(--text-meta); color: var(--text-muted); }
  .groups { display: grid; gap: 4px; margin-top: 8px; }
  .option { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 10px; align-items: start; padding: 10px 12px; border-radius: var(--radius-md); cursor: pointer; }
  .option:hover { background: var(--tint-hover); }
  .option:has(input:checked) { background: var(--surface-sub); outline: 1.5px solid var(--text-secondary); outline-offset: -1.5px; }
  .option input { margin: 3px 0 0; accent-color: var(--text-primary); }
  .option.off { cursor: default; }
  .option.off:hover { background: none; }
  .option.off .title { color: var(--text-muted); }
  .title { font-size: var(--text-small); font-weight: var(--weight-medium); }
  .line { display: block; }
  .pill { font-size: 10px; font-weight: var(--weight-regular); color: var(--text-secondary); background: var(--tint-hover); padding: 2px 7px; border-radius: var(--radius-pill); white-space: nowrap; }
  .now { margin-left: 6px; }
  .log { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; font-size: var(--text-small); }
  .log li { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 10px; line-height: 1.45; }
  .when { color: var(--text-muted); font-size: var(--text-meta); }
  .note { flex: 1; margin: 0; line-height: 1.5; }
  .problem { color: var(--signal-urgent); }
</style>

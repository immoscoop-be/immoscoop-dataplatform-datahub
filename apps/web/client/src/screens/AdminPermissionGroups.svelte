<script lang="ts">
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import FactsList from '@datahub/ui/components/FactsList.svelte';
  import InPlaceHead from '@datahub/ui/components/InPlaceHead.svelte';
  import Callout from '@datahub/ui/containers/Callout.svelte';
  import EditBar from '@datahub/ui/containers/EditBar.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { day } from '@datahub/ui/foundations/when.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import { Refused } from '../lib/api.js';
  import type { Identity, PermissionGroup } from '../lib/identity.js';
  import { changedKeys, keysOf, PARTS, type PermissionKey, type Permissions, type PermissionSetting } from '../lib/permissions.js';
  import { permissionsSchema } from '@datahub/contracts/permissions';
  import NewPermissionGroupSheet from './NewPermissionGroupSheet.svelte';
  import PermissionRow from './PermissionRow.svelte';
  import { command, useScreenCommands } from '../lib/commands.svelte.js';
  import type { QuickRow } from '../lib/quick.js';

  /**
   * Permission groups, a tool of Admin (FR-PL-05, FR-PL-08 to FR-PL-11): the groups on the left, each with its
   * sentence, its number of Users and, for one, "Default for new Users"; "New Permission group" on top. One opened
   * shows on the right: its name and sentence to change in place, "Duplicate", its Users with the way to them on
   * Users, whether it is the default, and who changed it last; then its Permissions by part of Data Hub, in the order
   * of the rail. A change is marked until it is saved, and an edit bar on top, which stays in view, counts the
   * changes, says for how many Users they take effect, and saves or discards them all at once. Admin can do
   * everything and keeps it: its Permissions show locked, and it is neither changed nor deleted (DEC-UX-188).
   * Deleting another asks in place where its Users go; the group chosen becomes the default when the deleted one was.
   */
  let {
    identity,
    environment,
    usersHref,
    onusers,
    oncount,
  }: {
    identity: Pick<Identity, 'permissionGroups' | 'makePermissionGroup' | 'changePermissionGroup' | 'makeDefault' | 'deletePermissionGroup'>;
    /** The environment of Data Hub, such as uat. */
    environment: string;
    /** Users, when the User may open it. */
    usersHref?: string;
    /** The way to the Users of a group, on Users. */
    onusers?: (group: string) => void;
    /** How many Permission groups there are, for the panel of Admin. */
    oncount?: (count: number) => void;
  } = $props();

  let groups: PermissionGroup[] | null | undefined = $state();
  let openedId: string | undefined = $state();
  /** The Permissions of the group opened, as they are being changed. */
  let draft: Permissions | undefined = $state();
  let saving = $state(false);
  let problem = $state('');
  let deleting = $state(false);
  let moveTo = $state('');
  let deleteProblem = $state('');
  let defaultProblem = $state('');
  /** The sheet that makes a group: empty, or as a copy of the group "Duplicate" was pressed on. */
  let making: { from: string | null; name: string; sentence: string } | undefined = $state();

  async function load(open?: string) {
    try {
      const found = await identity.permissionGroups();
      groups = found;
      choose(found.find((group) => group.id === (open ?? openedId)) ?? found.find((group) => !group.locked) ?? found[0]);
    } catch (error) {
      console.error('The Permission groups could not be read', error);
      groups = null;
    }
  }
  $effect(() => {
    load();
  });
  $effect(() => {
    if (groups) oncount?.(groups.length);
  });

  function choose(group: PermissionGroup | undefined) {
    openedId = group?.id;
    draft = group ? structuredClone($state.snapshot(group.permissions) as Permissions) : undefined;
    [problem, deleting, deleteProblem, defaultProblem] = ['', false, '', ''];
  }

  const language = $derived(currentLanguage());
  const opened = $derived(groups?.find((group) => group.id === openedId));
  const changed: PermissionKey[] = $derived(opened && draft ? changedKeys(opened.permissions, draft) : []);
  const others = $derived((groups ?? []).filter((group) => group.id !== openedId));

  function set(key: PermissionKey, setting: PermissionSetting) {
    if (draft) draft = { ...draft, [key]: setting };
  }

  /** What identity refused, as a sentence: Admin locked, a name taken, a value it does not take, or anything else. */
  function refusal(error: unknown): string {
    const code = error instanceof Refused ? error.code : undefined;
    return t(code === 'locked' ? 'groups.locked' : code === 'name_taken' ? 'groups.nameTaken' : code === 'invalid_permissions' ? 'groups.invalid' : 'groups.failed');
  }

  /** Saves every change at once (FR-PL-09); identity checks each value against the catalogue too. */
  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!opened || !draft || changed.length === 0) return;
    if (!permissionsSchema.safeParse($state.snapshot(draft)).success) {
      problem = t('groups.invalid');
      return;
    }
    saving = true;
    problem = '';
    try {
      const saved = await identity.changePermissionGroup(opened.id, { permissions: $state.snapshot(draft) as Permissions });
      replace(saved);
      choose(saved);
    } catch (error) {
      console.error(`The Permissions of ${opened.name} could not be saved`, error);
      problem = refusal(error);
    }
    saving = false;
  }

  function replace(group: PermissionGroup) {
    groups = (groups ?? []).map((one) => (one.id === group.id ? group : one));
  }

  /** Renames it, or changes its sentence, in place. */
  async function rename(group: PermissionGroup, changes: { name?: string; description?: string }): Promise<string | undefined> {
    try {
      const saved = await identity.changePermissionGroup(group.id, {
        ...(changes.name === undefined ? {} : { name: changes.name }),
        ...(changes.description === undefined ? {} : { sentence: changes.description }),
      });
      replace({ ...saved, permissions: group.permissions });
      return undefined;
    } catch (error) {
      console.error(`${group.name} could not be renamed`, error);
      return refusal(error);
    }
  }

  /** Makes it the default for new Users, which the group before stops being (FR-PL-10). */
  async function makeDefault(group: PermissionGroup) {
    defaultProblem = '';
    try {
      await identity.makeDefault(group.id);
      await load(group.id);
    } catch (error) {
      console.error(`${group.name} could not be made the default`, error);
      defaultProblem = t('groups.failed');
    }
  }

  function startDeleting() {
    deleting = true;
    deleteProblem = '';
    moveTo = others.find((group) => !group.locked)?.id ?? '';
  }

  /** Deletes it, its Users going to the group chosen (FR-PL-10). */
  async function remove(group: PermissionGroup) {
    if (!moveTo) return;
    deleteProblem = '';
    try {
      await identity.deletePermissionGroup(group.id, moveTo);
      await load(moveTo);
    } catch (error) {
      console.error(`${group.name} could not be deleted`, error);
      deleteProblem = refusal(error);
    }
  }

  async function make(fields: { name: string; sentence: string; from: string | null }): Promise<string | undefined> {
    try {
      const made = await identity.makePermissionGroup(fields);
      making = undefined;
      await load(made.id);
      return undefined;
    } catch (error) {
      console.error(`The Permission group ${fields.name} could not be made`, error);
      return refusal(error);
    }
  }

  // In the quick window: a new Permission group, and for the one opened its copy, the default and deleting it (DEC-UX-240).
  useScreenCommands(() => {
    const rows: QuickRow[] = [command('permission-groups:new', 'plus', t('groups.new'), () => (making = { from: openedId ?? null, name: '', sentence: '' }), { words: t('quick.permissionGroups.new.words') })];
    const group = opened;
    if (group) {
      rows.push(command('permission-groups:copy', 'copy', t('quick.permissionGroups.copy', { name: group.name }), () => (making = { from: group.id, name: t('groups.copyName', { name: group.name }), sentence: group.sentence }), { words: t('quick.permissionGroups.copy.words') }));
      if (!group.isDefault && !group.locked) rows.push(command('permission-groups:default', 'check-circle', t('groups.default.make'), () => void makeDefault(group), { meta: group.name, words: t('quick.permissionGroups.default.words') }));
      if (!group.locked && !deleting) rows.push(command('permission-groups:delete', 'trash-fill', t('groups.delete', { name: group.name }), startDeleting, { meta: t('quick.permissionGroups.delete.meta'), words: t('quick.permissionGroups.delete.words') }));
    }
    return { group: 'Permission groups', rows };
  });
</script>

<Breadcrumb steps={[{ label: 'Admin' }]} />
<div class="head">
  <div class="what">
    <h1 class="page-title">Permission groups</h1>
    <p class="meta lead">{t('admin.groups.lead')}</p>
  </div>
  <Chip><Icon name="cloud-fill" />Data Hub {environment}</Chip>
</div>

{#if groups === null}
  <p class="meta problem">{t('admin.identityDown')}</p>
{:else if groups}
  <div class="centre">
    <section class="card list" aria-label="Permission groups">
      <div class="new">
        <Button variant="outline" onclick={() => (making = { from: openedId ?? null, name: '', sentence: '' })}><Icon name="plus" />{t('groups.new')}</Button>
      </div>
      {#each groups as group (group.id)}
        <button type="button" class="item" class:on={group.id === openedId} aria-pressed={group.id === openedId} onclick={() => group.id !== openedId && choose(group)}>
          <span class="item-icon" class:done={group.locked}><Icon name="shield-check-fill" /></span>
          <span>
            <b>{group.name}</b>{#if group.locked} <span class="lock"><Icon name="lock-simple-fill" label={t('groups.lockedSign')} /></span>{/if}
            <span class="meta line">{group.sentence}</span>
            <span class="sub">
              <span class="meta">{t('groups.users', { count: group.users })}</span>
              {#if group.isDefault}<span class="tag"><Icon name="user-plus" />{t('groups.default')}</span>{/if}
              {#if group.id === openedId && changed.length > 0}<span class="chg">{t('groups.changes', { count: changed.length })}</span>{/if}
            </span>
          </span>
        </button>
      {/each}
    </section>

    {#if opened && draft}
      {@const group = opened}
      {@const edited = draft}
      <section class="card detail" aria-label={t('groups.opened')}>
        <div class="detail-head">
          <span class="big"><Icon name="shield-check-fill" /></span>
          <div class="titles">
            {#key group.id}
              <InPlaceHead
                name={group.name}
                description={group.sentence}
                canEdit={!group.locked}
                level={2}
                nameLabel={t('groups.new.name')}
                descriptionLabel={t('groups.new.sentence')}
                nameMax={60}
                descriptionMax={200}
                onsave={(changes) => rename(group, changes)}
              />
            {/key}
          </div>
          <Button variant="outline" onclick={() => (making = { from: group.id, name: t('groups.copyName', { name: group.name }), sentence: group.sentence })}><Icon name="copy" />{t('groups.duplicate')}</Button>
        </div>
        <div class="facts">
          <FactsList>
            <dt>Users</dt>
            <dd>
              {group.users}{#if usersHref && group.users > 0} · <a class="text-link" href={usersHref} onclick={() => onusers?.(group.id)}>{t('groups.seeUsers')}</a>{/if}
            </dd>
            <dt>{t('groups.default')}</dt>
            <dd>
              {#if group.isDefault}
                {t('groups.default.yes', { name: group.name })}
              {:else}
                {t('groups.default.no')}{#if !group.locked} · <button type="button" class="text-link" onclick={() => makeDefault(group)}>{t('groups.default.make')}</button>{/if}
                {#if defaultProblem}<span class="warn" role="alert"> {defaultProblem}</span>{/if}
              {/if}
            </dd>
            <dt>{t('groups.lastChanged')}</dt>
            <dd>{group.updatedBy ? t('groups.lastChanged.by', { day: day(group.updatedAt, language), name: group.updatedBy }) : day(group.updatedAt, language)}</dd>
          </FactsList>
        </div>

        {#if group.locked}
          <Callout icon="lock-simple-fill">{t('groups.admin', { name: group.name })}</Callout>
        {/if}

        <form onsubmit={save}>
          {#if changed.length > 0}
            <div class="bar">
              <EditBar
                text={t('groups.edit', { count: changed.length, users: group.users, name: group.name })}
                cancelLabel={t('groups.discard')}
                saveLabel={t('groups.save')}
                {saving}
                oncancel={() => choose(group)}
              />
              {#if problem}<p class="warn" role="alert">{problem}</p>{/if}
            </div>
          {/if}

          {#each PARTS as part (part.id)}
            <section class="part" aria-label={t(part.title)}>
              <div class="part-head"><Icon name={part.icon} />{t(part.title)}</div>
              {#each keysOf(part.id) as key (key)}
                <PermissionRow {key} setting={edited[key]} saved={group.permissions[key]} locked={group.locked} group={group.id} groupName={group.name} onchange={(setting) => set(key, setting)} />
              {/each}
            </section>
          {/each}
        </form>

        {#if !group.locked}
          {#if deleting}
            <div class="delete">
              <div class="stop-row">
                <span class="sign"><Icon name="warning-fill" /></span>
                <span><b>{t('groups.delete.title', { name: group.name })}</b> {t(group.isDefault ? 'groups.delete.textDefault' : 'groups.delete.text', { count: group.users, name: group.name })}</span>
              </div>
              <div class="options" role="radiogroup" aria-label={t('groups.delete.to')}>
                {#each others as other (other.id)}
                  {#if other.locked}
                    <label class="off"><input type="radio" name="move-to" value={other.id} disabled />{t('groups.delete.admin', { name: other.name })}</label>
                  {:else}
                    <label><input type="radio" name="move-to" value={other.id} bind:group={moveTo} />{t('groups.delete.option', { name: other.name, count: other.users, sentence: other.sentence })}</label>
                  {/if}
                {/each}
              </div>
              <div class="delete-foot">
                <span class="warn" role={deleteProblem ? 'alert' : undefined}>{deleteProblem}</span>
                <Button variant="quiet" onclick={() => (deleting = false)}>{t('groups.delete.keep')}</Button>
                <Button variant="danger" disabled={!moveTo} onclick={() => remove(group)}>{t('groups.delete.make', { count: group.users })}</Button>
              </div>
            </div>
          {:else}
            <div class="foot">
              <p class="meta">{t(group.isDefault ? 'groups.delete.aboutDefault' : 'groups.delete.about', { name: group.name, count: group.users })}</p>
              <Button variant="quiet" onclick={startDeleting}><span class="danger"><Icon name="trash-fill" />{t('groups.delete', { name: group.name })}</span></Button>
            </div>
          {/if}
        {/if}
      </section>
    {/if}
  </div>
{:else}
  <Loading />
{/if}

{#if making && groups}
  {@const asked = making}
  <NewPermissionGroupSheet {groups} from={asked.from} name={asked.name} sentence={asked.sentence} onmake={make} onclose={() => (making = undefined)} />
{/if}

<style>
  .head { display: flex; align-items: flex-end; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
  .what { flex: 1; min-width: 280px; }
  .lead { display: block; margin-top: 4px; line-height: 1.5; max-width: 720px; }
  .problem { display: block; margin: 12px 0; }
  .card { border-radius: var(--radius-xl); background: var(--surface-solid); }
  .centre { display: grid; grid-template-columns: minmax(230px, 300px) minmax(0, 1fr); gap: 14px; margin-top: 14px; align-items: start; }
  .list { padding: 12px 8px 8px; }
  .new { display: flex; justify-content: flex-end; padding: 2px 4px 10px; }
  .item { all: unset; box-sizing: border-box; display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 10px; width: 100%; padding: 12px 12px 12px 10px; border-radius: var(--radius-md); cursor: pointer; font-size: var(--text-small); }
  .item:hover { background: var(--tint-hover); }
  .item.on { background: var(--surface-sub); }
  .item:focus-visible { outline: 2px solid var(--text-secondary); }
  .item b { font-weight: var(--weight-medium); }
  .item-icon { display: inline-flex; margin-top: 1px; font-size: 17px; color: var(--text-muted); }
  .item-icon.done { color: var(--text-secondary); }
  .lock { display: inline-flex; vertical-align: middle; font-size: 12px; color: var(--text-muted); }
  .line { display: block; }
  .sub { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; margin-top: 3px; }
  .tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: var(--radius-pill); background: var(--tint-hover); font-size: var(--text-meta); color: var(--text-secondary); }
  .chg { font-size: var(--text-meta); background: var(--surface-sub); color: var(--text-secondary); padding: 1px 8px; border-radius: var(--radius-pill); }
  .detail { min-width: 0; padding: 18px 20px 20px; }
  .detail-head { display: flex; align-items: center; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--tint-active); }
  .big { display: inline-flex; font-size: 26px; color: var(--text-secondary); }
  .titles { flex: 1; min-width: 0; }
  .facts { margin-top: 16px; }
  .text-link { all: unset; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
  .bar { position: sticky; top: 8px; z-index: 2; margin-top: 12px; border-radius: var(--radius-md); box-shadow: 0 0 0 1px var(--tint-active); background: var(--surface-solid); }
  .warn { color: var(--signal-urgent); font-size: var(--text-small); }
  .bar .warn { margin: 0; padding: 0 16px 10px; }
  .part { margin-top: 20px; }
  .part-head { display: flex; align-items: center; gap: 8px; padding: 0 4px 8px; border-bottom: 1px solid var(--tint-active); font-size: var(--text-small); font-weight: var(--weight-medium); color: var(--text-secondary); }
  .part-head :global(.icon) { font-size: 16px; }
  .foot { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--tint-active); }
  .foot .meta { flex: 1; min-width: 200px; margin: 0; }
  .danger { display: inline-flex; align-items: center; gap: 6px; color: var(--signal-urgent); }
  .delete { display: grid; gap: 10px; margin-top: 20px; padding: 14px 16px; border-radius: var(--radius-md); background: color-mix(in srgb, var(--signal-urgent) 8%, var(--surface-solid)); font-size: var(--text-small); line-height: 1.5; }
  .stop-row { display: flex; gap: 10px; }
  .stop-row b { font-weight: var(--weight-medium); }
  .sign { display: inline-flex; flex: none; color: var(--signal-urgent); font-size: 18px; }
  .options { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
  .options label { display: flex; align-items: flex-start; gap: 8px; cursor: pointer; }
  .options label.off { color: var(--text-muted); cursor: default; }
  .options input { margin: 3px 0 0; accent-color: var(--text-primary); }
  .delete-foot { display: flex; justify-content: flex-end; align-items: center; gap: 10px; }
  .delete-foot .warn { flex: 1; }
</style>

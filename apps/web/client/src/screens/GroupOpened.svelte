<script lang="ts">
  import FactsList from '@datahub/ui/components/FactsList.svelte';
  import InPlaceHead from '@datahub/ui/components/InPlaceHead.svelte';
  import Callout from '@datahub/ui/containers/Callout.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t, tParts } from '@datahub/ui/foundations/texts.svelte.js';
  import { day } from '@datahub/ui/foundations/when.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import { Refused } from '../lib/api.js';
  import type { Collection, OwnedCollection } from '../lib/catalogue.js';
  import { historyOf, type HistoryLine, listOf, listParts, losesIt, managerChoices, type ManagerChoice, managesItself, whenOf } from '../lib/groups.js';
  import type { GroupActor, GroupDetail, GroupSummary, Identity } from '../lib/identity.js';
  import { PERMISSION_TEXTS } from '../lib/permissions.js';
  import { collectionPath, groupPath } from '../lib/routes.js';
  import { command, place, useScreenCommands } from '../lib/commands.svelte.js';
  import type { QuickRow } from '../lib/quick.js';
  import GroupMembers from './GroupMembers.svelte';

  /**
   * One Group opened on Groups, on the right of the list (FR-UM-18, DEC-UX-202): its name and sentence, renamed in
   * place by whoever manages it; its facts; its members; the Group that manages it, as a choice; its history; and at
   * its foot what deleting it takes. A member who does not manage it sees it read-only, with the Group that manages
   * it and two of its members to ask. A User who changes it through Manage every group is told so (DEC-UX-201).
   */
  let {
    group,
    me,
    every,
    mine,
    all,
    owned,
    collections,
    askers,
    identity,
    onchanged,
    ondeleted,
  }: {
    group: GroupDetail;
    me: { sub: string; email: string; name: string };
    /** The User may change every Group (`groups.all.manage`). */
    every: boolean;
    /** The Groups the User is in, to choose who manages it. */
    mine: readonly GroupSummary[];
    /** Every Group, for a User with Manage every group, who may choose any of them. */
    all: readonly GroupSummary[] | null | undefined;
    /** The Collections it is the Owner Unit of that the User sees: undefined while they come, null when catalogue did not say. */
    owned: readonly OwnedCollection[] | null | undefined;
    /** Every Collection the User sees, for how many Resources one holds. */
    collections: readonly Collection[] | undefined;
    /** Two members of the Group that manages it, by name, for a User who does not manage it; undefined while they come. */
    askers: readonly string[] | undefined;
    identity: Pick<Identity, 'changeGroup' | 'addMember' | 'removeMember' | 'deleteGroup' | 'people'>;
    /** The Group as identity has it after a change; `membership` when the User's own Groups changed, `listing` when where it lists did. */
    onchanged: (group: GroupDetail, how?: { membership?: boolean; listing?: boolean }) => void;
    ondeleted: (group: GroupDetail) => void;
  } = $props();

  const language = $derived(currentLanguage());
  const itself = $derived(managesItself(group));
  /** Manage every group, by its name in the language of the User. */
  const everyName = $derived(t(PERMISSION_TEXTS['groups.all.manage'].name));

  /** What identity refused, as a sentence. */
  function refusal(error: unknown): string {
    const code = error instanceof Refused ? error.code : undefined;
    return t(code === 'name_taken' ? 'group.nameTaken' : error instanceof Refused && error.status === 400 ? 'group.invalid' : 'group.failed');
  }

  /** Renames it, or changes its sentence, in place (FR-UM-14). */
  async function rename(changes: { name?: string; description?: string }): Promise<string | undefined> {
    try {
      const saved = await identity.changeGroup(group.id, {
        ...(changes.name === undefined ? {} : { name: changes.name }),
        ...(changes.description === undefined ? {} : { sentence: changes.description }),
      });
      onchanged(saved);
      return undefined;
    } catch (error) {
      console.error(`${group.name} could not be renamed`, error);
      return refusal(error);
    }
  }

  // Managed by: the Group itself and the Groups the User is in; with Manage every group, any Group (FR-UM-14).
  const choices = $derived(managerChoices(group, every ? (all ?? mine) : mine, every));
  const current = $derived(choices.find((choice) => choice.now));
  /** The choice a User who would no longer manage it confirms first (OP-UX-71). */
  let pending: ManagerChoice | undefined = $state();
  /** The choice being saved, shown chosen until identity answers. */
  let trying: string | undefined = $state();
  let handing = $state(false);
  let byProblem = $state('');

  function choose(choice: ManagerChoice): void {
    byProblem = '';
    if (choice.now) {
      pending = undefined;
    } else if (losesIt(choice, every)) {
      pending = choice;
    } else {
      hand(choice);
    }
  }

  async function hand(choice: ManagerChoice): Promise<void> {
    handing = true;
    trying = choice.id;
    try {
      const saved = await identity.changeGroup(group.id, { managedBy: choice.id === 'itself' ? 'itself' : choice.id });
      pending = undefined;
      onchanged(saved, { listing: true });
    } catch (error) {
      console.error(`Who manages ${group.name} could not be changed`, error);
      byProblem = refusal(error);
    }
    [handing, trying] = [false, undefined];
  }

  /** The history, in lines, with the Groups known to name who it was first managed by. */
  const lines = $derived(historyOf(group, [{ id: group.managedBy.id, name: group.managedBy.name }, ...mine, ...(all ?? [])]));
  const byYou = (by: GroupActor) => by.id !== null && by.id === me.sub;
  const suffix = (by: GroupActor) => (byYou(by) ? t('group.log.byYou') : by.name ? t('group.log.by', { name: by.name }) : '');

  function lineOf(line: HistoryLine): string {
    switch (line.kind) {
      case 'made': {
        const by = byYou(line.by) ? t('group.log.you') : line.by.name;
        if (by) return line.itself ? t('group.log.madeByItself', { by }) : line.manager ? t('group.log.madeBy', { by, group: line.manager }) : t('group.log.madeByBare', { by });
        return line.itself ? t('group.log.madeItself') : line.manager ? t('group.log.made', { group: line.manager }) : t('group.log.madeBare');
      }
      case 'renamed':
        return t('group.log.renamed', { from: line.from, to: line.to }) + suffix(line.by);
      case 'sentence':
        return t('group.log.sentence', { to: line.to }) + suffix(line.by);
      case 'managedBy':
        return t('group.log.managedBy', { from: line.from, to: line.to }) + suffix(line.by);
      case 'added':
      case 'removed':
        return t(line.kind === 'added' ? 'group.log.added' : 'group.log.removed', { names: listOf(line.who, language) }) + suffix(line.by);
      case 'moved':
        return t('group.log.moved', { count: line.members });
      case 'deleted':
        return t('group.log.deleted') + suffix(line.by);
    }
  }

  // Deleting, at the foot (FR-UM-16): not while it owns Collections or manages other Groups.
  let deleting = $state(false);
  let deleteBusy = $state(false);
  let deleteProblem = $state('');
  /** What identity said it still has, when it refused to delete it. */
  let stillOwns: { collections: string[]; groups: string[] } | undefined = $state();
  const holds = $derived(stillOwns ?? { collections: (owned ?? []).map((one) => one.name), groups: group.manages.map((one) => one.name) });
  const blocked = $derived(holds.collections.length > 0 || holds.groups.length > 0);

  function holdsText(): string {
    const [collectionNames, groupNames] = [listOf(holds.collections, language), listOf(holds.groups, language)];
    if (holds.collections.length > 0 && holds.groups.length > 0) return t('group.delete.both', { name: group.name, collections: collectionNames, groups: groupNames });
    if (holds.collections.length > 0) return t('group.delete.owns', { name: group.name, collections: collectionNames, count: holds.collections.length });
    return t('group.delete.manages', { name: group.name, groups: groupNames, count: holds.groups.length });
  }

  async function remove(): Promise<void> {
    deleteBusy = true;
    deleteProblem = '';
    try {
      await identity.deleteGroup(group.id);
      ondeleted(group);
    } catch (error) {
      console.error(`${group.name} could not be deleted`, error);
      if (error instanceof Refused && error.code === 'still_owns') {
        const body = error.body ?? {};
        const names = (body.collections as { names?: unknown } | undefined)?.names;
        stillOwns = {
          collections: Array.isArray(names) ? names.map(String) : [],
          groups: Array.isArray(body.manages) ? body.manages.map(String) : [],
        };
        deleting = false;
      } else {
        deleteProblem = t('group.failed');
      }
    }
    deleteBusy = false;
  }

  /** How many Resources a Collection holds, when the User sees it in the list of Collections. */
  const resourcesOf = (id: string) => collections?.find((collection) => collection.id === id)?.resources.length;

  // In the quick window: who manages it, and deleting it for who may change it (DEC-UX-240).
  useScreenCommands((go) => {
    const rows: QuickRow[] = [];
    if (!itself) {
      const by = group.managedBy;
      rows.push(place('group:manager', 'users-three-fill', by.name, () => go(groupPath(by.id)), { meta: t('quick.group.manager.meta', { name: group.name }), words: t('quick.owner.words') }));
    }
    if (group.mayChange && owned !== undefined && !deleting) {
      rows.push(command('group:delete', 'trash-fill', t('group.delete', { name: group.name }), () => ([deleting, deleteProblem] = [true, '']), { meta: t('quick.group.delete.meta'), words: t('quick.group.delete.words'), ...(blocked ? { why: holdsText() } : {}) }));
    }
    return { group: t('quick.group.group'), where: `Groups · ${group.name}`, rows };
  });
</script>

<section class="card detail" aria-label={t('group.opened')}>
  <div class="detail-head">
    <span class="big"><Icon name="users-three-fill" /></span>
    <div class="titles">
      <InPlaceHead
        name={group.name}
        description={group.sentence}
        canEdit={group.mayChange}
        level={2}
        nameLabel={t('group.field.name')}
        descriptionLabel={t('group.field.sentence')}
        nameMax={80}
        descriptionMax={200}
        onsave={rename}
      />
    </div>
  </div>

  {#if group.mayChange && !group.managedBy.isMember}
    <!-- Changed through Manage every group, not as a member of the Group that manages it (DEC-UX-201). -->
    <Callout icon="shield-check-fill">
      {#each tParts(group.isMember ? 'group.everyMember' : 'group.every', { name: group.name, manager: group.managedBy.name }, { permission: everyName }) as part, index (index)}{#if 'name' in part}<b>{part.name}</b>{:else}{part.text}{/if}{/each}
    </Callout>
  {/if}

  <div class="facts">
    <FactsList>
      <dt>{t('group.fact.members')}</dt>
      <dd>{group.isMember ? t('group.fact.membersYou', { count: group.memberCount }) : group.memberCount}</dd>
      <dt>{t('group.fact.managedBy')}</dt>
      <dd>
        {#if itself}{t('group.fact.itself', { name: group.name })}{:else}<a class="text-link" href={groupPath(group.managedBy.id)}>{group.managedBy.name}</a>{/if}
        · {group.managedBy.isMember ? (itself ? t('group.fact.youManageItself') : t('group.fact.youManage', { name: group.name })) : t('group.fact.notIn')}
      </dd>
      <dt>{t('group.fact.owns')}</dt>
      <dd class:muted={owned === null || owned?.length === 0}>
        {#if owned === null}
          {t('group.fact.ownsFailed')}
        {:else if owned && owned.length === 0}
          {t('group.fact.noCollection')}
        {:else if owned}
          {@const count = owned.length === 1 ? resourcesOf(owned[0]!.id) : undefined}
          {#each listParts(owned.map((one) => one.name), language) as part, index (index)}{#if part.type === 'element'}<a class="text-link" href={collectionPath(owned[part.index]!.id)}>{part.value}</a>{:else}{part.value}{/if}{/each}{#if count !== undefined}, {t('group.fact.collectionWith', { count })}{/if}
        {/if}
      </dd>
      <dt>{t('group.fact.manages')}</dt>
      <dd class:muted={group.manages.length === 0}>
        {#if group.manages.length === 0}
          {t('group.fact.noGroup')}
        {:else}
          {#each listParts(group.manages.map((one) => one.name), language) as part, index (index)}{#if part.type === 'element'}<a class="text-link" href={groupPath(group.manages[part.index]!.id)}>{part.value}</a>{:else}{part.value}{/if}{/each}
        {/if}
      </dd>
      {#if group.mayChange}
        <dt>{t('group.fact.made')}</dt>
        <dd>{group.createdBy.name ? t('group.fact.madeBy', { day: day(group.createdAt, language), name: group.createdBy.name }) : day(group.createdAt, language)}</dd>
      {/if}
    </FactsList>
  </div>

  {#if !group.mayChange && askers}
    <!-- Only in it: who to ask to change it (FR-UM-18). -->
    <Callout icon="info-fill">
      {t(itself ? 'group.askItself' : 'group.ask', { name: group.name, manager: group.managedBy.name, names: listOf(askers, language, 'disjunction'), count: askers.length })}
    </Callout>
  {/if}

  <div class="label">{t('group.fact.members')}</div>
  <GroupMembers {group} {me} {identity} {onchanged} />

  {#if group.mayChange}
    <div class="label">{t('group.fact.managedBy')}</div>
    <p class="meta text">{t('group.by.text', { name: group.name })}</p>
    <div class="choices" role="radiogroup" aria-label={t('group.fact.managedBy')}>
      {#each choices as choice (choice.id)}
        <label class="option">
          <input type="radio" name="managed-by" value={choice.id} checked={(pending?.id ?? trying ?? current?.id) === choice.id} disabled={handing} onchange={() => choose(choice)} />
          <span>
            <span class="title">{choice.id === 'itself' ? t('group.fact.itself', { name: group.name }) : choice.name}{#if choice.now} <span class="pill now">{t('users.now')}</span>{/if}</span>
            <span class="meta line">
              {#if choice.id === 'itself'}
                {t('group.by.lineItself', { count: choice.memberCount ?? group.memberCount })}
              {:else if choice.memberCount !== null}
                {choice.isMember ? t('group.by.lineYou', { count: choice.memberCount }) : t('group.members', { count: choice.memberCount })}
              {/if}
            </span>
          </span>
        </label>
      {/each}
    </div>
    {#if pending}
      <!-- Choosing a Group the User is not in tells them first that they will no longer manage it (FR-UM-14). -->
      <div class="confirm" role="alert">
        <div class="stop-row">
          <span class="sign"><Icon name="warning-fill" /></span>
          <span>{t('group.by.loseItself', { name: group.name })}</span>
        </div>
        <div class="confirm-foot">
          <span class="warn">{byProblem}</span>
          <Button variant="quiet" onclick={() => (pending = undefined)}>{t('group.by.keep')}</Button>
          <Button disabled={handing} onclick={() => pending && hand(pending)}>{t('group.by.hand')}</Button>
        </div>
      </div>
    {:else}
      <p class="meta hint">
        {#if every}
          {t('group.by.every', { permission: everyName })}
        {:else}
          {t('group.by.hint')}{#if !group.isMember && current?.id !== 'itself'}{' '}{t('group.by.hintNotIn', { name: group.name })}{/if}
        {/if}
      </p>
      {#if byProblem}<p class="warn" role="alert">{byProblem}</p>{/if}
    {/if}

    <div class="label">{t('group.history')}</div>
    <ul class="log">
      {#each lines as line, index (index)}
        <li><span class="when">{whenOf(line.at, language)}</span><span>{lineOf(line)}</span></li>
      {:else}
        <li><span class="when"></span><span class="meta">{t('users.history.none')}</span></li>
      {/each}
    </ul>

    {#if deleting}
      <div class="delete">
        <div class="stop-row">
          <span class="sign"><Icon name="warning-fill" /></span>
          <span><b>{t('group.delete.title', { name: group.name })}</b> {t('group.delete.text', { count: group.memberCount })}</span>
        </div>
        <div class="confirm-foot">
          <span class="warn" role={deleteProblem ? 'alert' : undefined}>{deleteProblem}</span>
          <Button variant="quiet" onclick={() => (deleting = false)}>{t('group.delete.keep')}</Button>
          <Button variant="danger" disabled={deleteBusy} onclick={remove}>{t('group.delete.make')}</Button>
        </div>
      </div>
    {:else if owned !== undefined}
      <div class="foot">
        <p class="meta">{blocked ? holdsText() : t('group.delete.about', { name: group.name, count: group.memberCount })}</p>
        <Button variant="quiet" disabled={blocked} onclick={() => ([deleting, deleteProblem] = [true, ''])}><span class="danger" class:off={blocked}><Icon name="trash-fill" />{t('group.delete', { name: group.name })}</span></Button>
      </div>
    {/if}
  {/if}
</section>

<style>
  .card { border-radius: var(--radius-xl); background: var(--surface-solid); }
  .detail { min-width: 0; padding: 18px 20px 20px; }
  .detail-head { display: flex; align-items: center; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--tint-active); }
  .big { display: inline-flex; font-size: 26px; color: var(--text-secondary); }
  .titles { flex: 1; min-width: 0; }
  .facts { margin-top: 16px; }
  .muted { color: var(--text-muted); }
  .text-link { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
  .label { margin: 20px 0 6px; font-size: var(--text-meta); color: var(--text-muted); }
  .text { display: block; margin: 0 0 8px; line-height: 1.5; }
  .hint { display: block; margin: 6px 0 0; line-height: 1.5; }
  .choices { display: grid; gap: 4px; }
  .option { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 10px; align-items: start; padding: 10px 12px; border-radius: var(--radius-md); cursor: pointer; }
  .option:hover { background: var(--tint-hover); }
  .option:has(input:checked) { background: var(--surface-sub); outline: 1.5px solid var(--text-secondary); outline-offset: -1.5px; }
  .option input { margin: 3px 0 0; accent-color: var(--text-primary); }
  .title { font-size: var(--text-small); font-weight: var(--weight-medium); }
  .line { display: block; }
  .pill { font-size: 10px; font-weight: var(--weight-regular); color: var(--text-secondary); background: var(--tint-hover); padding: 2px 7px; border-radius: var(--radius-pill); white-space: nowrap; }
  .now { margin-left: 6px; }
  .log { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; font-size: var(--text-small); }
  .log li { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 10px; line-height: 1.45; }
  .when { color: var(--text-muted); font-size: var(--text-meta); }
  .warn { color: var(--signal-urgent); font-size: var(--text-small); }
  .foot { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--tint-active); }
  .foot .meta { flex: 1; min-width: 200px; margin: 0; line-height: 1.5; }
  .danger { display: inline-flex; align-items: center; gap: 6px; color: var(--signal-urgent); }
  .danger.off { color: inherit; }
  .delete, .confirm { display: grid; gap: 10px; margin-top: 20px; padding: 14px 16px; border-radius: var(--radius-md); font-size: var(--text-small); line-height: 1.5; }
  .delete { background: color-mix(in srgb, var(--signal-urgent) 8%, var(--surface-solid)); }
  .confirm { margin-top: 8px; background: var(--surface-sub); }
  .stop-row { display: flex; gap: 10px; }
  .stop-row b { font-weight: var(--weight-medium); }
  .sign { display: inline-flex; flex: none; color: var(--signal-urgent); font-size: 18px; }
  .confirm .sign { color: var(--signal-warn); }
  .confirm-foot { display: flex; justify-content: flex-end; align-items: center; gap: 10px; }
  .confirm-foot .warn { flex: 1; }
</style>

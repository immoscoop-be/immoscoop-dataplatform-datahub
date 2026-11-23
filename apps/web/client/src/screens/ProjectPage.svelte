<script lang="ts">
  import { tick } from 'svelte';
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import InPlaceHead from '@datahub/ui/components/InPlaceHead.svelte';
  import Callout from '@datahub/ui/containers/Callout.svelte';
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import Table from '@datahub/ui/containers/Table.svelte';
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago, day } from '@datahub/ui/foundations/when.js';
  import Avatar from '@datahub/ui/primitives/Avatar.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import Field from '@datahub/ui/primitives/Field.svelte';
  import IconButton from '@datahub/ui/primitives/IconButton.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import { NotFound as Missing } from '../lib/api.js';
  import { command, useScreenCommands } from '../lib/commands.svelte.js';
  import { modLabel, onMac } from '../lib/flags.js';
  import type { Person } from '../lib/identity.js';
  import { initialsOf } from '../lib/initials.js';
  import { keyAt, lastRunOf, putBack, readsOf } from '../lib/projectPage.js';
  import { isDeleted, moved, type Project, type ProjectMember, type ProjectPage, type ProjectQuery, type Projects } from '../lib/projects.js';
  import type { QuickRow } from '../lib/quick.js';
  import { queryPath } from '../lib/routes.js';
  import NotFound from './NotFound.svelte';
  import ProjectShare from './ProjectShare.svelte';

  /**
   * The page of a Project, in Query (FR-SR-63, FR-SR-65, FR-SR-66, FR-SR-68, FR-SR-69; DEC-UX-285), laid out as the page
   * of a folder of a Collection (DEC-UX-156):
   * - its head: its name and what it is for, changed in place by anyone in it (DEC-UX-162); Share, with the faces of who
   *   is in it (DEC-UX-286); and New query, which makes an empty query in it and opens it (DEC-UX-290, OP-UX-105). Its
   *   page open makes it the active Project, its row on top with this page as the details tab (DEC-UX-317);
   * - a line of facts: how many queries, how many people, who made it and when, and its last run, by whom;
   * - its queries in the one order of the row on top (OP-UX-95): the first ten with their key (DEC-UX-283), each with
   *   what it reads, who made it and its last run, marked as on its tab. A row is dragged by its handle, or moved with
   *   Alt and the arrow keys, for everyone in it. "Remove from project", always in view, takes a query out at once,
   *   without asking, with Undo under the list; it stays with whoever made it (DEC-UX-291, OP-UX-106). A query that
   *   reads a Resource the User may not see shows locked: its name, who made it, its last run and what they may not
   *   see, never its SQL (OP-UX-97);
   * - who is in it, each with who added them and how many of its queries they made, marked "cannot run queries" when
   *   their Permission group does not let them (OP-UX-98); Leave for oneself and × for the others;
   * - its Danger zone (DEC-UX-176): Leave it, and Delete it, in a sheet with an optional reason (OP-UX-100).
   * A User whose Permission group does not let them make queries reads it all, and changes neither its queries nor
   * their order. A Project just made says how to add a query; a deleted one says by whom, when and why. The quick
   * window holds every command of the page (DEC-UX-288).
   */
  let {
    id,
    projects,
    identity,
    me,
    canMake,
    onnewquery,
    onchanged,
    go,
  }: {
    id: string;
    projects: Projects;
    identity: { people(q: string): Promise<Person[]>; peopleByIds(ids: readonly string[]): Promise<Person[]> };
    me: { id: string; name: string };
    /** `queries.make`: otherwise its queries are read only, and their order too (OP-UX-98). */
    canMake: boolean;
    /** Makes an empty query in it and opens it (FR-SR-68). */
    onnewquery: () => Promise<void>;
    /** Anything of it changed: the row on top and the panel read it again. */
    onchanged: () => void;
    go: (path: string) => void;
  } = $props();

  const language = $derived(currentLanguage());
  const mac = onMac();

  /** The Project: undefined while it comes, null when there is none the User is in. */
  let page: ProjectPage | null | undefined = $state();
  let failed = $state(false);
  /** What identity knows of who is in it, by their ID. */
  let people: ReadonlyMap<string, Person> = $state(new Map());
  let sharing = $state(false);
  let deleting = $state(false);
  let reason = $state('');
  let busy = $state(false);
  let problem = $state('');
  let making = $state(false);
  /** The query just taken out, and its place, for Undo (OP-UX-106). */
  let removed: { query: ProjectQuery; at: number } | null = $state(null);
  /** The place of the row being dragged, and the one it is over. */
  let dragged: number | null = $state(null);
  let over: number | null = $state(null);
  let head: HTMLElement | undefined = $state();
  let list: HTMLElement | undefined = $state();
  let leaveButton: HTMLElement | undefined = $state();
  let deleteButton: HTMLElement | undefined = $state();

  async function load(): Promise<void> {
    const wanted = id;
    try {
      const found = await projects.get(wanted);
      if (wanted !== id) return;
      page = found;
      failed = false;
      if (!isDeleted(found)) {
        identity.peopleByIds(found.members.map((member) => member.id)).then(
          (known) => wanted === id && (people = new Map(known.flatMap((person) => (person.id ? [[person.id, person] as const] : [])))),
          (error: unknown) => console.error('Who is in the Project could not be read', error),
        );
      }
    } catch (error) {
      if (wanted !== id) return;
      if (error instanceof Missing) page = null;
      else {
        console.error(`The Project ${wanted} could not be read`, error);
        failed = true;
      }
    }
  }

  $effect(() => {
    void id;
    [page, removed, sharing, deleting, problem] = [undefined, null, false, false, ''];
    void load();
  });

  const project = $derived(page && !isDeleted(page) ? page : undefined);
  const deleted = $derived(page && isDeleted(page) ? page : undefined);
  const mine = $derived(people.get(me.id));
  const last = $derived(project ? lastRunOf(project.queries) : null);
  const locked = $derived(project?.queries.filter((query) => query.locked).length ?? 0);
  const others = $derived(project?.members.filter((member) => member.id !== me.id) ?? []);
  const madeByMe = $derived(project?.queries.filter((query) => query.owner.id === me.id).length ?? 0);
  /** Who changes the order and takes queries out: who may make queries (OP-UX-98). */
  const arranges = $derived(canMake);

  /** Something changed: the page and the row on top read it again. */
  async function changed(): Promise<void> {
    await load();
    onchanged();
  }

  /** Its name or what it is for, changed in place by anyone in it (DEC-UX-162). */
  async function rename(changes: { name?: string; description?: string }): Promise<string | undefined> {
    if (!project) return undefined;
    await projects.update(project.id, changes);
    await changed();
    return undefined;
  }

  /** The one order, for everyone in it (OP-UX-95): shown at once, then as query keeps it. */
  async function reorder(from: number, to: number): Promise<void> {
    if (!project || !arranges || from === to) return;
    const queries = moved(project.queries, from, to);
    page = { ...project, queries };
    try {
      await projects.order(project.id, queries.map((query) => query.id));
    } catch (error) {
      console.error('The order of the queries could not be kept', error);
      problem = t('project.failed');
    }
    await changed();
  }

  /** Alt with ↑ or ↓ on the handle of a row moves it, and the focus with it. */
  async function keyMove(event: KeyboardEvent, at: number): Promise<void> {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') || !project) return;
    event.preventDefault();
    const to = event.key === 'ArrowUp' ? at - 1 : at + 1;
    if (to < 0 || to >= project.queries.length) return;
    const promise = reorder(at, to);
    await tick();
    list?.querySelectorAll<HTMLElement>('[data-handle]')[to]?.focus();
    await promise;
  }

  /** Takes a query out at once, without asking; Undo puts it back (DEC-UX-291, OP-UX-106). */
  async function remove(query: ProjectQuery, at: number): Promise<void> {
    if (!project) return;
    problem = '';
    page = { ...project, queries: project.queries.filter((one) => one.id !== query.id) };
    removed = { query, at };
    try {
      await projects.removeQuery(project.id, query.id);
    } catch (error) {
      console.error(`${query.name} could not be taken out of the Project`, error);
      [removed, problem] = [null, t('project.failed')];
    }
    await changed();
  }

  async function undo(): Promise<void> {
    if (!project || !removed) return;
    const { query, at } = removed;
    removed = null;
    try {
      await projects.addQuery(project.id, query.id);
      const ids = putBack(
        project.queries.map((one) => one.id),
        query.id,
        at,
      );
      await projects.order(project.id, ids);
    } catch (error) {
      console.error(`${query.name} could not be put back in the Project`, error);
      problem = t('project.failed');
    }
    await changed();
  }

  async function takeOut(member: ProjectMember): Promise<void> {
    if (!project) return;
    problem = '';
    try {
      await projects.removeMember(project.id, member.id);
    } catch (error) {
      console.error(`${member.name} could not be taken out of the Project`, error);
      problem = t('project.failed');
    }
    await changed();
  }

  /** Leaves it: the others keep it; the last one out deletes it (OP-UX-100). */
  async function leave(): Promise<void> {
    if (!project || busy) return;
    busy = true;
    try {
      await projects.removeMember(project.id, me.id);
      onchanged();
      go('/query');
    } catch (error) {
      console.error('The Project could not be left', error);
      problem = t('project.failed');
    }
    busy = false;
  }

  /** Deletes it for everyone, with why, optional (OP-UX-100); the page then says so. */
  async function remove_(): Promise<void> {
    if (!project || busy) return;
    busy = true;
    problem = '';
    try {
      await projects.remove(project.id, reason.trim() || undefined);
      [deleting, reason] = [false, ''];
      await changed();
    } catch (error) {
      console.error('The Project could not be deleted', error);
      problem = t('project.delete.failed');
    }
    busy = false;
  }

  async function newQuery(): Promise<void> {
    if (making) return;
    making = true;
    try {
      await onnewquery();
    } catch (error) {
      console.error('No empty query could be made in the Project', error);
      problem = t('project.failed');
    }
    making = false;
  }

  /** What stands under the name of someone in it. */
  function sinceOf(member: ProjectMember): string {
    if (member.addedBy === null) return t('project.member.made', { day: day(member.addedAt, language) });
    return member.addedBy === me.name ? t('project.member.sinceByYou', { day: day(member.addedAt, language) }) : t('project.member.since', { day: day(member.addedAt, language), name: member.addedBy });
  }

  /** Who is told when it is deleted: the others, by name, or how many. */
  const toldNames = $derived(others.length <= 3 ? others.map((member) => member.name).join(', ') : t('project.delete.told.many', { count: others.length }));

  function focusOn(element: HTMLElement | undefined): void {
    element?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    element?.focus();
  }

  // The quick window holds every command of the page (FR-SR-69, DEC-UX-288).
  useScreenCommands(() => {
    const shown = project;
    if (!shown) return null;
    const name = shown.name;
    const rows: QuickRow[] = [];
    rows.push(command('project:share', 'share-network', t('project.quick.share', { name }), () => (sharing = true), { meta: t('project.quick.share.meta', { count: shown.members.length }), words: t('project.quick.share.words') }));
    if (canMake) rows.push(command('project:new', 'plus', t('project.quick.new', { name }), () => void newQuery(), { meta: t('project.quick.new.meta'), words: t('project.quick.new.words') }));
    rows.push(command('project:rename', 'pencil-simple', t('project.quick.rename', { name }), () => head?.querySelector<HTMLButtonElement>('button.in-place')?.click(), { meta: t('project.quick.rename.meta'), words: t('project.quick.rename.words') }));
    if (canMake && shown.queries.length > 1) {
      rows.push(command('project:order', 'dots-six-vertical', t('project.quick.order'), () => list?.querySelector<HTMLElement>('[data-handle]')?.focus(), { meta: t('project.quick.order.meta'), words: t('project.quick.order.words') }));
    }
    rows.push(command('project:leave', 'sign-out-fill', t('project.quick.leave', { name }), () => focusOn(leaveButton), { meta: t('project.quick.leave.meta'), words: t('project.quick.leave.words') }));
    rows.push(command('project:delete', 'trash', t('project.quick.delete', { name }), () => focusOn(deleteButton), { meta: t('project.quick.delete.meta'), words: t('project.quick.delete.words') }));
    return { group: t('project.quick.group'), where: `Query · ${name}`, rows };
  });
</script>

{#if page === null}
  <NotFound />
{:else if deleted}
  <!-- Deleted: its address says so, by whom, when and why; its queries stay with whoever made them (OP-UX-100). -->
  <Breadcrumb steps={[{ label: 'Query', href: '/query' }, { label: deleted.name }]} />
  <div class="head">
    <span class="icon large gone"><Icon name="folders-fill" /></span>
    <div class="what">
      <h1 class="page-title gone">{deleted.name}</h1>
      <p class="lead-text">{t('project.deleted')}</p>
    </div>
  </div>
  <Callout icon="trash-fill">
    <b>{deleted.deleted.reason ? t('project.deleted.by', { name: deleted.deleted.by ?? '', when: ago(deleted.deleted.at, language) }) : t('project.deleted.byNoReason', { name: deleted.deleted.by ?? '', when: ago(deleted.deleted.at, language) })}</b>
    {#if deleted.deleted.reason}“{deleted.deleted.reason}”{/if}
    {t('project.deleted.stay')}
    {#snippet action()}<button type="button" class="text-link" onclick={() => go('/query')}>{t('project.deleted.back')}</button>{/snippet}
  </Callout>
{:else if project}
  {@const shown = project}
  <Breadcrumb steps={[{ label: 'Query', href: '/query' }, { label: shown.name }]} />
  <div class="head">
    <span class="icon large"><Icon name="folders-fill" /></span>
    <div class="what" bind:this={head}>
      <!-- Its name and what it is for, changed in place by anyone in it (DEC-UX-162, DEC-UX-286). -->
      <InPlaceHead name={shown.name} description={shown.description} canEdit nameLabel={t('project.field.name')} descriptionLabel={t('project.field.description')} onsave={rename} />
    </div>
    <div class="actions">
      <Button variant="outline" title={t('project.share.hint')} onclick={() => (sharing = true)}>
        <span class="faces" aria-hidden="true">{#each shown.members.slice(0, 4) as member (member.id)}<Avatar initials={initialsOf(member.name)} size="mini" />{/each}</span>{t('project.share')}
      </Button>
      {#if canMake}
        <Button variant="outline" title={t('project.newQuery.hint', { name: shown.name })} disabled={making} onclick={newQuery}><Icon name="plus" />{t('project.newQuery')}</Button>
      {/if}
    </div>
  </div>
  <div class="status-row">
    <Chip><Icon name="table" />{shown.queries.length === 0 ? t('project.fact.none') : t('project.fact.queries', { count: shown.queries.length })}</Chip>
    <Chip><Icon name="users" />{shown.members.length === 1 ? t('project.fact.alone') : t('project.fact.people', { count: shown.members.length })}</Chip>
    <Chip>{shown.madeBy.id === me.id ? t('project.fact.madeByYou', { day: day(shown.createdAt, language) }) : t('project.fact.madeBy', { name: shown.madeBy.name, day: day(shown.createdAt, language) })}</Chip>
    {#if last}<Chip>{t('project.fact.lastRun', { when: ago(last.startedAt, language), name: last.userName })}</Chip>{/if}
  </div>

  {#if !canMake}
    <!-- In it all the same, told why (DEC-UX-286, OP-UX-98). -->
    <Callout icon="info-fill">
      <b>{t('project.readOnly.title')}</b>
      {mine?.permissionGroup ? t('project.readOnly.text', { group: mine.permissionGroup }) : t('project.readOnly.textNoGroup')}
      {#if locked > 0}{t('project.readOnly.locked', { count: locked })}{/if}
    </Callout>
  {/if}
  {#if failed || problem}<p class="problem" role="alert">{problem || t('project.failed')}</p>{/if}

  <div class="section-head">
    <h2>{t('project.queries')}</h2>
    {#if shown.queries.length > 0 && arranges}<span class="meta">{t('project.queries.hint')}</span>{/if}
  </div>
  {#if shown.queries.length === 0}
    <div class="empty card">
      <span class="empty-icon"><Icon name="folders-fill" /></span>
      <p>{t('project.empty')}<br />{canMake ? t('project.empty.how', { name: shown.name }) : t('project.empty.read')}</p>
      {#if canMake}<Button variant="outline" disabled={making} onclick={newQuery}><Icon name="plus" />{t('project.newQuery')}</Button>{/if}
    </div>
  {:else}
    <div class="queries" bind:this={list}>
      <Table label={t('project.queries')}>
        {#snippet head()}
          <tr>
            {#if arranges}<th><span class="hidden">{t('project.column.place')}</span></th>{/if}
            <th>{t('project.column.key')}</th>
            <th>{t('project.column.query')}</th>
            <th class="narrow">{t('project.column.reads')}</th>
            <th class="narrow">{t('project.column.madeBy')}</th>
            <th>{t('project.column.lastRun')}</th>
            {#if arranges}<th><span class="hidden">{t('project.remove')}</span></th>{/if}
          </tr>
        {/snippet}
        {#each shown.queries as query, at (query.id)}
          {@const key = keyAt(at)}
          {@const reads = readsOf(query.resources)}
          {@const movable = arranges && !query.locked}
          <tr
            class:locked={query.locked}
            class:dragging={dragged === at}
            class:before={over === at && dragged !== null && dragged > at}
            class:after={over === at && dragged !== null && dragged < at}
            draggable={movable ? 'true' : undefined}
            ondragstart={(event) => {
              if (!movable) return;
              dragged = at;
              event.dataTransfer?.setData('text/plain', query.id);
              if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
            }}
            ondragover={(event) => {
              if (dragged === null) return;
              event.preventDefault();
              over = at;
            }}
            ondragleave={() => over === at && (over = null)}
            ondrop={(event) => {
              event.preventDefault();
              const from = dragged;
              [dragged, over] = [null, null];
              if (from !== null) void reorder(from, at);
            }}
            ondragend={() => ([dragged, over] = [null, null])}
          >
            {#if arranges}
              <td class="drag">
                {#if movable}
                  <span class="handle" data-handle tabindex="0" role="button" aria-label={t('project.move')} title={t('project.move.hint')} onkeydown={(event) => keyMove(event, at)}><Icon name="dots-six-vertical" /></span>
                {/if}
              </td>
            {/if}
            <td class="key">{#if key}<span class="kbd">{modLabel(mac)}{key}</span>{:else}<span class="meta" title={t('project.noKey')}>—</span>{/if}</td>
            <td>
              <span class="cell">
                {#if query.locked}
                  <span class="kind"><Icon name="lock-simple" label={t('project.locked')} /></span>
                  <span><span class="title">{query.name}</span><span class="meta">{t('project.locked.text', { resources: (query.notSeen ?? []).join(', ') })}</span></span>
                {:else}
                  <span class="kind"><Icon name="table" /></span>
                  <span><a href={queryPath(query.id)}>{query.name}</a>{#if query.question}<span class="meta">{query.question}</span>{/if}</span>
                {/if}
              </span>
            </td>
            <td class="narrow">{#if query.locked}—{:else if reads}{reads.more > 0 ? t('project.reads.more', { name: reads.first, count: reads.more }) : reads.first}{:else}<span class="meta">{t('project.reads.none')}</span>{/if}</td>
            <td class="narrow nowrap">{query.owner.id === me.id ? t('project.you') : query.owner.name}</td>
            <td class="nowrap">
              <span class="marks">
                {#if query.lastRun}
                  <span>{t('project.lastRun', { when: ago(query.lastRun.startedAt, language), name: query.lastRun.userName })}</span>
                  {#if query.lastRun.state === 'running'}<span class="spin"><Icon name="circle-notch" label={t('project.mark.running')} /></span>{/if}
                  {#if query.lastRun.state === 'failed'}<span class="dot failed" role="img" aria-label={t('project.mark.failed')}></span>{/if}
                {:else}
                  <span class="meta">{t('project.never')}</span>
                {/if}
                {#if query.broken}<span class="broken"><Icon name="link-break" label={t('project.mark.broken')} /></span>{/if}
              </span>
            </td>
            {#if arranges}
              <td class="remove">
                {#if !query.locked}
                  <button
                    type="button"
                    class="remove-button"
                    aria-label={t('project.remove.label', { name: query.name, project: shown.name })}
                    title={query.owner.id === me.id ? t('project.remove.hintYou') : t('project.remove.hint', { name: query.owner.name })}
                    onclick={() => remove(query, at)}><Icon name="minus-circle" /><span class="remove-text">{t('project.remove')}</span></button
                  >
                {/if}
              </td>
            {/if}
          </tr>
        {/each}
      </Table>
    </div>
  {/if}
  {#if removed}
    <!-- Taken out without asking, as adding it again undoes it; Undo for a while (OP-UX-106). -->
    <div class="undo" role="status">
      <span class="undo-icon"><Icon name="minus-circle-fill" /></span>
      <p><b>{removed.query.name}</b> {removed.query.owner.id === me.id ? t('project.removed.textYou', { project: shown.name }) : t('project.removed.text', { project: shown.name, maker: removed.query.owner.name })}</p>
      <button type="button" class="text-link" onclick={undo}>{t('project.undo')}</button>
    </div>
  {/if}

  <div class="section-head">
    <h2>{t('project.members')}</h2>
    <Button variant="outline" onclick={() => (sharing = true)}><Icon name="user-plus" />{t('project.share')}</Button>
  </div>
  <div class="members card">
    {#each shown.members as member (member.id)}
      {@const person = people.get(member.id)}
      {@const self = member.id === me.id}
      <div class="member">
        <Avatar initials={initialsOf(member.name)} size="mini" />
        <span class="who">
          <span class="title">{member.name}{#if self}{' '}{t('project.member.you')}{/if}{#if person?.canQuery === false}{' '}<span class="pill warn"><Icon name="warning-fill" />{t('project.cannotRun')}</span>{/if}</span>
          <span class="meta">{sinceOf(member)}{#if member.queriesMade > 0}{' · '}{t('project.member.queries', { count: member.queriesMade })}{/if}</span>
          {#if person?.canQuery === false}<span class="meta note warn">{t('project.cannotRun.text', { group: person.permissionGroup ?? '' })}</span>{/if}
        </span>
        {#if self}
          <button type="button" class="text-link" onclick={() => focusOn(leaveButton)}>{t('project.member.leave')}</button>
        {:else}
          <IconButton icon="x" label={t('project.member.out', { name: member.name, project: shown.name })} onclick={() => takeOut(member)} />
        {/if}
      </div>
    {/each}
    {#if shown.members.length === 1}<p class="meta alone">{t('project.alone')}</p>{/if}
  </div>

  <!-- Its Danger zone (DEC-UX-176): Leave it, as the others keep it; and Delete it, for everyone (OP-UX-100). -->
  <div class="section-head"><h2>{t('project.danger')}</h2></div>
  <section class="danger">
    <div class="danger-head">
      <Icon name="sign-out-fill" />
      <div><h3>{t('project.leave.title')}</h3><p>{others.length === 0 ? t('project.leave.textLast') : t('project.leave.text')}</p></div>
    </div>
    <div class="danger-foot">
      <span class="meta">{t('project.leave.foot')}</span>
      <span bind:this={leaveButton} tabindex="-1" class="focus"><Button variant="outline" disabled={busy} onclick={leave}>{t('project.leave.button', { name: shown.name })}</Button></span>
    </div>
  </section>
  <section class="danger">
    <div class="danger-head">
      <Icon name="trash-fill" />
      <div><h3>{t('project.delete.title')}</h3><p>{t('project.delete.text')}</p></div>
    </div>
    <div class="does">
      <p class="line"><Icon name="folders-fill" /><span><b>{t('project.delete.gone.title', { count: shown.members.length })}</b> {t('project.delete.gone.text')}</span></p>
      <p class="line"><Icon name="table" /><span><b>{t('project.delete.stay.title', { count: shown.queries.length })}</b> {t('project.delete.stay.text')}</span></p>
      {#if others.length > 0}<p class="line"><Icon name="chat-circle-text-fill" /><span><b>{t('project.delete.told.title')}</b> {t('project.delete.told.text', { names: toldNames })}</span></p>{/if}
    </div>
    <div class="danger-foot">
      <span class="meta">{t('project.delete.foot')}</span>
      <span bind:this={deleteButton} tabindex="-1" class="focus"><Button variant="danger" onclick={() => (deleting = true)}><Icon name="trash-fill" />{t('project.delete.button')}</Button></span>
    </div>
  </section>

  {#if sharing}
    <ProjectShare
      project={shown}
      {people}
      {me}
      {projects}
      {identity}
      onchanged={changed}
      onleave={() => {
        sharing = false;
        focusOn(leaveButton);
      }}
      onclose={() => (sharing = false)}
    />
  {/if}
  {#if deleting}
    <Sheet title={t('project.delete.sheet')} roomy onclose={() => (deleting = false)}>
      {#snippet top()}<p class="meta over">{shown.name}</p>{/snippet}
      <p class="when">{t('project.delete.when')}</p>
      <div class="does">
        <p class="line"><Icon name="folders-fill" /><span><b>{t('project.delete.gone.title', { count: shown.members.length })}</b> {t('project.delete.gone.sheet')}</span></p>
        <p class="line"><Icon name="table" /><span><b>{t('project.delete.stay.title', { count: shown.queries.length })}</b> {#if madeByMe > 0}{t('project.delete.mine', { count: madeByMe })}{' '}{/if}{t('project.delete.stay.sheet')}</span></p>
        {#if others.length > 0}<p class="line"><Icon name="chat-circle-text-fill" /><span><b>{t('project.delete.told.sheet', { names: toldNames })}</b></span></p>{/if}
      </div>
      <div class="why">
        <Field label={t('project.delete.reason')}><textarea {...NO_PASSWORD_MANAGER} bind:value={reason} rows="3" maxlength="500" placeholder={t('project.delete.reason.placeholder')}></textarea></Field>
      </div>
      {#if problem}<p class="problem" role="alert">{problem}</p>{/if}
      {#snippet foot()}
        <span class="meta kept">{t('project.delete.foot')}</span>
        <Button variant="quiet" disabled={busy} onclick={() => (deleting = false)}>{t('project.delete.keep')}</Button>
        <Button variant="danger" disabled={busy} onclick={remove_}><Icon name="trash-fill" />{t('project.delete.forGood')}</Button>
      {/snippet}
    </Sheet>
  {/if}
{:else if failed}
  <p class="problem" role="alert">{t('project.failed')}</p>
{:else}
  <Loading />
{/if}

<style>
  b { font-weight: var(--weight-medium); color: var(--text-primary); }
  .head { display: flex; align-items: flex-start; gap: 14px; margin-top: 10px; }
  .icon { display: inline-flex; align-items: center; justify-content: center; flex: none; color: var(--text-secondary); }
  .icon.large { width: 44px; height: 44px; font-size: 26px; border-radius: var(--radius-md); background: var(--card); }
  .gone { color: var(--text-muted); }
  .what { flex: 1; min-width: 0; }
  .lead-text { margin: 6px 0 0; color: var(--text-secondary); }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: flex-end; flex: none; }
  .faces { display: inline-flex; align-items: center; margin-right: 2px; }
  .faces :global(.avatar) { margin-left: -6px; outline: 2px solid var(--surface-solid); }
  .faces :global(.avatar:first-child) { margin-left: 0; }
  .status-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
  .section-head { display: flex; align-items: baseline; gap: 12px; margin: 26px 0 12px; }
  .section-head h2 { font-size: var(--text-section); font-weight: var(--weight-medium); margin: 0; }
  .section-head .meta { flex: 1; }
  .section-head :global(.button) { margin-left: auto; }
  .meta { font-size: var(--text-meta); color: var(--text-muted); }
  .hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .queries :global(td) { padding-top: 9px; padding-bottom: 9px; }
  tr.dragging { opacity: var(--opacity-out-of-focus); }
  tr.before :global(td) { box-shadow: inset 0 2px 0 var(--text-primary); }
  tr.after :global(td) { box-shadow: inset 0 -2px 0 var(--text-primary); }
  tr.locked :global(td) { color: var(--text-muted); }
  .drag { width: 1%; }
  .handle { display: inline-flex; font-size: 15px; color: var(--text-muted); cursor: grab; border-radius: var(--radius-sm); }
  .handle:focus-visible { outline: 2px solid var(--text-secondary); outline-offset: 2px; }
  .key { width: 1%; white-space: nowrap; }
  .kbd { font-size: var(--text-meta); font-weight: var(--weight-medium); background: var(--tint-hover); border-radius: var(--radius-mark); padding: 1px 5px; }
  .cell { display: flex; align-items: center; gap: 9px; min-width: 0; }
  .kind { display: inline-flex; font-size: 16px; color: var(--text-secondary); flex: none; }
  tr.locked .kind { color: var(--text-muted); }
  .cell a { color: var(--text-primary); text-decoration: none; font-weight: var(--weight-medium); }
  .cell a:hover { text-decoration: underline; }
  .cell .title { font-weight: var(--weight-medium); }
  .cell .meta { display: block; font-weight: var(--weight-regular); }
  .nowrap { white-space: nowrap; }
  .marks { display: inline-flex; align-items: center; gap: 6px; }
  .dot { width: 7px; height: 7px; border-radius: var(--radius-pill); background: var(--text-primary); flex: none; }
  .dot.failed { background: var(--signal-urgent); }
  .broken { display: inline-flex; color: var(--signal-urgent); }
  .spin { display: inline-flex; color: var(--text-muted); animation: turn var(--motion-spin) infinite; }
  @keyframes turn { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
  .remove { width: 1%; }
  .remove-button { all: unset; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; font-size: var(--text-meta); color: var(--text-secondary); padding: 5px 9px; border-radius: var(--radius-sm); cursor: pointer; }
  .remove-button:hover { color: var(--text-primary); background: var(--tint-hover); }
  .remove-button:focus-visible { outline: 2px solid var(--text-secondary); }
  @media (max-width: 1100px) {
    .narrow { display: none; }
    .remove-text { display: none; }
  }
  .undo { position: sticky; bottom: 12px; z-index: 5; display: flex; align-items: center; gap: 12px; margin-top: 12px; padding: 12px 16px; border-radius: var(--radius-callout); background: var(--card); box-shadow: var(--sheet-shadow); }
  .undo p { flex: 1; margin: 0; font-size: var(--text-small); color: var(--text-secondary); }
  .undo-icon { display: inline-flex; font-size: 20px; color: var(--text-secondary); }
  .empty { padding: 26px 16px; border-radius: var(--radius-lg); text-align: center; color: var(--text-secondary); font-size: var(--text-small); line-height: 1.6; }
  .empty p { margin: 0 0 10px; }
  .empty-icon { display: block; font-size: 26px; color: var(--text-muted); margin-bottom: 6px; }
  .members { padding: 6px; border-radius: var(--radius-lg); }
  .member { display: flex; align-items: center; gap: 10px; padding: 8px 6px; border-radius: var(--radius-md); }
  .who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .who .title { font-size: var(--text-small); font-weight: var(--weight-medium); }
  .note { display: block; margin-top: 2px; line-height: 1.45; }
  .warn { color: var(--signal-warn); }
  .pill { display: inline-flex; align-items: center; gap: 4px; margin-left: 4px; font-size: 10px; font-weight: var(--weight-regular); padding: 2px 7px; border-radius: var(--radius-pill); white-space: nowrap; vertical-align: middle; }
  .pill.warn { color: var(--signal-warn); background: color-mix(in srgb, var(--signal-warn) 14%, transparent); }
  .alone { display: block; margin: 0; padding: 4px 6px 6px; line-height: 1.5; }
  .danger { margin-bottom: 12px; border-radius: var(--radius-lg); outline: 1px solid var(--tint-active); outline-offset: -1px; padding: 18px 20px; }
  .danger-head { display: flex; gap: 12px; align-items: flex-start; }
  .danger-head > :global(.icon) { font-size: 22px; color: var(--text-secondary); margin-top: 2px; flex: none; }
  h3 { margin: 0; font-size: var(--text-section); font-weight: var(--weight-medium); }
  .danger-head p { margin: 4px 0 0; font-size: var(--text-small); line-height: 1.55; color: var(--text-secondary); max-width: 720px; }
  .danger-foot { display: flex; align-items: center; gap: 12px; margin-top: 14px; }
  .danger-foot .meta { flex: 1; }
  .focus { display: inline-flex; border-radius: var(--radius-sm); }
  .focus:focus-visible { outline: 2px solid var(--text-secondary); outline-offset: 2px; }
  .does { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--tint-hover); }
  .line { display: flex; gap: 10px; align-items: flex-start; margin: 0; padding: 4px 0; font-size: var(--text-small); line-height: 1.55; color: var(--text-secondary); }
  .line > :global(.icon) { font-size: 16px; margin-top: 2px; flex: none; }
  .over { margin: 0 0 2px; }
  .when { margin: 12px 0 0; font-size: var(--text-small); line-height: 1.55; color: var(--text-secondary); }
  .why { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--tint-hover); }
  textarea { width: 100%; box-sizing: border-box; font: var(--text-small) var(--font-family); line-height: 1.5; color: var(--text-primary); background: var(--surface-solid); border: 1px solid var(--tint-active); border-radius: var(--radius-field); padding: 8px 10px; resize: vertical; }
  textarea:focus { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
  .kept { flex: 1; }
  .problem { margin: 10px 0 0; font-size: var(--text-small); color: var(--signal-urgent); }
  .text-link { all: unset; cursor: pointer; font-size: var(--text-small); color: var(--text-secondary); text-decoration: underline; text-underline-offset: 3px; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
</style>

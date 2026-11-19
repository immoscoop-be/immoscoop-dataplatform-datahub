<script lang="ts">
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { day } from '@datahub/ui/foundations/when.js';
  import Avatar from '@datahub/ui/primitives/Avatar.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import IconButton from '@datahub/ui/primitives/IconButton.svelte';
  import type { Person } from '../lib/identity.js';
  import { initialsOf } from '../lib/initials.js';
  import type { Project, ProjectMember, Projects } from '../lib/projects.js';

  /**
   * Share, a sheet over the page of a Project (DEC-UX-286, FR-SR-65): on top, what being in a Project means; a search
   * over the colleagues of Immoscoop who signed in, each with their address and Permission group. A colleague whose
   * Permission group does not let them make or run queries is added all the same, and Data Hub says so, "cannot run
   * queries" in the warning colour, with what it means for them (OP-UX-98). Then everyone in it, with who added them,
   * × to take them out and Leave for oneself. Whoever is added or taken out gets a Message (OP-UX-101).
   */
  let {
    project,
    people,
    me,
    projects,
    identity,
    onchanged,
    onleave,
    onclose,
  }: {
    project: Project;
    /** What identity knows of who is in it, by their ID: their Permission group, and whether they may run queries. */
    people: ReadonlyMap<string, Person>;
    me: { id: string; name: string };
    projects: Pick<Projects, 'addMember' | 'removeMember'>;
    identity: { people(q: string): Promise<Person[]> };
    /** Someone was added or taken out: the page reads the Project again. */
    onchanged: () => Promise<void> | void;
    /** Leave, for oneself: the sheet closes on the Danger zone, where leaving is done. */
    onleave: () => void;
    onclose: () => void;
  } = $props();

  const language = $derived(currentLanguage());
  let typed = $state('');
  let found: { for: string; people: Person[] } | undefined = $state();
  let busy = $state(false);
  let problem = $state('');

  const wanted = $derived(typed.trim());
  // identity suggests from two characters on, a moment after the User stops typing.
  $effect(() => {
    const q = wanted;
    if (q.length < 2) return;
    const timer = setTimeout(() => {
      identity.people(q).then(
        (suggested) => wanted === q && (found = { for: q, people: suggested.filter((person) => person.id) }),
        (error: unknown) => console.error('No colleagues could be suggested', error),
      );
    }, 200);
    return () => clearTimeout(timer);
  });
  const suggestions = $derived(wanted.length >= 2 && found?.for === wanted ? found.people : []);
  const inIt = (id: string | undefined) => id !== undefined && project.members.some((member) => member.id === id);

  async function add(person: Person): Promise<void> {
    if (!person.id || busy) return;
    busy = true;
    problem = '';
    try {
      await projects.addMember(project.id, { id: person.id, name: person.name, canQuery: person.canQuery ?? true });
      [typed, found] = ['', undefined];
      await onchanged();
    } catch (error) {
      console.error(`${person.name} could not be added to ${project.name}`, error);
      problem = t('project.failed');
    }
    busy = false;
  }

  async function takeOut(member: ProjectMember): Promise<void> {
    problem = '';
    try {
      await projects.removeMember(project.id, member.id);
      await onchanged();
    } catch (error) {
      console.error(`${member.name} could not be taken out of ${project.name}`, error);
      problem = t('project.failed');
    }
  }

  function keydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    // Enter adds the one colleague suggested who is not in it yet.
    const addable = suggestions.filter((person) => !inIt(person.id));
    if (addable.length === 1 && addable[0]) void add(addable[0]);
  }

  /** What stands under a name: who made it, or since when and who added them. */
  function sinceOf(member: ProjectMember): string {
    if (member.addedBy === null) return t('project.member.made', { day: day(member.addedAt, language) });
    return member.addedBy === me.name ? t('project.member.sinceByYou', { day: day(member.addedAt, language) }) : t('project.member.since', { day: day(member.addedAt, language), name: member.addedBy });
  }
</script>

<Sheet title={t('project.share.title')} {onclose}>
  {#snippet top()}<p class="meta over">{project.name}</p>{/snippet}
  {#snippet lead()}<span class="lead"><Icon name="share-network" /></span>{/snippet}
  <p class="what">{t('project.share.what')}</p>
  <div class="adding">
    <label class="add">
      <span class="glyph"><Icon name="user-plus" /></span>
      <input {...NO_PASSWORD_MANAGER} type="text" bind:value={typed} placeholder={t('project.share.add')} aria-label={t('project.share.add')} autocomplete="off" disabled={busy} onkeydown={keydown} data-autofocus />
    </label>
    {#if wanted.length >= 2 && found?.for === wanted}
      <div class="suggest">
        {#each suggestions as person (person.id)}
          {#if inIt(person.id)}
            <div class="person">
              <Avatar initials={initialsOf(person.name)} size="mini" />
              <span class="who"><span class="item-title">{person.name}</span><span class="meta">{person.email}{person.permissionGroup ? ` · ${person.permissionGroup}` : ''}</span></span>
              <span class="pill">{t('project.share.already')}</span>
            </div>
          {:else}
            <button type="button" class="person pick" disabled={busy} onclick={() => add(person)}>
              <Avatar initials={initialsOf(person.name)} size="mini" />
              <span class="who">
                <span class="item-title">{person.name}{#if person.canQuery === false}{' '}<span class="pill warn"><Icon name="warning-fill" />{t('project.cannotRun')}</span>{/if}</span>
                <span class="meta">{person.email}{person.permissionGroup ? ` · ${person.permissionGroup}` : ''}</span>
                {#if person.canQuery === false}<span class="meta note warn">{t('project.cannotRun.add', { group: person.permissionGroup ?? '' })}</span>{/if}
              </span>
              <span class="plus"><Icon name="plus" /></span>
            </button>
          {/if}
        {:else}
          <p class="meta none">{t('project.share.none')}</p>
        {/each}
        <p class="meta note">{t('project.share.note')}</p>
      </div>
    {/if}
  </div>
  {#if problem}<p class="problem" role="alert">{problem}</p>{/if}

  <p class="label">{t('project.share.in', { count: project.members.length })}</p>
  <div class="members">
    {#each project.members as member (member.id)}
      {@const person = people.get(member.id)}
      {@const mine = member.id === me.id}
      <div class="member">
        <Avatar initials={initialsOf(member.name)} size="mini" />
        <span class="who">
          <span class="item-title">{member.name}{#if mine}{' '}{t('project.member.you')}{/if}{#if person?.canQuery === false}{' '}<span class="pill warn"><Icon name="warning-fill" />{t('project.cannotRun')}</span>{/if}</span>
          <span class="meta">{sinceOf(member)}</span>
        </span>
        {#if mine}
          <button type="button" class="text-link" onclick={onleave}>{t('project.member.leave')}</button>
        {:else}
          <IconButton icon="x" label={t('project.member.out', { name: member.name, project: project.name })} onclick={() => takeOut(member)} />
        {/if}
      </div>
    {/each}
  </div>
  {#snippet foot()}
    <span class="meta told">{t('project.share.foot')}</span>
    <Button onclick={onclose}>{t('project.share.done')}</Button>
  {/snippet}
</Sheet>

<style>
  .over { margin: 0 0 2px; }
  .lead { display: inline-flex; font-size: 22px; color: var(--text-secondary); }
  .what { margin: 6px 0 4px; font-size: var(--text-small); line-height: 1.55; color: var(--text-secondary); }
  .adding { position: relative; margin: 10px 0 6px; }
  .add { display: flex; align-items: center; gap: 8px; border-radius: var(--radius-field); padding: 9px 12px; background: var(--surface-sub); color: var(--text-muted); }
  .glyph { display: inline-flex; font-size: 15px; }
  .add input { all: unset; flex: 1; min-width: 0; font: var(--text-small) var(--font-family); color: var(--text-primary); }
  .add input::placeholder { color: var(--text-muted); }
  .add:focus-within { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
  .suggest { margin-top: 6px; padding: 6px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .person { box-sizing: border-box; display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 6px; border-radius: var(--radius-md); }
  .pick { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 6px; border-radius: var(--radius-md); cursor: pointer; }
  .pick:hover, .pick:focus-visible { background: var(--tint-hover); }
  .plus { display: inline-flex; color: var(--text-muted); }
  .who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .item-title { font-size: var(--text-small); font-weight: var(--weight-medium); }
  .meta { font-size: var(--text-meta); color: var(--text-muted); }
  .note { display: block; margin-top: 2px; line-height: 1.45; }
  .suggest > .note, .none { padding: 6px 6px 2px; margin: 0; line-height: 1.5; }
  .warn { color: var(--signal-warn); }
  .pill { display: inline-flex; align-items: center; gap: 4px; margin-left: 4px; font-size: 10px; font-weight: var(--weight-regular); color: var(--text-secondary); background: var(--tint-hover); padding: 2px 7px; border-radius: var(--radius-pill); white-space: nowrap; vertical-align: middle; }
  .pill.warn { color: var(--signal-warn); background: color-mix(in srgb, var(--signal-warn) 14%, transparent); }
  .label { margin: 16px 0 4px; font-size: var(--text-meta); color: var(--text-muted); }
  .members { display: grid; }
  .member { display: flex; align-items: center; gap: 10px; padding: 8px 6px; border-radius: var(--radius-md); }
  .problem { margin: 4px 0; color: var(--signal-urgent); font-size: var(--text-small); }
  .told { flex: 1; }
  .text-link { all: unset; cursor: pointer; font-size: var(--text-small); color: var(--text-secondary); text-decoration: underline; text-underline-offset: 3px; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
</style>

<script lang="ts">
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago, day } from '@datahub/ui/foundations/when.js';
  import Avatar from '@datahub/ui/primitives/Avatar.svelte';
  import IconButton from '@datahub/ui/primitives/IconButton.svelte';
  import { Refused } from '../lib/api.js';
  import { initialsOfMember, isAddress } from '../lib/groups.js';
  import type { GroupDetail, GroupMember, Identity, Person } from '../lib/identity.js';

  /**
   * The members of a Group opened (FR-UM-15): each with their name, address and since when; "has not signed in yet"
   * for a colleague added by address before their first sign-in (OP-UX-70), greyed with "cannot sign in" for one who
   * left. Whoever manages it adds a colleague from a field above the list, which suggests while typing, by name or
   * address; the colleague is in it at once, marked "added by you". A cross takes someone out.
   */
  let {
    group,
    me,
    identity,
    onchanged,
  }: {
    group: GroupDetail;
    me: { sub: string; email: string; name: string };
    identity: Pick<Identity, 'addMember' | 'removeMember' | 'people'>;
    onchanged: (group: GroupDetail, how?: { membership?: boolean }) => void;
  } = $props();

  const language = $derived(currentLanguage());
  const mine = (email: string) => email.toLowerCase() === me.email.toLowerCase();

  let typed = $state('');
  /** The colleagues whose name or address holds what was typed, for what was typed. */
  let found: { for: string; people: Person[] } | undefined = $state();
  let suggesting = $state(false);
  let busy = $state(false);
  let problem = $state('');
  /** The addresses added here, which their row marks "added by you". */
  let addedHere: string[] = $state([]);

  const wanted = $derived(typed.trim());
  // identity suggests from two characters on, a moment after the User stops typing.
  $effect(() => {
    const q = wanted;
    if (q.length < 2) return;
    const timer = setTimeout(() => {
      identity.people(q).then(
        (people) => wanted === q && (found = { for: q, people }),
        (error: unknown) => console.error('No colleagues could be suggested', error),
      );
    }, 200);
    return () => clearTimeout(timer);
  });

  /** The suggestions: the colleagues found, and what was typed when it is an address no colleague has yet (OP-UX-70). */
  const suggestions = $derived.by(() => {
    if (wanted.length < 2) return [];
    const people = found?.for === wanted ? found.people : [];
    const address = wanted.toLowerCase();
    return isAddress(wanted) && !people.some((person) => person.email === address) ? [...people, { email: address, name: '' }] : people;
  });
  const memberOf = (email: string): GroupMember | undefined => group.members.find((member) => member.email === email.toLowerCase());

  async function add(email: string): Promise<void> {
    busy = true;
    problem = '';
    try {
      const saved = await identity.addMember(group.id, email);
      addedHere = [...addedHere.filter((one) => one !== email.toLowerCase()), email.toLowerCase()];
      [typed, found, suggesting] = ['', undefined, false];
      onchanged(saved, { membership: mine(email) });
    } catch (error) {
      console.error(`${email} could not be added to ${group.name}`, error);
      problem = t(error instanceof Refused && error.code === 'invalid_email' ? 'group.add.invalid' : 'group.failed');
    }
    busy = false;
  }

  async function remove(member: GroupMember): Promise<void> {
    problem = '';
    try {
      const saved = await identity.removeMember(group.id, member.email);
      addedHere = addedHere.filter((one) => one !== member.email);
      onchanged(saved, { membership: mine(member.email) });
    } catch (error) {
      console.error(`${member.email} could not be taken out of ${group.name}`, error);
      problem = t('group.failed');
    }
  }

  function keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      suggesting = false;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      // Enter adds the one colleague suggested, or the address typed.
      const addable = suggestions.filter((person) => !memberOf(person.email));
      const chosen = addable.find((person) => person.email === wanted.toLowerCase()) ?? (addable.length === 1 ? addable[0] : undefined);
      if (chosen && !busy) add(chosen.email);
    } else {
      suggesting = true;
    }
  }

  /** What stands under a member's name: their address, whether they signed in, and since when, for whoever manages it. */
  function metaOf(member: GroupMember): string {
    return [
      member.name ? member.email : null,
      member.signedIn ? null : t('group.add.pending'),
      group.mayChange ? (addedHere.includes(member.email) ? ago(member.addedAt, language) : t('group.member.since', { day: day(member.addedAt, language) })) : null,
    ]
      .filter((part) => part !== null)
      .join(' · ');
  }
</script>

{#if group.mayChange}
  <div class="adding" onfocusout={(event) => !event.currentTarget.contains(event.relatedTarget as Node | null) && (suggesting = false)}>
    <label class="add">
      <span class="glyph"><Icon name="user-plus" /></span>
      <input {...NO_PASSWORD_MANAGER} type="text" bind:value={typed} placeholder={t('group.add')} aria-label={t('group.add')} autocomplete="off" disabled={busy} onkeydown={keydown} onfocus={() => (suggesting = true)} />
    </label>
    {#if suggesting && wanted.length >= 2}
      <!-- Suggestions while typing (FR-UM-15). -->
      <div class="suggest">
        {#each suggestions as person (person.email)}
          {@const member = memberOf(person.email)}
          {#if member}
            <div class="person">
              <Avatar initials={initialsOfMember(person.name || null, person.email)} size="mini" />
              <span class="who"><span class="item-title">{person.name || person.email}</span><span class="meta">{person.email}</span></span>
              <span class="pill">{t(addedHere.includes(member.email) ? 'group.add.added' : 'group.add.in')}</span>
            </div>
          {:else}
            <button type="button" class="person pick" disabled={busy} onclick={() => add(person.email)}>
              <Avatar initials={initialsOfMember(person.name || null, person.email)} size="mini" />
              <span class="who">
                <span class="item-title">{person.name || person.email}</span>
                <span class="meta">{person.name ? person.email : t('group.add.pending')}</span>
              </span>
              <span class="plus"><Icon name="plus" /></span>
            </button>
          {/if}
        {/each}
        <p class="meta note">{t('group.add.note')}</p>
      </div>
    {/if}
  </div>
  {#if problem}<p class="warn" role="alert">{problem}</p>{/if}
{/if}

<div class="members">
  {#each group.members as member (member.email)}
    <div class="member" class:gone={!member.active}>
      <Avatar initials={initialsOfMember(member.name, member.email)} size="mini" />
      <span class="who">
        <span class="item-title">
          {member.name ?? member.email}
          {#if mine(member.email)}<span class="pill">{t('users.you')}</span>{/if}
          {#if !member.active}<span class="pill">{t('admin.users.gone')}</span>{/if}
          {#if addedHere.includes(member.email)}<span class="chg">{t('group.member.addedByYou')}</span>{/if}
        </span>
        <span class="meta">{metaOf(member)}</span>
      </span>
      {#if group.mayChange}
        <IconButton icon="x" label={t('group.member.out', { name: member.name ?? member.email, group: group.name })} onclick={() => remove(member)} />
      {/if}
    </div>
  {/each}
</div>
{#if group.mayChange}<p class="meta note">{t('group.member.note')}</p>{/if}

<style>
  .adding { position: relative; margin: 6px 0 4px; }
  .add { display: flex; align-items: center; gap: 8px; border-radius: var(--radius-field); padding: 9px 12px; background: var(--card); color: var(--text-muted); }
  .glyph { display: inline-flex; font-size: 15px; }
  .add input { all: unset; flex: 1; min-width: 0; font: var(--text-small) var(--font-family); color: var(--text-primary); }
  .add input::placeholder { color: var(--text-muted); }
  .add:focus-within { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
  .suggest { position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 5; padding: 6px; border-radius: var(--radius-md); background: var(--surface-solid); box-shadow: var(--sheet-shadow); }
  .person { box-sizing: border-box; display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 6px; border-radius: var(--radius-md); font: inherit; color: inherit; text-align: left; }
  .pick { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 6px; border-radius: var(--radius-md); cursor: pointer; }
  .pick:hover, .pick:focus-visible { background: var(--tint-hover); }
  .plus { display: inline-flex; color: var(--text-muted); }
  .members { display: grid; }
  .member { display: flex; align-items: center; gap: 10px; padding: 8px 6px; border-radius: var(--radius-md); }
  .who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .item-title { font-size: var(--text-small); font-weight: var(--weight-medium); }
  .gone, .gone .item-title { color: var(--text-muted); }
  .pill { margin-left: 4px; font-size: 10px; font-weight: var(--weight-regular); color: var(--text-secondary); background: var(--tint-hover); padding: 2px 7px; border-radius: var(--radius-pill); white-space: nowrap; }
  .chg { margin-left: 4px; font-size: var(--text-meta); font-weight: var(--weight-regular); background: var(--surface-sub); color: var(--text-secondary); padding: 1px 8px; border-radius: var(--radius-pill); white-space: nowrap; }
  .note { display: block; margin: 6px 0 0; line-height: 1.5; }
  .suggest .note { padding: 6px 6px 2px; margin: 0; }
  .warn { margin: 4px 0; color: var(--signal-urgent); font-size: var(--text-small); }
</style>

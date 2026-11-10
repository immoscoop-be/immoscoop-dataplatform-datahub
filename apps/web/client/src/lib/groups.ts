import type { Language } from '@datahub/ui/foundations/texts.svelte.js';
import { ago, day } from '@datahub/ui/foundations/when.js';
import type { GroupActor, GroupDetail, GroupLogEntry, GroupMember, GroupSummary } from './identity.js';
import { initialsOf } from './initials.js';

/**
 * What the page Groups works out from what identity tells (FR-UM-12 to FR-UM-18): how the User stands to a Group, what
 * a Group owns and manages, who may manage it, its history in lines, and whom to ask. Data only: the screens put it
 * into sentences.
 */

/** A Group manages itself when it is its own managing Group (OP-UX-71). */
export const managesItself = (group: Pick<GroupSummary, 'id' | 'managedBy'>): boolean => group.managedBy.id === group.id;

/** A Group of the User: they are in it, or in the Group that manages it. */
export const isYours = (group: GroupSummary): boolean => group.isMember || group.managedBy.isMember;

/** A tag for how the User stands to a Group: in it, it manages itself, or they manage it through another Group. */
export type Tag = { readonly kind: 'in' } | { readonly kind: 'itself' } | { readonly kind: 'through'; readonly manager: string };

/**
 * The tags of a Group in the list (FR-UM-18): "You are in it" for a member; "It manages itself" for a Group the User
 * is in that manages itself, so that they manage it; "You manage it, through …" for a Group whose managing Group the
 * User is in. A Group of others has none, also one the User changes with Manage every group.
 */
export function tagsOf(group: GroupSummary): Tag[] {
  const itself = managesItself(group);
  return [
    ...(group.isMember ? [{ kind: 'in' } as const] : []),
    ...(itself && group.isMember ? [{ kind: 'itself' } as const] : []),
    ...(!itself && group.managedBy.isMember ? [{ kind: 'through', manager: group.managedBy.name } as const] : []),
  ];
}

/**
 * The Groups a Group manages: from its detail once it was read, which knows them all, or else from the Groups listed
 * that name it as their manager.
 */
export function managedBy(group: Pick<GroupSummary, 'id'>, known: readonly GroupSummary[], detail?: Pick<GroupDetail, 'manages'>): { id: string; name: string }[] {
  if (detail) return detail.manages;
  // A Group may be known twice, among the User's and among every Group.
  const managed = known.filter((other) => other.id !== group.id && other.managedBy.id === group.id);
  return [...new Map(managed.map(({ id, name }) => [id, { id, name }])).values()];
}

/** Whether a Group answers a search: its name or sentence, or a colleague in it by name or address, once its members are read. */
export function matches(group: GroupSummary, words: string, detail?: Pick<GroupDetail, 'members'>): boolean {
  const wanted = words.trim().toLowerCase();
  if (!wanted) return true;
  const texts = [group.name, group.sentence, ...(detail?.members.flatMap((member) => [member.name ?? '', member.email]) ?? [])];
  return texts.some((text) => text.toLowerCase().includes(wanted));
}

/** A Group that may manage another, as the choice Managed by lists it. */
export interface ManagerChoice {
  /** The Group, or `itself` for the Group being managed. */
  readonly id: string | 'itself';
  readonly name: string;
  /** Unknown for the managing Group of now when it is not among the Groups the User may choose. */
  readonly memberCount: number | null;
  readonly isMember: boolean;
  readonly now: boolean;
}

/**
 * The choice Managed by of a Group (FR-UM-14, OP-UX-71): the Group itself and the Groups the User is in; with Manage
 * every group, any Group, those the User is in first. The Group that manages it now comes first, then the Group
 * itself, then the others by name.
 */
export function managerChoices(group: GroupSummary, candidates: readonly GroupSummary[], every: boolean): ManagerChoice[] {
  const itself: ManagerChoice = { id: 'itself', name: group.name, memberCount: group.memberCount, isMember: group.isMember, now: managesItself(group) };
  const others = candidates
    .filter((one) => one.id !== group.id && (every || one.isMember))
    .toSorted((one, other) => Number(other.isMember) - Number(one.isMember) || one.name.localeCompare(other.name))
    .map((one): ManagerChoice => ({ id: one.id, name: one.name, memberCount: one.memberCount, isMember: one.isMember, now: one.id === group.managedBy.id }));
  const current = managesItself(group)
    ? itself
    : (others.find((one) => one.now) ?? { id: group.managedBy.id, name: group.managedBy.name, memberCount: null, isMember: group.managedBy.isMember, now: true });
  return [current, ...(current === itself ? [] : [itself]), ...others.filter((one) => one !== current)];
}

/** Choosing this Group to manage another leaves the User unable to change it: they are not in it, and may not change every Group. */
export const losesIt = (choice: ManagerChoice, every: boolean): boolean => !every && !choice.isMember;

/** The choices of a new Group (FR-UM-13): the Groups the User is in, by name, and the new Group itself last. */
export function newManagerChoices(mine: readonly GroupSummary[]): { id: string | 'itself'; name: string; memberCount: number }[] {
  return [
    ...mine
      .filter((one) => one.isMember)
      .toSorted((one, other) => one.name.localeCompare(other.name))
      .map((one) => ({ id: one.id, name: one.name, memberCount: one.memberCount })),
    { id: 'itself', name: '', memberCount: 1 },
  ];
}

/** One line of the history of a Group, as it shows: several members added or taken out at once, by one person within minutes, are one line. */
export type HistoryLine =
  | { readonly kind: 'made'; readonly at: string; readonly by: GroupActor; readonly manager: string | null; readonly itself: boolean }
  | { readonly kind: 'renamed' | 'sentence' | 'managedBy'; readonly at: string; readonly by: GroupActor; readonly from: string; readonly to: string }
  | { readonly kind: 'added' | 'removed'; readonly at: string; readonly by: GroupActor; readonly who: readonly string[] }
  | { readonly kind: 'moved'; readonly at: string; readonly members: number }
  | { readonly kind: 'deleted'; readonly at: string; readonly by: GroupActor };

/** Two moments close enough to be one change. */
const within = (one: string, other: string, ms: number) => Math.abs(Date.parse(one) - Date.parse(other)) <= ms;
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * The history of a Group in lines, newest first (FR-UM-17). A member is named by their name once they signed in, or
 * by their address; the maker joining their new Group at the moment it is made is part of "Made". The Group that
 * made it manage is named from the Groups known, as the log keeps it by id.
 */
export function historyOf(group: Pick<GroupDetail, 'id' | 'name' | 'members' | 'log'>, known: readonly { id: string; name: string }[] = []): HistoryLine[] {
  const nameOf = (email: string) => group.members.find((member) => member.email === email)?.name ?? email;
  /** The maker, added as its first member when the Group is made: logged next to "made", by the same person, about themselves. */
  const makerJoining = (entry: GroupLogEntry, index: number) =>
    entry.kind === 'added' &&
    [group.log[index - 1], group.log[index + 1]].some((next) => next?.kind === 'made' && next.by.id === entry.by.id && within(next.at, entry.at, 60_000)) &&
    entry.by.name !== null &&
    nameOf(text(entry.detail.email)) === entry.by.name;
  const lines: HistoryLine[] = [];
  group.log.forEach((entry: GroupLogEntry, index) => {
    switch (entry.kind) {
      case 'made': {
        const id = text(entry.detail.managedBy);
        const itself = id === '' || id === group.id;
        lines.push({ kind: 'made', at: entry.at, by: entry.by, itself, manager: itself ? null : (known.find((one) => one.id === id)?.name ?? null) });
        return;
      }
      case 'renamed':
      case 'sentence':
      case 'managedBy':
        lines.push({ kind: entry.kind, at: entry.at, by: entry.by, from: text(entry.detail.from), to: text(entry.detail.to) });
        return;
      case 'added':
      case 'removed': {
        if (makerJoining(entry, index)) return;
        const who = nameOf(text(entry.detail.email));
        const last = lines.at(-1);
        const newer = group.log[index - 1];
        // One person adding or taking out several at once, each within minutes of the one before: one line.
        if (last && last.kind === entry.kind && last.by.id === entry.by.id && last.by.name === entry.by.name && newer && within(newer.at, entry.at, 10 * 60_000)) {
          // Older entries come later: the line names its members in the order they were added.
          lines[lines.length - 1] = { ...last, who: [who, ...last.who] };
        } else {
          lines.push({ kind: entry.kind, at: entry.at, by: entry.by, who: [who] });
        }
        return;
      }
      case 'moved':
        lines.push({ kind: 'moved', at: entry.at, members: Number(entry.detail.members ?? 0) });
        return;
      case 'deleted':
        lines.push({ kind: 'deleted', at: entry.at, by: entry.by });
    }
  });
  return lines;
}

/** Two members of the managing Group to ask, by name: colleagues who can sign in, not the User themselves (FR-UM-18). */
export function whomToAsk(members: readonly GroupMember[], me: string): string[] {
  return members
    .filter((member) => member.active && member.signedIn && member.name && member.email.toLowerCase() !== me.toLowerCase())
    .slice(0, 2)
    .map((member) => member.name ?? member.email);
}

/** What the tile Your groups says of a Group the User is in (my-page): that it manages itself, what it manages, or who manages it. */
export type TileLine = { readonly kind: 'itself' } | { readonly kind: 'manages'; readonly names: readonly string[] } | { readonly kind: 'managedBy'; readonly name: string };

export function tileLineOf(group: GroupSummary, known: readonly GroupSummary[]): TileLine {
  if (managesItself(group)) return { kind: 'itself' };
  const manages = managedBy(group, known);
  return manages.length > 0 ? { kind: 'manages', names: manages.map((one) => one.name) } : { kind: 'managedBy', name: group.managedBy.name };
}

/** Whether a typed text is an address, to add a colleague who has not signed in yet (OP-UX-70). */
export const isAddress = (typed: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed.trim());

const LOCALES: Record<Language, string> = { nl: 'nl-BE', en: 'en-GB' };

/** Names as one list, "A, B and C", or "A or B" to choose from, in the language of the User. */
export function listOf(names: readonly string[], language: Language, type: 'conjunction' | 'disjunction' = 'conjunction'): string {
  return new Intl.ListFormat(LOCALES[language], { type }).format(names);
}

/** The pieces of such a list, to put a link on each name. */
export function listParts(names: readonly string[], language: Language): { readonly type: 'element' | 'literal'; readonly value: string; readonly index: number }[] {
  let index = -1;
  return new Intl.ListFormat(LOCALES[language], { type: 'conjunction' }).formatToParts(names).map((part) => ({
    type: part.type,
    value: part.value,
    index: part.type === 'element' ? ++index : index,
  }));
}

/** When something happened to a Group: how long ago within the hour, such as "now", and the day after that. */
export function whenOf(at: string, language: Language, now: Date = new Date()): string {
  return now.getTime() - Date.parse(at) < 3_600_000 ? ago(at, language, now) : day(at, language, now);
}

/** The initials of a member: of their name, or of the words of their address before they signed in, such as JV for joke.vermeulen@. */
export function initialsOfMember(name: string | null, email: string): string {
  return initialsOf(name ?? (email.split('@')[0] ?? email).replace(/[._+-]+/g, ' '));
}

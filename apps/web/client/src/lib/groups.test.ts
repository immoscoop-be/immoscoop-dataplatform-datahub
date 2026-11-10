import { describe, expect, it } from 'vitest';
import {
  historyOf,
  initialsOfMember,
  isAddress,
  isYours,
  listOf,
  listParts,
  losesIt,
  managedBy,
  managerChoices,
  managesItself,
  matches,
  newManagerChoices,
  tagsOf,
  tileLineOf,
  whenOf,
  whomToAsk,
} from './groups.js';
import type { GroupDetail, GroupMember, GroupSummary } from './identity.js';

/** A Group as identity lists it: one the User is in, managing itself, unless told otherwise. */
function group(id: string, name: string, more: Partial<GroupSummary> = {}): GroupSummary {
  return { id, name, sentence: '', managedBy: { id, name, isMember: true }, memberCount: 3, isMember: true, mayChange: true, ...more };
}
const member = (email: string, name: string | null, more: Partial<GroupMember> = {}): GroupMember => ({
  email,
  name,
  signedIn: name !== null,
  active: true,
  addedAt: '2026-11-10T09:00:00Z',
  addedBy: { id: '1', name: 'Maxime Passenier' },
  ...more,
});

const SALES_MANAGEMENT = group('g-sm', 'Sales management');
const BROKERS = group('g-br', 'Broker team', { isMember: false, managedBy: { id: 'g-sm', name: 'Sales management', isMember: true }, memberCount: 4 });
const CREDIT = group('g-cr', 'Credit team', { memberCount: 6 });
const MARKETING = group('g-mk', 'Marketing', { managedBy: { id: 'g-ml', name: 'Marketing leads', isMember: false }, mayChange: false, memberCount: 9 });
const FINANCE = group('g-fi', 'Finance', { isMember: false, managedBy: { id: 'g-fi', name: 'Finance', isMember: false }, mayChange: true });

describe('how the User stands to a Group, on Groups (FR-UM-18)', () => {
  it('tags a Group they are in, one that manages itself, and one they manage through another Group', () => {
    expect(tagsOf(BROKERS)).toEqual([{ kind: 'through', manager: 'Sales management' }]);
    expect(tagsOf(CREDIT)).toEqual([{ kind: 'in' }, { kind: 'itself' }]);
    expect(tagsOf(MARKETING)).toEqual([{ kind: 'in' }]);
    // A Group of others has no tag, also one a Data Admin changes with Manage every group.
    expect(tagsOf(FINANCE)).toEqual([]);
  });

  it('counts a Group as theirs when they are in it or in the Group that manages it', () => {
    expect([BROKERS, CREDIT, MARKETING, FINANCE].map(isYours)).toEqual([true, true, true, false]);
    expect([managesItself(CREDIT), managesItself(BROKERS)]).toEqual([true, false]);
  });

  it('knows what a Group manages from its detail, or else from the Groups listed', () => {
    const SALES = group('g-sa', 'Sales', { managedBy: { id: 'g-sm', name: 'Sales management', isMember: true } });
    const known = [SALES_MANAGEMENT, BROKERS, SALES, CREDIT];
    expect(managedBy(SALES_MANAGEMENT, known)).toEqual([
      { id: 'g-br', name: 'Broker team' },
      { id: 'g-sa', name: 'Sales' },
    ]);
    // A Group that manages itself does not manage itself as another Group; one known twice is named once.
    expect(managedBy(CREDIT, known)).toEqual([]);
    expect(managedBy(SALES_MANAGEMENT, [...known, BROKERS])).toHaveLength(2);
    expect(managedBy(CREDIT, known, { manages: [{ id: 'g-x', name: 'Mortgage advisors' }] })).toEqual([{ id: 'g-x', name: 'Mortgage advisors' }]);
  });

  it('finds a Group by its name or sentence, or a colleague in it once its members are read', () => {
    const credit = { ...CREDIT, sentence: 'Follows up credit leads with the bank' };
    expect(matches(credit, '')).toBe(true);
    expect(matches(credit, 'credit')).toBe(true);
    expect(matches(credit, 'BANK')).toBe(true);
    expect(matches(credit, 'elif')).toBe(false);
    expect(matches(credit, 'elif', { members: [member('elif.yilmaz@immoscoop.be', 'Elif Yilmaz')] })).toBe(true);
    expect(matches(credit, 'joke.verm', { members: [member('joke.vermeulen@immoscoop.be', null)] })).toBe(true);
  });

  it('says on My page that a Group manages itself, what it manages, or who manages it', () => {
    const SALES = group('g-sa', 'Sales', { managedBy: { id: 'g-sm', name: 'Sales management', isMember: true } });
    const smOfOthers = { ...SALES_MANAGEMENT, managedBy: { id: 'g-board', name: 'Board', isMember: false } };
    expect(tileLineOf(CREDIT, [CREDIT])).toEqual({ kind: 'itself' });
    expect(tileLineOf(MARKETING, [MARKETING])).toEqual({ kind: 'managedBy', name: 'Marketing leads' });
    expect(tileLineOf(smOfOthers, [smOfOthers, BROKERS, SALES])).toEqual({ kind: 'manages', names: ['Broker team', 'Sales'] });
  });
});

describe('who manages a Group (FR-UM-14, OP-UX-71)', () => {
  it('offers the Group that manages it first, then the Group itself, then the Groups the User is in', () => {
    const choices = managerChoices(BROKERS, [MARKETING, CREDIT, SALES_MANAGEMENT], false);
    expect(choices.map((choice) => [choice.id, choice.now, choice.isMember, choice.memberCount])).toEqual([
      ['g-sm', true, true, 3],
      ['itself', false, false, 4],
      ['g-cr', false, true, 6],
      ['g-mk', false, true, 9],
    ]);
    // The Group itself, which the User is not in: choosing it, they no longer manage it.
    expect(choices.map((choice) => losesIt(choice, false))).toEqual([false, true, false, false]);
  });

  it('offers any Group with Manage every group, those the User is in first, and never takes it from them', () => {
    const DATA = group('g-dt', 'Data Team', { memberCount: 4 });
    const EVENTS = group('g-ev', 'Event team', { isMember: false, managedBy: { id: 'g-ev', name: 'Event team', isMember: false } });
    const choices = managerChoices(FINANCE, [FINANCE, EVENTS, SALES_MANAGEMENT, DATA], true);
    expect(choices.map((choice) => choice.id)).toEqual(['itself', 'g-dt', 'g-sm', 'g-ev']);
    expect(choices[0]?.now).toBe(true);
    expect(choices.some((choice) => losesIt(choice, true))).toBe(false);
  });

  it('keeps the Group that manages it now among the choices, even when the User may not choose it again', () => {
    const choices = managerChoices(BROKERS, [CREDIT], false);
    expect(choices[0]).toEqual({ id: 'g-sm', name: 'Sales management', memberCount: null, isMember: true, now: true });
  });

  it('lets a new Group be managed by a Group the User is in, or by itself', () => {
    expect(newManagerChoices([MARKETING, BROKERS, CREDIT])).toEqual([
      { id: 'g-cr', name: 'Credit team', memberCount: 6 },
      { id: 'g-mk', name: 'Marketing', memberCount: 9 },
      { id: 'itself', name: '', memberCount: 1 },
    ]);
    expect(newManagerChoices([])).toEqual([{ id: 'itself', name: '', memberCount: 1 }]);
  });
});

describe('the history of a Group (FR-UM-17)', () => {
  const MAX = { id: '1', name: 'Maxime Passenier' };
  const base: Pick<GroupDetail, 'id' | 'name' | 'members'> = {
    id: 'g-br',
    name: 'Broker team',
    members: [member('maxime.passenier@immoscoop.be', 'Maxime Passenier'), member('elif.yilmaz@immoscoop.be', 'Elif Yilmaz'), member('karel.leys@immoscoop.be', 'Karel Leys')],
  };

  it('puts the members one person added within minutes in one line, and leaves the maker joining out of it', () => {
    const lines = historyOf(
      {
        ...base,
        log: [
          { at: '2026-11-10T11:00:00Z', kind: 'added', by: MAX, detail: { email: 'jonas.peeters@immoscoop.be' } },
          { at: '2026-11-10T10:05:00Z', kind: 'renamed', by: MAX, detail: { from: 'Brokers', to: 'Broker team' } },
          { at: '2026-11-10T09:45:00Z', kind: 'added', by: MAX, detail: { email: 'lotte.dewulf@immoscoop.be' } },
          { at: '2026-11-10T09:30:00Z', kind: 'added', by: MAX, detail: { email: 'karel.leys@immoscoop.be' } },
          { at: '2026-11-10T09:20:00Z', kind: 'added', by: MAX, detail: { email: 'elif.yilmaz@immoscoop.be' } },
          { at: '2026-11-10T09:00:00Z', kind: 'added', by: MAX, detail: { email: 'maxime.passenier@immoscoop.be' } },
          { at: '2026-11-10T09:00:00Z', kind: 'made', by: MAX, detail: { name: 'Brokers', managedBy: 'g-sm' } },
        ],
      },
      [{ id: 'g-sm', name: 'Sales management' }],
    );
    expect(lines).toEqual([
      // No longer among its members, so named by the address.
      { kind: 'added', at: '2026-11-10T11:00:00Z', by: MAX, who: ['jonas.peeters@immoscoop.be'] },
      { kind: 'renamed', at: '2026-11-10T10:05:00Z', by: MAX, from: 'Brokers', to: 'Broker team' },
      // The same day, but a quarter of an hour later: a line of its own.
      { kind: 'added', at: '2026-11-10T09:45:00Z', by: MAX, who: ['lotte.dewulf@immoscoop.be'] },
      { kind: 'added', at: '2026-11-10T09:30:00Z', by: MAX, who: ['Elif Yilmaz', 'Karel Leys'] },
      { kind: 'made', at: '2026-11-10T09:00:00Z', by: MAX, itself: false, manager: 'Sales management' },
    ]);
  });

  it('names a member taken out by their address, and a Group moved from Google with its members', () => {
    const lines = historyOf({
      ...base,
      log: [
        { at: '2026-11-11T08:00:00Z', kind: 'removed', by: MAX, detail: { email: 'bram.desmet@immoscoop.be' } },
        { at: '2026-11-11T07:00:00Z', kind: 'managedBy', by: MAX, detail: { from: 'Broker team', to: 'Sales management', toId: 'g-sm' } },
        { at: '2026-11-10T06:00:00Z', kind: 'moved', by: { id: null, name: null }, detail: { from: 'Google', members: 5 } },
      ],
    });
    expect(lines).toEqual([
      { kind: 'removed', at: '2026-11-11T08:00:00Z', by: MAX, who: ['bram.desmet@immoscoop.be'] },
      { kind: 'managedBy', at: '2026-11-11T07:00:00Z', by: MAX, from: 'Broker team', to: 'Sales management' },
      { kind: 'moved', at: '2026-11-10T06:00:00Z', members: 5 },
    ]);
  });

  it('says a Group made to manage itself manages itself, and leaves out a manager it does not know', () => {
    const made = (managedBy: string) => historyOf({ ...base, log: [{ at: '2026-11-10T09:00:00Z', kind: 'made', by: MAX, detail: { managedBy } }] });
    expect(made('g-br')).toEqual([{ kind: 'made', at: '2026-11-10T09:00:00Z', by: MAX, itself: true, manager: null }]);
    expect(made('g-unknown')).toEqual([{ kind: 'made', at: '2026-11-10T09:00:00Z', by: MAX, itself: false, manager: null }]);
  });
});

describe('the members of a Group (FR-UM-15)', () => {
  it('names two colleagues of the managing Group to ask, who can sign in, never the User', () => {
    const members = [
      member('max@immoscoop.be', 'Maxime Passenier'),
      member('joke.vermeulen@immoscoop.be', null),
      member('bram.desmet@immoscoop.be', 'Bram De Smet', { active: false }),
      member('an.claes@immoscoop.be', 'An Claes'),
      member('jonas.peeters@immoscoop.be', 'Jonas Peeters'),
      member('ruth.aerts@immoscoop.be', 'Ruth Aerts'),
    ];
    expect(whomToAsk(members, 'MAX@immoscoop.be')).toEqual(['An Claes', 'Jonas Peeters']);
    expect(whomToAsk([], 'max@immoscoop.be')).toEqual([]);
  });

  it('adds by an address, and gives initials to a member who has not signed in yet', () => {
    expect([isAddress('joke.vermeulen@immoscoop.be'), isAddress(' an@immoscoop.be '), isAddress('joke'), isAddress('jo ke@immoscoop.be')]).toEqual([true, true, false, false]);
    expect(initialsOfMember('Elif Yilmaz', 'elif.yilmaz@immoscoop.be')).toBe('EY');
    expect(initialsOfMember(null, 'joke.vermeulen@immoscoop.be')).toBe('JV');
    expect(initialsOfMember(null, 'ruth@immoscoop.be')).toBe('R');
  });
});

describe('the words around a Group', () => {
  it('lists names in the language of the User, with the pieces to link each name', () => {
    expect(listOf(['Elif Yilmaz', 'Karel Leys', 'Lotte Dewulf'], 'en')).toBe('Elif Yilmaz, Karel Leys and Lotte Dewulf');
    expect(listOf(['Elif Yilmaz', 'Karel Leys'], 'nl')).toBe('Elif Yilmaz en Karel Leys');
    expect(listOf(['An Claes', 'Jonas Peeters'], 'en', 'disjunction')).toBe('An Claes or Jonas Peeters');
    expect(listParts(['Brokers', 'Credit leads'], 'en')).toEqual([
      { type: 'element', value: 'Brokers', index: 0 },
      { type: 'literal', value: ' and ', index: 0 },
      { type: 'element', value: 'Credit leads', index: 1 },
    ]);
  });

  it('says how long ago within the hour, and the day after that', () => {
    const now = new Date('2026-11-10T12:00:00Z');
    expect(whenOf('2026-11-10T11:59:50Z', 'en', now)).toBe('now');
    expect(whenOf('2026-11-10T11:30:00Z', 'en', now)).toBe('30 minutes ago');
    expect(whenOf('2026-11-03T09:00:00Z', 'en', now)).toBe('3 Nov');
  });
});

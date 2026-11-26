import { addTexts, setLanguage } from '@datahub/ui/foundations/texts.svelte.js';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { NotFound as Missing } from '../lib/api.js';
import type { Person } from '../lib/identity.js';
import type { Project, ProjectPage as Page, Projects } from '../lib/projects.js';
import { TEXTS } from '../texts/index.js';
import ProjectPage from './ProjectPage.svelte';

beforeAll(() => {
  addTexts(TEXTS);
  setLanguage('en');
});

const ME = { id: 'u-max', name: 'Maxime Passenier' };

function credit(): Project {
  return {
    id: 'p-1',
    name: 'Credit leads Q4',
    description: 'The queries behind the quarterly review.',
    madeBy: { id: 'u-max', name: 'Maxime Passenier' },
    createdAt: '2026-11-12T09:00:00Z',
    updatedAt: '2026-11-19T08:00:00Z',
    members: [
      { id: 'u-max', name: 'Maxime Passenier', addedBy: null, addedAt: '2026-11-12T09:00:00Z', queriesMade: 2 },
      { id: 'u-karel', name: 'Karel Leys', addedBy: 'Maxime Passenier', addedAt: '2026-11-12T10:00:00Z', queriesMade: 1 },
      { id: 'u-lotte', name: 'Lotte Dewulf', addedBy: 'Karel Leys', addedAt: '2026-11-19T07:00:00Z', queriesMade: 0 },
    ],
    queries: [
      { id: 'q-1', name: 'Leads per source name', owner: { id: 'u-max', name: 'Maxime Passenier' }, lastRun: { userName: 'Karel Leys', state: 'done', startedAt: '2026-11-19T07:12:00Z' }, position: 0, locked: false, question: 'Which sources bring our leads?', resources: [{ id: 'r-1', displayName: 'Weekly lead volume' }, { id: 'r-2', displayName: 'Lead sources' }] },
      { id: 'q-2', name: 'Partner share per week', owner: { id: 'u-karel', name: 'Karel Leys' }, lastRun: { userName: 'Karel Leys', state: 'running', startedAt: '2026-11-19T08:00:00Z' }, position: 1, locked: false, question: '', resources: [{ id: 'r-1', displayName: 'Weekly lead volume' }] },
      { id: 'q-3', name: 'Response time per broker', owner: { id: 'u-karel', name: 'Karel Leys' }, lastRun: null, position: 2, locked: true, notSeen: ['Broker contacts'] },
      { id: 'q-4', name: 'New query, 19 Nov', owner: { id: 'u-max', name: 'Maxime Passenier' }, lastRun: null, position: 3, locked: false, question: '', resources: [] },
    ],
  };
}

const PEOPLE: Person[] = [
  { id: 'u-max', email: 'max@immoscoop.be', name: 'Maxime Passenier', permissionGroup: 'Analyst', canQuery: true },
  { id: 'u-karel', email: 'karel@immoscoop.be', name: 'Karel Leys', permissionGroup: 'Analyst', canQuery: true },
  { id: 'u-lotte', email: 'lotte@immoscoop.be', name: 'Lotte Dewulf', permissionGroup: 'Reader', canQuery: false },
];

function fakes(pages: (Page | Error)[] = [credit()]) {
  let at = 0;
  const projects = {
    get: vi.fn(async () => {
      const next = pages[Math.min(at++, pages.length - 1)] as Page | Error;
      if (next instanceof Error) throw next;
      return structuredClone(next);
    }),
    update: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    addMember: vi.fn(async () => true),
    removeMember: vi.fn(async () => ({ left: 2, deleted: false })),
    archive: vi.fn(async () => {}),
    unarchive: vi.fn(async () => {}),
    addQuery: vi.fn(async () => {}),
    removeQuery: vi.fn(async () => {}),
    order: vi.fn(async (_id: string, ids: readonly string[]) => [...ids]),
    list: vi.fn(async () => []),
    create: vi.fn(),
  };
  const identity = { people: vi.fn(async () => [] as Person[]), peopleByIds: vi.fn(async () => PEOPLE) };
  return { projects, identity };
}

function show(options: { pages?: (Page | Error)[]; canMake?: boolean } = {}) {
  const { projects, identity } = fakes(options.pages);
  const calls = { onnewquery: vi.fn(async () => {}), onchanged: vi.fn(), go: vi.fn() };
  render(ProjectPage, {
    id: 'p-1',
    projects: projects as unknown as Projects,
    identity,
    me: ME,
    canMake: options.canMake ?? true,
    ...calls,
  });
  return { projects, identity, ...calls };
}

describe('the page of a Project (FR-SR-63, DEC-UX-285)', () => {
  it('shows its head, its facts, its queries in their order with their keys, and who is in it', async () => {
    show();
    expect(await screen.findByRole('heading', { name: 'Credit leads Q4' })).toBeTruthy();
    expect(screen.getByText('The queries behind the quarterly review.')).toBeTruthy();
    expect(screen.getByText('4 queries')).toBeTruthy();
    expect(screen.getByText('3 people in it')).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Its queries' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.querySelector('.kbd')?.textContent?.replace(/^(⌘|Ctrl\+)/, ''))).toEqual(['1', '2', '3', '4']);
    expect(within(rows[0] as HTMLElement).getByRole('link', { name: 'Leads per source name' }).getAttribute('href')).toBe('/query/q-1');
    expect(rows[0]?.textContent).toContain('Weekly lead volume +1');
    expect(rows[1]?.querySelector('[aria-label="Running"]')).toBeTruthy();
    // Locked: its name and what the User may not see, never a link to it (OP-UX-97).
    expect(within(rows[2] as HTMLElement).queryByRole('link')).toBeNull();
    expect(rows[2]?.textContent).toContain('Reads Broker contacts, which you may not see');
    // An empty query reads no Resource yet (FR-SR-68).
    expect(rows[3]?.textContent).toContain('No Resource yet');
    // Lotte's Permission group does not let her run queries: she is in it all the same, marked so (OP-UX-98).
    await waitFor(() => expect(screen.getAllByText('cannot run queries').length).toBeGreaterThan(0));
    expect(screen.getByText(/Their Permission group, Reader, does not let them make or run queries/)).toBeTruthy();
  });

  it('has no Work in it: its page open is what makes it the active Project (DEC-UX-317)', async () => {
    show();
    expect(await screen.findByRole('heading', { name: 'Credit leads Q4' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Work in it/ })).toBeNull();
    expect(screen.queryByText('You work in it')).toBeNull();
  });

  it('makes an empty query in it with New query (FR-SR-68)', async () => {
    const { onnewquery } = show();
    await fireEvent.click((await screen.findAllByRole('button', { name: 'New query' }))[0] as HTMLElement);
    expect(onnewquery).toHaveBeenCalled();
  });

  it('removes a query without asking, and Undo puts it back at its place (DEC-UX-291, OP-UX-106)', async () => {
    const { projects, onchanged } = show();
    await fireEvent.click(await screen.findByRole('button', { name: 'Remove Partner share per week from Credit leads Q4' }));
    expect(projects.removeQuery).toHaveBeenCalledWith('p-1', 'q-2');
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toContain('Partner share per week');
    expect(notice.textContent).toContain('It stays with Karel Leys, who made it, in the history.');
    await waitFor(() => expect(onchanged).toHaveBeenCalled());
    await fireEvent.click(within(notice).getByRole('button', { name: 'Undo' }));
    expect(projects.addQuery).toHaveBeenCalledWith('p-1', 'q-2');
    await waitFor(() => expect(projects.order).toHaveBeenCalledWith('p-1', ['q-1', 'q-2', 'q-3', 'q-4']));
  });

  it('moves a query with Alt and an arrow on its handle, for everyone in it (OP-UX-95)', async () => {
    const { projects } = show();
    const handles = await screen.findAllByRole('button', { name: 'Move it: drag, or Alt with the up and down arrows' });
    // The locked query has no handle: three of four.
    expect(handles).toHaveLength(3);
    await fireEvent.keyDown(handles[0] as HTMLElement, { key: 'ArrowDown', altKey: true });
    expect(projects.order).toHaveBeenCalledWith('p-1', ['q-2', 'q-1', 'q-3', 'q-4']);
  });

  it('takes a colleague out, and leaves it for oneself (FR-SR-66)', async () => {
    const { projects, go, onchanged } = show();
    await fireEvent.click(await screen.findByRole('button', { name: 'Take Karel Leys out of Credit leads Q4: the queries they made stay in it' }));
    expect(projects.removeMember).toHaveBeenCalledWith('p-1', 'u-karel');
    // Leave next to one's name opens the Danger zone, in a sheet (DEC-UX-357).
    await fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    const sheet = await screen.findByRole('dialog', { name: 'Danger zone' });
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Leave Credit leads Q4' }));
    await waitFor(() => expect(projects.removeMember).toHaveBeenCalledWith('p-1', 'u-max'));
    await waitFor(() => expect(go).toHaveBeenCalledWith('/query'));
    expect(onchanged).toHaveBeenCalled();
  });

  it('deletes it for everyone with a reason, and then says so (OP-UX-100)', async () => {
    const deleted: Page = { id: 'p-1', name: 'Credit leads Q4', deleted: { at: '2026-11-19T09:30:00Z', by: 'Maxime Passenier', reason: 'The quarter is closed.' } };
    const { projects } = show({ pages: [credit(), deleted] });
    // No Danger zone on the page: the bin in its head opens it in a sheet (DEC-UX-357).
    await screen.findByRole('heading', { level: 1, name: /Credit leads Q4/ });
    expect(screen.queryByRole('heading', { name: 'Danger zone' })).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Leave or delete Credit leads Q4' }));
    const sheet = await screen.findByRole('dialog', { name: 'Danger zone' });
    expect(sheet.textContent).toContain('Karel Leys, Lotte Dewulf are told, with your reason.');
    await fireEvent.input(within(sheet).getByRole('textbox'), { target: { value: 'The quarter is closed.' } });
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Delete for good' }));
    expect(projects.remove).toHaveBeenCalledWith('p-1', 'The quarter is closed.');
    expect(await screen.findByText('This project was deleted.')).toBeTruthy();
    expect(screen.getByText(/The quarter is closed\./)).toBeTruthy();
  });

  it('archives it out of the panel of the User with the box in its head, and says so once archived, with Back in your panel (DEC-UX-354, DEC-UX-356)', async () => {
    const archived: Page = { ...credit(), archivedAt: '2026-11-20T10:00:00Z' };
    const { projects, onchanged } = show({ pages: [credit(), archived, credit()] });
    await fireEvent.click(await screen.findByRole('button', { name: 'Archive Credit leads Q4' }));
    expect(projects.archive).toHaveBeenCalledWith('p-1');
    // Archived, its page says so on top, and the box becomes Back in your panel.
    expect(await screen.findByText(/^You archived it on 20 Nov/)).toBeTruthy();
    expect(onchanged).toHaveBeenCalled();
    const back = screen.getAllByRole('button', { name: 'Back in your panel' });
    expect(back).toHaveLength(2);
    await fireEvent.click(back[0] as HTMLElement);
    expect(projects.unarchive).toHaveBeenCalledWith('p-1');
    await waitFor(() => expect(screen.queryByText(/^You archived it on/)).toBeNull());
  });

  it('points to Archive in the sheet of its Danger zone, for who only wants it out of the way (DEC-UX-357)', async () => {
    const { projects } = show();
    await fireEvent.click(await screen.findByRole('button', { name: 'Leave or delete Credit leads Q4' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Danger zone' }));
    expect(sheet.getByText(/Only want it out of your panel\?/)).toBeTruthy();
    await fireEvent.click(sheet.getByRole('button', { name: 'Archive it' }));
    expect(projects.archive).toHaveBeenCalledWith('p-1');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Danger zone' })).toBeNull());
  });

  it('lets who may not make queries read it, without changing its queries (OP-UX-98)', async () => {
    show({ canMake: false });
    expect(await screen.findByText('You can open these queries and read their SQL, but not run or change them.')).toBeTruthy();
    expect(screen.getByText(/One query reads a Resource you may not see/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New query' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move it: drag, or Alt with the up and down arrows' })).toBeNull();
    // Renaming, sharing, archiving and leaving stay theirs.
    expect(screen.getByRole('button', { name: 'Archive Credit leads Q4' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Leave or delete Credit leads Q4' })).toBeTruthy();
  });

  it('says how to add a query to a Project just made', async () => {
    const made: Project = { ...credit(), members: [credit().members[0] as Project['members'][number]], queries: [] };
    show({ pages: [made] });
    expect(await screen.findByText('Nothing in it yet.', { exact: false })).toBeTruthy();
    expect(screen.getByText(/Open a query and add it with its Project button/)).toBeTruthy();
    expect(screen.getByText('Only you')).toBeTruthy();
    expect(screen.getByText(/Only you see it\. Share it/)).toBeTruthy();
  });

  it('answers a Project the User is not in as not found', async () => {
    show({ pages: [new Missing('/projects/p-1')] });
    expect(await screen.findByText('Nothing here for you')).toBeTruthy();
  });
});

describe('Share (DEC-UX-286, FR-SR-65)', () => {
  it('finds a colleague, says when they cannot run queries, and adds them all the same (OP-UX-98)', async () => {
    const { projects, identity } = show();
    identity.people.mockResolvedValue([{ id: 'u-joke', email: 'joke@immoscoop.be', name: 'Joke Vermeulen', permissionGroup: 'Reader', canQuery: false }]);
    await fireEvent.click((await screen.findAllByRole('button', { name: /Share/ }))[0] as HTMLElement);
    const sheet = await screen.findByRole('dialog', { name: 'Share' });
    expect(sheet.textContent).toContain('Everyone in a project may open, change and run its queries');
    expect(sheet.textContent).toContain('In it · 3');
    await fireEvent.input(within(sheet).getByRole('textbox', { name: 'Add a colleague, by name or address' }), { target: { value: 'jo' } });
    const joke = await within(sheet).findByRole('button', { name: /Joke Vermeulen/ }, { timeout: 2000 });
    expect(joke.textContent).toContain('cannot run queries');
    expect(joke.textContent).toContain('joke@immoscoop.be · Reader');
    await fireEvent.click(joke);
    expect(projects.addMember).toHaveBeenCalledWith('p-1', { id: 'u-joke', name: 'Joke Vermeulen', canQuery: false });
  });
});

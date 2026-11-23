import {
  appliesTo,
  bestNext,
  coverage,
  isComplete,
  isNeeded,
  levelOf,
  neededOf,
  PROBES,
  probesFor,
  type DigAnswer,
  type DigResult,
  type EdaResource,
  type EdaView,
  type ProbeKey,
  type ProbeResult,
  type ResultView,
  type RunView,
  type Selection,
} from '@datahub/contracts/eda';
import { addTexts, setLanguage } from '@datahub/ui/foundations/texts.svelte.js';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { selectionFrom } from '../lib/dig.js';
import type { EdaClient } from '../lib/eda.js';
import { takeProposal } from '../lib/gaps.js';
import { route } from '../lib/routes.js';
import { TEXTS } from '../texts/index.js';
import EdaPage from './EdaPage.svelte';
import EdaResult from './EdaResult.svelte';
import OverviewGaps from './OverviewGaps.svelte';

beforeAll(() => {
  addTexts(TEXTS);
});
afterEach(() => setLanguage('en'));

/** Weekly lead volume: an aggregate, one row per week and lead source, with four Key Fields. */
const WEEKLY: EdaResource = {
  id: 'r2',
  displayName: 'Weekly lead volume',
  modelType: 'aggregate',
  level: 3,
  fields: [
    { name: 'week_start', dataType: 'DATE', keyField: true, role: 'period', grain: true, mapped: false },
    { name: 'lead_source', dataType: 'STRING', keyField: true, role: 'groupedBy', grain: true, mapped: true },
    { name: 'lead_count', dataType: 'INT64', keyField: true, role: 'addsUp', grain: false, mapped: false },
    { name: 'lead_channel', dataType: 'STRING', keyField: true, role: null, grain: false, mapped: false },
  ],
};
const AN = { id: '2', name: 'An Claes' };

function viewOf(): EdaView {
  return {
    resource: { ...WEEKLY, collection: { id: 'c1', name: 'Credit leads' } },
    status: 'inProgress',
    startedBy: AN,
    startedAt: '2026-11-21T09:00:00Z',
    exploredAt: null,
    needed: neededOf(WEEKLY, []),
    probes: probesFor(WEEKLY.modelType).map((key: ProbeKey) => ({
      key,
      level: levelOf(key, WEEKLY.modelType) ?? 'could',
      runs: PROBES[key].runs,
      needed: isNeeded(key, WEEKLY),
      added: false,
      complete: isComplete(key, WEEKLY, []),
      applies: appliesTo(key, WEEKLY),
      fields: [],
      params: {},
      lastRun: null,
    })),
    coverage: coverage(WEEKLY, []),
    next: bestNext(WEEKLY, []),
  };
}

const SAYS_NOTHING: Selection = { where: [{ kind: 'saysNothing', field: 'lead_channel' }] };
/** What eda found for the rows where lead_channel says nothing: more of the rows before 6 January 2025, and from the app. */
const FOUND: DigResult = {
  rows: { selected: 40, total: 312 },
  overTime: {
    field: 'week_start',
    unit: 'week',
    periods: [
      { start: '2024-12-23', selected: 10, total: 12 },
      { start: '2024-12-30', selected: 12, total: 12 },
      { start: '2025-01-06', selected: 1, total: 91 },
      { start: '2025-01-13', selected: 0, total: 80 },
    ],
    breakAt: '2025-01-06',
    before: 'more',
  },
  fields: [
    {
      field: 'lead_source',
      kind: 'text',
      values: [
        { value: 'app', selected: 30, rest: 20, ratio: 10.2, real: true },
        { value: 'partner', selected: 2, rest: 10, ratio: 1.4, real: false },
        { value: 'website', selected: 8, rest: 242, ratio: 0.22, real: true },
      ],
    },
    { field: 'lead_count', kind: 'number', selected: { median: 18, mean: 24 }, rest: { median: 26, mean: null } },
  ],
};
const RAN: DigAnswer = { state: 'ran', selection: SAYS_NOTHING, result: FOUND, ranAt: '2026-11-22T10:40:00Z', bytes: 1_000_000 };

/** A fake eda, its dig answering one answer after the other, the last one again. */
function clientWith(...answers: DigAnswer[]) {
  const dig = vi.fn(async (_id: string, _selection: Selection, _approve?: boolean) => answers.length > 1 ? (answers.shift() as DigAnswer) : (answers[0] as DigAnswer));
  const client = { get: vi.fn(async () => viewOf()), dig, run: vi.fn(), read: vi.fn(), list: vi.fn(), start: vi.fn() } as unknown as EdaClient;
  return { client, dig };
}

async function openDig(selection: Selection, client: EdaClient, go = vi.fn(), canQuery = true) {
  render(EdaPage, { id: 'r2', tab: 'steps', probe: null, dig: { selection, from: 'disguisedNulls' }, client, onchanged: () => {}, go, canQuery });
  const main = within(document.body);
  await main.findByRole('heading', { level: 2 });
  return { main, go };
}

/** The selection an address of the app holds. */
const selectionOf = (href: string | null) => {
  const found = route(href ?? '');
  return found.kind === 'eda' ? (found.dig?.selection ?? null) : null;
};

describe('Dig into what a result found (FR-ED-20, DEC-ED-36)', () => {
  it('sets the selection against the rest: conditions in words, its rows, a sentence, over time, and per other Key Field', async () => {
    setLanguage('en');
    const { client, dig } = clientWith(RAN);
    const { main } = await openDig(SAYS_NOTHING, client);
    expect(main.getByRole('heading', { level: 2 }).textContent).toBe('The rows where lead_channel says nothing');
    expect(main.getByRole('link', { name: 'Disguised nulls' }).getAttribute('href')).toBe('/eda/r2/probes/disguisedNulls');
    await main.findByRole('region', { name: 'What these rows have in common' });
    // It runs as the page opens, on the selection of its address.
    expect(dig).toHaveBeenCalledWith('r2', SAYS_NOTHING, false);
    expect(document.querySelector('.count')?.textContent).toBe('40 rows, 13% of the table · against the other 272');
    expect(document.querySelector('.conclusion')?.textContent).toBe(
      '96% of these rows come from before 6 Jan 2025, and for 75% lead_source is app. Before that week 92% of the rows are among them, since then 0.6%. lead_source is app 10 times as often as in the other rows.',
    );
    // Over time, on its date, the break marked.
    expect(main.getByRole('img', { name: 'The share of the rows selected per week, on week_start' })).toBeTruthy();
    expect(main.getByText('before 6 Jan 2025: 92% of rows')).toBeTruthy();
    expect(main.getByText('since: 0.6%')).toBeTruthy();
    // Per text: each value with its share in both, how many times as often, and whether it could be chance.
    const rows = [...document.querySelectorAll('.values li')].map((row) => row.textContent?.replace(/\s+/g, ' ').trim());
    expect(rows).toEqual([
      'app 75%of these rows 7.4%of the other rows ×10 real',
      'partner 5%of these rows 3.7%of the other rows ×1.4 could be chance',
      'website 20%of these rows 89%of the other rows ×0.22 real',
    ]);
    expect(document.querySelector('.values li.over .ratio')?.getAttribute('title')).toBe('10 times as often as in the other rows');
    // Per number: its middle in both.
    expect(main.getByText('Median 18 in these rows, 26 in the other rows; mean 24 against –.')).toBeTruthy();
  });

  it('takes a condition off by its ×, back where it started when none is left, and adds one: Narrow it, and Dig further', async () => {
    setLanguage('en');
    const two: Selection = { where: [...SAYS_NOTHING.where, { kind: 'range', field: 'week_start', before: '2025-01-06' }] };
    const { client } = clientWith({ ...RAN, selection: two });
    const { main, go } = await openDig(two, client);
    await main.findByRole('region', { name: 'What these rows have in common' });
    expect(main.getByRole('heading', { level: 2 }).textContent).toBe('The rows where lead_channel says nothing and week_start is before 6 Jan 2025');
    expect(selectionOf(main.getByRole('link', { name: 'Take this condition off: lead_channel says nothing' }).getAttribute('href'))).toEqual({ where: [two.where[1]] });
    // Narrow it offers what needs no value to type, and leads to the selection with it.
    await fireEvent.click(main.getByRole('button', { name: 'Narrow it' }));
    const menu = within(main.getByRole('menu', { name: 'Narrow it' }));
    expect(menu.queryByRole('menuitem', { name: /week_start is before 6 Jan 2025/ })).toBeNull();
    await fireEvent.click(menu.getByRole('menuitem', { name: 'lead_source is app' }));
    expect(selectionOf(go.mock.calls[0]?.[0] as string)).toEqual({ where: [...two.where, { kind: 'equals', field: 'lead_source', value: 'app' }] });
    // Dig further on the value that sets it most apart.
    expect(selectionOf(main.getByRole('link', { name: /Dig further: app only/ }).getAttribute('href'))).toEqual({ where: [...two.where, { kind: 'equals', field: 'lead_source', value: 'app' }] });
    // Query these rows opens a new query on the Resource.
    expect(main.getByRole('link', { name: /Query these rows/ }).getAttribute('href')).toBe('/query/new/r2');
  });

  it('leads back where it started when its last condition is taken off, and offers no query to who may not make one', async () => {
    setLanguage('en');
    const { client } = clientWith(RAN);
    const { main } = await openDig(SAYS_NOTHING, client, vi.fn(), false);
    await main.findByRole('region', { name: 'What these rows have in common' });
    expect(main.getByRole('link', { name: 'Take this condition off: lead_channel says nothing' }).getAttribute('href')).toBe('/eda/r2/probes/disguisedNulls');
    expect(main.queryByRole('link', { name: /Query these rows/ })).toBeNull();
  });

  it('proposes a Known Gap, its text and scope, which the Resource Card opens filled in, never saving it itself', async () => {
    setLanguage('en');
    const { client } = clientWith(RAN);
    const { main } = await openDig(SAYS_NOTHING, client);
    await main.findByRole('region', { name: 'What these rows have in common' });
    expect(main.getByText('Make it a Known Gap?')).toBeTruthy();
    const gap = document.querySelector('.gap p')?.textContent;
    expect(gap).toBe('“lead_channel is not filled where lead_source is app before 6 Jan 2025.”until 5 Jan 2025, on week_start · fields lead_channel · lead_source is app');
    const propose = main.getByRole('link', { name: /Propose it/ });
    expect(propose.getAttribute('href')).toBe('/resources/r2/gaps');
    await fireEvent.click(propose);
    const proposal = takeProposal('r2');
    expect(proposal).toEqual({
      text: 'lead_channel is not filled where lead_source is app before 6 Jan 2025.',
      scope: { period: { from: null, to: '2025-01-05', dateField: 'week_start' }, fields: ['lead_channel'], rows: { field: 'lead_source', is: 'oneOf', values: ['app'] } },
    });
    expect(takeProposal('r2')).toBeNull();

    // The form of a new Known Gap opens filled in with it, for the User to save.
    const onadd = vi.fn(async () => true);
    render(OverviewGaps, { gaps: [], fields: WEEKLY.fields.map((field) => ({ name: field.name, dataType: field.dataType })) as never, canEdit: true, adding: true, proposal, onadd, onchange: vi.fn(), onremove: vi.fn() });
    const form = within(screen.getByRole('form', { name: 'A new Known Gap' }));
    expect((form.getByRole('textbox', { name: /^What is missing/ }) as HTMLTextAreaElement).value).toBe(proposal?.text);
    expect((form.getByLabelText('To') as HTMLInputElement).value).toBe('2025-01-05');
    await fireEvent.click(form.getByRole('button', { name: 'Add' }));
    expect(onadd).toHaveBeenCalledWith(proposal?.text, proposal?.scope);
  });

  it('asks the User to approve what reads more than runs freely, and says why one does not run', async () => {
    setLanguage('en');
    const { client, dig } = clientWith({ state: 'approve', bytes: 340_000_000 }, RAN);
    const { main } = await openDig(SAYS_NOTHING, client);
    expect(await main.findByText('It reads 340 MB, more than runs at once: approve it, and it runs.')).toBeTruthy();
    await fireEvent.click(main.getByRole('button', { name: /Approve and run/ }));
    await main.findByRole('region', { name: 'What these rows have in common' });
    expect(dig).toHaveBeenLastCalledWith('r2', SAYS_NOTHING, true);

    const refused = clientWith({ state: 'refused', bytes: 3_000_000_000, reason: 'It reads 3 GB, more than one run of yours may read (1 GB), so it does not run.' });
    document.body.replaceChildren();
    const again = await openDig(SAYS_NOTHING, refused.client);
    expect((await again.main.findByRole('alert')).textContent).toBe('It does not run: It reads 3 GB, more than one run of yours may read (1 GB), so it does not run.');
    expect(again.main.queryByRole('region', { name: 'What these rows have in common' })).toBeNull();
  });

  it('speaks Dutch', async () => {
    setLanguage('nl');
    const { client } = clientWith(RAN);
    const { main } = await openDig(SAYS_NOTHING, client);
    await main.findByRole('region', { name: 'Wat deze rijen gemeen hebben' });
    expect(main.getByRole('heading', { level: 2 }).textContent).toBe('De rijen waar lead_channel niets zegt');
    expect(main.getByRole('link', { name: 'Verkapte lege waarden' })).toBeTruthy();
    expect(document.querySelector('.count')?.textContent).toBe('40 rijen, 13% van de tabel · tegenover de andere 272');
    expect(document.querySelector('.conclusion')?.textContent).toBe(
      '96% van deze rijen komt van vóór 6 jan 2025, en bij 75% is lead_source app. Vóór die week hoort 92% van de rijen erbij, sindsdien 0,6%. lead_source is 10 keer zo vaak app als in de andere rijen.',
    );
    expect(main.getByText('Een Known Gap van maken?')).toBeTruthy();
    expect(main.getByRole('link', { name: /Stel hem voor/ })).toBeTruthy();
    expect(main.getByRole('link', { name: /Graaf verder: enkel app/ })).toBeTruthy();
    expect(main.getByRole('link', { name: /Bevraag deze rijen/ })).toBeTruthy();
    expect(main.getByRole('button', { name: 'Verfijn' })).toBeTruthy();
    expect([...document.querySelectorAll('.values li')][1]?.textContent).toContain('kan toeval zijn');
  });
});

describe('where Dig into starts: a row of a result with something to read (FR-ED-20)', () => {
  function ran(probe: string, results: [string, ProbeResult, ResultView['reading']][], selection: Selection = { where: [] }): RunView {
    return { id: `run-${probe}`, ranAt: '2026-11-22T10:00:00Z', ranBy: AN, bytes: 1000, fields: results.map(([subject]) => subject), params: {}, selection, results: results.map(([subject, data, reading]) => ({ subject, data, reading, yours: null })) };
  }
  const digHref = (selection: Selection) => `/eda/r2/dig?${new URLSearchParams({ selection: JSON.stringify(selection) })}`;
  const hrefs = () => [...document.querySelectorAll<HTMLAnchorElement>('.dig a')].map((link) => [link.getAttribute('aria-label'), selectionFrom(new URL(link.href).searchParams.get('selection'))]);

  it('digs into a field with empty values of Nulls per Key Field, and only into those', () => {
    setLanguage('en');
    const run = ran('nulls', [
      ['week_start', { rows: 100, empty: 0, role: 'period' }, 'expected'],
      ['lead_channel', { rows: 100, empty: 12, role: null }, 'judge'],
    ]);
    render(EdaResult, { probe: 'nullsPerKeyField', run, resource: WEEKLY, digHref });
    expect(hrefs()).toEqual([['Dig into the rows where lead_channel is empty', { where: [{ kind: 'empty', field: 'lead_channel' }] }]]);
  });

  it('digs into a field where rows say nothing of Disguised nulls, on the rows its result ran on', () => {
    setLanguage('en');
    const on: Selection = { where: [{ kind: 'range', field: 'week_start', from: '2025-01-06' }] };
    const run = ran('disguised', [
      ['lead_source', { rows: 100, saysNothing: 0, nulls: 0, found: [], role: 'groupedBy' }, 'expected'],
      ['lead_channel', { rows: 100, saysNothing: 16, nulls: 4, found: [{ value: 'n/a', rows: 12 }], role: null }, 'judge'],
    ], on);
    render(EdaResult, { probe: 'disguisedNulls', run, resource: WEEKLY, digHref });
    expect(hrefs()).toEqual([['Dig into the rows where lead_channel says nothing', { where: [...on.where, { kind: 'saysNothing', field: 'lead_channel' }] }]]);
  });

  it('digs into a value shown of Distribution of categories, from a menu of its values', async () => {
    setLanguage('en');
    const go = vi.fn();
    const run = ran('categories', [
      ['lead_source', { weighedBy: null, total: 100, values: 3, top: [{ value: 'website', weight: 60, share: 0.6 }, { value: 'app', weight: 30, share: 0.3 }], others: { values: 1, weight: 10, share: 0.1 }, empty: { weight: 0, share: 0 }, small: 0 }, 'judge'],
    ]);
    render(EdaResult, { probe: 'distributionOfCategories', run, resource: WEEKLY, digHref, go });
    await fireEvent.click(screen.getByRole('button', { name: 'Dig into' }));
    const menu = within(screen.getByRole('menu', { name: 'Dig into a value of lead_source' }));
    // The values shown, not the others together or the empty ones.
    expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['website60%', 'app30%']);
    await fireEvent.click(menu.getByRole('menuitem', { name: /app/ }));
    await waitFor(() => expect(go).toHaveBeenCalled());
    expect(selectionFrom(new URL(go.mock.calls[0]?.[0] as string, 'https://datahub.test').searchParams.get('selection'))).toEqual({ where: [{ kind: 'equals', field: 'lead_source', value: 'app' }] });
  });

  it('offers no Dig into where the page gives none', () => {
    setLanguage('en');
    render(EdaResult, { probe: 'nullsPerKeyField', run: ran('nulls', [['lead_channel', { rows: 100, empty: 12, role: null }, 'judge']]), resource: WEEKLY });
    expect(screen.queryByRole('link', { name: /Dig into/ })).toBeNull();
  });
});

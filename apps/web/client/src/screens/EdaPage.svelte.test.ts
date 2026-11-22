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
  type EdaResource,
  type EdaView,
  type ProbeKey,
  type ProbeResult,
  type ResultView,
  type RunAnswer,
  type RunView,
} from '@datahub/contracts/eda';
import { addTexts, setLanguage } from '@datahub/ui/foundations/texts.svelte.js';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { EdaClient } from '../lib/eda.js';
import type { EdaTab } from '../lib/routes.js';
import { TEXTS } from '../texts/index.js';
import EdaPage from './EdaPage.svelte';
import EdaResult from './EdaResult.svelte';

beforeAll(() => {
  addTexts(TEXTS);
  setLanguage('en');
});

/** Weekly lead volume: an aggregate, one row per week and lead source, with four Key Fields (DEC-UX-323). */
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
    { name: 'unique_applicants', dataType: 'INT64', keyField: false, role: 'uniqueCount', grain: false, mapped: false },
    { name: 'loaded_at', dataType: 'TIMESTAMP', keyField: false, role: null, grain: false, mapped: false },
  ],
};

const AN = { id: '2', name: 'An Claes' };

/** A run of an EDA-Probe, on its fields, with a result per subject and Data Hub's reading of each. */
function ran(fields: string[], results: [string, ProbeResult, ResultView['reading']][], more: Partial<RunView> = {}): RunView {
  return {
    id: `run-${fields.join('-')}`,
    ranAt: '2026-11-21T10:42:00Z',
    ranBy: AN,
    bytes: 300_000,
    fields,
    params: {},
    results: results.map(([subject, data, reading]) => ({ subject, data, reading, yours: null })),
    ...more,
  };
}

/** The EDA of a Resource as eda answers it, from the contracts' own rules: what it needs, covers and does next. */
function viewOf(runs: Partial<Record<ProbeKey, RunView>> = {}, resource: EdaResource = WEEKLY): EdaView {
  const covers = Object.entries(runs).map(([probe, run]) => ({ probe: probe as ProbeKey, fields: run.fields }));
  const needed = neededOf(resource, covers);
  return {
    resource: { ...resource, collection: { id: 'c1', name: 'Credit leads' } },
    status: needed.total > 0 && needed.complete === needed.total ? 'explored' : 'inProgress',
    startedBy: AN,
    startedAt: '2026-11-21T09:00:00Z',
    exploredAt: null,
    needed,
    probes: probesFor(resource.modelType).map((key) => {
      const run = runs[key] ?? null;
      return {
        key,
        level: levelOf(key, resource.modelType) ?? 'could',
        runs: PROBES[key].runs,
        needed: isNeeded(key, resource),
        added: run !== null,
        complete: isNeeded(key, resource) && isComplete(key, resource, covers),
        applies: appliesTo(key, resource),
        fields: run?.fields ?? [],
        params: run?.params ?? {},
        lastRun: run,
      };
    }),
    coverage: coverage(resource, covers),
    next: bestNext(resource, covers),
  };
}

const GRAIN_HOLDS = ran(['week_start', 'lead_source'], [['', { rows: 16224, values: 16224, onMoreThanOne: 0, rowsCovered: 0, emptyGrain: 0, buckets: [16224, 0, 0, 0], examples: [] }, 'expected']]);
const GRAIN_TWICE = ran(['week_start', 'lead_source'], [
  [
    '',
    {
      rows: 16260,
      values: 16224,
      onMoreThanOne: 34,
      rowsCovered: 70,
      emptyGrain: 0,
      buckets: [16190, 32, 2, 0],
      examples: [
        { values: { week_start: '2026-08-03', lead_source: 'partner' }, rows: 3 },
        { values: { week_start: '2026-08-03', lead_source: 'website' }, rows: 3 },
      ],
    },
    'look',
  ],
]);
const NULLS = ran(['week_start', 'lead_source', 'lead_count', 'lead_channel'], [
  ['week_start', { rows: 16224, empty: 0, role: 'period' }, 'expected'],
  ['lead_source', { rows: 16224, empty: 130, role: 'groupedBy' }, 'look'],
  ['lead_count', { rows: 16224, empty: 0, role: 'addsUp' }, 'expected'],
  ['lead_channel', { rows: 16224, empty: 1947, role: null }, 'judge'],
]);
const UNIT = { average: 2061, sd: 228, p25: 1894, median: 2059, p75: 2236, lowest: { value: 980, start: '2026-06-15' }, highest: { value: 2559, start: '2026-04-06' } };
const VOLUME = ran(['week_start'], [
  [
    'week_start',
    {
      unit: 'week',
      measure: 'lead_count',
      periods: ['2024-03-18', '2024-03-25', '2024-04-01', '2024-04-08', '2024-04-15'].map((start, index) => ({ start, rows: index === 2 ? 0 : 52, sum: index === 2 ? 0 : 2000 + index * 10 })),
      empty: ['2024-04-01'],
      current: '2024-04-15',
      units: [
        { days: 7, ...UNIT },
        { days: 28, ...UNIT, average: 8228, sd: 839 },
      ],
    },
    'look',
  ],
]);
const DISTRIBUTION = ran(['lead_count'], [
  ['lead_count', { rows: 16224, low: 1, p25: 17, median: 25, p75: 38, p95: 120, high: 412, mean: 38, width: 10, tailFrom: 120, start: 0, bins: [1023, 4334, 4474, 2726, 1450, 756, 389, 126, 36, 33, 52, 52], tail: 773 }, 'judge'],
]);

/** The weight of each value of a text, as a share of the 632,700 leads, the sum of lead_count. */
function weighed(shares: [string, number][], more: { values: number; others: [number, number]; empty: number; small: number }): ProbeResult {
  const total = 632_700;
  const of = (share: number) => Math.round(share * total);
  return {
    weighedBy: 'lead_count',
    total,
    values: more.values,
    top: shares.map(([value, share]) => ({ value, weight: of(share), share })),
    others: { values: more.others[0], weight: of(more.others[1]), share: more.others[1] },
    empty: { weight: of(more.empty), share: more.empty },
    small: more.small,
  };
}
const CATEGORIES = ran(['lead_source', 'lead_channel'], [
  [
    'lead_source',
    weighed(
      [
        ['website', 0.41],
        ['app', 0.22],
        ['partner', 0.09],
        ['immoweb', 0.07],
        ['mailing', 0.05],
        ['kbc-app', 0.04],
        ['social', 0.03],
        ['referral', 0.02],
        ['source 9', 0.009],
        ['source 10', 0.006],
      ],
      { values: 54, others: [44, 0.054], empty: 0.001, small: 31 },
    ),
    'judge',
  ],
  [
    'lead_channel',
    weighed(
      [
        ['web', 0.38],
        ['mobile', 0.31],
        ['email', 0.1],
        ['phone', 0.06],
        ['Web', 0.02],
        ['e-mail', 0.01],
        ['fax', 0.0006],
      ],
      { values: 7, others: [0, 0], empty: 0.12, small: 1 },
    ),
    'judge',
  ],
]);
/** Date range on week_start: up to date, from week 1 of 2021 to this week, week 47 of 2026; and 3 weeks behind. */
const RANGE = { unit: 'week', first: '2021-01-04', last: '2026-11-16', periods: 307, current: '2026-11-16', behind: 0, reliableSince: '2025-01-01', beforeReliable: 208 } as const;
const UP_TO_DATE = ran(['week_start'], [['week_start', RANGE, 'expected']]);
const BEHIND = ran(['week_start'], [['week_start', { ...RANGE, last: '2026-10-26', periods: 303, behind: 3 }, 'look']]);
/** Disguised nulls on the four Key Fields: lead_source says "unknown" besides its empty values, lead_channel much more (DEC-ED-35). */
const DISGUISED = ran(['week_start', 'lead_source', 'lead_count', 'lead_channel'], [
  ['week_start', { rows: 16224, saysNothing: 0, nulls: 0, found: [], role: 'period' }, 'expected'],
  ['lead_source', { rows: 16224, saysNothing: 182, nulls: 130, found: [{ value: 'unknown', rows: 52 }], role: 'groupedBy' }, 'look'],
  ['lead_count', { rows: 16224, saysNothing: 0, nulls: 0, found: [], role: 'addsUp' }, 'expected'],
  [
    'lead_channel',
    {
      rows: 16224,
      saysNothing: 2608,
      nulls: 1947,
      found: [
        { value: 'unknown', rows: 412 },
        { value: 'n/a', rows: 211 },
        { value: '', rows: 38 },
      ],
      role: null,
    },
    'judge',
  ],
]);

/**
 * The EDA with Disguised nulls run by Data Hub, as it will once eda runs it: the contracts still say it does not, and
 * these tests do not depend on when that changes.
 */
const runnable = (view: EdaView): EdaView => ({ ...view, probes: view.probes.map((one) => (one.key === 'disguisedNulls' ? { ...one, runs: true } : one)) });

/** eda as the page meets it: the EDA it holds, and what a run or a reading answers. */
function fakeEda(view: EdaView | null, answers: RunAnswer[] = []) {
  let now = view;
  const client = {
    get: vi.fn(async () => structuredClone(now)),
    list: vi.fn(),
    start: vi.fn(),
    run: vi.fn(async () => {
      const answer = answers.shift() ?? { state: 'refused', bytes: null, reason: 'nothing more' };
      if (answer.state === 'ran') now = answer.eda;
      return structuredClone(answer);
    }),
    read: vi.fn(async (_id: string, probe: ProbeKey, subject: string, reading: 'expected' | 'known' | 'problem') => {
      if (!now) throw new Error('no EDA');
      now = {
        ...now,
        probes: now.probes.map((one) =>
          one.key === probe && one.lastRun
            ? { ...one, lastRun: { ...one.lastRun, results: one.lastRun.results.map((result) => (result.subject === subject ? { ...result, yours: { reading, by: AN, at: '2026-11-21T11:00:00Z' } } : result)) } }
            : one,
        ),
      };
      return structuredClone(now);
    }),
  };
  return client;
}

function show(view: EdaView | null, options: { tab?: EdaTab; probe?: ProbeKey | null; answers?: RunAnswer[] } = {}) {
  const client = fakeEda(view, options.answers);
  const onchanged = vi.fn();
  render(EdaPage, { id: 'r2', tab: options.tab ?? 'steps', probe: options.probe ?? null, client: client as unknown as EdaClient, onchanged });
  return { client, onchanged };
}

const step = (name: string) => within(screen.getByRole('region', { name }));

describe('the page of an EDA (FR-ED-04, DEC-UX-321, DEC-UX-322)', () => {
  it('shows its status and Level, and the tabs Overview, Steps and Profile, Profile greyed until it is Explored', async () => {
    show(viewOf({ grainHolds: GRAIN_HOLDS }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Weekly lead volume' })).toBeTruthy();
    expect(screen.getByText('Its EDA, started on 21 Nov by An Claes.', { exact: false })).toBeTruthy();
    expect(screen.getAllByText('In progress').length).toBeGreaterThan(0);
    expect(screen.getByText('3 · Confirmed')).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Overview', 'Steps', 'Profile']);
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[2]?.classList.contains('muted')).toBe(true);
    expect(tabs[2]?.getAttribute('href')).toBe('/eda/r2/profile');
    expect(screen.getByRole('link', { name: /Open the Resource/ }).getAttribute('href')).toBe('/resources/r2/maturity');
  });

  it('shows the rows of its table beside its Level, from the last run that counted them, and says which counted them and when (DEC-ED-32)', async () => {
    show(viewOf());
    await screen.findByRole('heading', { level: 1, name: 'Weekly lead volume' });
    // Neither The grain holds nor Nulls per Key Field ran: no rows to show.
    expect(screen.queryByTitle(/^Counted by/)).toBeNull();
    cleanup();

    show(viewOf({ grainHolds: GRAIN_HOLDS }));
    const grain = await screen.findByTitle(/^Counted by The grain holds, 21 Nov/);
    expect(grain.textContent?.trim()).toBe('16,224 rows');
    expect(grain.closest('.facts')).toBeTruthy();
    cleanup();

    // Nulls per Key Field ran after it: its count is the last.
    const later = ran(NULLS.fields, [['week_start', { rows: 16300, empty: 0, role: 'period' }, 'expected']], { ranAt: '2026-11-21T11:30:00Z' });
    show(viewOf({ grainHolds: GRAIN_HOLDS, nullsPerKeyField: later }));
    expect((await screen.findByTitle(/^Counted by Nulls per Key Field, 21 Nov/)).textContent?.trim()).toBe('16,300 rows');
    cleanup();

    setLanguage('nl');
    try {
      show(viewOf({ grainHolds: GRAIN_HOLDS }));
      expect((await screen.findByTitle(/^Geteld door De grain klopt, 21 nov/)).textContent?.trim()).toBe('16.224 rijen');
    } finally {
      setLanguage('en');
    }
  });

  it('says on Profile what will come there', async () => {
    show(viewOf(), { tab: 'profile' });
    expect(await screen.findByRole('heading', { level: 3, name: 'The Profile comes once the EDA-Setup is complete' })).toBeTruthy();
  });

  it('shows a row per EDA-Step with how many needed EDA-Probes are complete, its cards, and one Add probe while it has EDA-Probes not added', async () => {
    show(viewOf({ grainHolds: GRAIN_HOLDS }));
    await screen.findByRole('heading', { level: 1, name: 'Weekly lead volume' });
    expect(screen.getAllByRole('region').map((region) => region.getAttribute('aria-label')).slice(0, 5)).toEqual(['Basis', 'Gaps', 'Weight', 'Correctness', 'Relations between fields']);
    const basis = step('Basis');
    expect(basis.getByText('1 of 3 needed')).toBeTruthy();
    const card = within(basis.getByRole('article', { name: 'The grain holds' }));
    expect(card.getByText('As expected')).toBeTruthy();
    expect(card.getByText(/none twice in 16,224 rows/)).toBeTruthy();
    expect(card.getByText('Set on week_start, lead_source')).toBeTruthy();
    // The whole card opens the detail of its EDA-Probe: its title is the link, stretched over the card.
    expect(card.getByRole('link', { name: 'The grain holds' }).getAttribute('href')).toBe('/eda/r2/probes/grainHolds');
    expect(basis.getByRole('button', { name: /Add probe/ }).textContent).toContain('2 needed still in Basis');
    expect(step('Gaps').getByText('0 of 3 needed')).toBeTruthy();
    // Coming ones count as EDA-Probes left to add, as the list shows them (FR-ED-04, DEC-ED-27).
    expect(step('Correctness').getByRole('button', { name: /Add probe/ })).toBeTruthy();
    expect(step('Relations between fields').getByText('None needed')).toBeTruthy();
    expect(step('Relations between fields').getByRole('button', { name: /Add probe/ }).textContent).toContain('More to add in Relations between fields');
  });

  it('shows on the right the needed EDA-Probes complete, the four places, the best next step, the table as a whole and every field (DEC-UX-322, DEC-UX-323)', async () => {
    show(viewOf({ grainHolds: GRAIN_HOLDS }));
    const side = within(await screen.findByRole('complementary', { name: 'EDA-Setup' }));
    expect(side.getByText('1 of 10')).toBeTruthy();
    const bar = side.getByRole('img', { name: '1 of 10 needed EDA-Probes complete' });
    expect(bar.querySelectorAll('span')).toHaveLength(10);
    expect(bar.querySelectorAll('span.on')).toHaveLength(1);
    // Needed EDA-Probes Data Hub does not run yet are coming, and still count (OP-ED-09).
    expect(side.getByText(/4 needed EDA-Probes are coming/)).toBeTruthy();
    const places = side.getAllByRole('listitem').slice(0, 4).map((item) => item.textContent);
    expect(places).toEqual(['The rows1 of 3 needed', 'The Key Fields0 of 4 complete', 'Two columns togetherNone needed', 'Other Resources0 of 1 needed']);
    expect(side.getByText('Best next step')).toBeTruthy();
    expect(side.getByText('Nulls per Key Field')).toBeTruthy();
    expect(side.getByRole('link', { name: /Add this EDA-Probe/ }).getAttribute('href')).toBe('/eda/r2/probes/nullsPerKeyField');
    const table = side.getByRole('heading', { name: 'The table as a whole' }).parentElement as HTMLElement;
    expect([...table.querySelectorAll('li')].map((item) => item.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'The grain holds Added',
      'Date range Needed',
      'Volume over time, with empty periods Needed',
      'Settling between EDA-Reruns On request · Coming',
    ]);
    const fields = side.getByRole('heading', { name: 'Per field' }).closest('section') as HTMLElement;
    const rows = [...fields.querySelectorAll('ul li')];
    expect(rows.map((row) => row.querySelector('.mono')?.textContent)).toEqual(['week_start', 'lead_source', 'lead_count', 'lead_channel', 'unique_applicants', 'loaded_at']);
    expect(rows[0]?.classList.contains('key')).toBe(true);
    expect(rows[4]?.classList.contains('key')).toBe(false);
    expect(within(rows[2] as HTMLElement).getByRole('img', { name: 'Gaps: needed, not set yet' })).toBeTruthy();
    expect(within(rows[2] as HTMLElement).getByRole('img', { name: 'Weight: needed, not set yet' })).toBeTruthy();
    expect(within(rows[0] as HTMLElement).getByRole('img', { name: 'Weight: not needed' })).toBeTruthy();
    expect(within(rows[0] as HTMLElement).getByRole('img', { name: 'Gaps: needed, not set yet' })).toBeTruthy();
  });

  it('shows on a card of Date range and Distribution of categories their result in a sentence and on their drawing (FR-ED-17, FR-ED-18)', async () => {
    show(viewOf({ grainHolds: GRAIN_HOLDS, dateRange: BEHIND, distributionOfCategories: CATEGORIES }));
    await screen.findByRole('heading', { level: 1, name: 'Weekly lead volume' });
    const range = within(step('Basis').getByRole('article', { name: 'Date range' }));
    expect(range.getByText('Look at this')).toBeTruthy();
    expect(range.getByText('The last week is week 44, 26 Oct: 3 weeks behind this one.')).toBeTruthy();
    expect(range.getByText('3 weeks behind')).toBeTruthy();
    expect(range.getByText('w44 2026')).toBeTruthy();
    expect(range.getByRole('link', { name: 'Date range' }).getAttribute('href')).toBe('/eda/r2/probes/dateRange');
    const categories = within(step('Weight').getByRole('article', { name: 'Distribution of categories' }));
    expect(categories.getByText('For you to judge')).toBeTruthy();
    expect(categories.getByRole('paragraph').textContent).toBe('In lead_source, 4 of 54 values bring 79% of lead_count. And 1 more field.');
    expect(categories.getByText('website weighs most, 41%')).toBeTruthy();
    expect(categories.getByText('Set on lead_source, lead_channel')).toBeTruthy();
  });

  it('shows the page for what may not be seen when the Resource has no EDA', async () => {
    show(null);
    expect(await screen.findByRole('heading', { level: 1, name: /Nothing here for you|niets voor jou/ })).toBeTruthy();
  });
});

describe('the list to add an EDA-Probe (FR-ED-13, DEC-UX-328)', () => {
  async function openList(view: EdaView, at: string) {
    show(view);
    await screen.findByRole('heading', { level: 1, name: 'Weekly lead volume' });
    await fireEvent.click(step(at).getByRole('button', { name: /Add probe/ }));
    return within(await screen.findByRole('dialog', { name: 'Add an EDA-Probe' }));
  }
  const group = (sheet: ReturnType<typeof within>, name: string) => within(sheet.getByRole('region', { name }));
  const rows = (sheet: ReturnType<typeof within>, name: string) => [...sheet.getByRole('region', { name }).querySelectorAll('.row')].map((row) => row.querySelector('b')?.textContent);

  it('opens at the EDA-Step of its tile, every EDA-Step in its order, with the search in focus', async () => {
    const sheet = await openList(viewOf({ grainHolds: GRAIN_HOLDS }), 'Gaps');
    expect(sheet.getAllByRole('region').map((region) => region.getAttribute('aria-label'))).toEqual(['Basis', 'Gaps', 'Weight', 'Correctness', 'Relations between fields']);
    const search = sheet.getByRole('searchbox', { name: /Search the EDA-Probes/ });
    expect(document.activeElement).toBe(search);
    const gaps = group(sheet, 'Gaps');
    expect(gaps.getByText('From its tile')).toBeTruthy();
    expect(gaps.getByText('0 of 3 needed complete')).toBeTruthy();
    expect(group(sheet, 'Basis').queryByText('From its tile')).toBeNull();
    expect(sheet.getByText(/^Weekly lead volume · model type/).textContent).toBe('Weekly lead volume · model type aggregate');
    expect(sheet.getByText(/An EDA-Probe that is not offered for/).textContent).toBe('An EDA-Probe that is not offered for aggregate is not listed.');
  });

  it('shows each EDA-Probe offered with its question for this Resource, how much it is asked for, and its state', async () => {
    const sheet = await openList(viewOf({ grainHolds: GRAIN_HOLDS, nullsPerKeyField: ran(['week_start', 'lead_source', 'lead_count'], NULLS.results.slice(0, 3).map((result) => [result.subject, result.data, result.reading])) }), 'Basis');
    expect(rows(sheet, 'Basis')).toEqual(['The grain holds', 'Date range', 'Volume over time, with empty periods', 'Settling between EDA-Reruns']);
    // Added, with Data Hub's reading.
    const grain = sheet.getByRole('link', { name: /The grain holds/ });
    expect(grain.textContent).toContain('Is every row one thing: one row per week_start, lead_source?');
    expect(grain.textContent).toContain('As expected');
    expect(grain.textContent).toContain('Added');
    expect(grain.getAttribute('href')).toBe('/eda/r2/probes/grainHolds');
    // Open, to add it.
    const volume = sheet.getByRole('link', { name: /Volume over time/ });
    expect(volume.textContent).toContain('How much comes in per week, and are there weeks without rows?');
    expect(volume.textContent).toContain('Needed');
    expect(volume.textContent).toContain('Open');
    // Date range runs now: Open, to add it, with its question for this Resource (FR-ED-18).
    const range = sheet.getByRole('link', { name: /Date range/ });
    expect(range.textContent).toContain('From when to when does it run, on week_start?');
    expect(range.textContent).toContain('Open');
    expect(range.getAttribute('href')).toBe('/eda/r2/probes/dateRange');
    // Coming: quieter, still Needed, and it opens nothing.
    const row = sheet.getByText('Disguised nulls').closest('.row') as HTMLElement;
    expect(row.tagName).toBe('DIV');
    expect(row.getAttribute('aria-disabled')).toBe('true');
    expect(row.textContent).toContain('Coming');
    expect(row.textContent).toContain('Needed');
    expect(sheet.queryByRole('link', { name: /Disguised nulls/ })).toBeNull();
    expect(sheet.getByText('Settling between EDA-Reruns').closest('.row')?.textContent).toContain('On request');
    // Set on part of what it needs.
    const nulls = sheet.getByRole('link', { name: /Nulls per Key Field/ });
    expect(nulls.textContent).toContain('Added, 3 of 4 Key Fields');
    expect(nulls.getAttribute('href')).toBe('/eda/r2/probes/nullsPerKeyField');
    // Not offered for an aggregate: not listed.
    expect(sheet.queryByText('How often things change')).toBeNull();
    expect(sheet.queryByText('Dates in order')).toBeNull();
  });

  it('filters on the needed ones, those Data Hub runs, or those added, and searches by name and question', async () => {
    const sheet = await openList(viewOf({ grainHolds: GRAIN_HOLDS }), 'Basis');
    await fireEvent.click(sheet.getByRole('radio', { name: 'Data Hub runs it' }));
    expect(sheet.getAllByRole('region').map((region) => region.getAttribute('aria-label'))).toEqual(['Basis', 'Gaps', 'Weight']);
    expect(rows(sheet, 'Basis')).toEqual(['The grain holds', 'Date range', 'Volume over time, with empty periods']);
    expect(rows(sheet, 'Weight')).toEqual(['Distribution of numbers', 'Distribution of categories']);
    await fireEvent.click(sheet.getByRole('radio', { name: 'Added' }));
    expect(rows(sheet, 'Basis')).toEqual(['The grain holds']);
    await fireEvent.click(sheet.getByRole('radio', { name: 'Needed' }));
    expect(rows(sheet, 'Weight')).toEqual(['Distribution of numbers', 'Distribution of categories', 'Spread']);
    await fireEvent.click(sheet.getByRole('radio', { name: 'All' }));
    await fireEvent.input(sheet.getByRole('searchbox'), { target: { value: 'empty' } });
    expect(sheet.getAllByRole('region').map((region) => region.getAttribute('aria-label'))).toEqual(['Basis', 'Gaps']);
    expect(rows(sheet, 'Gaps')).toEqual(['Nulls per Key Field', 'Where gaps cluster']);
    await fireEvent.input(sheet.getByRole('searchbox'), { target: { value: 'week_start' } });
    expect(rows(sheet, 'Basis')).toEqual(['The grain holds', 'Date range']);
    await fireEvent.input(sheet.getByRole('searchbox'), { target: { value: 'nothing like this' } });
    expect(sheet.getByText('No EDA-Probe fits what you look for.')).toBeTruthy();
  });

  it('closes by Close, and in Dutch asks its questions in Dutch, the names as they are', async () => {
    const sheet = await openList(viewOf(), 'Weight');
    await fireEvent.click(sheet.getAllByRole('button', { name: 'Close' }).at(-1) as HTMLElement);
    expect(screen.queryByRole('dialog', { name: 'Add an EDA-Probe' })).toBeNull();
    setLanguage('nl');
    try {
      const weight = within(await screen.findByRole('region', { name: 'Gewicht' }));
      await fireEvent.click(weight.getByRole('button', { name: /Probe toevoegen/ }));
      const dutch = within(await screen.findByRole('dialog', { name: 'Een EDA-Probe toevoegen' }));
      expect(dutch.getByText('Vanaf zijn tegel')).toBeTruthy();
      expect(dutch.getByRole('link', { name: /De grain klopt/ }).textContent).toContain('Is elke rij één ding: één rij per week_start, lead_source?');
      expect(dutch.getAllByText('Komt eraan').length).toBeGreaterThan(0);
    } finally {
      setLanguage('en');
    }
  });
});

describe('the detail of an EDA-Probe (FR-ED-06, DEC-UX-324)', () => {
  it('says what it does, with its drawing and Replay, its parameters and Run, and where its result will come', async () => {
    show(viewOf({ grainHolds: GRAIN_HOLDS }), { probe: 'nullsPerKeyField' });
    expect(await screen.findByRole('heading', { level: 2, name: 'Nulls per Key Field' })).toBeTruthy();
    expect(screen.getByText('Gaps · one column · needed for 4 · Explored')).toBeTruthy();
    expect(screen.getByRole('link', { name: /All EDA-Steps/ }).getAttribute('href')).toBe('/eda/r2');
    expect(screen.getByRole('img', { name: 'Nulls per Key Field, drawn on a small table' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Replay/ })).toBeTruthy();
    expect(screen.getByText('It counts, per field, the rows where nothing is filled in, and what share of all rows that is.')).toBeTruthy();
    const chips = [...document.querySelectorAll('.chip .mono')].map((chip) => chip.textContent);
    expect(chips).toEqual(['week_start', 'lead_source', 'lead_count', 'lead_channel']);
    expect(screen.getByText('The result comes here')).toBeTruthy();
    expect(screen.getByText('Adds it to the EDA and runs it now.')).toBeTruthy();
    // It folds to a strip, and back.
    await fireEvent.click(screen.getByRole('button', { name: 'Fold away what it does' }));
    expect(screen.queryByRole('button', { name: /Replay/ })).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: /What it does/ }));
    expect(screen.getByRole('button', { name: /Replay/ })).toBeTruthy();
  });

  it('runs, asks to approve what reads more than runs freely, runs again with the approval and shows its result', async () => {
    // It ran just now, whatever day the test runs on.
    const after = viewOf({ grainHolds: GRAIN_HOLDS, nullsPerKeyField: { ...NULLS, ranAt: new Date().toISOString() } });
    const { client, onchanged } = show(viewOf({ grainHolds: GRAIN_HOLDS }), { probe: 'nullsPerKeyField', answers: [{ state: 'approve', bytes: 840_000_000 }, { state: 'ran', eda: after }] });
    await fireEvent.click(await screen.findByRole('button', { name: /^Run$/ }));
    expect(client.run).toHaveBeenLastCalledWith('r2', 'nullsPerKeyField', { fields: ['week_start', 'lead_source', 'lead_count', 'lead_channel'] });
    const approve = await screen.findByRole('button', { name: /Approve and run/ });
    expect(screen.getByText(/more than runs at once: approve it, and it runs/)).toBeTruthy();
    await fireEvent.click(approve);
    expect(client.run).toHaveBeenLastCalledWith('r2', 'nullsPerKeyField', { fields: ['week_start', 'lead_source', 'lead_count', 'lead_channel'], approve: true });
    const result = within(await screen.findByRole('region', { name: 'Result' }));
    expect(onchanged).toHaveBeenCalled();
    expect(result.getAllByText('Look at this').length).toBeGreaterThan(0);
    expect(result.getByText(/Ran today, \d\d:\d\d by An Claes · read/)).toBeTruthy();
    // A row per field in the order of its Resource Card, its reading where there is something to read (DEC-UX-326).
    const rows = result.getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('.field .mono')?.textContent)).toEqual(['week_start', 'lead_source', 'lead_count', 'lead_channel']);
    expect(rows[0]?.textContent).toContain('Nothing to read');
    expect(rows[1]?.textContent).toContain('0.8%');
    expect(rows[1]?.textContent).toContain('130 of 16,224 empty');
    expect(rows[1]?.textContent).toContain('its role, grouped by, needs it on every row');
    expect(rows[3]?.textContent).toContain('For you to judge');
    expect(within(rows[3] as HTMLElement).getByRole('group', { name: 'Your reading of lead_channel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Run again/ })).toBeTruthy();
  });

  it('says why an EDA-Probe does not run', async () => {
    show(viewOf(), { probe: 'volumeOverTime', answers: [{ state: 'refused', bytes: 4_800_000_000, reason: 'It reads more than you may approve.' }] });
    await fireEvent.click(await screen.findByRole('button', { name: /^Run$/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('It does not run: It reads more than you may approve.');
  });

  it('keeps Run off where the grain is not recorded, and says who records it', async () => {
    show(viewOf({}, { ...WEEKLY, fields: WEEKLY.fields.map((field) => ({ ...field, grain: false })) }), { probe: 'grainHolds' });
    const run = await screen.findByRole('button', { name: /^Run$/ });
    expect((run as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('the Data Team records its grain first');
  });

  it('draws The grain holds: the grain values on more than one row on the wrong side, the numbers and examples (FR-ED-07)', async () => {
    show(viewOf({ grainHolds: GRAIN_TWICE }), { probe: 'grainHolds' });
    const result = within(await screen.findByRole('region', { name: 'Result' }));
    expect(result.getByText('34 grain values are on more than one row')).toBeTruthy();
    expect(result.getByText(/covering 70 of 16,260 rows/)).toBeTruthy();
    expect(result.getByRole('img', { name: 'How many grain values of week_start, lead_source are on one row, two rows, three rows or more' })).toBeTruthy();
    expect(result.getByText('wrong: on more than one row')).toBeTruthy();
    expect(result.getByText('Examples, the first 2 of 34')).toBeTruthy();
    expect(result.getAllByRole('row')).toHaveLength(3);
    expect(result.getByRole('group', { name: 'Your reading of the table as a whole' })).toBeTruthy();
  });

  it('draws Volume over time per date: the volume per block chosen on the chart, the empty period, and how calm per unit (FR-ED-09)', async () => {
    show(viewOf({ volumeOverTime: VOLUME }), { probe: 'volumeOverTime' });
    const block = within(await screen.findByRole('article', { name: 'week_start' }));
    expect(block.getByText(/The period from 1 Apr 2024 has no rows at all/)).toBeTruthy();
    expect(block.getByRole('img', { name: 'The volume per 7 days by week_start' })).toBeTruthy();
    expect(block.getByText('The sum of lead_count, per 7 days')).toBeTruthy();
    expect(block.getAllByText('1 Apr 2024 · no rows').length).toBeGreaterThan(0);
    const per = block.getByRole('radiogroup', { name: 'The blocks of days the volume of week_start is drawn in' });
    expect(within(per).getAllByRole('radio').map((radio) => radio.textContent?.trim())).toEqual(['7 days', '28 days']);
    await fireEvent.click(within(per).getByRole('radio', { name: '28 days' }));
    expect(block.getByRole('img', { name: 'The volume per 28 days by week_start' })).toBeTruthy();
    const calm = block.getByRole('img', { name: 'How far each unit swings around its own average' });
    expect(calm.querySelectorAll('title')[0]?.textContent).toBe('Per 7 days: average 2,061 ± 228 (11%), median 2,059 (P25 1,894, P75 2,236), lowest 980 (15 Jun 2026), highest 2,559 (6 Apr 2026)');
    // Counted per week, its period; the sum of what adds up can be left out.
    expect(screen.getByText(/Per week, its period/)).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: /The sum of lead_count/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('draws Distribution of numbers per field: the bins, the middle half, the median and the mean apart, and the tail (FR-ED-10)', async () => {
    const { client } = show(viewOf({ distributionOfNumbers: DISTRIBUTION }), { probe: 'distributionOfNumbers', answers: [{ state: 'ran', eda: viewOf({ distributionOfNumbers: DISTRIBUTION }) }] });
    const block = within(await screen.findByRole('article', { name: 'lead_count' }));
    expect(block.getByText('Half of the rows have up to 25')).toBeTruthy();
    expect(block.getByText(/the mean is 38, 52% higher/)).toBeTruthy();
    expect(block.getByText('median 25')).toBeTruthy();
    expect(block.getByText('mean 38')).toBeTruthy();
    expect(block.getByText('the tail pulls the mean up')).toBeTruthy();
    expect(block.getByText('120+')).toBeTruthy();
    expect([...block.getByRole('img', { name: /How the values of lead_count are spread/ }).querySelectorAll('rect.bin')]).toHaveLength(12);
    // A bin changed by the User goes with the next run, per field (DEC-ED-24).
    await fireEvent.input(screen.getByRole('spinbutton', { name: 'The width of the bins of lead_count' }), { target: { value: '5' } });
    await fireEvent.click(screen.getByRole('button', { name: /Run again/ }));
    expect(client.run).toHaveBeenLastCalledWith('r2', 'distributionOfNumbers', { fields: ['lead_count'], params: { width: { lead_count: 5 } } });
  });

  it('sets Distribution of categories on the texts among the Key Fields, weighed by the number that adds up or by rows (FR-ED-17, DEC-ED-33)', async () => {
    const { client } = show(viewOf({ grainHolds: GRAIN_HOLDS }), { probe: 'distributionOfCategories', answers: [{ state: 'ran', eda: viewOf({ distributionOfCategories: CATEGORIES }) }] });
    expect(await screen.findByRole('heading', { level: 2, name: 'Distribution of categories' })).toBeTruthy();
    expect(screen.getByText('Weight · one column · needed for 4 · Explored')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Distribution of categories, drawn on a small table' })).toBeTruthy();
    expect(screen.getByText('each value counted, the most first')).toBeTruthy();
    expect(screen.getByText(/^It counts, per text field, how much each value brings/)).toBeTruthy();
    expect([...document.querySelectorAll('.chip .mono')].map((chip) => chip.textContent)).toEqual(['lead_source', 'lead_channel']);
    // Weighed by the number that adds up, as for an aggregate it starts; a unique count is not offered.
    const weigh = screen.getByRole('combobox', { name: 'Weighed by' }) as HTMLSelectElement;
    expect([...weigh.options].map((option) => option.textContent)).toEqual(['The sum of lead_count', 'Rows']);
    expect(weigh.value).toBe('lead_count');
    expect(screen.getByText(/A unique count, such as/).textContent).toContain('unique_applicants, never adds up, so it is not offered.');
    expect(screen.getByText('The top 10 of each field, the rest together, and the empty values apart.')).toBeTruthy();
    expect(screen.getByText(/Variants of one category/)).toBeTruthy();
    expect(screen.getByText('lead_source, lead_channel, lead_count').parentElement?.textContent).toContain('over its whole history');
    // Rows instead goes with the run, as eda takes it: null.
    await fireEvent.change(weigh, { target: { value: '' } });
    await fireEvent.click(screen.getByRole('button', { name: /^Run$/ }));
    expect(client.run).toHaveBeenLastCalledWith('r2', 'distributionOfCategories', { fields: ['lead_source', 'lead_channel'], params: { weighedBy: null } });
  });

  it('draws Distribution of categories per field: the heaviest values with their share, the others, the empty ones apart (FR-ED-17)', async () => {
    show(viewOf({ distributionOfCategories: CATEGORIES }), { probe: 'distributionOfCategories' });
    const result = within(await screen.findByRole('region', { name: 'Result' }));
    // Always for you to judge (DEC-ED-33).
    expect(result.getAllByText('For you to judge')).toHaveLength(3);
    expect(document.querySelector('.conclusion')?.textContent).toBe('In lead_source, 4 of 54 values bring 79% of lead_count. In lead_channel, web and mobile bring 69% of lead_count.');
    expect(screen.getAllByRole('article').map((block) => block.getAttribute('aria-label'))).toEqual(['lead_source', 'lead_channel']);
    const source = within(screen.getByRole('article', { name: 'lead_source' }));
    expect(source.getByText('grouped by · mapped to an Entity')).toBeTruthy();
    expect(source.getByText(/^4 of 54 values bring 79% of/).closest('p')?.textContent).toBe('4 of 54 values bring 79% of lead_count. 31 values bring less than 0.1% each. 0.1% of lead_count has no value.');
    const bars = source.getByRole('list', { name: 'The values of lead_source, the heaviest first, with their share' });
    const items = within(bars).getAllByRole('listitem');
    const said = (item: HTMLElement | undefined) => item?.textContent?.replace(/\s+/g, ' ').trim();
    expect(items).toHaveLength(12);
    expect(said(items[0])).toBe('website 41%');
    expect(items[0]?.getAttribute('title')).toBe('website: 259,407, 41%');
    expect(said(items[10])).toBe('44 others 5.4%');
    expect(said(items[11])).toBe('empty 0.1%');
    expect(source.getByText('Share of 632,700, the sum of').textContent).toContain('lead_count');
    const numbers = [...(source.getByText('Values').closest('dl') as HTMLElement).querySelectorAll('div')].map((pair) => [pair.querySelector('dt')?.textContent, pair.querySelector('dd')?.textContent]);
    expect(numbers).toEqual([
      ['Values', '54'],
      ['The top 4', '79%'],
      ['Below 0.1% each', '31'],
      ['Empty', '0.1%'],
    ]);
    expect(source.getByRole('group', { name: 'Your reading of lead_source' })).toBeTruthy();
    const channel = within(screen.getByRole('article', { name: 'lead_channel' }));
    expect(channel.getByText('no role')).toBeTruthy();
    // The values go in as names, as they are.
    expect(screen.getByRole('article', { name: 'lead_channel' }).querySelector('.sentence')?.textContent).toBe('web and mobile bring 69% of lead_count. 1 value brings less than 0.1% each. 12% of lead_count has no value.');
    expect([...(screen.getByRole('article', { name: 'lead_channel' }).querySelectorAll('.sentence .mono') ?? [])].map((name) => name.textContent)).toEqual(['web', 'mobile', 'lead_count', 'lead_count']);
    expect(said(within(channel.getByRole('list')).getAllByRole('listitem').at(-1))).toBe('empty 12%');
    cleanup();

    setLanguage('nl');
    try {
      show(viewOf({ distributionOfCategories: CATEGORIES }), { probe: 'distributionOfCategories' });
      const block = within(await screen.findByRole('article', { name: 'lead_source' }));
      expect(block.getByText('Aandeel van 632.700, de som van').textContent).toContain('lead_count');
      expect(block.getByText(/^4 van 54 waarden brengen 79% van/)).toBeTruthy();
    } finally {
      setLanguage('en');
    }
  });

  it('draws Date range per date: from its first value to today, up to date with nothing to read (FR-ED-18, DEC-ED-34)', async () => {
    show(viewOf({ dateRange: UP_TO_DATE }), { probe: 'dateRange' });
    const result = within(await screen.findByRole('region', { name: 'Result' }));
    expect(screen.getByText('Basis · the rows · needed for 4 · Explored')).toBeTruthy();
    expect(screen.getByText('the first, the last, and today')).toBeTruthy();
    expect(screen.getByText(/^When the last is this week or the one before/)).toBeTruthy();
    expect(screen.getByText(/Weeks without rows in between: Volume over time\.$/)).toBeTruthy();
    expect(result.getAllByText('As expected').length).toBeGreaterThan(0);
    expect(document.querySelector('.conclusion')?.textContent).toBe(
      'From week 1 of 2021 to this week, week 47 of 2026: 307 weeks, up to date. The first 208 weeks lie before its Reliable Since, 1 Jan 2025.',
    );
    const block = within(result.getByRole('article', { name: 'week_start' }));
    expect(block.getByText('period · a week from Monday')).toBeTruthy();
    const line = block.getByRole('img', { name: 'week_start from its first value to today' });
    expect(within(line).getByText('Reliable Since 1 Jan 2025')).toBeTruthy();
    expect(within(line).getByText('week 1 of 2021, 4 Jan')).toBeTruthy();
    expect(within(line).getByText('last: week 47, 16 Nov · this week')).toBeTruthy();
    expect(within(line).getByText('2025')).toBeTruthy();
    // Each number with what it means under it.
    const numbers = [...block.getAllByRole('definition')].map((one) => [one.firstChild?.textContent?.trim(), one.querySelector('small')?.textContent]);
    expect(numbers).toEqual([
      ['week 1 of 2021', '4 Jan 2021'],
      ['week 47 of 2026', expect.stringMatching(/^16 Nov( 2026)?, this week$/)],
      ['307', 'with rows or without'],
      ['none', 'the last is this week'],
      ['208 weeks', '1 Jan 2025, on its Resource Card'],
    ]);
    expect([...block.getAllByRole('term')].map((one) => one.textContent)).toEqual(['First', 'Last', 'Weeks between', 'Behind', 'Before Reliable Since']);
    // Up to date has nothing to read (DEC-UX-326).
    expect(block.queryByRole('group', { name: /Your reading/ })).toBeNull();
  });

  it('reads a date behind as look at this, the part behind hatched and named, and asks for a reading (FR-ED-18, DEC-ED-34)', async () => {
    show(viewOf({ dateRange: BEHIND }), { probe: 'dateRange' });
    const result = within(await screen.findByRole('region', { name: 'Result' }));
    expect(result.getAllByText('Look at this').length).toBeGreaterThan(0);
    expect(document.querySelector('.conclusion')?.textContent).toBe(
      'The last week is week 44, 26 Oct: 3 weeks behind this one. From week 1 of 2021, 303 weeks; is it still loaded? The first 208 weeks lie before its Reliable Since, 1 Jan 2025.',
    );
    const block = within(result.getByRole('article', { name: 'week_start' }));
    const line = block.getByRole('img', { name: 'week_start from its first value to today' });
    expect(within(line).getByText('3 weeks behind')).toBeTruthy();
    expect(within(line).getByText('last: week 44, 26 Oct')).toBeTruthy();
    expect(line.querySelector('rect[fill^="url(#eda-range-hatch"]')).toBeTruthy();
    expect(block.getByText('3 weeks').classList.contains('warn')).toBe(true);
    expect(block.getByRole('group', { name: 'Your reading of week_start' })).toBeTruthy();
  });

  it('keeps the reading of who works on the EDA, with who gave it (FR-ED-11)', async () => {
    const { client, onchanged } = show(viewOf({ nullsPerKeyField: NULLS }), { probe: 'nullsPerKeyField' });
    const reading = within(await screen.findByRole('group', { name: 'Your reading of lead_source' }));
    await fireEvent.click(reading.getByRole('button', { name: /Known/ }));
    expect(client.read).toHaveBeenCalledWith('r2', 'nullsPerKeyField', 'lead_source', 'known');
    await waitFor(() => expect(reading.getByRole('button', { name: /Known/ }).getAttribute('aria-pressed')).toBe('true'));
    expect(reading.getByText('Read by An Claes on 21 Nov')).toBeTruthy();
    expect(onchanged).toHaveBeenCalled();
  });
});

describe('the result of an EDA-Probe, on its own (OP-ED-12)', () => {
  it('draws from a run alone, without the page, its form or its route, and asks no reading without a way to keep one', () => {
    render(EdaResult, { probe: 'nullsPerKeyField', run: NULLS, resource: WEEKLY });
    const result = within(screen.getByRole('region', { name: 'Result' }));
    expect(result.getByText(/Ran .* by An Claes · read 300 kB/)).toBeTruthy();
    expect(document.querySelector('.conclusion')?.textContent).toBe(
      'lead_source is empty on 130 rows, though its role, grouped by, needs it on every row. lead_channel is empty on 12% of rows. week_start, lead_count are always filled.',
    );
    const rows = result.getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('.field .mono')?.textContent)).toEqual(['week_start', 'lead_source', 'lead_count', 'lead_channel']);
    expect(rows[3]?.textContent).toContain('For you to judge');
    expect(result.queryByRole('group', { name: /Your reading/ })).toBeNull();
    expect(result.queryByText('Nothing to read')).toBeNull();
    // The whole table: no line on the rows it ran on.
    expect(screen.queryByText(/On the rows where/)).toBeNull();
    cleanup();

    // Every EDA-Probe that runs draws the same way, here Volume over time with its blocks of days.
    render(EdaResult, { probe: 'volumeOverTime', run: VOLUME, resource: WEEKLY });
    expect(within(screen.getByRole('article', { name: 'week_start' })).getByRole('img', { name: 'The volume per 7 days by week_start' })).toBeTruthy();
  });

  it('keeps a reading through whoever shows it', async () => {
    const onread = vi.fn(async () => true);
    render(EdaResult, { probe: 'nullsPerKeyField', run: NULLS, resource: WEEKLY, onread });
    const reading = within(screen.getByRole('group', { name: 'Your reading of lead_channel' }));
    await fireEvent.click(reading.getByRole('button', { name: /A problem/ }));
    expect(onread).toHaveBeenCalledWith('lead_channel', 'problem');
    expect(screen.getAllByText('Nothing to read')).toHaveLength(2);
  });

  it('names the rows of a selection above the result, in words, the fields as names', () => {
    const line = () => screen.getByText(/^On the rows where/).closest('p') as HTMLElement;
    render(EdaResult, { probe: 'disguisedNulls', run: { ...DISGUISED, selection: { where: [{ kind: 'saysNothing', field: 'lead_channel' }] } }, resource: WEEKLY });
    expect(line().textContent?.trim()).toBe('On the rows where lead_channel says nothing');
    expect([...line().querySelectorAll('.mono')].map((name) => name.textContent)).toEqual(['lead_channel']);
    cleanup();

    // A selection given apart from the run says which rows; a value, a range of days and a number from a bound.
    render(EdaResult, {
      probe: 'disguisedNulls',
      run: DISGUISED,
      resource: WEEKLY,
      selection: {
        where: [
          { kind: 'equals', field: 'lead_source', value: 'app' },
          { kind: 'range', field: 'week_start', from: '2024-01-01', before: '2025-01-06' },
          { kind: 'range', field: 'lead_count', from: 10 },
        ],
      },
    });
    expect(line().textContent?.trim()).toBe('On the rows where lead_source is app and week_start is on or after 1 Jan 2024 and before 6 Jan 2025 and lead_count is at least 10');
    cleanup();

    // No condition is the whole table.
    render(EdaResult, { probe: 'disguisedNulls', run: DISGUISED, resource: WEEKLY, selection: { where: [] } });
    expect(screen.queryByText(/On the rows where/)).toBeNull();
    cleanup();

    setLanguage('nl');
    try {
      render(EdaResult, { probe: 'disguisedNulls', run: { ...DISGUISED, selection: { where: [{ kind: 'saysNothing', field: 'lead_channel' }, { kind: 'range', field: 'week_start', before: '2025-01-06' }] } }, resource: WEEKLY });
      expect(screen.getByText(/^Op de rijen waar/).closest('p')?.textContent?.trim()).toBe('Op de rijen waar lead_channel niets zegt en week_start vóór 6 jan 2025 valt');
    } finally {
      setLanguage('en');
    }
  });
});

describe('Disguised nulls (DEC-ED-35)', () => {
  const lookFor = () => within(screen.getByText('Looks for').closest('div') as HTMLElement);
  const chipsOf = (kind: string) => {
    const label = lookFor().getByText(kind);
    return [...(label.nextElementSibling as HTMLElement).querySelectorAll('.lk')].map((chip) => chip.textContent?.trim());
  };

  it('says what it does, is set on every Key Field, and shows what it looks for per kind of field', async () => {
    show(runnable(viewOf({ grainHolds: GRAIN_HOLDS })), { probe: 'disguisedNulls' });
    expect(await screen.findByRole('heading', { level: 2, name: 'Disguised nulls' })).toBeTruthy();
    expect(screen.getByText('Gaps · one column · needed for 4 · Explored')).toBeTruthy();
    const drawing = screen.getByRole('img', { name: 'Disguised nulls, drawn on a small table' });
    expect(within(drawing).getByText('filled, but with nothing in it')).toBeTruthy();
    expect(within(drawing).getByText('n/a')).toBeTruthy();
    // A date field of the drawing shows a date that says nothing.
    expect(within(drawing).queryAllByText(/^(1900-01-01|9999-12-31|unknown)$/).length).toBeGreaterThan(0);
    expect(screen.getByText(/^It counts, per field, the rows that say nothing/)).toBeTruthy();
    expect([...document.querySelectorAll('.chip .mono')].map((chip) => chip.textContent)).toEqual(['week_start', 'lead_source', 'lead_count', 'lead_channel']);
    // Every Key Field, as Nulls per Key Field: none says needed apart, none can be taken off.
    expect(document.querySelectorAll('.chip .note')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull();
    expect(screen.getByText('All its Key Fields, as Nulls per Key Field; any other field can be added.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a field' })).toBeTruthy();
    // What it looks for, Data Hub's list per kind of field.
    expect(chipsOf('In a text')).toEqual(['empty text', 'only spaces', 'n/a', 'na', 'null', 'none', 'unknown', 'onbekend', '-', '?', 'tbd']);
    expect(chipsOf('In a date')).toEqual(['1900-01-01', '1970-01-01', '0001-01-01', '9999-12-31']);
    expect(chipsOf('In a number')).toEqual(['-1', '999…9']);
    expect(lookFor().getByRole('button', { name: /Add a value/ })).toBeTruthy();
    expect(lookFor().getByRole('button', { name: /Add a date/ })).toBeTruthy();
    expect(lookFor().getByRole('button', { name: /Add a number/ })).toBeTruthy();
    // The empty text and only spaces always count: they cannot be taken out.
    expect(lookFor().queryByRole('button', { name: 'Take out empty text' })).toBeNull();
    expect(lookFor().getByText(/Capitals and spaces around a text do not matter\. 0 is never one/)).toBeTruthy();
    expect(screen.getByText(/^Only the empty values, apart: Nulls per Key Field\. One value written two ways/)).toBeTruthy();
    expect(screen.getByText(/^Run it, and a row per field appears here: the values it found that say nothing/)).toBeTruthy();
  });

  it('runs with Data Hub\'s lists as they are, and sends the lists with the next run once they change (DEC-ED-35)', async () => {
    const ran = runnable(viewOf({ grainHolds: GRAIN_HOLDS, disguisedNulls: DISGUISED }));
    const { client } = show(runnable(viewOf({ grainHolds: GRAIN_HOLDS })), { probe: 'disguisedNulls', answers: [{ state: 'ran', eda: ran }, { state: 'ran', eda: ran }] });
    await fireEvent.click(await screen.findByRole('button', { name: /^Run$/ }));
    expect(client.run).toHaveBeenLastCalledWith('r2', 'disguisedNulls', { fields: ['week_start', 'lead_source', 'lead_count', 'lead_channel'] });
    await screen.findByRole('region', { name: 'Result' });
    // Take out a value that is real here, add one this table uses; one already there, whatever its capitals, is not added twice.
    await fireEvent.click(lookFor().getByRole('button', { name: 'Take out n/a' }));
    await fireEvent.click(lookFor().getByRole('button', { name: /Add a value/ }));
    const text = lookFor().getByRole('textbox', { name: 'A value that says nothing' });
    await fireEvent.input(text, { target: { value: ' leeg ' } });
    await fireEvent.keyDown(text, { key: 'Enter' });
    await fireEvent.input(text, { target: { value: 'UNKNOWN' } });
    await fireEvent.keyDown(text, { key: 'Enter' });
    await fireEvent.keyDown(text, { key: 'Escape' });
    expect(chipsOf('In a text')).toEqual(['empty text', 'only spaces', 'na', 'null', 'none', 'unknown', 'onbekend', '-', '?', 'tbd', 'leeg']);
    await fireEvent.click(lookFor().getByRole('button', { name: 'Take out 1970-01-01' }));
    // 0 never says nothing; -99 is added on leaving the field.
    await fireEvent.click(lookFor().getByRole('button', { name: /Add a number/ }));
    const typed = lookFor().getByRole('spinbutton', { name: 'A number that says nothing' });
    await fireEvent.input(typed, { target: { value: '0' } });
    await fireEvent.keyDown(typed, { key: 'Enter' });
    expect(lookFor().getByRole('status').textContent).toBe('0 never says nothing: a zero is a value.');
    await fireEvent.input(typed, { target: { value: '-99' } });
    await fireEvent.blur(typed);
    await fireEvent.click(lookFor().getByRole('button', { name: 'Take out 999…9' }));
    expect(chipsOf('In a number')).toEqual(['-1', '-99', '999…9']);
    expect(lookFor().getByRole('button', { name: 'Look for nines only again' })).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: /Run again/ }));
    expect(client.run).toHaveBeenLastCalledWith('r2', 'disguisedNulls', {
      fields: ['week_start', 'lead_source', 'lead_count', 'lead_channel'],
      params: { lists: { text: ['na', 'null', 'none', 'unknown', 'onbekend', '-', '?', 'tbd', 'leeg'], date: ['1900-01-01', '0001-01-01', '9999-12-31'], number: [-1, -99], ninesOnly: false } },
    });
  });

  it('starts from the lists kept with the EDA, and sends them again with every run', async () => {
    const lists = { text: ['n/a'], date: [], number: [-1], ninesOnly: false };
    const view = runnable(viewOf({ disguisedNulls: { ...DISGUISED, params: { lists } } }));
    const { client } = show(view, { probe: 'disguisedNulls', answers: [{ state: 'ran', eda: view }] });
    await screen.findByRole('region', { name: 'Result' });
    expect(chipsOf('In a text')).toEqual(['empty text', 'only spaces', 'n/a']);
    expect(chipsOf('In a date')).toEqual([]);
    await fireEvent.click(screen.getByRole('button', { name: /Run again/ }));
    expect(client.run).toHaveBeenLastCalledWith('r2', 'disguisedNulls', { fields: DISGUISED.fields, params: { lists } });
  });

  it('shows a row per field: what says nothing with its rows, how many rows say nothing, and its reading', async () => {
    const { client } = show(runnable(viewOf({ disguisedNulls: DISGUISED })), { probe: 'disguisedNulls' });
    const result = within(await screen.findByRole('region', { name: 'Result' }));
    expect(result.getAllByText('Look at this').length).toBeGreaterThan(0);
    expect(document.querySelector('.conclusion')?.textContent).toBe(
      'lead_source says nothing on 182 rows, though its role, grouped by, needs a real value on every row. In lead_channel, 16% of rows say nothing, null the most. week_start, lead_count always say something.',
    );
    const rows = result.getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('.field .mono')?.textContent)).toEqual(['week_start', 'lead_source', 'lead_count', 'lead_channel']);
    const values = (row: Element | undefined) => [...(row?.querySelectorAll('.value') ?? [])].map((value) => [value.firstElementChild?.textContent, value.querySelector('small')?.textContent]);
    // The values found with their rows, null first, the empty text in words.
    expect(values(rows[3])).toEqual([
      ['null', '1,947'],
      ['unknown', '412'],
      ['n/a', '211'],
      ['empty text', '38'],
    ]);
    expect(rows[3]?.querySelector('.value .word')?.textContent).toBe('null');
    expect(rows[3]?.textContent).toContain('16%');
    expect(rows[3]?.textContent).toContain('2,608 rows say nothing');
    expect(rows[3]?.textContent).toContain('For you to judge');
    expect(rows[3]?.textContent).toContain('no role needs it');
    expect(within(rows[3] as HTMLElement).getByRole('img', { name: '16% says nothing' })).toBeTruthy();
    // A field with a role reads look at this, as Nulls per Key Field does (DEC-ED-22).
    expect(values(rows[1])).toEqual([
      ['null', '130'],
      ['unknown', '52'],
    ]);
    expect(rows[1]?.textContent).toContain('1.1%');
    expect(rows[1]?.textContent).toContain('Look at this');
    expect(rows[1]?.textContent).toContain('its role, grouped by, needs a real value');
    // Every row says something: as expected, and nothing to read.
    expect(values(rows[0])).toEqual([]);
    expect(rows[0]?.textContent).toContain('none found');
    expect(rows[0]?.textContent).toContain('0 rows say nothing');
    expect(rows[0]?.textContent).toContain('every row says something');
    expect(rows[0]?.textContent).toContain('Nothing to read');
    expect(within(rows[0] as HTMLElement).queryByRole('group')).toBeNull();
    const reading = within(within(rows[3] as HTMLElement).getByRole('group', { name: 'Your reading of lead_channel' }));
    await fireEvent.click(reading.getByRole('button', { name: /Known/ }));
    expect(client.read).toHaveBeenCalledWith('r2', 'disguisedNulls', 'lead_channel', 'known');
    cleanup();

    setLanguage('nl');
    try {
      show(runnable(viewOf({ disguisedNulls: DISGUISED })), { probe: 'disguisedNulls' });
      const dutch = within(await screen.findByRole('region', { name: 'Resultaat' }));
      const channel = dutch.getAllByRole('listitem')[3] as HTMLElement;
      expect(values(channel)[0]).toEqual(['geen waarde', '1.947']);
      expect(values(channel)[3]).toEqual(['lege tekst', '38']);
      expect(channel.textContent).toContain('2.608 rijen zeggen niets');
      expect(document.querySelector('.conclusion')?.textContent).toContain('In lead_channel zegt 16% van de rijen niets, geen waarde het meest.');
    } finally {
      setLanguage('en');
    }
  });

  it('shows on its card how many fields say nothing, the values found written dashed in its drawing', async () => {
    show(runnable(viewOf({ grainHolds: GRAIN_HOLDS, disguisedNulls: DISGUISED })));
    await screen.findByRole('heading', { level: 1, name: 'Weekly lead volume' });
    const card = within(step('Gaps').getByRole('article', { name: 'Disguised nulls' }));
    expect(card.getByText('Look at this')).toBeTruthy();
    expect(card.getByRole('paragraph').textContent).toBe('2 fields say nothing on some rows: lead_channel the most, 16% of its rows.');
    const drawing = within(card.getByRole('img', { name: 'Disguised nulls' }));
    expect(drawing.getByText('2 fields with rows that say nothing')).toBeTruthy();
    expect(drawing.getAllByText('unknown').length).toBeGreaterThan(0);
    expect(drawing.getByText('n/a')).toBeTruthy();
    expect(card.getByRole('link', { name: 'Disguised nulls' }).getAttribute('href')).toBe('/eda/r2/probes/disguisedNulls');
    cleanup();

    const clean = ran(DISGUISED.fields, DISGUISED.fields.map((field) => [field, { rows: 16224, saysNothing: 0, nulls: 0, found: [], role: null }, 'expected']));
    show(runnable(viewOf({ disguisedNulls: clean })));
    await screen.findByRole('heading', { level: 1, name: 'Weekly lead volume' });
    const quiet = within(step('Gaps').getByRole('article', { name: 'Disguised nulls' }));
    expect(quiet.getByRole('paragraph').textContent).toBe('Every row says something in all 4 fields.');
    expect(quiet.getByText('every value says something')).toBeTruthy();
  });
});

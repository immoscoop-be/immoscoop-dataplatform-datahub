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
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { EdaClient } from '../lib/eda.js';
import type { EdaTab } from '../lib/routes.js';
import { TEXTS } from '../texts/index.js';
import EdaPage from './EdaPage.svelte';

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

  it('says on Profile what will come there', async () => {
    show(viewOf(), { tab: 'profile' });
    expect(await screen.findByRole('heading', { level: 3, name: 'The Profile comes once the EDA-Setup is complete' })).toBeTruthy();
  });

  it('shows a row per EDA-Step with how many needed EDA-Probes are complete, its cards, and one Add probe that opens the first to add, needed first', async () => {
    show(viewOf({ grainHolds: GRAIN_HOLDS }));
    await screen.findByRole('heading', { level: 1, name: 'Weekly lead volume' });
    expect(screen.getAllByRole('region').map((region) => region.getAttribute('aria-label')).slice(0, 5)).toEqual(['Basis', 'Gaps', 'Weight', 'Correctness', 'Relations between fields']);
    const basis = step('Basis');
    expect(basis.getByText('1 of 4 needed')).toBeTruthy();
    const card = within(basis.getByRole('article', { name: 'The grain holds' }));
    expect(card.getByText('As expected')).toBeTruthy();
    expect(card.getByText(/none twice in 16,224 rows/)).toBeTruthy();
    expect(card.getByText('Set on week_start, lead_source')).toBeTruthy();
    expect(basis.getByRole('link', { name: /Add probe/ }).getAttribute('href')).toBe('/eda/r2/probes/volumeOverTime');
    expect(basis.getByRole('link', { name: /Add probe/ }).textContent).toContain('3 needed still in Basis');
    expect(step('Gaps').getByText('0 of 2 needed')).toBeTruthy();
    expect(step('Gaps').getByRole('link', { name: /Add probe/ }).getAttribute('href')).toBe('/eda/r2/probes/nullsPerKeyField');
    // Correctness has no EDA-Probe Data Hub runs yet: no tile (OP-UX-119).
    expect(step('Correctness').queryByRole('link', { name: /Add probe/ })).toBeNull();
    expect(step('Correctness').getByText('No EDA-Probe of this EDA-Step runs yet: they are coming.')).toBeTruthy();
    expect(step('Relations between fields').getByText('None needed')).toBeTruthy();
  });

  it('shows on the right the needed EDA-Probes complete, the four places, the best next step, the table as a whole and every field (DEC-UX-322, DEC-UX-323)', async () => {
    show(viewOf({ grainHolds: GRAIN_HOLDS }));
    const side = within(await screen.findByRole('complementary', { name: 'EDA-Setup' }));
    expect(side.getByText('1 of 10')).toBeTruthy();
    const bar = side.getByRole('img', { name: '1 of 10 needed EDA-Probes complete' });
    expect(bar.querySelectorAll('span')).toHaveLength(10);
    expect(bar.querySelectorAll('span.on')).toHaveLength(1);
    // Needed EDA-Probes Data Hub does not run yet are coming, and still count (OP-ED-09).
    expect(side.getByText(/6 needed EDA-Probes are coming/)).toBeTruthy();
    const places = side.getAllByRole('listitem').slice(0, 4).map((item) => item.textContent);
    expect(places).toEqual(['The rows1 of 4 needed', 'The Key Fields0 of 4 complete', 'Two columns togetherNone needed', 'Other ResourcesNone needed']);
    expect(side.getByText('Best next step')).toBeTruthy();
    expect(side.getByText('Nulls per Key Field')).toBeTruthy();
    expect(side.getByRole('link', { name: /Add this EDA-Probe/ }).getAttribute('href')).toBe('/eda/r2/probes/nullsPerKeyField');
    const table = side.getByRole('heading', { name: 'The table as a whole' }).parentElement as HTMLElement;
    expect([...table.querySelectorAll('li')].map((item) => item.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'The grain holds Added',
      'Row count Needed · Coming',
      'Date range Needed · Coming',
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

  it('shows the page for what may not be seen when the Resource has no EDA', async () => {
    show(null);
    expect(await screen.findByRole('heading', { level: 1, name: /Nothing here for you|niets voor jou/ })).toBeTruthy();
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
    const after = viewOf({ grainHolds: GRAIN_HOLDS, nullsPerKeyField: NULLS });
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

import {
  appliesTo,
  bestNext,
  coverage,
  isComplete,
  isNeeded,
  levelOf,
  neededOf,
  PROBE_KEYS,
  PROBES,
  probesFor,
  type EdaResource,
  type EdaView,
  type ProbeKey,
  type RunView,
} from '@datahub/contracts/eda';
import { addTexts, setLanguage } from '@datahub/ui/foundations/texts.svelte.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { TEXTS } from '../texts/index.js';
import { edaFlowOf } from './edaFlow.js';
import { askOf, saidText } from './edaWords.js';

beforeAll(() => {
  addTexts(TEXTS);
  setLanguage('en');
});

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
    { name: 'loaded_at', dataType: 'TIMESTAMP', keyField: false, role: null, grain: false, mapped: false },
  ],
};
const AN = { id: '2', name: 'An Claes' };

function run(fields: string[], results: RunView['results']): RunView {
  return { id: `run-${fields.join('-')}`, ranAt: '2026-11-21T10:42:00Z', ranBy: AN, bytes: 1000, fields, params: {}, results };
}
const GRAIN = run(['week_start', 'lead_source'], [
  { subject: '', data: { rows: 16224, values: 16224, onMoreThanOne: 0, rowsCovered: 0, emptyGrain: 0, buckets: [16224, 0, 0, 0], examples: [] }, reading: 'expected', yours: null },
]);
const NULLS_PART = run(['week_start', 'lead_source', 'lead_count'], [
  { subject: 'week_start', data: { rows: 16224, empty: 0, role: 'period' }, reading: 'expected', yours: null },
  { subject: 'lead_source', data: { rows: 16224, empty: 0, role: 'groupedBy' }, reading: 'expected', yours: null },
  { subject: 'lead_count', data: { rows: 16224, empty: 0, role: 'addsUp' }, reading: 'expected', yours: null },
]);

/** The EDA as eda answers it, from the rules of the contracts. */
function viewOf(runs: Partial<Record<ProbeKey, RunView>> = {}): EdaView {
  const covers = Object.entries(runs).map(([probe, one]) => ({ probe: probe as ProbeKey, fields: one.fields }));
  return {
    resource: { ...WEEKLY, collection: { id: 'c1', name: 'Credit leads' } },
    status: 'inProgress',
    startedBy: AN,
    startedAt: '2026-11-21T09:00:00Z',
    exploredAt: null,
    needed: neededOf(WEEKLY, covers),
    probes: probesFor(WEEKLY.modelType).map((key) => ({
      key,
      level: levelOf(key, WEEKLY.modelType) ?? 'could',
      runs: PROBES[key].runs,
      needed: isNeeded(key, WEEKLY),
      added: runs[key] !== undefined,
      complete: isComplete(key, WEEKLY, covers),
      applies: appliesTo(key, WEEKLY),
      fields: runs[key]?.fields ?? [],
      params: {},
      lastRun: runs[key] ?? null,
    })),
    coverage: coverage(WEEKLY, covers),
    next: bestNext(WEEKLY, covers),
  };
}

describe('the guide of an EDA in the Flow Box (FR-ED-14, DEC-UX-327)', () => {
  it('has one step per needed EDA-Probe, in the order of the EDA-Steps and grouped under them, the coming ones counted', () => {
    const flow = edaFlowOf(viewOf());
    expect(flow.steps.map((step) => [step.number, step.group, step.name])).toEqual([
      [1, 'Basis', 'The grain holds'],
      [2, 'Basis', 'Date range'],
      [3, 'Basis', 'Volume over time, with empty periods'],
      [4, 'Gaps', 'Nulls per Key Field'],
      [5, 'Gaps', 'Disguised nulls'],
      [6, 'Gaps', 'Values without a match'],
      [7, 'Weight', 'Distribution of numbers'],
      [8, 'Weight', 'Distribution of categories'],
      [9, 'Weight', 'Spread'],
      [10, 'Correctness', 'Impossible values'],
    ]);
    // Date range, Distribution of categories and Disguised nulls run now (FR-ED-17, FR-ED-18, FR-ED-19): 3 of the 10 are still coming.
    expect(flow.steps.filter((step) => step.coming).map((step) => step.id)).toEqual(['valuesWithoutAMatch', 'spread', 'impossibleValues']);
    expect(flow.steps.find((step) => step.id === 'valuesWithoutAMatch')).toMatchObject({ said: 'Coming: Data Hub does not run it yet', warn: false, done: false });
    expect(flow.steps.find((step) => step.id === 'dateRange')).toMatchObject({ said: 'Not added yet', warn: true, coming: false, go: 'Open the EDA-Probe' });
    expect(flow.steps.find((step) => step.id === 'disguisedNulls')).toMatchObject({ said: 'Not added yet', warn: true, coming: false, go: 'Open the EDA-Probe' });
    expect(flow.steps.find((step) => step.id === 'distributionOfCategories')).toMatchObject({ said: 'Not added yet', warn: true, coming: false });
    expect(flow.steps.find((step) => step.id === 'grainHolds')).toMatchObject({ said: 'Not added yet', warn: true, go: 'Open the EDA-Probe' });
    // The step to do now is the best next step of the EDA, as its page proposes: The grain holds, while it is open,
    // whatever else misses more (DEC-ED-37).
    expect(flow.now).toBe('grainHolds');
    expect(flow.progress).toBe('0 of 10 needed EDA-Probes complete');
    expect(flow.foot).toMatch(/^10 to go, of which 3 are coming: they still count\./);
  });

  it('says a step done with Data Hub reading and its result in a few words, and an open one with what it misses', () => {
    const flow = edaFlowOf(viewOf({ grainHolds: GRAIN, nullsPerKeyField: NULLS_PART }));
    const grain = flow.steps.find((step) => step.id === 'grainHolds');
    expect(grain).toMatchObject({ done: true, tag: { text: 'As expected', tone: 'healthy' } });
    expect(grain?.said).toBe('One row per week_start, lead_source: none twice in 16,224 rows.');
    expect(flow.steps.find((step) => step.id === 'nullsPerKeyField')?.said).toBe('Set on 3 of 4 Key Fields: lead_channel still missing');
    // Disguised nulls misses all four Key Fields, more than any other: the best next step.
    expect(flow.now).toBe('disguisedNulls');
    expect(flow.progress).toBe('1 of 10 needed EDA-Probes complete');
    expect(flow.foot).toMatch(/^9 to go, of which 3 are coming/);
  });

  it('unfolds What, Why and How, the Learning Card where one is written, and Open the EDA-Probe, except on its own detail', () => {
    const flow = edaFlowOf(viewOf(), { here: 'grainHolds', cardTitle: (card) => (card === '2.3.5' ? 'The grain question' : undefined) });
    const grain = flow.steps.find((step) => step.id === 'grainHolds');
    expect(grain?.what).toMatch(/^It checks that every row is one thing: one row per week_start, lead_source/);
    expect(grain?.why).toMatch(/^When a grain value is on two rows/);
    expect(grain?.how).toBe('On its detail: it is set on the whole grain. Run reads the table once, through Query, as you.');
    expect(grain).toMatchObject({ here: true, card: { number: '2.3.5', title: 'The grain question' } });
    expect(grain?.go).toBeUndefined();
    expect(flow.steps.find((step) => step.id === 'volumeOverTime')?.how).toBe('On its detail: set on week_start, the date it counts by; other dates can be added. Run.');
    // The two built next have What, Why and How of their own (FR-ED-17, FR-ED-18).
    const range = flow.steps.find((step) => step.id === 'dateRange');
    expect(range?.what).toMatch(/^It finds the first and the last value of a date/);
    expect(range?.why).toMatch(/^A table that stopped three weeks ago/);
    expect(range?.how).toBe('On its detail: set on week_start, the date its role names; other dates can be added. Run.');
    const categories = flow.steps.find((step) => step.id === 'distributionOfCategories');
    expect(categories?.what).toMatch(/^It counts, per text field, how much each value brings/);
    expect(categories?.why).toMatch(/^A category with one value that brings nearly everything/);
    expect(categories?.how).toMatch(/^On its detail: set on the texts among its Key Fields, weighed by the number that adds up or by rows/);
    // A coming one says what it asks, that Data Hub does not run it yet, and leads nowhere.
    const coming = flow.steps.find((step) => step.id === 'impossibleValues');
    expect(coming?.what).toBe('Which values cannot be, such as a negative count or a week that does not start on a Monday?');
    expect(coming?.why).toBeUndefined();
    expect(coming?.how).toMatch(/^Data Hub does not run this EDA-Probe yet/);
    expect(coming?.go).toBeUndefined();
  });

  it('says what a needed EDA-Probe that cannot run here waits for', () => {
    const view = viewOf();
    const without = { ...view, probes: view.probes.map((probe) => (probe.key === 'grainHolds' ? { ...probe, applies: { ...probe.applies, block: 'noGrain' as const } } : probe)) };
    const grain = edaFlowOf(without).steps.find((step) => step.id === 'grainHolds');
    expect(grain?.said).toBe('Its grain is not recorded yet');
    expect(grain?.how).toMatch(/the Data Team records its grain first/);
  });
});

describe('the steps of the two EDA-Probes built next, done (FR-ED-17, FR-ED-18)', () => {
  it('say their result in a few words, as their cards do', () => {
    const range = run(['week_start'], [
      {
        subject: 'week_start',
        data: { unit: 'week', first: '2021-01-04', last: '2026-10-26', periods: 303, current: '2026-11-16', behind: 3, reliableSince: '2025-01-01', beforeReliable: 208 },
        reading: 'look',
        yours: null,
      },
    ]);
    const categories = run(['lead_source', 'lead_channel'], [
      {
        subject: 'lead_source',
        data: {
          weighedBy: 'lead_count',
          total: 1000,
          values: 54,
          top: [
            { value: 'website', weight: 410, share: 0.41 },
            { value: 'app', weight: 220, share: 0.22 },
            { value: 'partner', weight: 90, share: 0.09 },
            { value: 'immoweb', weight: 70, share: 0.07 },
          ],
          others: { values: 50, weight: 209, share: 0.209 },
          empty: { weight: 1, share: 0.001 },
          small: 31,
        },
        reading: 'judge',
        yours: null,
      },
      { subject: 'lead_channel', data: { weighedBy: 'lead_count', total: 1000, values: 1, top: [{ value: 'web', weight: 1000, share: 1 }], others: { values: 0, weight: 0, share: 0 }, empty: { weight: 0, share: 0 }, small: 0 }, reading: 'judge', yours: null },
    ]);
    const flow = edaFlowOf(viewOf({ dateRange: range, distributionOfCategories: categories }));
    expect(flow.steps.find((step) => step.id === 'dateRange')).toMatchObject({
      done: true,
      tag: { text: 'Look at this', tone: 'attention' },
      said: 'The last week is week 44, 26 Oct: 3 weeks behind this one.',
    });
    expect(flow.steps.find((step) => step.id === 'distributionOfCategories')).toMatchObject({
      done: true,
      tag: { text: 'For you to judge', tone: 'informative' },
      said: 'In lead_source, 4 of 54 values bring 79% of lead_count. And 1 more field.',
    });
  });
});

describe('the question an EDA-Probe asks of a Resource (FR-ED-13)', () => {
  it('has a question for every EDA-Probe, with the names of its fields where it names them', () => {
    for (const key of PROBE_KEYS) expect(saidText([askOf(key, WEEKLY)])).toMatch(/\?$/);
    expect(saidText([askOf('grainHolds', WEEKLY)])).toBe('Is every row one thing: one row per week_start, lead_source?');
    expect(askOf('grainHolds', WEEKLY).names).toEqual({ grain: 'week_start, lead_source' });
    expect(saidText([askOf('dateRange', WEEKLY)])).toBe('From when to when does it run, on week_start?');
    expect(saidText([askOf('volumeOverTime', WEEKLY)])).toBe('How much comes in per week, and are there weeks without rows?');
    expect(saidText([askOf('valuesWithoutAMatch', WEEKLY)])).toBe('Which values of lead_source have no match in what they are mapped to?');
    expect(saidText([askOf('disguisedNulls', WEEKLY)])).toBe('How many rows say nothing, per Key Field: no value, "n/a", "unknown" or 1900-01-01?');
    const plain = { ...WEEKLY, fields: WEEKLY.fields.map((field) => ({ ...field, grain: false, mapped: false, role: null })) };
    expect(saidText([askOf('grainHolds', plain)])).toBe('Is every row one thing, one row per value of its grain?');
    expect(saidText([askOf('volumeOverTime', plain)])).toBe('How much comes in per day, and are there days without rows?');
  });
});

describe('the step of Disguised nulls, which Data Hub runs (DEC-ED-35, FR-ED-19)', () => {
  it('unfolds What, Why and How, and leads to its detail', () => {
    const step = edaFlowOf(viewOf()).steps.find((one) => one.id === 'disguisedNulls');
    expect(step).toMatchObject({ coming: false, warn: true, said: 'Not added yet', go: 'Open the EDA-Probe' });
    expect(step?.what).toMatch(/^It counts, per field, the rows that say nothing: with no value at all, or with a value that fills the cell but stands for nothing/);
    expect(step?.why).toMatch(/^A null is seen as missing; "unknown" is counted as a value\./);
    expect(step?.how).toBe('On its detail: set on every Key Field, as Nulls per Key Field; the values it looks for are kept per EDA and can be changed. Run.');
  });

  it('says its result in a few words once it is complete, as its card does', () => {
    const disguised = run(['week_start', 'lead_source', 'lead_count', 'lead_channel'], [
      { subject: 'week_start', data: { rows: 16224, saysNothing: 0, nulls: 0, found: [], role: 'period' }, reading: 'expected', yours: null },
      { subject: 'lead_source', data: { rows: 16224, saysNothing: 0, nulls: 0, found: [], role: 'groupedBy' }, reading: 'expected', yours: null },
      { subject: 'lead_count', data: { rows: 16224, saysNothing: 0, nulls: 0, found: [], role: 'addsUp' }, reading: 'expected', yours: null },
      { subject: 'lead_channel', data: { rows: 16224, saysNothing: 2608, nulls: 1947, found: [{ value: 'unknown', rows: 661 }], role: null }, reading: 'judge', yours: null },
    ]);
    const step = edaFlowOf(viewOf({ disguisedNulls: disguised })).steps.find((one) => one.id === 'disguisedNulls');
    expect(step).toMatchObject({ done: true, tag: { text: 'For you to judge', tone: 'informative' }, said: '1 field says nothing on some rows: lead_channel the most, 16% of its rows.' });
  });
});

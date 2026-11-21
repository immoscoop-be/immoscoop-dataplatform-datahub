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
    expect(flow.steps.filter((step) => step.coming).map((step) => step.id)).toEqual(['dateRange', 'disguisedNulls', 'valuesWithoutAMatch', 'distributionOfCategories', 'spread', 'impossibleValues']);
    expect(flow.steps.find((step) => step.id === 'dateRange')).toMatchObject({ said: 'Coming: Data Hub does not run it yet', warn: false, done: false });
    expect(flow.steps.find((step) => step.id === 'grainHolds')).toMatchObject({ said: 'Not added yet', warn: true, go: 'Open the EDA-Probe' });
    // The step to do now is the best next step of the EDA, as its page proposes.
    expect(flow.now).toBe('nullsPerKeyField');
    expect(flow.progress).toBe('0 of 10 needed EDA-Probes complete');
    expect(flow.foot).toMatch(/^10 to go, of which 6 are coming: they still count\./);
  });

  it('says a step done with Data Hub reading and its result in a few words, and an open one with what it misses', () => {
    const flow = edaFlowOf(viewOf({ grainHolds: GRAIN, nullsPerKeyField: NULLS_PART }));
    const grain = flow.steps.find((step) => step.id === 'grainHolds');
    expect(grain).toMatchObject({ done: true, tag: { text: 'As expected', tone: 'healthy' } });
    expect(grain?.said).toBe('One row per week_start, lead_source: none twice in 16,224 rows.');
    expect(flow.steps.find((step) => step.id === 'nullsPerKeyField')?.said).toBe('Set on 3 of 4 Key Fields: lead_channel still missing');
    // Each still misses one field: the first in the order of the table comes first, as on its page.
    expect(flow.now).toBe('volumeOverTime');
    expect(flow.progress).toBe('1 of 10 needed EDA-Probes complete');
    expect(flow.foot).toMatch(/^9 to go, of which 6 are coming/);
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

describe('the question an EDA-Probe asks of a Resource (FR-ED-13)', () => {
  it('has a question for every EDA-Probe, with the names of its fields where it names them', () => {
    for (const key of PROBE_KEYS) expect(saidText([askOf(key, WEEKLY)])).toMatch(/\?$/);
    expect(saidText([askOf('grainHolds', WEEKLY)])).toBe('Is every row one thing: one row per week_start, lead_source?');
    expect(askOf('grainHolds', WEEKLY).names).toEqual({ grain: 'week_start, lead_source' });
    expect(saidText([askOf('dateRange', WEEKLY)])).toBe('From when to when does it run, on week_start?');
    expect(saidText([askOf('volumeOverTime', WEEKLY)])).toBe('How much comes in per week, and are there weeks without rows?');
    expect(saidText([askOf('valuesWithoutAMatch', WEEKLY)])).toBe('Which values of lead_source have no match in what they are mapped to?');
    const plain = { ...WEEKLY, fields: WEEKLY.fields.map((field) => ({ ...field, grain: false, mapped: false, role: null })) };
    expect(saidText([askOf('grainHolds', plain)])).toBe('Is every row one thing, one row per value of its grain?');
    expect(saidText([askOf('volumeOverTime', plain)])).toBe('How much comes in per day, and are there days without rows?');
  });
});

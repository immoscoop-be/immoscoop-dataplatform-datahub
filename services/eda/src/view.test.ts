import { describe, expect, it } from 'vitest';
import type { Eda, EdaState } from './edas.js';
import { CREDIT, WEEKLY } from './testing.js';
import { explorable, viewOf } from './view.js';

const AN = { id: '101', name: 'An Claes' };
const eda: Eda = {
  id: 'e1',
  resourceId: WEEKLY.resource.id,
  status: 'inProgress',
  startedBy: AN,
  startedAt: new Date('2026-11-21T09:00:00Z'),
  exploredAt: null,
  toldAt: null,
  needed: { total: 0, complete: 0 },
};
const ranAt = new Date('2026-11-21T09:30:00Z');

describe('the EDA as the tab Steps shows it (FR-ED-04, DEC-ED-16)', () => {
  it('lists the EDA-Probes of its model type, what is needed, and the best next step, before anything ran', () => {
    const view = viewOf(WEEKLY, CREDIT, eda, { probes: [], lastRuns: [], readings: [] });
    expect(view.resource).toMatchObject({ id: WEEKLY.resource.id, collection: CREDIT, modelType: 'aggregate' });
    expect(view).toMatchObject({ status: 'inProgress', startedBy: AN, startedAt: '2026-11-21T09:00:00.000Z', exploredAt: null, needed: { total: 10, complete: 0 }, next: 'nullsPerKeyField' });
    const nulls = view.probes.find((probe) => probe.key === 'nullsPerKeyField');
    expect(nulls).toMatchObject({ level: 'must', runs: true, needed: true, added: false, complete: false, fields: [], params: {}, lastRun: null });
    expect(view.probes.find((probe) => probe.key === 'rowCount')).toMatchObject({ runs: false, needed: true });
    // Not offered for an aggregate.
    expect(view.probes.some((probe) => probe.key === 'datesInOrder')).toBe(false);
  });

  it('shows the last run of each with its results and the readings given, and counts what is complete', () => {
    const state: EdaState = {
      probes: [{ probe: 'nullsPerKeyField', fields: ['week_start', 'lead_source', 'lead_count', 'lead_channel'], params: {}, addedBy: AN, addedAt: ranAt }],
      lastRuns: [
        {
          id: 'run-1',
          probe: 'nullsPerKeyField',
          fields: ['week_start', 'lead_source', 'lead_count', 'lead_channel'],
          params: {},
          ranBy: AN,
          ranAt,
          bytes: 1200,
          queryRunId: 'q-20261121-4c2e1a',
          results: [
            { subject: 'week_start', data: { rows: 10, empty: 0, role: 'period' }, reading: 'expected' },
            { subject: 'lead_channel', data: { rows: 10, empty: 2, role: null }, reading: 'judge' },
          ],
        },
      ],
      readings: [{ probe: 'nullsPerKeyField', subject: 'lead_channel', reading: 'known', by: AN, at: ranAt }],
    };
    const view = viewOf(WEEKLY, CREDIT, eda, state);
    const nulls = view.probes.find((probe) => probe.key === 'nullsPerKeyField');
    expect(nulls).toMatchObject({ added: true, complete: true, fields: ['week_start', 'lead_source', 'lead_count', 'lead_channel'] });
    expect(nulls?.lastRun).toEqual({
      id: 'run-1',
      ranAt: '2026-11-21T09:30:00.000Z',
      ranBy: AN,
      bytes: 1200,
      fields: ['week_start', 'lead_source', 'lead_count', 'lead_channel'],
      params: {},
      results: [
        { subject: 'week_start', data: { rows: 10, empty: 0, role: 'period' }, reading: 'expected', yours: null },
        { subject: 'lead_channel', data: { rows: 10, empty: 2, role: null }, reading: 'judge', yours: { reading: 'known', by: AN, at: '2026-11-21T09:30:00.000Z' } },
      ],
    });
    expect(view.needed).toEqual({ total: 10, complete: 1 });
    expect(view.coverage.fields.find((field) => field.name === 'lead_channel')?.steps.gaps).toBe('covered');
    expect(view.next).toBe('grainHolds');
  });

  it('becomes Explored only in progress, with every needed EDA-Probe complete and at least one (FR-ED-12)', () => {
    expect(explorable(eda, { total: 4, complete: 4 })).toBe(true);
    expect(explorable(eda, { total: 4, complete: 3 })).toBe(false);
    expect(explorable(eda, { total: 0, complete: 0 })).toBe(false);
    expect(explorable({ status: 'explored' }, { total: 4, complete: 4 })).toBe(false);
  });
});

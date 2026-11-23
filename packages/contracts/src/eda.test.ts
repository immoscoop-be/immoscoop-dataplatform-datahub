import { describe, expect, it } from 'vitest';
import { appliesTo, bestNext, coverage, type EdaResource, type EdaView, isComplete, isNeeded, levelOf, neededOf, PROBE_KEYS, PROBES, probesFor, roleDate, rowsOf, RUNNABLE_PROBES, type RunCover, type RunView, asksReading } from './eda.js';

/** Weekly lead volume, an aggregate: one row per week and lead source, as the screens draw it. */
const weekly: EdaResource = {
  id: 'r1',
  displayName: 'Weekly lead volume',
  modelType: 'aggregate',
  level: 3,
  fields: [
    { name: 'week_start', dataType: 'DATE', keyField: true, role: 'period', grain: true, mapped: false },
    { name: 'lead_source', dataType: 'STRING', keyField: true, role: 'groupedBy', grain: true, mapped: true },
    { name: 'lead_count', dataType: 'INT64', keyField: true, role: 'addsUp', grain: false, mapped: false },
    { name: 'lead_channel', dataType: 'STRING', keyField: true, role: null, grain: false, mapped: false },
    { name: 'lead_origin', dataType: 'STRING', keyField: false, role: null, grain: false, mapped: false },
    { name: 'unique_applicants', dataType: 'INT64', keyField: false, role: 'uniqueCount', grain: false, mapped: false },
    { name: 'loaded_at', dataType: 'TIMESTAMP', keyField: false, role: null, grain: false, mapped: false },
  ],
};

describe('the catalogue of EDA-Probes (TR-ED-02)', () => {
  it('holds the 25 EDA-Probes of the table (DEC-ED-32), seven of which Data Hub runs', () => {
    expect(PROBE_KEYS).toHaveLength(25);
    expect(RUNNABLE_PROBES).toEqual(['grainHolds', 'dateRange', 'volumeOverTime', 'nullsPerKeyField', 'disguisedNulls', 'distributionOfNumbers', 'distributionOfCategories']);
    expect(PROBES.spread.levels).toMatchObject({ fact: 'must', aggregate: 'must', event: 'should' });
  });

  it('offers per model type only what the table offers', () => {
    expect(levelOf('datesInOrder', 'state')).toBe('must');
    expect(levelOf('datesInOrder', 'event')).toBeNull();
    expect(probesFor('other')).not.toContain('dateRange');
    expect(probesFor(null)).toEqual([]);
  });
});

describe('what an EDA-Probe applies to on a Resource', () => {
  it('sets the grain on its grain fields, the volume on the date of its role, the nulls on every Key Field', () => {
    expect(appliesTo('grainHolds', weekly)).toEqual({ table: true, fields: ['week_start', 'lead_source'], needs: ['week_start', 'lead_source'], block: null });
    expect(roleDate(weekly)).toBe('week_start');
    expect(appliesTo('nullsPerKeyField', weekly).needs).toEqual(['week_start', 'lead_source', 'lead_count', 'lead_channel']);
    expect(appliesTo('distributionOfNumbers', weekly).needs).toEqual(['lead_count']);
  });

  it('leaves mapped fields out of Impossible values, and says when the grain is missing', () => {
    expect(appliesTo('impossibleValues', weekly).needs).toEqual(['week_start', 'lead_count', 'lead_channel']);
    const noGrain = { ...weekly, fields: weekly.fields.map((field) => ({ ...field, grain: false })) };
    expect(appliesTo('grainHolds', noGrain).block).toBe('noGrain');
  });
});

describe('needed, complete, covered (DEC-ED-17, DEC-ED-21)', () => {
  it('needs ten EDA-Probes for this aggregate, its mapped Key Field among them, none complete before a run', () => {
    expect(neededOf(weekly, [])).toEqual({ total: 10, complete: 0 });
    expect(isNeeded('relationshipsHold', weekly)).toBe(false);
  });

  it('completes an EDA-Probe only once it is set on every field it needs', () => {
    expect(isComplete('nullsPerKeyField', weekly, [{ probe: 'nullsPerKeyField', fields: ['week_start', 'lead_source', 'lead_count'] }])).toBe(false);
    const runs = [
      { probe: 'grainHolds' as const, fields: ['week_start', 'lead_source'] },
      { probe: 'nullsPerKeyField' as const, fields: ['week_start', 'lead_source', 'lead_count', 'lead_channel'] },
    ];
    expect(neededOf(weekly, runs)).toEqual({ total: 10, complete: 2 });
  });

  it('shows per field what covers it, and what a Key Field still needs', () => {
    const runs = [{ probe: 'nullsPerKeyField' as const, fields: ['week_start', 'lead_source', 'lead_count'] }];
    const { fields, places } = coverage(weekly, runs);
    const field = (name: string) => fields.find((entry) => entry.name === name);
    expect(field('lead_count')?.steps).toMatchObject({ gaps: 'covered', weight: 'needed', correctness: 'needed' });
    expect(field('lead_channel')?.steps.gaps).toBe('needed');
    expect(field('lead_origin')?.steps.gaps).toBe('free');
    expect(places.keyFields).toEqual({ total: 4, complete: 0, started: 3 });
    expect(places.rows).toEqual({ needed: 3, complete: 0 });
  });

  it('proposes The grain holds first while it is open (DEC-ED-37), then what Data Hub runs that covers most of what is missing', () => {
    expect(bestNext(weekly, [])).toBe('grainHolds');
    // Even after a probe that misses more is half done, The grain holds stays first.
    expect(bestNext(weekly, [{ probe: 'nullsPerKeyField', fields: ['week_start'] }])).toBe('grainHolds');
    expect(bestNext(weekly, [{ probe: 'grainHolds', fields: ['week_start', 'lead_source'] }])).toBe('nullsPerKeyField');
    const runs: RunCover[] = [
      { probe: 'nullsPerKeyField', fields: ['week_start', 'lead_source', 'lead_count', 'lead_channel'] },
      { probe: 'grainHolds', fields: ['week_start', 'lead_source'] },
      { probe: 'volumeOverTime', fields: ['week_start'] },
      { probe: 'distributionOfNumbers', fields: ['lead_count'] },
    ];
    expect(bestNext(weekly, runs)).not.toBeNull();
    runs.push({ probe: 'dateRange', fields: ['week_start'] }, { probe: 'distributionOfCategories', fields: ['lead_source', 'lead_channel'] });
    expect(bestNext(weekly, runs)).toBe('disguisedNulls');
    runs.push({ probe: 'disguisedNulls', fields: ['week_start', 'lead_source', 'lead_count', 'lead_channel'] });
    expect(bestNext(weekly, runs)).toBeNull();
  });
});

describe('the rows of the table, a fact of the EDA (DEC-ED-32)', () => {
  const run = (ranAt: string, results: RunView['results']): RunView => ({ id: ranAt, ranAt, ranBy: { id: '1', name: 'An' }, bytes: 0, fields: [], params: {}, results });
  const probe = (key: 'grainHolds' | 'nullsPerKeyField' | 'volumeOverTime', lastRun: RunView | null) => ({ key, lastRun }) as EdaView['probes'][number];
  const grain = run('2026-11-21T10:00:00Z', [
    { subject: '', data: { rows: 16224, values: 16224, onMoreThanOne: 0, rowsCovered: 0, emptyGrain: 0, buckets: [16224, 0, 0, 0], examples: [] }, reading: 'expected', yours: null },
  ]);
  const nulls = run('2026-11-21T11:00:00Z', [{ subject: 'week_start', data: { rows: 16300, empty: 0, role: 'period' }, reading: 'expected', yours: null }]);

  it('takes them from the last run of The grain holds or of Nulls per Key Field, whichever ran last', () => {
    expect(rowsOf({ probes: [probe('grainHolds', grain)] })).toEqual({ rows: 16224, probe: 'grainHolds', at: '2026-11-21T10:00:00Z' });
    expect(rowsOf({ probes: [probe('grainHolds', grain), probe('nullsPerKeyField', nulls)] })).toEqual({ rows: 16300, probe: 'nullsPerKeyField', at: '2026-11-21T11:00:00Z' });
    expect(rowsOf({ probes: [probe('grainHolds', { ...grain, ranAt: '2026-11-21T12:00:00Z' }), probe('nullsPerKeyField', nulls)] })).toMatchObject({ rows: 16224, probe: 'grainHolds' });
  });

  it('knows none while neither has run', () => {
    expect(rowsOf({ probes: [probe('grainHolds', null), probe('nullsPerKeyField', null)] })).toBeNull();
    expect(rowsOf({ probes: [probe('volumeOverTime', run('2026-11-21T10:00:00Z', []))] })).toBeNull();
  });
});

describe('the reading of who works on the EDA (FR-ED-11)', () => {
  it('is not asked where there is nothing to read: a field always filled, a date up to date', () => {
    expect(asksReading('nullsPerKeyField', { reading: 'expected' })).toBe(false);
    expect(asksReading('dateRange', { reading: 'expected' })).toBe(false);
    expect(asksReading('disguisedNulls', { reading: 'expected' })).toBe(false);
    expect(asksReading('disguisedNulls', { reading: 'judge' })).toBe(true);
    expect(asksReading('dateRange', { reading: 'look' })).toBe(true);
    expect(asksReading('grainHolds', { reading: 'expected' })).toBe(true);
  });
});

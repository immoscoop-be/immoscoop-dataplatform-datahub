import { describe, expect, it } from 'vitest';
import { appliesTo, bestNext, coverage, type EdaResource, isComplete, isNeeded, levelOf, neededOf, PROBE_KEYS, PROBES, probesFor, roleDate, RUNNABLE_PROBES } from './eda.js';

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
  it('holds the 26 EDA-Probes of the table, four of which Data Hub runs', () => {
    expect(PROBE_KEYS).toHaveLength(26);
    expect(RUNNABLE_PROBES).toEqual(['grainHolds', 'volumeOverTime', 'nullsPerKeyField', 'distributionOfNumbers']);
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
  it('needs ten EDA-Probes for this aggregate, none complete before a run', () => {
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
    expect(places.rows).toEqual({ needed: 4, complete: 0 });
  });

  it('proposes as best next step what Data Hub runs that covers most of what is missing', () => {
    expect(bestNext(weekly, [])).toBe('nullsPerKeyField');
    const runs = [
      { probe: 'nullsPerKeyField' as const, fields: ['week_start', 'lead_source', 'lead_count', 'lead_channel'] },
      { probe: 'grainHolds' as const, fields: ['week_start', 'lead_source'] },
      { probe: 'volumeOverTime' as const, fields: ['week_start'] },
      { probe: 'distributionOfNumbers' as const, fields: ['lead_count'] },
    ];
    expect(bestNext(weekly, runs)).toBeNull();
  });
});

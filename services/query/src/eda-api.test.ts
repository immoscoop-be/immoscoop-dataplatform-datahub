import { describe, expect, it } from 'vitest';
import { parseProbeRun, reasonOf, recordsOf } from './eda-api.js';

describe('the run of an EDA-Probe, in a request (TR-ED-04)', () => {
  it('names an EDA-Probe by its key, its SQL, and whether the User approves what it reads', () => {
    expect(parseProbeRun({ probe: 'nullsPerKeyField', sql: 'select 1' })).toEqual({ probe: 'nullsPerKeyField', sql: 'select 1', approve: false });
    expect(parseProbeRun({ probe: 'grainHolds', sql: 'select 1', approve: true })).toEqual({ probe: 'grainHolds', sql: 'select 1', approve: true });
    expect(parseProbeRun({ probe: 'everything', sql: 'select 1' })).toMatch(/EDA-Probes/);
    expect(parseProbeRun({ probe: 'grainHolds', sql: '' })).toMatch(/SQL/);
    expect(parseProbeRun({ probe: 'grainHolds', sql: 'x'.repeat(100_001) })).toMatch(/SQL/);
    expect(parseProbeRun({ probe: 'grainHolds', sql: 'select 1', approve: 'yes' })).toBe('approve is true or false.');
    expect(parseProbeRun([])).toBe('Send a JSON object.');
  });
});

describe('the rows of an EDA-Probe, as eda reads them (TR-ED-04)', () => {
  it('are objects by column, values as BigQuery writes them, lists and records as JSON values', () => {
    const columns = [
      { name: 'rows', type: 'INT64' },
      { name: 'quantiles', type: 'ARRAY<FLOAT64>' },
      { name: 'top', type: 'ARRAY<STRUCT>' },
      { name: 'range', type: 'STRUCT' },
      { name: 'first', type: 'DATE' },
    ];
    expect(
      recordsOf({
        columns,
        rows: [
          ['42', '["1.5","2","9"]', '[{"value":"app","rows":"3"}]', '{"low":"1","high":"9"}', '2024-01-08'],
          [null, null, '[]', null, null],
        ],
      }),
    ).toEqual([
      { rows: '42', quantiles: ['1.5', '2', '9'], top: [{ value: 'app', rows: '3' }], range: { low: '1', high: '9' }, first: '2024-01-08' },
      { rows: null, quantiles: null, top: [], range: null, first: null },
    ]);
  });
});

describe('why an EDA-Probe does not run', () => {
  it('says so in a sentence, from the first problem of its Pre-flight', () => {
    expect(reasonOf({ kind: 'tooLarge', bytes: 4_800_000_000, limit: 1_000_000_000 })).toBe('It reads 4.8 GB, more than one run of yours may read (1 GB), so it does not run.');
    expect(reasonOf({ kind: 'outside', name: 'p.d.leads', start: 0, end: 9 })).toMatch(/^It reads p\.d\.leads, which is not the table of this Resource/);
    expect(reasonOf({ kind: 'notSelect', statementType: 'DELETE' })).toMatch(/DELETE/);
    expect(reasonOf({ kind: 'invalid', message: 'Syntax error' })).toBe('BigQuery refused it: Syntax error');
    expect(reasonOf(undefined)).toBe('There is no SQL to run.');
  });
});

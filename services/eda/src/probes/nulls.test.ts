import { describe, expect, it } from 'vitest';
import { WEEKLY } from '../testing.js';
import { nullsResults, nullsSql } from './nulls.js';
import type { ProbeContext } from './probe.js';

const weekly: ProbeContext = { source: WEEKLY, fields: ['week_start', 'lead_source', 'lead_count', 'lead_channel'], params: {}, today: '2026-11-21' };

describe('Nulls per Key Field (FR-ED-08, DEC-ED-22, TR-ED-03)', () => {
  it('counts the rows, and per field the empty ones, in one scan', () => {
    expect(nullsSql(weekly)).toBe(`-- EDA-Probe nullsPerKeyField on Weekly lead volume: aggregates only (TR-ED-03)
select
  count(*) as row_count,
  countif(\`week_start\` is null) as empty_0,
  countif(\`lead_source\` is null) as empty_1,
  countif(\`lead_count\` is null) as empty_2,
  countif(\`lead_channel\` is null) as empty_3
from \`immoscoop-dataplatform.dbt_prod_stacks.Weekly_Lead_Volume\`
where (\`week_start\` is null or \`week_start\` >= date '0001-01-01')`);
  });

  it('reads a field without empty values as expected, with some as for you to judge, and look at this where it holds a role', () => {
    const rows = [{ row_count: '1000', empty_0: '0', empty_1: '12', empty_2: '0', empty_3: '7' }];
    expect(nullsResults(rows, weekly)).toEqual([
      { subject: 'week_start', data: { rows: 1000, empty: 0, role: 'period' }, reading: 'expected' },
      { subject: 'lead_source', data: { rows: 1000, empty: 12, role: 'groupedBy' }, reading: 'look' },
      { subject: 'lead_count', data: { rows: 1000, empty: 0, role: 'addsUp' }, reading: 'expected' },
      { subject: 'lead_channel', data: { rows: 1000, empty: 7, role: null }, reading: 'judge' },
    ]);
  });
});

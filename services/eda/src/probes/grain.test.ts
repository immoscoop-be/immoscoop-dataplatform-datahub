import { describe, expect, it } from 'vitest';
import { LEADS, WEEKLY } from '../testing.js';
import { grainResults, grainSql } from './grain.js';
import type { ProbeContext } from './probe.js';

const weekly: ProbeContext = { source: WEEKLY, fields: ['week_start', 'lead_source'], params: {}, today: '2026-11-21' };

describe('The grain holds (FR-ED-07, TR-ED-03)', () => {
  it('groups the table by its grain values in one scan, and returns aggregates only', () => {
    const sql = grainSql(weekly);
    expect(sql).toContain('from `immoscoop-dataplatform.dbt_prod_stacks.Weekly_Lead_Volume`');
    expect(sql).toContain("where (`week_start` is null or `week_start` >= date '0001-01-01')");
    expect(sql).toContain('`week_start` as g0,\n    `lead_source` as g1,');
    expect(sql).toContain('group by 1, 2');
    expect(sql).toContain('sum(if(g0 is null or g1 is null, row_count, 0)) as empty_grain');
    expect(sql).toContain('countif(g0 is not null and g1 is not null and row_count >= 4) as on_four_or_more');
    expect(sql).toContain('order by if(g0 is not null and g1 is not null and row_count > 1, row_count, null) desc limit 5');
    expect(sql.match(/from `/g)).toHaveLength(1);
    // Without a required partition filter, no where at all.
    expect(grainSql({ ...weekly, source: LEADS, fields: ['lead_id'] })).not.toContain('where');
  });

  it('reads as expected when no grain value is on more than one row and none is empty', () => {
    const rows = [{ row_count: '312', empty_grain: '0', grain_values: '312', on_one: '312', on_two: '0', on_three: '0', on_four_or_more: '0', rows_covered: '0', examples: 'null' }];
    expect(grainResults(rows, weekly)).toEqual([
      { subject: '', reading: 'expected', data: { rows: 312, values: 312, onMoreThanOne: 0, rowsCovered: 0, emptyGrain: 0, buckets: [312, 0, 0, 0], examples: [] } },
    ]);
  });

  it('reads look at this with grain values on more rows, or empty ones, with the 5 on the most rows', () => {
    const examples = JSON.stringify([
      { grain_value: ['2026-10-19', 'app'], row_count: '6' },
      { grain_value: ['2026-10-12', 'website'], row_count: 2 },
    ]);
    const rows = [{ row_count: '1000', empty_grain: '3', grain_values: '990', on_one: '985', on_two: '4', on_three: '0', on_four_or_more: '1', rows_covered: '14', examples }];
    const [result] = grainResults(rows, weekly);
    expect(result?.reading).toBe('look');
    expect(result?.data).toEqual({
      rows: 1000,
      values: 990,
      onMoreThanOne: 5,
      rowsCovered: 14,
      emptyGrain: 3,
      buckets: [985, 4, 0, 1],
      examples: [
        { values: { week_start: '2026-10-19', lead_source: 'app' }, rows: 6 },
        { values: { week_start: '2026-10-12', lead_source: 'website' }, rows: 2 },
      ],
    });
    const onlyEmpty = [{ ...rows[0], on_two: '0', on_four_or_more: '0', rows_covered: '0', examples: 'null' }];
    expect(grainResults(onlyEmpty, weekly)[0]?.reading).toBe('look');
  });
});

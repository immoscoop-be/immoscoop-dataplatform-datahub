import { describe, expect, it } from 'vitest';
import { LEADS, WEEKLY } from '../testing.js';
import { distributionOfNumbers, distributionResults, distributionSql } from './distribution.js';
import type { ProbeContext } from './probe.js';
import { ResultRefused } from './sql.js';

const weekly: ProbeContext = { source: WEEKLY, fields: ['lead_count'], params: {}, today: '2026-11-21' };

describe('Distribution of numbers (FR-ED-10, DEC-ED-24, TR-ED-03)', () => {
  it('reads the quantiles by APPROX_QUANTILES, then the bins, with a round width that gives about twelve up to P95', () => {
    const sql = distributionSql(weekly);
    expect(sql).toContain('struct(0 as field_index, cast(`lead_count` as float64) as v)');
    expect(sql).toContain("  where (`week_start` is null or `week_start` >= date '0001-01-01')");
    expect(sql).toContain('approx_quantiles(v, 100) as q');
    expect(sql).toContain('q[safe_offset(25)] as p25, q[safe_offset(50)] as median, q[safe_offset(75)] as p75, q[safe_offset(95)] as p95');
    expect(sql).toContain('from unnest([1.0, 2.0, 2.5, 5.0, 10.0]) as step');
    expect(sql).toContain('order by abs(ceil(span / candidate) - 12), candidate desc');
    expect(sql).toContain('if(low < 0, floor(low / width) * width, 0) as start');
    expect(sql).toContain('if(v >= tail_from, -1, cast(floor((v - start) / width + 1e-9) as int64)) as bin');
    expect(sql).toContain('struct(0 as field_index, cast(null as float64) as width, cast(null as float64) as tail_from)');
    // The table once: the second pass reads the first, never the table again by another name.
    expect(sql.match(/from `immoscoop/g)).toHaveLength(1);
  });

  it('takes the width and the tail the User gave, for every field or per field', () => {
    const sql = distributionSql({ source: LEADS, fields: ['price'], params: { width: { price: 50000 }, tailFrom: 1000000 }, today: '2026-11-21' });
    expect(sql).toContain('struct(0 as field_index, cast(50000 as float64) as width, cast(1000000 as float64) as tail_from)');
    // Leads requires no partition filter.
    expect(sql).not.toContain('`created_at`');
  });

  it('checks the parameters: a width above 0, a number or one per field it is set on', () => {
    const params = (given: Record<string, unknown>) => distributionOfNumbers.params(given, WEEKLY, ['lead_count']);
    expect(params({ width: 5, tailFrom: { lead_count: 100 } })).toEqual({ width: 5, tailFrom: { lead_count: 100 } });
    expect(params({ width: 0 })).toBe('The width of a bin is above 0.');
    expect(params({ width: 'wide' })).toMatch(/is a number/);
    expect(params({ tailFrom: { price: 5 } })).toMatch(/not set on/);
    expect(params({ bins: 12 })).toBe('Distribution of numbers has no parameter bins.');
  });

  it('gives per field the numbers, the rows per bin and the tail, read as for you to judge', () => {
    const rows = [
      {
        field_index: '0',
        value_count: '310',
        low: '0',
        p25: '12',
        median: '20',
        p75: '41',
        p95: '108.5',
        high: '400',
        mean: '35.25',
        width: '10',
        tail_from: '110',
        start: '0',
        bins: '[{"bin":"0","bin_rows":"30"},{"bin":"3","bin_rows":"20"},{"bin":"10","bin_rows":"4"},{"bin":"-1","bin_rows":"6"}]',
      },
    ];
    expect(distributionResults(rows, weekly)).toEqual([
      {
        subject: 'lead_count',
        reading: 'judge',
        data: { rows: 310, low: 0, p25: 12, median: 20, p75: 41, p95: 108.5, high: 400, mean: 35.25, width: 10, tailFrom: 110, start: 0, bins: [30, 0, 0, 20, 0, 0, 0, 0, 0, 0, 4], tail: 6 },
      },
    ]);
  });

  it('starts below 0 at a round number, and gives a field without values as empty', () => {
    const rows = [{ field_index: '1', value_count: '3', low: '-12', p25: '-5', median: '0', p75: '4', p95: '9', high: '9', mean: '-1', width: '5', tail_from: '10', start: '-15', bins: JSON.stringify([{ bin: 0, bin_rows: 1 }, { bin: 4, bin_rows: 2 }]) }];
    const [empty, below] = distributionResults(rows, { ...weekly, fields: ['lead_count', 'unique_applicants'] });
    expect(empty?.data).toMatchObject({ rows: 0, bins: [], tail: 0 });
    expect(below?.data).toMatchObject({ start: -15, bins: [1, 0, 0, 0, 2], tail: 0 });
  });

  it('refuses bins so narrow that there are more than a thousand', () => {
    const rows = [{ field_index: '0', value_count: '1', low: '0', p25: '0', median: '0', p75: '0', p95: '1000', high: '1000', mean: '1', width: '0.5', tail_from: '1000', start: '0', bins: '[]' }];
    expect(() => distributionResults(rows, weekly)).toThrow(ResultRefused);
  });
});

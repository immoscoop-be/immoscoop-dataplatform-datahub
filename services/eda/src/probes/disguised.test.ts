import { DISGUISED_DEFAULTS } from '@datahub/contracts/eda';
import { describe, expect, it } from 'vitest';
import { WEEKLY } from '../testing.js';
import { disguisedParams, disguisedResults, disguisedSql, NINES } from './disguised.js';
import type { ProbeContext } from './probe.js';

const lists = { text: ['n/a'], date: ['1900-01-01'], number: [-1], ninesOnly: true };
const weekly: ProbeContext = { source: WEEKLY, fields: ['week_start', 'lead_channel', 'lead_count'], params: { lists }, today: '2026-11-21' };
const NINES_SQL = "regexp_contains(cast(`lead_count` as string), r'^-?9{3,}(\\.0+)?$')";

describe('Disguised nulls (DEC-ED-35, TR-ED-03)', () => {
  it('counts the rows, and per field those that say nothing, those without a value and each value apart, in one scan', () => {
    const sql = disguisedSql(weekly);
    expect(sql.startsWith('-- EDA-Probe disguisedNulls on Weekly lead volume: aggregates only (TR-ED-03)\nselect\n  count(*) as row_count,')).toBe(true);
    expect(sql).toContain("countif(`week_start` is null) as null_0");
    expect(sql).toContain("countif(`week_start` = date '1900-01-01') as found_0_0");
    expect(sql).toContain("countif((`lead_channel` is null or lower(trim(`lead_channel`)) in ('', 'n/a'))) as says_1");
    expect(sql).toContain("countif(lower(trim(`lead_channel`)) = '') as found_1_0");
    expect(sql).toContain("countif(lower(trim(`lead_channel`)) = 'n/a') as found_1_1");
    expect(sql).toContain(`countif((\`lead_count\` is null or \`lead_count\` in (-1) or ${NINES_SQL})) as says_2`);
    expect(sql).toContain('countif(`lead_count` = -1) as found_2_0');
    expect(sql).toContain(`countif(${NINES_SQL}) as found_2_1`);
    expect(sql.endsWith("from `immoscoop-dataplatform.dbt_prod_stacks.Weekly_Lead_Volume`\nwhere (`week_start` is null or `week_start` >= date '0001-01-01')")).toBe(true);
    // Aggregates only: nothing but counts per column.
    expect(sql).not.toMatch(/select\s+\*/);
  });

  it('looks for Data Hub’s proposal when the EDA keeps no lists', () => {
    const sql = disguisedSql({ ...weekly, fields: ['lead_channel'], params: {} });
    expect(sql).toContain("in ('', 'n/a', 'na', 'null', 'none', 'unknown', 'onbekend', '-', '?', 'tbd')");
  });

  it('reads none as expected, some as for you to judge, some in a field with a role as look at this; values found, the most first', () => {
    const rows = [{ row_count: '1000', says_0: '0', null_0: '0', found_0_0: '0', says_1: '40', null_1: '10', found_1_0: '5', found_1_1: '25', says_2: '3', null_2: '0', found_2_0: '1', found_2_1: '2' }];
    expect(disguisedResults(rows, weekly)).toEqual([
      { subject: 'week_start', data: { rows: 1000, saysNothing: 0, nulls: 0, found: [], role: 'period' }, reading: 'expected' },
      { subject: 'lead_channel', data: { rows: 1000, saysNothing: 40, nulls: 10, found: [{ value: 'n/a', rows: 25 }, { value: '', rows: 5 }], role: null }, reading: 'judge' },
      { subject: 'lead_count', data: { rows: 1000, saysNothing: 3, nulls: 0, found: [{ value: NINES, rows: 2 }, { value: '-1', rows: 1 }], role: 'addsUp' }, reading: 'look' },
    ]);
  });

  it('keeps its lists as parameters: Data Hub’s proposal for each part not given, texts trimmed and in lower case', () => {
    expect(disguisedParams({})).toEqual({ lists: DISGUISED_DEFAULTS });
    expect(disguisedParams({ lists: { text: [' Leeg ', 'leeg', 'N/A'], ninesOnly: false } })).toEqual({ lists: { ...DISGUISED_DEFAULTS, text: ['leeg', 'n/a'], ninesOnly: false } });
    expect(disguisedParams({ lists: { number: [] } })).toEqual({ lists: { ...DISGUISED_DEFAULTS, number: [] } });
  });

  it('refuses parameters that do not fit, and zero, which never says nothing', () => {
    expect(disguisedParams({ other: 1 })).toMatch(/no parameter other/);
    expect(disguisedParams({ lists: [] })).toMatch(/lists is/);
    expect(disguisedParams({ lists: { texts: [] } })).toMatch(/no texts/);
    expect(disguisedParams({ lists: { text: [1] } })).toMatch(/lists.text/);
    expect(disguisedParams({ lists: { date: ['1900-02-30'] } })).toMatch(/lists.date/);
    expect(disguisedParams({ lists: { number: [Number.NaN] } })).toMatch(/lists.number/);
    expect(disguisedParams({ lists: { number: [0] } })).toMatch(/Zero never/);
    expect(disguisedParams({ lists: { ninesOnly: 'yes' } })).toMatch(/ninesOnly/);
  });
});

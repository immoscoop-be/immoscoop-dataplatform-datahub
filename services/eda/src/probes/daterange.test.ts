import { describe, expect, it } from 'vitest';
import { LEADS, WEEKLY } from '../testing.js';
import { dateRange, dateRangeResults, dateRangeSql, rangeOf } from './daterange.js';
import type { ProbeContext } from './probe.js';
import { AnswerMismatch } from './sql.js';

/** Saturday 21 November 2026: the week of Monday 16 November is current. */
const TODAY = '2026-11-21';
const weekly: ProbeContext = { source: WEEKLY, fields: ['week_start'], params: {}, today: TODAY };
const leads: ProbeContext = { source: LEADS, fields: ['created_at'], params: {}, today: TODAY };

describe('Date range (FR-ED-18, DEC-ED-34, TR-ED-03)', () => {
  it('takes the first and the last day of each date in one scan, a moment on its day in Brussels', () => {
    expect(dateRangeSql({ ...weekly, fields: ['week_start', 'loaded_at'] })).toBe(`-- EDA-Probe dateRange on Weekly lead volume: aggregates only (TR-ED-03)
select
  format_date('%F', min(\`week_start\`)) as first_0,
  format_date('%F', max(\`week_start\`)) as last_0,
  format_date('%F', min(date(\`loaded_at\`, 'Europe/Brussels'))) as first_1,
  format_date('%F', max(date(\`loaded_at\`, 'Europe/Brussels'))) as last_1
from \`immoscoop-dataplatform.dbt_prod_stacks.Weekly_Lead_Volume\`
where (\`week_start\` is null or \`week_start\` >= date '0001-01-01')`);
    // Without a required partition filter, no where at all.
    expect(dateRangeSql(leads)).toBe(`-- EDA-Probe dateRange on Leads: aggregates only (TR-ED-03)
select
  format_date('%F', min(date(\`created_at\`, 'Europe/Brussels'))) as first_0,
  format_date('%F', max(date(\`created_at\`, 'Europe/Brussels'))) as last_0
from \`immoscoop-dataplatform.dbt_prod_stacks.leads\``);
    expect(dateRange.params({ unit: 'month' }, WEEKLY, ['week_start'])).toBe('This EDA-Probe has no parameter unit.');
  });

  it('counts the weeks of the period of an aggregate up to this week, and those wholly before its Reliable Since', () => {
    const [result, ...others] = dateRangeResults([{ first_0: '2021-01-04', last_0: '2026-11-16' }], weekly);
    expect(others).toHaveLength(0);
    expect(result).toEqual({
      subject: 'week_start',
      reading: 'expected',
      data: { unit: 'week', first: '2021-01-04', last: '2026-11-16', periods: 307, current: '2026-11-16', behind: 0, reliableSince: '2025-01-01', beforeReliable: 208 },
    });
    // The week before is up to date too; three weeks behind is look at this.
    expect(dateRangeResults([{ first_0: '2021-01-04', last_0: '2026-11-09' }], weekly)[0]).toMatchObject({ reading: 'expected', data: { periods: 306, behind: 1 } });
    expect(dateRangeResults([{ first_0: '2021-01-04', last_0: '2026-10-26' }], weekly)[0]).toMatchObject({ reading: 'look', data: { periods: 304, behind: 3, beforeReliable: 208 } });
  });

  it('counts days for any other date: up to date today or yesterday, without a Reliable Since from the first row', () => {
    const [today] = dateRangeResults([{ first_0: '2024-03-01', last_0: TODAY }], leads);
    expect(today).toEqual({
      subject: 'created_at',
      reading: 'expected',
      data: { unit: 'day', first: '2024-03-01', last: TODAY, periods: 996, current: TODAY, behind: 0, reliableSince: null, beforeReliable: null },
    });
    expect(dateRangeResults([{ first_0: '2024-03-01', last_0: '2026-11-20' }], leads)[0]).toMatchObject({ reading: 'expected', data: { behind: 1 } });
    expect(dateRangeResults([{ first_0: '2024-03-01', last_0: '2026-11-19' }], leads)[0]).toMatchObject({ reading: 'look', data: { behind: 2 } });
    // A date of an aggregate other than its period counts in days, each with its own result.
    const both = dateRangeResults([{ first_0: '2025-01-06', last_0: '2026-11-16', first_1: '2025-01-07T06:12:00', last_1: '2026-11-17' }], { ...weekly, fields: ['week_start', 'loaded_at'] });
    expect(both.map((one) => [one.subject, one.reading, one.data])).toEqual([
      ['week_start', 'expected', expect.objectContaining({ unit: 'week', periods: 98, behind: 0, beforeReliable: 0 })],
      ['loaded_at', 'look', expect.objectContaining({ unit: 'day', first: '2025-01-07', last: '2026-11-17', behind: 4, beforeReliable: 0 })],
    ]);
  });

  it('reads a date without any value as look at this, and a last one beyond the current period as not behind', () => {
    expect(dateRangeResults([{ first_0: null, last_0: null }], weekly)[0]).toEqual({
      subject: 'week_start',
      reading: 'look',
      data: { unit: 'week', first: null, last: null, periods: 0, current: '2026-11-16', behind: 0, reliableSince: '2025-01-01', beforeReliable: 0 },
    });
    // A date in the future is left to Impossible values (DEC-ED-34).
    expect(rangeOf('2026-11-02', '2026-12-07', { unit: 'week', today: TODAY, reliableSince: null })).toMatchObject({ periods: 6, behind: 0 });
    // Every period before a Reliable Since after the last, none before one at or before the first.
    expect(rangeOf('2026-01-05', '2026-02-02', { unit: 'week', today: TODAY, reliableSince: '2026-06-01' })).toMatchObject({ periods: 5, beforeReliable: 5 });
    expect(rangeOf('2026-01-05', '2026-02-02', { unit: 'week', today: TODAY, reliableSince: '2025-06-01' })).toMatchObject({ beforeReliable: 0 });
    expect(rangeOf('2026-01-05', '2026-01-09', { unit: 'day', today: TODAY, reliableSince: '2026-01-07' })).toMatchObject({ periods: 5, beforeReliable: 2 });
  });

  it('refuses an answer without its row, or with a value that is no day', () => {
    expect(() => dateRangeResults([], weekly)).toThrow(AnswerMismatch);
    expect(() => dateRangeResults([{ first_0: 'yesterday', last_0: '2026-11-16' }], weekly)).toThrow(AnswerMismatch);
  });
});

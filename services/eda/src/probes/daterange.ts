import type { DateRangeResult } from '@datahub/contracts/eda';
import { noParams, type Outcome, type ProbeContext, type RunnableProbe } from './probe.js';
import { AnswerMismatch, dayOf, heading, onlyRow, quote, whereOf } from './sql.js';
import { mondayOf, unitOf } from './volume.js';

/**
 * Date range (FR-ED-18, DEC-ED-34, TR-ED-03): set on the date its role names, which it needs, and any other date, each
 * with its own result, without parameters. One scan of the table gives per date its first and last day, a moment on
 * its day in Brussels. eda adds the periods from the first to the last, in the unit of the date as Volume over time
 * counts it (a day, or the week from a Monday for the period of an aggregate), the current period, how many periods
 * the last is behind it, and how many lie before the Reliable Since of the Resource Card.
 */
export function dateRangeSql({ source, fields }: ProbeContext): string {
  const columns = fields.flatMap((field, index) => {
    const day = dayOf(field, source.resource.fields.find((candidate) => candidate.name === field)?.dataType ?? null);
    return [`format_date('%F', min(${day})) as first_${index}`, `format_date('%F', max(${day})) as last_${index}`];
  });
  return `${heading('dateRange', source)}
select
  ${columns.join(',\n  ')}
from ${quote(source.fullName)}${whereOf(source)}`;
}

/** The days from one day to another, both `YYYY-MM-DD`. */
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * The range of one date (DEC-ED-34), today in the time zone of Immoscoop: the periods from the first to the last, both
 * counted; how many periods the last is behind the current one, 0 for the current one or a later one, which is left
 * to Impossible values; and how many periods lie wholly before the day of Reliable Since. A date without any value has
 * no range: no periods, nothing behind and nothing before Reliable Since.
 */
export function rangeOf(first: string | null, last: string | null, options: { unit: DateRangeResult['unit']; today: string; reliableSince: string | null }): DateRangeResult {
  const { unit, today, reliableSince } = options;
  const periodOf = (day: string) => (unit === 'day' ? day : mondayOf(day));
  const between = (from: string, to: string) => Math.round(daysBetween(periodOf(from), periodOf(to)) / (unit === 'day' ? 1 : 7));
  const current = periodOf(today);
  if (first === null || last === null) return { unit, first: null, last: null, periods: 0, current, behind: 0, reliableSince, beforeReliable: reliableSince ? 0 : null };
  const periods = between(first, last) + 1;
  return {
    unit,
    first,
    last,
    periods,
    current,
    behind: Math.max(0, between(last, today)),
    reliableSince,
    beforeReliable: reliableSince ? Math.min(periods, Math.max(0, between(first, reliableSince))) : null,
  };
}

/** A day in an answer, `YYYY-MM-DD`; null for null. */
function dayIn(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const day = typeof value === 'string' ? value.slice(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new AnswerMismatch(`${JSON.stringify(value)} is no day`);
  return day;
}

/**
 * Its answer, one row, as a result per date: expected when the last is the current period or the one before, for a
 * day today or yesterday; look at this when it is further behind, or holds no value at all (DEC-ED-34).
 */
export function dateRangeResults(rows: readonly Record<string, unknown>[], { source, fields, today }: ProbeContext): Outcome[] {
  const row = onlyRow(rows);
  return fields.map((field, index) => {
    const data = rangeOf(dayIn(row[`first_${index}`]), dayIn(row[`last_${index}`]), { unit: unitOf(source, field), today, reliableSince: source.reliableSince });
    return { subject: field, data, reading: data.last !== null && data.behind <= 1 ? 'expected' : 'look' };
  });
}

export const dateRange: RunnableProbe = { key: 'dateRange', params: noParams, sql: dateRangeSql, results: dateRangeResults };

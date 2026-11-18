/**
 * The date functions a date Parameter suggests, each with the day it gives (DEC-LE-14, DEC-UX-118): Data Hub works
 * these out itself; any other function is worked out by BigQuery at every run. The web app and the MCP App of a Lens
 * offer the same list (FR-CL-36), each in its own words.
 */

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether a text is a day of the calendar, as `2026-10-25`. */
export function isDay(value: string): boolean {
  const match = DAY.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

/** A day as `YYYY-MM-DD`, of a date in UTC, as BigQuery's CURRENT_DATE() is. */
const iso = (date: Date) => date.toISOString().slice(0, 10);
const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day));

export interface DateFunction {
  /** Its key, by which each app names it in its own words. */
  key: 'today' | 'minus3' | 'week' | 'month' | 'quarter' | 'year' | 'lastWeek' | 'lastMonth';
  /** The SQL BigQuery works out at every run. */
  sql: string;
  /** The day it gives on a day. */
  on: (today: Date) => Date;
}

export const DATE_FUNCTIONS: readonly DateFunction[] = [
  { key: 'today', sql: 'CURRENT_DATE()', on: (today) => today },
  { key: 'minus3', sql: 'DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY)', on: (today) => utc(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 3) },
  {
    key: 'week',
    sql: 'DATE_TRUNC(CURRENT_DATE(), WEEK(MONDAY))',
    on: (today) => utc(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - ((today.getUTCDay() + 6) % 7)),
  },
  { key: 'month', sql: 'DATE_TRUNC(CURRENT_DATE(), MONTH)', on: (today) => utc(today.getUTCFullYear(), today.getUTCMonth(), 1) },
  { key: 'quarter', sql: 'DATE_TRUNC(CURRENT_DATE(), QUARTER)', on: (today) => utc(today.getUTCFullYear(), today.getUTCMonth() - (today.getUTCMonth() % 3), 1) },
  { key: 'year', sql: 'DATE_TRUNC(CURRENT_DATE(), YEAR)', on: (today) => utc(today.getUTCFullYear(), 0, 1) },
  {
    key: 'lastWeek',
    sql: 'DATE_SUB(DATE_TRUNC(CURRENT_DATE(), WEEK(MONDAY)), INTERVAL 1 DAY)',
    on: (today) => utc(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - ((today.getUTCDay() + 6) % 7) - 1),
  },
  { key: 'lastMonth', sql: 'LAST_DAY(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH))', on: (today) => utc(today.getUTCFullYear(), today.getUTCMonth(), 0) },
];

const plain = (sql: string) => sql.replace(/\s+/g, '').toUpperCase();

/** The suggested function a value is, if it is one of them (DEC-LE-14). */
export const dateFunctionOf = (value: string): DateFunction | null => DATE_FUNCTIONS.find((candidate) => plain(candidate.sql) === plain(value)) ?? null;

/** The day a date value gives today: itself, or what a suggested function gives; null for any other function. */
export function dayOf(value: string, today: Date = new Date()): string | null {
  if (isDay(value)) return value;
  const suggested = dateFunctionOf(value);
  return suggested ? iso(suggested.on(today)) : null;
}

/** Calendar periods on day numbers (days since 1970-01-01, UTC). Weeks are ISO weeks, Monday to Sunday. */
export type CalendarUnit = 'week' | 'month' | 'quarter' | 'year';

export const CALENDAR_UNITS: readonly CalendarUnit[] = ['week', 'month', 'quarter', 'year'];

const MS_PER_DAY = 86_400_000;

const toDate = (day: number) => new Date(day * MS_PER_DAY);
const fromParts = (year: number, month: number) => Date.UTC(year, month, 1) / MS_PER_DAY;

/** Monday 0 ... Sunday 6. */
export function weekday(day: number): number {
  return (toDate(day).getUTCDay() + 6) % 7;
}

/** The first day of the period that contains `day`. */
export function periodStart(day: number, unit: CalendarUnit): number {
  const date = toDate(day);
  const [year, month] = [date.getUTCFullYear(), date.getUTCMonth()];
  switch (unit) {
    case 'week':
      return day - weekday(day);
    case 'month':
      return fromParts(year, month);
    case 'quarter':
      return fromParts(year, month - (month % 3));
    case 'year':
      return fromParts(year, 0);
  }
}

/** The first day of the period `count` periods after (or before, when negative) the one starting at `start`. */
export function shiftPeriod(start: number, unit: CalendarUnit, count: number): number {
  if (unit === 'week') return start + 7 * count;
  const date = toDate(start);
  const months = unit === 'month' ? count : unit === 'quarter' ? 3 * count : 12 * count;
  return fromParts(date.getUTCFullYear(), date.getUTCMonth() + months);
}

/** ISO 8601 week number and week-based year: the week belongs to the year of its Thursday. */
export function isoWeek(day: number): { week: number; year: number } {
  const thursday = day - weekday(day) + 3;
  const year = toDate(thursday).getUTCFullYear();
  return { week: Math.floor((thursday - fromParts(year, 0)) / 7) + 1, year };
}

export function parts(day: number): { year: number; month: number; quarter: number } {
  const date = toDate(day);
  const month = date.getUTCMonth() + 1;
  return { year: date.getUTCFullYear(), month, quarter: Math.ceil(month / 3) };
}

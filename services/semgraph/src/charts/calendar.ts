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

/** The ISO name of a period, the name of a block in the contract (REQ-062): 2026-W40, 2026-09, 2026-Q3, 2026. */
export function periodName(first: number, unit: CalendarUnit): string {
  const { year, month, quarter } = parts(first);
  switch (unit) {
    case 'week': {
      const week = isoWeek(first);
      return `${week.year}-W${String(week.week).padStart(2, '0')}`;
    }
    case 'month':
      return `${year}-${String(month).padStart(2, '0')}`;
    case 'quarter':
      return `${year}-Q${quarter}`;
    case 'year':
      return String(year);
  }
}

const PERIOD_PATTERNS: Record<CalendarUnit, RegExp> = {
  week: /^(\d{4})-W(\d{2})$/,
  month: /^(\d{4})-(\d{2})$/,
  quarter: /^(\d{4})-Q([1-4])$/,
  year: /^(\d{4})$/,
};

/** The first day of the period with this ISO name, or undefined when it is not one of `unit`. */
export function periodFromName(name: string, unit: CalendarUnit): number | undefined {
  const match = PERIOD_PATTERNS[unit].exec(name);
  if (!match) return undefined;
  const year = Number(match[1]);
  const index = Number(match[2] ?? 1);
  let first: number;
  switch (unit) {
    case 'week': {
      // Week 1 is the week with the year's first Thursday, so it contains 4 January.
      const january4 = fromParts(year, 0) + 3;
      first = january4 - weekday(january4) + 7 * (index - 1);
      break;
    }
    case 'month':
      if (index < 1 || index > 12) return undefined;
      first = fromParts(year, index - 1);
      break;
    case 'quarter':
      first = fromParts(year, 3 * (index - 1));
      break;
    case 'year':
      first = fromParts(year, 0);
      break;
  }
  // A week 53 that does not exist would be week 1 of the next year: the name must round-trip.
  return periodName(first, unit) === name ? first : undefined;
}

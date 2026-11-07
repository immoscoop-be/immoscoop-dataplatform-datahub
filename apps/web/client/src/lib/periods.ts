import type { QueryDay, Shown } from './query.js';

/** A period of the panel of Query: a day of this week, a week back to the start of last month, or a month (DEC-UX-139). */
export interface Period {
  key: string;
  kind: 'day' | 'week' | 'month';
  /** Its first moment, and the first moment after it, in the time of this browser. */
  from: Date;
  to: Date;
  /** How many queries it holds, of what the panel shows. */
  count: number;
}

const midnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
/** The Monday of its week. */
const mondayOf = (date: Date) => addDays(midnight(date), -((date.getDay() + 6) % 7));
const dayFrom = (day: string) => {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year as number, (month as number) - 1, date as number);
};

/** The period a day belongs to, seen from now. */
export function periodOf(day: Date, now: Date): Omit<Period, 'count'> {
  const date = midnight(day);
  const week = mondayOf(now);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  if (date >= week) return { key: `day:${date.getTime()}`, kind: 'day', from: date, to: addDays(date, 1) };
  if (date >= lastMonth) {
    const monday = mondayOf(date);
    const from = monday < lastMonth ? lastMonth : monday;
    const next = addDays(monday, 7);
    return { key: `week:${from.getTime()}`, kind: 'week', from, to: next > week ? week : next };
  }
  const from = new Date(date.getFullYear(), date.getMonth(), 1);
  return { key: `month:${from.getTime()}`, kind: 'month', from, to: new Date(date.getFullYear(), date.getMonth() + 1, 1) };
}

/** How many queries of a day the panel shows: the plain ones, and what its chips add (DEC-UX-137). */
export const countOf = (day: QueryDay, show: ReadonlySet<Shown>) =>
  day.queries + (show.has('previews') ? day.previews : 0) + (show.has('lenses') ? day.lenses : 0) + (show.has('hidden') ? day.hidden : 0);

/** The periods that hold queries the panel shows, newest first. */
export function periodsOf(days: readonly QueryDay[], show: ReadonlySet<Shown>, now = new Date()): Period[] {
  const periods = new Map<string, Period>();
  for (const day of days) {
    const count = countOf(day, show);
    if (count === 0) continue;
    const period = periodOf(dayFrom(day.day), now);
    const known = periods.get(period.key);
    periods.set(period.key, { ...period, count: (known?.count ?? 0) + count });
  }
  return [...periods.values()].toSorted((a, b) => b.from.getTime() - a.from.getTime());
}

/** Whether a period is today. */
export const isToday = (period: Period, now = new Date()) => period.kind === 'day' && period.from.getTime() === midnight(now).getTime();

/** Whether a period is yesterday, also on the day the clock changes. */
export const isYesterday = (period: Period, now = new Date()) => period.kind === 'day' && period.from.getTime() === addDays(midnight(now), -1).getTime();

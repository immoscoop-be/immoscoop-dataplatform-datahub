import type { VolumeResult, VolumeUnit } from '@datahub/contracts/eda';
import type { EdaSource } from '../catalogue.js';
import type { Outcome, ProbeContext, RunnableProbe } from './probe.js';
import { AnswerMismatch, countOf, dayOf, heading, numberOf, quote, whereOf } from './sql.js';

/**
 * Volume over time, with empty periods (FR-ED-09, DEC-ED-23, TR-ED-03): set on the date its role names and any other
 * date, each with its own result. It counts per period of the unit of its date, a day, or the week from a Monday for
 * the period of an aggregate, the rows and, for an aggregate or a fact, the sum of the field that adds up.
 *
 * Its parameters: `measure`, the field that adds up, when it has more than one, or null to count rows only; and
 * `mayBeEmpty: 'weekends'`, for a count per day whose Saturdays and Sundays may be without rows.
 */

/** The blocks of days the volume is judged over, from a Monday: the same weekdays in each (DEC-ED-23, DEC-CM-29). */
export const BLOCKS = [7, 14, 21, 28] as const;

type Unit = VolumeResult['unit'];

/** The unit of a date: the week from a Monday for the period of an aggregate, a day otherwise. */
export function unitOf(source: EdaSource, field: string): Unit {
  const role = source.resource.fields.find((candidate) => candidate.name === field)?.role;
  return role === 'period' ? 'week' : 'day';
}

/** The role of the field that adds up, for the model types that have one: the volume business means. */
export function addingRole(source: EdaSource): 'addsUp' | 'measure' | null {
  const type = source.resource.modelType;
  return type === 'aggregate' ? 'addsUp' : type === 'fact' ? 'measure' : null;
}

/**
 * The field that adds up a Resource starts from (DEC-ED-23, DEC-ED-33): the first Key Field that adds up, else the
 * first field that does; null for a model type without one. A unique count never adds up.
 */
export function addingField(source: EdaSource): string | null {
  const role = addingRole(source);
  if (!role) return null;
  const adding = source.resource.fields.filter((field) => field.role === role);
  return (adding.find((field) => field.keyField) ?? adding[0])?.name ?? null;
}

/** The field whose sum is the volume (DEC-ED-23): the one chosen, else the field that adds up; null for rows only. */
export function measureOf(source: EdaSource, params: Record<string, unknown>): string | null {
  return params.measure !== undefined ? (params.measure as string | null) : addingField(source);
}

function volumeParams(given: Record<string, unknown>, source: EdaSource): Record<string, unknown> | string {
  const params: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(given)) {
    if (name === 'measure') {
      if (value === null) {
        params.measure = null;
        continue;
      }
      const role = addingRole(source);
      const field = source.resource.fields.find((candidate) => candidate.name === value);
      if (!role || !field || field.role !== role) {
        return role ? `The measure is a field that holds the role ${role}, or null to count rows only.` : 'Only an aggregate or a fact has a field that adds up.';
      }
      params.measure = field.name;
    } else if (name === 'mayBeEmpty') {
      if (value !== 'weekends') return "mayBeEmpty is 'weekends', for a count per day.";
      params.mayBeEmpty = value;
    } else {
      return `Volume over time has no parameter ${name}.`;
    }
  }
  return params;
}

/**
 * One scan of the table, each date it is set on beside the others: per date and period the rows and the sum of the
 * field that adds up. Rows without a value for a date are left out of that date.
 */
export function volumeSql(context: ProbeContext): string {
  const { source, fields, params } = context;
  const measure = measureOf(source, params);
  const periods = fields.map((field, index) => {
    const type = source.resource.fields.find((candidate) => candidate.name === field)?.dataType ?? null;
    const day = dayOf(field, type);
    const period = unitOf(source, field) === 'week' ? `date_trunc(${day}, week(monday))` : day;
    return `struct(${index} as date_index, ${period} as period)`;
  });
  return `${heading('volumeOverTime', source)}
select
  eda_dated.date_index,
  format_date('%F', eda_dated.period) as period_start,
  count(*) as row_count${measure ? `,\n  sum(${quote(measure)}) as measure_sum` : ''}
from ${quote(source.fullName)}
cross join unnest([
  ${periods.join(',\n  ')}
]) as eda_dated${whereOf(context, ['eda_dated.period is not null'])}
group by 1, 2
order by 1, 2`;
}

// ----------------------------------------------------------------------------------------------------------------
// Days, as `YYYY-MM-DD`

const DAY = 86_400_000;
const timeOf = (day: string) => Date.parse(`${day}T00:00:00Z`);
const dayAt = (time: number) => new Date(time).toISOString().slice(0, 10);
const addDays = (day: string, days: number) => dayAt(timeOf(day) + days * DAY);
/** The Monday of the week a day is in. */
export const mondayOf = (day: string) => addDays(day, -((new Date(timeOf(day)).getUTCDay() + 6) % 7));
const isWeekend = (day: string) => [0, 6].includes(new Date(timeOf(day)).getUTCDay());

/** A value and the start of the period or block it is of. */
interface Valued {
  value: number;
  start: string;
}

/** A share between 0 and 1 of sorted numbers, between the two nearest where it falls between them. */
function quantile(sorted: readonly number[], share: number): number {
  const position = (sorted.length - 1) * share;
  const below = Math.floor(position);
  const low = sorted[below] ?? 0;
  const high = sorted[Math.min(below + 1, sorted.length - 1)] ?? low;
  return low + (high - low) * (position - below);
}

/** How calm the volume is in one unit (DEC-ED-23): the standard deviation of a sample, over n − 1. */
export function calm(days: VolumeUnit['days'], values: readonly Valued[]): VolumeUnit | null {
  const first = values[0];
  if (!first) return null;
  const numbers = values.map((entry) => entry.value);
  const average = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  const variance = numbers.length > 1 ? numbers.reduce((sum, value) => sum + (value - average) ** 2, 0) / (numbers.length - 1) : 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const lowest = values.reduce((low, entry) => (entry.value < low.value ? entry : low), first);
  const highest = values.reduce((high, entry) => (entry.value > high.value ? entry : high), first);
  return {
    days,
    average,
    sd: Math.sqrt(variance),
    p25: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    lowest: { value: lowest.value, start: lowest.start },
    highest: { value: highest.value, start: highest.start },
  };
}

/** The periods of one date as the answer gives them: only those with rows. */
export interface Counted {
  start: string;
  rows: number;
  sum: number | null;
}

/**
 * The volume of one date (DEC-ED-23): every period from the first to the last, the empty ones among them; the current
 * one, not complete yet, which never counts as empty; and per unit, 7, 14, 21 and 28 days from a Monday and a day for
 * a daily unit, how calm it is, leaving out a block with a period without rows and the current, incomplete one.
 */
export function volumeOf(counted: readonly Counted[], options: { unit: Unit; measure: string | null; today: string; weekendsMayBeEmpty?: boolean }): VolumeResult {
  const { unit, measure, today } = options;
  const step = unit === 'day' ? 1 : 7;
  const sorted = [...counted].sort((a, b) => a.start.localeCompare(b.start));
  const firstPeriod = sorted[0];
  const lastPeriod = sorted.at(-1);
  if (!firstPeriod || !lastPeriod) return { unit, measure, periods: [], empty: [], current: null, units: [] };
  const first = firstPeriod.start;
  const last = lastPeriod.start;

  const byStart = new Map(sorted.map((period) => [period.start, period]));
  const periods: VolumeResult['periods'] = [];
  for (let start = first; start <= last; start = addDays(start, step)) {
    const period = byStart.get(start);
    periods.push({ start, rows: period?.rows ?? 0, sum: measure ? (period?.sum ?? 0) : null });
  }

  const currentStart = unit === 'day' ? today : mondayOf(today);
  const current = first <= currentStart && currentStart <= last ? currentStart : null;
  /** A Saturday or Sunday that may be without rows, for a count per day. */
  const mayBeEmpty = (start: string) => options.weekendsMayBeEmpty === true && unit === 'day' && isWeekend(start);
  const empty = periods.filter((period) => period.rows === 0 && period.start !== currentStart && !mayBeEmpty(period.start)).map((period) => period.start);

  // Only complete periods count: those before the current one.
  const complete = periods.filter((period) => period.start < currentStart);
  const valueOf = (period: VolumeResult['periods'][number]) => (measure ? (period.sum ?? 0) : period.rows);
  const units: VolumeUnit[] = [];
  if (unit === 'day') {
    const day = calm(1, complete.filter((period) => period.rows > 0).map((period) => ({ value: valueOf(period), start: period.start })));
    if (day) units.push(day);
  }
  const lastComplete = complete.at(-1);
  if (lastComplete) {
    // The blocks end on the Monday on or before the end of the last complete period, and go back from there.
    const anchor = mondayOf(addDays(lastComplete.start, step));
    const indexOf = (start: string) => Math.round((timeOf(start) - timeOf(first)) / (step * DAY));
    for (const days of BLOCKS) {
      const blocks: Valued[] = [];
      for (let back = 1; ; back += 1) {
        const start = addDays(anchor, -back * days);
        if (start < first) break;
        const inside = periods.slice(indexOf(start), indexOf(start) + days / step);
        if (inside.some((period) => period.rows === 0 && !mayBeEmpty(period.start))) continue;
        blocks.push({ value: inside.reduce((sum, period) => sum + valueOf(period), 0), start });
      }
      const block = calm(days, blocks.reverse());
      if (block) units.push(block);
    }
  }
  return { unit, measure, periods, empty, current, units };
}

/** Its answer, a row per date and period with rows, as a result per date: look at this with a period without rows. */
export function volumeResults(rows: readonly Record<string, unknown>[], { source, fields, params, today }: ProbeContext): Outcome[] {
  const measure = measureOf(source, params);
  const perDate = fields.map((): Counted[] => []);
  for (const row of rows) {
    const index = countOf(row.date_index);
    const start = typeof row.period_start === 'string' ? row.period_start.slice(0, 10) : null;
    if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !perDate[index]) throw new AnswerMismatch('a period of the volume has no date or no field');
    perDate[index].push({ start, rows: countOf(row.row_count), sum: measure ? numberOf(row.measure_sum) : null });
  }
  return fields.map((field, index) => {
    const data = volumeOf(perDate[index] ?? [], { unit: unitOf(source, field), measure, today, weekendsMayBeEmpty: params.mayBeEmpty === 'weekends' });
    return { subject: field, data, reading: data.empty.length > 0 ? 'look' : 'expected' };
  });
}

export const volumeOverTime: RunnableProbe = {
  key: 'volumeOverTime',
  params: volumeParams,
  sql: volumeSql,
  results: volumeResults,
};

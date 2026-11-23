import { DISGUISED_DEFAULTS, DISGUISED_NINES, type DataHubReading, type DisguisedLists, type DisguisedResult } from '@datahub/contracts/eda';
import type { EdaSource } from '../catalogue.js';
import type { Outcome, ProbeContext, RunnableProbe } from './probe.js';
import { disguisedOf } from './selection.js';
import {
  comparedOf,
  conditionKind,
  countOf,
  dayLiteral,
  fieldOf,
  heading,
  isDay,
  isText,
  NINES_ONLY,
  numberLiteral,
  onlyRow,
  quote,
  saysNothingOf,
  textLiteral,
  whereOf,
} from './sql.js';

/** How the value of nines only is named among the values found. */
export const NINES = DISGUISED_NINES;

/** A list holds at most this many values. */
const MAX_VALUES = 1000;

/** One value Disguised nulls counts on its own in a field: how it is named, and the SQL that holds where it is found. */
interface Looked {
  value: string;
  sql: string;
}

/**
 * The values Disguised nulls counts on their own in a field (DEC-ED-35), by its kind: the empty text and the texts of
 * the lists, trimmed and in lower case; the days of the lists; the numbers of the lists, never zero, and nines only.
 * A field of any other kind has none: only its rows without a value say nothing.
 */
export function lookedFor(source: EdaSource, name: string, lists: DisguisedLists): Looked[] {
  const field = fieldOf(source, name);
  const kind = conditionKind(field.dataType);
  const compared = comparedOf(field, kind);
  switch (kind) {
    case 'text':
      return [...new Set(['', ...lists.text.map((text) => text.trim().toLowerCase())])].map((value) => ({ value, sql: `lower(trim(${compared})) = ${textLiteral(value)}` }));
    case 'date':
      return [...new Set(lists.date)].map((value) => ({ value, sql: `${compared} = ${dayLiteral(value)}` }));
    case 'number':
      return [
        ...[...new Set(lists.number.filter((number) => number !== 0))].map((number) => ({ value: String(number), sql: `${compared} = ${numberLiteral(number)}` })),
        ...(lists.ninesOnly ? [{ value: NINES, sql: `regexp_contains(cast(${compared} as string), ${NINES_ONLY})` }] : []),
      ];
    default:
      return [];
  }
}

/**
 * Its parameters (DEC-ED-35): the lists it looks for, `{ lists: { text, date, number, ninesOnly } }`, each part that is
 * not given as Data Hub proposes it. A text is trimmed and in lower case, as it is compared; zero is never one.
 */
export function disguisedParams(given: Record<string, unknown>): Record<string, unknown> | string {
  const { lists, ...rest } = given;
  const unknown = Object.keys(rest)[0];
  if (unknown !== undefined) return `This EDA-Probe has no parameter ${unknown}.`;
  if (lists === undefined) return { lists: structuredClone(DISGUISED_DEFAULTS) };
  if (typeof lists !== 'object' || lists === null || Array.isArray(lists)) return 'lists is { text, date, number, ninesOnly }.';
  const { text, date, number, ninesOnly, ...other } = lists as Record<string, unknown>;
  const extra = Object.keys(other)[0];
  if (extra !== undefined) return `lists has no ${extra}: only text, date, number and ninesOnly.`;
  const listOf = <T>(value: unknown, fit: (one: unknown) => one is T): T[] | null | undefined =>
    value === undefined ? undefined : Array.isArray(value) && value.length <= MAX_VALUES && value.every(fit) ? value : null;
  const texts = listOf(text, isText);
  if (texts === null) return `lists.text is a list of at most ${MAX_VALUES} texts.`;
  const days = listOf(date, isDay);
  if (days === null) return `lists.date is a list of at most ${MAX_VALUES} days, YYYY-MM-DD.`;
  const numbers = listOf(number, (one): one is number => typeof one === 'number' && Number.isFinite(one));
  if (numbers === null) return `lists.number is a list of at most ${MAX_VALUES} numbers.`;
  if (numbers?.includes(0)) return 'Zero never says nothing (DEC-ED-35): take it out of lists.number.';
  if (ninesOnly !== undefined && typeof ninesOnly !== 'boolean') return 'lists.ninesOnly is true or false.';
  return {
    lists: {
      text: [...new Set((texts ?? DISGUISED_DEFAULTS.text).map((one) => one.trim().toLowerCase()))].filter((one) => one !== ''),
      date: [...new Set(days ?? DISGUISED_DEFAULTS.date)],
      number: [...new Set(numbers ?? DISGUISED_DEFAULTS.number)],
      ninesOnly: ninesOnly ?? DISGUISED_DEFAULTS.ninesOnly,
    },
  };
}

/**
 * Disguised nulls (DEC-ED-35, TR-ED-03): set on every Key Field and any other field added. One scan of the rows it runs
 * on counts them, and per field the rows that say nothing, those without a value, and each value it looks for apart.
 */
export function disguisedSql(context: ProbeContext): string {
  const { source, fields, params } = context;
  const lists = disguisedOf(params);
  const columns = fields.flatMap((name, index) => [
    `countif(${saysNothingOf(fieldOf(source, name), lists)}) as says_${index}`,
    `countif(${quote(name)} is null) as null_${index}`,
    ...lookedFor(source, name, lists).map((one, place) => `countif(${one.sql}) as found_${index}_${place}`),
  ]);
  return `${heading('disguisedNulls', source)}
select
  count(*) as row_count,
  ${columns.join(',\n  ')}
from ${quote(source.fullName)}${whereOf(context)}`;
}

/**
 * Its answer, one row, as a result per field: the rows that say nothing, those without a value among them, and the
 * values found with their rows, the most first. Expected when none say nothing; for you to judge with some; look at
 * this with some in a field that holds a role of its model type (DEC-ED-35, as DEC-ED-22).
 */
export function disguisedResults(rows: readonly Record<string, unknown>[], context: ProbeContext): Outcome[] {
  const { source, fields, params } = context;
  const row = onlyRow(rows);
  const lists = disguisedOf(params);
  return fields.map((name, index) => {
    const role = fieldOf(source, name).role ?? null;
    const found = lookedFor(source, name, lists)
      .map((one, place) => ({ value: one.value, rows: countOf(row[`found_${index}_${place}`]) }))
      .filter((one) => one.rows > 0)
      .sort((a, b) => b.rows - a.rows);
    const data: DisguisedResult = { rows: countOf(row.row_count), saysNothing: countOf(row[`says_${index}`]), nulls: countOf(row[`null_${index}`]), found, role };
    const reading: DataHubReading = data.saysNothing === 0 ? 'expected' : role ? 'look' : 'judge';
    return { subject: name, data, reading };
  });
}

export const disguisedNulls: RunnableProbe = { key: 'disguisedNulls', params: disguisedParams, sql: disguisedSql, results: disguisedResults };

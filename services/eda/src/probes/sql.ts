import { DISGUISED_DEFAULTS, type DisguisedLists, type EdaField, type RowCondition, type Selection } from '@datahub/contracts/eda';
import { kindOf } from '@datahub/contracts/model-types';
import type { EdaSource } from '../catalogue.js';

/**
 * What the SQL of every EDA-Probe shares (TR-ED-03): names quoted for BigQuery Standard SQL, the table by its full
 * name, a filter that keeps every partition of a table that requires one, and the conditions of the selection of rows
 * it runs on (OP-ED-12).
 */

/** The time zone in which a moment falls on a day, and in which today is today: that of Immoscoop. */
export const TIME_ZONE = 'Europe/Brussels';

/** A name quoted for BigQuery: a field, or the full name of a table, `project.dataset.table`, as one name. */
export function quote(name: string): string {
  return `\`${name.replaceAll('\\', '\\\\').replaceAll('`', '\\`')}\``;
}

/** The base type of a field in BigQuery, such as `TIMESTAMP` for `TIMESTAMP` or `NUMERIC` for `NUMERIC(10, 2)`. */
export function baseType(dataType: string | null): string {
  return (dataType ?? '').trim().toUpperCase().replace(/\(.*$/, '');
}

/** The type of the partition column: of its field, or of the pseudo column of a table partitioned when rows came in. */
function partitionType(source: EdaSource, field: string): string {
  const named = source.resource.fields.find((candidate) => candidate.name.toLowerCase() === field.toLowerCase());
  if (named?.dataType) return baseType(named.dataType);
  if (field.toUpperCase() === '_PARTITIONTIME') return 'TIMESTAMP';
  if (field.toUpperCase() === '_PARTITIONDATE') return 'DATE';
  return source.partition?.unit === 'hour' ? 'TIMESTAMP' : 'DATE';
}

/**
 * A filter on the partition column that keeps every partition, the one without a value among them, for a table that
 * requires a filter on it (DEC-SR-35); null for a table that requires none, which then reads every partition anyway.
 */
export function everyPartition(source: EdaSource): string | null {
  if (!source.partition || source.partitionFilter === 'none') return null;
  const column = quote(source.partition.field);
  const type = partitionType(source, source.partition.field);
  const lowest =
    type === 'TIMESTAMP'
      ? "timestamp '0001-01-01 00:00:00+00'"
      : type === 'DATETIME'
        ? "datetime '0001-01-01 00:00:00'"
        : type === 'INT64' || type === 'INTEGER'
          ? '-9223372036854775808'
          : "date '0001-01-01'";
  return `(${column} is null or ${column} >= ${lowest})`;
}

/**
 * The rows an EDA-Probe reads (OP-ED-12): its table, and the selection of rows it runs on, the whole table when absent
 * or without conditions; with the values that say nothing in its EDA, Data Hub's proposal when absent (DEC-ED-35).
 */
export interface Rows {
  source: EdaSource;
  selection?: Selection;
  disguised?: DisguisedLists;
}

/**
 * The `where` of an EDA-Probe on its table, on a line of its own at this indent: the filter that keeps every partition,
 * the conditions of the selection it runs on (OP-ED-12) and any conditions of its own; empty without any.
 */
export function whereOf(rows: Rows, conditions: string[] = [], indent = ''): string {
  const all = [everyPartition(rows.source), ...conditionsOf(rows), ...conditions].filter((condition): condition is string => condition !== null);
  return all.length ? `\n${indent}where ${all.join(`\n${indent}  and `)}` : '';
}

// ----------------------------------------------------------------------------------------------------------------
// The selection of rows an EDA-Probe runs on (OP-ED-12). Its conditions come from the User: a field is only a field of
// the Resource, quoted, and every value is written by a literal of its own kind that refuses what does not fit, so
// that nothing of a value can end its literal and become SQL.

/** A value of a condition that cannot be written as a literal of its kind; checkSelection answers it as 400 first. */
export class UnsafeValue extends Error {}

/** The longest text a condition compares with. */
export const MAX_TEXT = 1000;

/** The kind of a field a condition compares: that of the contracts, and true or false for a `BOOL`. */
export type ConditionKind = 'text' | 'number' | 'date' | 'boolean' | 'other';

/** The kind of a field, from its type in BigQuery, as a condition compares it. */
export function conditionKind(dataType: string | null): ConditionKind {
  const type = baseType(dataType);
  return type === 'BOOL' || type === 'BOOLEAN' ? 'boolean' : kindOf(dataType);
}

/** Whether a value is a day that exists, `YYYY-MM-DD`, from 0001-01-01 to 9999-12-31, as a `DATE` of BigQuery. */
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  return year >= 1 && day >= 1 && day <= days;
}

/** Whether a value is a text a condition can compare with: well formed, and not too long. */
export function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_TEXT && value.isWellFormed();
}

/** The escapes of a quoted string of BigQuery for the characters that cannot stand in one as they are. */
const ESCAPES: Record<string, string> = { '\\': '\\\\', "'": "\\'", '\n': '\\n', '\r': '\\r', '\t': '\\t' };

/**
 * A text as a quoted string of BigQuery: a backslash and a quote escaped, and every control character, line break and
 * separator written as an escape, so that the literal holds on one line and ends only at its last quote.
 */
export function textLiteral(value: string): string {
  if (!isText(value)) throw new UnsafeValue('a text of a condition is no text, or too long');
  const escaped = value.replace(
    /[\\'\u0000-\u001f\u007f-\u009f\u2028\u2029]/g,
    (character) => ESCAPES[character] ?? `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
  return `'${escaped}'`;
}

/** A number as a literal of BigQuery: digits for an integer it holds exactly, a decimal or an exponent otherwise. */
export function numberLiteral(value: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new UnsafeValue('a number of a condition is no finite number');
  const text = Number.isSafeInteger(value) || /[.e]/.test(String(value)) ? String(value) : value.toExponential();
  // Only a sign, digits, a point and an exponent: never anything else.
  if (!/^-?\d+(\.\d+)?(e[+-]\d+)?$/.test(text)) throw new UnsafeValue(`${text} is no number BigQuery reads`);
  return text;
}

/** A day as a `DATE` literal of BigQuery. */
export function dayLiteral(value: string): string {
  if (!isDay(value)) throw new UnsafeValue('a day of a condition is no day, YYYY-MM-DD');
  return `date '${value}'`;
}

/** True or false as a literal of BigQuery. */
export function booleanLiteral(value: boolean): string {
  if (value !== true && value !== false) throw new UnsafeValue('a condition on true or false holds something else');
  return value ? 'true' : 'false';
}

/** A value of a condition as a literal of the kind of its field; what does not fit that kind is refused. */
function literalOf(kind: ConditionKind, value: string | number | boolean): string {
  if (kind === 'text' && typeof value === 'string') return textLiteral(value);
  if (kind === 'number' && typeof value === 'number') return numberLiteral(value);
  if (kind === 'date' && typeof value === 'string') return dayLiteral(value);
  if (kind === 'boolean' && typeof value === 'boolean') return booleanLiteral(value);
  throw new UnsafeValue(`a ${kind} cannot be compared with ${JSON.stringify(value)}`);
}

/** A field of the Resource, by its name; anything else is refused, never written as a name. */
export function fieldOf(source: EdaSource, name: string): EdaField {
  const field = source.resource.fields.find((candidate) => candidate.name === name);
  if (!field) throw new UnsafeValue(`${name} is no field of this Resource`);
  return field;
}

/** What a condition compares of a field: a date by its day, a moment in Brussels as the EDA-Probes take it. */
export function comparedOf(field: EdaField, kind: ConditionKind): string {
  return kind === 'date' ? dayOf(field.name, field.dataType) : quote(field.name);
}

/** A number of nines only, at least three, such as 999 or -99999.0 (DEC-ED-35); never zero. */
export const NINES_ONLY = String.raw`r'^-?9{3,}(\.0+)?$'`;

/** Conditions that hold together or apart, in parentheses when there is more than one. */
const joined = (parts: readonly string[], by: 'and' | 'or') => (parts.length > 1 ? `(${parts.join(` ${by} `)})` : parts.join(''));

/**
 * Where a field says nothing (DEC-ED-35): it has no value; or, by its kind, a text whose value trimmed and in lower
 * case is empty or one of the texts of the lists, compared trimmed and in lower case too; a date whose day is one of
 * the days of the lists; a number of the numbers of the lists, or of nines only when they say nothing. Zero never
 * says nothing. A field of any other kind says nothing only without a value.
 */
export function saysNothingOf(field: EdaField, disguised: DisguisedLists = DISGUISED_DEFAULTS): string {
  const column = quote(field.name);
  const kind = conditionKind(field.dataType);
  const any: string[] = [`${column} is null`];
  if (kind === 'text') {
    const texts = [...new Set(['', ...disguised.text.map((text) => text.trim().toLowerCase())])];
    any.push(`lower(trim(${column})) in (${texts.map(textLiteral).join(', ')})`);
  } else if (kind === 'date' && disguised.date.length > 0) {
    any.push(`${comparedOf(field, kind)} in (${[...new Set(disguised.date)].map(dayLiteral).join(', ')})`);
  } else if (kind === 'number') {
    const numbers = [...new Set(disguised.number.filter((number) => number !== 0))];
    if (numbers.length > 0) any.push(`${column} in (${numbers.map(numberLiteral).join(', ')})`);
    if (disguised.ninesOnly) any.push(`regexp_contains(cast(${column} as string), ${NINES_ONLY})`);
  }
  return joined(any, 'or');
}

/**
 * One condition of a selection as SQL (OP-ED-12): the field says nothing; equals a value of its kind; or lies in a
 * range, from inclusive and before exclusive, of numbers or of days. A date is compared on its day.
 */
export function conditionOf(condition: RowCondition, source: EdaSource, disguised: DisguisedLists = DISGUISED_DEFAULTS): string {
  const field = fieldOf(source, condition.field);
  const kind = conditionKind(field.dataType);
  switch (condition.kind) {
    case 'saysNothing':
      return saysNothingOf(field, disguised);
    case 'equals':
      return `${comparedOf(field, kind)} = ${literalOf(kind, condition.value)}`;
    case 'range': {
      if (kind !== 'number' && kind !== 'date') throw new UnsafeValue(`a range is on a number or a date, not on a ${kind}`);
      const bounds = [
        ...(condition.from === undefined ? [] : [`${comparedOf(field, kind)} >= ${literalOf(kind, condition.from)}`]),
        ...(condition.before === undefined ? [] : [`${comparedOf(field, kind)} < ${literalOf(kind, condition.before)}`]),
      ];
      if (bounds.length === 0) throw new UnsafeValue('a range has from, before or both');
      return joined(bounds, 'and');
    }
    default:
      throw new UnsafeValue('a condition is saysNothing, equals or range');
  }
}

/** The conditions of the selection an EDA-Probe runs on, in its order; none for the whole table (OP-ED-12). */
export function conditionsOf({ source, selection, disguised }: Rows): string[] {
  return (selection?.where ?? []).map((condition) => conditionOf(condition, source, disguised));
}

/** The first line of the SQL of an EDA-Probe, so that the Query Log says what it is. */
export function heading(probe: string, source: EdaSource): string {
  return `-- EDA-Probe ${probe} on ${source.resource.displayName.replace(/[\r\n]+/g, ' ')}: aggregates only (TR-ED-03)`;
}

/** The day a value of a date field falls on: a moment in the time zone of Immoscoop. */
export function dayOf(field: string, dataType: string | null): string {
  const column = quote(field);
  const type = baseType(dataType);
  if (type === 'TIMESTAMP') return `date(${column}, '${TIME_ZONE}')`;
  if (type === 'DATETIME') return `date(${column})`;
  return column;
}

// ----------------------------------------------------------------------------------------------------------------
// Reading the answer of query: every value as BigQuery writes it, as text, null as null (TR-ED-04).

/** An answer of query that does not have the shape the SQL of an EDA-Probe gives. */
export class AnswerMismatch extends Error {}

/** An answer that cannot be read as the User set the EDA-Probe, such as bins too narrow: they change its setting. */
export class ResultRefused extends Error {}

/** A number in an answer: BigQuery writes numbers as text; null for null. */
export function numberOf(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  if (!Number.isFinite(number)) throw new AnswerMismatch(`${JSON.stringify(value)} is no number`);
  return number;
}

/** A number in an answer that is never null, such as a count. */
export function countOf(value: unknown): number {
  return numberOf(value) ?? 0;
}

/** A value written as JSON by `to_json_string`: text, or already read as JSON. */
export function jsonOf(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? null;
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    throw new AnswerMismatch('a value is no JSON', { cause: error });
  }
}

/** The first row of an answer, which a probe answering one row needs. */
export function onlyRow(rows: readonly Record<string, unknown>[]): Record<string, unknown> {
  const row = rows[0];
  if (!row) throw new AnswerMismatch('the answer has no row');
  return row;
}

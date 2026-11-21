import type { EdaSource } from '../catalogue.js';

/**
 * What the SQL of every EDA-Probe shares (TR-ED-03): names quoted for BigQuery Standard SQL, the table by its full
 * name, and a filter that keeps every partition of a table that requires one.
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
 * The `where` of an EDA-Probe on its table, on a line of its own at this indent: the filter that keeps every partition
 * and any conditions of its own; empty without either.
 */
export function whereOf(source: EdaSource, conditions: string[] = [], indent = ''): string {
  const all = [everyPartition(source), ...conditions].filter((condition): condition is string => condition !== null);
  return all.length ? `\n${indent}where ${all.join(`\n${indent}  and `)}` : '';
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

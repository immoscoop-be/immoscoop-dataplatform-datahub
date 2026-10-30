import { type BigQuery, BigQueryRefused, type TableFacts } from './bigquery.js';
import type { QueryResource } from './catalogue.js';
import type { Parameter, ParameterKind } from './parameters.js';

/** The partition column of a Preview offers its newest 1, 4 or 12 partitions that hold rows (DEC-SR-39). */
export const WINDOWS = [1, 4, 12] as const;
export type Window = (typeof WINDOWS)[number];

/** A Preview shows its first rows, 100 a page; it keeps at most this many (FR-SR-51). */
export const PREVIEW_ROWS = 1000;
/** A choice lists at most this many values of its column (DEC-SR-37). */
export const VALUES = 100;
/** How many choices a Preview offers besides its partition column. */
const CHOICES = 6;

const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const quote = (name: string) => `\`${name}\``;

/** The first moment of a partition by its ID: `20261019` a day, `2026101908` an hour, `202610` a month, `2026` a year. */
export function partitionStart(id: string): string | null {
  const match = /^(\d{4})(\d{2})?(\d{2})?(\d{2})?$/.exec(id);
  if (!match) return null;
  const [, year, month = '01', day = '01', hour] = match;
  return hour === undefined ? `${year}-${month}-${day}` : `${year}-${month}-${day} ${hour}:00:00`;
}

/**
 * The filter of a Preview on its partition column (DEC-SR-39): from the start of the newest partition of
 * its window that holds rows; or, where Data Hub cannot tell which do, back from today in the unit of its
 * partitions. Null for a column it cannot filter by time.
 */
export function windowFilter(field: string, dataType: string | null, unit: string | null, from: string | null, window: Window): string | null {
  const type = (dataType ?? 'DATE').toUpperCase();
  const column = quote(field);
  if (from) {
    const moment = from.length === 10 ? `${from} 00:00:00` : from;
    if (type === 'DATE') return `${column} >= DATE '${from.slice(0, 10)}'`;
    if (type === 'TIMESTAMP') return `${column} >= TIMESTAMP '${moment} UTC'`;
    if (type === 'DATETIME') return `${column} >= DATETIME '${moment}'`;
    return null;
  }
  const part = unit === 'hour' ? 'HOUR' : unit === 'month' ? 'MONTH' : unit === 'year' ? 'YEAR' : unit === 'day' || unit === null ? 'DAY' : null;
  if (!part) return null;
  if (type === 'DATE') return part === 'HOUR' ? `${column} >= current_date()` : `${column} >= date_sub(current_date(), interval ${window} ${part})`;
  if (type === 'TIMESTAMP') return part === 'HOUR' ? `${column} >= timestamp_sub(current_timestamp(), interval ${window} HOUR)` : `${column} >= timestamp(date_sub(current_date(), interval ${window} ${part}))`;
  if (type === 'DATETIME') return part === 'HOUR' ? `${column} >= datetime_sub(current_datetime(), interval ${window} HOUR)` : `${column} >= datetime(date_sub(current_date(), interval ${window} ${part}))`;
  return null;
}

/** A column a Preview offers to choose by: its first cluster column, then the Parameters of its Card (FR-SR-38). */
export interface Choice {
  field: string;
  dataType: string;
  role: 'cluster' | 'parameter';
  kind: ParameterKind;
}

/** The kind of a Parameter for a value of a column of this type; null for a type a Preview does not offer. */
function kindOfType(dataType: string | null): ParameterKind | null {
  const type = (dataType ?? '').toUpperCase();
  if (type === 'STRING') return 'choice';
  if (type === 'INT64' || type === 'INTEGER') return 'number';
  if (['NUMERIC', 'BIGNUMERIC', 'FLOAT64', 'FLOAT'].includes(type)) return 'decimal';
  if (type === 'DATE') return 'date';
  if (type === 'BOOL' || type === 'BOOLEAN') return 'yesno';
  return null;
}

export function choicesOf(resource: QueryResource): Choice[] {
  const wanted: { field: string; role: Choice['role'] }[] = [
    ...(resource.clusterBy[0] ? [{ field: resource.clusterBy[0], role: 'cluster' as const }] : []),
    ...resource.parameters.map((field) => ({ field, role: 'parameter' as const })),
  ];
  const choices: Choice[] = [];
  for (const { field, role } of wanted) {
    if (field === resource.partition?.field || choices.some((choice) => choice.field === field) || !NAME.test(field)) continue;
    const dataType = resource.fields.find((candidate) => candidate.name === field)?.dataType ?? null;
    const kind = kindOfType(dataType);
    if (kind && dataType) choices.push({ field, dataType, role, kind });
  }
  return choices.slice(0, CHOICES);
}

/** The SQL of a Preview: its fields, newest first, within its window and its choices (FR-SR-38). */
export function previewSql(resource: QueryResource, filter: string | null, chosen: readonly string[]): string {
  const fields = resource.fields.length > 0 ? resource.fields.map((field) => quote(field.name)) : ['*'];
  const conditions = [...(filter ? [filter] : []), ...chosen.map((field) => `${quote(field)} = @${field}`)];
  return [
    `select ${fields.join(', ')}`,
    `from ${quote(resource.fullName)}`,
    ...(conditions.length ? [`where ${conditions.join('\n  and ')}`] : []),
    ...(resource.partition ? [`order by ${quote(resource.partition.field)} desc`] : []),
    `limit ${PREVIEW_ROWS}`,
  ].join('\n');
}

/** The SQL that reads the values of its choices, at most 100 each, from the partitions of its window (DEC-SR-37). */
export function valuesSql(resource: QueryResource, filter: string | null, choices: readonly Choice[]): string {
  const lists = choices.map(({ field }) => `array_agg(distinct ${quote(field)} ignore nulls order by ${quote(field)} limit ${VALUES}) as ${quote(field)}`);
  return [`select ${lists.join(',\n       ')}`, `from ${quote(resource.fullName)}`, ...(filter ? [`where ${filter}`] : [])].join('\n');
}

const LITERAL: Partial<Record<ParameterKind, RegExp>> = {
  number: /^-?\d{1,19}$/,
  decimal: /^-?\d{1,38}(?:\.\d{1,38})?(?:[eE][+-]?\d{1,3})?$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  yesno: /^(?:true|false)$/,
};

/**
 * The values chosen in a Preview as Parameters of its run, each a value of its column, never SQL: a value
 * that is not one of its kind is refused. A string says what does not fit.
 */
export function chosenParameters(choices: readonly Choice[], values: unknown): Parameter[] | string {
  if (values === undefined) return [];
  if (typeof values !== 'object' || values === null || Array.isArray(values)) return 'The values are an object, by column.';
  const parameters: Parameter[] = [];
  for (const [field, value] of Object.entries(values as Record<string, unknown>)) {
    if (value === null) continue;
    const choice = choices.find((candidate) => candidate.field === field);
    if (!choice) return `A Preview of this Resource offers no choice by ${field}.`;
    if (typeof value !== 'string' || value.length < 1 || value.length > 200 || (LITERAL[choice.kind] && !LITERAL[choice.kind]?.test(value))) {
      return `${value} is not a value of ${field}.`;
    }
    if (choice.kind === 'yesno') parameters.push({ name: field, kind: 'yesno', value: value === 'true' });
    else if (choice.kind === 'choice') parameters.push({ name: field, kind: 'choice', value, list: [value] });
    else parameters.push({ name: field, kind: choice.kind as 'number' | 'decimal' | 'date', value });
  }
  return parameters;
}

/** Where the size and partitions of a Resource come from: its own table, or for a view the table beneath it. */
export interface Storage extends TableFacts {
  key: string;
}

/**
 * The size and partitions of a Resource, and its newest partitions, from BigQuery without reading it
 * (FR-SR-39, DEC-SR-34, DEC-SR-39). For a view, they are those of the table beneath it partitioned on the
 * same column, or of its one table beneath. Kept a few minutes.
 */
export function createStorage(bigquery: BigQuery, beneath: (resource: QueryResource) => Promise<string[]>, ttl = 10 * 60_000, now: () => number = Date.now) {
  const facts = new Map<string, { value: Promise<TableFacts>; until: number }>();
  const lists = new Map<string, { value: Promise<string[]>; until: number }>();
  const kept = <T>(cache: Map<string, { value: Promise<T>; until: number }>, key: string, read: () => Promise<T>): Promise<T> => {
    const found = cache.get(key);
    if (found && found.until > now()) return found.value;
    const value = read();
    cache.set(key, { value, until: now() + ttl });
    value.catch(() => cache.delete(key));
    return value;
  };
  const table = (key: string) => kept(facts, key, () => bigquery.table(key));

  async function of(resource: QueryResource): Promise<Storage | null> {
    const own = await table(resource.fullName);
    if (own.type !== 'VIEW') return { key: resource.fullName, ...own };
    const under = (await beneath(resource)).filter((key) => key.toLowerCase() !== resource.key);
    const candidates = await Promise.all(under.map(async (key) => ({ key, ...(await table(key)) })));
    const field = resource.partition?.field;
    return (field ? candidates.find((candidate) => candidate.partitionField === field) : candidates.length === 1 ? candidates[0] : undefined) ?? null;
  }

  return {
    of,
    /** The first moment of the newest partitions of its window that hold rows; null where Data Hub cannot tell. */
    async newest(resource: QueryResource, window: Window): Promise<string | null> {
      try {
        const storage = await of(resource);
        if (!storage?.partitionField || storage.partitionField === '_PARTITIONTIME') return null;
        const ids = await kept(lists, storage.key, () => bigquery.partitions(storage.key, Math.max(...WINDOWS)));
        const id = ids[Math.min(window, ids.length) - 1];
        return id ? partitionStart(id) : null;
      } catch (error) {
        if (error instanceof BigQueryRefused) return null;
        throw error;
      }
    },
  };
}

export type StorageReader = ReturnType<typeof createStorage>;

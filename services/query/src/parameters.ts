import type { QueryParameter } from './bigquery.js';
import { tokenize } from './sql.js';

/** The standard list of kinds of a Parameter (DEC-UX-71). */
export const KINDS = ['date', 'period', 'number', 'decimal', 'text', 'choice', 'several', 'yesno'] as const;
export type ParameterKind = (typeof KINDS)[number];

/**
 * A Parameter of a query (DEC-UX-71): a name, a kind and a value. A Period is two dates, `@name_from` and
 * `@name_to`; the list of a Choice is typed, one value a line (DEC-UX-117).
 */
export type Parameter =
  | { name: string; kind: 'date' | 'number' | 'decimal' | 'text'; value: string }
  | { name: string; kind: 'period'; value: string; to: string }
  | { name: string; kind: 'choice'; value: string; list: string[] }
  | { name: string; kind: 'several'; value: string[]; list: string[] }
  | { name: string; kind: 'yesno'; value: boolean };

/** The type in BigQuery of each kind. */
const TYPES: Record<ParameterKind, string> = {
  date: 'DATE',
  period: 'DATE',
  number: 'INT64',
  decimal: 'NUMERIC',
  text: 'STRING',
  choice: 'STRING',
  several: 'STRING',
  yesno: 'BOOL',
};

const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const INT64 = { min: -(2n ** 63n), max: 2n ** 63n - 1n };
/** How many Parameters a query has at most, how long a value is, and how many values a list holds. */
const LIMITS = { parameters: 30, value: 1000, list: 200, item: 200 };

/** Whether a text is a day of the calendar, as `2026-10-25`. */
function isDay(value: string): boolean {
  const match = DAY.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Whether a value is an SQL function rather than a value of its kind (DEC-LE-14): for a date or a number,
 * anything that is not one; for a text, a call such as `CONCAT('a', 'b')`. BigQuery works it out at every run.
 */
export function isFunction(kind: ParameterKind, value: string): boolean {
  switch (kind) {
    case 'date':
    case 'period':
      return !isDay(value);
    case 'number':
      return !/^-?\d{1,19}$/.test(value) || BigInt(value) < INT64.min || BigInt(value) > INT64.max;
    case 'decimal':
      return !/^-?\d{1,29}(?:\.\d{1,9})?$/.test(value);
    case 'text':
      return /^[A-Za-z_][A-Za-z0-9_.]*\(.*\)$/s.test(value);
    default:
      return false;
  }
}

/** The @names a Parameter gives the SQL: its own, or for a Period `_from` and `_to`. */
export const namesOf = (parameter: Parameter): string[] => (parameter.kind === 'period' ? [`${parameter.name}_from`, `${parameter.name}_to`] : [parameter.name]);

const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= max;

function parseList(value: unknown): string[] | string {
  if (!Array.isArray(value) || value.length < 1 || value.length > LIMITS.list || !value.every((item) => isText(item, LIMITS.item))) {
    return `A list has 1 to ${LIMITS.list} values, each of 1 to ${LIMITS.item} characters.`;
  }
  const list = value.map((item: string) => item.trim());
  return new Set(list).size === list.length ? list : 'A list names each value once.';
}

/** Checks the Parameters of a query; a string says what does not fit. */
export function parseParameters(input: unknown): Parameter[] | string {
  if (!Array.isArray(input) || input.length > LIMITS.parameters) return `The Parameters are a list of at most ${LIMITS.parameters}.`;
  const parameters: Parameter[] = [];
  const taken = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 'Each Parameter is an object.';
    const { name, kind, value, to, list, ...rest } = raw as Record<string, unknown>;
    const extra = Object.keys(rest)[0];
    if (extra) return `A Parameter has no field ${extra}.`;
    if (typeof name !== 'string' || !NAME.test(name)) return 'The name of a Parameter is an SQL name: a letter or _, then letters, digits or _, at most 64.';
    if (!KINDS.includes(kind as ParameterKind)) return `The kind of @${name} is one of ${KINDS.join(', ')}.`;
    let parameter: Parameter;
    switch (kind as ParameterKind) {
      case 'period':
        if (!isText(value, LIMITS.value) || !isText(to, LIMITS.value)) return `@${name} is a period: a date or an SQL function to start and to end.`;
        parameter = { name, kind: 'period', value: value.trim(), to: to.trim() };
        break;
      case 'choice':
      case 'several': {
        const values = parseList(list);
        if (typeof values === 'string') return `@${name}: ${values}`;
        if (kind === 'choice') {
          if (typeof value !== 'string' || !values.includes(value)) return `The value of @${name} is one of its list.`;
          parameter = { name, kind: 'choice', value, list: values };
        } else {
          if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && values.includes(item)) || new Set(value).size !== value.length) {
            return `The values of @${name} are some of its list, each once.`;
          }
          parameter = { name, kind: 'several', value: value as string[], list: values };
        }
        break;
      }
      case 'yesno':
        if (typeof value !== 'boolean') return `The value of @${name} is yes or no: true or false.`;
        parameter = { name, kind: 'yesno', value };
        break;
      default:
        if (!isText(value, LIMITS.value)) return `@${name} has a value of 1 to ${LIMITS.value} characters.`;
        parameter = { name, kind: kind as 'date' | 'number' | 'decimal' | 'text', value: value.trim() };
    }
    if (to !== undefined && parameter.kind !== 'period') return `Only a period has an end: @${name} is not one.`;
    if (list !== undefined && parameter.kind !== 'choice' && parameter.kind !== 'several') return `Only a choice has a list: @${name} is not one.`;
    for (const sqlName of namesOf(parameter)) {
      if (taken.has(sqlName.toLowerCase())) return `@${sqlName} is named twice.`;
      taken.add(sqlName.toLowerCase());
    }
    parameters.push(parameter);
  }
  return parameters;
}

/** An @name in the SQL, where it stands. */
export interface NamedParameter {
  name: string;
  start: number;
  end: number;
}

export interface Bound {
  /** The SQL BigQuery gets: each function in place of its @name, in parentheses (DEC-UX-118). */
  sql: string;
  /** The values BigQuery fills in, of the Parameters in the SQL that have a value rather than a function. */
  parameters: QueryParameter[];
  /** The @names in the SQL that are not a Parameter, which BigQuery would refuse. */
  missing: NamedParameter[];
  /** The Parameters that are not in the SQL: they are not sent (DEC-UX-71). */
  unused: string[];
  /** Where a place in the bound SQL stands in the SQL as written; within a function, its @name. */
  original(position: number, side: 'start' | 'end'): number;
}

/** The value BigQuery fills in for one @name, of a value that is not a function. */
function queryParameter(name: string, parameter: Parameter, value: string): QueryParameter {
  if (parameter.kind === 'several') {
    return { name, parameterType: { type: 'ARRAY', arrayType: { type: 'STRING' } }, parameterValue: { arrayValues: parameter.value.map((item) => ({ value: item })) } };
  }
  return { name, parameterType: { type: TYPES[parameter.kind] }, parameterValue: { value } };
}

/**
 * The SQL of a run with its Parameters (DEC-UX-71, DEC-UX-118): a value goes to BigQuery as a value of its
 * type, apart from the SQL; a function goes into the SQL as it is written, in place of its @name, so the
 * Pre-flight checks it as the rest of the SQL. Comments and strings are left alone.
 */
export function bind(sql: string, parameters: readonly Parameter[]): Bound {
  const byName = new Map<string, { parameter: Parameter; value: string }>();
  for (const parameter of parameters) {
    if (parameter.kind === 'period') {
      byName.set(`${parameter.name}_from`, { parameter, value: parameter.value });
      byName.set(`${parameter.name}_to`, { parameter, value: parameter.to });
    } else {
      byName.set(parameter.name, { parameter, value: parameter.kind === 'yesno' ? String(parameter.value) : parameter.kind === 'several' ? '' : parameter.value });
    }
  }

  const replaced: { start: number; end: number; boundStart: number; boundEnd: number }[] = [];
  const sent = new Map<string, QueryParameter>();
  const missing: NamedParameter[] = [];
  const used = new Set<Parameter>();
  let out = '';
  let from = 0;
  for (const token of tokenize(sql)) {
    if (token.kind !== 'param' || token.text.startsWith('@@')) continue;
    const name = token.text.slice(1);
    const found = byName.get(name);
    if (!found) {
      missing.push({ name, start: token.start, end: token.end });
      continue;
    }
    used.add(found.parameter);
    if (isFunction(found.parameter.kind, found.value)) {
      out += sql.slice(from, token.start);
      const boundStart = out.length;
      out += `(${found.value})`;
      replaced.push({ start: token.start, end: token.end, boundStart, boundEnd: out.length });
      from = token.end;
    } else if (!sent.has(name)) {
      sent.set(name, queryParameter(name, found.parameter, found.value));
    }
  }
  out += sql.slice(from);

  return {
    sql: out,
    parameters: [...sent.values()],
    missing,
    unused: parameters.filter((parameter) => !used.has(parameter)).map((parameter) => parameter.name),
    original(position, side) {
      let shift = 0;
      for (const replacement of replaced) {
        if (position < replacement.boundStart || (side === 'end' && position === replacement.boundStart)) break;
        if (position < replacement.boundEnd || (side === 'end' && position === replacement.boundEnd)) return side === 'start' ? replacement.start : replacement.end;
        shift = replacement.boundEnd - replacement.end;
      }
      return position - shift;
    },
  };
}

/** The kind to suggest for an @name, from the type of the column it is compared with (DEC-UX-71). */
export function kindFor(dataType: string | null, list: boolean): ParameterKind | null {
  const type = (dataType ?? '').toUpperCase();
  if (type === 'STRING') return list ? 'several' : 'choice';
  if (list) return null;
  if (type === 'DATE') return 'date';
  if (type === 'INT64' || type === 'INTEGER') return 'number';
  if (['NUMERIC', 'BIGNUMERIC', 'FLOAT64', 'FLOAT'].includes(type)) return 'decimal';
  if (type === 'BOOL' || type === 'BOOLEAN') return 'yesno';
  return null;
}

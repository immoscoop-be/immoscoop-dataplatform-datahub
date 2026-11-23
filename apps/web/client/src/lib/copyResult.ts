/**
 * Copy as JSON and Copy as CSV on the result of a query (DEC-UX-292, FR-SR-70): the first 100 rows of the result shown,
 * with the names of its fields. Nothing beyond those rows leaves Data Hub this way (FR-CH-01).
 */
import type { ResultColumn } from './query.js';

/** How many rows are copied: the first page of the result. */
export const ROWS_COPIED = 100;

export type CopyFormat = 'json' | 'csv';

type Cell = string | null;

const INTEGER = new Set(['INT64', 'INTEGER']);
const FLOAT = new Set(['FLOAT64', 'FLOAT']);
const BOOLEAN = new Set(['BOOL', 'BOOLEAN']);

/** Whether BigQuery wrote the value as JSON: a list or a record, or a JSON column. */
const nested = (type: string): boolean => type.startsWith('ARRAY<') || type === 'STRUCT' || type === 'RECORD' || type === 'JSON';

/**
 * A cell as JSON keeps it: an integer or a float as a number, a BOOL as true or false, a list or a record as JSON, and
 * anything else as BigQuery writes it, as text. A NUMERIC stays text, and so does an integer beyond what a number holds
 * exactly, so that no digit is lost.
 */
function jsonValue(cell: Cell, type: string): unknown {
  if (cell === null) return null;
  if (INTEGER.has(type)) {
    const number = Number(cell);
    return Number.isSafeInteger(number) && String(number) === cell ? number : cell;
  }
  if (FLOAT.has(type)) {
    const number = Number(cell);
    return Number.isFinite(number) ? number : cell;
  }
  if (BOOLEAN.has(type)) return cell === 'true' ? true : cell === 'false' ? false : cell;
  if (nested(type)) {
    try {
      return JSON.parse(cell) as unknown;
    } catch {
      return cell;
    }
  }
  return cell;
}

/** The rows as JSON: a list with an object a row, its fields by name, in their order. */
export function asJson(columns: readonly ResultColumn[], rows: readonly (readonly Cell[])[]): string {
  const objects = rows.slice(0, ROWS_COPIED).map((row) => Object.fromEntries(columns.map((column, at) => [column.name, jsonValue(row[at] ?? null, column.type)])));
  return JSON.stringify(objects, null, 2);
}

/** A value of CSV: between quotes when it holds a comma, a quote or a line break, or starts or ends with a space. */
function csvValue(cell: Cell): string {
  if (cell === null) return '';
  return /[",\r\n]|^\s|\s$/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

/** The rows as CSV: a header row with the names of the fields, a comma between values, a line break as Windows writes it. */
export function asCsv(columns: readonly ResultColumn[], rows: readonly (readonly Cell[])[]): string {
  const lines = [columns.map((column) => csvValue(column.name)), ...rows.slice(0, ROWS_COPIED).map((row) => columns.map((_, at) => csvValue(row[at] ?? null)))];
  return lines.map((line) => line.join(',')).join('\r\n');
}

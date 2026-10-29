import type { Missing } from './database.js';
import type { Preflight } from './preflight.js';

/** BigQuery's words for a table or a column that is not found, the way its dry run refuses SQL. */
const TABLE = /Not found: (?:Table|Dataset|View) ([\w.:-]+)/i;
const COLUMN = [/Unrecognized name: (\w+)/i, /Name (\w+) not found inside/i, /Field name (\w+) does not exist/i];

/**
 * What a Lens misses, from the words of BigQuery when its dry run refuses it: a table or a column that is
 * not found (FR-SR-52); null for any other refusal, which is no reason to call it Broken.
 */
export function missingOf(message: string): Omit<Missing, 'since'> | null {
  const table = TABLE.exec(message)?.[1];
  if (table) return { kind: 'table', name: table.replace(':', '.') };
  for (const pattern of COLUMN) {
    const column = pattern.exec(message)?.[1];
    if (column) return { kind: 'column', name: column };
  }
  return null;
}

/** What a Pre-flight says is missing, when BigQuery refused it for a table or a column it did not find. */
export function missingIn(preflight: Preflight): Omit<Missing, 'since'> | null {
  for (const problem of preflight.problems) {
    if (problem.kind === 'invalid') {
      const missing = missingOf(problem.message);
      if (missing) return missing;
    }
  }
  return null;
}

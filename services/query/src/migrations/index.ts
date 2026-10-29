import type { Migration } from 'kysely/migration';
import * as queries from './0001-queries.js';
import * as parameters from './0002-parameters.js';
import * as previews from './0003-previews.js';

/** The migrations of query, by name; they run in the order of their names (TR-PF-09). */
export const migrations: Record<string, Migration> = {
  '0001-queries': queries,
  '0002-parameters': parameters,
  '0003-previews': previews,
};

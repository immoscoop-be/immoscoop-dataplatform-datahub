import type { Migration } from 'kysely/migration';
import * as queries from './0001-queries.js';

/** The migrations of query, by name; they run in the order of their names (TR-PF-09). */
export const migrations: Record<string, Migration> = {
  '0001-queries': queries,
};

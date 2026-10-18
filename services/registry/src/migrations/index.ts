import type { Migration } from 'kysely/migration';
import * as artifactSets from './0001-artifact-sets.js';
import * as search from './0002-search.js';

/** The migrations of registry, by name; they run in the order of their names (TR-PF-09). */
export const migrations: Record<string, Migration> = {
  '0001-artifact-sets': artifactSets,
  '0002-search': search,
};

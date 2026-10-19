import type { Migration } from 'kysely/migration';
import * as collections from './0001-collections.js';

/** The migrations of catalogue, by name; they run in the order of their names (TR-PF-09). */
export const migrations: Record<string, Migration> = {
  '0001-collections': collections,
};

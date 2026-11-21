import type { Migration } from 'kysely/migration';
import * as edas from './0001-edas.js';

/** The migrations of eda, by name; they run in the order of their names (TR-PF-09). */
export const migrations: Record<string, Migration> = {
  '0001-edas': edas,
};

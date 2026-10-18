import type { Migration } from 'kysely/migration';
import * as users from './0001-users.js';

/** The migrations of identity, by name; they run in the order of their names (TR-PF-09). */
export const migrations: Record<string, Migration> = {
  '0001-users': users,
};

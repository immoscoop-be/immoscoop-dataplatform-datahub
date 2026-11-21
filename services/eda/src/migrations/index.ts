import type { Migration } from 'kysely/migration';

/** The migrations of eda, by name; they run in the order of their names (TR-PF-09). */
export const migrations: Record<string, Migration> = {};

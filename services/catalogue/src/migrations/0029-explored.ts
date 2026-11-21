import { type Kysely, sql } from 'kysely';

/**
 * Whether a Resource is explored: the EDA-Setup of its EDA is complete, as eda says (TR-ED-05). While it is, a Resource
 * at 3 · Confirmed is 4 · Explored, whenever its Level is worked out again (DEC-MR-21, FR-MR-22). None is to start with.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('resources')
    .addColumn('explored', 'boolean', (column) => column.notNull().defaultTo(false))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Without it no Resource is explored: one at 4 · Explored is back at 3 · Confirmed.
  await sql`update resources set level = 3 where level = 4`.execute(db);
  await db.schema.alterTable('resources').dropColumn('explored').execute();
}

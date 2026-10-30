import { type Kysely, sql } from 'kysely';

/**
 * What a User did with each Learning Card (FR-LR-05, FR-LR-32): when they first saw it, when they last had it
 * open and at which step, and since when they understand it, if they said so. Only the User and the Data Team see
 * it (DEC-LR-13): the User through Data Hub, the Data Team in Cloud SQL Studio. A card is named by its number.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('learning_progress')
    .addColumn('user_id', 'text', (column) => column.notNull())
    .addColumn('card', 'text', (column) => column.notNull())
    .addColumn('seen_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('last_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('step', 'text', (column) => column.notNull().check(sql`step in ('why', 'core', 'see', 'check', 'can')`))
    .addColumn('understood_at', 'timestamptz')
    .addPrimaryKeyConstraint('learning_progress_pkey', ['user_id', 'card'])
    .execute();
}

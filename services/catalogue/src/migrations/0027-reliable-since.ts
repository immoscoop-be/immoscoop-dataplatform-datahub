import { type Kysely, sql } from 'kysely';

/**
 * Reliable Since as a value of its own (DEC-RC-29, FR-RC-31): from its first row, or from a later day with why not
 * earlier, who set it and when; not set is empty, never either. And the Date Field of a Resource where its Owner Unit or
 * the Data Team chose one, by name; null takes the one its table type gives (FR-RC-32, DEC-RC-32). A day set before is
 * kept as a later day without why.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('resources')
    .addColumn('reliable_since_from', 'text', (column) => column.check(sql`reliable_since_from in ('firstRow', 'day')`))
    .addColumn('reliable_since_why', 'text', (column) => column.notNull().defaultTo(''))
    .addColumn('reliable_since_by_name', 'text')
    .addColumn('reliable_since_at', 'timestamptz')
    .addColumn('date_field', 'text')
    .execute();
  await sql`update resources set reliable_since_from = 'day' where reliable_since is not null`.execute(db);
  // A later day has its day; from its first row and not set have none.
  await sql`alter table resources add constraint resources_reliable_since_check check (coalesce(reliable_since_from = 'day', false) = (reliable_since is not null))`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`alter table resources drop constraint resources_reliable_since_check`.execute(db);
  await db.schema
    .alterTable('resources')
    .dropColumn('reliable_since_from')
    .dropColumn('reliable_since_why')
    .dropColumn('reliable_since_by_name')
    .dropColumn('reliable_since_at')
    .dropColumn('date_field')
    .execute();
}

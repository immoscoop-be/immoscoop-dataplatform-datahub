import { type Kysely, sql } from 'kysely';

/**
 * A Broken query (FR-SR-53, FR-SR-52): what it misses while it reads a table or a column that no longer exists,
 * and since when; its SQL as BigQuery must read it, with the full names of its Resources in their own case, and
 * its Parameters, kept at each Pre-flight that passes so that Data Hub can dry-run it without its User
 * (DEC-SR-44); and its Log, with `BRK-001` and `BRK-002`, as a Lens has.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('queries')
    .addColumn('broken', 'jsonb')
    .addColumn('check_sql', 'text')
    .addColumn('check_parameters', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
    .execute();
  await db.schema
    .createTable('query_log')
    .addColumn('id', 'bigserial', (column) => column.primaryKey())
    .addColumn('query_id', 'uuid', (column) => column.notNull().references('queries.id').onDelete('cascade'))
    .addColumn('log_id', 'text', (column) => column.notNull().check(sql`log_id in ('BRK-001', 'BRK-002')`))
    .addColumn('params', 'jsonb', (column) => column.notNull())
    .addColumn('at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex('query_log_query').on('query_log').columns(['query_id', 'id']).execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('query_log').execute();
  await db.schema.alterTable('queries').dropColumn('check_parameters').dropColumn('check_sql').dropColumn('broken').execute();
}

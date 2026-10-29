import { type Kysely, sql } from 'kysely';

/**
 * Parameters and where a query started (DEC-UX-71, DEC-UX-73, DEC-UX-74): a query keeps its Parameters
 * with its SQL, and every run the values it ran with. A query started from another, with another set of
 * Resources, says from which query and after which of its runs.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('queries')
    .addColumn('parameters', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn('started_from', 'uuid', (column) => column.references('queries.id'))
    .addColumn('started_after_run', 'integer')
    .execute();
  await db.schema
    .alterTable('runs')
    .addColumn('parameters', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('runs').dropColumn('parameters').execute();
  await db.schema.alterTable('queries').dropColumn('started_after_run').dropColumn('started_from').dropColumn('parameters').execute();
}

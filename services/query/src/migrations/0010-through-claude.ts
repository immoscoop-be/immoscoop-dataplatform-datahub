import { type Kysely, sql } from 'kysely';

/**
 * What came through Claude (DEC-CL-11, FR-CL-22): a query made through Claude keeps the mark, also once its User goes
 * on with it in Query, and every run says how it ran. Null is the web app.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('queries')
    .addColumn('through', 'text', (column) => column.check(sql`through in ('claude')`))
    .execute();
  await db.schema
    .alterTable('runs')
    .addColumn('through', 'text', (column) => column.check(sql`through in ('claude')`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('runs').dropColumn('through').execute();
  await db.schema.alterTable('queries').dropColumn('through').execute();
}

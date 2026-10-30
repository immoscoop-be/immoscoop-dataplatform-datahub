import { type Kysely, sql } from 'kysely';

/**
 * The queries a User hid from their panel of Query (DEC-UX-138): hidden for them alone, shown again
 * when they say so. A query that goes takes its marks with it.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('hidden_queries')
    .addColumn('query_id', 'uuid', (column) => column.notNull().references('queries.id').onDelete('cascade'))
    .addColumn('user_id', 'text', (column) => column.notNull())
    .addColumn('hidden_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('hidden_queries_pkey', ['query_id', 'user_id'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('hidden_queries').execute();
}

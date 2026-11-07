import { type Kysely, sql } from 'kysely';

/** The Users: created at their first login, keyed by their fixed Google ID; never a password (FR-UM-03). */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('google_id', 'text', (column) => column.primaryKey())
    .addColumn('email', 'text', (column) => column.notNull())
    .addColumn('name', 'text', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('last_login_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();
}

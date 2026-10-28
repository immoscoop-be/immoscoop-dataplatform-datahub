import { type Kysely, sql } from 'kysely';

/**
 * The settings of a User, as keys and values (DEC-UX-96): the language, the theme, the backgrounds,
 * the panel and the intros dismissed. They go when the User goes.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('settings')
    .addColumn('google_id', 'text', (column) => column.notNull().references('users.google_id').onDelete('cascade'))
    .addColumn('key', 'text', (column) => column.notNull())
    .addColumn('value', 'jsonb', (column) => column.notNull())
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('settings_pkey', ['google_id', 'key'])
    .execute();
}

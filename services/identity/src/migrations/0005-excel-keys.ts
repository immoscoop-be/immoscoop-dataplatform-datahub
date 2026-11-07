import { type Kysely, sql } from 'kysely';

/**
 * Excel keys (FR-PL-01 to FR-PL-03, TR-PF-07): the personal keys with which Excel signs in through Power
 * Query. identity keeps only the hash of a key, never the key itself; a key lasts a year, is revoked by its
 * User or the Data Team and stays listed, and its User gets a Message a month before it expires.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('excel_keys')
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('google_id', 'text', (column) => column.notNull().references('users.google_id'))
    .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 80`))
    .addColumn('key_hash', 'text', (column) => column.notNull().unique())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
    .addColumn('last_used_at', 'timestamptz')
    .addColumn('revoked_at', 'timestamptz')
    // Who revoked it: the User themselves, or someone of the Data Team, by fixed Google ID and name.
    .addColumn('revoked_by', 'text')
    .addColumn('revoked_by_name', 'text')
    // When its User was told that it expires within a month.
    .addColumn('warned_at', 'timestamptz')
    .execute();
  await db.schema.createIndex('excel_keys_user').on('excel_keys').columns(['google_id', 'created_at']).execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('excel_keys').execute();
}

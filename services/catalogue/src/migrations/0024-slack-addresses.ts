import { type Kysely, sql } from 'kysely';

/**
 * The address by which Data Hub finds a User in Slack, when their Slack account is on another address than their
 * Google account (DEC-LN-08, FR-LN-07). It is kept once the User typed the code Data Hub sent to that Slack account
 * (OP-LN-08); without a row, Data Hub finds them by the address of their Google account. The code itself is kept
 * as a hash, one per User, the newest only, with when it expires and how many tries are left.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('slack_addresses')
    .addColumn('user_id', 'text', (column) => column.primaryKey())
    .addColumn('email', 'text', (column) => column.notNull().check(sql`email = lower(email)`))
    .addColumn('confirmed_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('slack_codes')
    .addColumn('user_id', 'text', (column) => column.primaryKey())
    .addColumn('email', 'text', (column) => column.notNull().check(sql`email = lower(email)`))
    .addColumn('slack_name', 'text', (column) => column.notNull())
    .addColumn('code_hash', 'text', (column) => column.notNull())
    .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
    .addColumn('tries_left', 'integer', (column) => column.notNull().defaultTo(5).check(sql`tries_left >= 0`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('slack_codes').execute();
  await db.schema.dropTable('slack_addresses').execute();
}

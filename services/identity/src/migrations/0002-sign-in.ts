import { type Kysely, sql } from 'kysely';

/**
 * Signing in and staying signed in (TR-PF-06, TR-PF-25): the OAuth clients that registered
 * themselves, the sign-ins under way at Google, the one-time codes handed to clients, and the
 * sessions with their Refresh Tokens. Codes and Refresh Tokens are kept as hashes only.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('clients')
    .addColumn('client_id', 'text', (column) => column.primaryKey())
    .addColumn('name', 'text', (column) => column.notNull())
    .addColumn('redirect_uris', 'jsonb', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('authorization_requests')
    .addColumn('id', 'text', (column) => column.primaryKey())
    .addColumn('client_id', 'text', (column) => column.notNull())
    .addColumn('redirect_uri', 'text', (column) => column.notNull())
    .addColumn('code_challenge', 'text', (column) => column.notNull())
    .addColumn('client_state', 'text')
    .addColumn('nonce', 'text', (column) => column.notNull())
    .addColumn('google_code_verifier', 'text', (column) => column.notNull())
    .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
    .execute();

  await db.schema
    .createTable('authorization_codes')
    .addColumn('code_hash', 'text', (column) => column.primaryKey())
    .addColumn('client_id', 'text', (column) => column.notNull())
    .addColumn('redirect_uri', 'text', (column) => column.notNull())
    .addColumn('code_challenge', 'text', (column) => column.notNull())
    .addColumn('google_id', 'text', (column) => column.notNull().references('users.google_id'))
    .addColumn('claims', 'jsonb', (column) => column.notNull())
    .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
    .execute();

  await db.schema
    .createTable('sessions')
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('google_id', 'text', (column) => column.notNull().references('users.google_id'))
    .addColumn('client_id', 'text', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
    .addColumn('ended_at', 'timestamptz')
    .addColumn('end_reason', 'text')
    .execute();
  await db.schema.createIndex('sessions_google_id').on('sessions').column('google_id').execute();

  await db.schema
    .createTable('refresh_tokens')
    .addColumn('token_hash', 'text', (column) => column.primaryKey())
    .addColumn('session_id', 'uuid', (column) => column.notNull().references('sessions.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('used_at', 'timestamptz')
    .execute();
  await db.schema.createIndex('refresh_tokens_session_id').on('refresh_tokens').column('session_id').execute();
}

import { type Kysely, sql } from 'kysely';

/**
 * Requests (FR-CV-08): a Message of a User that waits for a decision, such as the Request to run a very
 * large query (MSG-QRY-01). One writer has one waiting Request per object and type at a time; their
 * own Requests are found by writer.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`create unique index messages_one_waiting_request on messages (type, subject_kind, subject_id, writer_id) where state = 'waiting' and writer_id is not null`.execute(db);
  await db.schema.createIndex('messages_writer').on('messages').columns(['writer_id', 'subject_kind', 'created_at']).execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('messages_writer').execute();
  await db.schema.dropIndex('messages_one_waiting_request').execute();
}

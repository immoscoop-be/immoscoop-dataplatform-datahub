import { type Kysely, sql } from 'kysely';

/**
 * A description from dbt reported as wrong (MSG-RES-10, FR-CV-17): one Request waits per description, of the table or
 * of one field, whoever sent it; a colleague who finds it wrong too joins it. The one waiting Request per writer,
 * object and type of the other Requests leaves it out.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('messages_one_waiting_request').execute();
  await sql`create unique index messages_one_waiting_request on messages (type, subject_kind, subject_id, writer_id) where state = 'waiting' and writer_id is not null and type <> 'MSG-RES-10'`.execute(db);
  await sql`create unique index messages_one_waiting_report on messages (subject_id, (coalesce(params->>'field', ''))) where type = 'MSG-RES-10' and state = 'waiting'`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('messages_one_waiting_report').execute();
  await db.schema.dropIndex('messages_one_waiting_request').execute();
  await sql`delete from messages where type in ('MSG-RES-10', 'MSG-RES-11') or (type = 'MSG-CNV-05' and subject_kind = 'resource')`.execute(db);
  await sql`create unique index messages_one_waiting_request on messages (type, subject_kind, subject_id, writer_id) where state = 'waiting' and writer_id is not null`.execute(db);
}

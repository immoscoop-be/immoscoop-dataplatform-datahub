import { type Kysely, sql } from 'kysely';

/**
 * A Message can be about an Excel key (MSG-KEY-01, MSG-KEY-02): identity tells catalogue that a key expires
 * within a month, or that the Data Team revoked it, and only the User of the key sees the Message (FR-PL-03).
 */
const BEFORE = ['collection', 'resource', 'lens', 'query', 'report', 'learningCard'];
const AFTER = [...BEFORE, 'excelKey'];

const kinds = (list: string[]) => sql.join(list.map((kind) => sql.lit(kind)));

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table messages drop constraint messages_subject_kind_check`.execute(db);
  await sql`alter table messages add constraint messages_subject_kind_check check (subject_kind in (${kinds(AFTER)}))`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`delete from messages where subject_kind = 'excelKey'`.execute(db);
  await sql`alter table messages drop constraint messages_subject_kind_check`.execute(db);
  await sql`alter table messages add constraint messages_subject_kind_check check (subject_kind in (${kinds(BEFORE)}))`.execute(db);
}

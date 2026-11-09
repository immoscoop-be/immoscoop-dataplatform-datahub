import { type Kysely, sql } from 'kysely';

/**
 * A Message can be about a User (MSG-USR-01, MSG-USR-02): identity tells catalogue that the Data Team moved a User to
 * another Permission group, or deleted theirs, a Message only that User sees (FR-PL-12); or that a member of
 * `datahub-datateam@` got Admin back as no User of Admin could still sign in, a Message for the Data Team (EC-PL-03).
 */
const BEFORE = ['collection', 'resource', 'lens', 'query', 'report', 'learningCard', 'excelKey'];
const AFTER = [...BEFORE, 'user'];

const kinds = (list: string[]) => sql.join(list.map((kind) => sql.lit(kind)));

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table messages drop constraint messages_subject_kind_check`.execute(db);
  await sql`alter table messages add constraint messages_subject_kind_check check (subject_kind in (${kinds(AFTER)}))`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Such a Message takes no reply; who read it goes with it, and its notification goes with it by itself.
  await sql`delete from message_reads where message_id in (select id from messages where subject_kind = 'user')`.execute(db);
  await sql`delete from messages where subject_kind = 'user'`.execute(db);
  await sql`alter table messages drop constraint messages_subject_kind_check`.execute(db);
  await sql`alter table messages add constraint messages_subject_kind_check check (subject_kind in (${kinds(BEFORE)}))`.execute(db);
}

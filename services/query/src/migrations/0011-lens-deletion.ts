import { type Kysely, sql } from 'kysely';

/**
 * A deleted Lens (FR-LE-18, DEC-LE-21): its row stays, with when, by whom and why it was deleted, so that its runs,
 * versions and Log keep their Lens and its address can say so; its Log gets `LEN-003`. A query is used as one Lens
 * at a time: once that one is deleted, it may become a Lens again.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('lenses')
    .addColumn('deleted_at', 'timestamptz')
    .addColumn('deleted_by_id', 'text')
    .addColumn('deleted_by_name', 'text')
    .addColumn('deleted_reason', 'text')
    .execute();
  await sql`alter table lens_log drop constraint lens_log_log_id_check`.execute(db);
  await sql`alter table lens_log add constraint lens_log_log_id_check check (log_id in ('BRK-001', 'BRK-002', 'LEN-001', 'LEN-002', 'LEN-003'))`.execute(db);
  await sql`alter table lenses drop constraint lenses_query_id_key`.execute(db);
  await sql`create unique index lenses_query_once on lenses (query_id) where deleted_at is null`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop index lenses_query_once`.execute(db);
  await sql`alter table lenses add constraint lenses_query_id_key unique (query_id)`.execute(db);
  await sql`delete from lens_log where log_id = 'LEN-003'`.execute(db);
  await sql`alter table lens_log drop constraint lens_log_log_id_check`.execute(db);
  await sql`alter table lens_log add constraint lens_log_log_id_check check (log_id in ('BRK-001', 'BRK-002', 'LEN-001', 'LEN-002'))`.execute(db);
  await db.schema.alterTable('lenses').dropColumn('deleted_at').dropColumn('deleted_by_id').dropColumn('deleted_by_name').dropColumn('deleted_reason').execute();
}

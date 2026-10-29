import { type Kysely, sql } from 'kysely';

/**
 * The decision of the Data Team on a Request on a Lens (FR-LE-09, FR-CV-08): refused, a Lens that waited
 * stays unpublished and is no longer frozen, until its author updates it from its query (DEC-UX-128); and
 * either decision enters its Log, as `LEN-001` or `LEN-002`.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table lenses drop constraint lenses_state_check`.execute(db);
  await sql`alter table lenses add constraint lenses_state_check check (state in ('published', 'waiting', 'stopped', 'refused'))`.execute(db);
  await sql`alter table lens_log drop constraint lens_log_log_id_check`.execute(db);
  await sql`alter table lens_log add constraint lens_log_log_id_check check (log_id in ('BRK-001', 'BRK-002', 'LEN-001', 'LEN-002'))`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`delete from lens_log where log_id in ('LEN-001', 'LEN-002')`.execute(db);
  await sql`alter table lens_log drop constraint lens_log_log_id_check`.execute(db);
  await sql`alter table lens_log add constraint lens_log_log_id_check check (log_id in ('BRK-001', 'BRK-002'))`.execute(db);
  await sql`update lenses set state = 'waiting' where state = 'refused'`.execute(db);
  await sql`alter table lenses drop constraint lenses_state_check`.execute(db);
  await sql`alter table lenses add constraint lenses_state_check check (state in ('published', 'waiting', 'stopped'))`.execute(db);
}

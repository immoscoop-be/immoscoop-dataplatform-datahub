import { type Kysely, sql } from 'kysely';

/**
 * A Lens query deleted (FR-LE-18): catalogue keeps it as deleted, so that the Messages on it still show for whoever saw
 * it, with the Lens marked as deleted.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table lenses drop constraint lenses_state_check`.execute(db);
  await sql`alter table lenses add constraint lenses_state_check check (state in ('published', 'waiting', 'stopped', 'refused', 'deleted'))`.execute(db);
}

/** A deleted Lens cannot be told back: catalogue forgets it, and its Messages show it as no longer there. */
export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`delete from lenses where state = 'deleted'`.execute(db);
  await sql`alter table lenses drop constraint lenses_state_check`.execute(db);
  await sql`alter table lenses add constraint lenses_state_check check (state in ('published', 'waiting', 'stopped', 'refused'))`.execute(db);
}

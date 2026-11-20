import { type Kysely, sql } from 'kysely';

/**
 * There are no flagged queries any more, and no Project a User works in: a query is kept on top of Query by being in a
 * Project, and the active Project follows what is open (DEC-UX-316, DEC-UX-317). The flags and the Project worked in
 * that Users kept are forgotten; their queries stay where they are.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`delete from settings where key in ('query.flagged', 'query.project')`.execute(db);
}

/** What was forgotten does not come back. */
export async function down(): Promise<void> {}

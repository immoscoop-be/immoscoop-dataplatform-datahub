import { type Kysely, sql } from 'kysely';

/**
 * The theme is no longer kept: Data Hub always follows the theme of the system, and the switch in the
 * rail holds for a session only (DEC-UX-172). The themes Users switched to before are forgotten.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`delete from settings where key = 'theme'`.execute(db);
}

/** What was forgotten does not come back. */
export async function down(): Promise<void> {}

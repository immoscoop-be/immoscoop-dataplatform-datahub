import { type Kysely, sql } from 'kysely';

/**
 * The period of a Known Gap names no field of its own any more: which fields a gap concerns, Fields says (DEC-UX-178).
 * Takes the field out of every period kept so far; its from and to stay.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`update known_gaps set scope = jsonb_set(scope, '{period}', (scope -> 'period') - 'field') where scope ? 'period'`.execute(db);
}

/** The field cannot be told back: the periods stay without one. */
export async function down(): Promise<void> {}

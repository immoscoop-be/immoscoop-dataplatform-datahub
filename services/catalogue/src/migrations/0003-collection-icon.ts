import type { Kysely } from 'kysely';

/** The optional icon of a Collection: the name of a Tabler icon from the chosen list (DEC-CO-13, FR-CO-05). */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('collections').addColumn('icon', 'text').execute();
}

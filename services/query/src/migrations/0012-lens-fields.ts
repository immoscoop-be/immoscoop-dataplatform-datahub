import { type Kysely, sql } from 'kysely';

/**
 * The fields of a Lens, as Users see them (FR-LE-19, DEC-UX-227): per field of its result its name, its type and its
 * description, taken from a field of its Resources or written by its author. A Lens made before has none.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('lenses')
    .addColumn('fields', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('lenses').dropColumn('fields').execute();
}

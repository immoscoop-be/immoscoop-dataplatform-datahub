import { type Kysely, sql } from 'kysely';

/** A folder has a description, plain text under its name, as a Collection has (FR-CO-42, DEC-UX-162). */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('folders')
    .addColumn('description', 'text', (column) => column.notNull().defaultTo('').check(sql`char_length(description) <= 500`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('folders').dropColumn('description').execute();
}

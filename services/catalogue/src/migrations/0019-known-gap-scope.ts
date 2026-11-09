import { type Kysely, sql } from 'kysely';

/**
 * A Known Gap may be narrowed down by a scope: a period, fields and rows, each optional and combined (FR-RC-24,
 * DEC-RC-20), kept as one JSON value. A gap without one, as every gap before, is free text.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('known_gaps').addColumn('scope', 'jsonb').execute();
  await sql`alter table known_gaps add constraint known_gaps_scope_object check (scope is null or jsonb_typeof(scope) = 'object')`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('known_gaps').dropColumn('scope').execute();
}

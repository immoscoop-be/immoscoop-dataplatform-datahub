import { type Kysely, sql } from 'kysely';

/**
 * Keeping a Lens right (FR-LE-10, FR-LE-16, FR-LE-17): a Lens that stopped after a run with its defaults
 * grew past 1 GB (DEC-LE-11, DEC-LE-19), what it misses while it is Broken, and its Log with `BRK-001`
 * and `BRK-002` (FR-SR-52). A query is used as a Lens when "Open in Query" made it for someone of its
 * Owner Unit (DEC-LE-18); a query started from "New Lens" on a Collection remembers it (DEC-UX-123).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table lenses drop constraint lenses_state_check`.execute(db);
  await sql`alter table lenses add constraint lenses_state_check check (state in ('published', 'waiting', 'stopped'))`.execute(db);
  await db.schema
    .alterTable('lenses')
    // What one run with its defaults read when it stopped, and since when (DEC-LE-11).
    .addColumn('stopped_at', 'timestamptz')
    .addColumn('stopped_reads', 'bigint')
    // What it misses while it is Broken, a table or a column, and since when (FR-LE-17).
    .addColumn('broken', 'jsonb')
    .execute();

  // The Log of a Lens (FR-SR-52): when it became Broken and when it worked again.
  await db.schema
    .createTable('lens_log')
    .addColumn('id', 'bigserial', (column) => column.primaryKey())
    .addColumn('lens_id', 'uuid', (column) => column.notNull().references('lenses.id').onDelete('cascade'))
    .addColumn('log_id', 'text', (column) => column.notNull().check(sql`log_id in ('BRK-001', 'BRK-002')`))
    .addColumn('params', 'jsonb', (column) => column.notNull())
    .addColumn('at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex('lens_log_lens').on('lens_log').columns(['lens_id', 'id']).execute();

  await db.schema
    .alterTable('queries')
    .addColumn('for_lens', 'uuid', (column) => column.references('lenses.id'))
    .addColumn('for_collection', 'uuid')
    .execute();
  await sql`create unique index queries_one_for_lens on queries (owner_id, for_lens) where for_lens is not null`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('queries_one_for_lens').execute();
  await db.schema.alterTable('queries').dropColumn('for_collection').dropColumn('for_lens').execute();
  await db.schema.dropTable('lens_log').execute();
  await db.schema.alterTable('lenses').dropColumn('broken').dropColumn('stopped_reads').dropColumn('stopped_at').execute();
  await db.updateTable('lenses' as never).set({ state: 'published' } as never).where(sql`state`, '=', 'stopped').execute();
  await sql`alter table lenses drop constraint lenses_state_check`.execute(db);
  await sql`alter table lenses add constraint lenses_state_check check (state in ('published', 'waiting'))`.execute(db);
}

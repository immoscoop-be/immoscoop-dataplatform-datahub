import { type Kysely, sql } from 'kysely';

/**
 * Previews and the queries on a Resource (FR-SR-38, FR-SR-44): the previews of a Resource are one query
 * per User, of the kind `preview`, with its history; a run that reads the values of the choices of a
 * Preview is kept in the Query Log but is not one of its runs (DEC-SR-40). The queries on a Resource are
 * found by its ID among their Resources.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('queries')
    .addColumn('kind', 'text', (column) => column.notNull().defaultTo('query').check(sql`kind in ('query', 'preview')`))
    .addColumn('preview_of', 'uuid')
    .execute();
  await sql`create unique index queries_one_preview on queries (owner_id, preview_of) where kind = 'preview'`.execute(db);
  await sql`create index queries_resources on queries using gin (resources jsonb_path_ops)`.execute(db);
  await db.schema
    .alterTable('runs')
    .addColumn('purpose', 'text', (column) => column.notNull().defaultTo('run').check(sql`purpose in ('run', 'values')`))
    .execute();
  // A read of values is numbered apart, so the runs of a query count on without gaps.
  await db.schema.alterTable('runs').dropConstraint('runs_number').execute();
  await db.schema.alterTable('runs').addUniqueConstraint('runs_number', ['query_id', 'purpose', 'number']).execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.deleteFrom('runs' as never).where(sql`purpose`, '=', 'values').execute();
  await db.schema.alterTable('runs').dropConstraint('runs_number').execute();
  await db.schema.alterTable('runs').addUniqueConstraint('runs_number', ['query_id', 'number']).execute();
  await db.schema.alterTable('runs').dropColumn('purpose').execute();
  await db.schema.dropIndex('queries_resources').execute();
  await db.schema.dropIndex('queries_one_preview').execute();
  await db.schema.alterTable('queries').dropColumn('preview_of').dropColumn('kind').execute();
}

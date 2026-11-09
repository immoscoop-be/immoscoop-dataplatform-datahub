import { type Kysely, sql } from 'kysely';

/**
 * Lenses (DEC-PF-30): a Lens is a query with its Parameters (DEC-LE-06), made from a query of its author
 * that stays a query (DEC-LE-03), in a Collection its author owns (DEC-CO-20). It keeps its SQL, its
 * Parameters with the names Users see, and its Resources, each version in its history (FR-LE-16); what it
 * shows, what it does step by step and its tags are its own (FR-LE-06, DEC-LE-16). Every run of a Lens is
 * a run of one query per User and Lens, of the kind `lens`, so that it is in the Query Log (FR-LE-12).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('lenses')
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    // Its Collection in catalogue, one its author owns (DEC-CO-20).
    .addColumn('collection_id', 'uuid', (column) => column.notNull())
    // The query it was made from, used as this Lens (DEC-LE-03): one Lens per query.
    .addColumn('query_id', 'uuid', (column) => column.notNull().unique().references('queries.id'))
    .addColumn('author_id', 'text', (column) => column.notNull())
    .addColumn('author_name', 'text', (column) => column.notNull())
    .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 120`))
    .addColumn('question', 'text', (column) => column.notNull().defaultTo('').check(sql`char_length(question) <= 500`))
    .addColumn('shows', 'text', (column) => column.notNull().defaultTo('').check(sql`char_length(shows) <= 500`))
    .addColumn('steps', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn('tags', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn('sql', 'text', (column) => column.notNull().check(sql`char_length(sql) <= 100000`))
    .addColumn('parameters', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn('resources', 'jsonb', (column) => column.notNull())
    .addColumn('version', 'integer', (column) => column.notNull().defaultTo(1))
    // Published, or waiting for the Data Team while it reads more than 1 GB a run (FR-LE-09, DEC-LE-05).
    .addColumn('state', 'text', (column) => column.notNull().check(sql`state in ('published', 'waiting')`))
    // The range one run was measured in when it was made (FR-LE-08), and what it read then.
    .addColumn('range', 'text', (column) => column.notNull().check(sql`range in ('free', 'approve', 'request')`))
    .addColumn('reads', 'bigint', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('published_at', 'timestamptz')
    .execute();
  await db.schema.createIndex('lenses_collection').on('lenses').columns(['collection_id', 'name']).execute();

  // Every version of a Lens, the first one too: the earlier ones stay in its history (FR-LE-16).
  await db.schema
    .createTable('lens_versions')
    .addColumn('lens_id', 'uuid', (column) => column.notNull().references('lenses.id').onDelete('cascade'))
    .addColumn('version', 'integer', (column) => column.notNull())
    .addColumn('sql', 'text', (column) => column.notNull())
    .addColumn('parameters', 'jsonb', (column) => column.notNull())
    .addColumn('resources', 'jsonb', (column) => column.notNull())
    .addColumn('range', 'text', (column) => column.notNull())
    .addColumn('reads', 'bigint', (column) => column.notNull())
    .addColumn('made_by_id', 'text', (column) => column.notNull())
    .addColumn('made_by_name', 'text', (column) => column.notNull())
    .addColumn('from_query_id', 'uuid', (column) => column.notNull())
    .addColumn('made_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('lens_versions_pkey', ['lens_id', 'version'])
    .execute();

  // The runs of a Lens by one User are one query of the kind `lens` (FR-LE-12).
  await sql`alter table queries drop constraint queries_kind_check`.execute(db);
  await sql`alter table queries add constraint queries_kind_check check (kind in ('query', 'preview', 'lens'))`.execute(db);
  await db.schema.alterTable('queries').addColumn('lens_of', 'uuid', (column) => column.references('lenses.id')).execute();
  await sql`create unique index queries_one_lens on queries (owner_id, lens_of) where kind = 'lens'`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.deleteFrom('runs' as never).where(sql`query_id`, 'in', sql`(select id from queries where kind = 'lens')`).execute();
  await db.deleteFrom('queries' as never).where(sql`kind`, '=', 'lens').execute();
  await db.schema.dropIndex('queries_one_lens').execute();
  await db.schema.alterTable('queries').dropColumn('lens_of').execute();
  await sql`alter table queries drop constraint queries_kind_check`.execute(db);
  await sql`alter table queries add constraint queries_kind_check check (kind in ('query', 'preview'))`.execute(db);
  await db.schema.dropTable('lens_versions').execute();
  await db.schema.dropTable('lenses').execute();
}

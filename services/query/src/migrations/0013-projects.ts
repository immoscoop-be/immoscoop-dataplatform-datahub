import { type Kysely, sql } from 'kysely';

/**
 * Projects (FR-SR-63, DEC-UX-282): a set of queries Users work on together. Who is in it may open, change and run its
 * queries (DEC-SR-47); a query is in one Project at most (OP-UX-93), in one order for everyone in it (OP-UX-95). A
 * deleted Project keeps its row, with when, by whom and why, so that its address can say so (OP-UX-100); its queries
 * leave it and stay with whoever made them.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('projects')
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'text', (column) => column.notNull())
    .addColumn('description', 'text', (column) => column.notNull().defaultTo(''))
    .addColumn('made_by_id', 'text', (column) => column.notNull())
    .addColumn('made_by_name', 'text', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .addColumn('deleted_by_id', 'text')
    .addColumn('deleted_by_name', 'text')
    .addColumn('deleted_reason', 'text')
    .execute();
  await db.schema
    .createTable('project_members')
    .addColumn('project_id', 'uuid', (column) => column.notNull().references('projects.id').onDelete('cascade'))
    .addColumn('user_id', 'text', (column) => column.notNull())
    .addColumn('user_name', 'text', (column) => column.notNull())
    .addColumn('added_by_id', 'text')
    .addColumn('added_by_name', 'text')
    .addColumn('added_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('project_members_pkey', ['project_id', 'user_id'])
    .execute();
  await db.schema.createIndex('project_members_user').on('project_members').column('user_id').execute();
  await db.schema
    .createTable('project_queries')
    .addColumn('project_id', 'uuid', (column) => column.notNull().references('projects.id').onDelete('cascade'))
    // One Project at most per query (OP-UX-93); a query that goes takes its place with it.
    .addColumn('query_id', 'uuid', (column) => column.notNull().unique().references('queries.id').onDelete('cascade'))
    .addColumn('position', 'integer', (column) => column.notNull())
    .addColumn('added_by_id', 'text', (column) => column.notNull())
    .addColumn('added_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('project_queries_pkey', ['project_id', 'query_id'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('project_queries').execute();
  await db.schema.dropTable('project_members').execute();
  await db.schema.dropTable('projects').execute();
}

import { type Kysely, sql } from 'kysely';

/**
 * The Artifact Sets and what processing makes of them (TR-AR-01 to TR-AR-04): one row per run of a
 * Source Job, the Current Version per dbt project, and per set its Nodes, columns, Edges and tests.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('artifact_sets')
    .addColumn('id', 'integer', (column) => column.primaryKey().generatedAlwaysAsIdentity())
    .addColumn('project_id', 'bigint', (column) => column.notNull())
    .addColumn('job_id', 'bigint', (column) => column.notNull())
    // A run is ingested at most once (FR-AR-05).
    .addColumn('run_id', 'bigint', (column) => column.notNull().unique())
    .addColumn('status', 'text', (column) =>
      column.notNull().defaultTo('pending').check(sql`status in ('pending', 'processing', 'processed', 'failed')`),
    )
    .addColumn('error', 'text')
    .addColumn('dbt_version', 'text')
    .addColumn('generated_at', 'timestamptz')
    .addColumn('received_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('claimed_at', 'timestamptz')
    .addColumn('processed_at', 'timestamptz')
    .execute();
  await db.schema.createIndex('artifact_sets_status').on('artifact_sets').columns(['status', 'run_id']).execute();

  await db.schema
    .createTable('projects')
    .addColumn('project_id', 'bigint', (column) => column.primaryKey())
    .addColumn('name', 'text')
    .addColumn('current_set_id', 'integer', (column) => column.references('artifact_sets.id'))
    .addColumn('previous_set_id', 'integer', (column) => column.references('artifact_sets.id'))
    .execute();

  await db.schema
    .createTable('nodes')
    .addColumn('set_id', 'integer', (column) => column.notNull().references('artifact_sets.id'))
    .addColumn('unique_id', 'text', (column) => column.notNull())
    .addColumn('resource_type', 'text', (column) => column.notNull())
    .addColumn('name', 'text', (column) => column.notNull())
    .addColumn('package_name', 'text', (column) => column.notNull())
    .addColumn('database_name', 'text')
    .addColumn('schema_name', 'text')
    .addColumn('table_name', 'text')
    // database.schema.table in lowercase, without quotes: links a source to the Node of the other
    // project that builds the same table (DEC-AR-03).
    .addColumn('relation', 'text')
    .addColumn('description', 'text', (column) => column.notNull().defaultTo(''))
    .addColumn('materialized', 'text')
    .addColumn('tags', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'`))
    .addColumn('file_path', 'text')
    .addColumn('checksum', 'text')
    .addPrimaryKeyConstraint('nodes_pkey', ['set_id', 'unique_id'])
    .execute();
  await db.schema.createIndex('nodes_relation').on('nodes').column('relation').execute();

  await db.schema
    .createTable('columns')
    .addColumn('set_id', 'integer', (column) => column.notNull())
    .addColumn('node_id', 'text', (column) => column.notNull())
    .addColumn('name', 'text', (column) => column.notNull())
    .addColumn('position', 'integer')
    .addColumn('data_type', 'text')
    .addColumn('description', 'text', (column) => column.notNull().defaultTo(''))
    .addPrimaryKeyConstraint('columns_pkey', ['set_id', 'node_id', 'name'])
    .addForeignKeyConstraint('columns_node', ['set_id', 'node_id'], 'nodes', ['set_id', 'unique_id'])
    .execute();

  await db.schema
    .createTable('edges')
    .addColumn('set_id', 'integer', (column) => column.notNull())
    .addColumn('parent_id', 'text', (column) => column.notNull())
    .addColumn('child_id', 'text', (column) => column.notNull())
    .addPrimaryKeyConstraint('edges_pkey', ['set_id', 'child_id', 'parent_id'])
    .addForeignKeyConstraint('edges_parent', ['set_id', 'parent_id'], 'nodes', ['set_id', 'unique_id'])
    .addForeignKeyConstraint('edges_child', ['set_id', 'child_id'], 'nodes', ['set_id', 'unique_id'])
    .execute();
  await db.schema.createIndex('edges_parent').on('edges').columns(['set_id', 'parent_id']).execute();

  await db.schema
    .createTable('tests')
    .addColumn('set_id', 'integer', (column) => column.notNull())
    .addColumn('unique_id', 'text', (column) => column.notNull())
    .addColumn('name', 'text', (column) => column.notNull())
    .addColumn('node_id', 'text', (column) => column.notNull())
    .addColumn('column_name', 'text')
    .addColumn('severity', 'text')
    .addColumn('target_node_id', 'text')
    .addColumn('target_column', 'text')
    .addPrimaryKeyConstraint('tests_pkey', ['set_id', 'unique_id'])
    .addForeignKeyConstraint('tests_node', ['set_id', 'node_id'], 'nodes', ['set_id', 'unique_id'])
    .execute();
  await db.schema.createIndex('tests_node').on('tests').columns(['set_id', 'node_id']).execute();
}

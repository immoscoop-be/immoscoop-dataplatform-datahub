import { type Kysely, sql } from 'kysely';

/**
 * The EDAs of the Resources (TR-ED-01): an EDA per Resource, its EDA-Probes with the fields and parameters they are
 * set on, their runs, the result of each run per subject with Data Hub's reading, and the readings of who works on it.
 * Results hold aggregates only, never rows of a table (TR-ED-03).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('edas')
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    // At most one EDA per Resource (FR-ED-02).
    .addColumn('resource_id', 'uuid', (column) => column.notNull().unique())
    .addColumn('status', 'text', (column) => column.notNull().defaultTo('inProgress').check(sql`status in ('inProgress', 'explored')`))
    .addColumn('started_by_id', 'text', (column) => column.notNull())
    .addColumn('started_by_name', 'text', (column) => column.notNull())
    .addColumn('started_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('explored_at', 'timestamptz')
    // When catalogue heard it is Explored (TR-ED-05); until then it is told again.
    .addColumn('told_at', 'timestamptz')
    // The needed EDA-Probes and how many are complete, as last computed, for the panel (FR-ED-03).
    .addColumn('needed_total', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('needed_complete', 'integer', (column) => column.notNull().defaultTo(0))
    .addCheckConstraint('edas_explored_at', sql`(status = 'explored') = (explored_at is not null)`)
    .execute();

  await db.schema
    .createTable('eda_probes')
    .addColumn('eda_id', 'uuid', (column) => column.notNull().references('edas.id').onDelete('cascade'))
    .addColumn('probe', 'text', (column) => column.notNull())
    .addColumn('fields', 'jsonb', (column) => column.notNull())
    .addColumn('params', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('added_by_id', 'text', (column) => column.notNull())
    .addColumn('added_by_name', 'text', (column) => column.notNull())
    .addColumn('added_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('eda_probes_pkey', ['eda_id', 'probe'])
    .execute();

  await db.schema
    .createTable('eda_runs')
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('eda_id', 'uuid', (column) => column.notNull().references('edas.id').onDelete('cascade'))
    .addColumn('probe', 'text', (column) => column.notNull())
    .addColumn('fields', 'jsonb', (column) => column.notNull())
    .addColumn('params', 'jsonb', (column) => column.notNull())
    .addColumn('ran_by_id', 'text', (column) => column.notNull())
    .addColumn('ran_by_name', 'text', (column) => column.notNull())
    .addColumn('ran_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('bytes', 'bigint', (column) => column.notNull())
    // Its run in the Query Log of query (TR-ED-04).
    .addColumn('query_run_id', 'text', (column) => column.notNull())
    .execute();
  await db.schema.createIndex('eda_runs_last').on('eda_runs').columns(['eda_id', 'probe', 'ran_at']).execute();

  await db.schema
    .createTable('eda_results')
    .addColumn('run_id', 'uuid', (column) => column.notNull().references('eda_runs.id').onDelete('cascade'))
    // '' for the table as a whole, otherwise a field.
    .addColumn('subject', 'text', (column) => column.notNull())
    .addColumn('position', 'integer', (column) => column.notNull())
    .addColumn('data', 'jsonb', (column) => column.notNull())
    .addColumn('reading', 'text', (column) => column.notNull().check(sql`reading in ('expected', 'look', 'judge')`))
    .addPrimaryKeyConstraint('eda_results_pkey', ['run_id', 'subject'])
    .execute();

  await db.schema
    .createTable('eda_readings')
    .addColumn('eda_id', 'uuid', (column) => column.notNull().references('edas.id').onDelete('cascade'))
    .addColumn('probe', 'text', (column) => column.notNull())
    .addColumn('subject', 'text', (column) => column.notNull())
    .addColumn('reading', 'text', (column) => column.notNull().check(sql`reading in ('expected', 'known', 'problem')`))
    .addColumn('by_id', 'text', (column) => column.notNull())
    .addColumn('by_name', 'text', (column) => column.notNull())
    .addColumn('at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('eda_readings_pkey', ['eda_id', 'probe', 'subject'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('eda_readings').execute();
  await db.schema.dropTable('eda_results').execute();
  await db.schema.dropTable('eda_runs').execute();
  await db.schema.dropTable('eda_probes').execute();
  await db.schema.dropTable('edas').execute();
}

import { type Kysely, sql } from 'kysely';

/**
 * Queries and their runs (DEC-UX-73, DEC-UX-74, DEC-LN-01). A query is its name, its question and its
 * Resources, and the SQL its author is writing; every run is a variation of it and a line of the Query
 * Log: its Query ID, the SQL and values it ran with, who ran it and when, what it read, the Resources
 * beneath it and the job in BigQuery whose result its pages are read from.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('queries')
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    // Who made it, by the fixed Google ID; nobody else runs or changes it (DEC-LN-01).
    .addColumn('owner_id', 'text', (column) => column.notNull())
    .addColumn('owner_name', 'text', (column) => column.notNull())
    .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 120`))
    .addColumn('question', 'text', (column) => column.notNull().defaultTo('').check(sql`char_length(question) <= 500`))
    // Its Resources as they were named when it was made: the ID in catalogue, the Key and the Display Name.
    .addColumn('resources', 'jsonb', (column) => column.notNull())
    .addColumn('sql', 'text', (column) => column.notNull().defaultTo('').check(sql`char_length(sql) <= 100000`))
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('last_run_at', 'timestamptz')
    .execute();
  await db.schema.createIndex('queries_owner').on('queries').columns(['owner_id', 'updated_at']).execute();

  // The Query Log: one row per run, kept for as long as Data Hub exists (DEC-LN-01).
  await db.schema
    .createTable('runs')
    .addColumn('id', 'bigserial', (column) => column.primaryKey())
    .addColumn('query_id', 'uuid', (column) => column.notNull().references('queries.id'))
    .addColumn('number', 'integer', (column) => column.notNull())
    // The Query ID every result carries, such as q-20261029-4c2e1a (FR-LN-05, FR-LN-06).
    .addColumn('query_ref', 'text', (column) => column.notNull().unique().check(sql`query_ref ~ '^q-[0-9]{8}-[0-9a-f]{6}$'`))
    .addColumn('user_id', 'text', (column) => column.notNull())
    .addColumn('user_name', 'text', (column) => column.notNull())
    .addColumn('sql', 'text', (column) => column.notNull())
    .addColumn('resources', 'jsonb', (column) => column.notNull())
    .addColumn('estimated_bytes', 'bigint', (column) => column.notNull())
    // Approved by its author, between the two thresholds (DEC-SR-29).
    .addColumn('approved', 'boolean', (column) => column.notNull().defaultTo(false))
    .addColumn('job_id', 'text')
    .addColumn('job_location', 'text')
    .addColumn('state', 'text', (column) => column.notNull().defaultTo('running').check(sql`state in ('running', 'done', 'failed')`))
    .addColumn('error', 'text')
    .addColumn('processed_bytes', 'bigint')
    .addColumn('billed_bytes', 'bigint')
    .addColumn('partitions', 'integer')
    .addColumn('row_count', 'bigint')
    .addColumn('columns', 'jsonb')
    .addColumn('started_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('finished_at', 'timestamptz')
    .addUniqueConstraint('runs_number', ['query_id', 'number'])
    .execute();
}

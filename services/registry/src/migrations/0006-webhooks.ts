import { type Kysely, sql } from 'kysely';

/**
 * The page Webhooks of Admin (FR-AR-18, FR-AR-19): the Source Job a Data Admin set per dbt project, with
 * who set it and when, in place of the one in the configuration of the environment; and every delivery
 * dbt Cloud sent to the webhook, with what Data Hub did with it. Deliveries are kept 30 days.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('source_jobs')
    .addColumn('project_id', 'bigint', (column) => column.primaryKey())
    .addColumn('job_id', 'bigint', (column) => column.notNull())
    .addColumn('job_name', 'text', (column) => column.notNull())
    .addColumn('set_by', 'text', (column) => column.notNull())
    .addColumn('set_by_name', 'text', (column) => column.notNull())
    .addColumn('set_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('deliveries')
    .addColumn('id', 'bigint', (column) => column.primaryKey().generatedAlwaysAsIdentity())
    .addColumn('received_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('outcome', 'text', (column) => column.notNull().check(sql`outcome in ('recorded', 'ignored', 'refused')`))
    // Why it was ignored or refused; null when it was recorded.
    .addColumn('reason', 'text', (column) =>
      column.check(sql`reason in ('notARun', 'otherAccount', 'notSucceeded', 'notSourceJob', 'otherProject', 'signature')`),
    )
    .addColumn('event_type', 'text')
    .addColumn('webhook_name', 'text')
    .addColumn('account_id', 'text')
    .addColumn('project_id', 'text')
    .addColumn('job_id', 'text')
    .addColumn('job_name', 'text')
    .addColumn('environment_name', 'text')
    .addColumn('run_id', 'text')
    .addColumn('run_status', 'text')
    .addColumn('run_started_at', 'text')
    .addColumn('run_finished_at', 'text')
    .execute();
  await db.schema.createIndex('deliveries_received').on('deliveries').column('received_at').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('deliveries').execute();
  await db.schema.dropTable('source_jobs').execute();
}

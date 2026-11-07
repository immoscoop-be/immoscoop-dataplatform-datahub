import { type Kysely, sql } from 'kysely';

/** Resources, their Log, and the last call of registry per dbt project (TR-SR-02, TR-SR-03). */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('resources')
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    // The full name of the table, as registry writes a relation (DEC-SR-04, FR-SR-04).
    .addColumn('key', 'text', (column) => column.notNull().unique())
    .addColumn('project_id', 'text', (column) => column.notNull())
    .addColumn('project_name', 'text')
    .addColumn('node_id', 'text', (column) => column.notNull())
    .addColumn('name', 'text', (column) => column.notNull())
    .addColumn('resource_type', 'text', (column) => column.notNull())
    // The label or Node name it asks for, and the Display Name it got (FR-SR-33).
    .addColumn('requested_name', 'text', (column) => column.notNull())
    .addColumn('display_name', 'text', (column) => column.notNull())
    .addColumn('description', 'text', (column) => column.notNull().defaultTo(''))
    .addColumn('exposures', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'`))
    // At most one Collection (FR-CO-07).
    .addColumn('collection_id', 'uuid', (column) => column.references('collections.id'))
    .addColumn('registered_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('withdrawn_at', 'timestamptz')
    .execute();
  await sql`create unique index resources_display_name on resources (lower(display_name)) where withdrawn_at is null`.execute(db);
  await db.schema.createIndex('resources_project').on('resources').column('project_id').execute();
  await db.schema.createIndex('resources_collection').on('resources').column('collection_id').execute();

  await db.schema
    .createTable('resource_log')
    .addColumn('id', 'bigint', (column) => column.primaryKey().generatedAlwaysAsIdentity())
    .addColumn('resource_id', 'uuid', (column) => column.notNull().references('resources.id'))
    .addColumn('log_id', 'text', (column) => column.notNull().check(sql`log_id ~ '^[A-Z]{3}-[0-9]{3}$'`))
    .addColumn('params', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('actor_id', 'text')
    .addColumn('at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex('resource_log_resource').on('resource_log').columns(['resource_id', 'id']).execute();

  // The Log is append-only (FR-SR-11): the service may add entries, never change or remove them.
  await sql`
    create function resource_log_append_only() returns trigger language plpgsql as $$
    begin
      raise exception 'The Log of a Resource is append-only';
    end
    $$`.execute(db);
  await sql`
    create trigger resource_log_append_only before update or delete on resource_log
    for each row execute function resource_log_append_only()`.execute(db);
  await sql`
    create trigger resource_log_no_truncate before truncate on resource_log
    for each statement execute function resource_log_append_only()`.execute(db);

  // Per dbt project, the run of the last call of registry that was applied: an older one changes nothing.
  await db.schema
    .createTable('resource_syncs')
    .addColumn('project_id', 'text', (column) => column.primaryKey())
    .addColumn('run_id', 'bigint', (column) => column.notNull())
    .addColumn('synced_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();
}

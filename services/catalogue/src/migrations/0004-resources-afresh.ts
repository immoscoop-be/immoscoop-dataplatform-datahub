import { type Kysely, sql } from 'kysely';

/** Why a column of a table is no field of its Resource (DEC-SR-33). */
const LEFT_OUT = ['array', 'struct', 'json', 'bytes'];

/** The kinds of object a Message is placed on (FR-CV-03), as in @datahub/contracts. */
const SUBJECTS = ['collection', 'resource', 'lens', 'query', 'report', 'learningCard'];

/**
 * Resources start afresh for the rebuild (DEC-DH-74, DEC-DH-76): those registered before had no
 * fields, Level, Fingerprint or Message. The next run of each dbt project, or processing it again
 * (TR-AR-07), registers every exposed table anew, with all of them. Collections stay as they are.
 *
 * Then: the Resources with their Level (TR-SR-02), their plain fields and the columns left out
 * (DEC-SR-33), their Fingerprints (FR-SR-08), their Log, the last call of registry per dbt project,
 * and the Messages Data Hub places on them (MSG-RES-01).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // Dropping the table drops its triggers too; the Log is append-only for the service, not for a migration.
  await db.schema.dropTable('resource_log').execute();
  await sql`drop function resource_log_append_only()`.execute(db);
  await db.schema.dropTable('resource_syncs').execute();
  await db.schema.dropTable('resources').execute();

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
    // The Level, from 0 · Beta to 5 · Monitored; at Registration 1 or 2 (FR-SR-07).
    .addColumn('level', 'smallint', (column) => column.notNull().check(sql`level between 0 and 5`))
    .addColumn('registered_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('withdrawn_at', 'timestamptz')
    .execute();
  await sql`create unique index resources_display_name on resources (lower(display_name)) where withdrawn_at is null`.execute(db);
  await db.schema.createIndex('resources_project').on('resources').column('project_id').execute();
  await db.schema.createIndex('resources_collection').on('resources').column('collection_id').execute();

  // The plain fields of a Resource, as dbt has them, refreshed by every call of registry (FR-SR-06).
  await db.schema
    .createTable('resource_fields')
    .addColumn('resource_id', 'uuid', (column) => column.notNull().references('resources.id'))
    .addColumn('name', 'text', (column) => column.notNull())
    .addColumn('position', 'integer')
    .addColumn('data_type', 'text')
    .addColumn('description', 'text', (column) => column.notNull().defaultTo(''))
    .addPrimaryKeyConstraint('resource_fields_pkey', ['resource_id', 'name'])
    .execute();

  // The columns of its table that are no field of a Resource, to name them when it is added (DEC-SR-33).
  await db.schema
    .createTable('resource_left_out')
    .addColumn('resource_id', 'uuid', (column) => column.notNull().references('resources.id'))
    .addColumn('name', 'text', (column) => column.notNull())
    .addColumn('data_type', 'text')
    .addColumn('reason', 'text', (column) => column.notNull().check(sql`reason in (${sql.join(LEFT_OUT.map((reason) => sql.lit(reason)))})`))
    .addPrimaryKeyConstraint('resource_left_out_pkey', ['resource_id', 'name'])
    .execute();

  // A Fingerprint: the hashes of the names, types and descriptions of its fields, and the checksum
  // of its code; one at Registration, the basis of later comparisons (FR-SR-08).
  await db.schema
    .createTable('resource_fingerprints')
    .addColumn('id', 'bigint', (column) => column.primaryKey().generatedAlwaysAsIdentity())
    .addColumn('resource_id', 'uuid', (column) => column.notNull().references('resources.id'))
    .addColumn('run_id', 'bigint', (column) => column.notNull())
    .addColumn('structure', 'text', (column) => column.notNull())
    .addColumn('types', 'text', (column) => column.notNull())
    .addColumn('descriptions', 'text', (column) => column.notNull())
    .addColumn('code', 'text')
    .addColumn('taken_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex('resource_fingerprints_resource').on('resource_fingerprints').columns(['resource_id', 'id']).execute();

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

  // A Message is placed on its object, never sent to a person (FR-CV-03): its type from the Message
  // Catalogue and its parameters, never its text (DEC-SR-09); while it asks something, its state.
  await db.schema
    .createTable('messages')
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('type', 'text', (column) => column.notNull().check(sql`type ~ '^MSG-[A-Z]{3}-[0-9]{2}$'`))
    .addColumn('subject_kind', 'text', (column) => column.notNull().check(sql`subject_kind in (${sql.join(SUBJECTS.map((kind) => sql.lit(kind)))})`))
    .addColumn('subject_id', 'text', (column) => column.notNull())
    // The fixed Google ID of whoever wrote it, or null for Data Hub itself.
    .addColumn('writer_id', 'text')
    .addColumn('params', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('state', 'text')
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex('messages_subject').on('messages').columns(['subject_kind', 'subject_id', 'created_at']).execute();
  // A Registration gives one Message per Resource, never a second (DEC-CV-10).
  await sql`create unique index messages_one_registration on messages (subject_id) where type = 'MSG-RES-01'`.execute(db);
}

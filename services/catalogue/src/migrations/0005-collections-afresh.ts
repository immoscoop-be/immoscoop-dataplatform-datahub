import { type Kysely, sql } from 'kysely';

/**
 * Collections start afresh for the rebuild (DEC-DH-76): a Collection has no colour any more
 * (DEC-CO-23), and its icon is required and comes from Phosphor (DEC-CO-19, DEC-CO-25). No icon is
 * carried over from Tabler (OP-CO-16). Every Resource is without a Collection again, and waits for
 * one (MSG-RES-01); the Log of a Resource keeps what happened to it before.
 *
 * Then: the Collections, with the name of whoever created them, and their Log (TR-CO-01, TR-CO-04).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`update resources set collection_id = null where collection_id is not null`.execute(db);
  await sql`update messages set state = 'waiting', updated_at = now() where type = 'MSG-RES-01' and state <> 'waiting'`.execute(db);
  await db.schema.alterTable('resources').dropConstraint('resources_collection_id_fkey').execute();
  // Dropping the table drops its triggers too; the Log is append-only for the service, not for a migration.
  await db.schema.dropTable('collection_log').execute();
  await sql`drop function collection_log_append_only()`.execute(db);
  await db.schema.dropTable('collections').execute();

  await db.schema
    .createTable('collections')
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 80`))
    .addColumn('description', 'text', (column) => column.notNull().check(sql`char_length(description) between 1 and 500`))
    // The name of an icon of Phosphor, drawn in the light weight; catalogue checks it against the list.
    .addColumn('icon', 'text', (column) => column.notNull().check(sql`icon ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`))
    .addColumn('owner_unit_id', 'text', (column) => column.notNull())
    .addColumn('owner_unit_email', 'text', (column) => column.notNull())
    .addColumn('owner_unit_name', 'text', (column) => column.notNull())
    .addColumn('visibility', 'text', (column) => column.notNull().defaultTo('private').check(sql`visibility in ('private', 'public')`))
    // The fixed Google ID of whoever created it, and their name at that moment, for its page.
    .addColumn('created_by', 'text', (column) => column.notNull())
    .addColumn('created_by_name', 'text', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('dissolved_at', 'timestamptz')
    .execute();
  // A name is unique, whatever its case, among the Collections that are not dissolved (FR-CO-02).
  await sql`create unique index collections_name on collections (lower(name)) where dissolved_at is null`.execute(db);
  await db.schema.createIndex('collections_owner_unit').on('collections').column('owner_unit_id').execute();
  await db.schema
    .alterTable('resources')
    .addForeignKeyConstraint('resources_collection_id_fkey', ['collection_id'], 'collections', ['id'])
    .execute();

  await db.schema
    .createTable('collection_log')
    .addColumn('id', 'bigint', (column) => column.primaryKey().generatedAlwaysAsIdentity())
    .addColumn('collection_id', 'uuid', (column) => column.notNull().references('collections.id'))
    .addColumn('log_id', 'text', (column) => column.notNull().check(sql`log_id ~ '^[A-Z]{3}-[0-9]{3}$'`))
    .addColumn('params', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('actor_id', 'text')
    .addColumn('at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex('collection_log_collection').on('collection_log').columns(['collection_id', 'id']).execute();

  // The Log is append-only (FR-CO-11): the service may add entries, never change or remove them.
  await sql`
    create function collection_log_append_only() returns trigger language plpgsql as $$
    begin
      raise exception 'The Log of a Collection is append-only';
    end
    $$`.execute(db);
  await sql`
    create trigger collection_log_append_only before update or delete on collection_log
    for each row execute function collection_log_append_only()`.execute(db);
  await sql`
    create trigger collection_log_no_truncate before truncate on collection_log
    for each statement execute function collection_log_append_only()`.execute(db);
}

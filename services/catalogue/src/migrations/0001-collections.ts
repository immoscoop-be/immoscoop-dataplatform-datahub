import { type Kysely, sql } from 'kysely';

/** The colours of the palette by Paul Tol, as in @datahub/contracts (FR-CO-04). */
const COLOURS = ['rose', 'indigo', 'sand', 'green', 'cyan', 'wine', 'teal', 'olive', 'purple'];

/** Collections and their Log (TR-CO-01, TR-CO-04). */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('collections')
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 80`))
    .addColumn('description', 'text', (column) => column.notNull().check(sql`char_length(description) between 1 and 500`))
    .addColumn('colour', 'text', (column) => column.notNull().check(sql`colour in (${sql.join(COLOURS.map((colour) => sql.lit(colour)))})`))
    .addColumn('owner_unit_id', 'text', (column) => column.notNull())
    .addColumn('owner_unit_email', 'text', (column) => column.notNull())
    .addColumn('owner_unit_name', 'text', (column) => column.notNull())
    .addColumn('visibility', 'text', (column) => column.notNull().defaultTo('private').check(sql`visibility in ('private', 'public')`))
    .addColumn('created_by', 'text', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('dissolved_at', 'timestamptz')
    .execute();
  // A name is unique, whatever its case, among the Collections that are not dissolved (FR-CO-02).
  await sql`create unique index collections_name on collections (lower(name)) where dissolved_at is null`.execute(db);
  await db.schema.createIndex('collections_owner_unit').on('collections').column('owner_unit_id').execute();

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

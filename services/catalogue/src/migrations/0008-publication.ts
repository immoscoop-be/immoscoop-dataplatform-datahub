import { type Kysely, sql } from 'kysely';

const list = (values: readonly string[]) => sql.join(values.map((value) => sql.lit(value)));

/**
 * Publishing and confirming a Resource, and what happens to it after (FR-SR-49, FR-MR-12, FR-RC-17,
 * FR-SR-50): who published it and when; each Confirmation with the fields of that moment, against which a
 * later change to the schema shows as a warning until it is marked seen; every description from dbt that
 * changed, with the text before; and whether it is deprecated, why, and what to use instead.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('resources')
    // The first Publication is the first Confirmation (DEC-SR-07); it cannot be undone (DEC-SR-28).
    .addColumn('published_at', 'timestamptz')
    .addColumn('published_by', 'text')
    // Its use discouraged, never hidden or blocked (DEC-SR-28, DEC-UX-101).
    .addColumn('deprecated_at', 'timestamptz')
    .addColumn('deprecated_by', 'text')
    .addColumn('deprecation_reason', 'text', (column) => column.check(sql`char_length(deprecation_reason) <= 500`))
    .addColumn('instead_of', 'uuid', (column) => column.references('resources.id'))
    .execute();

  // Each Confirmation, with the Fingerprint and the fields of that moment; it does not expire (DEC-MR-05).
  await db.schema
    .createTable('resource_confirmations')
    .addColumn('id', 'bigserial', (column) => column.primaryKey())
    .addColumn('resource_id', 'uuid', (column) => column.notNull().references('resources.id'))
    .addColumn('owner_id', 'text', (column) => column.notNull())
    .addColumn('owner_name', 'text', (column) => column.notNull())
    .addColumn('structure', 'text', (column) => column.notNull())
    .addColumn('types', 'text', (column) => column.notNull())
    .addColumn('descriptions', 'text', (column) => column.notNull())
    .addColumn('code', 'text')
    .addColumn('fields', 'jsonb', (column) => column.notNull())
    .addColumn('confirmed_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex('resource_confirmations_resource').on('resource_confirmations').columns(['resource_id', 'id']).execute();

  // A field added, removed or retyped after the last Confirmation: the warning, until it is seen (FR-MR-12).
  await db.schema
    .createTable('resource_changes')
    .addColumn('id', 'bigserial', (column) => column.primaryKey())
    .addColumn('resource_id', 'uuid', (column) => column.notNull().references('resources.id'))
    .addColumn('field', 'text', (column) => column.notNull())
    .addColumn('change', 'text', (column) => column.notNull().check(sql`change in (${list(['added', 'removed', 'retyped'])})`))
    .addColumn('old', 'text')
    .addColumn('new', 'text')
    .addColumn('run_id', 'bigint', (column) => column.notNull())
    .addColumn('at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('seen_at', 'timestamptz')
    .addColumn('seen_by', 'text')
    .execute();
  await db.schema.createIndex('resource_changes_unseen').on('resource_changes').column('resource_id').where(sql.ref('seen_at'), 'is', null).execute();

  // A description from dbt that changed, of the table (no field) or of a field, with the text before (FR-RC-17).
  await db.schema
    .createTable('description_changes')
    .addColumn('id', 'bigserial', (column) => column.primaryKey())
    .addColumn('resource_id', 'uuid', (column) => column.notNull().references('resources.id'))
    .addColumn('field', 'text')
    .addColumn('before', 'text', (column) => column.notNull())
    .addColumn('after', 'text', (column) => column.notNull())
    .addColumn('run_id', 'bigint', (column) => column.notNull())
    .addColumn('at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex('description_changes_resource').on('description_changes').columns(['resource_id', 'at']).execute();
}

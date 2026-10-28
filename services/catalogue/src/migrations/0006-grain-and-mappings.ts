import { type Kysely, sql } from 'kysely';

const list = (values: readonly string[]) => sql.join(values.map((value) => sql.lit(value)));

/**
 * What the Data Admin records when adding a Resource to a Collection (FR-CO-33, FR-CO-34): how it is
 * stored, its grain with its sentence, its model type, and the mapping of its fields, each with where it
 * came from and the release of the Domain Model it was made with (FR-AR-17). Kept only in Data Hub
 * (DEC-RC-09, DEC-RC-13).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('resources')
    // The fields that together identify each row, and what one row is in words (DEC-RC-07).
    .addColumn('grain', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'`))
    .addColumn('grain_sentence', 'text', (column) => column.notNull().defaultTo('').check(sql`char_length(grain_sentence) <= 200`))
    .addColumn('model_type', 'text', (column) => column.check(sql`model_type in (${list(['event', 'state', 'fact', 'dimension', 'aggregate'])})`))
    // How it is stored (FR-CO-34): a partition filter required by BigQuery, by Data Hub, or not at all (DEC-SR-35).
    .addColumn('partition_field', 'text')
    .addColumn('partition_unit', 'text', (column) => column.check(sql`partition_unit in (${list(['hour', 'day', 'month', 'year'])})`))
    .addColumn('cluster_by', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'`))
    .addColumn('partition_filter', 'text', (column) => column.notNull().defaultTo('none').check(sql`partition_filter in (${list(['none', 'dataHub', 'bigQuery'])})`))
    // Where each of them came from: dbt, a dbt test, the Domain Model, or the Data Admin.
    .addColumn('origins', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('domain_model_release', 'text')
    .execute();

  // The mapping of a field (DEC-RC-05, DEC-RC-06, DEC-RC-14): `is` an identity, a relation type towards
  // one, or who performs the event; a field without a mapping has no row.
  await db.schema
    .createTable('resource_mappings')
    .addColumn('resource_id', 'uuid', (column) => column.notNull().references('resources.id'))
    .addColumn('field', 'text', (column) => column.notNull())
    .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in (${list(['is', 'relation', 'performedBy'])})`))
    .addColumn('relation_type', 'text')
    // `entity.identifier`, or `entity.action` for the ID of an event.
    .addColumn('identity', 'text', (column) => column.notNull().check(sql`identity ~ '^[a-z][A-Za-z0-9]*\\.[a-z][A-Za-z0-9]*$'`))
    // The field mapped as `is` that a relation starts from, when the Resource has more than one (DEC-RC-08).
    .addColumn('subject', 'text')
    .addColumn('origin', 'text', (column) => column.notNull().check(sql`origin in (${list(['domainModel', 'name', 'here'])})`))
    // An Entity the Domain Model does not have yet is kept as written, and marked (DEC-CO-21).
    .addColumn('in_domain_model', 'boolean', (column) => column.notNull())
    .addColumn('release', 'text')
    .addPrimaryKeyConstraint('resource_mappings_pkey', ['resource_id', 'field'])
    .addCheckConstraint('resource_mappings_relation_type', sql`(kind = 'relation') = (relation_type is not null)`)
    .execute();
  // Data Hub links every Resource that carries the same identity (FR-RC-09).
  await db.schema.createIndex('resource_mappings_identity').on('resource_mappings').column('identity').execute();
}

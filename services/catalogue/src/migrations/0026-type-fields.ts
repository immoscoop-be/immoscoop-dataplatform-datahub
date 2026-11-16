import { type Kysely, sql } from 'kysely';

/** The model types of a Resource before and after `other` (DEC-RC-10, DEC-RC-21), as in @datahub/contracts. */
const BEFORE = ['event', 'state', 'fact', 'dimension', 'aggregate'];
const AFTER = [...BEFORE, 'other'];
/** The roles a field holds for its model type (FR-CO-44), as in @datahub/contracts. */
const ROLES = ['happenedAt', 'about', 'createdAt', 'updatedAt', 'asOf', 'occurredAt', 'measure', 'describes', 'groupedBy', 'period', 'addsUp', 'uniqueCount'];
/** Where a recorded fact came from: dbt, a dbt test, the Domain Model, or the Data Admin. */
const ORIGINS = ['dbt', 'test', 'domainModel', 'here'];

const list = (values: readonly string[]) => sql.join(values.map((value) => sql.lit(value)));

/**
 * The fields a model type asks for (FR-CO-44): `other` beside the five model types (DEC-RC-21), and per Resource each
 * field that holds a role of its model type, with where it came from. A role whose field left the Resource is kept, so
 * that the Resource can say which role is gone (DEC-RC-23). The check on `model_type` was made inline in
 * 0006-grain-and-mappings, so Postgres named it `resources_model_type_check`.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table resources drop constraint resources_model_type_check`.execute(db);
  await sql`alter table resources add constraint resources_model_type_check check (model_type in (${list(AFTER)}))`.execute(db);

  await db.schema
    .createTable('resource_type_fields')
    .addColumn('resource_id', 'uuid', (column) => column.notNull().references('resources.id'))
    .addColumn('field', 'text', (column) => column.notNull())
    .addColumn('role', 'text', (column) => column.notNull().check(sql`role in (${list(ROLES)})`))
    .addColumn('origin', 'text', (column) => column.notNull().check(sql`origin in (${list(ORIGINS)})`))
    // A field holds at most one role (FR-CO-44).
    .addPrimaryKeyConstraint('resource_type_fields_pkey', ['resource_id', 'field'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('resource_type_fields').execute();
  // A Resource of type `other` goes back to having no model type.
  await sql`update resources set model_type = null where model_type = 'other'`.execute(db);
  await sql`alter table resources drop constraint resources_model_type_check`.execute(db);
  await sql`alter table resources add constraint resources_model_type_check check (model_type in (${list(BEFORE)}))`.execute(db);
}

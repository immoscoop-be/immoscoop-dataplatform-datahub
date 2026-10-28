import { type Kysely, sql } from 'kysely';

/**
 * What the Owner and the Data Team keep about a Resource in Data Hub, next to what comes from dbt
 * (FR-RC-15): its Business Description, intended use and pitfalls, its Known Gaps, since when its data
 * is reliable, its key fields and Parameters, and the Business Description of each field (FR-RC-16).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('resources')
    // Next to the description from dbt, never over it (DEC-RC-01).
    .addColumn('business_description', 'text', (column) => column.notNull().defaultTo('').check(sql`char_length(business_description) <= 4000`))
    // The Known Behaviour (DEC-DH-18): intended use and pitfalls, and the Known Gaps in a list (DEC-RC-12).
    .addColumn('intended_use', 'text', (column) => column.notNull().defaultTo('').check(sql`char_length(intended_use) <= 2000`))
    .addColumn('pitfalls', 'text', (column) => column.notNull().defaultTo('').check(sql`char_length(pitfalls) <= 2000`))
    .addColumn('known_gaps', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'`))
    .addColumn('reliable_since', 'date')
    // Fields of the Resource, by name, in the order chosen.
    .addColumn('key_fields', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'`))
    .addColumn('parameters', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'`))
    .execute();

  // The Business Description of a field, kept by its name: the fields themselves are rewritten with every
  // new Current Version, and a field that comes back finds its Business Description again.
  await db.schema
    .createTable('field_descriptions')
    .addColumn('resource_id', 'uuid', (column) => column.notNull().references('resources.id'))
    .addColumn('field', 'text', (column) => column.notNull())
    .addColumn('text', 'text', (column) => column.notNull().check(sql`char_length(text) between 1 and 2000`))
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('updated_by', 'text', (column) => column.notNull())
    .addPrimaryKeyConstraint('field_descriptions_pkey', ['resource_id', 'field'])
    .execute();
}

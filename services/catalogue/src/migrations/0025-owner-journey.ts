import { type Kysely, sql } from 'kysely';

const STEPS = ['data', 'fields', 'pitfalls', 'gaps', 'parameters', 'admin', 'messages'];
const list = (values: readonly string[]) => sql.join(values.map((value) => sql.lit(value)));

/**
 * The Owner Journey (OP-CL-12): what the Owner Unit said in a step where the card cannot tell it, the newest of each
 * answer, with who and when: gone through it, or nothing to add where none is an answer, such as the pitfalls
 * (DEC-MR-16). And the declaration the Owner ticked, kept with the Confirmation (DEC-MR-17).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('journey_records')
    .addColumn('resource_id', 'uuid', (column) => column.notNull().references('resources.id'))
    .addColumn('step', 'text', (column) => column.notNull().check(sql`step in (${list(STEPS)})`))
    .addColumn('answer', 'text', (column) => column.notNull().check(sql`answer in ('goneThrough', 'nothing')`))
    .addColumn('user_id', 'text', (column) => column.notNull())
    .addColumn('user_name', 'text', (column) => column.notNull())
    .addColumn('at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('journey_records_pk', ['resource_id', 'step', 'answer'])
    .execute();

  await db.schema
    .alterTable('resource_confirmations')
    .addColumn('declaration', 'text', (column) => column.check(sql`char_length(declaration) <= 500`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('resource_confirmations').dropColumn('declaration').execute();
  await db.schema.dropTable('journey_records').execute();
}

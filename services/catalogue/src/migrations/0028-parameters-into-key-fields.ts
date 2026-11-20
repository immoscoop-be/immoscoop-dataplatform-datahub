import { type Kysely, sql } from 'kysely';

/**
 * Parameters leave the Resource Card: the Preview offers its Key Fields to choose by instead, and the Owner Journey has
 * no step for them any more (DEC-RC-34). Their lists go, and so do the answers "nothing to add" given to that step;
 * the Log keeps what was set and said.
 */
const STEPS = ['data', 'fields', 'pitfalls', 'gaps', 'admin', 'messages'];
const BEFORE = ['data', 'fields', 'pitfalls', 'gaps', 'parameters', 'admin', 'messages'];
const list = (steps: readonly string[]) => sql.join(steps.map((step) => sql.lit(step)));

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`delete from journey_records where step = 'parameters'`.execute(db);
  await sql`alter table journey_records drop constraint journey_records_step_check`.execute(db);
  await sql`alter table journey_records add constraint journey_records_step_check check (step in (${list(STEPS)}))`.execute(db);
  await db.schema.alterTable('resources').dropColumn('parameters').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('resources')
    .addColumn('parameters', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'`))
    .execute();
  await sql`alter table journey_records drop constraint journey_records_step_check`.execute(db);
  await sql`alter table journey_records add constraint journey_records_step_check check (step in (${list(BEFORE)}))`.execute(db);
}

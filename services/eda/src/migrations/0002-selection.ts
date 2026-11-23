import { type Kysely, sql } from 'kysely';

/**
 * The selection of rows a run ran on (OP-ED-12): the whole table, `{"where":[]}`, or the rows where its conditions
 * hold. Every run so far ran on the whole table. Only a run on the whole table is the last run of its EDA-Probe and
 * makes it complete.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('eda_runs')
    .addColumn('selection', 'jsonb', (column) => column.notNull().defaultTo(sql`'{"where":[]}'::jsonb`))
    .execute();
}

/** Without it a run on a selection would pass for one on the whole table: those runs go. */
export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`delete from eda_runs where selection <> '{"where":[]}'::jsonb`.execute(db);
  await db.schema.alterTable('eda_runs').dropColumn('selection').execute();
}

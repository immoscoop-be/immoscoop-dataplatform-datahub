import type { Kysely } from 'kysely';

/**
 * The full name of the table of a Resource as BigQuery knows it, in its own case: `project.dataset.table`.
 * The Key stays in lower case, to know the table again; BigQuery names are case-sensitive, so what queries
 * the table, shows it or copies it takes this name. Null until the next run of its Source Job brings it.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('resources').addColumn('full_name', 'text').execute();
}

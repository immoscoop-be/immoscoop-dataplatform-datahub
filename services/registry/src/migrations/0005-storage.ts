import { type Kysely, sql } from 'kysely';

/**
 * How the table of a Node is stored in BigQuery, as its dbt config says (FR-CO-34, DEC-SR-34): the
 * column it is partitioned by and the unit of its partitions, the columns it is clustered by in their
 * order, and whether BigQuery requires a filter on its partitions. Sets processed before this
 * migration have none until they are processed again (FR-AR-14).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('nodes')
    .addColumn('partition_field', 'text')
    .addColumn('partition_unit', 'text', (column) => column.check(sql`partition_unit in ('hour', 'day', 'month', 'year')`))
    .addColumn('cluster_by', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'`))
    .addColumn('require_partition_filter', 'boolean', (column) => column.notNull().defaultTo(false))
    .execute();
}

import { type Kysely, sql } from 'kysely';

/**
 * What a recorded run brought, for its delivery on Webhooks (FR-AR-19): how many Nodes its Artifact Set held,
 * how many of them are exposures tagged `datahub`, and what catalogue did with the exposed tables when the set
 * became the Current Version, or why it was not told. Sets that still keep their Nodes get their counts now;
 * what catalogue did with them was never kept, so it stays empty until their next run.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('artifact_sets').addColumn('nodes', 'integer').addColumn('exposures', 'integer').addColumn('catalogue', 'jsonb').execute();
  await sql`
    update artifact_sets s set nodes = counted.nodes, exposures = counted.exposures
    from (
      select set_id, count(*)::int as nodes, (count(*) filter (where resource_type = 'exposure' and 'datahub' = any(tags)))::int as exposures
      from nodes group by set_id
    ) counted
    where counted.set_id = s.id
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('artifact_sets').dropColumn('catalogue').dropColumn('exposures').dropColumn('nodes').execute();
}

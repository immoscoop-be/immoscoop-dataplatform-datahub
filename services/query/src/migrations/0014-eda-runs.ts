import { type Kysely, sql } from 'kysely';

/**
 * The runs of the EDA-Probes (TR-ED-04): eda has query run them as the User, and each is a run of one query per User
 * and Resource, of the kind `eda`, so that it is in the Query Log, apart from the queries of the panel of the User, as
 * the previews of a Resource are (DEC-ED-26). The Resource is its ID in catalogue.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table queries drop constraint queries_kind_check`.execute(db);
  await sql`alter table queries add constraint queries_kind_check check (kind in ('query', 'preview', 'lens', 'eda'))`.execute(db);
  await db.schema.alterTable('queries').addColumn('eda_of', 'uuid').execute();
  await sql`create unique index queries_one_eda on queries (owner_id, eda_of) where kind = 'eda'`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Their runs go first; what else points at them goes with them (on delete cascade).
  await db.deleteFrom('runs' as never).where(sql`query_id`, 'in', sql`(select id from queries where kind = 'eda')`).execute();
  await db.deleteFrom('queries' as never).where(sql`kind`, '=', 'eda').execute();
  await db.schema.dropIndex('queries_one_eda').execute();
  await db.schema.alterTable('queries').dropColumn('eda_of').execute();
  await sql`alter table queries drop constraint queries_kind_check`.execute(db);
  await sql`alter table queries add constraint queries_kind_check check (kind in ('query', 'preview', 'lens'))`.execute(db);
}

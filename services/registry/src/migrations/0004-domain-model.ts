import { type Kysely, sql } from 'kysely';

/**
 * What a Node of Colleciónes is built from: its Entity, action, strategy and layer (FR-AR-16); and
 * the meta of every column, where Colleciónes says per column what the Domain Model says about it
 * (DEC-AR-07). Sets processed before this migration have none until they are processed again (FR-AR-14).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('nodes')
    .addColumn('entity', 'text')
    .addColumn('action', 'text')
    .addColumn('strategy', 'text')
    .addColumn('layer', 'text')
    .execute();
  await db.schema.createIndex('nodes_entity').on('nodes').column('entity').execute();
  await sql`alter table columns add column meta jsonb not null default '{}'::jsonb`.execute(db);
}

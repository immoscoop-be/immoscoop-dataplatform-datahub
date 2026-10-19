import { type Kysely, sql } from 'kysely';

/**
 * The meta of every Node: what the dbt project says about it beyond the description, such as the
 * domain and the strategy of a model in Colleciónes. Sets processed before this migration have
 * none until they are processed again (FR-AR-14).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table nodes add column meta jsonb not null default '{}'::jsonb`.execute(db);
}

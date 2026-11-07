import { type Kysely, sql } from 'kysely';

/**
 * Search over the Nodes and their columns (FR-AR-10, DEC-SR-10): full text over names and
 * descriptions, and trigrams for a name with a typo or only half remembered.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // In public, so every schema can use it. Two migrations that run at the same moment, such as in
  // the tests, may both try to create it; the second one finds it there.
  await sql`
    do $$ begin
      create extension if not exists pg_trgm with schema public;
    exception when unique_violation or duplicate_object then null;
    end $$`.execute(db);

  await sql`alter table nodes add column search tsvector generated always as (to_tsvector('simple', name || ' ' || description)) stored`.execute(db);
  await sql`create index nodes_search on nodes using gin (search)`.execute(db);
  await sql`create index nodes_name_trigrams on nodes using gin (name public.gin_trgm_ops)`.execute(db);

  await sql`alter table columns add column search tsvector generated always as (to_tsvector('simple', name || ' ' || description)) stored`.execute(db);
  await sql`create index columns_search on columns using gin (search)`.execute(db);
}

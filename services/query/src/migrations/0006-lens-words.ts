import { type Kysely, sql } from 'kysely';

/**
 * Finding a Lens by the words of a question (FR-SR-48, DEC-SR-42): the full-text search of Postgres in
 * English, common words left out and every word by its stem, with accents left out too (Search). The
 * configuration `lens_words` is that of English, with `unaccent` before the stemmer.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // In public, so every schema can use it. Two migrations that run at the same moment, such as in
  // the tests, may both try to create it; the second one finds it there.
  await sql`
    do $$ begin
      create extension if not exists unaccent with schema public;
    exception when unique_violation or duplicate_object then null;
    end $$`.execute(db);
  await sql`create text search configuration lens_words (copy = pg_catalog.english)`.execute(db);
  await sql`alter text search configuration lens_words alter mapping for hword, hword_part, word with public.unaccent, english_stem`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop text search configuration lens_words`.execute(db);
}

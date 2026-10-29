import { createWordsConfiguration } from '@datahub/db';
import { type Kysely, sql } from 'kysely';

/**
 * Finding Collections and Resources by the words of a question, on the start screen of Collections
 * (FR-CO-37, DEC-UX-127): the full-text search of Postgres in English, without accents (Search), in
 * the configuration `search_words`.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await createWordsConfiguration(db, 'search_words');
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop text search configuration search_words`.execute(db);
}

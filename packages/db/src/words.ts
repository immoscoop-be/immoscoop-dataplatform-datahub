import { type Kysely, type RawBuilder, sql } from 'kysely';

/**
 * Finding things by the words of a question (FR-SR-48, Search): the full-text search of Postgres in
 * English, with `unaccent` before the stemmer, so that common words are left out, every word counts by
 * its stem and accents do not count. The shared words are marked by `ts_headline`.
 */

/** A piece of a text, and whether it is a word the question shares (DEC-UX-23). */
export interface Marked {
  text: string;
  shared: boolean;
}

/** The marks of `ts_headline` around a shared word: characters no text of Data Hub holds. */
const START = '\u0001';
const STOP = '\u0002';

/** The options of `ts_headline`: the whole text, each shared word between the marks. */
export const HEADLINE = `StartSel=${START}, StopSel=${STOP}, HighlightAll=true`;

/** A text with its shared words marked, in pieces. */
export function marked(text: string): Marked[] {
  const pieces: Marked[] = [];
  for (const [index, part] of text.split(START).entries()) {
    const [word, rest] = index === 0 ? [null, part] : [part.split(STOP)[0] ?? '', part.split(STOP).slice(1).join('')];
    if (word) pieces.push({ text: word, shared: true });
    if (rest) pieces.push({ text: rest, shared: false });
  }
  return pieces;
}

/**
 * Makes the text search configuration `name` in the schema of a migration: that of English, with
 * `unaccent` before the stemmer. `unaccent` goes into public, so every schema can use it; two
 * migrations that run at the same moment, such as in the tests, may both try to create it.
 */
export async function createWordsConfiguration(db: Kysely<unknown>, name: string): Promise<void> {
  await sql`
    do $$ begin
      create extension if not exists unaccent with schema public;
    exception when unique_violation or duplicate_object then null;
    end $$`.execute(db);
  await sql`create text search configuration ${sql.id(name)} (copy = pg_catalog.english)`.execute(db);
  await sql`alter text search configuration ${sql.id(name)} alter mapping for hword, hword_part, word with public.unaccent, english_stem`.execute(db);
}

/**
 * The words of a question in a configuration, as lexemes, and as a query that finds any of them,
 * without stemming them again; the query is null for a question without words.
 */
export function askedWords(configuration: string, question: string): RawBuilder<{ words: string[]; q: string | null }> {
  return sql`(
    select words, case when cardinality(words) = 0 then null
      else array_to_string(array(select quote_literal(word) from unnest(words) as word), ' | ')::tsquery end as q
    from (select tsvector_to_array(to_tsvector(${configuration}::regconfig, ${question})) as words) as asked
  )`;
}

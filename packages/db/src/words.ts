import { type Kysely, type RawBuilder, sql } from 'kysely';

/**
 * Finding things by the words of a question (FR-SR-48, Search): the full-text search of Postgres in
 * English, with `unaccent` before the stemmer, so that common words are left out, every word counts by
 * its stem and accents do not count. The last word, the one still being typed, also counts as the start
 * of a word, unstemmed, so that results come while typing: "cre" finds "credits" (DEC-UX-267). The shared
 * words are marked by `ts_headline`, and the words that start with the last word by `marked`.
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

/** A word as the search compares it: lower case, without accents. */
const plain = (word: string) => word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** The words of a piece of text that start with what is being typed, marked as shared. */
function startsMarked(text: string, typed: string): Marked[] {
  const pieces: Marked[] = [];
  let at = 0;
  for (const match of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    if (!plain(match[0]).startsWith(typed)) continue;
    if (match.index > at) pieces.push({ text: text.slice(at, match.index), shared: false });
    pieces.push({ text: match[0], shared: true });
    at = match.index + match[0].length;
  }
  if (at < text.length) pieces.push({ text: text.slice(at), shared: false });
  return pieces;
}

/**
 * A text with its shared words marked, in pieces; with `typed`, the last word of the question as the search
 * compares it, also the words that start with it.
 */
export function marked(text: string, typed?: string | null): Marked[] {
  const pieces: Marked[] = [];
  for (const [index, part] of text.split(START).entries()) {
    const [word, rest] = index === 0 ? [null, part] : [part.split(STOP)[0] ?? '', part.split(STOP).slice(1).join('')];
    if (word) pieces.push({ text: word, shared: true });
    if (rest) pieces.push({ text: rest, shared: false });
  }
  return typed ? pieces.flatMap((piece) => (piece.shared ? [piece] : startsMarked(piece.text, typed))) : pieces;
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

/** `unaccent` with its dictionary named, as the schema of a service does not have public in its search path. */
const unaccent = (text: RawBuilder<unknown>) => sql`public.unaccent('public.unaccent'::regdictionary, ${text})`;

/**
 * The words of a question in a configuration, as the common table expression `query` that `shares` and
 * `sharedCount` read: `words`, its lexemes; `q`, a query that finds any of them without stemming them
 * again, null for a question without words; `last`, its last word in lower case without accents, and
 * `last_stem`, its lexeme, both null when it is shorter than two letters or a common word; and `prefix`,
 * a query that finds the words that start with `last`, unstemmed (DEC-UX-267).
 */
export function askedWords(
  configuration: string,
  question: string,
): RawBuilder<{ words: string[]; q: string | null; last: string | null; last_stem: string | null; prefix: string | null }> {
  return sql`(
    select words, q, case when last_stem is null then null else last end as last, last_stem,
      case when last_stem is null then null else to_tsquery('simple', quote_literal(last) || ':*') end as prefix
    from (
      select words, last,
        case when cardinality(words) = 0 then null
          else array_to_string(array(select quote_literal(word) from unnest(words) as word), ' | ')::tsquery end as q,
        case when length(last) < 2 then null
          else (select lexeme from unnest(to_tsvector(${configuration}::regconfig, last)) limit 1) end as last_stem
      from (
        select tsvector_to_array(to_tsvector(${configuration}::regconfig, ${question})) as words,
          substring(lower(${unaccent(sql`${question}::text`)}) from '([[:alnum:]]+)[^[:alnum:]]*$') as last
      ) as asked
    ) as parts
  )`;
}

/** Whether a text shares a word with the question of `query`: a word by its stem, or the last word as the start of a word. */
export function shares(configuration: string, text: RawBuilder<unknown>): RawBuilder<boolean> {
  return sql`(query.q is not null and (to_tsvector(${sql.lit(configuration)}::regconfig, ${text}) @@ query.q
    or (query.prefix is not null and to_tsvector('simple', ${unaccent(text)}) @@ query.prefix)))`;
}

/** How many words of the question of `query` a text shares; the last word also when a word of the text starts with it. */
export function sharedCount(configuration: string, text: RawBuilder<unknown>): RawBuilder<string> {
  return sql`(select count(*) from unnest(query.words) as word
    where word = any(tsvector_to_array(to_tsvector(${sql.lit(configuration)}::regconfig, ${text})))
      or (word = query.last_stem and to_tsvector('simple', ${unaccent(text)}) @@ query.prefix))`;
}

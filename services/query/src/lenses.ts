import { askedWords, HEADLINE, type Marked, marked } from '@datahub/db';
import { type Kysely, type Selectable, sql } from 'kysely';
import type { LensLogId, LensParameterRow, LensRange, LensState, Missing, NamedResource, QueryDatabase } from './database.js';
import type { Query, Viewer } from './queries.js';

/** A Parameter of a Lens: one of its query, with the name Users see and its value as the default (DEC-LE-01). */
export type LensParameter = LensParameterRow;

/** A Lens: a query with its Parameters, in a Collection its author owns (DEC-LE-06, DEC-CO-20). */
export interface Lens {
  id: string;
  collectionId: string;
  /** The query it was made from, used as this Lens (DEC-LE-03). */
  queryId: string;
  authorId: string;
  authorName: string;
  name: string;
  question: string;
  shows: string;
  steps: string[];
  tags: string[];
  sql: string;
  parameters: LensParameter[];
  resources: NamedResource[];
  version: number;
  state: LensState;
  range: LensRange;
  reads: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  /** Since when it stopped, and what one run with its defaults read then (DEC-LE-11). */
  stoppedAt: Date | null;
  stoppedReads: number | null;
  /** What it misses while it is Broken (FR-LE-17). */
  broken: Missing | null;
}

/** A version of a Lens: who made it from which query, measured in which range (FR-LE-16, DEC-LE-18). */
export interface LensVersion {
  version: number;
  range: LensRange;
  reads: number;
  madeByName: string;
  fromQueryId: string;
  madeAt: Date;
}

/** A line of the Log of a Lens (FR-SR-52). */
export interface LensLogEntry {
  logId: LensLogId;
  params: Record<string, string>;
  at: Date;
}

/** What its Owner Unit changes about a Lens, never its SQL (FR-LE-06, DEC-LE-16). */
export interface LensEdit {
  name?: string;
  question?: string;
  shows?: string;
  steps?: string[];
  tags?: string[];
  /** The name Users see, per Parameter. */
  labels?: Record<string, string>;
}

/** What makes the next version of a Lens: a query used as it, measured now (FR-LE-16). */
export interface NewVersion {
  by: Viewer;
  query: Query;
  parameters: LensParameter[];
  range: LensRange;
  reads: number;
}

/** What a Lens is made of: its query as it is now, measured, and what its author tells about it. */
export interface NewLens {
  author: Viewer;
  query: Query;
  collectionId: string;
  name: string;
  question: string;
  shows: string;
  steps: string[];
  tags: string[];
  parameters: LensParameter[];
  range: LensRange;
  reads: number;
}

export type { Marked };

/** What a Lens shares with the words of a question: how many, and where they are (FR-SR-48, DEC-SR-42). */
export interface SharedWords {
  shared: number;
  name: Marked[];
  question: Marked[];
  shows: Marked[];
  tags: string[];
}

export interface Lenses {
  /** Makes a Lens with its first version: published, or waiting for the Data Team above 1 GB (FR-LE-08). */
  create(fields: NewLens): Promise<Lens>;
  get(id: string): Promise<Lens | undefined>;
  /** The Lens a query is used as, if it is (DEC-LE-03). */
  ofQuery(queryId: string): Promise<Lens | undefined>;
  /** Every Lens, by name; who sees which is for the caller to decide (DEC-LE-09, DEC-CO-16). */
  list(): Promise<Lens[]>;
  edit(id: string, changes: LensEdit): Promise<Lens>;
  /**
   * Its next version, from a query used as it: published, or waiting above 1 GB (FR-LE-16). A stopped or
   * Broken Lens that a new version brings within range works again.
   */
  version(id: string, next: NewVersion): Promise<Lens>;
  versions(id: string): Promise<LensVersion[]>;
  /** A run with its defaults grew: into large its range follows; past 1 GB it stops (DEC-LE-11, DEC-LE-19). */
  grow(id: string, range: LensRange, reads: number): Promise<Lens>;
  /** It misses a table or a column (`BRK-001`), or works again (`BRK-002`); each change once (FR-LE-17). */
  breaks(id: string, missing: Omit<Missing, 'since'>): Promise<Lens>;
  works(id: string): Promise<Lens>;
  log(id: string): Promise<LensLogEntry[]>;
  /**
   * The words each of these Lenses shares with a question, in the full-text search of Postgres in English
   * without accents (`lens_words`): common words left out, each word by its stem (FR-SR-48, DEC-SR-42).
   */
  words(question: string, ids: readonly string[]): Promise<Map<string, SharedWords>>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const lensOf = (row: Selectable<QueryDatabase['lenses']>): Lens => ({
  ...row,
  reads: Number(row.reads),
  stoppedReads: row.stoppedReads === null ? null : Number(row.stoppedReads),
});

/** How BigQuery names what is missing, as the Log says it: a column, or a table. */
const missingText = (missing: Omit<Missing, 'since'>) => missing.name;

export function createLenses(db: Kysely<QueryDatabase>): Lenses {
  return {
    async create({ author, query, collectionId, name, question, shows, steps, tags, parameters, range, reads }) {
      const state: LensState = range === 'request' ? 'waiting' : 'published';
      return db.transaction().execute(async (trx) => {
        const row = await trx
          .insertInto('lenses')
          .values({
            collectionId,
            queryId: query.id,
            authorId: author.id,
            authorName: author.name,
            name,
            question,
            shows,
            steps: JSON.stringify(steps),
            tags: JSON.stringify(tags),
            sql: query.sql,
            parameters: JSON.stringify(parameters),
            resources: JSON.stringify(query.resources),
            state,
            range,
            reads,
            publishedAt: state === 'published' ? new Date() : null,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await trx
          .insertInto('lensVersions')
          .values({
            lensId: row.id,
            version: row.version,
            sql: row.sql,
            parameters: JSON.stringify(parameters),
            resources: JSON.stringify(query.resources),
            range,
            reads,
            madeById: author.id,
            madeByName: author.name,
            fromQueryId: query.id,
          })
          .execute();
        return lensOf(row);
      });
    },

    async get(id) {
      if (!UUID.test(id)) return undefined;
      const row = await db.selectFrom('lenses').selectAll().where('id', '=', id).executeTakeFirst();
      return row && lensOf(row);
    },

    async ofQuery(queryId) {
      const row = await db.selectFrom('lenses').selectAll().where('queryId', '=', queryId).executeTakeFirst();
      return row && lensOf(row);
    },

    async list() {
      const rows = await db.selectFrom('lenses').selectAll().orderBy('name').limit(2000).execute();
      return rows.map(lensOf);
    },

    async edit(id, { labels, steps, tags, ...fields }) {
      return db.transaction().execute(async (trx) => {
        const row = await trx.selectFrom('lenses').selectAll().where('id', '=', id).forUpdate().executeTakeFirstOrThrow();
        const parameters = labels ? row.parameters.map((parameter) => ({ ...parameter, label: labels[parameter.name] ?? parameter.label })) : undefined;
        const updated = await trx
          .updateTable('lenses')
          .set({
            ...fields,
            ...(steps ? { steps: JSON.stringify(steps) } : {}),
            ...(tags ? { tags: JSON.stringify(tags) } : {}),
            ...(parameters ? { parameters: JSON.stringify(parameters) } : {}),
            updatedAt: new Date(),
          })
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow();
        return lensOf(updated);
      });
    },

    async version(id, { by, query, parameters, range, reads }) {
      const state: LensState = range === 'request' ? 'waiting' : 'published';
      return db.transaction().execute(async (trx) => {
        const row = await trx.selectFrom('lenses').selectAll().where('id', '=', id).forUpdate().executeTakeFirstOrThrow();
        const version = row.version + 1;
        const updated = await trx
          .updateTable('lenses')
          .set({
            sql: query.sql,
            parameters: JSON.stringify(parameters),
            resources: JSON.stringify(query.resources),
            version,
            state,
            range,
            reads,
            stoppedAt: null,
            stoppedReads: null,
            broken: null,
            publishedAt: state === 'published' ? (row.publishedAt ?? new Date()) : row.publishedAt,
            updatedAt: new Date(),
          })
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow();
        await trx
          .insertInto('lensVersions')
          .values({
            lensId: id,
            version,
            sql: query.sql,
            parameters: JSON.stringify(parameters),
            resources: JSON.stringify(query.resources),
            range,
            reads,
            madeById: by.id,
            madeByName: by.name,
            fromQueryId: query.id,
          })
          .execute();
        if (row.broken) await trx.insertInto('lensLog').values({ lensId: id, logId: 'BRK-002', params: JSON.stringify({ restored: row.broken.name, run: '' }) }).execute();
        return lensOf(updated);
      });
    },

    async versions(id) {
      const rows = await db
        .selectFrom('lensVersions')
        .select(['version', 'range', 'reads', 'madeByName', 'fromQueryId', 'madeAt'])
        .where('lensId', '=', id)
        .orderBy('version', 'desc')
        .execute();
      return rows.map((row) => ({ ...row, reads: Number(row.reads) }));
    },

    async grow(id, range, reads) {
      const stops = range === 'request';
      const row = await db
        .updateTable('lenses')
        .set({ range, ...(stops ? { state: 'stopped' as const, stoppedAt: new Date(), stoppedReads: reads } : {}), updatedAt: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      return lensOf(row);
    },

    async breaks(id, missing) {
      return db.transaction().execute(async (trx) => {
        const row = await trx.selectFrom('lenses').selectAll().where('id', '=', id).forUpdate().executeTakeFirstOrThrow();
        if (row.broken) return lensOf(row);
        const broken: Missing = { ...missing, since: new Date().toISOString() };
        const updated = await trx.updateTable('lenses').set({ broken: JSON.stringify(broken), updatedAt: new Date() }).where('id', '=', id).returningAll().executeTakeFirstOrThrow();
        await trx.insertInto('lensLog').values({ lensId: id, logId: 'BRK-001', params: JSON.stringify({ missing: missingText(missing), run: '' }) }).execute();
        return lensOf(updated);
      });
    },

    async works(id) {
      return db.transaction().execute(async (trx) => {
        const row = await trx.selectFrom('lenses').selectAll().where('id', '=', id).forUpdate().executeTakeFirstOrThrow();
        if (!row.broken) return lensOf(row);
        const updated = await trx.updateTable('lenses').set({ broken: null, updatedAt: new Date() }).where('id', '=', id).returningAll().executeTakeFirstOrThrow();
        await trx.insertInto('lensLog').values({ lensId: id, logId: 'BRK-002', params: JSON.stringify({ restored: row.broken.name, run: '' }) }).execute();
        return lensOf(updated);
      });
    },

    async log(id) {
      return db.selectFrom('lensLog').select(['logId', 'params', 'at']).where('lensId', '=', id).orderBy('id', 'desc').limit(50).execute();
    },

    async words(question, ids) {
      if (ids.length === 0) return new Map();
      const options = HEADLINE;
      const { rows } = await sql<{ id: string; shared: string; name: string; question: string; shows: string; tags: string[] }>`
        with query as ${askedWords('lens_words', question)}, lens as (
          select l.*, array(select jsonb_array_elements_text(l.tags)) as tag_list from lenses l where l.id = any(${ids as string[]}::uuid[])
        )
        select lens.id,
          (select count(*) from unnest(query.words) as word
            where word = any(tsvector_to_array(to_tsvector('lens_words', concat_ws(' ', lens.name, lens.question, lens.shows, array_to_string(lens.tag_list, ' ')))))) as shared,
          case when query.q is null then lens.name else ts_headline('lens_words', lens.name, query.q, ${options}) end as name,
          case when query.q is null then lens.question else ts_headline('lens_words', lens.question, query.q, ${options}) end as question,
          case when query.q is null then lens.shows else ts_headline('lens_words', lens.shows, query.q, ${options}) end as shows,
          array(select tag from unnest(lens.tag_list) as tag where query.q is not null and to_tsvector('lens_words', tag) @@ query.q) as tags
        from lens, query
      `.execute(db);
      return new Map(rows.map((row) => [row.id, { shared: Number(row.shared), name: marked(row.name), question: marked(row.question), shows: marked(row.shows), tags: row.tags }]));
    },
  };
}

import type { Kysely, Selectable } from 'kysely';
import type { LensParameterRow, LensRange, LensState, NamedResource, QueryDatabase } from './database.js';
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

export interface Lenses {
  /** Makes a Lens with its first version: published, or waiting for the Data Team above 1 GB (FR-LE-08). */
  create(fields: NewLens): Promise<Lens>;
  get(id: string): Promise<Lens | undefined>;
  /** The Lens a query is used as, if it is (DEC-LE-03). */
  ofQuery(queryId: string): Promise<Lens | undefined>;
  /** Every Lens, by name; who sees which is for the caller to decide (DEC-LE-09, DEC-CO-16). */
  list(): Promise<Lens[]>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const lensOf = (row: Selectable<QueryDatabase['lenses']>): Lens => ({ ...row, reads: Number(row.reads) });

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
  };
}

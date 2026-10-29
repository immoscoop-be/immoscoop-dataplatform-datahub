import { randomBytes } from 'node:crypto';
import { type Kysely, sql } from 'kysely';
import type { NamedResource, QueryDatabase, ResultColumn, RunState } from './database.js';
import type { Parameter } from './parameters.js';

/** Who asks: the fixed Google ID and name from the Access Token, and whether they are in the Data Team. */
export interface Viewer {
  id: string;
  name: string;
  dataTeam: boolean;
}

export interface Query {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  question: string;
  resources: NamedResource[];
  sql: string;
  parameters: Parameter[];
  /** The query it was started from, and after which of its runs (DEC-UX-73). */
  startedFrom: string | null;
  startedAfterRun: number | null;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt: Date | null;
}

/** A query in the panel of Query: one item per query, with how many runs (DEC-UX-74). */
export interface QueryItem extends Pick<Query, 'id' | 'name' | 'ownerName' | 'createdAt' | 'lastRunAt'> {
  resources: Pick<NamedResource, 'id' | 'displayName'>[];
  runs: number;
}

/** A run of a query: a line of the Query Log (DEC-LN-01). */
export interface Run {
  id: string;
  queryId: string;
  number: number;
  queryRef: string;
  userId: string;
  userName: string;
  sql: string;
  parameters: Parameter[];
  resources: NamedResource[];
  estimatedBytes: number;
  approved: boolean;
  jobId: string | null;
  jobLocation: string | null;
  state: RunState;
  error: string | null;
  processedBytes: number | null;
  billedBytes: number | null;
  partitions: number | null;
  rowCount: number | null;
  columns: ResultColumn[] | null;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface Finish {
  jobId: string;
  jobLocation: string;
  processedBytes: number;
  billedBytes: number | null;
  partitions: number | null;
  rowCount: number;
  columns: ResultColumn[];
}

/** What a query starts with: its own SQL and Parameters, or those of the query it is started from. */
export interface NewQuery {
  owner: Viewer;
  name: string;
  question: string;
  resources: NamedResource[];
  sql: string;
  parameters?: Parameter[];
  startedFrom?: { id: string; afterRun: number | null };
}

export interface Queries {
  create(fields: NewQuery): Promise<Query>;
  /** The queries of the User, or with all, everyone's (DEC-LN-01): the last run or made first. */
  list(viewer: Viewer, all: boolean): Promise<QueryItem[]>;
  get(id: string): Promise<Query | undefined>;
  update(id: string, fields: Partial<Pick<Query, 'name' | 'question' | 'sql' | 'parameters'>>): Promise<Query | undefined>;
  /** Starts a run: its number in its query and its Query ID (FR-LN-05). */
  startRun(fields: { query: Query; user: Viewer; sql: string; parameters: Parameter[]; estimatedBytes: number; approved: boolean }): Promise<Run>;
  finishRun(id: string, finish: Finish): Promise<Run>;
  failRun(id: string, error: string): Promise<Run>;
  /** A run by its Query ID. */
  run(queryRef: string): Promise<Run | undefined>;
  lastRun(queryId: string): Promise<Run | undefined>;
  /** Its runs, newest first: the history of a query (DEC-UX-74), from before a run number on. */
  runs(queryId: string, options: { before?: number; limit: number }): Promise<Run[]>;
  /** How many runs a query has. */
  runCount(queryId: string): Promise<number>;
}

/** The Query ID of a run: the day and six random hex digits, such as q-20261029-4c2e1a (FR-LN-05). */
export function queryRefOf(at: Date, random: () => string = () => randomBytes(3).toString('hex')): string {
  return `q-${at.toISOString().slice(0, 10).replaceAll('-', '')}-${random()}`;
}

type RunRow = Omit<Run, 'estimatedBytes' | 'processedBytes' | 'billedBytes' | 'rowCount'> & {
  estimatedBytes: string;
  processedBytes: string | null;
  billedBytes: string | null;
  rowCount: string | null;
};

const runOf = (row: RunRow): Run => ({
  ...row,
  estimatedBytes: Number(row.estimatedBytes),
  processedBytes: row.processedBytes === null ? null : Number(row.processedBytes),
  billedBytes: row.billedBytes === null ? null : Number(row.billedBytes),
  rowCount: row.rowCount === null ? null : Number(row.rowCount),
});

const UNIQUE_VIOLATION = '23505';

export function createQueries(db: Kysely<QueryDatabase>): Queries {
  async function queryById(id: string): Promise<Query | undefined> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
    return db.selectFrom('queries').selectAll().where('id', '=', id).executeTakeFirst();
  }

  return {
    async create({ owner, name, question, resources, sql: text, parameters = [], startedFrom }) {
      return db
        .insertInto('queries')
        .values({
          ownerId: owner.id,
          ownerName: owner.name,
          name,
          question,
          resources: JSON.stringify(resources),
          sql: text,
          parameters: JSON.stringify(parameters),
          startedFrom: startedFrom?.id ?? null,
          startedAfterRun: startedFrom?.afterRun ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async list(viewer, all) {
      const rows = await db
        .selectFrom('queries as q')
        .select(['q.id', 'q.name', 'q.ownerName', 'q.resources', 'q.createdAt', 'q.lastRunAt'])
        .select((eb) => eb.selectFrom('runs').whereRef('runs.queryId', '=', 'q.id').select(sql<string>`count(*)`.as('count')).as('runs'))
        .$if(!all, (query) => query.where('q.ownerId', '=', viewer.id))
        .orderBy(sql`coalesce(q.last_run_at, q.created_at)`, 'desc')
        .limit(200)
        .execute();
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        ownerName: row.ownerName,
        createdAt: row.createdAt,
        lastRunAt: row.lastRunAt,
        resources: row.resources.map(({ id, displayName }) => ({ id, displayName })),
        runs: Number(row.runs ?? 0),
      }));
    },

    get: queryById,

    async update(id, { parameters, ...fields }) {
      if (!(await queryById(id))) return undefined;
      return db
        .updateTable('queries')
        .set({ ...fields, ...(parameters ? { parameters: JSON.stringify(parameters) } : {}), updatedAt: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async startRun({ query, user, sql: text, parameters, estimatedBytes, approved }) {
      for (let attempt = 0; ; attempt += 1) {
        try {
          return await db.transaction().execute(async (trx) => {
            // One run at a time takes the next number of its query.
            await trx.selectFrom('queries').select('id').where('id', '=', query.id).forUpdate().executeTakeFirstOrThrow();
            const last = await trx.selectFrom('runs').select(sql<number>`coalesce(max(number), 0)`.as('number')).where('queryId', '=', query.id).executeTakeFirstOrThrow();
            const row = await trx
              .insertInto('runs')
              .values({
                queryId: query.id,
                number: Number(last.number) + 1,
                queryRef: queryRefOf(new Date()),
                userId: user.id,
                userName: user.name,
                sql: text,
                parameters: JSON.stringify(parameters),
                resources: JSON.stringify(query.resources),
                estimatedBytes,
                approved,
              })
              .returningAll()
              .executeTakeFirstOrThrow();
            await trx
              .updateTable('queries')
              .set({ sql: text, parameters: JSON.stringify(parameters), lastRunAt: new Date(), updatedAt: new Date() })
              .where('id', '=', query.id)
              .execute();
            return runOf(row as RunRow);
          });
        } catch (error) {
          // Two runs on the same day with the same six digits: draw again.
          if ((error as { code?: string }).code !== UNIQUE_VIOLATION || attempt >= 3) throw error;
        }
      }
    },

    async finishRun(id, finish) {
      const row = await db
        .updateTable('runs')
        .set({ ...finish, columns: JSON.stringify(finish.columns), state: 'done', finishedAt: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      return runOf(row as RunRow);
    },

    async failRun(id, error) {
      const row = await db.updateTable('runs').set({ state: 'failed', error, finishedAt: new Date() }).where('id', '=', id).returningAll().executeTakeFirstOrThrow();
      return runOf(row as RunRow);
    },

    async run(queryRef) {
      const row = await db.selectFrom('runs').selectAll().where('queryRef', '=', queryRef).executeTakeFirst();
      return row ? runOf(row as RunRow) : undefined;
    },

    async lastRun(queryId) {
      const row = await db.selectFrom('runs').selectAll().where('queryId', '=', queryId).orderBy('number', 'desc').limit(1).executeTakeFirst();
      return row ? runOf(row as RunRow) : undefined;
    },

    async runs(queryId, { before, limit }) {
      const rows = await db
        .selectFrom('runs')
        .selectAll()
        .where('queryId', '=', queryId)
        .$if(before !== undefined, (query) => query.where('number', '<', before as number))
        .orderBy('number', 'desc')
        .limit(limit)
        .execute();
      return rows.map((row) => runOf(row as RunRow));
    },

    async runCount(queryId) {
      const row = await db.selectFrom('runs').select(sql<string>`count(*)`.as('count')).where('queryId', '=', queryId).executeTakeFirstOrThrow();
      return Number(row.count);
    },
  };
}

import { randomBytes } from 'node:crypto';
import { type Kysely, sql } from 'kysely';
import type { NamedResource, QueryDatabase, QueryKind, ResultColumn, RunPurpose, RunState } from './database.js';
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
  /** A query written in Query, or the previews of a Resource (FR-SR-38). */
  kind: QueryKind;
  previewOf: string | null;
  /** For the runs of a Lens by one User, the Lens (FR-LE-12). */
  lensOf: string | null;
  /** The Lens this query is used as, when "Open in Query" made it (DEC-LE-18). */
  forLens: string | null;
  /** The Collection whose "New Lens" started it (DEC-UX-123). */
  forCollection: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt: Date | null;
}

/** A query in the panel of Query: one item per query, with how many runs (DEC-UX-74). */
export interface QueryItem extends Pick<Query, 'id' | 'name' | 'ownerName' | 'kind' | 'lensOf' | 'createdAt' | 'lastRunAt'> {
  resources: Pick<NamedResource, 'id' | 'displayName'>[];
  runs: number;
}

/** A query on a Resource, as its tab History lists it (FR-SR-44): its last run and what that read. */
export interface QueryOnResource extends Pick<Query, 'id' | 'name' | 'ownerId' | 'ownerName' | 'kind' | 'lensOf' | 'lastRunAt'> {
  runs: number;
  lastRead: number | null;
  lastEstimate: number;
  lastState: RunState;
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
  /** A run the User asked for, or the read of the values of the choices of a Preview (DEC-SR-40). */
  purpose: RunPurpose;
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
  forCollection?: string;
}

export interface Queries {
  create(fields: NewQuery): Promise<Query>;
  /** The queries of the User, or with all, everyone's (DEC-LN-01): the last run or made first. */
  list(viewer: Viewer, all: boolean): Promise<QueryItem[]>;
  get(id: string): Promise<Query | undefined>;
  update(id: string, fields: Partial<Pick<Query, 'name' | 'question' | 'sql' | 'parameters'>>): Promise<Query | undefined>;
  /** The previews of a Resource by this User, made the first time they are asked for (FR-SR-38). */
  previewFor(owner: Viewer, resource: NamedResource, name: string): Promise<Query>;
  /** The previews of a Resource by this User, if there are. */
  previewOf(owner: Viewer, resourceId: string): Promise<Query | undefined>;
  /**
   * The query of this User used as a Lens, made from its SQL and Parameters the first time they open it in
   * Query (DEC-LE-18); `created` says whether it is new.
   */
  forLens(owner: Viewer, lens: { id: string; name: string; question: string; resources: NamedResource[]; sql: string; parameters: Parameter[] }): Promise<{ query: Query; created: boolean }>;
  /** The runs of a Lens by this User, a query made the first time they run it (FR-LE-12). */
  lensFor(owner: Viewer, lens: { id: string; name: string; resources: NamedResource[]; sql: string }): Promise<Query>;
  /** Every query with a run on this Resource, its last run first (FR-SR-44). */
  on(resourceId: string): Promise<QueryOnResource[]>;
  /**
   * Starts a run: its number in its query and its Query ID (FR-LN-05). A read of values is numbered apart
   * and leaves the query as it is (DEC-SR-40).
   */
  startRun(fields: { query: Query; user: Viewer; sql: string; parameters: Parameter[]; estimatedBytes: number; approved: boolean; purpose?: RunPurpose }): Promise<Run>;
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

  const previewOf = (owner: Viewer, resourceId: string): Promise<Query | undefined> =>
    db.selectFrom('queries').selectAll().where('kind', '=', 'preview').where('ownerId', '=', owner.id).where('previewOf', '=', resourceId).executeTakeFirst();

  return {
    async create({ owner, name, question, resources, sql: text, parameters = [], startedFrom, forCollection }) {
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
          forCollection: forCollection ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async list(viewer, all) {
      const rows = await db
        .selectFrom('queries as q')
        .select(['q.id', 'q.name', 'q.ownerName', 'q.kind', 'q.lensOf', 'q.resources', 'q.createdAt', 'q.lastRunAt'])
        .select((eb) => eb.selectFrom('runs').whereRef('runs.queryId', '=', 'q.id').where('runs.purpose', '=', 'run').select(sql<string>`count(*)`.as('count')).as('runs'))
        .$if(!all, (query) => query.where('q.ownerId', '=', viewer.id))
        .orderBy(sql`coalesce(q.last_run_at, q.created_at)`, 'desc')
        .limit(200)
        .execute();
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        ownerName: row.ownerName,
        kind: row.kind,
        lensOf: row.lensOf,
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

    async previewFor(owner, resource, name) {
      const found = await previewOf(owner, resource.id);
      if (found) return found;
      // Two first previews at once: one of them makes it, the other finds it.
      await db
        .insertInto('queries')
        .values({ ownerId: owner.id, ownerName: owner.name, name, question: '', resources: JSON.stringify([resource]), sql: '', kind: 'preview', previewOf: resource.id })
        .onConflict((conflict) => conflict.columns(['ownerId', 'previewOf']).where('kind', '=', 'preview').doNothing())
        .execute();
      return (await previewOf(owner, resource.id)) as Query;
    },

    previewOf,

    async forLens(owner, lens) {
      const find = () => db.selectFrom('queries').selectAll().where('ownerId', '=', owner.id).where('forLens', '=', lens.id).executeTakeFirst();
      const found = await find();
      if (found) return { query: found, created: false };
      // Two at once: one of them makes it, the other finds it.
      const made = await db
        .insertInto('queries')
        .values({
          ownerId: owner.id,
          ownerName: owner.name,
          name: lens.name,
          question: lens.question,
          resources: JSON.stringify(lens.resources),
          sql: lens.sql,
          parameters: JSON.stringify(lens.parameters),
          forLens: lens.id,
        })
        .onConflict((conflict) => conflict.columns(['ownerId', 'forLens']).where('forLens', 'is not', null).doNothing())
        .returningAll()
        .executeTakeFirst();
      return made ? { query: made, created: true } : { query: (await find()) as Query, created: false };
    },

    async lensFor(owner, lens) {
      const find = () => db.selectFrom('queries').selectAll().where('kind', '=', 'lens').where('ownerId', '=', owner.id).where('lensOf', '=', lens.id).executeTakeFirst();
      const found = await find();
      // A new version of the Lens, or a new name, is what its next run is of (FR-LE-16).
      if (found && found.name === lens.name && found.sql === lens.sql && JSON.stringify(found.resources) === JSON.stringify(lens.resources)) return found;
      if (found) {
        return db
          .updateTable('queries')
          .set({ name: lens.name, sql: lens.sql, resources: JSON.stringify(lens.resources), updatedAt: new Date() })
          .where('id', '=', found.id)
          .returningAll()
          .executeTakeFirstOrThrow();
      }
      // Two first runs at once: one of them makes it, the other finds it.
      await db
        .insertInto('queries')
        .values({ ownerId: owner.id, ownerName: owner.name, name: lens.name, question: '', resources: JSON.stringify(lens.resources), sql: lens.sql, kind: 'lens', lensOf: lens.id })
        .onConflict((conflict) => conflict.columns(['ownerId', 'lensOf']).where('kind', '=', 'lens').doNothing())
        .execute();
      return (await find()) as Query;
    },

    async on(resourceId) {
      const rows = await db
        .selectFrom('queries as q')
        .innerJoin(
          (eb) =>
            eb
              .selectFrom('runs')
              .where('purpose', '=', 'run')
              .select(['queryId', sql<string>`count(*)`.as('runs'), sql<number>`max(number)`.as('last')])
              .groupBy('queryId')
              .as('counted'),
          (join) => join.onRef('counted.queryId', '=', 'q.id'),
        )
        .innerJoin('runs as last', (join) => join.onRef('last.queryId', '=', 'q.id').onRef('last.number', '=', 'counted.last').on('last.purpose', '=', 'run'))
        .select(['q.id', 'q.name', 'q.ownerId', 'q.ownerName', 'q.kind', 'q.lensOf', 'q.lastRunAt', 'counted.runs', 'last.processedBytes', 'last.estimatedBytes', 'last.state'])
        .where(sql<boolean>`q.resources @> ${JSON.stringify([{ id: resourceId }])}::jsonb`)
        .orderBy('q.lastRunAt', 'desc')
        .limit(200)
        .execute();
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        ownerId: row.ownerId,
        ownerName: row.ownerName,
        kind: row.kind,
        lensOf: row.lensOf,
        lastRunAt: row.lastRunAt,
        runs: Number(row.runs),
        lastRead: row.processedBytes === null ? null : Number(row.processedBytes),
        lastEstimate: Number(row.estimatedBytes),
        lastState: row.state,
      }));
    },

    async startRun({ query, user, sql: text, parameters, estimatedBytes, approved, purpose = 'run' }) {
      for (let attempt = 0; ; attempt += 1) {
        try {
          return await db.transaction().execute(async (trx) => {
            // One run at a time takes the next number of its query.
            await trx.selectFrom('queries').select('id').where('id', '=', query.id).forUpdate().executeTakeFirstOrThrow();
            const last = await trx
              .selectFrom('runs')
              .select(sql<number>`coalesce(max(number), 0)`.as('number'))
              .where('queryId', '=', query.id)
              .where('purpose', '=', purpose)
              .executeTakeFirstOrThrow();
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
                purpose,
                resources: JSON.stringify(query.resources),
                estimatedBytes,
                approved,
              })
              .returningAll()
              .executeTakeFirstOrThrow();
            if (purpose === 'values') return runOf(row as RunRow);
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
      const row = await db.selectFrom('runs').selectAll().where('queryId', '=', queryId).where('purpose', '=', 'run').orderBy('number', 'desc').limit(1).executeTakeFirst();
      return row ? runOf(row as RunRow) : undefined;
    },

    async runs(queryId, { before, limit }) {
      const rows = await db
        .selectFrom('runs')
        .selectAll()
        .where('queryId', '=', queryId)
        .where('purpose', '=', 'run')
        .$if(before !== undefined, (query) => query.where('number', '<', before as number))
        .orderBy('number', 'desc')
        .limit(limit)
        .execute();
      return rows.map((row) => runOf(row as RunRow));
    },

    async runCount(queryId) {
      const row = await db.selectFrom('runs').select(sql<string>`count(*)`.as('count')).where('queryId', '=', queryId).where('purpose', '=', 'run').executeTakeFirstOrThrow();
      return Number(row.count);
    },
  };
}

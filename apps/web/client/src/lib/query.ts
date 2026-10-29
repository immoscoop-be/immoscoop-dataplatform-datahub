import { createCall, Refused } from './api.js';
import type { Config } from './config.js';
import type { Session } from './session.js';

/** A field of a Resource of a query, as the editor suggests it (DEC-UX-115). */
export interface QueryField {
  name: string;
  dataType: string | null;
  description: string;
  businessDescription: string;
}

/** A Resource of a query, as the User may see it now; or only its name, when they no longer may. */
export type QueryResource =
  | {
      visible: true;
      id: string;
      key: string;
      displayName: string;
      collectionId: string | null;
      level: number;
      deprecated: boolean;
      partition: { field: string; unit: string | null } | null;
      clusterBy: string[];
      partitionFilter: 'none' | 'dataHub' | 'bigQuery';
      fields: QueryField[];
    }
  | { visible: false; id: string; displayName: string };

/** A query in the panel of Query: one item per query (DEC-UX-74). */
export interface QueryItem {
  id: string;
  name: string;
  ownerName: string;
  resources: { id: string; displayName: string }[];
  runs: number;
  createdAt: string;
  lastRunAt: string | null;
}

export interface ResultColumn {
  name: string;
  type: string;
}

/** A run of a query, a line of the Query Log (DEC-LN-01). */
export interface Run {
  /** Its Query ID, such as q-20261029-4c2e1a (FR-LN-06). */
  ref: string;
  number: number;
  state: 'running' | 'done' | 'failed';
  error: string | null;
  userName: string;
  estimatedBytes: number;
  approved: boolean;
  processedBytes: number | null;
  billedBytes: number | null;
  partitions: number | null;
  rowCount: number | null;
  columns: ResultColumn[] | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface Query {
  id: string;
  name: string;
  question: string;
  sql: string;
  ownerName: string;
  /** Whether the User made it: only they write and run it. */
  mine: boolean;
  createdAt: string;
  lastRunAt: string | null;
  resources: QueryResource[];
  lastRun: Run | null;
}

/** A page of a result: 100 rows of the same run (FR-SR-51). */
export interface Page {
  number: number;
  size: number;
  totalRows: number;
  columns: ResultColumn[];
  rows: (string | null)[][];
}

export type Problem =
  | { kind: 'empty' }
  | { kind: 'notVisible'; resource: { id: string; displayName: string } }
  | { kind: 'outside'; name: string; start: number | null; end: number | null }
  | { kind: 'notSelect'; statementType: string }
  /** With the SQL that adds the filter, where Data Hub can tell where it goes (DEC-SR-35). */
  | { kind: 'filterRequired'; resource: { id: string; displayName: string }; column: string; fix: string | null }
  | { kind: 'invalid'; message: string };

export interface Warning {
  kind: 'noPartitionFilter';
  resource: { id: string; displayName: string };
  column: string;
  fix: string | null;
  /** What it reads with that filter (FR-SR-40). */
  bytesWithFilter: number | null;
}

/** The Pre-flight of a query (FR-SR-36, TR-SR-16). */
export interface Preflight {
  runnable: boolean;
  bytes: number | null;
  range: 'free' | 'approve' | 'request' | null;
  partitions: number | null;
  problems: Problem[];
  warnings: Warning[];
  thresholds: { approve: number; request: number };
}

/** What a run came to: its result, or why it did not run. */
export type RunOutcome =
  | { kind: 'ran'; run: Run; page: Page }
  /** The Pre-flight changed: it cannot run, or needs approval, or goes to the Data Team. */
  | { kind: 'refused'; preflight: Preflight }
  /** BigQuery refused it, in its own words; the run is kept as failed. */
  | { kind: 'failed'; message: string; run: Run | null };

/** query's routes (TR-SR-15 to TR-SR-17), with the Access Token of the User. */
export function createQuery(config: Config, session: Pick<Session, 'accessToken'>, request?: typeof fetch) {
  const call = createCall('query', config.queryUrl, session, request);
  const query = (id: string) => `/queries/${encodeURIComponent(id)}`;

  return {
    /** The queries of the User, or everyone's for the Data Team. */
    async list(all = false): Promise<QueryItem[]> {
      return ((await (await call(all ? '/queries?all=true' : '/queries')).json()) as { queries: QueryItem[] }).queries;
    },
    async create(fields: { name: string; question: string; resources: readonly string[] }): Promise<Query> {
      return ((await (await call('/queries', { method: 'POST', body: fields })).json()) as { query: Query }).query;
    },
    async get(id: string): Promise<Query> {
      return ((await (await call(query(id))).json()) as { query: Query }).query;
    },
    /** The Pre-flight of what is written; query keeps the SQL with it. */
    async preflight(id: string, sql: string): Promise<Preflight> {
      return ((await (await call(`${query(id)}/preflight`, { method: 'POST', body: { sql } })).json()) as { preflight: Preflight }).preflight;
    },
    async run(id: string, sql: string, approve: boolean): Promise<RunOutcome> {
      try {
        const body = (await (await call(`${query(id)}/runs`, { method: 'POST', body: { sql, approve } })).json()) as { run: Run; page: Page };
        return { kind: 'ran', ...body };
      } catch (error) {
        if (error instanceof Refused && error.status === 409 && error.body?.preflight) {
          return { kind: 'refused', preflight: error.body.preflight as Preflight };
        }
        if (error instanceof Refused && error.status === 422) {
          return { kind: 'failed', message: error.detail ?? '', run: (error.body?.run as Run | undefined) ?? null };
        }
        throw error;
      }
    },
    /** A page of a run, from the same job; null once BigQuery no longer keeps it (DEC-UX-99). */
    async rows(ref: string, page: number): Promise<Page | null> {
      try {
        return ((await (await call(`/runs/${encodeURIComponent(ref)}/rows?page=${page}`)).json()) as { page: Page }).page;
      } catch (error) {
        if (error instanceof Refused && error.status === 410) return null;
        throw error;
      }
    },
  };
}

export type QueryClient = ReturnType<typeof createQuery>;

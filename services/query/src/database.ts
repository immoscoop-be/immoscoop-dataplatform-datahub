import type { ColumnType, Generated } from 'kysely';
import type { Parameter } from './parameters.js';

/** A Parameter of a Lens: one of its query, with the name Users see (DEC-DH-11). */
export type LensParameterRow = Parameter & { label: string };

/** A timestamp: read as a Date, written as a Date or left to the database. */
type Timestamp = ColumnType<Date, Date | undefined, Date>;

/** A Resource of a query as it was named when the query was made, so that it can be named without catalogue. */
export interface NamedResource {
  /** Its ID in catalogue. */
  id: string;
  /** Its full name in BigQuery, `project.dataset.table`. */
  key: string;
  displayName: string;
}

/** A column of a result: its name and its type in BigQuery. */
export interface ResultColumn {
  name: string;
  type: string;
}

export type RunState = 'running' | 'done' | 'failed';

/** A query written in Query, the previews of a Resource by one User (FR-SR-38), or the runs of a Lens by one User (FR-LE-12). */
export type QueryKind = 'query' | 'preview' | 'lens';

/**
 * A Lens is published; waits for the Data Team while one run reads more than 1 GB (FR-LE-09); or stopped,
 * after a run with its defaults grew past 1 GB, until the Data Team accepts it again (DEC-LE-11).
 */
export type LensState = 'published' | 'waiting' | 'stopped' | 'refused';

/** What a Broken Lens misses, a table or a column, as BigQuery names it, and since when (FR-LE-17). */
export interface Missing {
  kind: 'table' | 'column';
  name: string;
  since: string;
}

/** The Log IDs of a Lens so far: Broken, and works again (FR-SR-52). */
/** Broken and works again (FR-SR-52); a Request on it accepted or refused by the Data Team (FR-LE-09). */
export type LensLogId = 'BRK-001' | 'BRK-002' | 'LEN-001' | 'LEN-002';

/** The range one run of a Lens was measured in (FR-LE-08, DEC-SR-29). */
export type LensRange = 'free' | 'approve' | 'request';

/** A run the User asked for, or the read of the values of the choices of a Preview (DEC-SR-40). */
export type RunPurpose = 'run' | 'values';

/** The tables of query, in camelCase (the columns are snake_case in Postgres). */
export interface QueryDatabase {
  /** One row per query: its name, its question and its Resources, and the SQL being written (DEC-UX-73). */
  queries: {
    id: Generated<string>;
    /** The fixed Google ID of who made it, and their name at that moment. */
    ownerId: string;
    ownerName: string;
    name: string;
    question: Generated<string>;
    resources: ColumnType<NamedResource[], string, string>;
    sql: Generated<string>;
    /** Its Parameters, with the values the next run takes (DEC-UX-71). */
    parameters: ColumnType<Parameter[], string | undefined, string>;
    /** The query it was started from with another set of Resources, and after which of its runs (DEC-UX-73). */
    startedFrom: string | null;
    startedAfterRun: number | null;
    kind: Generated<QueryKind>;
    /** For the previews of a Resource, its ID in catalogue. */
    previewOf: string | null;
    /** For the runs of a Lens by one User, the Lens. */
    lensOf: string | null;
    /** The Lens this query is used as, when "Open in Query" made it for someone of its Owner Unit (DEC-LE-18). */
    forLens: string | null;
    /** The Collection whose "New Lens" started it, offered first when it becomes a Lens (DEC-UX-123). */
    forCollection: string | null;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    lastRunAt: Date | null;
  };
  /** One row per Lens: a query with its Parameters, in a Collection (DEC-LE-06, DEC-CO-20). */
  lenses: {
    id: Generated<string>;
    collectionId: string;
    /** The query it was made from, used as this Lens (DEC-LE-03). */
    queryId: string;
    authorId: string;
    authorName: string;
    name: string;
    question: Generated<string>;
    /** What it shows, in a sentence or two (FR-LE-06). */
    shows: Generated<string>;
    /** What it does, step by step, as its author wrote it (DEC-LE-16). */
    steps: ColumnType<string[], string | undefined, string>;
    tags: ColumnType<string[], string | undefined, string>;
    sql: string;
    /** Its Parameters, each with the name Users see and its default (DEC-LE-01). */
    parameters: ColumnType<LensParameterRow[], string | undefined, string>;
    resources: ColumnType<NamedResource[], string, string>;
    version: Generated<number>;
    state: LensState;
    range: LensRange;
    /** What one run read when it was measured; a bigint, which pg reads as a string. */
    reads: ColumnType<string, number, number>;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    publishedAt: Date | null;
    stoppedAt: Date | null;
    stoppedReads: ColumnType<string | null, number | null, number | null>;
    broken: ColumnType<Missing | null, string | null, string | null>;
  };
  /** The Log of a Lens (FR-SR-52). */
  lensLog: {
    id: Generated<string>;
    lensId: string;
    logId: LensLogId;
    params: ColumnType<Record<string, string>, string, string>;
    at: Timestamp;
  };
  /** Every version of a Lens (FR-LE-16). */
  lensVersions: {
    lensId: string;
    version: number;
    sql: string;
    parameters: ColumnType<LensParameterRow[], string, string>;
    resources: ColumnType<NamedResource[], string, string>;
    range: LensRange;
    reads: ColumnType<string, number, number>;
    madeById: string;
    madeByName: string;
    fromQueryId: string;
    madeAt: Timestamp;
  };
  /** The Query Log: one row per run of a query (DEC-LN-01, FR-LN-05). */
  runs: {
    /** A bigint in Postgres, which pg reads as a string. */
    id: Generated<string>;
    queryId: string;
    number: number;
    /** The Query ID, such as q-20261029-4c2e1a. */
    queryRef: string;
    userId: string;
    userName: string;
    sql: string;
    /** The Parameters and the values it ran with. */
    parameters: ColumnType<Parameter[], string | undefined, string>;
    purpose: Generated<RunPurpose>;
    resources: ColumnType<NamedResource[], string, string>;
    /** What the Pre-flight said the run reads, at most; bigints, which pg reads as strings. */
    estimatedBytes: ColumnType<string, number, number>;
    approved: Generated<boolean>;
    jobId: string | null;
    jobLocation: string | null;
    state: Generated<RunState>;
    error: string | null;
    processedBytes: ColumnType<string | null, number | null, number | null>;
    billedBytes: ColumnType<string | null, number | null, number | null>;
    partitions: number | null;
    rowCount: ColumnType<string | null, number | null, number | null>;
    columns: ColumnType<ResultColumn[] | null, string | null, string | null>;
    startedAt: Timestamp;
    finishedAt: Date | null;
  };
}

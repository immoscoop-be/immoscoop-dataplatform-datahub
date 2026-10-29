import type { ColumnType, Generated } from 'kysely';

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
    createdAt: Timestamp;
    updatedAt: Timestamp;
    lastRunAt: Date | null;
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

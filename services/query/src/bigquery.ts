import { type AccessTokenSource, CLOUD_PLATFORM } from '@datahub/google';
import type { ResultColumn } from './database.js';

const API = 'https://bigquery.googleapis.com/bigquery/v2';

/** What a dry run of BigQuery tells about a query, without reading anything (FR-SR-36). */
export interface DryRun {
  /** `SELECT` for a query; anything else is a change or a script. */
  statementType: string;
  /** What the query reads at most: clustering can make the real read lower (FR-SR-40). */
  bytes: number;
  /** The tables it reads, `project.dataset.table`, as BigQuery resolves them. */
  referencedTables: string[];
  /** How many partitions it reads, where BigQuery says so. */
  partitions: number | null;
}

/** A page of a result: its columns, how many rows it has in all, and these rows. */
export interface Page {
  columns: ResultColumn[];
  totalRows: number;
  /** Each value as BigQuery gives it, as text; `null` is null, never empty (DEC-UX-72). */
  rows: (string | null)[][];
}

/** A run that finished: its job, whose result the next pages are read from (DEC-SR-30), and what it read. */
export interface Finished extends Page {
  jobId: string;
  location: string;
  processedBytes: number;
  billedBytes: number | null;
  partitions: number | null;
}

/** A value BigQuery fills in for an @name, sent apart from the SQL (DEC-UX-71). */
export interface QueryParameter {
  name: string;
  parameterType: { type: string; arrayType?: { type: string } };
  parameterValue: { value?: string; arrayValues?: { value: string }[] };
}

export interface RunOptions {
  /** BigQuery refuses to bill more than this (FR-SR-27). */
  maximumBytesBilled: number;
  /** Who ran it and its Query ID, on the job in BigQuery (FR-SR-27). */
  labels: Record<string, string>;
  /** The same request twice makes one job. */
  requestId: string;
  /** The rows of the first page. */
  pageSize: number;
  /** The values of its Parameters. */
  parameters?: QueryParameter[];
}

export interface BigQuery {
  dryRun(sql: string, parameters?: QueryParameter[]): Promise<DryRun>;
  run(sql: string, options: RunOptions): Promise<Finished>;
  /** A page of the result of a job; throws ResultExpired once BigQuery no longer keeps it (DEC-UX-99). */
  page(job: { jobId: string; location: string }, startIndex: number, maxResults: number): Promise<Page>;
}

/** BigQuery refused the query itself: its SQL, a table it cannot find, the bytes it may bill. */
export class BigQueryRefused extends Error {}
/** BigQuery did not answer, or refused Data Hub rather than the query: answered as 503, never guessed. */
export class BigQueryUnavailable extends Error {}
/** The result of the job is no longer kept, about a day after it ran (DEC-UX-99). */
export class ResultExpired extends Error {}

interface SchemaField {
  name: string;
  type: string;
  mode?: string;
  fields?: SchemaField[];
}

interface Cell {
  v: unknown;
}

interface QueryResults {
  jobReference?: { jobId: string; location: string };
  jobComplete?: boolean;
  schema?: { fields?: SchemaField[] };
  rows?: { f: Cell[] }[];
  totalRows?: string;
  totalBytesProcessed?: string;
  totalBytesBilled?: string;
}

/** The names BigQuery's API gives types, as Data Hub shows them: those of GoogleSQL. */
const TYPE_NAMES: Record<string, string> = { INTEGER: 'INT64', FLOAT: 'FLOAT64', BOOLEAN: 'BOOL', RECORD: 'STRUCT' };

const typeOf = (field: SchemaField) => {
  const type = TYPE_NAMES[field.type] ?? field.type;
  return field.mode === 'REPEATED' ? `ARRAY<${type}>` : type;
};

/** A timestamp, given in microseconds since 1970, as BigQuery writes it: `2026-10-29 08:12:00 UTC`. */
function timestamp(micros: string): string {
  const value = BigInt(micros);
  const date = new Date(Number(value / 1000n));
  const fraction = Number(((value % 1_000_000n) + 1_000_000n) % 1_000_000n);
  const [day, time] = date.toISOString().split('T') as [string, string];
  return `${day} ${time.slice(0, 8)}${fraction ? `.${String(fraction).padStart(6, '0').replace(/0+$/, '')}` : ''} UTC`;
}

/** A value of a row as text: a list or a record as JSON, a timestamp as BigQuery writes it. */
function plain(value: unknown, field: SchemaField): unknown {
  if (value === null || value === undefined) return null;
  if (field.mode === 'REPEATED') return (value as Cell[]).map((item) => plain(item.v, { ...field, mode: 'NULLABLE' }));
  if (field.type === 'RECORD' || field.type === 'STRUCT') {
    const cells = (value as { f: Cell[] }).f;
    return Object.fromEntries((field.fields ?? []).map((inner, i) => [inner.name, plain(cells[i]?.v, inner)]));
  }
  if (field.type === 'TIMESTAMP') return timestamp(String(value));
  return String(value);
}

export function rowsOf(results: QueryResults): Page {
  const fields = results.schema?.fields ?? [];
  return {
    columns: fields.map((field) => ({ name: field.name, type: typeOf(field) })),
    totalRows: Number(results.totalRows ?? 0),
    rows: (results.rows ?? []).map((row) =>
      fields.map((field, i) => {
        const value = plain(row.f[i]?.v, field);
        return value === null || typeof value === 'string' ? value : JSON.stringify(value);
      }),
    ),
  };
}

/** BigQuery over its REST API, as the service account of query, in the project and location of Data Hub. */
export function createBigQuery(options: { project: string; location: string; token: AccessTokenSource; request?: typeof fetch }): BigQuery {
  const request = options.request ?? fetch;
  const { project, location } = options;

  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, timeout = 60_000): Promise<T> {
    let response: Response;
    try {
      const token = await options.token([CLOUD_PLATFORM]);
      response = await request(`${API}/projects/${encodeURIComponent(project)}${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(timeout),
      });
    } catch (error) {
      throw new BigQueryUnavailable('BigQuery did not answer', { cause: error });
    }
    if (response.ok) return (await response.json()) as T;
    const detail = (await response.json().catch(() => ({}))) as { error?: { message?: string; errors?: { reason?: string }[] } };
    const message = detail.error?.message ?? `BigQuery answered ${response.status}`;
    const reasons = (detail.error?.errors ?? []).map((error) => error.reason);
    if (response.status === 404 && path.startsWith('/queries/')) throw new ResultExpired(message);
    // A query BigQuery refuses is the query's: its SQL, a table it cannot find, its bytes (BigQuery's own reasons).
    if (response.status === 400 || reasons.some((reason) => reason === 'invalidQuery' || reason === 'bytesBilledLimitExceeded' || reason === 'notFound')) {
      throw new BigQueryRefused(message);
    }
    throw new BigQueryUnavailable(`BigQuery answered ${response.status}: ${message}`);
  }

  // Only a query with values for its @names says they are named; without, BigQuery refuses any @name.
  const named = (parameters: QueryParameter[] = []) => (parameters.length > 0 ? { parameterMode: 'NAMED', queryParameters: parameters } : {});

  const results = (jobId: string, jobLocation: string, params: Record<string, string>) =>
    call<QueryResults>('GET', `/queries/${encodeURIComponent(jobId)}?${new URLSearchParams({ location: jobLocation, 'formatOptions.useInt64Timestamp': 'true', ...params })}`);

  return {
    async dryRun(sql, parameters) {
      const job = await call<{
        statistics?: { query?: { statementType?: string; totalBytesProcessed?: string; totalPartitionsProcessed?: string; referencedTables?: { projectId: string; datasetId: string; tableId: string }[] } };
      }>('POST', '/jobs', { configuration: { dryRun: true, query: { query: sql, useLegacySql: false, ...named(parameters) } }, jobReference: { projectId: project, location } }, 20_000);
      const stats = job.statistics?.query ?? {};
      return {
        statementType: stats.statementType ?? '',
        bytes: Number(stats.totalBytesProcessed ?? 0),
        referencedTables: (stats.referencedTables ?? []).map((table) => `${table.projectId}.${table.datasetId}.${table.tableId}`),
        partitions: stats.totalPartitionsProcessed === undefined ? null : Number(stats.totalPartitionsProcessed),
      };
    },

    async run(sql, run) {
      let answer = await call<QueryResults>(
        'POST',
        '/queries',
        {
          query: sql,
          useLegacySql: false,
          ...named(run.parameters),
          location,
          maxResults: run.pageSize,
          timeoutMs: 30_000,
          maximumBytesBilled: String(run.maximumBytesBilled),
          labels: run.labels,
          requestId: run.requestId,
          jobCreationMode: 'JOB_CREATION_REQUIRED',
          formatOptions: { useInt64Timestamp: true },
        },
        60_000,
      );
      const reference = answer.jobReference;
      if (!reference) throw new BigQueryUnavailable('BigQuery made no job for the query');
      // A long query: wait for it, as long as Cloud Run lets a request last.
      const until = Date.now() + 240_000;
      while (!answer.jobComplete) {
        if (Date.now() > until) throw new BigQueryUnavailable('The query did not finish in four minutes');
        answer = await results(reference.jobId, reference.location, { maxResults: String(run.pageSize), timeoutMs: '30000' });
      }
      // How many partitions it read is in the statistics of its job, where BigQuery keeps it.
      const job = await call<{ statistics?: { query?: { totalBytesBilled?: string; totalPartitionsProcessed?: string } } }>(
        'GET',
        `/jobs/${encodeURIComponent(reference.jobId)}?location=${encodeURIComponent(reference.location)}`,
      ).catch(() => ({ statistics: undefined }));
      const stats = job.statistics?.query;
      return {
        ...rowsOf(answer),
        jobId: reference.jobId,
        location: reference.location,
        processedBytes: Number(answer.totalBytesProcessed ?? 0),
        billedBytes: stats?.totalBytesBilled !== undefined ? Number(stats.totalBytesBilled) : answer.totalBytesBilled !== undefined ? Number(answer.totalBytesBilled) : null,
        partitions: stats?.totalPartitionsProcessed !== undefined ? Number(stats.totalPartitionsProcessed) : null,
      };
    },

    async page(job, startIndex, maxResults) {
      return rowsOf(await results(job.jobId, job.location, { startIndex: String(startIndex), maxResults: String(maxResults), timeoutMs: '10000' }));
    },
  };
}

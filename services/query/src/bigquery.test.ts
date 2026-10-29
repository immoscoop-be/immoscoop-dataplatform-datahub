import { describe, expect, it } from 'vitest';
import { BigQueryRefused, BigQueryUnavailable, createBigQuery, ResultExpired, rowsOf } from './bigquery.js';

interface Call {
  method: string;
  url: string;
  body: unknown;
  authorization: string | null;
}

/** BigQuery's REST API, stood in: each call gets the next answer, and is remembered. */
function fakeApi(answers: { status?: number; body: unknown }[]) {
  const calls: Call[] = [];
  const request = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      method: init?.method ?? 'GET',
      url: String(url),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      authorization: new Headers(init?.headers).get('authorization'),
    });
    const answer = answers.shift() ?? { status: 500, body: {} };
    return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200, headers: { 'content-type': 'application/json' } });
  };
  const bigquery = createBigQuery({ project: 'immoscoop-dataplatform', location: 'europe-west1', token: async () => 'token-1', request: request as typeof fetch });
  return { bigquery, calls };
}

const API = 'https://bigquery.googleapis.com/bigquery/v2/projects/immoscoop-dataplatform';

describe('a dry run', () => {
  it('asks BigQuery as Data Hub, in its location, and tells what the query reads', async () => {
    const { bigquery, calls } = fakeApi([
      {
        body: {
          statistics: {
            query: {
              statementType: 'SELECT',
              totalBytesProcessed: '84000000',
              referencedTables: [{ projectId: 'immoscoop-dataplatform', datasetId: 'dbt_prod_stacks', tableId: 'weekly_lead_volume' }],
            },
          },
        },
      },
    ]);
    expect(await bigquery.dryRun('select 1')).toEqual({
      statementType: 'SELECT',
      bytes: 84_000_000,
      referencedTables: ['immoscoop-dataplatform.dbt_prod_stacks.weekly_lead_volume'],
      partitions: null,
    });
    expect(calls).toEqual([
      {
        method: 'POST',
        url: `${API}/jobs`,
        body: { configuration: { dryRun: true, query: { query: 'select 1', useLegacySql: false } }, jobReference: { projectId: 'immoscoop-dataplatform', location: 'europe-west1' } },
        authorization: 'Bearer token-1',
      },
    ]);
  });

  it('tells the partitions where BigQuery does', async () => {
    const { bigquery } = fakeApi([{ body: { statistics: { query: { statementType: 'SELECT', totalBytesProcessed: '1', totalPartitionsProcessed: '42' } } } }]);
    expect((await bigquery.dryRun('select 1')).partitions).toBe(42);
  });

  it('is refused for the query itself, and unavailable when BigQuery refuses Data Hub', async () => {
    const refused = fakeApi([{ status: 400, body: { error: { message: 'Syntax error: Unexpected end of script at [1:7]', errors: [{ reason: 'invalidQuery' }] } } }]);
    await expect(refused.bigquery.dryRun('select')).rejects.toThrow(new BigQueryRefused('Syntax error: Unexpected end of script at [1:7]'));
    const missing = fakeApi([{ status: 404, body: { error: { message: 'Not found: Table p:d.t was not found in location europe-west1', errors: [{ reason: 'notFound' }] } } }]);
    await expect(missing.bigquery.dryRun('select * from p.d.t')).rejects.toBeInstanceOf(BigQueryRefused);
    const denied = fakeApi([{ status: 403, body: { error: { message: 'Access Denied', errors: [{ reason: 'accessDenied' }] } } }]);
    await expect(denied.bigquery.dryRun('select 1')).rejects.toBeInstanceOf(BigQueryUnavailable);
  });
});

describe('a run', () => {
  const schema = { fields: [{ name: 'week_start', type: 'DATE' }, { name: 'leads', type: 'INTEGER' }] };

  it('runs with its byte limit and labels, waits for a long query, and reads what it read from its job (FR-SR-27)', async () => {
    const { bigquery, calls } = fakeApi([
      { body: { jobReference: { jobId: 'job_1', location: 'europe-west1' }, jobComplete: false } },
      { body: { jobReference: { jobId: 'job_1', location: 'europe-west1' }, jobComplete: true, schema, totalRows: '210', rows: [{ f: [{ v: '2026-10-19' }, { v: '413' }] }], totalBytesProcessed: '412000000' } },
      { body: { statistics: { query: { totalBytesBilled: '413138944', totalPartitionsProcessed: '42' } } } },
    ]);
    const finished = await bigquery.run('select 1', { maximumBytesBilled: 1_000_000_000, labels: { 'datahub-user': '108', 'datahub-query': 'q-20261029-4c2e1a' }, requestId: 'r-1', pageSize: 100 });
    expect(finished).toEqual({
      columns: [
        { name: 'week_start', type: 'DATE' },
        { name: 'leads', type: 'INT64' },
      ],
      totalRows: 210,
      rows: [['2026-10-19', '413']],
      jobId: 'job_1',
      location: 'europe-west1',
      processedBytes: 412_000_000,
      billedBytes: 413_138_944,
      partitions: 42,
    });
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: `${API}/queries`,
      body: {
        query: 'select 1',
        useLegacySql: false,
        location: 'europe-west1',
        maxResults: 100,
        maximumBytesBilled: '1000000000',
        labels: { 'datahub-user': '108', 'datahub-query': 'q-20261029-4c2e1a' },
        requestId: 'r-1',
        jobCreationMode: 'JOB_CREATION_REQUIRED',
        formatOptions: { useInt64Timestamp: true },
      },
    });
    expect(calls[1]?.url).toBe(`${API}/queries/job_1?location=europe-west1&formatOptions.useInt64Timestamp=true&maxResults=100&timeoutMs=30000`);
    expect(calls[2]?.url).toBe(`${API}/jobs/job_1?location=europe-west1`);
  });

  it('is refused when BigQuery refuses it, such as above its byte limit', async () => {
    const { bigquery } = fakeApi([{ status: 400, body: { error: { message: 'Query exceeded limit for bytes billed: 1000000000. 4800000000 or higher required.', errors: [{ reason: 'bytesBilledLimitExceeded' }] } } }]);
    await expect(bigquery.run('select 1', { maximumBytesBilled: 1, labels: {}, requestId: 'r', pageSize: 100 })).rejects.toBeInstanceOf(BigQueryRefused);
  });
});

describe('a page of a result (DEC-SR-30)', () => {
  it('is read from the job of its run, from a row on', async () => {
    const { bigquery, calls } = fakeApi([{ body: { jobComplete: true, schema: { fields: [{ name: 'n', type: 'INTEGER' }] }, totalRows: '210', rows: [{ f: [{ v: '101' }] }] } }]);
    expect(await bigquery.page({ jobId: 'job_1', location: 'europe-west1' }, 100, 100)).toEqual({ columns: [{ name: 'n', type: 'INT64' }], totalRows: 210, rows: [['101']] });
    expect(calls[0]?.url).toBe(`${API}/queries/job_1?location=europe-west1&formatOptions.useInt64Timestamp=true&startIndex=100&maxResults=100&timeoutMs=10000`);
  });

  it('is gone once BigQuery no longer keeps the result (DEC-UX-99)', async () => {
    const { bigquery } = fakeApi([{ status: 404, body: { error: { message: 'Not found: Table immoscoop-dataplatform:_abc.anon123', errors: [{ reason: 'notFound' }] } } }]);
    await expect(bigquery.page({ jobId: 'job_1', location: 'europe-west1' }, 0, 100)).rejects.toBeInstanceOf(ResultExpired);
  });
});

describe('the values of a row', () => {
  it('stay as BigQuery gives them, null stays null, a timestamp reads as in BigQuery, a list and a record as JSON', () => {
    const page = rowsOf({
      schema: {
        fields: [
          { name: 'at', type: 'TIMESTAMP' },
          { name: 'precise', type: 'TIMESTAMP' },
          { name: 'note', type: 'STRING' },
          { name: 'tags', type: 'STRING', mode: 'REPEATED' },
          { name: 'source', type: 'RECORD', fields: [{ name: 'name', type: 'STRING' }, { name: 'share', type: 'FLOAT' }] },
          { name: 'ok', type: 'BOOLEAN' },
        ],
      },
      totalRows: '1',
      rows: [
        {
          f: [
            { v: '1761725520000000' },
            { v: '1761725520123450' },
            { v: null },
            { v: [{ v: 'a' }, { v: 'b' }] },
            { v: { f: [{ v: 'Website' }, { v: '74.8' }] } },
            { v: 'true' },
          ],
        },
      ],
    });
    expect(page.columns.map((column) => column.type)).toEqual(['TIMESTAMP', 'TIMESTAMP', 'STRING', 'ARRAY<STRING>', 'STRUCT', 'BOOL']);
    expect(page.rows).toEqual([['2025-10-29 08:12:00 UTC', '2025-10-29 08:12:00.12345 UTC', null, '["a","b"]', '{"name":"Website","share":"74.8"}', 'true']]);
  });
});

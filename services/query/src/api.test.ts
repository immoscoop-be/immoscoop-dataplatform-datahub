import { randomBytes } from 'node:crypto';
import { createTestIssuer, type TestIssuer } from '@datahub/auth/testing';
import { createDatabase, migrate, type Database } from '@datahub/db';
import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { label, parseQuery, parseRun } from './api.js';
import { buildApp } from './app.js';
import { type BigQuery, BigQueryRefused, type DryRun, type RunOptions, ResultExpired } from './bigquery.js';
import { type Catalogue, CatalogueUnavailable, type QueryResource } from './catalogue.js';
import type { QueryDatabase } from './database.js';
import { migrations } from './migrations/index.js';
import { createBeneath } from './preflight.js';
import { createQueries, queryRefOf } from './queries.js';

const url = process.env.DATAHUB_TEST_DATABASE_URL;
if (!url && process.env.CI) {
  throw new Error('DATAHUB_TEST_DATABASE_URL must be set in CI');
}

const PROJECT = 'immoscoop-dataplatform';
const WEEKLY: QueryResource = {
  id: '6f1c2b4e-8a1d-4c3e-9f20-1b2c3d4e5f60',
  key: `${PROJECT}.dbt_prod_stacks.weekly_lead_volume`,
  displayName: 'Weekly lead volume',
  collectionId: 'c-credit',
  level: 3,
  deprecated: false,
  partition: { field: 'week_start', unit: 'day' },
  clusterBy: ['lead_source'],
  partitionFilter: 'none',
  fields: [
    { name: 'week_start', dataType: 'DATE', description: 'The Monday of the week.', businessDescription: '' },
    { name: 'lead_source', dataType: 'STRING', description: 'Source system code.', businessDescription: 'Where the lead came in.' },
  ],
};
const SOURCES: QueryResource = { ...WEEKLY, id: '7a2d3c5f-9b2e-4d4f-8a31-2c3d4e5f6a71', key: `${PROJECT}.dbt_prod_stacks.lead_sources`, displayName: 'Lead sources', partition: null, clusterBy: [] };
const SECRET: QueryResource = { ...SOURCES, id: '8b3e4d6a-0c3f-4e5a-9b42-3d4e5f6a7b82', key: `${PROJECT}.dbt_prod_stacks.salaries`, displayName: 'Salaries' };

describe('the fields of a query, in a request', () => {
  it('need a name and its Resources to make one (FR-SR-45)', () => {
    expect(parseQuery({ name: ' Leads per source ', question: ' Which? ', resources: [WEEKLY.id] }, true)).toEqual({ name: 'Leads per source', question: 'Which?', resources: [WEEKLY.id] });
    expect(parseQuery({ resources: [WEEKLY.id] }, true)).toBe('The name has 1 to 120 characters.');
    expect(parseQuery({ name: 'x', resources: [] }, true)).toMatch(/1 to 10 Resources/);
    expect(parseQuery({ name: 'x', resources: [WEEKLY.id, WEEKLY.id] }, true)).toMatch(/each named once/);
    expect(parseQuery({ name: 'x', resources: [WEEKLY.id], sql: 'select 1' }, true)).toBe('A query has no field sql here.');
  });

  it('change at least one of its name, question and SQL, never its Resources (DEC-UX-73)', () => {
    expect(parseQuery({ sql: 'select 1' }, false)).toEqual({ sql: 'select 1' });
    expect(parseQuery({}, false)).toBe('Send at least one field to change.');
    expect(parseQuery({ resources: [SOURCES.id] }, false)).toBe('A query has no field resources here.');
    expect(parseQuery({ name: ' ' }, false)).toBe('The name has 1 to 120 characters.');
  });

  it('to run, are its SQL and whether its author approves it', () => {
    expect(parseRun({ sql: 'select 1' })).toEqual({ sql: 'select 1', approve: false });
    expect(parseRun({ sql: 'select 1', approve: 'yes' })).toBe('approve is true or false.');
    expect(parseRun({})).toMatch(/SQL/);
  });

  it('give BigQuery a label it accepts, and a Query ID of the day', () => {
    expect(label('Karel.Leys@Immoscoop.be')).toBe('karel_leys_immoscoop_be');
    expect(queryRefOf(new Date('2026-10-29T08:12:00Z'), () => '4c2e1a')).toBe('q-20261029-4c2e1a');
  });
});

/** A BigQuery that reads what the SQL says it reads: a comment `-- reads <bytes>` sets the bytes. */
function fakeBigQuery() {
  const runs: { sql: string; options: RunOptions }[] = [];
  const pages: { jobId: string; startIndex: number }[] = [];
  let refuseNext: string | null = null;
  let expired = false;
  const bigquery: BigQuery = {
    async dryRun(text): Promise<DryRun> {
      const bytes = Number(/-- reads (\d+)/.exec(text)?.[1] ?? 80_000_000);
      const referencedTables = [WEEKLY, SOURCES, SECRET].filter((resource) => text.includes(resource.key)).map((resource) => resource.key);
      return { statementType: 'SELECT', bytes, referencedTables, partitions: 42 };
    },
    async run(text, options) {
      runs.push({ sql: text, options });
      if (refuseNext) {
        const message = refuseNext;
        refuseNext = null;
        throw new BigQueryRefused(message);
      }
      return {
        jobId: `job_${runs.length}`,
        location: 'europe-west1',
        columns: [{ name: 'week_start', type: 'DATE' }, { name: 'leads', type: 'INT64' }],
        totalRows: 210,
        rows: [['2026-10-19', '413'], ['2026-10-19', null]],
        processedBytes: 79_000_000,
        billedBytes: 80_000_000,
        partitions: 42,
      };
    },
    async page(job, startIndex) {
      pages.push({ jobId: job.jobId, startIndex });
      if (expired) throw new ResultExpired('gone');
      return { columns: [{ name: 'week_start', type: 'DATE' }], totalRows: 210, rows: [['2026-10-12']] };
    },
  };
  return {
    bigquery,
    runs,
    pages,
    refuse: (message: string) => {
      refuseNext = message;
    },
    expire: () => {
      expired = true;
    },
  };
}

describe.skipIf(!url)('the routes of query (TR-SR-15, TR-SR-16)', () => {
  const schema = `query_api_${randomBytes(4).toString('hex')}`;
  let admin: Database<unknown>;
  let database: Database<QueryDatabase>;
  let issuer: TestIssuer;
  let app: FastifyInstance;
  const fake = fakeBigQuery();
  /** Which Resources each token may see, as catalogue would answer; null: catalogue does not answer. */
  const visible = new Map<string, string[] | null>();
  const catalogue: Catalogue = {
    async resource(id, authorization) {
      const ids = visible.get(authorization);
      if (ids === null) throw new CatalogueUnavailable('down');
      return ids?.includes(id) ? ([WEEKLY, SOURCES, SECRET].find((resource) => resource.id === id) ?? null) : null;
    },
  };
  let an: string;
  let karel: string;
  let dataTeam: string;

  beforeAll(async () => {
    admin = createDatabase<unknown>({ connectionString: url }, schema);
    await migrate({ db: admin.db, schema, migrations, serviceUser: 'postgres' });
    database = createDatabase<QueryDatabase>({ connectionString: url }, schema);
    issuer = await createTestIssuer();
    an = `Bearer ${await issuer.sign({ sub: '101', name: 'An Claes' })}`;
    karel = `Bearer ${await issuer.sign({ sub: '102', name: 'Karel Leys' })}`;
    dataTeam = `Bearer ${await issuer.sign({ sub: '103', name: 'Dirk Vos', roles: ['datateam'] })}`;
    visible.set(an, [WEEKLY.id, SOURCES.id]);
    visible.set(karel, [WEEKLY.id]);
    visible.set(dataTeam, [WEEKLY.id, SOURCES.id, SECRET.id]);
    app = await buildApp({
      verifier: issuer.verifier,
      logger: false,
      api: {
        queries: createQueries(database.db),
        catalogue,
        bigquery: fake.bigquery,
        beneath: createBeneath(fake.bigquery),
        project: PROJECT,
        thresholds: { approve: 100_000_000, request: 1_000_000_000 },
      },
    });
  });

  afterAll(async () => {
    await app?.close();
    await database?.close();
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(admin.db);
    await admin?.close();
  });

  const call = (authorization: string, method: 'GET' | 'POST' | 'PATCH', path: string, payload?: unknown) =>
    app.inject({ method, url: path, headers: { authorization }, ...(payload === undefined ? {} : { payload: payload as object }) });

  let id: string;

  it('makes a query on Resources the User sees, with SQL that filters on the partition column (FR-SR-45, FR-SR-46)', async () => {
    const made = await call(an, 'POST', '/queries', { name: 'Leads per source name', question: 'Which sources bring our leads?', resources: [WEEKLY.id, SOURCES.id] });
    expect(made.statusCode).toBe(201);
    const { query } = made.json();
    id = query.id;
    expect(query).toMatchObject({ name: 'Leads per source name', question: 'Which sources bring our leads?', mine: true, ownerName: 'An Claes', lastRun: null });
    expect(query.resources.map((resource: { displayName: string; visible: boolean }) => [resource.displayName, resource.visible])).toEqual([
      ['Weekly lead volume', true],
      ['Lead sources', true],
    ]);
    expect(query.sql).toContain('where week_start >= date_sub(current_date(), interval 28 day)');

    // A Resource the User does not see cannot be one of its Resources.
    expect((await call(karel, 'POST', '/queries', { name: 'Mine', resources: [WEEKLY.id, SOURCES.id] })).statusCode).toBe(400);
    expect((await call(an, 'POST', '/queries', { name: '', resources: [WEEKLY.id] })).statusCode).toBe(400);
  });

  it('lists the queries of the User, and everyone’s for the Data Team only (DEC-LN-01)', async () => {
    await call(karel, 'POST', '/queries', { name: 'Weekly only', resources: [WEEKLY.id] });
    const mine = (await call(an, 'GET', '/queries')).json().queries;
    expect(mine.map((query: { name: string }) => query.name)).toEqual(['Leads per source name']);
    expect(mine[0]).toMatchObject({ runs: 0, lastRunAt: null, resources: [{ id: WEEKLY.id, displayName: 'Weekly lead volume' }, { id: SOURCES.id, displayName: 'Lead sources' }] });
    expect((await call(an, 'GET', '/queries?all=true')).statusCode).toBe(403);
    const all = (await call(dataTeam, 'GET', '/queries?all=true')).json().queries;
    expect(all.map((query: { ownerName: string }) => query.ownerName).sort()).toEqual(['An Claes', 'Karel Leys']);
  });

  it('shows a query to who made it and to the Data Team; only who made it writes it', async () => {
    expect((await call(an, 'GET', `/queries/${id}`)).json().query).toMatchObject({ mine: true });
    expect((await call(dataTeam, 'GET', `/queries/${id}`)).json().query).toMatchObject({ mine: false, sql: expect.stringContaining('select') });
    expect((await call(karel, 'GET', `/queries/${id}`)).statusCode).toBe(404);
    expect((await call(karel, 'GET', '/queries/not-a-uuid')).statusCode).toBe(404);

    expect((await call(dataTeam, 'PATCH', `/queries/${id}`, { name: 'Taken' })).statusCode).toBe(403);
    expect((await call(karel, 'PATCH', `/queries/${id}`, { name: 'Taken' })).statusCode).toBe(404);
    const renamed = await call(an, 'PATCH', `/queries/${id}`, { name: 'Leads per source', question: 'Which sources, week by week?' });
    expect(renamed.json().query).toMatchObject({ name: 'Leads per source', question: 'Which sources, week by week?' });
  });

  const weekly = `select week_start, count(*) as leads from \`${WEEKLY.key}\` where week_start >= '2026-09-01' group by week_start`;

  it('gives the Pre-flight of what is written, and keeps it (FR-SR-36)', async () => {
    const checked = await call(an, 'POST', `/queries/${id}/preflight`, { sql: weekly });
    expect(checked.json().preflight).toMatchObject({ runnable: true, bytes: 80_000_000, range: 'free', partitions: 42, problems: [], warnings: [], thresholds: { approve: 100_000_000, request: 1_000_000_000 } });
    expect((await call(an, 'GET', `/queries/${id}`)).json().query.sql).toBe(weekly);

    const outside = await call(an, 'POST', `/queries/${id}/preflight`, { sql: `select * from \`${SECRET.key}\`` });
    expect(outside.json().preflight).toMatchObject({ runnable: false, problems: [{ kind: 'outside', name: SECRET.key }] });
    expect((await call(dataTeam, 'POST', `/queries/${id}/preflight`, { sql: weekly })).statusCode).toBe(403);
  });

  it('runs it with a byte limit and labels, as run 1 with its Query ID and first page (FR-SR-27, FR-LN-05)', async () => {
    const ran = await call(an, 'POST', `/queries/${id}/runs`, { sql: weekly });
    expect(ran.statusCode).toBe(201);
    const { run, page } = ran.json();
    expect(run).toMatchObject({ number: 1, state: 'done', userName: 'An Claes', estimatedBytes: 80_000_000, processedBytes: 79_000_000, billedBytes: 80_000_000, partitions: 42, rowCount: 210, approved: false });
    expect(run.ref).toMatch(/^q-\d{8}-[0-9a-f]{6}$/);
    expect(page).toEqual({ number: 1, size: 100, totalRows: 210, columns: [{ name: 'week_start', type: 'DATE' }, { name: 'leads', type: 'INT64' }], rows: [['2026-10-19', '413'], ['2026-10-19', null]] });
    expect(fake.runs.at(-1)?.options).toMatchObject({ maximumBytesBilled: 1_000_000_000, labels: { 'datahub-user': '101', 'datahub-query': run.ref }, pageSize: 100 });

    const listed = (await call(an, 'GET', '/queries')).json().queries[0];
    expect(listed).toMatchObject({ runs: 1, lastRunAt: expect.any(String) });
    expect((await call(an, 'GET', `/queries/${id}`)).json().query.lastRun).toMatchObject({ ref: run.ref, number: 1 });
  });

  it('asks its author to approve between the thresholds, and sends it to the Data Team above (DEC-SR-29)', async () => {
    const large = `${weekly} -- reads 840000000`;
    const unapproved = await call(an, 'POST', `/queries/${id}/runs`, { sql: large });
    expect(unapproved.statusCode).toBe(409);
    expect(unapproved.json()).toMatchObject({ error: 'approval_needed', preflight: { range: 'approve', bytes: 840_000_000 } });
    const approved = await call(an, 'POST', `/queries/${id}/runs`, { sql: large, approve: true });
    expect(approved.json().run).toMatchObject({ number: 2, approved: true });

    const huge = await call(an, 'POST', `/queries/${id}/runs`, { sql: `${weekly} -- reads 4800000000`, approve: true });
    expect(huge.json()).toMatchObject({ error: 'request_needed', preflight: { range: 'request' } });
  });

  it('does not run what the Pre-flight refuses, and keeps a run BigQuery refuses as failed', async () => {
    const outside = await call(an, 'POST', `/queries/${id}/runs`, { sql: `select * from \`${SECRET.key}\`` });
    expect(outside.json()).toMatchObject({ error: 'not_runnable', preflight: { problems: [{ kind: 'outside' }] } });

    fake.refuse('Division by zero: 1 / 0');
    const failed = await call(an, 'POST', `/queries/${id}/runs`, { sql: weekly });
    expect(failed.statusCode).toBe(422);
    expect(failed.json()).toMatchObject({ error: 'failed', message: 'Division by zero: 1 / 0', run: { number: 3, state: 'failed', error: 'Division by zero: 1 / 0' } });
    expect((await call(dataTeam, 'POST', `/queries/${id}/runs`, { sql: weekly })).statusCode).toBe(403);
  });

  it('reads the next pages from the same run, for who ran it only, until BigQuery no longer keeps them (DEC-SR-30, DEC-UX-99)', async () => {
    const first = await call(an, 'POST', `/queries/${id}/runs`, { sql: weekly });
    const { ref } = first.json().run;
    const job = `job_${fake.runs.length}`;
    const second = await call(an, 'GET', `/runs/${ref}/rows?page=2`);
    expect(second.json().page).toEqual({ number: 2, size: 100, totalRows: 210, columns: [{ name: 'week_start', type: 'DATE' }], rows: [['2026-10-12']] });
    expect(fake.pages.at(-1)).toEqual({ jobId: job, startIndex: 100 });
    expect((await call(an, 'GET', `/runs/${ref}/rows?page=4`)).statusCode).toBe(400);
    expect((await call(dataTeam, 'GET', `/runs/${ref}/rows?page=2`)).statusCode).toBe(404);
    fake.expire();
    expect((await call(an, 'GET', `/runs/${ref}/rows?page=3`)).json()).toMatchObject({ error: 'expired' });
  });

  it('keeps every run in the Query Log, with its SQL, who ran it, what it read and its job (DEC-LN-01)', async () => {
    const runs = await database.db.selectFrom('runs').selectAll().where('queryId', '=', id).orderBy('number').execute();
    expect(runs.map((run) => [run.number, run.state, run.userName, run.approved])).toEqual([
      [1, 'done', 'An Claes', false],
      [2, 'done', 'An Claes', true],
      [3, 'failed', 'An Claes', false],
      [4, 'done', 'An Claes', false],
    ]);
    expect(runs[0]).toMatchObject({ sql: weekly, jobId: 'job_1', jobLocation: 'europe-west1', processedBytes: '79000000', resources: [{ id: WEEKLY.id }, { id: SOURCES.id }] });
  });

  it('answers 503 when catalogue does not, rather than guess what the User may see', async () => {
    const down = `Bearer ${await issuer.sign({ sub: '101', name: 'An Claes' })}`;
    visible.set(down, null);
    expect((await call(down, 'POST', `/queries/${id}/preflight`, { sql: weekly })).statusCode).toBe(503);
    expect((await call(down, 'POST', `/queries/${id}/runs`, { sql: weekly })).statusCode).toBe(503);
  });
});

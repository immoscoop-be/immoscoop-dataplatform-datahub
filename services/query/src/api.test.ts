import { randomBytes } from 'node:crypto';
import { createTestIssuer, type TestIssuer } from '@datahub/auth/testing';
import { createDatabase, migrate, type Database } from '@datahub/db';
import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { label, parseQuery, parseRun } from './api.js';
import { buildApp } from './app.js';
import { type BigQuery, BigQueryRefused, type DryRun, type RunOptions, ResultExpired } from './bigquery.js';
import { type Catalogue, CatalogueUnavailable, type QueryRequest, type QueryResource } from './catalogue.js';
import type { QueryDatabase } from './database.js';
import { migrations } from './migrations/index.js';
import { createBeneath } from './preflight.js';
import { createStorage } from './preview.js';
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
  parameters: ['lead_source'],
};
const SOURCES: QueryResource = { ...WEEKLY, id: '7a2d3c5f-9b2e-4d4f-8a31-2c3d4e5f6a71', key: `${PROJECT}.dbt_prod_stacks.lead_sources`, displayName: 'Lead sources', partition: null, clusterBy: [] };
const SECRET: QueryResource = { ...SOURCES, id: '8b3e4d6a-0c3f-4e5a-9b42-3d4e5f6a7b82', key: `${PROJECT}.dbt_prod_stacks.salaries`, displayName: 'Salaries' };

describe('the fields of a query, in a request', () => {
  it('need a name and its Resources to make one (FR-SR-45)', () => {
    expect(parseQuery({ name: ' Leads per source ', question: ' Which? ', resources: [WEEKLY.id] }, true)).toEqual({ name: 'Leads per source', question: 'Which?', resources: [WEEKLY.id] });
    expect(parseQuery({ resources: [WEEKLY.id] }, true)).toBe('The name has 1 to 120 characters.');
    expect(parseQuery({ name: 'x', resources: [] }, true)).toMatch(/1 to 10 Resources/);
    expect(parseQuery({ name: 'x', resources: [WEEKLY.id, WEEKLY.id] }, true)).toMatch(/each named once/);
    expect(parseQuery({ name: 'x', resources: [WEEKLY.id], owner: '101' }, true)).toBe('A query has no field owner here.');
  });

  it('started from another, take its SQL and Parameters along (DEC-UX-73)', () => {
    const from = '2b1f3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
    const parameters = [{ name: 'dateFrom', kind: 'date', value: '2026-01-01' }];
    expect(parseQuery({ name: 'x', resources: [WEEKLY.id], sql: 'select 1', parameters, startedFrom: from }, true)).toEqual({ name: 'x', resources: [WEEKLY.id], sql: 'select 1', parameters, startedFrom: from });
    expect(parseQuery({ name: 'x', resources: [WEEKLY.id], startedFrom: 'leads' }, true)).toBe('A query is started from another by its ID.');
    expect(parseQuery({ parameters: [{ name: 'x', kind: 'date' }] }, false)).toMatch(/@x has a value/);
  });

  it('change at least one of its name, question and SQL, never its Resources (DEC-UX-73)', () => {
    expect(parseQuery({ sql: 'select 1' }, false)).toEqual({ sql: 'select 1' });
    expect(parseQuery({}, false)).toBe('Send at least one field to change.');
    expect(parseQuery({ resources: [SOURCES.id] }, false)).toBe('A query has no field resources here.');
    expect(parseQuery({ name: ' ' }, false)).toBe('The name has 1 to 120 characters.');
  });

  it('to run, are its SQL and whether its author approves it', () => {
    expect(parseRun({ sql: 'select 1' })).toEqual({ sql: 'select 1', parameters: [], approve: false, text: '' });
    expect(parseRun({ sql: 'select 1', approve: 'yes' })).toBe('approve is true or false.');
    expect(parseRun({})).toMatch(/SQL/);
    expect(parseRun({ sql: 'select 1', parameters: 'dateFrom' })).toMatch(/a list/);
    expect(parseRun({ sql: 'select 1', text: 'x'.repeat(501) })).toMatch(/at most 500/);
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
      // The values of the choices of a Preview: one row, a list per column.
      if (text.includes('array_agg')) {
        return { jobId: `job_${runs.length}`, location: 'europe-west1', columns: [{ name: 'lead_source', type: 'ARRAY<STRING>' }], totalRows: 1, rows: [['["app","website"]']], processedBytes: 1_000_000, billedBytes: 10_000_000, partitions: 4 };
      }
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
    // Weekly lead volume is partitioned on week_start, a partition each Monday; Lead sources is not partitioned.
    async table(key) {
      return key === WEEKLY.key
        ? { type: 'TABLE', bytes: 4_200_000_000, rows: 1_560, partitions: 312, partitionField: 'week_start', modifiedAt: '2026-10-28T06:00:00.000Z' }
        : { type: 'TABLE', bytes: 2_000_000, rows: 5, partitions: null, partitionField: null, modifiedAt: null };
    },
    async partitions(_key, limit) {
      return ['20261019', '20261012', '20261005', '20260928', '20260921'].slice(0, limit);
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
  /** The Google ID of each token, and the Requests catalogue keeps, newest first. */
  const writers = new Map<string, string>();
  const requests: QueryRequest[] = [];
  const catalogue: Catalogue = {
    async resource(id, authorization) {
      const ids = visible.get(authorization);
      if (ids === null) throw new CatalogueUnavailable('down');
      return ids?.includes(id) ? ([WEEKLY, SOURCES, SECRET].find((resource) => resource.id === id) ?? null) : null;
    },
    async requests(queryId, authorization) {
      if (visible.get(authorization) === null) throw new CatalogueUnavailable('down');
      return requests.filter((sent) => sent.writerId === writers.get(authorization) && (queryId === null || sent.subjectId === queryId));
    },
    async manages(collectionId, authorization) {
      // Mia is in the Owner Unit of Credit leads; the Data Team manages every Collection.
      return collectionId === 'c-credit' && (writers.get(authorization) === '104' || writers.get(authorization) === '103');
    },
    async sendRequest({ queryId, reads, text }, authorization) {
      const writerId = writers.get(authorization) ?? '';
      const waiting = requests.find((sent) => sent.subjectId === queryId && sent.writerId === writerId && sent.state === 'waiting');
      if (waiting) return waiting;
      const sent: QueryRequest = { id: `m-${requests.length + 1}`, subjectId: queryId, writerId, reads, text, state: 'waiting', createdAt: new Date().toISOString() };
      requests.unshift(sent);
      return sent;
    },
  };
  let an: string;
  let karel: string;
  let dataTeam: string;
  let mia: string;

  beforeAll(async () => {
    admin = createDatabase<unknown>({ connectionString: url }, schema);
    await migrate({ db: admin.db, schema, migrations, serviceUser: 'postgres' });
    database = createDatabase<QueryDatabase>({ connectionString: url }, schema);
    issuer = await createTestIssuer();
    an = `Bearer ${await issuer.sign({ sub: '101', name: 'An Claes' })}`;
    karel = `Bearer ${await issuer.sign({ sub: '102', name: 'Karel Leys' })}`;
    dataTeam = `Bearer ${await issuer.sign({ sub: '103', name: 'Dirk Vos', roles: ['datateam'] })}`;
    mia = `Bearer ${await issuer.sign({ sub: '104', name: 'Mia Peeters' })}`;
    writers.set(an, '101');
    writers.set(karel, '102');
    writers.set(dataTeam, '103');
    writers.set(mia, '104');
    visible.set(mia, [WEEKLY.id, SOURCES.id]);
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
        storage: createStorage(fake.bigquery, createBeneath(fake.bigquery)),
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

  const channel = { name: 'leadChannel', kind: 'choice', value: 'Form', list: ['Form', 'Phone'] };
  const dateFrom = { name: 'dateFrom', kind: 'date', value: 'DATE_TRUNC(CURRENT_DATE(), YEAR)' };
  const withParameters = `select week_start, count(*) as leads from \`${WEEKLY.key}\` where week_start >= @dateFrom and lead_source = @leadChannel group by week_start`;

  it('keeps the Parameters with the SQL, and names an @name that is not one (DEC-UX-71)', async () => {
    const missing = await call(an, 'POST', `/queries/${id}/preflight`, { sql: withParameters, parameters: [dateFrom] });
    expect(missing.json().preflight).toMatchObject({
      runnable: false,
      problems: [{ kind: 'undefinedParameter', name: 'leadChannel', start: withParameters.indexOf('@leadChannel'), suggestedKind: 'choice' }],
    });
    const spare = { name: 'spare', kind: 'number', value: '3' };
    const checked = await call(an, 'POST', `/queries/${id}/preflight`, { sql: withParameters, parameters: [dateFrom, channel, spare] });
    expect(checked.json().preflight).toMatchObject({ runnable: true, problems: [], unused: ['spare'] });
    expect((await call(an, 'GET', `/queries/${id}`)).json().query.parameters).toEqual([dateFrom, channel, spare]);
    expect((await call(an, 'POST', `/queries/${id}/preflight`, { sql: weekly, parameters: [{ name: 'x', kind: 'week' }] })).statusCode).toBe(400);
  });

  it('runs with its values apart and its functions in the SQL, and keeps them with the run (DEC-UX-118)', async () => {
    const ran = await call(an, 'POST', `/queries/${id}/runs`, { sql: withParameters, parameters: [dateFrom, channel] });
    expect(ran.statusCode).toBe(201);
    expect(ran.json().run).toMatchObject({ number: 5, sql: withParameters, parameters: [dateFrom, channel] });
    expect(fake.runs.at(-1)?.sql).toContain('where week_start >= (DATE_TRUNC(CURRENT_DATE(), YEAR)) and lead_source = @leadChannel');
    expect(fake.runs.at(-1)?.options.parameters).toEqual([{ name: 'leadChannel', parameterType: { type: 'STRING' }, parameterValue: { value: 'Form' } }]);
  });

  it('gives its history, newest first, a page at a time, with the SQL and values of each run (DEC-UX-74)', async () => {
    const history = (await call(an, 'GET', `/queries/${id}/runs?limit=2`)).json().runs;
    expect(history.map((run: { number: number }) => run.number)).toEqual([5, 4]);
    expect(history[0]).toMatchObject({ sql: withParameters, parameters: [dateFrom, channel] });
    expect((await call(an, 'GET', `/queries/${id}/runs?before=4`)).json().runs.map((run: { number: number }) => run.number)).toEqual([3, 2, 1]);
    expect((await call(dataTeam, 'GET', `/queries/${id}/runs?limit=1`)).json().runs).toHaveLength(1);
    expect((await call(karel, 'GET', `/queries/${id}/runs`)).statusCode).toBe(404);
    expect((await call(an, 'GET', `/queries/${id}/runs?limit=500`)).statusCode).toBe(400);
    expect((await call(an, 'GET', `/queries/${id}`)).json().query.runs).toBe(5);
  });

  it('sends a query above 1 GB to the Data Team, and runs it once they accept (MSG-QRY-01, DEC-SR-36)', async () => {
    const huge = `${weekly} -- reads 4800000000`;
    const small = await call(an, 'POST', `/queries/${id}/requests`, { sql: weekly, text: 'Please' });
    expect(small.json()).toMatchObject({ error: 'not_needed' });
    expect((await call(dataTeam, 'POST', `/queries/${id}/requests`, { sql: huge })).statusCode).toBe(403);

    const sent = await call(an, 'POST', `/queries/${id}/requests`, { sql: huge, text: ' For the five-year review. ' });
    expect(sent.statusCode).toBe(201);
    expect(sent.json().request).toMatchObject({ state: 'waiting', reads: 4_800_000_000, text: 'For the five-year review.', sentAt: expect.any(String) });
    expect((await call(an, 'GET', `/queries/${id}`)).json().query).toMatchObject({ sql: huge, request: { state: 'waiting' } });
    expect((await call(an, 'GET', '/queries')).json().queries[0]).toMatchObject({ id, request: { state: 'waiting' } });
    // The Data Team sees whose Request it is on the query, not on its own list.
    expect((await call(dataTeam, 'GET', `/queries/${id}`)).json().query.request).toBeNull();

    expect((await call(an, 'POST', `/queries/${id}/runs`, { sql: huge, approve: true })).json()).toMatchObject({ error: 'request_needed' });
    (requests[0] as QueryRequest).state = 'accepted';
    expect((await call(an, 'POST', `/queries/${id}/runs`, { sql: huge })).json()).toMatchObject({ error: 'approval_needed' });
    const ran = await call(an, 'POST', `/queries/${id}/runs`, { sql: huge, approve: true });
    expect(ran.statusCode).toBe(201);
    expect(fake.runs.at(-1)?.options.maximumBytesBilled).toBe(5_280_000_000);
  });

  it('starts a new query from another, with its SQL and Parameters, after its last run (DEC-UX-73)', async () => {
    const made = await call(an, 'POST', '/queries', { name: 'Leads per source, weekly only', resources: [WEEKLY.id], sql: withParameters, parameters: [dateFrom, channel], startedFrom: id });
    expect(made.statusCode).toBe(201);
    expect(made.json().query).toMatchObject({ sql: withParameters, parameters: [dateFrom, channel], startedFrom: { id, name: 'Leads per source', afterRun: 6 }, runs: 0, lastRun: null });
    expect((await call(karel, 'POST', '/queries', { name: 'Taken', resources: [WEEKLY.id], startedFrom: id })).statusCode).toBe(400);
  });

  it('tells the size and partitions of a Resource from BigQuery, without reading it (FR-SR-39)', async () => {
    const storage = (await call(an, 'GET', `/resources/${WEEKLY.id}/storage`)).json().storage;
    expect(storage).toEqual({ key: WEEKLY.key, bytes: 4_200_000_000, rows: 1_560, partitions: 312, modifiedAt: '2026-10-28T06:00:00.000Z', beneath: false });
    expect((await call(an, 'GET', `/resources/${SECRET.id}/storage`)).statusCode).toBe(404);
  });

  it('offers the choices of a Preview, their values read once and kept out of its history (DEC-SR-37, DEC-SR-39, DEC-SR-40)', async () => {
    const answer = (await call(an, 'POST', `/resources/${WEEKLY.id}/preview/choices`, { window: 4 })).json();
    expect(answer.window).toEqual({ field: 'week_start', unit: 'day', from: '2026-09-28', window: 4 });
    expect(answer.choices).toEqual([{ field: 'lead_source', dataType: 'STRING', role: 'cluster', kind: 'choice', values: ['app', 'website'] }]);
    expect(fake.runs.at(-1)?.sql).toContain("where `week_start` >= DATE '2026-09-28'");
    const previews = await database.db.selectFrom('queries').selectAll().where('kind', '=', 'preview').execute();
    expect(previews).toMatchObject([{ name: 'Preview · Weekly lead volume', ownerName: 'An Claes', previewOf: WEEKLY.id }]);
    const values = await database.db.selectFrom('runs').selectAll().where('queryId', '=', (previews[0] as { id: string }).id).execute();
    expect(values.map((run) => [run.purpose, run.number])).toEqual([['values', 1]]);
    expect((await call(an, 'POST', `/resources/${WEEKLY.id}/preview/choices`, { window: 5 })).statusCode).toBe(400);
  });

  it('runs a Preview as a run of the previews of the Resource, one item in the panel (FR-SR-38)', async () => {
    const checked = await call(an, 'POST', `/resources/${WEEKLY.id}/preview/preflight`, { window: 1, values: { lead_source: 'app' } });
    expect(checked.json()).toMatchObject({ preflight: { runnable: true, range: 'free' }, queryId: expect.any(String), request: null });
    const ran = await call(an, 'POST', `/resources/${WEEKLY.id}/preview/runs`, { window: 1, values: { lead_source: 'app' } });
    expect(ran.statusCode).toBe(201);
    expect(ran.json().run).toMatchObject({ number: 1, parameters: [{ name: 'lead_source', kind: 'choice', value: 'app' }] });
    expect(fake.runs.at(-1)?.sql).toBe(
      `select \`week_start\`, \`lead_source\`\nfrom \`${WEEKLY.key}\`\nwhere \`week_start\` >= DATE '2026-10-19'\n  and \`lead_source\` = @lead_source\norder by \`week_start\` desc\nlimit 1000`,
    );
    expect(fake.runs.at(-1)?.options.parameters).toEqual([{ name: 'lead_source', parameterType: { type: 'STRING' }, parameterValue: { value: 'app' } }]);
    expect((await call(an, 'POST', `/resources/${WEEKLY.id}/preview/runs`, { window: 4 })).json().run.number).toBe(2);
    const listed = (await call(an, 'GET', '/queries')).json().queries.find((item: { kind: string }) => item.kind === 'preview');
    expect(listed).toMatchObject({ name: 'Preview · Weekly lead volume', runs: 2 });
    // A value is a value of its column, never SQL.
    expect((await call(an, 'POST', `/resources/${WEEKLY.id}/preview/runs`, { window: 4, values: { week_start: '2026-10-19' } })).statusCode).toBe(400);
    expect((await call(karel, 'POST', `/resources/${SOURCES.id}/preview/runs`, { window: 4 })).statusCode).toBe(404);
  });

  it('lists the queries on a Resource to its Owner Unit and the Data Team only, who read them (DEC-SR-41, FR-SR-44)', async () => {
    const history = (await call(mia, 'GET', `/resources/${WEEKLY.id}/queries`)).json();
    // Only queries that ran: a query started from another and not run yet did not use it.
    expect(history.summary).toEqual({ queries: 2, lenses: 0, colleagues: 1 });
    expect(history.queries.map((query: { name: string; kind: string; mine: boolean }) => [query.name, query.kind, query.mine])).toEqual([
      ['Preview · Weekly lead volume', 'preview', false],
      ['Leads per source', 'query', false],
    ]);
    expect(history.queries[1]).toMatchObject({ runs: 6, lastRead: 79_000_000 });
    expect((await call(dataTeam, 'GET', `/resources/${WEEKLY.id}/queries`)).statusCode).toBe(200);
    expect((await call(an, 'GET', `/resources/${WEEKLY.id}/queries`)).statusCode).toBe(403);
    // The Owner Unit reads a query on what it owns, with its SQL, and does not run it (DEC-SR-31).
    expect((await call(mia, 'GET', `/queries/${id}`)).json().query).toMatchObject({ mine: false, sql: expect.stringContaining('select') });
    expect((await call(mia, 'GET', `/queries/${id}/runs?limit=1`)).statusCode).toBe(200);
    expect((await call(mia, 'POST', `/queries/${id}/runs`, { sql: weekly })).statusCode).toBe(403);
  });

  it('answers 503 when catalogue does not, rather than guess what the User may see', async () => {
    const down = `Bearer ${await issuer.sign({ sub: '101', name: 'An Claes' })}`;
    visible.set(down, null);
    expect((await call(down, 'POST', `/queries/${id}/preflight`, { sql: weekly })).statusCode).toBe(503);
    expect((await call(down, 'POST', `/queries/${id}/runs`, { sql: weekly })).statusCode).toBe(503);
    // The list still shows, without the labels of Requests.
    expect((await call(down, 'GET', '/queries')).json().queries[0]).toMatchObject({ request: null });
  });
});

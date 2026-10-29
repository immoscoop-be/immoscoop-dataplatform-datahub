import { randomBytes } from 'node:crypto';
import { TokenError } from '@datahub/auth';
import { createTestIssuer, type TestIssuer } from '@datahub/auth/testing';
import { createDatabase, migrate, type Database } from '@datahub/db';
import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { label, parseQuery, parseRun } from './api.js';
import { parseLens, valuesFor } from './lens-api.js';
import { createLenses } from './lenses.js';
import { buildApp } from './app.js';
import { type BigQuery, BigQueryRefused, type DryRun, type RunOptions, ResultExpired } from './bigquery.js';
import { type Catalogue, CatalogueUnavailable, type QueryRequest, type QueryResource, type SeenCollection } from './catalogue.js';
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
/** Credit leads, a public Collection of Mia's unit, and a private one of An. */
const CREDIT = '5d0c1b2a-3e4f-4a5b-8c6d-7e8f9a0b1c2d';
const AN_WORK = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const WEEKLY: QueryResource = {
  id: '6f1c2b4e-8a1d-4c3e-9f20-1b2c3d4e5f60',
  key: `${PROJECT}.dbt_prod_stacks.weekly_lead_volume`,
  displayName: 'Weekly lead volume',
  collectionId: CREDIT,
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

describe('the fields of a Lens, in a request', () => {
  const fields = { queryId: '2b1f3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', collectionId: CREDIT, name: ' Leads per source ' };

  it('need its query, a Collection and a name; the rest its author tells (FR-LE-06, DEC-LE-16)', () => {
    expect(parseLens({ ...fields, steps: [' Takes the weeks. ', '', 'Adds the sources.'], tags: ['#Leads', 'source', 'leads'], labels: { dateFrom: ' From ' } })).toEqual({
      ...fields,
      name: 'Leads per source',
      question: '',
      shows: '',
      steps: ['Takes the weeks.', 'Adds the sources.'],
      tags: ['leads', 'source'],
      labels: { dateFrom: 'From' },
      approve: false,
      text: '',
    });
    expect(parseLens({ ...fields, name: '' })).toBe('The name has 1 to 120 characters.');
    expect(parseLens({ ...fields, collectionId: 'c-credit' })).toBe('A Lens goes into a Collection, named by its ID.');
    expect(parseLens({ ...fields, tags: ['two words'] })).toMatch(/each a word/);
    expect(parseLens({ ...fields, labels: { dateFrom: '' } })).toMatch(/name Users see/);
    expect(parseLens({ ...fields, sql: 'select 1' })).toBe('A Lens has no field sql.');
  });

  it('to run, change only the values of its Parameters, never their kind or list (DEC-LE-01)', () => {
    const lens = {
      parameters: [
        { name: 'dateFrom', kind: 'date' as const, value: 'DATE_TRUNC(CURRENT_DATE(), YEAR)', label: 'From' },
        { name: 'leadChannel', kind: 'choice' as const, value: 'Form', list: ['Form', 'Phone'], label: 'Lead channel' },
      ],
    };
    expect(valuesFor(lens, undefined)).toEqual([
      { name: 'dateFrom', kind: 'date', value: 'DATE_TRUNC(CURRENT_DATE(), YEAR)' },
      { name: 'leadChannel', kind: 'choice', value: 'Form', list: ['Form', 'Phone'] },
    ]);
    expect(valuesFor(lens, { leadChannel: 'Phone', dateFrom: '2026-01-01' })).toEqual([
      { name: 'dateFrom', kind: 'date', value: '2026-01-01' },
      { name: 'leadChannel', kind: 'choice', value: 'Phone', list: ['Form', 'Phone'] },
    ]);
    expect(valuesFor(lens, { leadChannel: 'Mail' })).toBe('The value of @leadChannel is one of its list.');
    expect(valuesFor(lens, { region: 'Gent' })).toBe('This Lens has no Parameter region.');
  });
});

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

  it('started from "New Lens" on a Collection, remember it (DEC-UX-123)', () => {
    expect(parseQuery({ name: 'x', resources: [WEEKLY.id], forCollection: CREDIT.toUpperCase() }, true)).toEqual({ name: 'x', resources: [WEEKLY.id], forCollection: CREDIT });
    expect(parseQuery({ name: 'x', resources: [WEEKLY.id], forCollection: 'credit' }, true)).toBe('A query is started for a Collection by its ID.');
    expect(parseQuery({ forCollection: CREDIT }, false)).toBe('A query has no field forCollection here.');
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
  /** What every dry run reads instead, as data grows; and what BigQuery no longer finds, in its words. */
  let size: number | null = null;
  let gone: { text: string; message: string } | null = null;
  const bigquery: BigQuery = {
    async dryRun(text): Promise<DryRun> {
      if (gone && text.includes(gone.text)) throw new BigQueryRefused(gone.message);
      const bytes = size ?? Number(/-- reads (\d+)/.exec(text)?.[1] ?? 80_000_000);
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
    resize: (bytes: number | null) => {
      size = bytes;
    },
    lose: (missing: { text: string; message: string } | null) => {
      gone = missing;
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
  /** What query told catalogue about each Lens, and the decisions it recorded (DEC-PF-30). */
  const told = new Map<string, { state: string; name: string }>();
  const decisions: { requestId: string; outcome: string; text: string; decider: { id: string; name: string } }[] = [];
  /** The Lenses that grew into large, as query told catalogue (MSG-LEN-02). */
  const large: { lensId: string; reads: number; threshold: number }[] = [];
  const catalogue: Catalogue = {
    async resource(id, authorization) {
      const ids = visible.get(authorization);
      if (ids === null) throw new CatalogueUnavailable('down');
      return ids?.includes(id) ? ([WEEKLY, SOURCES, SECRET].find((resource) => resource.id === id) ?? null) : null;
    },
    async requests(queryId, authorization, subjectKind = 'query') {
      if (visible.get(authorization) === null) throw new CatalogueUnavailable('down');
      // The Data Team sees everyone's Requests on one Lens, Data Hub's own among them.
      const everyone = writers.get(authorization) === '103' && queryId !== null && subjectKind === 'lens';
      return requests.filter((sent) => (everyone || sent.writerId === writers.get(authorization)) && (queryId === null || sent.subjectId === queryId));
    },
    async keepLens(lens) {
      told.set(lens.id, { state: lens.state, name: lens.name });
    },
    async lensGrew({ lensId, reads }) {
      const waiting = requests.find((sent) => sent.subjectId === lensId && sent.type === 'MSG-LEN-03' && sent.state === 'waiting');
      if (waiting) return { id: waiting.id };
      const sent: QueryRequest = { id: `m-${requests.length + 1}`, type: 'MSG-LEN-03', subjectId: lensId, writerId: '', reads, text: '', state: 'waiting', decision: null, createdAt: new Date().toISOString() };
      requests.unshift(sent);
      return { id: sent.id };
    },
    async lensGrewLarge(fields) {
      large.push(fields);
    },
    async decideLensRequest(requestId, decision) {
      decisions.push({ requestId, ...decision });
      const sent = requests.find((one) => one.id === requestId);
      if (sent) {
        sent.state = decision.outcome;
        sent.decision = { outcome: decision.outcome, text: decision.text, writerName: decision.decider.name, at: new Date().toISOString() };
      }
    },
    async manages(collectionId, authorization) {
      // Mia is in the Owner Unit of Credit leads, An owns a private Collection; the Data Team manages every Collection.
      const who = writers.get(authorization);
      return (collectionId === CREDIT && (who === '104' || who === '103')) || (collectionId === AN_WORK && (who === '101' || who === '103'));
    },
    async collections(authorization) {
      const ids = visible.get(authorization);
      if (ids === null) throw new CatalogueUnavailable('down');
      const who = writers.get(authorization);
      const resources = [WEEKLY, SOURCES].filter((resource) => ids?.includes(resource.id)).map(({ id, displayName, level }) => ({ id, displayName, level }));
      const seen: SeenCollection[] = [{ id: CREDIT, name: 'Credit leads', canManage: who === '104' || who === '103', visibility: 'public', resources }];
      if (who === '101' || who === '103') seen.push({ id: AN_WORK, name: 'An’s lenses', canManage: true, visibility: 'private', resources: [] });
      return seen;
    },
    async sendLensRequest({ lensId, reads, text }, authorization) {
      const sent: QueryRequest = {
        id: `m-${requests.length + 1}`,
        type: 'MSG-LEN-01',
        subjectId: lensId,
        writerId: writers.get(authorization) ?? '',
        reads,
        text,
        state: 'waiting',
        decision: null,
        createdAt: new Date().toISOString(),
      };
      requests.unshift(sent);
      return sent;
    },
    async sendRequest({ queryId, reads, text }, authorization) {
      const writerId = writers.get(authorization) ?? '';
      const waiting = requests.find((sent) => sent.subjectId === queryId && sent.writerId === writerId && sent.state === 'waiting');
      if (waiting) return waiting;
      const sent: QueryRequest = { id: `m-${requests.length + 1}`, type: 'MSG-QRY-01', subjectId: queryId, writerId, reads, text, state: 'waiting', decision: null, createdAt: new Date().toISOString() };
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
        lenses: createLenses(database.db),
        catalogue,
        bigquery: fake.bigquery,
        beneath: createBeneath(fake.bigquery),
        project: PROJECT,
        thresholds: { approve: 100_000_000, request: 1_000_000_000 },
        storage: createStorage(fake.bigquery, createBeneath(fake.bigquery)),
        // The scheduler, by its Google ID token for query's own address (DEC-LE-20).
        checkers: {
          async verify(token) {
            if (token !== 'scheduler-id-token') throw new TokenError('Service token rejected: ERR_JWS_INVALID');
            return 'datahub-scheduler@project.iam.gserviceaccount.com';
          },
        },
      },
    });
  });

  afterAll(async () => {
    await app?.close();
    await database?.close();
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(admin.db);
    await admin?.close();
  });

  const call = (authorization: string, method: 'GET' | 'POST' | 'PATCH' | 'PUT', path: string, payload?: unknown) =>
    app.inject({ method, url: path, headers: { authorization }, ...(payload === undefined ? {} : { payload: payload as object }) });

  let id: string;

  it('makes a query on Resources the User sees, with SQL that filters on the partition column (FR-SR-45, FR-SR-46)', async () => {
    const made = await call(an, 'POST', '/queries', { name: 'Leads per source name', question: 'Which sources bring our leads?', resources: [WEEKLY.id, SOURCES.id] });
    expect(made.statusCode).toBe(201);
    const { query } = made.json();
    id = query.id;
    expect(query.forCollection).toBeNull();
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

  let lensId: string;
  let lensQuery: string;
  let largeLens: string;
  let hugeLens: string;
  let hugeQuery: string;

  it('makes a Lens of a query of its author, into a Collection they own, measured now (FR-LE-07, FR-LE-08, DEC-CO-20)', async () => {
    const made = await call(an, 'POST', '/queries', { name: 'Leads per source, week by week', resources: [WEEKLY.id, SOURCES.id], sql: withParameters, parameters: [dateFrom, channel], forCollection: AN_WORK });
    lensQuery = made.json().query.id;
    // Started from "New Lens" on An's Collection, which making it a Lens offers first (DEC-UX-123).
    expect(made.json().query.forCollection).toBe(AN_WORK);
    const fields = {
      queryId: lensQuery,
      collectionId: AN_WORK,
      name: 'Leads per source, week by week',
      question: 'Which sources bring our leads?',
      shows: 'How many leads each source brings, week by week.',
      steps: ['Takes the weekly lead volume from From.', 'Keeps one lead channel.'],
      tags: ['#leads', 'source'],
      labels: { dateFrom: 'From', leadChannel: 'Lead channel' },
    };
    expect((await call(an, 'POST', '/lenses', { ...fields, collectionId: CREDIT })).json()).toMatchObject({ error: 'invalid_request', message: 'A Lens goes into a Collection you own.' });
    expect((await call(karel, 'POST', '/lenses', fields)).statusCode).toBe(404);
    expect((await call(dataTeam, 'POST', '/lenses', fields)).statusCode).toBe(403);

    const lens = await call(an, 'POST', '/lenses', fields);
    expect(lens.statusCode).toBe(201);
    const body = lens.json().lens;
    lensId = body.id;
    expect(body).toMatchObject({
      name: 'Leads per source, week by week',
      state: 'published',
      range: 'free',
      reads: 80_000_000,
      level: 3,
      tags: ['leads', 'source'],
      steps: fields.steps,
      canManage: true,
      mine: true,
      fromQuery: { id: lensQuery, name: 'Leads per source, week by week' },
      parameters: [
        { ...dateFrom, label: 'From' },
        { ...channel, label: 'Lead channel' },
      ],
    });
    // No page shows the SQL of a Lens (FR-LE-14).
    expect(body.sql).toBeUndefined();
    expect((await call(an, 'POST', '/lenses', fields)).json()).toMatchObject({ error: 'already_a_lens', lens: { id: lensId } });
    // The query stays a query, and says it is used as the Lens (DEC-LE-03).
    expect((await call(an, 'GET', `/queries/${lensQuery}`)).json().query.lens).toMatchObject({ id: lensId, name: 'Leads per source, week by week', state: 'published' });
  });

  it('shows a Lens to who sees its Collection and may use every Resource beneath it (DEC-LE-09, DEC-CO-16)', async () => {
    const names = async (who: string) => (await call(who, 'GET', '/lenses')).json().lenses.map((lens: { name: string }) => lens.name);
    expect(await names(an)).toEqual(['Leads per source, week by week']);
    expect(await names(dataTeam)).toEqual(['Leads per source, week by week']);
    // Its Collection is private to An's unit.
    expect(await names(mia)).toEqual([]);
    expect((await call(mia, 'GET', `/lenses/${lensId}`)).statusCode).toBe(404);
    expect((await call(an, 'GET', '/lenses/nope')).statusCode).toBe(404);
  });

  it('runs a Lens only when a User runs it, with the values they chose, as a query in the Query Log (FR-LE-12, DEC-LE-12)', async () => {
    const checked = await call(an, 'POST', `/lenses/${lensId}/preflight`, { values: { leadChannel: 'Phone' } });
    expect(checked.json().preflight).toMatchObject({ runnable: true, range: 'free' });
    const ran = await call(an, 'POST', `/lenses/${lensId}/runs`, { values: { leadChannel: 'Phone' } });
    expect(ran.statusCode).toBe(201);
    expect(ran.json().run).toMatchObject({ number: 1 });
    expect(fake.runs.at(-1)?.options.parameters).toEqual([{ name: 'leadChannel', parameterType: { type: 'STRING' }, parameterValue: { value: 'Phone' } }]);
    expect((await call(an, 'POST', `/lenses/${lensId}/runs`, { values: { leadChannel: 'Mail' } })).statusCode).toBe(400);
    // Its runs are a query of the User, of the kind lens, whose SQL only the Data Team reads (FR-LE-14).
    const item = (await call(an, 'GET', '/queries')).json().queries.find((query: { kind: string }) => query.kind === 'lens');
    expect(item).toMatchObject({ name: 'Leads per source, week by week', lensOf: lensId, runs: 1 });
    expect((await call(an, 'GET', `/queries/${item.id}`)).statusCode).toBe(404);
    expect((await call(dataTeam, 'GET', `/queries/${item.id}`)).statusCode).toBe(200);
    expect((await call(dataTeam, 'POST', `/queries/${item.id}/runs`, { sql: weekly })).statusCode).toBe(403);
  });

  it('publishes a large Lens only when its author says so, and holds a very large one for the Data Team (FR-LE-08, FR-LE-09)', async () => {
    const make = async (sql: string, name: string) => (await call(mia, 'POST', '/queries', { name, resources: [WEEKLY.id], sql })).json().query.id as string;
    const large = await make(`${weekly} -- reads 840000000`, 'All weeks per source');
    const fields = { queryId: large, collectionId: CREDIT, name: 'All weeks per source' };
    expect((await call(mia, 'POST', '/lenses', fields)).json()).toMatchObject({ error: 'approval_needed', preflight: { range: 'approve' } });
    const published = (await call(mia, 'POST', '/lenses', { ...fields, approve: true })).json().lens;
    expect(published).toMatchObject({ state: 'published', range: 'approve', reads: 840_000_000 });
    largeLens = published.id;
    // Built on Weekly lead volume alone, in a public Collection: Karel sees it, not An's private one.
    expect((await call(karel, 'GET', '/lenses')).json().lenses.map((lens: { name: string }) => lens.name)).toEqual(['All weeks per source']);

    const huge = await make(`${weekly} -- reads 6200000000`, 'Every lead since 2019');
    hugeQuery = huge;
    const waiting = await call(mia, 'POST', '/lenses', { queryId: huge, collectionId: CREDIT, name: 'Every lead since 2019', text: 'For the yearly review.' });
    expect(waiting.json().lens).toMatchObject({ state: 'waiting', range: 'request', request: { state: 'waiting', text: 'For the yearly review.' } });
    const id = waiting.json().lens.id;
    hugeLens = id;
    // catalogue heard of it, to show its Messages to who sees it (DEC-PF-30).
    expect(told.get(id)).toEqual({ state: 'waiting', name: 'Every lead since 2019' });
    // Until the Data Team decides, only its author and the Data Team see it, and it does not run (DEC-LE-05).
    expect((await call(karel, 'GET', `/lenses/${id}`)).statusCode).toBe(404);
    expect((await call(dataTeam, 'GET', `/lenses/${id}`)).statusCode).toBe(200);
    expect((await call(mia, 'POST', `/lenses/${id}/runs`, {})).json()).toMatchObject({ error: 'waiting' });
    expect((await call(mia, 'POST', `/lenses/${id}/requests`, { text: 'Again.' })).statusCode).toBe(201);
    expect((await call(an, 'POST', `/lenses/${lensId}/requests`, {})).json()).toMatchObject({ error: 'not_needed' });
  });

  it('lists a Lens on a Resource as one row, made by its author, for its tab History (FR-SR-44)', async () => {
    const history = (await call(mia, 'GET', `/resources/${WEEKLY.id}/queries`)).json();
    expect(history.queries[0]).toMatchObject({ id: lensId, kind: 'lens', name: 'Leads per source, week by week', ownerName: 'An Claes', runs: 1 });
    expect(history.summary.lenses).toBe(1);
  });

  it('lets its Owner Unit change what a Lens tells, never its SQL (FR-LE-06, DEC-LE-16)', async () => {
    const changed = await call(an, 'PATCH', `/lenses/${lensId}`, { shows: 'Leads per source, a row a week.', labels: { leadChannel: 'Channel' } });
    expect(changed.statusCode).toBe(200);
    expect(changed.json().lens).toMatchObject({ shows: 'Leads per source, a row a week.', parameters: [{ label: 'From' }, { label: 'Channel' }] });
    expect((await call(an, 'PATCH', `/lenses/${lensId}`, { sql: weekly })).statusCode).toBe(400);
    expect((await call(an, 'PATCH', `/lenses/${lensId}`, {})).statusCode).toBe(400);
    // Karel sees Mia's Lens in Credit leads, but is not of its Owner Unit.
    expect((await call(karel, 'PATCH', `/lenses/${largeLens}`, { name: 'Mine now' })).statusCode).toBe(403);
    expect((await call(karel, 'PATCH', `/lenses/${lensId}`, { name: 'Mine now' })).statusCode).toBe(404);
  });

  it('updates a Lens from a query used as it, measured again, as its next version (FR-LE-16)', async () => {
    expect((await call(an, 'PATCH', `/queries/${lensQuery}`, { sql: `${withParameters} -- reads 90000000` })).statusCode).toBe(200);
    // Another query of An is not used as the Lens.
    expect((await call(an, 'PUT', `/lenses/${lensId}/version`, { queryId: id })).json()).toMatchObject({ error: 'invalid_request' });
    const updated = await call(an, 'PUT', `/lenses/${lensId}/version`, { queryId: lensQuery });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().lens).toMatchObject({
      version: 2,
      state: 'published',
      range: 'free',
      reads: 90_000_000,
      // A Parameter keeps the name Users see.
      parameters: [{ name: 'dateFrom', label: 'From' }, { name: 'leadChannel', label: 'Channel' }],
      versions: [
        { version: 2, madeByName: 'An Claes', fromQuery: 'Leads per source, week by week' },
        { version: 1, madeByName: 'An Claes', fromQuery: 'Leads per source, week by week' },
      ],
    });
    expect((await call(an, 'GET', `/queries/${lensQuery}`)).json().query.lens).toMatchObject({ id: lensId, version: 2, range: 'free', reads: 90_000_000 });
  });

  it('opens a Lens in Query: its own query for its author, a query of their own for anyone else of its Owner Unit (DEC-LE-18)', async () => {
    expect((await call(an, 'POST', `/lenses/${lensId}/query`)).json()).toEqual({ queryId: lensQuery });
    const opened = await call(dataTeam, 'POST', `/lenses/${lensId}/query`);
    expect(opened.statusCode).toBe(201);
    const own = opened.json().queryId as string;
    expect(own).not.toBe(lensQuery);
    // Opened again, it is the same query.
    const again = await call(dataTeam, 'POST', `/lenses/${lensId}/query`);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual({ queryId: own });
    const query = (await call(dataTeam, 'GET', `/queries/${own}`)).json().query;
    expect(query).toMatchObject({ name: 'Leads per source, week by week', mine: true, lens: { id: lensId }, sql: `${withParameters} -- reads 90000000` });
    // It is used as the Lens: it updates it, and makes no other Lens.
    expect((await call(dataTeam, 'POST', '/lenses', { queryId: own, collectionId: AN_WORK, name: 'Another' })).json()).toMatchObject({ error: 'already_a_lens', lens: { id: lensId } });
    expect((await call(dataTeam, 'PATCH', `/queries/${own}`, { sql: withParameters })).statusCode).toBe(200);
    const updated = (await call(dataTeam, 'PUT', `/lenses/${lensId}/version`, { queryId: own })).json().lens;
    expect(updated).toMatchObject({ version: 3, reads: 80_000_000, versions: [{ version: 3, madeByName: 'Dirk Vos', fromQuery: 'Leads per source, week by week' }, { version: 2 }, { version: 1 }] });
    // An updates it from their own query only, not from that of the Data Team.
    expect((await call(an, 'PUT', `/lenses/${lensId}/version`, { queryId: own })).statusCode).toBe(400);
    expect((await call(karel, 'POST', `/lenses/${largeLens}/query`)).statusCode).toBe(403);
  });

  it('measures a Lens for growth only by a run with its defaults, and stops it past 1 GB (DEC-LE-11, DEC-LE-19)', async () => {
    fake.resize(400_000_000);
    // Other values are that run alone.
    expect((await call(an, 'POST', `/lenses/${lensId}/preflight`, { values: { leadChannel: 'Phone' } })).json().preflight).toMatchObject({ range: 'approve' });
    expect((await call(an, 'GET', `/lenses/${lensId}`)).json().lens).toMatchObject({ range: 'free', state: 'published' });
    // With its defaults, it grows into large and keeps running; Data Hub tells its author (MSG-LEN-02).
    expect((await call(an, 'POST', `/lenses/${lensId}/preflight`, {})).json().preflight).toMatchObject({ range: 'approve' });
    expect((await call(an, 'GET', `/lenses/${lensId}`)).json().lens).toMatchObject({ range: 'approve', state: 'published' });
    expect(large.splice(0)).toEqual([{ lensId, reads: 400_000_000, threshold: 100_000_000 }]);

    fake.resize(1_500_000_000);
    expect((await call(an, 'POST', `/lenses/${lensId}/preflight`, { values: { leadChannel: 'Phone' } })).json().preflight).toMatchObject({ range: 'request' });
    const stopped = await call(an, 'POST', `/lenses/${lensId}/preflight`, {});
    expect(stopped.statusCode).toBe(409);
    expect(stopped.json()).toMatchObject({ error: 'stopped', stoppedReads: 1_500_000_000 });
    expect((await call(an, 'GET', `/lenses/${lensId}`)).json().lens).toMatchObject({ state: 'stopped', range: 'request', stoppedReads: 1_500_000_000 });
    expect((await call(an, 'POST', `/lenses/${lensId}/runs`, {})).json()).toMatchObject({ error: 'stopped' });
    // Who sees it still sees it, stopped.
    expect((await call(an, 'GET', '/lenses')).json().lenses.find((lens: { id: string }) => lens.id === lensId)).toMatchObject({ state: 'stopped' });

    // A new version that reads less brings it back.
    fake.resize(null);
    const back = (await call(an, 'PUT', `/lenses/${lensId}/version`, { queryId: lensQuery })).json().lens;
    expect(back).toMatchObject({ version: 4, state: 'published', range: 'free', stoppedAt: null, stoppedReads: null });
  });

  it('calls a Lens Broken when what it reads is not found, once, in its Log (FR-LE-17, FR-SR-52)', async () => {
    fake.lose({ text: 'lead_source', message: 'Unrecognized name: lead_source at [1:93]' });
    const broken = await call(an, 'POST', `/lenses/${lensId}/preflight`, {});
    expect(broken.statusCode).toBe(409);
    expect(broken.json()).toMatchObject({ error: 'broken', broken: { kind: 'column', name: 'lead_source' } });
    expect((await call(an, 'POST', `/lenses/${lensId}/runs`, { values: { leadChannel: 'Phone' } })).json()).toMatchObject({ error: 'broken' });
    expect((await call(an, 'GET', '/lenses')).json().lenses.find((lens: { id: string }) => lens.id === lensId).broken).toMatchObject({ kind: 'column', name: 'lead_source' });
    expect((await call(an, 'GET', `/lenses/${lensId}`)).json().lens.log).toMatchObject([{ logId: 'BRK-001', params: { missing: 'lead_source', run: '' } }]);

    fake.lose(null);
    expect((await call(an, 'POST', `/lenses/${lensId}/preflight`, {})).statusCode).toBe(200);
    const lens = (await call(an, 'GET', `/lenses/${lensId}`)).json().lens;
    expect(lens.broken).toBeNull();
    expect(lens.log).toMatchObject([{ logId: 'BRK-002', params: { restored: 'lead_source' } }, { logId: 'BRK-001' }]);
  });

  it('checks every Lens once a day with its defaults, for the scheduler only (DEC-LE-20)', async () => {
    const check = (authorization?: string) => app.inject({ method: 'POST', url: '/internal/lenses/check', headers: authorization ? { authorization } : {} });
    expect((await check()).statusCode).toBe(401);
    expect((await check(an)).statusCode).toBe(401);

    fake.lose({ text: 'weekly_lead_volume', message: `Not found: Table ${PROJECT}:dbt_prod_stacks.weekly_lead_volume was not found in location europe-west1` });
    // The waiting Lens of Mia is not checked: it does not run until the Data Team decides.
    expect((await check('Bearer scheduler-id-token')).json()).toEqual({ checked: 2, broken: 2, works: 0, grown: 0, stopped: 0 });
    expect((await call(mia, 'GET', `/lenses/${largeLens}`)).json().lens.broken).toMatchObject({ kind: 'table', name: `${PROJECT}.dbt_prod_stacks.weekly_lead_volume` });

    fake.lose(null);
    fake.resize(400_000_000);
    // An's Lens grows into large; Mia's was large already.
    expect((await check('Bearer scheduler-id-token')).json()).toEqual({ checked: 2, broken: 0, works: 2, grown: 1, stopped: 0 });
    expect((await call(an, 'GET', `/lenses/${lensId}`)).json().lens).toMatchObject({ range: 'approve', broken: null });
    expect(large.splice(0).map((grew) => grew.lensId)).toEqual([lensId]);
    fake.resize(null);
  });

  it('offers a new query the Lenses on its Resources, exactly these first, by the words of its question (FR-SR-47, FR-SR-48, DEC-SR-42)', async () => {
    const offered = async (who: string, question: string, resources = [WEEKLY.id]) =>
      (await call(who, 'GET', `/lenses/suggestions?resources=${resources.join(',')}&question=${encodeURIComponent(question)}`)).json();
    const found = await offered(an, 'Which sources bring the most leads?');
    // Mia's Lens reads Weekly lead volume alone; An's reads it and Lead sources. The waiting one is not offered.
    expect(found.exact.map((lens: { name: string }) => lens.name)).toEqual(['All weeks per source']);
    expect(found.more.map((lens: { name: string }) => lens.name)).toEqual(['Leads per source, week by week']);
    expect(found.exact[0]).toMatchObject({ shared: 1, marked: { name: [{ text: 'All weeks per ', shared: false }, { text: 'source', shared: true }] }, sharedTags: [] });
    // Its name, its question and its tags share "sources", "bring" and "leads", by their stem; "the" does not count.
    expect(found.more[0]).toMatchObject({ shared: 3, sharedTags: ['leads', 'source'] });
    expect(found.more[0].marked.question).toEqual([
      { text: 'Which ', shared: false },
      { text: 'sources', shared: true },
      { text: ' ', shared: false },
      { text: 'bring', shared: true },
      { text: ' our ', shared: false },
      { text: 'leads', shared: true },
      { text: '?', shared: false },
    ]);
    // Accents do not count, and a question without words shares none.
    expect((await offered(an, 'sóurces')).exact[0]).toMatchObject({ shared: 1 });
    expect((await offered(an, '')).exact[0]).toMatchObject({ shared: 0, marked: { name: [{ text: 'All weeks per source', shared: false }] } });
    // On both Resources, An's Lens is on exactly these.
    expect((await offered(an, '', [WEEKLY.id, SOURCES.id])).exact.map((lens: { name: string }) => lens.name)).toEqual(['Leads per source, week by week']);
    // Karel does not see An's private Collection.
    expect((await offered(karel, 'leads')).more).toEqual([]);
    // A Lens that does not run now is not offered (DEC-SR-43).
    const store = createLenses(database.db);
    await store.breaks(largeLens, { kind: 'column', name: 'lead_source' });
    expect((await offered(an, 'leads')).exact).toEqual([]);
    await store.works(largeLens);
    expect((await call(an, 'GET', '/lenses/suggestions?resources=nope')).statusCode).toBe(400);
  });

  it('finds the Lenses the User sees by the words of a question, for the start screen of Collections (DEC-UX-127)', async () => {
    const searched = async (who: string, question: string) => (await call(who, 'GET', `/lenses/search?question=${encodeURIComponent(question)}`)).json().lenses;
    const forAn = await searched(an, 'Which sources bring the leads?');
    expect(forAn.map((lens: { name: string }) => lens.name)).toEqual(['Leads per source, week by week', 'All weeks per source']);
    expect(forAn[0]).toMatchObject({ shared: 3, sharedTags: ['leads', 'source'] });
    // Mia sees her own waiting Lens, not An's private Collection.
    expect((await searched(mia, 'leads')).map((lens: { name: string }) => lens.name)).toEqual(['Every lead since 2019']);
    expect(await searched(an, 'the brokers of agencies')).toEqual([]);
  });

  it('tells when the User last ran each Lens, for the start screen of Collections (FR-CO-37)', async () => {
    const listed = (await call(an, 'GET', '/lenses')).json().lenses;
    expect(listed.find((lens: { id: string }) => lens.id === lensId).lastRunAt).toEqual(expect.any(String));
    expect(listed.find((lens: { id: string }) => lens.id === largeLens).lastRunAt).toBeNull();
  });

  it('answers 503 when catalogue does not, rather than guess what the User may see', async () => {
    const down = `Bearer ${await issuer.sign({ sub: '101', name: 'An Claes' })}`;
    visible.set(down, null);
    expect((await call(down, 'POST', `/queries/${id}/preflight`, { sql: weekly })).statusCode).toBe(503);
    expect((await call(down, 'POST', `/queries/${id}/runs`, { sql: weekly })).statusCode).toBe(503);
    // The list still shows, without the labels of Requests.
    expect((await call(down, 'GET', '/queries')).json().queries[0]).toMatchObject({ request: null });
  });

  it('lets the Data Team accept or refuse a Lens that waits, or one that stopped (FR-LE-09, DEC-UX-128)', async () => {
    expect((await call(karel, 'POST', `/lenses/${hugeLens}/decision`, { outcome: 'accepted' })).statusCode).toBe(403);
    expect((await call(dataTeam, 'POST', `/lenses/${hugeLens}/decision`, { outcome: 'refused' })).json()).toMatchObject({ message: 'A refusal needs a reason.' });
    expect((await call(dataTeam, 'POST', `/lenses/${hugeLens}/decision`, { outcome: 'maybe' })).statusCode).toBe(400);
    expect((await call(dataTeam, 'POST', `/lenses/${largeLens}/decision`, { outcome: 'accepted' })).json()).toMatchObject({ error: 'not_waiting' });

    // Refused: catalogue records the decision, the Lens stays unpublished and is no longer frozen.
    const refused = await call(dataTeam, 'POST', `/lenses/${hugeLens}/decision`, { outcome: 'refused', text: 'Give From a default.' });
    expect(refused.statusCode).toBe(200);
    expect(refused.json().lens).toMatchObject({ state: 'refused', request: { state: 'refused', decision: { outcome: 'refused', text: 'Give From a default.', writerName: 'Dirk Vos' } } });
    expect(decisions.at(-1)).toMatchObject({ outcome: 'refused', text: 'Give From a default.', decider: { id: '103', name: 'Dirk Vos' } });
    expect(told.get(hugeLens)?.state).toBe('refused');
    expect((await call(dataTeam, 'POST', `/lenses/${hugeLens}/decision`, { outcome: 'accepted' })).json()).toMatchObject({ error: 'not_waiting' });
    expect((await call(karel, 'GET', `/lenses/${hugeLens}`)).statusCode).toBe(404);
    const seen = (await call(mia, 'GET', `/lenses/${hugeLens}`)).json().lens;
    expect(seen).toMatchObject({ state: 'refused', log: [{ logId: 'LEN-002', params: { actor: 'Dirk Vos', reason: 'Give From a default.' } }] });
    expect((await call(mia, 'POST', `/lenses/${hugeLens}/runs`, {})).json()).toMatchObject({ error: 'refused' });
    expect((await call(mia, 'PATCH', `/lenses/${hugeLens}`, { question: 'Which leads came in since 2019?' })).statusCode).toBe(200);
    // Updated from its query to read less, it is published.
    expect((await call(mia, 'PATCH', `/queries/${hugeQuery}`, { sql: `${weekly} -- reads 80000000` })).statusCode).toBe(200);
    expect((await call(mia, 'PUT', `/lenses/${hugeLens}/version`, { queryId: hugeQuery })).json().lens).toMatchObject({ state: 'published', range: 'free' });

    // Stopped past 1 GB, Data Hub asks the Data Team (MSG-LEN-03); accepted, it runs again at that size.
    fake.resize(1_500_000_000);
    expect((await call(an, 'POST', `/lenses/${lensId}/preflight`, {})).json()).toMatchObject({ error: 'stopped' });
    expect(requests[0]).toMatchObject({ type: 'MSG-LEN-03', subjectId: lensId, writerId: '', state: 'waiting' });
    const accepted = await call(dataTeam, 'POST', `/lenses/${lensId}/decision`, { outcome: 'accepted', text: 'Once a quarter.' });
    expect(accepted.json().lens).toMatchObject({ state: 'published', range: 'request', stoppedAt: null });
    expect(accepted.json().lens.log[0]).toMatchObject({ logId: 'LEN-001', params: { actor: 'Dirk Vos' } });
    expect(decisions.at(-1)).toMatchObject({ requestId: requests[0]!.id, outcome: 'accepted' });
    expect((await call(an, 'POST', `/lenses/${lensId}/preflight`, {})).json().preflight).toMatchObject({ range: 'request' });
    fake.resize(null);
  });
});

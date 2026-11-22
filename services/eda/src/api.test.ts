import { randomBytes } from 'node:crypto';
import { createTestIssuer, type TestIssuer } from '@datahub/auth/testing';
import { type EdaView, isComplete, isNeeded, PROBES, probesFor, type ProbeKey, type ProbeRunAnswer, type ProbeRunRequest, type RunAnswer, type RunView } from '@datahub/contracts/eda';
import { createDatabase, type Database, migrate } from '@datahub/db';
import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseReading, parseRun, todayAt } from './api.js';

/** What a run on a selection answers: the EDA, and the run itself (OP-ED-12). */
type RanOnSelection = Extract<RunAnswer, { state: 'ran' }> & { run: RunView };
import { buildApp } from './app.js';
import { type Catalogue, type CatalogueResource, CatalogueUnavailable, sourceOf } from './catalogue.js';
import type { EdaDatabase } from './database.js';
import { createEdas } from './edas.js';
import { migrations } from './migrations/index.js';
import { type Query, QueryRefused, QueryUnavailable } from './query.js';
import { CREDIT, LEADS_ANSWER, WEEKLY_ANSWER } from './testing.js';
import type { NeededOf } from './view.js';

const url = process.env.DATAHUB_TEST_DATABASE_URL;
if (!url && process.env.CI) {
  throw new Error('DATAHUB_TEST_DATABASE_URL must be set in CI');
}

describe('the requests of eda', () => {
  it('take the fields, parameters and approval of a run, all optional', () => {
    expect(parseRun(undefined)).toEqual({ approve: false });
    expect(parseRun({ fields: ['a'], params: { width: 5 }, approve: true })).toEqual({ fields: ['a'], params: { width: 5 }, approve: true });
    expect(parseRun({ fields: 'a' })).toBe('fields is a list of the names of fields.');
    expect(parseRun({ params: [1] })).toBe('params is a JSON object.');
    expect(parseRun({ approve: 'yes' })).toBe('approve is true or false.');
    expect(parseRun({ sql: 'select 1' })).toBe('A run has no field sql.');
    expect(parseRun([])).toBe('Send a JSON object.');
  });

  it('take the selection of rows a run runs on, of at most 10 conditions (OP-ED-12)', () => {
    const selection = { where: [{ kind: 'saysNothing', field: 'lead_channel' }] };
    expect(parseRun({ selection })).toEqual({ selection, approve: false });
    expect(parseRun({ selection: { where: [] } })).toEqual({ selection: { where: [] }, approve: false });
    expect(parseRun({ selection: 'lead_channel is null' })).toBe('selection is { where: [conditions] }.');
    expect(parseRun({ selection: { where: new Array(11).fill(selection.where[0]) } })).toBe('A selection holds at most 10 conditions.');
    expect(parseRun({ selection: { where: [{ kind: 'sql', field: 'lead_channel' }] } })).toBe('Condition 1 is saysNothing, equals or range, as its kind.');
  });

  it('take a reading of a subject as expected, known or a problem (FR-ED-11)', () => {
    expect(parseReading({ subject: '', reading: 'known' })).toEqual({ subject: '', reading: 'known' });
    expect(parseReading({ subject: 'lead_channel', reading: 'fine' })).toBe('reading is expected, known or problem.');
    expect(parseReading({ reading: 'known' })).toMatch(/subject is/);
    expect(parseReading({ subject: '', reading: 'known', by: 'me' })).toBe('A reading has no field by.');
  });

  it('take today in Brussels', () => {
    expect(todayAt(new Date('2026-11-21T22:30:00Z'))).toBe('2026-11-21');
    expect(todayAt(new Date('2026-11-21T23:30:00Z'))).toBe('2026-11-22');
  });
});

/** A Resource at 2 · Described: no EDA yet (FR-ED-02). */
const DRAFT: CatalogueResource = { ...WEEKLY_ANSWER, id: '8b3e4d6a-0c3f-4e5a-9b42-3d4e5f6a7b82', displayName: 'Draft leads', level: 2 };
/** A Resource at 3 · Confirmed whose grain is not recorded. */
const BARE: CatalogueResource = { ...WEEKLY_ANSWER, id: '9c4f5e7b-1d4a-4f6b-8c53-4e5f6a7b8c93', displayName: 'Lead sources', details: { ...WEEKLY_ANSWER.details, grain: [] } };

/** The answer of BigQuery to each EDA-Probe, every value as text, as query passes it on (TR-ED-04). */
const ROWS: Partial<Record<ProbeKey, Record<string, unknown>[]>> = {
  grainHolds: [{ row_count: '312', empty_grain: '0', grain_values: '312', on_one: '312', on_two: '0', on_three: '0', on_four_or_more: '0', rows_covered: '0', examples: 'null' }],
  nullsPerKeyField: [{ row_count: '1000', empty_0: '0', empty_1: '12', empty_2: '0', empty_3: '7' }],
  disguisedNulls: [{ row_count: '1000', says_0: '0', null_0: '0', says_1: '12', null_1: '12', says_2: '0', null_2: '0', says_3: '19', null_3: '7', found_3_0: '4', found_3_1: '8' }],
  volumeOverTime: [
    { date_index: '0', period_start: '2026-11-02', row_count: '2', measure_sum: '90' },
    { date_index: '0', period_start: '2026-11-09', row_count: '2', measure_sum: '110' },
    { date_index: '0', period_start: '2026-11-16', row_count: '1', measure_sum: '40' },
  ],
  distributionOfNumbers: [
    { field_index: '0', value_count: '310', low: '0', p25: '12', median: '20', p75: '41', p95: '108', high: '400', mean: '35', width: '10', tail_from: '110', start: '0', bins: '[{"bin":"0","bin_rows":"300"},{"bin":"-1","bin_rows":"10"}]' },
  ],
  dateRange: [{ first_0: '2021-01-04', last_0: '2026-11-16' }],
  distributionOfCategories: [
    { field_index: '0', total_weight: '1000', value_count: '3', empty_weight: '0', others_count: '0', others_weight: '0', small_count: '0', top: '[{"value":"website","weight":"600"},{"value":"app","weight":"300"},{"value":"partner","weight":"100"}]' },
    { field_index: '1', total_weight: '1000', value_count: '2', empty_weight: '120', others_count: '0', others_weight: '0', small_count: '0', top: '[{"value":"web","weight":"700"},{"value":"mobile","weight":"180"}]' },
  ],
};

/** As the contracts count, but only the EDA-Probes Data Hub runs: a model in which an EDA can become Explored (OP-ED-09). */
const runnableOnly: NeededOf = (resource, runs) => {
  const needed = probesFor(resource.modelType).filter((probe) => PROBES[probe].runs && isNeeded(probe, resource));
  return { total: needed.length, complete: needed.filter((probe) => isComplete(probe, resource, runs)).length };
};

describe.skipIf(!url)('the routes of eda (TR-ED-01)', () => {
  const schema = `eda_api_${randomBytes(4).toString('hex')}`;
  let admin: Database<unknown>;
  let database: Database<EdaDatabase>;
  let issuer: TestIssuer;
  let app: FastifyInstance;
  /** The same eda, but counting only the EDA-Probes Data Hub runs as needed. */
  let explorer: FastifyInstance;

  /** The Resources catalogue keeps, and which each token may see; while down, catalogue does not answer. */
  const answers = new Map([WEEKLY_ANSWER, DRAFT, BARE, LEADS_ANSWER].map((answer) => [answer.id, answer]));
  const visible = new Map<string, string[]>();
  let catalogueDown = false;
  /** The Resources catalogue was told are Explored; while deaf, it does not take it (TR-ED-05). */
  const told: string[] = [];
  let catalogueDeaf = false;
  const catalogue: Catalogue = {
    async resource(id, authorization) {
      if (catalogueDown) throw new CatalogueUnavailable('down');
      const answer = answers.get(id);
      return answer && visible.get(authorization)?.includes(id) ? sourceOf(answer) : null;
    },
    async collectionName(id) {
      return id === CREDIT.id ? CREDIT.name : null;
    },
    async seen(authorization) {
      if (catalogueDown) throw new CatalogueUnavailable('down');
      return [...answers.values()]
        .filter((answer) => visible.get(authorization)?.includes(answer.id))
        .map(({ id, displayName, level }) => ({ id, displayName, level, collection: CREDIT }));
    },
    async explored(resourceId) {
      if (catalogueDeaf) throw new CatalogueUnavailable('down');
      told.push(resourceId);
    },
  };

  /** What eda asked query to run, with whose token; what query answers next, once, instead of a run. */
  const asked: { resourceId: string; run: ProbeRunRequest; authorization: string }[] = [];
  let next: ProbeRunAnswer | 'down' | 'hidden' | null = null;
  const query: Query = {
    async run(resourceId, run, authorization) {
      asked.push({ resourceId, run, authorization });
      const instead = next;
      next = null;
      if (instead === 'down') throw new QueryUnavailable('down');
      if (instead === 'hidden') throw new QueryRefused(404, 'There is no such Resource, or you may not see it.');
      if (instead) return instead;
      return { state: 'ran', rows: ROWS[run.probe] ?? [], bytes: 1_200_000, runId: `q-20261121-${asked.length.toString(16).padStart(6, '0')}` };
    },
  };

  let dirk: string;
  let mia: string;
  let karel: string;

  beforeAll(async () => {
    admin = createDatabase<unknown>({ connectionString: url }, schema);
    await migrate({ db: admin.db, schema, migrations, serviceUser: 'postgres' });
    database = createDatabase<EdaDatabase>({ connectionString: url }, schema);
    issuer = await createTestIssuer();
    // Dirk and Mia are in Admin, which holds eda.use; Karel is a Business analyst, who does not (DEC-ED-25).
    dirk = `Bearer ${await issuer.sign({ sub: '103', name: 'Dirk Vos', as: 'admin' })}`;
    mia = `Bearer ${await issuer.sign({ sub: '104', name: 'Mia Peeters', as: 'admin' })}`;
    karel = `Bearer ${await issuer.sign({ sub: '102', name: 'Karel Leys' })}`;
    visible.set(dirk, [WEEKLY_ANSWER.id, DRAFT.id, BARE.id, LEADS_ANSWER.id]);
    visible.set(mia, [LEADS_ANSWER.id]);
    visible.set(karel, [WEEKLY_ANSWER.id]);
    const api = { edas: createEdas(database.db), catalogue, query, now: () => new Date('2026-11-21T10:00:00Z') };
    app = await buildApp({ verifier: issuer.verifier, logger: false, api });
    explorer = await buildApp({ verifier: issuer.verifier, logger: false, api: { ...api, needed: runnableOnly } });
  });

  afterAll(async () => {
    await app?.close();
    await explorer?.close();
    await database?.close();
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(admin.db);
    await admin?.close();
  });

  const call = (authorization: string, method: 'GET' | 'POST' | 'PUT', path: string, payload?: unknown, on: FastifyInstance = app) =>
    on.inject({ method, url: path, headers: { authorization }, ...(payload === undefined ? {} : { payload: payload as object }) });
  const edaOf = (id: string) => `/resources/${id}/eda`;
  const runOf = (id: string, probe: string) => `/resources/${id}/eda/probes/${probe}/runs`;
  const readingOf = (id: string, probe: string) => `/resources/${id}/eda/probes/${probe}/readings`;

  it('refuses every route to who may not explore Resources, naming eda.use (TR-ED-06)', async () => {
    for (const [method, path, payload] of [
      ['GET', '/edas'],
      ['POST', edaOf(WEEKLY_ANSWER.id)],
      ['GET', edaOf(WEEKLY_ANSWER.id)],
      ['POST', runOf(WEEKLY_ANSWER.id, 'grainHolds'), {}],
      ['PUT', readingOf(WEEKLY_ANSWER.id, 'grainHolds'), { subject: '', reading: 'known' }],
    ] as const) {
      const answer = await call(karel, method, path, payload);
      expect(answer.statusCode, `${method} ${path}`).toBe(403);
      expect(answer.json()).toMatchObject({ error: 'forbidden', permission: 'eda.use' });
    }
    expect((await app.inject({ url: '/edas' })).statusCode).toBe(401);
    expect(asked).toHaveLength(0);
  });

  it('starts an EDA from 3 · Confirmed, at most one per Resource, only on a Resource the User sees (FR-ED-02)', async () => {
    expect((await call(dirk, 'POST', edaOf('not-an-id'))).statusCode).toBe(404);
    expect((await call(mia, 'POST', edaOf(WEEKLY_ANSWER.id))).statusCode).toBe(404);
    const draft = await call(dirk, 'POST', edaOf(DRAFT.id));
    expect(draft.statusCode).toBe(422);
    expect(draft.json()).toMatchObject({ error: 'not_confirmed' });
    expect((await call(dirk, 'GET', edaOf(WEEKLY_ANSWER.id))).json()).toEqual({ error: 'not_found', message: 'This Resource has no EDA yet.' });

    const started = await call(dirk, 'POST', edaOf(WEEKLY_ANSWER.id));
    expect(started.statusCode).toBe(201);
    const view = started.json<EdaView>();
    expect(view).toMatchObject({
      resource: { id: WEEKLY_ANSWER.id, displayName: 'Weekly lead volume', modelType: 'aggregate', level: 3, collection: CREDIT },
      status: 'inProgress',
      startedBy: { id: '103', name: 'Dirk Vos' },
      exploredAt: null,
      needed: { total: 10, complete: 0 },
      next: 'nullsPerKeyField',
    });
    expect(view.resource.fields.map((field) => field.name)).toEqual(WEEKLY_ANSWER.fields.map((field) => field.name));
    expect(view.probes.every((probe) => !probe.added && probe.lastRun === null)).toBe(true);
    expect((await call(dirk, 'POST', edaOf(WEEKLY_ANSWER.id))).statusCode).toBe(409);
    expect((await call(dirk, 'GET', edaOf(WEEKLY_ANSWER.id))).json<EdaView>().startedAt).toBe(view.startedAt);
  });

  it('runs an EDA-Probe through query as the User, adds it, keeps its run and results, and answers the EDA (FR-ED-06, TR-ED-04)', async () => {
    const answer = await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'nullsPerKeyField'));
    expect(answer.statusCode).toBe(200);
    const ran = answer.json<RunAnswer>();
    expect(ran.state).toBe('ran');
    const last = asked.at(-1);
    expect(last).toMatchObject({ resourceId: WEEKLY_ANSWER.id, authorization: dirk, run: { probe: 'nullsPerKeyField', approve: false } });
    // The table by its full name in its own case, its partitions all kept, aggregates only.
    expect(last?.run.sql).toContain('from `immoscoop-dataplatform.dbt_prod_stacks.Weekly_Lead_Volume`');
    expect(last?.run.sql).toContain("where (`week_start` is null or `week_start` >= date '0001-01-01')");
    expect(last?.run.sql).toContain('countif(`lead_channel` is null) as empty_3');

    const eda = (ran as Extract<RunAnswer, { state: 'ran' }>).eda;
    const nulls = eda.probes.find((probe) => probe.key === 'nullsPerKeyField');
    expect(nulls).toMatchObject({ added: true, complete: true, fields: ['week_start', 'lead_source', 'lead_count', 'lead_channel'], params: {} });
    expect(nulls?.lastRun).toMatchObject({ ranBy: { id: '103', name: 'Dirk Vos' }, bytes: 1_200_000, fields: ['week_start', 'lead_source', 'lead_count', 'lead_channel'] });
    expect(nulls?.lastRun?.results.map((result) => [result.subject, result.reading, result.yours])).toEqual([
      ['week_start', 'expected', null],
      ['lead_source', 'look', null],
      ['lead_count', 'expected', null],
      ['lead_channel', 'judge', null],
    ]);
    expect(eda.needed).toEqual({ total: 10, complete: 1 });
    // Disguised nulls is still open on all four Key Fields, the most of what is missing (DEC-ED-16).
    expect(eda.next).toBe('disguisedNulls');
    const kept = await database.db.selectFrom('edaRuns').select(['queryRunId', 'bytes']).execute();
    expect(kept).toEqual([{ queryRunId: expect.stringMatching(/^q-20261121-[0-9a-f]{6}$/), bytes: '1200000' }]);
  });

  it('passes on what the Pre-flight asks, adding nothing, and runs once the User approves (FR-ED-06)', async () => {
    next = { state: 'approve', bytes: 300_000_000 };
    const approve = await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'grainHolds'), {});
    expect(approve.json()).toEqual({ state: 'approve', bytes: 300_000_000 });
    next = { state: 'refused', bytes: 3_000_000_000, reason: 'It reads 3 GB, more than one run of yours may read (1 GB), so it does not run.' };
    expect((await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'grainHolds'), {})).json()).toMatchObject({ state: 'refused', bytes: 3_000_000_000 });
    expect((await call(dirk, 'GET', edaOf(WEEKLY_ANSWER.id))).json<EdaView>().probes.find((probe) => probe.key === 'grainHolds')?.added).toBe(false);

    const ran = (await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'grainHolds'), { approve: true })).json<RunAnswer>();
    expect(asked.at(-1)?.run).toMatchObject({ probe: 'grainHolds', approve: true });
    expect(asked.at(-1)?.run.sql).toContain('group by 1, 2');
    expect(ran.state === 'ran' && ran.eda.probes.find((probe) => probe.key === 'grainHolds')?.lastRun?.results).toEqual([
      { subject: '', reading: 'expected', yours: null, data: { rows: 312, values: 312, onMoreThanOne: 0, rowsCovered: 0, emptyGrain: 0, buckets: [312, 0, 0, 0], examples: [] } },
    ]);
  });

  it('runs again with other fields and parameters, which the EDA-Probe is then set on (DEC-ED-17)', async () => {
    const first = (await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'volumeOverTime'), { fields: ['loaded_at', 'week_start'], params: { measure: null } })).json<RunAnswer>();
    expect(asked.at(-1)?.run.sql).not.toContain('measure_sum');
    const volume = first.state === 'ran' ? first.eda.probes.find((probe) => probe.key === 'volumeOverTime') : undefined;
    expect(volume).toMatchObject({ fields: ['week_start', 'loaded_at'], params: { measure: null }, complete: true });
    expect(volume?.lastRun?.results.map((result) => result.subject)).toEqual(['week_start', 'loaded_at']);

    // Without fields or parameters, it runs again as it is set (FR-ED-06), as Claude asks it (FR-ED-16).
    const same = (await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'volumeOverTime'))).json<RunAnswer>();
    expect(asked.at(-1)?.run.sql).not.toContain('measure_sum');
    const kept = same.state === 'ran' ? same.eda.probes.find((probe) => probe.key === 'volumeOverTime') : undefined;
    expect(kept).toMatchObject({ fields: ['week_start', 'loaded_at'], params: { measure: null } });

    const again = (await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'volumeOverTime'), { fields: ['week_start'], params: {} })).json<RunAnswer>();
    const rerun = again.state === 'ran' ? again.eda.probes.find((probe) => probe.key === 'volumeOverTime') : undefined;
    expect(rerun).toMatchObject({ fields: ['week_start'], params: {} });
    expect(rerun?.lastRun?.results).toEqual([
      expect.objectContaining({ subject: 'week_start', reading: 'expected', data: expect.objectContaining({ unit: 'week', measure: 'lead_count', current: '2026-11-16', empty: [] }) }),
    ]);
    expect(await database.db.selectFrom('edaRuns').select('probe').where('probe', '=', 'volumeOverTime').execute()).toHaveLength(3);
  });

  it('runs on a selection of rows, which changes nothing of the EDA-Probe and comes back as the run itself (OP-ED-12)', async () => {
    const before = (await call(dirk, 'GET', edaOf(WEEKLY_ANSWER.id))).json<EdaView>();
    const probeOf = (view: EdaView, key: ProbeKey) => view.probes.find((probe) => probe.key === key);
    const nullsBefore = probeOf(before, 'nullsPerKeyField');
    // Every run in the view says what it ran on: the last run of an EDA-Probe, the whole table.
    expect(nullsBefore?.lastRun?.selection).toEqual({ where: [] });

    const selection = { where: [{ kind: 'saysNothing', field: 'lead_channel' }] };
    const answer = await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'nullsPerKeyField'), { selection });
    expect(answer.statusCode).toBe(200);
    const ran = answer.json<RanOnSelection>();
    expect(ran.state).toBe('ran');
    expect(ran.run).toMatchObject({ ranBy: { id: '103', name: 'Dirk Vos' }, bytes: 1_200_000, fields: nullsBefore?.fields, params: {}, selection });
    expect(ran.run.results.map((result) => [result.subject, result.reading, result.yours])).toEqual([
      ['week_start', 'expected', null],
      ['lead_source', 'look', null],
      ['lead_count', 'expected', null],
      ['lead_channel', 'judge', null],
    ]);
    // On those rows only, every partition kept, aggregates only.
    const sqlOf = () => asked.at(-1)?.run.sql ?? '';
    expect(sqlOf()).toContain(
      "where (`week_start` is null or `week_start` >= date '0001-01-01')\n  and (`lead_channel` is null or lower(trim(`lead_channel`)) in ('', 'n/a', 'na', 'null', 'none', 'unknown', 'onbekend', '-', '?', 'tbd'))",
    );
    expect(sqlOf()).toContain('countif(`lead_channel` is null) as empty_3');
    // Not its last run, nor counted for complete: the EDA is as it was.
    expect(ran.run.id).not.toBe(nullsBefore?.lastRun?.id);
    expect(probeOf(ran.eda, 'nullsPerKeyField')?.lastRun).toEqual(nullsBefore?.lastRun);
    expect(ran.eda.needed).toEqual(before.needed);
    expect(ran.eda.next).toBe(before.next);

    // An EDA-Probe not added yet stays so, and one added keeps its setting, whatever the run on a selection is set on.
    const numbers = (
      await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'distributionOfNumbers'), {
        selection: {
          where: [
            { kind: 'range', field: 'week_start', from: '2026-01-05', before: '2026-02-02' },
            { kind: 'equals', field: 'lead_source', value: "web' or true --" },
          ],
        },
      })
    ).json<RanOnSelection>();
    expect(sqlOf()).toContain("  and (`week_start` >= date '2026-01-05' and `week_start` < date '2026-02-02')\n    and `lead_source` = 'web\\' or true --'\n");
    expect(probeOf(numbers.eda, 'distributionOfNumbers')).toMatchObject({ added: false, complete: false, fields: [], lastRun: null });
    expect(numbers.run).toMatchObject({ fields: ['lead_count'], results: [expect.objectContaining({ subject: 'lead_count', reading: 'judge' })] });
    const volume = (
      await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'volumeOverTime'), {
        fields: ['loaded_at'],
        params: { measure: null },
        selection: { where: [{ kind: 'equals', field: 'lead_count', value: 0 }] },
      })
    ).json<RanOnSelection>();
    expect(sqlOf()).toContain('  and `lead_count` = 0\n  and eda_dated.period is not null');
    expect(volume.run).toMatchObject({ fields: ['loaded_at'], params: { measure: null }, selection: { where: [{ kind: 'equals', field: 'lead_count', value: 0 }] } });
    expect(probeOf(volume.eda, 'volumeOverTime')).toMatchObject({ fields: ['week_start'], params: {}, lastRun: probeOf(before, 'volumeOverTime')?.lastRun });

    // A selection of the whole table is a run as any other: the last run of its EDA-Probe.
    const whole = (await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'nullsPerKeyField'), { selection: { where: [] } })).json<RunAnswer>();
    expect(whole).not.toHaveProperty('run');
    const last = whole.state === 'ran' ? probeOf(whole.eda, 'nullsPerKeyField')?.lastRun : undefined;
    expect(last?.id).not.toBe(nullsBefore?.lastRun?.id);
    expect(last?.selection).toEqual({ where: [] });
    expect(sqlOf()).not.toContain('lower(trim(');

    // Each run is kept with what it ran on.
    const kept = await database.db.selectFrom('edaRuns').select(['probe', 'selection']).where(sql<boolean>`selection -> 'where' <> '[]'::jsonb`).orderBy('ranAt').execute();
    expect(kept.map((run) => [run.probe, run.selection.where.length])).toEqual([
      ['nullsPerKeyField', 1],
      ['distributionOfNumbers', 2],
      ['volumeOverTime', 1],
    ]);
  });

  it('says nothing by the lists of the Disguised nulls of the EDA, once added with them (OP-ED-12, DEC-ED-35)', async () => {
    const eda = await database.db.selectFrom('edas').select('id').where('resourceId', '=', WEEKLY_ANSWER.id).executeTakeFirstOrThrow();
    // Disguised nulls is added here as a run of it adds it, with the lists of this EDA, and taken out again after.
    await database.db
      .insertInto('edaProbes')
      .values({ edaId: eda.id, probe: 'disguisedNulls', fields: '["lead_channel"]', params: JSON.stringify({ lists: { text: ['Leeg'], ninesOnly: false } }), addedById: '103', addedByName: 'Dirk Vos' })
      .execute();
    try {
      const where = [
        { kind: 'saysNothing', field: 'lead_channel' },
        { kind: 'saysNothing', field: 'lead_count' },
      ];
      expect((await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'grainHolds'), { selection: { where } })).statusCode).toBe(200);
      expect(asked.at(-1)?.run.sql).toContain("and (`lead_channel` is null or lower(trim(`lead_channel`)) in ('', 'leeg'))");
      expect(asked.at(-1)?.run.sql).toContain('and (`lead_count` is null or `lead_count` in (-1))');
    } finally {
      await database.db.deleteFrom('edaProbes').where('edaId', '=', eda.id).where('probe', '=', 'disguisedNulls').execute();
    }
  });

  it('refuses a selection that does not fit the Resource before anything runs, whatever it holds (OP-ED-12)', async () => {
    const count = asked.length;
    const runs = await database.db.selectFrom('edaRuns').select('id').execute();
    for (const where of [
      [{ kind: 'saysNothing', field: 'no_such_field' }],
      [{ kind: 'saysNothing', field: 'lead_channel` is null or true or `lead_channel' }],
      [{ kind: 'equals', field: 'lead_count', value: '0 or true' }],
      [{ kind: 'equals', field: 'lead_channel', value: 0 }],
      [{ kind: 'equals', field: 'week_start', value: "2026-01-05' or true or date '2026-01-05" }],
      [{ kind: 'range', field: 'lead_count', from: '0) or (true' }],
      [{ kind: 'range', field: 'lead_channel', from: 'a', before: 'b' }],
      [{ kind: 'range', field: 'lead_count', from: 10, before: 10 }],
      [{ kind: 'where', field: 'lead_channel', sql: 'true' }],
      new Array(11).fill({ kind: 'saysNothing', field: 'lead_channel' }),
    ]) {
      const answer = await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'nullsPerKeyField'), { selection: { where } });
      expect(answer.statusCode, JSON.stringify(where)).toBe(400);
      expect(answer.json()).toMatchObject({ error: 'invalid_request', message: expect.any(String) });
    }
    expect(asked).toHaveLength(count);
    expect(await database.db.selectFrom('edaRuns').select('id').execute()).toHaveLength(runs.length);
  });

  it('says what does not fit, and what cannot run here', async () => {
    expect((await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'noSuchProbe'))).statusCode).toBe(404);
    expect((await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'impossibleValues'))).json()).toEqual({ error: 'cannot_run', message: 'Data Hub does not run Impossible values yet (OP-ED-09).' });
    expect((await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'distributionOfNumbers'), { fields: ['lead_channel'] })).statusCode).toBe(400);
    expect((await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'nullsPerKeyField'), { sql: 'select 1' })).statusCode).toBe(400);
    expect((await call(dirk, 'POST', runOf(DRAFT.id, 'nullsPerKeyField'))).json()).toEqual({ error: 'not_found', message: 'This Resource has no EDA yet.' });
    expect((await call(dirk, 'POST', edaOf(BARE.id))).statusCode).toBe(201);
    const noGrain = await call(dirk, 'POST', runOf(BARE.id, 'grainHolds'));
    expect(noGrain.statusCode).toBe(422);
    expect(noGrain.json<{ message: string }>().message).toMatch(/records its grain first/);
  });

  it('answers 503 when query or catalogue does not answer, and passes on what query refuses', async () => {
    const before = await database.db.selectFrom('edaRuns').select('id').execute();
    next = 'down';
    expect((await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'distributionOfNumbers'))).statusCode).toBe(503);
    next = 'hidden';
    expect((await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'distributionOfNumbers'))).statusCode).toBe(404);
    next = { state: 'ran', rows: [], bytes: 10, runId: 'q-20261121-ffffff' };
    expect((await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'nullsPerKeyField'))).statusCode).toBe(502);
    expect(await database.db.selectFrom('edaRuns').select('id').execute()).toHaveLength(before.length);
    catalogueDown = true;
    try {
      expect((await call(dirk, 'GET', edaOf(WEEKLY_ANSWER.id))).statusCode).toBe(503);
      expect((await call(dirk, 'GET', '/edas')).statusCode).toBe(503);
    } finally {
      catalogueDown = false;
    }
  });

  it('keeps the reading of a result by who works on the EDA, which can be changed (FR-ED-11)', async () => {
    const path = readingOf(WEEKLY_ANSWER.id, 'nullsPerKeyField');
    expect((await call(dirk, 'PUT', path, { subject: 'lead_channel', reading: 'fine' })).statusCode).toBe(400);
    expect((await call(dirk, 'PUT', path, { subject: 'lead_origin', reading: 'known' })).statusCode).toBe(404);
    expect((await call(dirk, 'PUT', readingOf(WEEKLY_ANSWER.id, 'distributionOfNumbers'), { subject: 'lead_count', reading: 'known' })).statusCode).toBe(404);

    const known = await call(dirk, 'PUT', path, { subject: 'lead_channel', reading: 'known' });
    expect(known.statusCode).toBe(200);
    const result = (view: EdaView, subject: string) => view.probes.find((probe) => probe.key === 'nullsPerKeyField')?.lastRun?.results.find((one) => one.subject === subject);
    expect(result(known.json<EdaView>(), 'lead_channel')?.yours).toEqual({ reading: 'known', by: { id: '103', name: 'Dirk Vos' }, at: expect.any(String) });
    expect(result(known.json<EdaView>(), 'lead_source')?.yours).toBeNull();

    const changed = await call(dirk, 'PUT', path, { subject: 'lead_channel', reading: 'problem' });
    expect(result(changed.json<EdaView>(), 'lead_channel')?.yours?.reading).toBe('problem');
    expect(await database.db.selectFrom('edaReadings').selectAll().execute()).toHaveLength(1);
    // On the table as a whole, the subject is empty.
    const grain = await call(dirk, 'PUT', readingOf(WEEKLY_ANSWER.id, 'grainHolds'), { subject: '', reading: 'expected' });
    expect(grain.json<EdaView>().probes.find((probe) => probe.key === 'grainHolds')?.lastRun?.results[0]?.yours?.reading).toBe('expected');
  });

  it('lists the EDAs of the Resources the User sees, and those ready for one (FR-ED-03)', async () => {
    const listed = await call(dirk, 'GET', '/edas');
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual({
      edas: [
        { resource: { id: WEEKLY_ANSWER.id, displayName: 'Weekly lead volume', collection: CREDIT }, status: 'inProgress', needed: { total: 10, complete: 3 } },
        { resource: { id: BARE.id, displayName: 'Lead sources', collection: CREDIT }, status: 'inProgress', needed: { total: 10, complete: 0 } },
      ],
      // Leads is at 4 · Explored without an EDA here; Draft leads is not confirmed yet.
      ready: [{ resource: { id: LEADS_ANSWER.id, displayName: 'Leads', collection: CREDIT }, level: 4 }],
    });
    expect((await call(mia, 'GET', '/edas')).json()).toEqual({ edas: [], ready: [{ resource: { id: LEADS_ANSWER.id, displayName: 'Leads', collection: CREDIT }, level: 4 }] });
  });

  it('runs Distribution of categories weighed as asked, and Date range against the Reliable Since of the Resource Card (FR-ED-17, FR-ED-18)', async () => {
    const weighed = (await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'distributionOfCategories'), {})).json<RunAnswer>();
    expect(asked.at(-1)?.run).toMatchObject({ probe: 'distributionOfCategories', approve: false });
    // The sum of what adds up, every partition kept, the 10 heaviest values only.
    expect(asked.at(-1)?.run.sql).toContain('coalesce(sum(`lead_count`), 0) as weight');
    expect(asked.at(-1)?.run.sql).toContain("where (`week_start` is null or `week_start` >= date '0001-01-01')");
    expect(asked.at(-1)?.run.sql).toContain('if(place <= 10, struct(v as value, weight), null)');
    const categories = weighed.state === 'ran' ? weighed.eda.probes.find((probe) => probe.key === 'distributionOfCategories') : undefined;
    expect(categories).toMatchObject({ added: true, complete: true, fields: ['lead_source', 'lead_channel'], params: {} });
    expect(categories?.lastRun?.results.map((result) => [result.subject, result.reading])).toEqual([
      ['lead_source', 'judge'],
      ['lead_channel', 'judge'],
    ]);
    expect(categories?.lastRun?.results[1]?.data).toEqual({
      weighedBy: 'lead_count',
      total: 1000,
      values: 2,
      top: [
        { value: 'web', weight: 700, share: 0.7 },
        { value: 'mobile', weight: 180, share: 0.18 },
      ],
      others: { values: 0, weight: 0, share: 0 },
      empty: { weight: 120, share: 0.12 },
      small: 0,
    });

    // By rows, as chosen, which it is then set on; a unique count never adds up.
    expect((await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'distributionOfCategories'), { params: { weighedBy: 'unique_applicants' } })).statusCode).toBe(400);
    const byRows = (await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'distributionOfCategories'), { params: { weighedBy: null } })).json<RunAnswer>();
    expect(asked.at(-1)?.run.sql).toContain('count(*) as weight');
    const rerun = byRows.state === 'ran' ? byRows.eda.probes.find((probe) => probe.key === 'distributionOfCategories') : undefined;
    expect(rerun).toMatchObject({ params: { weighedBy: null } });
    expect(rerun?.lastRun?.results[0]?.data).toMatchObject({ weighedBy: null, values: 3 });

    const range = (await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'dateRange'))).json<RunAnswer>();
    expect(asked.at(-1)?.run.sql).toContain("format_date('%F', max(`week_start`)) as last_0");
    const dates = range.state === 'ran' ? range.eda.probes.find((probe) => probe.key === 'dateRange') : undefined;
    expect(dates).toMatchObject({ added: true, complete: true, fields: ['week_start'] });
    // Today in Brussels is Saturday 21 November 2026: the week of 16 November is current, and up to date.
    expect(dates?.lastRun?.results).toEqual([
      {
        subject: 'week_start',
        reading: 'expected',
        yours: null,
        data: { unit: 'week', first: '2021-01-04', last: '2026-11-16', periods: 307, current: '2026-11-16', behind: 0, reliableSince: '2025-01-01', beforeReliable: 208 },
      },
    ]);
    expect((await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, 'dateRange'), { fields: ['lead_source'] })).statusCode).toBe(400);
    expect(range.state === 'ran' && range.eda.needed).toEqual({ total: 10, complete: 5 });
  });

  it('never becomes Explored while a needed EDA-Probe Data Hub cannot run yet is not complete (OP-ED-09)', async () => {
    for (const probe of ['grainHolds', 'dateRange', 'volumeOverTime', 'nullsPerKeyField', 'disguisedNulls', 'distributionOfNumbers', 'distributionOfCategories']) {
      expect((await call(dirk, 'POST', runOf(WEEKLY_ANSWER.id, probe))).statusCode, probe).toBe(200);
    }
    // Every EDA-Probe Data Hub runs is complete; Values without a match, Spread and Impossible values are not.
    const view = (await call(dirk, 'GET', edaOf(WEEKLY_ANSWER.id))).json<EdaView>();
    expect(view).toMatchObject({ status: 'inProgress', exploredAt: null, needed: { total: 10, complete: 7 }, next: null });
    expect(told).toHaveLength(0);
  });

  it('becomes Explored once every needed EDA-Probe is complete, and tells catalogue until it heard it (FR-ED-12, TR-ED-05)', async () => {
    const started = await call(dirk, 'POST', edaOf(LEADS_ANSWER.id), undefined, explorer);
    expect(started.json<EdaView>().needed).toEqual({ total: 7, complete: 0 });
    for (const probe of ['grainHolds', 'dateRange', 'nullsPerKeyField', 'disguisedNulls', 'volumeOverTime', 'distributionOfCategories']) {
      const ran = (await call(dirk, 'POST', runOf(LEADS_ANSWER.id, probe), {}, explorer)).json<RunAnswer>();
      expect(ran.state === 'ran' && ran.eda.status).toBe('inProgress');
    }
    // catalogue does not take it the first time: the EDA is Explored all the same, and catalogue is told again.
    catalogueDeaf = true;
    const last = (await call(dirk, 'POST', runOf(LEADS_ANSWER.id, 'distributionOfNumbers'), {}, explorer)).json<RunAnswer>();
    catalogueDeaf = false;
    expect(last.state === 'ran' && last.eda).toMatchObject({ status: 'explored', exploredAt: expect.any(String), needed: { total: 7, complete: 7 } });
    expect(told).toHaveLength(0);
    const row = () => database.db.selectFrom('edas').select(['status', 'exploredAt', 'toldAt']).where('resourceId', '=', LEADS_ANSWER.id).executeTakeFirstOrThrow();
    expect(await row()).toMatchObject({ status: 'explored', toldAt: null });

    await call(dirk, 'GET', edaOf(LEADS_ANSWER.id), undefined, explorer);
    expect(told).toEqual([LEADS_ANSWER.id]);
    expect((await row()).toldAt).toBeInstanceOf(Date);
    answers.set(LEADS_ANSWER.id, { ...LEADS_ANSWER, explored: true });
    await call(dirk, 'GET', edaOf(LEADS_ANSWER.id), undefined, explorer);
    expect(told).toHaveLength(1);
    // A catalogue that does not keep it is told again.
    answers.set(LEADS_ANSWER.id, { ...LEADS_ANSWER, explored: false });
    await call(dirk, 'GET', edaOf(LEADS_ANSWER.id), undefined, explorer);
    expect(told).toHaveLength(2);

    // What counts as needed later, a run or a reading lowers nothing (FR-ED-12).
    const later = (await call(dirk, 'GET', edaOf(LEADS_ANSWER.id))).json<EdaView>();
    expect(later.status).toBe('explored');
    expect(later.needed.complete).toBeLessThan(later.needed.total);
    expect((await call(dirk, 'GET', '/edas')).json<{ edas: { status: string }[] }>().edas.map((eda) => eda.status)).toEqual(['inProgress', 'inProgress', 'explored']);
  });
});

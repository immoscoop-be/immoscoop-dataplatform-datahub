import { randomBytes } from 'node:crypto';
import { createDatabase, migrate, type Database } from '@datahub/db';
import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { RegistryDatabase } from './database.js';
import { createDeliveries, REFUSED_PER_HOUR } from './deliveries.js';
import { migrations } from './migrations/index.js';
import { createSourceJobs } from './source-jobs.js';

// A Postgres to run against: CI starts one; locally, set DATAHUB_TEST_DATABASE_URL.
const url = process.env.DATAHUB_TEST_DATABASE_URL;
if (!url && process.env.CI) {
  throw new Error('DATAHUB_TEST_DATABASE_URL must be set in CI');
}

/** The configuration of uat: job → dbt project (DEC-AR-01). */
const CONFIGURED = new Map([
  ['322951', '9367'],
  ['739003', '17121'],
]);
const MAX = { id: 'u-max', name: 'Maxime Passenier' };

describe.skipIf(!url)('the Source Jobs and the deliveries of the webhook (FR-AR-18, FR-AR-19)', () => {
  const schema = `registry_admin_${randomBytes(4).toString('hex')}`;
  let database: Database<RegistryDatabase>;
  let db: Kysely<RegistryDatabase>;

  beforeAll(async () => {
    database = createDatabase<RegistryDatabase>({ connectionString: url }, schema);
    db = database.db;
    const results = await migrate({ db: db as Kysely<unknown>, schema, migrations, serviceUser: 'postgres' });
    expect(results.every((result) => result.status === 'Success')).toBe(true);
  });

  afterAll(async () => {
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(db);
    await database.close();
  });

  beforeEach(async () => {
    await sql`truncate source_jobs, deliveries, projects, artifact_sets restart identity cascade`.execute(db);
  });

  it('starts from the configuration, and a job a Data Admin chose takes its place, with who and when', async () => {
    const jobs = createSourceJobs(db, CONFIGURED);
    expect(await jobs.list()).toEqual([
      { projectId: '9367', jobId: '322951', jobName: null, setBy: null, setAt: null },
      { projectId: '17121', jobId: '739003', jobName: null, setBy: null, setAt: null },
    ]);
    const saved = await jobs.set('9367', { id: '352118', name: 'UAT - Deploy - Merge build' }, MAX);
    expect(saved).toMatchObject({ projectId: '9367', jobId: '352118', jobName: 'UAT - Deploy - Merge build', setBy: 'Maxime Passenier' });
    expect(await jobs.current()).toEqual(
      new Map([
        ['352118', '9367'],
        ['739003', '17121'],
      ]),
    );
    // Choosing again replaces it; a project Data Hub does not follow is no place for a job.
    await jobs.set('9367', { id: '322951', name: 'daily UAT build (uat)' }, MAX);
    expect((await jobs.current()).get('322951')).toBe('9367');
    await expect(jobs.set('5', { id: '1', name: 'x' }, MAX)).rejects.toThrow('does not follow');
  });

  it('tells the last Artifact Set of each dbt project', async () => {
    await db.insertInto('artifactSets').values([
      { projectId: '9367', jobId: '322951', runId: '100', status: 'processed' },
      { projectId: '9367', jobId: '322951', runId: '101', status: 'failed' },
      { projectId: '17121', jobId: '739003', runId: '50' },
    ]).execute();
    const last = await createSourceJobs(db, CONFIGURED).lastSets();
    expect(last.map((set) => [set.projectId, set.runId, set.status]).sort()).toEqual([
      ['17121', '50', 'pending'],
      ['9367', '101', 'failed'],
    ]);
  });

  it('keeps every delivery 30 days, the newest first, with the Artifact Set of a recorded one', async () => {
    let time = new Date('2026-10-31T10:00:00Z');
    const deliveries = createDeliveries(db, () => time);
    await db.insertInto('artifactSets').values({ projectId: '9367', jobId: '322951', runId: '58209931', status: 'failed', error: 'dbt Cloud has no catalog.json for this run' }).execute();
    await deliveries.record({ outcome: 'recorded', jobId: '322951', jobName: 'daily UAT build (uat)', projectId: '9367', runId: '58209931', runStatus: 'Success' });
    time = new Date('2026-10-31T10:05:00Z');
    await deliveries.record({ outcome: 'ignored', reason: 'notSourceJob', jobId: '324451', projectId: '9367', runId: '58212208' });
    await deliveries.record({ outcome: 'refused', reason: 'signature' });

    const list = await deliveries.list();
    expect(list.map((delivery) => [delivery.outcome, delivery.reason, delivery.runId])).toEqual([
      ['refused', 'signature', null],
      ['ignored', 'notSourceJob', '58212208'],
      ['recorded', null, '58209931'],
    ]);
    expect(list[2]?.set).toEqual({ status: 'failed', error: 'dbt Cloud has no catalog.json for this run', processedAt: null, current: false });
    expect(list[1]?.set).toBeNull();
    // Refused, and recorded but failed, call for a look.
    expect(await deliveries.toLookAt()).toBe(2);

    // After 30 days they are gone.
    time = new Date('2026-12-01T10:00:00Z');
    expect(await deliveries.list()).toEqual([]);
    await deliveries.record({ outcome: 'refused', reason: 'signature' });
    expect((await db.selectFrom('deliveries').select('id').execute()).length).toBe(1);
  });

  it('keeps at most a hundred refused deliveries an hour, so that trying the address fills nothing', async () => {
    const deliveries = createDeliveries(db, () => new Date('2026-10-31T10:00:00Z'));
    for (let index = 0; index < REFUSED_PER_HOUR + 5; index++) await deliveries.record({ outcome: 'refused', reason: 'signature' });
    expect((await deliveries.list()).length).toBe(REFUSED_PER_HOUR);
    await deliveries.record({ outcome: 'ignored', reason: 'notARun' });
    expect((await deliveries.list()).length).toBe(REFUSED_PER_HOUR + 1);
  });
});

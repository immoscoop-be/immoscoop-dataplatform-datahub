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

  it('starts empty outside uat and prod, and follows, changes and stops following a dbt project (DEC-AR-10)', async () => {
    const jobs = createSourceJobs(db);
    expect(await jobs.list()).toEqual([]);

    const followed = await jobs.follow('9367', { id: '322951', name: 'daily UAT build (uat)' }, MAX);
    expect(followed).toMatchObject({ projectId: '9367', jobId: '322951', jobName: 'daily UAT build (uat)', setBy: 'Maxime Passenier' });
    expect(followed?.setAt).toBeInstanceOf(Date);
    // Following it again is no way to change it.
    expect(await jobs.follow('9367', { id: '352118', name: 'UAT - Deploy - Merge build' }, MAX)).toBeNull();
    await jobs.follow('17121', { id: '748279', name: 'UAT - Deploy - Merge build' }, MAX);

    const saved = await jobs.set('9367', { id: '352118', name: 'UAT - Deploy - Merge build' }, MAX);
    expect(saved).toMatchObject({ projectId: '9367', jobId: '352118', jobName: 'UAT - Deploy - Merge build', setBy: 'Maxime Passenier' });
    expect(await jobs.current()).toEqual(
      new Map([
        ['748279', '17121'],
        ['352118', '9367'],
      ]),
    );
    // A dbt project Data Hub does not follow is no place for a job.
    expect(await jobs.set('5', { id: '1', name: 'x' }, MAX)).toBeNull();

    // Stopping keeps its Artifact Sets; its runs are no longer taken.
    await db.insertInto('artifactSets').values({ projectId: '17121', jobId: '748279', runId: '50', status: 'processed' }).execute();
    expect(await jobs.stop('17121')).toBe(true);
    expect(await jobs.stop('17121')).toBe(false);
    expect([...(await jobs.current()).keys()]).toEqual(['352118']);
    expect((await db.selectFrom('artifactSets').select('runId').execute()).map((set) => String(set.runId))).toEqual(['50']);
    expect(await jobs.lastSets()).toEqual([]);
  });

  it('tells the last Artifact Set of each dbt project it follows', async () => {
    const jobs = createSourceJobs(db);
    await jobs.follow('9367', { id: '322951', name: 'daily UAT build (uat)' }, MAX);
    await jobs.follow('17121', { id: '739003', name: 'UAT - Scheduled - Daily build' }, MAX);
    await db.insertInto('artifactSets').values([
      { projectId: '9367', jobId: '322951', runId: '100', status: 'processed' },
      { projectId: '9367', jobId: '322951', runId: '101', status: 'failed' },
      { projectId: '17121', jobId: '739003', runId: '50' },
      { projectId: '5', jobId: '7', runId: '60' },
    ]).execute();
    const last = await jobs.lastSets();
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

describe.skipIf(!url)('the Source Jobs taken over from the configuration (DEC-AR-10)', () => {
  const schemas: string[] = [];
  const opened: Database<RegistryDatabase>[] = [];

  afterAll(async () => {
    for (const [index, database] of opened.entries()) {
      await sql`drop schema if exists ${sql.id(schemas[index] ?? '')} cascade`.execute(database.db);
      await database.close();
    }
  });

  /** Migrates a fresh schema as the migration job of an environment would, with a choice made before 0007 when given. */
  async function migrated(environment: string | undefined, before?: (db: Kysely<RegistryDatabase>) => Promise<void>) {
    const schema = `registry_taken_${randomBytes(4).toString('hex')}`;
    const database = createDatabase<RegistryDatabase>({ connectionString: url }, schema);
    schemas.push(schema);
    opened.push(database);
    const was = process.env.DATAHUB_ENVIRONMENT;
    try {
      if (environment === undefined) delete process.env.DATAHUB_ENVIRONMENT;
      else process.env.DATAHUB_ENVIRONMENT = environment;
      if (before) {
        const upTo = Object.fromEntries(Object.entries(migrations).filter(([name]) => name < '0007'));
        await migrate({ db: database.db as Kysely<unknown>, schema, migrations: upTo, serviceUser: 'postgres' });
        await before(database.db);
      }
      await migrate({ db: database.db as Kysely<unknown>, schema, migrations, serviceUser: 'postgres' });
    } finally {
      if (was === undefined) delete process.env.DATAHUB_ENVIRONMENT;
      else process.env.DATAHUB_ENVIRONMENT = was;
    }
    return createSourceJobs(database.db);
  }

  it('follows in uat and prod what Terraform named, without a name or who set it', async () => {
    expect(await (await migrated('uat')).list()).toEqual([
      { projectId: '9367', jobId: '322951', jobName: null, setBy: null, setAt: null },
      { projectId: '17121', jobId: '748279', jobName: null, setBy: null, setAt: null },
    ]);
    expect(await (await migrated('prod')).current()).toEqual(
      new Map([
        ['748278', '17121'],
        ['324502', '9367'],
      ]),
    );
    expect(await (await migrated(undefined)).list()).toEqual([]);
  });

  it('keeps a job a Data Admin had chosen already', async () => {
    const jobs = await migrated('uat', async (db) => {
      await db.insertInto('sourceJobs').values({ projectId: '9367', jobId: '352118', jobName: 'UAT - Deploy - Merge build', setBy: 'u-max', setByName: 'Maxime Passenier' }).execute();
    });
    expect(await jobs.current()).toEqual(
      new Map([
        ['748279', '17121'],
        ['352118', '9367'],
      ]),
    );
  });
});

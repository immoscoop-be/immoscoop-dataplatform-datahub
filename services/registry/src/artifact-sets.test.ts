import { randomBytes } from 'node:crypto';
import { createDatabase, migrate, type Database } from '@datahub/db';
import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createArtifactSets, type ArtifactSets, type ClaimedSet } from './artifact-sets.js';
import type { RegistryDatabase } from './database.js';
import { sampleCatalog, sampleManifest } from './fixtures.js';
import { migrations } from './migrations/index.js';
import { normalise } from './normalise.js';

// A Postgres to run against: CI starts one; locally, set DATAHUB_TEST_DATABASE_URL.
const url = process.env.DATAHUB_TEST_DATABASE_URL;
if (!url && process.env.CI) {
  throw new Error('DATAHUB_TEST_DATABASE_URL must be set in CI');
}

const DBT_PROD = '9367';
const sample = normalise(sampleManifest(), sampleCatalog());

describe.skipIf(!url)('the Artifact Sets', () => {
  const schema = `registry_test_${randomBytes(4).toString('hex')}`;
  let database: Database<RegistryDatabase>;
  let db: Kysely<RegistryDatabase>;
  let time: Date;
  let sets: ArtifactSets;

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
    await sql`truncate projects, tests, columns, edges, nodes, artifact_sets restart identity cascade`.execute(db);
    time = new Date('2026-10-18T08:00:00Z');
    sets = createArtifactSets(db, () => time);
  });

  /** Records a run and takes it, as the webhook and the ingest job do. */
  async function claimed(runId: string): Promise<ClaimedSet> {
    await sets.record({ projectId: DBT_PROD, jobId: '322950', runId });
    const set = await sets.claimNext();
    expect(set?.runId).toBe(runId);
    return set as ClaimedSet;
  }

  const project = () => db.selectFrom('projects').selectAll().where('projectId', '=', DBT_PROD).executeTakeFirstOrThrow();
  const nodeCount = async (setId: number) =>
    Number((await db.selectFrom('nodes').select((eb) => eb.fn.countAll().as('count')).where('setId', '=', setId).executeTakeFirstOrThrow()).count);

  it('records a run once, however often dbt Cloud reports it', async () => {
    expect(await sets.record({ projectId: DBT_PROD, jobId: '322950', runId: '100' })).toBe('pending');
    expect(await sets.record({ projectId: DBT_PROD, jobId: '322950', runId: '100' })).toBe('pending');
    expect(await db.selectFrom('artifactSets').selectAll().execute()).toHaveLength(1);
  });

  it('hands out the oldest pending set first, and each set to one run of the job only', async () => {
    await sets.record({ projectId: DBT_PROD, jobId: '322950', runId: '200' });
    await sets.record({ projectId: DBT_PROD, jobId: '322950', runId: '100' });
    expect((await sets.claimNext())?.runId).toBe('100');
    expect((await sets.claimNext())?.runId).toBe('200');
    expect(await sets.claimNext()).toBeUndefined();
    expect(await sets.record({ projectId: DBT_PROD, jobId: '322950', runId: '100' })).toBe('processing');
  });

  it('takes a set again when a run of the job stopped halfway through it', async () => {
    await claimed('100');
    time = new Date(time.getTime() + 59 * 60 * 1000);
    expect(await sets.claimNext()).toBeUndefined();
    time = new Date(time.getTime() + 2 * 60 * 1000);
    expect((await sets.claimNext())?.runId).toBe('100');
  });

  it('makes a processed set the Current Version, with its Nodes, columns, Edges and tests', async () => {
    const set = await claimed('100');
    expect(await sets.save(set, sample)).toEqual({ current: true });
    expect(await project()).toMatchObject({ name: 'immoscoop_dataplatform_sql', currentSetId: set.id, previousSetId: null });
    expect(await db.selectFrom('artifactSets').selectAll().where('id', '=', set.id).executeTakeFirstOrThrow()).toMatchObject({
      status: 'processed',
      dbtVersion: '1.10.2',
      generatedAt: new Date('2026-10-18T07:27:00Z'),
      processedAt: time,
    });
    expect(await nodeCount(set.id)).toBe(7);
    const orders = await db.selectFrom('nodes').selectAll().where('uniqueId', '=', 'model.immoscoop_dataplatform_sql.orders').executeTakeFirstOrThrow();
    expect(orders.tags).toEqual(['marts', 'daily']);
    expect(await db.selectFrom('columns').selectAll().where('setId', '=', set.id).execute()).toHaveLength(sample.columns.length);
    expect(await db.selectFrom('edges').selectAll().where('setId', '=', set.id).execute()).toHaveLength(sample.edges.length);
    expect(await db.selectFrom('tests').selectAll().where('setId', '=', set.id).execute()).toHaveLength(3);
  });

  it('keeps the rows of the Current Version and the one before it only', async () => {
    const first = await claimed('100');
    await sets.save(first, sample);
    const second = await claimed('200');
    await sets.save(second, sample);
    expect(await project()).toMatchObject({ currentSetId: second.id, previousSetId: first.id });
    expect(await nodeCount(first.id)).toBe(7);

    const third = await claimed('300');
    await sets.save(third, sample);
    expect(await project()).toMatchObject({ currentSetId: third.id, previousSetId: second.id });
    expect(await nodeCount(first.id)).toBe(0);
    // The set itself stays, so it can be processed again from the bucket (FR-AR-14).
    expect((await db.selectFrom('artifactSets').select('status').where('id', '=', first.id).executeTakeFirstOrThrow()).status).toBe('processed');
  });

  it('never goes back in time: an older run is processed, but does not become current (EC-AR-01)', async () => {
    const newer = await claimed('200');
    await sets.save(newer, sample);
    const older = await claimed('100');
    expect(await sets.save(older, sample)).toEqual({ current: false });
    expect(await project()).toMatchObject({ currentSetId: newer.id, previousSetId: null });
    expect(await nodeCount(older.id)).toBe(0);
  });

  it('processes the Current Version again without losing the version before it', async () => {
    const first = await claimed('100');
    await sets.save(first, sample);
    const second = await claimed('200');
    await sets.save(second, sample);
    expect(await sets.save(second, normalise(sampleManifest({ ordersDescription: 'Changed.' }), sampleCatalog()))).toEqual({ current: true });
    expect(await project()).toMatchObject({ currentSetId: second.id, previousSetId: first.id });
    const orders = await db
      .selectFrom('nodes')
      .select('description')
      .where('setId', '=', second.id)
      .where('uniqueId', '=', 'model.immoscoop_dataplatform_sql.orders')
      .executeTakeFirstOrThrow();
    expect(orders.description).toBe('Changed.');
  });

  it('puts a processed or failed set back in the queue, but not one in progress (FR-AR-14)', async () => {
    const done = await claimed('100');
    await sets.save(done, sample);
    const broken = await claimed('200');
    await sets.fail(broken.id, 'no catalog');
    await sets.record({ projectId: DBT_PROD, jobId: '322950', runId: '300' });
    await sets.claimNext();

    expect(await sets.reprocess('100')).toBe('pending');
    expect(await sets.reprocess('200')).toBe('pending');
    expect(await sets.reprocess('300')).toBe('processing');
    expect(await sets.reprocess('400')).toBeUndefined();
    const again = await sets.claimNext();
    expect(again?.runId).toBe('100');
    expect(await db.selectFrom('artifactSets').select('error').where('runId', '=', '200').executeTakeFirstOrThrow()).toEqual({ error: null });
  });

  it('leaves nothing behind when writing a set fails, and keeps the Current Version (FR-AR-09)', async () => {
    const first = await claimed('100');
    await sets.save(first, sample);
    const broken = await claimed('200');
    const dangling = { ...sample, edges: [...sample.edges, { parentId: 'model.p.missing', childId: 'model.immoscoop_dataplatform_sql.orders' }] };
    await expect(sets.save(broken, dangling)).rejects.toThrow();
    await sets.fail(broken.id, 'The Edge points to a Node that is not there');

    expect(await project()).toMatchObject({ currentSetId: first.id });
    expect(await nodeCount(broken.id)).toBe(0);
    expect(await db.selectFrom('artifactSets').select(['status', 'error']).where('id', '=', broken.id).executeTakeFirstOrThrow()).toEqual({
      status: 'failed',
      error: 'The Edge points to a Node that is not there',
    });
  });
});

import { randomBytes } from 'node:crypto';
import { createDatabase, migrate, type Database } from '@datahub/db';
import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createArtifactSets } from './artifact-sets.js';
import { compare, createChanges, propagate, type Version } from './changes.js';
import type { RegistryDatabase } from './database.js';
import { sampleCatalog, sampleManifest } from './fixtures.js';
import { migrations } from './migrations/index.js';
import { normalise } from './normalise.js';

const url = process.env.DATAHUB_TEST_DATABASE_URL;
if (!url && process.env.CI) {
  throw new Error('DATAHUB_TEST_DATABASE_URL must be set in CI');
}

const node = (uniqueId: string, extra: Partial<Version['nodes'][number]> = {}) => ({
  uniqueId,
  resourceType: uniqueId.split('.')[0]!,
  name: uniqueId.split('.').at(-1)!,
  description: '',
  checksum: `sum-${uniqueId}`,
  ...extra,
});
const column = (nodeId: string, name: string, dataType: string | null = 'STRING', description = '') => ({ nodeId, name, dataType, description });

describe('the Changes between two versions of a dbt project (FR-AR-11)', () => {
  const before: Version = {
    nodes: [node('model.p.leads'), node('model.p.visits'), node('source.p.raw.leads'), node('model.p.gone'), node('exposure.p.datahub_leads')],
    columns: [
      column('model.p.leads', 'lead_id'),
      column('model.p.leads', 'channel'),
      column('model.p.leads', 'amount', 'INT64', 'In euro.'),
      column('model.p.visits', 'visit_id'),
    ],
  };

  it('finds every kind of Change, Node by Node, a rename as a field removed and one added', () => {
    const after: Version = {
      nodes: [
        node('model.p.leads', { checksum: 'other' }),
        node('model.p.visits', { description: 'Every visit.' }),
        node('source.p.raw.leads'),
        node('model.p.new_one'),
        // An exposure that changes is no data and changes nothing.
        node('exposure.p.datahub_leads', { description: 'Changed.' }),
      ],
      columns: [
        column('model.p.leads', 'lead_id'),
        column('model.p.leads', 'lead_channel'),
        column('model.p.leads', 'amount', 'NUMERIC', 'In euros.'),
        column('model.p.visits', 'visit_id'),
      ],
    };
    expect(compare(before, after)).toEqual([
      { kind: 'removed', nodeId: 'model.p.gone', node: 'gone' },
      { kind: 'logic', nodeId: 'model.p.leads', node: 'leads' },
      { kind: 'structural', nodeId: 'model.p.leads', node: 'leads', field: 'channel', direction: 'removed' },
      { kind: 'structural', nodeId: 'model.p.leads', node: 'leads', field: 'lead_channel', direction: 'added' },
      { kind: 'type', nodeId: 'model.p.leads', node: 'leads', field: 'amount', old: 'INT64', new: 'NUMERIC' },
      { kind: 'description', nodeId: 'model.p.leads', node: 'leads' },
      { kind: 'added', nodeId: 'model.p.new_one', node: 'new_one' },
      { kind: 'description', nodeId: 'model.p.visits', node: 'visits' },
    ]);
    expect(compare(before, before)).toEqual([]);
  });

  it('follows each Change downstream to the tables of Resources, however deep, at the shortest distance (FR-AR-12, EC-AR-04)', () => {
    // raw → stg → int → mart, raw → mart; the mart and an unrelated table are tables of Resources.
    const children = new Map([
      ['source.p.raw', ['model.p.stg', 'model.p.mart']],
      ['model.p.stg', ['model.p.int']],
      ['model.p.int', ['model.p.mart']],
    ]);
    const former = new Map([['model.p.gone', ['model.p.int']]]);
    const tables = new Set(['model.p.mart', 'model.p.other', 'model.p.stg']);
    const reached = propagate(
      [
        { kind: 'description', nodeId: 'source.p.raw', node: 'raw' },
        { kind: 'logic', nodeId: 'model.p.stg', node: 'stg' },
        { kind: 'type', nodeId: 'model.p.stg', node: 'stg', field: 'id', old: 'INT64', new: 'STRING' },
        { kind: 'removed', nodeId: 'model.p.gone', node: 'gone' },
        { kind: 'structural', nodeId: 'model.p.lonely', node: 'lonely', field: 'x', direction: 'added' },
      ],
      children,
      former,
      tables,
    );
    expect(reached).toEqual([
      { kind: 'description', node: 'raw', reaches: [{ nodeId: 'model.p.mart', distance: 1 }, { nodeId: 'model.p.stg', distance: 1 }] },
      // A change of the code of a Resource's own table reaches it at distance 0; Data Hub logs its own fields itself.
      { kind: 'logic', node: 'stg', reaches: [{ nodeId: 'model.p.stg', distance: 0 }, { nodeId: 'model.p.mart', distance: 2 }] },
      { kind: 'type', node: 'stg', field: 'id', old: 'INT64', new: 'STRING', reaches: [{ nodeId: 'model.p.mart', distance: 2 }] },
      // A model that went is followed from where it fed before.
      { kind: 'removed', node: 'gone', reaches: [{ nodeId: 'model.p.mart', distance: 2 }] },
    ]);
  });
});

describe.skipIf(!url)('the Changes of a new Current Version, in Postgres', () => {
  const schema = `registry_changes_${randomBytes(4).toString('hex')}`;
  let database: Database<RegistryDatabase>;
  let db: Kysely<RegistryDatabase>;

  beforeAll(async () => {
    database = createDatabase<RegistryDatabase>({ connectionString: url }, schema);
    db = database.db;
    await migrate({ db: db as Kysely<unknown>, schema, migrations, serviceUser: 'postgres' });
  });

  afterAll(async () => {
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(db);
    await database.close();
  });

  it('compares the new version with the one before and finds the Resources each Change reaches', async () => {
    const sets = createArtifactSets(db);
    const claim = async (runId: string) => {
      await sets.record({ projectId: '9367', jobId: '1', runId });
      return (await sets.claimNext())!;
    };
    const first = await claim('100');
    expect(await sets.save(first, normalise(sampleManifest({ datahub: true }), sampleCatalog()))).toEqual({ current: true, previous: null });

    // The next run: the ephemeral order_lines has new code, and the source has a new description.
    const manifest = sampleManifest({ datahub: true }) as ReturnType<typeof sampleManifest>;
    const lines = manifest.nodes['model.immoscoop_dataplatform_sql.order_lines'] as { checksum: { checksum: string } };
    lines.checksum = { ...lines.checksum, checksum: 'sum-new' };
    (manifest.sources['source.immoscoop_dataplatform_sql.shop.raw_orders'] as { description: string }).description = 'Orders, as the shop sends them.';
    const second = await claim('200');
    expect(await sets.save(second, normalise(manifest, sampleCatalog()))).toEqual({ current: true, previous: first.id });

    const found = await createChanges(db).since(first.id, second.id);
    expect(found.map(({ kind, node, reaches }) => [kind, node, reaches.map((reach) => `${reach.nodeId.split('.').at(-1)}@${reach.distance}`)])).toEqual([
      ['logic', 'order_lines', ['orders@1', 'customers@2']],
      ['description', 'raw_orders', ['orders@1', 'customers@2']],
    ]);
  });
});

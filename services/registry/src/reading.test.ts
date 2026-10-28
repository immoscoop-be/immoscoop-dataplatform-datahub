import { randomBytes } from 'node:crypto';
import { createDatabase, migrate, type Database } from '@datahub/db';
import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createArtifactSets } from './artifact-sets.js';
import type { RegistryDatabase } from './database.js';
import { collecionesCatalog, collecionesManifest, sampleCatalog, sampleManifest } from './fixtures.js';
import { migrations } from './migrations/index.js';
import { normalise } from './normalise.js';
import { createReading, type Reading } from './reading.js';

// A Postgres to run against: CI starts one; locally, set DATAHUB_TEST_DATABASE_URL.
const url = process.env.DATAHUB_TEST_DATABASE_URL;
if (!url && process.env.CI) {
  throw new Error('DATAHUB_TEST_DATABASE_URL must be set in CI');
}

const P = 'immoscoop_dataplatform_sql';
const C = 'compilacion_colleciones_dbt';

describe.skipIf(!url)('reading the registry', () => {
  const schema = `registry_read_${randomBytes(4).toString('hex')}`;
  let database: Database<RegistryDatabase>;
  let reading: Reading;

  beforeAll(async () => {
    database = createDatabase<RegistryDatabase>({ connectionString: url }, schema);
    await migrate({ db: database.db as Kysely<unknown>, schema, migrations, serviceUser: 'postgres' });
    const sets = createArtifactSets(database.db);
    // An older dbt-prod set with a Node that has gone since: it must not show up anywhere.
    const old = normalise(sampleManifest(), sampleCatalog());
    old.nodes.push({ ...old.nodes[0]!, uniqueId: `model.${P}.retired`, name: 'retired' });
    for (const [run, normalised] of [
      [{ projectId: '9367', jobId: '322951', runId: '100' }, old],
      [{ projectId: '9367', jobId: '322951', runId: '200' }, normalise(sampleManifest(), sampleCatalog())],
      [{ projectId: '17121', jobId: '739003', runId: '150' }, normalise(collecionesManifest(), collecionesCatalog())],
    ] as const) {
      await sets.record(run);
      const set = await sets.claimNext();
      await sets.save(set!, normalised);
    }
    reading = createReading(database.db);
  });

  afterAll(async () => {
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(database.db);
    await database.close();
  });

  it('tells the Current Version of each dbt project', async () => {
    expect(await reading.projects()).toMatchObject([
      { projectId: '9367', name: P, runId: '200', dbtVersion: '1.10.2', nodeCount: 7 },
      { projectId: '17121', name: C, runId: '150', dbtVersion: '2.0.0-fusion', nodeCount: 2 },
    ]);
  });

  it('lists the latest runs, and which of them are current', async () => {
    expect((await reading.runs(10)).map((run) => [run.runId, run.status, run.current])).toEqual([
      ['200', 'processed', true],
      ['150', 'processed', true],
      ['100', 'processed', false],
    ]);
    expect(await reading.runs(1)).toHaveLength(1);
  });

  describe('search', () => {
    const names = async (query: string, type?: string, project?: string) => (await reading.search(query, { type, project, limit: 20 })).map((hit) => hit.name);

    it('puts the exact name first', async () => {
      const hits = await names('orders');
      expect(hits[0]).toBe('orders');
      expect(hits).toEqual(expect.arrayContaining(['orders', 'order_lines', 'orders_history', 'agency_orders']));
    });

    it('finds a name with a typo or only half of it', async () => {
      expect(await names('ordrs')).toContain('orders');
      expect(await names('history')).toContain('orders_history');
      expect(await names('agency')).toEqual(['agency_orders']);
    });

    it('finds free text in descriptions and in columns', async () => {
      expect(await names('one row per order')).toEqual(['orders']);
      const [customers] = await reading.search('customer_key', { limit: 20 });
      expect(customers).toMatchObject({ name: 'customers', matchedColumns: ['customer_key'] });
    });

    it('filters on the kind of Node, and only looks at the Current Versions', async () => {
      expect((await names('orders', 'source')).sort()).toEqual(['orders', 'raw_orders']);
      expect(await names('retired')).toEqual([]);
    });

    it('filters on the dbt project', async () => {
      const everywhere = await names('orders');
      const inColleciones = await names('orders', undefined, '17121');
      expect(inColleciones).toContain('orders');
      expect(inColleciones.length).toBeLessThan(everywhere.length);
      expect((await reading.search('orders', { project: '17121', limit: 20 })).every((hit) => hit.projectId === '17121')).toBe(true);
      expect((await reading.search('orders', { project: '9367', limit: 20 })).every((hit) => hit.projectId === '9367')).toBe(true);
      expect(await names('orders', undefined, '1')).toEqual([]);
    });

    it('takes the characters of a LIKE pattern literally', async () => {
      expect(await names('%')).toEqual([]);
    });
  });

  it('reads one Node with its columns in order and its tests', async () => {
    const orders = await reading.node(`model.${P}.orders`);
    expect(orders).toMatchObject({
      name: 'orders',
      projectId: '9367',
      projectName: P,
      relation: 'immoscoop-dataplatform.dbt_marts.orders',
      materialized: 'table',
      tags: ['marts', 'daily'],
      // How its table is stored, for the step that adds a Resource (FR-CO-34).
      partitionField: 'ordered_at',
      partitionUnit: 'month',
      clusterBy: ['customer_id'],
      requirePartitionFilter: true,
    });
    // The meta comes back as the JSON it was in the dbt project, nested and all.
    expect(orders?.meta).toEqual({
      model: { kind: 'history', grain: 'stateChange' },
      domain: { entity: 'order', entityDescription: '', identifiers: [{ name: 'orderId', type: 'string' }], performedBy: ['user', 'visitor'] },
    });
    expect(orders?.columns.map((column) => column.name)).toEqual(['ORDER_ID', 'CUSTOMER_ID', 'CREATED_AT']);
    expect(orders?.tests).toEqual([
      { name: 'relationships', columnName: 'customer_id', severity: 'warn', targetNodeId: `model.${P}.customers`, targetColumn: 'customer_key' },
      { name: 'not_null', columnName: 'order_id', severity: 'error', targetNodeId: null, targetColumn: null },
    ]);
    expect(await reading.node(`model.${P}.retired`)).toBeUndefined();
  });

  it('reads what a Node of Colleciónes is built from, and the meta of its columns (FR-AR-16, DEC-AR-07)', async () => {
    const agencyOrders = await reading.node(`model.${C}.agency_orders`);
    expect(agencyOrders).toMatchObject({ entity: 'agency', action: 'order', strategy: 'AtomicEvent', layer: 'mrt' });
    expect(agencyOrders?.columns).toEqual([
      { name: 'agency_id', position: 1, dataType: 'STRING', description: 'The agency.', meta: { domain: { maps: 'is', entity: 'agency', identifier: 'agencyId' } } },
    ]);
  });

  it('follows the lineage downstream, into the other dbt project (DEC-AR-03)', async () => {
    const lineage = await reading.lineage(`source.${P}.shop.raw_orders`, 'downstream', 10);
    const distances = Object.fromEntries((lineage?.nodes ?? []).map((node) => [node.uniqueId, node.distance]));
    expect(distances).toEqual({
      [`source.${P}.shop.raw_orders`]: 0,
      [`model.${P}.orders`]: 1,
      [`model.${P}.order_lines`]: 1,
      [`model.${P}.customers`]: 2,
      [`snapshot.${P}.orders_history`]: 2,
      [`source.${C}.dbt_prod.orders`]: 2,
      [`exposure.${P}.sales_dashboard`]: 3,
      [`model.${C}.agency_orders`]: 3,
    });
    expect(lineage?.edges).toContainEqual({ parentId: `model.${P}.orders`, childId: `source.${C}.dbt_prod.orders` });
    expect(lineage?.truncated).toBe(false);
  });

  it('follows the lineage upstream, keeping the shortest distance, and only as deep as asked', async () => {
    const lineage = await reading.lineage(`model.${C}.agency_orders`, 'upstream', 10);
    const distances = Object.fromEntries((lineage?.nodes ?? []).map((node) => [node.name, node.distance]));
    expect(distances).toEqual({ agency_orders: 0, orders: 2, raw_orders: 3, countries: 3, order_lines: 3 });
    // Two Nodes are called orders: the source in Colleciónes, one step up, and the model in dbt-prod.
    expect(lineage?.nodes.filter((node) => node.name === 'orders').map((node) => [node.projectId, node.distance])).toEqual([
      ['17121', 1],
      ['9367', 2],
    ]);

    const near = await reading.lineage(`model.${P}.orders`, 'downstream', 1);
    expect(near?.nodes.map((node) => node.name).sort()).toEqual(['customers', 'orders', 'orders', 'orders_history']);
    expect(await reading.lineage(`model.${P}.retired`, 'downstream', 1)).toBeUndefined();
  });
});

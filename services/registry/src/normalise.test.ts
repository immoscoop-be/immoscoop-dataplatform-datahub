import { describe, expect, it } from 'vitest';
import { sampleCatalog, sampleManifest } from './fixtures.js';
import { normalise, relationOf } from './normalise.js';

const P = 'immoscoop_dataplatform_sql';

describe('normalise', () => {
  const set = normalise(sampleManifest(), sampleCatalog());
  const node = (id: string) => set.nodes.find((row) => row.uniqueId === id);

  it('reads the version of dbt and when the manifest was made', () => {
    expect(set).toMatchObject({ projectName: P, dbtVersion: '1.10.2', generatedAt: new Date('2026-10-18T07:27:00Z') });
  });

  it('keeps models, seeds, snapshots, sources and exposures as Nodes, and nothing else', () => {
    expect(set.nodes.map((row) => row.uniqueId).sort()).toEqual([
      `exposure.${P}.sales_dashboard`,
      `model.${P}.customers`,
      `model.${P}.order_lines`,
      `model.${P}.orders`,
      `seed.${P}.countries`,
      `snapshot.${P}.orders_history`,
      `source.${P}.shop.raw_orders`,
    ]);
    expect(node(`model.${P}.orders`)).toEqual({
      uniqueId: `model.${P}.orders`,
      resourceType: 'model',
      name: 'orders',
      packageName: P,
      databaseName: 'immoscoop-dataplatform',
      schemaName: 'dbt_marts',
      tableName: 'orders',
      relation: 'immoscoop-dataplatform.dbt_marts.orders',
      description: 'One row per order.',
      materialized: 'table',
      tags: ['marts', 'daily'],
      filePath: 'models/orders.sql',
      checksum: 'sum-orders',
    });
  });

  it('names the table a Node builds or reads, the same way in both projects', () => {
    expect(node(`model.${P}.customers`)?.relation).toBe('immoscoop-dataplatform.dbt_marts.dim_customers');
    expect(node(`source.${P}.shop.raw_orders`)?.relation).toBe('immoscoop-dataplatform.raw_shop.orders_export');
    expect(relationOf('`Immoscoop-Dataplatform`', '"dbt_marts"', 'Orders')).toBe('immoscoop-dataplatform.dbt_marts.orders');
    // An ephemeral model and an exposure build no table.
    expect(node(`model.${P}.order_lines`)).toMatchObject({ tableName: null, relation: null });
    expect(node(`exposure.${P}.sales_dashboard`)?.relation).toBeNull();
  });

  it('takes the actual columns from the catalog, with the descriptions of the manifest', () => {
    expect(set.columns.filter((column) => column.nodeId === `model.${P}.orders`)).toEqual([
      { nodeId: `model.${P}.orders`, name: 'ORDER_ID', position: 1, dataType: 'INT64', description: 'The order.' },
      { nodeId: `model.${P}.orders`, name: 'CUSTOMER_ID', position: 2, dataType: 'INT64', description: 'Who ordered.' },
      { nodeId: `model.${P}.orders`, name: 'CREATED_AT', position: 3, dataType: 'TIMESTAMP', description: 'From the warehouse.' },
    ]);
    // A Node the catalog does not know keeps the columns of the manifest, without an actual type.
    expect(set.columns.filter((column) => column.nodeId === `model.${P}.order_lines`)).toEqual([
      { nodeId: `model.${P}.order_lines`, name: 'line_id', position: 1, dataType: 'string', description: 'A line.' },
    ]);
  });

  it('links each Node to the Nodes it depends on, once, and only to Nodes', () => {
    const parents = (id: string) =>
      set.edges
        .filter((edge) => edge.childId === id)
        .map((edge) => edge.parentId)
        .sort();
    expect(parents(`model.${P}.orders`)).toEqual([`model.${P}.order_lines`, `seed.${P}.countries`, `source.${P}.shop.raw_orders`]);
    // The exposure also depends on a metric, which is not a Node.
    expect(parents(`exposure.${P}.sales_dashboard`)).toEqual([`model.${P}.customers`]);
    expect(parents(`snapshot.${P}.orders_history`)).toEqual([`model.${P}.orders`]);
  });

  it('attaches tests to their Node and column, and splits out the target of a relationships test', () => {
    expect(set.tests.sort((a, b) => a.uniqueId.localeCompare(b.uniqueId))).toEqual([
      {
        uniqueId: `test.${P}.not_null_orders_order_id.1a`,
        name: 'not_null',
        nodeId: `model.${P}.orders`,
        columnName: 'order_id',
        severity: 'error',
        targetNodeId: null,
        targetColumn: null,
      },
      {
        uniqueId: `test.${P}.relationships_orders_customer_id.2b`,
        name: 'relationships',
        nodeId: `model.${P}.orders`,
        columnName: 'customer_id',
        severity: 'warn',
        targetNodeId: `model.${P}.customers`,
        targetColumn: 'customer_key',
      },
      // A test on a source has no attached node in the manifest; its only dependency is the source.
      {
        uniqueId: `test.${P}.source_unique_shop_raw_orders_id.3c`,
        name: 'unique',
        nodeId: `source.${P}.shop.raw_orders`,
        columnName: 'id',
        severity: 'error',
        targetNodeId: null,
        targetColumn: null,
      },
    ]);
  });

  it('refuses Artifacts that are not a manifest and a catalog', () => {
    expect(() => normalise({}, sampleCatalog())).toThrow('The manifest has no nodes');
    expect(() => normalise(sampleManifest(), null)).toThrow('The catalog has no nodes');
  });
});

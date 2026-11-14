import { describe, expect, it } from 'vitest';
import { exposedTables } from './exposed.js';
import { sampleCatalog, sampleManifest } from './fixtures.js';
import { type NodeRow, type NormalisedSet, normalise } from './normalise.js';

const P = 'immoscoop_dataplatform_sql';

describe('the tables exposed to Data Hub', () => {
  it('takes every table under an exposure tagged datahub once, named by the label of an exposure on it alone (DEC-SR-24)', () => {
    const { tables, empty } = exposedTables(normalise(sampleManifest({ datahub: true }), sampleCatalog()));
    expect(tables).toEqual([
      {
        key: 'immoscoop-dataplatform.dbt_marts.countries',
        fullName: 'immoscoop-dataplatform.dbt_marts.countries',
        nodeId: `seed.${P}.countries`,
        name: 'countries',
        resourceType: 'seed',
        description: expect.any(String),
        exposures: ['datahub_marts'],
        label: null,
        checksum: 'sum-countries',
        columns: [{ name: 'code', position: 1, dataType: 'STRING', description: '' }],
        storage: null,
      },
      {
        key: 'immoscoop-dataplatform.dbt_marts.dim_customers',
        fullName: 'immoscoop-dataplatform.dbt_marts.dim_customers',
        nodeId: `model.${P}.customers`,
        name: 'customers',
        resourceType: 'model',
        description: expect.any(String),
        exposures: ['datahub_marts'],
        label: null,
        checksum: 'sum-customers',
        columns: [{ name: 'customer_key', position: 1, dataType: 'INT64', description: '' }],
        // Partitioned and clustered on columns the table does not have: nothing promised (OP-SR-12).
        storage: null,
      },
      {
        key: 'immoscoop-dataplatform.dbt_marts.orders',
        fullName: 'immoscoop-dataplatform.dbt_marts.orders',
        nodeId: `model.${P}.orders`,
        name: 'orders',
        resourceType: 'model',
        description: 'One row per order.',
        exposures: ['datahub_marts', 'datahub_orders'],
        label: 'Orders',
        // Its code for the Fingerprint, and its columns as the table has them (FR-SR-08, FR-SR-06).
        checksum: 'sum-orders',
        columns: [
          { name: 'ORDER_ID', position: 1, dataType: 'INT64', description: 'The order.' },
          { name: 'CUSTOMER_ID', position: 2, dataType: 'INT64', description: 'Who ordered.' },
          { name: 'CREATED_AT', position: 3, dataType: 'TIMESTAMP', description: 'From the warehouse.' },
        ],
        // Clustered on a column it has, by name in any case; its partition column it does not have.
        storage: { partition: null, clusterBy: ['CUSTOMER_ID'], requirePartitionFilter: false },
      },
    ]);
    // An ephemeral model builds no table, and a metric is no Node of registry (DEC-SR-23).
    expect(empty).toEqual(['datahub_lines']);
  });

  it('hands over how a view is stored as the model beneath it says, for the columns it passes through (DEC-SR-34)', () => {
    const node = (uniqueId: string, resourceType: string, relation: string | null, storage: Partial<NodeRow> = {}): NodeRow => ({
      uniqueId,
      resourceType,
      name: uniqueId.split('.').pop()!,
      packageName: 'colleciones',
      databaseName: relation ? 'p' : null,
      schemaName: relation ? 'd' : null,
      tableName: relation ? uniqueId.split('.').pop()! : null,
      relation,
      description: '',
      materialized: resourceType === 'model' ? 'view' : null,
      tags: resourceType === 'exposure' ? ['datahub'] : [],
      filePath: null,
      checksum: null,
      meta: {},
      entity: null,
      action: null,
      strategy: null,
      layer: null,
      partitionField: null,
      partitionUnit: null,
      clusterBy: [],
      requirePartitionFilter: false,
      ...storage,
    });
    const set: NormalisedSet = {
      projectName: 'colleciones',
      dbtVersion: null,
      generatedAt: null,
      nodes: [
        node('model.c.stg_events', 'model', 'p.d.stg_events', { partitionField: 'collectorDatetime', partitionUnit: 'day', clusterBy: ['entity', 'action'], requirePartitionFilter: true }),
        node('model.c.intm_flat', 'model', 'p.d.intm_flat'),
        node('exposure.c.datahub_flat', 'exposure', null),
      ],
      columns: ['eventId', 'collectorDatetime', 'entity'].map((name, index) => ({ nodeId: 'model.c.intm_flat', name, position: index + 1, dataType: 'STRING', description: '', meta: {} })),
      edges: [
        { parentId: 'model.c.stg_events', childId: 'model.c.intm_flat' },
        { parentId: 'model.c.intm_flat', childId: 'exposure.c.datahub_flat' },
      ],
      tests: [],
      labels: {},
    };
    const [table] = exposedTables(set).tables;
    // The view has no partition of its own; the model beneath it does, and it passes collectorDatetime and entity
    // through. BigQuery requires a filter on it, so a query on the view needs one too.
    expect(table?.storage).toEqual({ partition: { field: 'collectorDatetime', unit: 'day' }, clusterBy: ['entity'], requirePartitionFilter: true });
  });

  it('finds the tag in the config of an exposure too, where dbt Fusion may keep it', () => {
    const manifest = sampleManifest({ datahub: true });
    const exposure = manifest.exposures['exposure.immoscoop_dataplatform_sql.datahub_orders'] as Record<string, unknown>;
    exposure.tags = [];
    exposure.config = { tags: ['datahub'] };
    expect(exposedTables(normalise(manifest, sampleCatalog())).tables.find((table) => table.name === 'orders')?.exposures).toEqual(['datahub_marts', 'datahub_orders']);
  });

  it('keeps the full name in its own case next to the Key in lower case, as BigQuery names are case-sensitive', () => {
    const manifest = sampleManifest({ datahub: true });
    const orders = manifest.nodes[`model.${P}.orders`] as Record<string, unknown>;
    orders.alias = 'mrt_ordersPerDay';
    orders.schema = 'Dbt_Marts';
    const table = exposedTables(normalise(manifest, sampleCatalog())).tables.find((one) => one.name === 'orders');
    expect(table).toMatchObject({ key: 'immoscoop-dataplatform.dbt_marts.mrt_ordersperday', fullName: 'immoscoop-dataplatform.Dbt_Marts.mrt_ordersPerDay' });
  });

  it('ignores exposures without the tag, such as a dashboard', () => {
    expect(exposedTables(normalise(sampleManifest(), sampleCatalog()))).toEqual({ tables: [], empty: [] });
  });
});

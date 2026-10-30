import { describe, expect, it } from 'vitest';
import { exposedTables } from './exposed.js';
import { sampleCatalog, sampleManifest } from './fixtures.js';
import { normalise } from './normalise.js';

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
      },
    ]);
    // An ephemeral model builds no table, and a metric is no Node of registry (DEC-SR-23).
    expect(empty).toEqual(['datahub_lines']);
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

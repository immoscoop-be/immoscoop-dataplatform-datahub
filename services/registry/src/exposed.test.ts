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
        nodeId: `seed.${P}.countries`,
        name: 'countries',
        resourceType: 'seed',
        description: expect.any(String),
        exposures: ['datahub_marts'],
        label: null,
      },
      {
        key: 'immoscoop-dataplatform.dbt_marts.dim_customers',
        nodeId: `model.${P}.customers`,
        name: 'customers',
        resourceType: 'model',
        description: expect.any(String),
        exposures: ['datahub_marts'],
        label: null,
      },
      {
        key: 'immoscoop-dataplatform.dbt_marts.orders',
        nodeId: `model.${P}.orders`,
        name: 'orders',
        resourceType: 'model',
        description: 'One row per order.',
        exposures: ['datahub_marts', 'datahub_orders'],
        label: 'Orders',
      },
    ]);
    // An ephemeral model builds no table, and a metric is no Node of registry (DEC-SR-23).
    expect(empty).toEqual(['datahub_lines']);
  });

  it('ignores exposures without the tag, such as a dashboard', () => {
    expect(exposedTables(normalise(sampleManifest(), sampleCatalog()))).toEqual({ tables: [], empty: [] });
  });
});

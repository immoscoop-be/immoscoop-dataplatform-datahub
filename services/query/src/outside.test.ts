import { describe, expect, it } from 'vitest';
import type { TableInfo } from './bigquery.js';
import { outsideTable } from './outside.js';
import type { KnownTable } from './registry.js';

const TABLE: KnownTable = {
  key: 'p.dbt_prod_staging.stg_leads',
  fullName: 'p.dbt_prod_staging.stg_leads',
  name: 'stg_leads',
  resourceType: 'model',
  layer: 'staging',
  projectId: '9367',
  projectName: 'dbt-prod',
  resource: false,
  partition: { field: 'created_date', unit: 'day' },
  clusterBy: ['lead_source'],
  materialized: 'incremental',
  description: 'One row per lead.',
  columns: [
    { name: 'lead_id', dataType: 'STRING', description: 'Id of the lead.' },
    { name: 'utm', dataType: 'STRUCT<source STRING>', description: 'The UTM parameters.' },
    { name: 'lead_source', dataType: 'STRING', description: '' },
    { name: 'created_date', dataType: 'DATE', description: 'Day it was created.' },
  ],
};

const LIVE: TableInfo = {
  type: 'TABLE',
  bytes: 10,
  rows: 2,
  partitions: 1,
  partitionField: 'created_date',
  modifiedAt: null,
  description: 'From BigQuery.',
  partition: { field: 'created_date', unit: 'day', required: true },
  clusterBy: ['lead_source'],
  columns: [
    { name: 'lead_id', type: 'STRING', description: 'BigQuery says: id.' },
    { name: 'utm', type: 'STRUCT', description: '' },
    { name: 'utm.source', type: 'STRING', description: 'Where the visit came from.' },
    { name: 'lead_source', type: 'STRING', description: 'Source system code.' },
    { name: 'Created_Date', type: 'DATE', description: '' },
  ],
};

describe('what Data Hub knows of a table outside it (FR-SR-62, OP-UX-89)', () => {
  it('takes the descriptions from dbt and the facts and types from BigQuery, the partition and cluster columns first', () => {
    const view = outsideTable(TABLE, LIVE);
    expect(view).toMatchObject({ description: 'One row per lead.', materialized: 'incremental', bigquery: { type: 'TABLE', bytes: 10 }, partition: { required: true } });
    expect(view.columns.map((column) => [column.name, column.type, column.description, column.from, column.partition, column.cluster])).toEqual([
      // A name in another case is the same column, as BigQuery reads names.
      ['Created_Date', 'DATE', 'Day it was created.', 'dbt', true, null],
      ['lead_source', 'STRING', 'Source system code.', 'bigquery', false, 1],
      ['lead_id', 'STRING', 'Id of the lead.', 'dbt', false, null],
      // A STRUCT keeps its fields right under it.
      ['utm', 'STRUCT', 'The UTM parameters.', 'dbt', false, null],
      ['utm.source', 'STRING', 'Where the visit came from.', 'bigquery', false, null],
    ]);
  });

  it('shows what dbt knew when BigQuery does not answer, without saying BigQuery asks a filter', () => {
    const view = outsideTable(TABLE, null);
    expect(view).toMatchObject({ bigquery: null, partition: { field: 'created_date', unit: 'day', required: false }, clusterBy: ['lead_source'] });
    expect(view.columns.map((column) => [column.name, column.type])).toEqual([
      ['created_date', 'DATE'],
      ['lead_source', 'STRING'],
      ['lead_id', 'STRING'],
      ['utm', 'STRUCT<source STRING>'],
    ]);
  });

  it('takes the description of BigQuery where dbt has none', () => {
    expect(outsideTable({ ...TABLE, description: '' }, LIVE).description).toBe('From BigQuery.');
    expect(outsideTable({ ...TABLE, description: '' }, null).description).toBe('');
  });
});

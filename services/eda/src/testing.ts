import { type CatalogueResource, type EdaSource, sourceOf } from './catalogue.js';

/**
 * The Resources the tests of eda work on, as `GET /resources/{id}` of catalogue answers them. Weekly lead volume is
 * the aggregate the screens draw: one row per week and lead source, partitioned on its week, with a filter Data Hub
 * requires (DEC-SR-35).
 */
export const CREDIT = { id: '5d0c1b2a-3e4f-4a5b-8c6d-7e8f9a0b1c2d', name: 'Credit leads' };

export const WEEKLY_ANSWER: CatalogueResource = {
  id: '6f1c2b4e-8a1d-4c3e-9f20-1b2c3d4e5f60',
  key: 'immoscoop-dataplatform.dbt_prod_stacks.weekly_lead_volume',
  fullName: 'immoscoop-dataplatform.dbt_prod_stacks.Weekly_Lead_Volume',
  displayName: 'Weekly lead volume',
  collectionId: CREDIT.id,
  level: 3,
  explored: false,
  fields: [
    { name: 'week_start', dataType: 'DATE' },
    { name: 'lead_source', dataType: 'STRING' },
    { name: 'lead_count', dataType: 'INT64' },
    { name: 'lead_channel', dataType: 'STRING' },
    { name: 'lead_origin', dataType: 'STRING' },
    { name: 'unique_applicants', dataType: 'INT64' },
    { name: 'loaded_at', dataType: 'TIMESTAMP' },
  ],
  details: {
    partition: { field: 'week_start', unit: 'day' },
    partitionFilter: 'dataHub',
    grain: ['week_start', 'lead_source'],
    modelType: 'aggregate',
    typeFields: [
      { field: 'week_start', role: 'period' },
      { field: 'lead_source', role: 'groupedBy' },
      { field: 'lead_count', role: 'addsUp' },
      { field: 'unique_applicants', role: 'uniqueCount' },
    ],
    mappings: [{ field: 'lead_source' }],
  },
  // Chosen in another order than the fields: the Resource Card keeps the order of the fields (DEC-UX-323).
  card: { keyFields: ['lead_count', 'week_start', 'lead_source', 'lead_channel'] },
};

export const WEEKLY: EdaSource = sourceOf(WEEKLY_ANSWER);

/** Leads, an event without a partition filter: one row per lead, when it came in and its price. */
export const LEADS_ANSWER: CatalogueResource = {
  id: '7a2d3c5f-9b2e-4d4f-8a31-2c3d4e5f6a71',
  key: 'immoscoop-dataplatform.dbt_prod_stacks.leads',
  displayName: 'Leads',
  collectionId: CREDIT.id,
  level: 4,
  fields: [
    { name: 'lead_id', dataType: 'STRING' },
    { name: 'created_at', dataType: 'TIMESTAMP' },
    { name: 'price', dataType: 'NUMERIC(12, 2)' },
    { name: 'channel', dataType: 'STRING' },
  ],
  details: { partition: { field: 'created_at', unit: 'day' }, partitionFilter: 'none', grain: ['lead_id'], modelType: 'event', typeFields: [{ field: 'created_at', role: 'happenedAt' }], mappings: [] },
  card: { keyFields: ['lead_id', 'created_at', 'price', 'channel'] },
};

export const LEADS: EdaSource = sourceOf(LEADS_ANSWER);

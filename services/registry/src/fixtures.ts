/**
 * A small dbt project in the shape of real Artifacts, for the tests: a source, a seed, a model built
 * on both, an ephemeral model, a snapshot, an exposure, four tests and an analysis that does not count.
 */
export function sampleManifest(overrides: { generatedAt?: string; ordersDescription?: string; datahub?: boolean } = {}) {
  const model = (name: string, extra: Record<string, unknown> = {}) => ({
    resource_type: 'model',
    name,
    alias: name,
    package_name: 'immoscoop_dataplatform_sql',
    database: 'immoscoop-dataplatform',
    schema: 'dbt_marts',
    original_file_path: `models/${name}.sql`,
    checksum: { name: 'sha256', checksum: `sum-${name}` },
    config: { materialized: 'view' },
    tags: [],
    description: '',
    columns: {},
    depends_on: { nodes: [] },
    ...extra,
  });
  const test = (name: string, extra: Record<string, unknown>) => ({
    resource_type: 'test',
    name,
    package_name: 'immoscoop_dataplatform_sql',
    config: { severity: 'ERROR' },
    ...extra,
  });
  return {
    metadata: { dbt_version: '1.10.2', project_name: 'immoscoop_dataplatform_sql', generated_at: overrides.generatedAt ?? '2026-10-18T07:27:00Z' },
    nodes: {
      'model.immoscoop_dataplatform_sql.orders': model('orders', {
        description: overrides.ordersDescription ?? 'One row per order.',
        tags: ['marts', 'daily'],
        config: { materialized: 'table', meta: { model: { kind: 'history', grain: 'stateChange' } } },
        meta: {
          model: { kind: 'outdated' },
          domain: { entity: 'order', entityDescription: '', identifiers: [{ name: 'orderId', type: 'string' }], performedBy: ['user', 'visitor'] },
        },
        columns: {
          order_id: { name: 'order_id', description: 'The order.' },
          customer_id: { name: 'customer_id', description: 'Who ordered.' },
          ghost: { name: 'ghost', description: 'Documented, but not in the table.' },
        },
        depends_on: {
          nodes: [
            'source.immoscoop_dataplatform_sql.shop.raw_orders',
            'seed.immoscoop_dataplatform_sql.countries',
            'model.immoscoop_dataplatform_sql.order_lines',
            'source.immoscoop_dataplatform_sql.shop.raw_orders',
          ],
        },
      }),
      'model.immoscoop_dataplatform_sql.order_lines': model('order_lines', {
        config: { materialized: 'ephemeral' },
        columns: { line_id: { name: 'line_id', description: 'A line.', data_type: 'string' } },
        depends_on: { nodes: ['source.immoscoop_dataplatform_sql.shop.raw_orders'] },
      }),
      'model.immoscoop_dataplatform_sql.customers': model('customers', {
        alias: 'dim_customers',
        depends_on: { nodes: ['model.immoscoop_dataplatform_sql.orders'] },
      }),
      'seed.immoscoop_dataplatform_sql.countries': {
        ...model('countries'),
        resource_type: 'seed',
        config: { materialized: 'seed' },
        checksum: { name: 'sha256', checksum: 'sum-countries' },
      },
      'snapshot.immoscoop_dataplatform_sql.orders_history': {
        ...model('orders_history'),
        resource_type: 'snapshot',
        config: { materialized: 'snapshot' },
        depends_on: { nodes: ['model.immoscoop_dataplatform_sql.orders'] },
      },
      'test.immoscoop_dataplatform_sql.not_null_orders_order_id.1a': test('not_null_orders_order_id', {
        attached_node: 'model.immoscoop_dataplatform_sql.orders',
        column_name: 'order_id',
        test_metadata: { name: 'not_null', kwargs: { column_name: 'order_id' } },
        depends_on: { nodes: ['model.immoscoop_dataplatform_sql.orders'] },
      }),
      'test.immoscoop_dataplatform_sql.relationships_orders_customer_id.2b': test('relationships_orders_customer_id', {
        attached_node: 'model.immoscoop_dataplatform_sql.orders',
        column_name: 'customer_id',
        config: { severity: 'warn' },
        test_metadata: { name: 'relationships', kwargs: { column_name: 'customer_id', to: "ref('customers')", field: 'customer_key' } },
        depends_on: { nodes: ['model.immoscoop_dataplatform_sql.customers', 'model.immoscoop_dataplatform_sql.orders'] },
      }),
      'test.immoscoop_dataplatform_sql.source_unique_shop_raw_orders_id.3c': test('source_unique_shop_raw_orders_id', {
        column_name: 'id',
        test_metadata: { name: 'unique', kwargs: { column_name: 'id' } },
        depends_on: { nodes: ['source.immoscoop_dataplatform_sql.shop.raw_orders'] },
      }),
      'test.immoscoop_dataplatform_sql.orders_match_customers': test('orders_match_customers', {
        depends_on: { nodes: ['model.immoscoop_dataplatform_sql.orders', 'model.immoscoop_dataplatform_sql.customers'] },
      }),
      'analysis.immoscoop_dataplatform_sql.scratch': { ...model('scratch'), resource_type: 'analysis' },
    },
    sources: {
      'source.immoscoop_dataplatform_sql.shop.raw_orders': {
        resource_type: 'source',
        name: 'raw_orders',
        source_name: 'shop',
        identifier: 'orders_export',
        package_name: 'immoscoop_dataplatform_sql',
        database: 'Immoscoop-Dataplatform',
        schema: 'raw_shop',
        description: 'Orders as the shop exports them.',
        columns: { id: { name: 'id', description: 'The id in the shop.' } },
      },
    },
    exposures: {
      'exposure.immoscoop_dataplatform_sql.sales_dashboard': {
        resource_type: 'exposure',
        name: 'sales_dashboard',
        package_name: 'immoscoop_dataplatform_sql',
        description: 'The sales dashboard.',
        depends_on: { nodes: ['model.immoscoop_dataplatform_sql.customers', 'metric.immoscoop_dataplatform_sql.revenue'] },
      },
      // Exposures for Data Hub (DEC-SR-22), when asked: one per table with a label, one for several
      // tables without, and one on an ephemeral model only.
      ...(overrides.datahub ? datahubExposures() : {}),
    },
  };
}

function datahubExposures() {
  const exposure = (name: string, nodes: string[], extra: Record<string, unknown> = {}) => ({
    resource_type: 'exposure',
    name,
    package_name: 'immoscoop_dataplatform_sql',
    type: 'application',
    owner: { name: 'Data Team', email: 'datahub-datateam@thenextimmoscoop.be' },
    tags: ['datahub'],
    description: '',
    depends_on: { nodes },
    ...extra,
  });
  return {
    'exposure.immoscoop_dataplatform_sql.datahub_orders': exposure('datahub_orders', ['model.immoscoop_dataplatform_sql.orders'], { label: 'Orders' }),
    'exposure.immoscoop_dataplatform_sql.datahub_marts': exposure('datahub_marts', [
      'model.immoscoop_dataplatform_sql.orders',
      'model.immoscoop_dataplatform_sql.customers',
      'seed.immoscoop_dataplatform_sql.countries',
      'metric.immoscoop_dataplatform_sql.revenue',
    ], { label: 'All the marts' }),
    'exposure.immoscoop_dataplatform_sql.datahub_lines': exposure('datahub_lines', ['model.immoscoop_dataplatform_sql.order_lines'], { label: 'Order lines' }),
  };
}

export function sampleCatalog() {
  return {
    metadata: { generated_at: '2026-10-18T07:27:30Z' },
    nodes: {
      'model.immoscoop_dataplatform_sql.orders': {
        metadata: { type: 'table', name: 'orders' },
        columns: {
          ORDER_ID: { name: 'ORDER_ID', type: 'INT64', index: 1, comment: null },
          CUSTOMER_ID: { name: 'CUSTOMER_ID', type: 'INT64', index: 2, comment: null },
          CREATED_AT: { name: 'CREATED_AT', type: 'TIMESTAMP', index: 3, comment: 'From the warehouse.' },
        },
      },
      'model.immoscoop_dataplatform_sql.customers': {
        metadata: { type: 'view', name: 'dim_customers' },
        columns: { customer_key: { name: 'customer_key', type: 'INT64', index: 1, comment: null } },
      },
      'seed.immoscoop_dataplatform_sql.countries': {
        metadata: { type: 'table', name: 'countries' },
        columns: { code: { name: 'code', type: 'STRING', index: 1, comment: null } },
      },
    },
    sources: {
      'source.immoscoop_dataplatform_sql.shop.raw_orders': {
        metadata: { type: 'table', name: 'orders_export' },
        columns: { id: { name: 'id', type: 'INT64', index: 1, comment: null } },
      },
    },
  };
}

/**
 * A second project in the shape of Colleciónes: a source that reads the table the `orders` model of
 * the first project builds, and a model on that source. The two are linked by that table (DEC-AR-03).
 */
export function collecionesManifest() {
  const P = 'compilacion_colleciones_dbt';
  return {
    metadata: { dbt_version: '2.0.0-fusion', project_name: P, generated_at: '2026-10-18T06:09:00Z' },
    nodes: {
      [`model.${P}.agency_orders`]: {
        resource_type: 'model',
        name: 'agency_orders',
        alias: 'agency_orders',
        package_name: P,
        database: 'immoscoop-dataplatform',
        schema: 'dbt_colleciones',
        original_file_path: 'models/agency_orders.sql',
        checksum: { name: 'sha256', checksum: 'sum-agency-orders' },
        config: { materialized: 'table' },
        tags: [],
        description: 'Orders per agency, for the agencies case.',
        columns: { agency_id: { name: 'agency_id', description: 'The agency.' } },
        depends_on: { nodes: [`source.${P}.dbt_prod.orders`] },
      },
    },
    sources: {
      [`source.${P}.dbt_prod.orders`]: {
        resource_type: 'source',
        name: 'orders',
        source_name: 'dbt_prod',
        identifier: 'orders',
        package_name: P,
        database: 'immoscoop-dataplatform',
        schema: 'dbt_marts',
        description: 'The orders that dbt-prod builds.',
        columns: {},
      },
    },
    exposures: {},
  };
}

export function collecionesCatalog() {
  const P = 'compilacion_colleciones_dbt';
  return {
    nodes: {
      [`model.${P}.agency_orders`]: { columns: { agency_id: { name: 'agency_id', type: 'STRING', index: 1 } } },
    },
    sources: {
      [`source.${P}.dbt_prod.orders`]: { columns: { ORDER_ID: { name: 'ORDER_ID', type: 'INT64', index: 1 } } },
    },
  };
}

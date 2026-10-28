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
        config: {
          materialized: 'table',
          meta: { model: { kind: 'history', grain: 'stateChange' } },
          partition_by: { field: 'ordered_at', data_type: 'timestamp', granularity: 'month' },
          cluster_by: 'customer_id',
          require_partition_filter: true,
        },
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
        config: { materialized: 'table', partition_by: { field: 'customer_id', data_type: 'int64', range: { start: 0, end: 100, interval: 10 } }, cluster_by: ['country', 'customer_id'] },
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
        // The facts the generator of Colleciónes writes on every model, and per column (DEC-AR-07).
        tags: ['colleciones:entity:agency', 'colleciones:action:order', 'colleciones:strategy:AtomicEvent', 'colleciones:layer:mrt'],
        description: 'Orders per agency, for the agencies case.',
        columns: {
          agency_id: { name: 'agency_id', description: 'The agency.', config: { meta: { domain: { maps: 'is', entity: 'agency', identifier: 'agencyId' } } } },
        },
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

/**
 * A small Domain Model in the shape of the runtime contract the collector of Colleciónes answers with
 * (DEC-AR-04), taken from `@compilacion/colleciones-domain-model` 0.0.70: a few Entities, an event with
 * its actors and references, and relation types with their inverses.
 */
export function domainModelContract() {
  const entity = (identifiers: string[], extra: Record<string, unknown> = {}) => ({
    description: '',
    identifiers: Object.fromEntries(identifiers.map((name) => [name, { description: '', datatype: 'identifier', primitiveDatatype: 'string' }])),
    adjectives: {},
    attributes: {},
    references: [],
    actions: {},
    ...extra,
  });
  return {
    meta: { domain: 'immoscoop', version: '0.1.0', release: { version: '0.0.70', name: 'v0.0.70', tag: 'v0.0.70', commit: '84d3030' } },
    entities: {
      subject: entity(['subjectId']),
      user: entity(['subjectId', 'userId']),
      visitor: entity(['subjectId', 'userId', 'visitorId']),
      session: entity(['sessionId']),
      property: entity(['propertyId']),
      listing: entity(['listingId'], {
        references: [{ type: 'represents', target: 'property', cardinality: 'one' }],
        actions: { view: { performedBy: ['subject', 'visitor'], references: [{ target: 'session', type: 'occurredWithin', cardinality: 'one' }] } },
      }),
      activationCampaign: entity(['campaignId', 'activationCampaignId']),
      homeLoanSimulation: entity(['homeLoanSimulationId'], {
        references: [{ type: 'basedOn', target: 'listing', cardinality: 'one' }],
        actions: {
          generate: {
            performedBy: ['subject', 'visitor', 'user'],
            references: [
              { target: 'activationCampaign', type: 'placedIn', cardinality: 'many' },
              { target: 'listing', type: 'basedOn', cardinality: 'one' },
              { target: 'session', type: 'occurredWithin', cardinality: 'one' },
            ],
          },
        },
      }),
      agency: entity(['subjectId', 'agencyId']),
      office: entity(['subjectId', 'officeId']),
    },
    contexts: {},
    eventGroups: {},
    actors: ['subject', 'system', 'visitor', 'emailAddress'],
    domains: {},
    vocabulary: {
      relationTypes: {
        basedOn: { transpose: false, cardinality: ['one', 'many'], description: 'Derived from or about a source entity.', inverse: 'basisFor' },
        basisFor: { transpose: false, cardinality: ['many'], description: 'The basis for subjects derived from it.', inverse: 'basedOn' },
        occurredWithin: { transpose: true, cardinality: ['one'], description: 'The event took place within this context.', inverse: 'contextFor' },
        contextFor: { transpose: false, cardinality: ['many'], description: 'Hosts the events within it.', inverse: 'occurredWithin' },
        placedIn: { transpose: false, cardinality: ['one', 'many'], description: 'Placement or grouping.', inverse: 'placementFor' },
        placementFor: { transpose: false, cardinality: ['many'], description: 'The placement of the elements.', inverse: 'placedIn' },
        represents: { transpose: false, cardinality: ['one', 'many'], description: 'The concrete manifestation of a definition.', inverse: 'isRepresentedBy' },
        isRepresentedBy: { transpose: true, cardinality: ['many'], description: 'Represented by its manifestations.', inverse: 'represents' },
        hasType: { transpose: false, cardinality: ['one'], description: 'Classification against a type vocabulary.', inverse: 'classifies' },
        classifies: { transpose: false, cardinality: ['many'], description: 'Classifies its instances.', inverse: 'hasType' },
      },
      datatypes: {},
      actions: {},
    },
  };
}

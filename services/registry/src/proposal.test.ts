import { describe, expect, it } from 'vitest';
import { parseDomainModel } from './domain-model.js';
import { domainModelContract } from './fixtures.js';
import { propose } from './proposal.js';
import type { NodeDetail } from './reading.js';

const model = parseDomainModel(domainModelContract());

function node(name: string, columns: string[], extra: Partial<NodeDetail> = {}): NodeDetail {
  return {
    uniqueId: `model.p.${name}`,
    name,
    resourceType: 'model',
    projectId: '17121',
    projectName: 'p',
    description: '',
    relation: null,
    packageName: 'p',
    databaseName: null,
    schemaName: null,
    tableName: null,
    materialized: 'table',
    tags: [],
    filePath: null,
    meta: {},
    entity: null,
    action: null,
    strategy: null,
    layer: null,
    partitionField: null,
    partitionUnit: null,
    clusterBy: [],
    requirePartitionFilter: false,
    columns: columns.map((column, index) => ({ name: column, position: index + 1, dataType: 'STRING', description: '', meta: {} })),
    tests: [],
    ...extra,
  };
}

/** The mart of Colleciónes with the generated simulations: an event, partitioned and clustered. */
const generated = node('mrt_homeLoanSimulation_generate', ['eventId', 'homeLoanSimulationId', 'listingId', 'sessionId', 'visitorId', 'creditAmount', 'collectorDatetime'], {
  entity: 'homeLoanSimulation',
  action: 'generate',
  strategy: 'Event',
  layer: 'mrt',
  meta: { model: { grain: 'event' } },
  partitionField: 'collectorDatetime',
  partitionUnit: 'day',
  clusterBy: ['homeLoanSimulationId', 'listingId', 'campaignId'],
  requirePartitionFilter: true,
});

describe('what Data Hub proposes for a Resource (FR-CO-33, FR-CO-34, FR-AR-17)', () => {
  it('takes everything of a Colleciónes event from the Domain Model, and its storage from dbt', () => {
    const proposal = propose(generated, { stored: generated, colleciones: generated }, model);
    expect(proposal).toMatchObject({
      builtOn: { name: 'mrt_homeLoanSimulation_generate', entity: 'homeLoanSimulation', action: 'generate', colleciones: true },
      // A cluster column the table does not have promises nothing.
      storage: { partition: { field: 'collectorDatetime', unit: 'day' }, clusterBy: ['homeLoanSimulationId', 'listingId'], requirePartitionFilter: true, from: 'mrt_homeLoanSimulation_generate' },
      grain: { fields: ['eventId'], origin: 'domainModel' },
      modelType: { value: 'event', origin: 'domainModel' },
      domainModel: { release: '0.0.70' },
    });
    expect(proposal.mappings).toEqual([
      { field: 'eventId', kind: 'is', relationType: null, identity: 'homeLoanSimulation.generate', origin: 'domainModel' },
      { field: 'homeLoanSimulationId', kind: 'is', relationType: null, identity: 'homeLoanSimulation.homeLoanSimulationId', origin: 'domainModel' },
      { field: 'listingId', kind: 'relation', relationType: 'basedOn', identity: 'listing.listingId', origin: 'domainModel' },
      { field: 'sessionId', kind: 'relation', relationType: 'occurredWithin', identity: 'session.sessionId', origin: 'domainModel' },
      { field: 'visitorId', kind: 'performedBy', relationType: null, identity: 'visitor.visitorId', origin: 'domainModel' },
    ]);
  });

  it('reads a view through its lineage: the model beneath for its storage, its Entity and the meta of its columns', () => {
    const view = node('credit_simulations', ['eventId', 'listingId', 'visitorId', 'collectorDate'], { materialized: 'view' });
    const withMeta = {
      ...generated,
      columns: generated.columns.map((column) =>
        column.name === 'listingId' ? { ...column, meta: { domain: { maps: 'relation', type: 'references', entity: 'listing', identifier: 'listingId', cardinality: 'one' } } } : column,
      ),
    };
    const proposal = propose(view, { stored: withMeta, colleciones: withMeta }, model);
    // The view derives its own date: no partition column passes through, so none is promised (OP-SR-12).
    expect(proposal.storage).toEqual({ partition: null, clusterBy: ['listingId'], requirePartitionFilter: false, from: 'mrt_homeLoanSimulation_generate' });
    expect(proposal.builtOn).toMatchObject({ name: 'mrt_homeLoanSimulation_generate', colleciones: true });
    // What the manifest says per column comes before what Data Hub derives (DEC-AR-07).
    expect(proposal.mappings.find((mapping) => mapping.field === 'listingId')).toEqual({
      field: 'listingId',
      kind: 'relation',
      relationType: 'references',
      identity: 'listing.listingId',
      origin: 'domainModel',
    });
  });

  it('suggests from the names of the fields for a model outside Colleciónes, and its grain from a unique test', () => {
    const reviews = node('mrt_agencyReviews', ['reviewId', 'agencyId', 'officeId', 'cityId', 'userId', 'subjectId', 'campaignId'], {
      tests: [{ name: 'unique', columnName: 'reviewId', severity: 'error', targetNodeId: null, targetColumn: null }],
    });
    const proposal = propose(reviews, {}, model);
    expect(proposal).toMatchObject({
      builtOn: { name: 'mrt_agencyReviews', colleciones: false },
      storage: { partition: null, clusterBy: [], from: null },
      grain: { fields: ['reviewId'], origin: 'test' },
      modelType: null,
    });
    // An identifier of one Entity goes to it; one several Entities share, to the one named after it.
    expect(proposal.mappings.map((mapping) => [mapping.field, mapping.identity, mapping.origin])).toEqual([
      ['agencyId', 'agency.agencyId', 'name'],
      ['officeId', 'office.officeId', 'name'],
      ['userId', 'user.userId', 'name'],
      ['subjectId', 'subject.subjectId', 'name'],
      ['campaignId', 'activationCampaign.campaignId', 'name'],
    ]);
  });

  it('guesses nothing from the Domain Model when the collector did not answer (EC-AR-05)', () => {
    const proposal = propose(generated, { stored: generated, colleciones: generated }, null);
    expect(proposal.domainModel).toBeNull();
    expect(proposal.mappings).toEqual([]);
    // What dbt says stays.
    expect(proposal.storage.partition).toEqual({ field: 'collectorDatetime', unit: 'day' });
  });
});

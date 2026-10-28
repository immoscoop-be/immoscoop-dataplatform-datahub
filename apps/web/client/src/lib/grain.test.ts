import { describe, expect, it } from 'vitest';
import type { ResourceDetail } from './catalogue.js';
import { cardinalityOf, draftOf, nounOf, requestOf, strangers, subjectOf, unfinished } from './grain.js';
import type { Proposal } from './registry.js';

const resource = (fields: string[]): ResourceDetail => ({
  id: 'r1',
  key: 'p.d.credit_simulations',
  displayName: 'Credit simulations',
  name: 'credit_simulations',
  resourceType: 'model',
  projectId: '9367',
  projectName: 'p',
  nodeId: 'model.p.credit_simulations',
  description: '',
  exposures: [],
  collectionId: null,
  level: 1,
  registeredAt: '2026-10-22T08:00:00Z',
  withdrawn: false,
  fields: fields.map((name, index) => ({ name, position: index + 1, dataType: 'STRING', description: '' })),
  leftOut: [{ name: 'identifiers', dataType: 'ARRAY<STRING>', reason: 'array' }],
});

const proposal: Proposal = {
  nodeId: 'model.p.credit_simulations',
  builtOn: { name: 'mrt_homeLoanSimulation_generate', entity: 'homeLoanSimulation', action: 'generate', colleciones: true },
  storage: { partition: { field: 'collectorDatetime', unit: 'day' }, clusterBy: ['listingId'], requirePartitionFilter: true, from: 'mrt_homeLoanSimulation_generate' },
  grain: { fields: ['eventId'], origin: 'domainModel' },
  modelType: { value: 'event', origin: 'domainModel' },
  mappings: [
    { field: 'eventId', kind: 'is', relationType: null, identity: 'homeLoanSimulation.generate', origin: 'domainModel' },
    { field: 'homeLoanSimulationId', kind: 'is', relationType: null, identity: 'homeLoanSimulation.homeLoanSimulationId', origin: 'domainModel' },
    { field: 'listingId', kind: 'relation', relationType: 'basedOn', identity: 'listing.listingId', origin: 'domainModel' },
    { field: 'visitorId', kind: 'performedBy', relationType: null, identity: 'visitor.visitorId', origin: 'domainModel' },
  ],
  domainModel: { release: '0.0.70' },
};

const fields = ['eventId', 'homeLoanSimulationId', 'listingId', 'visitorId', 'collectorDatetime', 'cityId'];
const types = new Map([
  ['basedOn', 'either' as const],
  ['occurredWithin', 'one' as const],
  ['contains', 'many' as const],
]);
const identities = new Set(['homeLoanSimulation.generate', 'homeLoanSimulation.homeLoanSimulationId', 'listing.listingId', 'visitor.visitorId']);

describe('the grain and relations of a Resource being added (FR-CO-33, FR-CO-34)', () => {
  it('start from what registry proposes, each with where it came from', () => {
    const draft = draftOf(resource(fields), proposal);
    expect(draft).toMatchObject({
      partition: { field: 'collectorDatetime', unit: 'day' },
      clusterBy: ['listingId'],
      partitionFilter: 'bigQuery',
      filterLocked: true,
      grain: ['eventId'],
      modelType: 'event',
      origins: { partition: 'dbt', clusterBy: 'dbt', partitionFilter: 'dbt', grain: 'domainModel', modelType: 'domainModel' },
      release: '0.0.70',
    });
    expect(draft.fields.map((field) => [field.name, field.kind, field.origin])).toEqual([
      ['eventId', 'is', 'domainModel'],
      ['homeLoanSimulationId', 'is', 'domainModel'],
      ['listingId', 'relation', 'domainModel'],
      ['visitorId', 'performedBy', 'domainModel'],
      ['collectorDatetime', 'none', 'here'],
      ['cityId', 'none', 'here'],
    ]);
  });

  it('start from the fields alone without a proposal, nothing required', () => {
    const draft = draftOf(resource(['a']), null);
    expect(draft).toMatchObject({ partition: null, clusterBy: [], partitionFilter: 'none', filterLocked: false, grain: [], modelType: null, origins: {}, release: null });
  });

  it('show the cardinality, never ask for it (DEC-RC-08)', () => {
    const draft = draftOf(resource(fields), proposal);
    const shown = (name: string) => cardinalityOf(draft, draft.fields.find((field) => field.name === name)!, types);
    expect(shown('eventId')).toEqual({ badge: '1 row', key: 'grain.rows.one', values: { entity: 'homeLoanSimulation.generate' } });
    expect(shown('homeLoanSimulationId')).toEqual({ badge: 'n rows', key: 'grain.rows.many', values: { entity: 'homeLoanSimulation' } });
    // A relation starts from the event, and its type gives the cardinality, or both as the Domain Model has it now.
    expect(shown('listingId')).toEqual({ badge: null, key: 'grain.relation.either', values: { subject: 'homeLoanSimulation.generate', target: 'listing' } });
    expect(shown('visitorId')).toEqual({ badge: 'N:1', key: 'grain.relation.one', values: { subject: 'homeLoanSimulation.generate', target: 'visitor' } });
    expect(shown('collectorDatetime')).toBeUndefined();
    // A relation starts from the field chosen, among those mapped as is.
    const listing = draft.fields.find((field) => field.name === 'listingId')!;
    listing.subject = 'homeLoanSimulationId';
    expect(subjectOf(draft, listing)?.name).toBe('homeLoanSimulationId');
    listing.relationType = 'contains';
    expect(shown('listingId')).toMatchObject({ badge: 'M:N', values: { subject: 'homeLoanSimulation' } });
  });

  it('name an Entity the Domain Model does not have, and an identity not yet written out (DEC-CO-21)', () => {
    const draft = draftOf(resource(fields), proposal);
    const city = draft.fields.find((field) => field.name === 'cityId')!;
    Object.assign(city, { kind: 'relation', relationType: 'occurredWithin', identity: 'city', origin: 'here' });
    expect(unfinished(draft)).toEqual(['cityId']);
    city.identity = 'city.cityId';
    expect(unfinished(draft)).toEqual([]);
    expect(strangers(draft, identities)).toEqual(['city']);
  });

  it('are sent to catalogue as it records them (TR-CO-05)', () => {
    const draft = draftOf(resource(fields), proposal);
    draft.grainSentence = ' generated simulation ';
    const request = requestOf(draft, identities);
    expect(request).toMatchObject({
      id: 'r1',
      partition: { field: 'collectorDatetime', unit: 'day' },
      partitionFilter: 'bigQuery',
      grainSentence: 'generated simulation',
      origins: { grainSentence: 'here', grain: 'domainModel' },
      release: '0.0.70',
    });
    expect(request.mappings).toEqual([
      { field: 'eventId', kind: 'is', relationType: null, identity: 'homeLoanSimulation.generate', subject: null, origin: 'domainModel', inDomainModel: true },
      { field: 'homeLoanSimulationId', kind: 'is', relationType: null, identity: 'homeLoanSimulation.homeLoanSimulationId', subject: null, origin: 'domainModel', inDomainModel: true },
      { field: 'listingId', kind: 'relation', relationType: 'basedOn', identity: 'listing.listingId', subject: 'eventId', origin: 'domainModel', inDomainModel: true },
      { field: 'visitorId', kind: 'performedBy', relationType: null, identity: 'visitor.visitorId', subject: 'eventId', origin: 'domainModel', inDomainModel: true },
    ]);
  });

  it('say what an identity is about in a word', () => {
    expect(nounOf('listing.listingId')).toBe('listing');
    expect(nounOf('homeLoanSimulation.generate')).toBe('homeLoanSimulation.generate');
  });
});

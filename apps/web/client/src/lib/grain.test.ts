import { describe, expect, it } from 'vitest';
import type { ResourceDetail } from './catalogue.js';
import {
  cardinalityOf,
  carriersOf,
  chooseType,
  draftOf,
  holdRole,
  missingOf,
  nounOf,
  recordedDraftOf,
  requestOf,
  roleOf,
  strangers,
  subjectOf,
  suggestTypeFields,
  unfinished,
} from './grain.js';
import type { Proposal } from './registry.js';

const TYPES: Record<string, string> = { collectorDatetime: 'TIMESTAMP', creditAmount: 'NUMERIC', leadCount: 'INT64', uniqueVisitors: 'INT64' };

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
  fields: fields.map((name, index) => ({ name, position: index + 1, dataType: TYPES[name] ?? 'STRING', description: '', businessDescription: '' })),
  leftOut: [{ name: 'identifiers', dataType: 'ARRAY<STRING>', reason: 'array' }],
  details: { partition: null, clusterBy: [], partitionFilter: 'none', grain: [], grainSentence: '', modelType: null, origins: {}, release: null, mappings: [] },
  card: { businessDescription: '', intendedUse: '', pitfalls: '', knownGaps: [], reliableSince: null, keyFields: [], parameters: [] },
  published: false,
  deprecated: false,
  publication: null,
  deprecation: null,
  changes: [],
  descriptionChanges: [],
});

const proposal: Proposal = {
  nodeId: 'model.p.credit_simulations',
  builtOn: { name: 'mrt_homeLoanSimulation_generate', entity: 'homeLoanSimulation', action: 'generate', colleciones: true },
  storage: { partition: { field: 'collectorDatetime', unit: 'day' }, clusterBy: ['listingId'], requirePartitionFilter: true, from: 'mrt_homeLoanSimulation_generate' },
  grain: { fields: ['eventId'], origin: 'domainModel' },
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
  it('start from what registry proposes, each with where it came from, but never with a model type (DEC-RC-25)', () => {
    const draft = draftOf(resource(fields), proposal);
    expect(draft).toMatchObject({
      partition: { field: 'collectorDatetime', unit: 'day' },
      clusterBy: ['listingId'],
      partitionFilter: 'bigQuery',
      filterLocked: true,
      grain: ['eventId'],
      modelType: null,
      typeFields: [],
      origins: { partition: 'dbt', clusterBy: 'dbt', partitionFilter: 'dbt', grain: 'domainModel' },
      release: '0.0.70',
    });
    expect(draft.origins.modelType).toBeUndefined();
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

  it('are sent to catalogue as it records them, with the model type and its fields (TR-CO-05, FR-CO-44)', () => {
    const draft = draftOf(resource(fields), proposal);
    draft.grainSentence = ' generated simulation ';
    chooseType(draft, 'event');
    holdRole(draft, 'collectorDatetime', 'happenedAt');
    const request = requestOf(draft, identities);
    expect(request).toMatchObject({
      id: 'r1',
      partition: { field: 'collectorDatetime', unit: 'day' },
      partitionFilter: 'bigQuery',
      grainSentence: 'generated simulation',
      modelType: 'event',
      origins: { grainSentence: 'here', grain: 'domainModel', modelType: 'here' },
      typeFields: [{ field: 'collectorDatetime', role: 'happenedAt', origin: 'here' }],
      release: '0.0.70',
    });
    expect(request.mappings).toEqual([
      { field: 'eventId', kind: 'is', relationType: null, identity: 'homeLoanSimulation.generate', subject: null, origin: 'domainModel', inDomainModel: true },
      { field: 'homeLoanSimulationId', kind: 'is', relationType: null, identity: 'homeLoanSimulation.homeLoanSimulationId', subject: null, origin: 'domainModel', inDomainModel: true },
      { field: 'listingId', kind: 'relation', relationType: 'basedOn', identity: 'listing.listingId', subject: 'eventId', origin: 'domainModel', inDomainModel: true },
      { field: 'visitorId', kind: 'performedBy', relationType: null, identity: 'visitor.visitorId', subject: 'eventId', origin: 'domainModel', inDomainModel: true },
    ]);
  });

  it('start again from what was recorded, for Edit relations (DEC-UX-107)', () => {
    const recorded = resource(fields);
    recorded.details = {
      partition: { field: 'collectorDatetime', unit: 'day' },
      clusterBy: ['listingId'],
      partitionFilter: 'bigQuery',
      grain: ['eventId'],
      grainSentence: 'one simulation',
      modelType: 'event',
      origins: { partition: 'dbt', partitionFilter: 'dbt', grain: 'domainModel' },
      typeFields: [{ field: 'collectorDatetime', role: 'happenedAt', origin: 'dbt' }],
      release: '0.0.70',
      mappings: [{ field: 'listingId', kind: 'relation', relationType: 'basedOn', identity: 'listing.listingId', subject: 'eventId', origin: 'here', inDomainModel: true }],
    };
    const draft = recordedDraftOf(recorded);
    expect(draft).toMatchObject({
      partitionFilter: 'bigQuery',
      filterLocked: true,
      grain: ['eventId'],
      grainSentence: 'one simulation',
      release: '0.0.70',
      modelType: 'event',
      typeFields: [{ field: 'collectorDatetime', role: 'happenedAt', origin: 'dbt' }],
    });
    expect(draft.fields.find((field) => field.name === 'listingId')).toMatchObject({ kind: 'relation', relationType: 'basedOn', subject: 'eventId', origin: 'here' });
    expect(draft.fields.find((field) => field.name === 'cityId')).toMatchObject({ kind: 'none', origin: 'here' });
  });

  it('start again without fields of the model type from an older catalogue that sends none', () => {
    expect(recordedDraftOf(resource(fields)).typeFields).toEqual([]);
  });

  it('say what an identity is about in a word', () => {
    expect(nounOf('listing.listingId')).toBe('listing');
    expect(nounOf('homeLoanSimulation.generate')).toBe('homeLoanSimulation.generate');
  });
});

describe('carriersOf', () => {
  it('names a Resource that carries an identity in two fields once (FR-RC-09)', () => {
    const resources = [
      { id: 'r1', displayName: 'Credit lead creations (flat)' },
      { id: 'r1', displayName: 'Credit lead creations (flat)' },
      { id: 'r2', displayName: 'Lead sources, current (flat)' },
    ];
    expect(carriersOf({ resources })).toEqual(['Credit lead creations (flat)', 'Lead sources, current (flat)']);
  });
});

describe('the model type of a Resource being added and the fields it asks for (FR-CO-44)', () => {
  const aggregate = ['weekStart', 'leadSource', 'leadCount', 'uniqueVisitors'];
  const typed = (names: string[], more: Record<string, string> = {}) => {
    const detail = resource(names);
    detail.fields = detail.fields.map((field) => ({ ...field, dataType: more[field.name] ?? field.dataType }));
    return detail;
  };

  it('is chosen by hand, and the fields of the model type before are dropped when it changes (DEC-RC-22)', () => {
    const draft = draftOf(resource(fields), proposal);
    expect(missingOf(draft)).toEqual([{ kind: 'modelType' }]);
    chooseType(draft, 'event');
    holdRole(draft, 'collectorDatetime', 'happenedAt');
    expect(roleOf(draft, 'collectorDatetime')).toBe('happenedAt');
    expect(missingOf(draft)).toEqual([]);
    // Choosing the same model type again keeps its fields.
    chooseType(draft, 'event');
    expect(draft.typeFields).toHaveLength(1);
    chooseType(draft, 'state');
    expect(draft.typeFields).toEqual([]);
    // A state needs only what it is about; when it was created and last updated are optional.
    expect(missingOf(draft)).toEqual([{ kind: 'role', role: 'about' }]);
  });

  it('gives a field one role, and moves a role that takes one field when another field takes it', () => {
    const draft = draftOf(typed(['createdAt', 'updatedAt', 'listingId'], { createdAt: 'DATE', updatedAt: 'TIMESTAMP' }), null);
    chooseType(draft, 'state');
    holdRole(draft, 'createdAt', 'createdAt');
    holdRole(draft, 'updatedAt', 'createdAt');
    expect(draft.typeFields).toEqual([{ field: 'updatedAt', role: 'createdAt', origin: 'here' }]);
    holdRole(draft, 'updatedAt', 'updatedAt');
    expect(draft.typeFields).toEqual([{ field: 'updatedAt', role: 'updatedAt', origin: 'here' }]);
    holdRole(draft, 'updatedAt', null);
    expect(draft.typeFields).toEqual([]);
    // A role the model type does not have is not held.
    holdRole(draft, 'listingId', 'happenedAt');
    expect(draft.typeFields).toEqual([]);
  });

  it('lets every number of an aggregate be marked, a role that several fields hold', () => {
    const draft = draftOf(typed(aggregate, { weekStart: 'DATE' }), null);
    chooseType(draft, 'aggregate');
    holdRole(draft, 'leadSource', 'groupedBy');
    holdRole(draft, 'leadCount', 'addsUp');
    expect(missingOf(draft)).toEqual([{ kind: 'unmarked', field: 'uniqueVisitors' }]);
    holdRole(draft, 'uniqueVisitors', 'uniqueCount');
    holdRole(draft, 'weekStart', 'groupedBy');
    expect(draft.typeFields.filter((typeField) => typeField.role === 'groupedBy').map((typeField) => typeField.field)).toEqual(['leadSource', 'weekStart']);
    expect(missingOf(draft)).toEqual([]);
  });

  it('asks other for the sentence of One row per (DEC-RC-21)', () => {
    const draft = draftOf(resource(fields), proposal);
    chooseType(draft, 'other');
    expect(missingOf(draft)).toEqual([{ kind: 'sentence' }]);
    draft.grainSentence = 'code kept for one report';
    expect(missingOf(draft)).toEqual([]);
  });

  it('suggests the partition column for when it happened, and the single field of the grain mapped is for what a state is about', () => {
    const event = draftOf(resource(fields), proposal);
    chooseType(event, 'event');
    suggestTypeFields(event);
    expect(event.typeFields).toEqual([{ field: 'collectorDatetime', role: 'happenedAt', origin: 'dbt' }]);

    const state = draftOf(resource(fields), proposal);
    chooseType(state, 'state');
    suggestTypeFields(state);
    // eventId is the one field of the grain, mapped is, from the Domain Model; the partition column is no role of a state by itself.
    expect(state.typeFields).toEqual([{ field: 'eventId', role: 'about', origin: 'domainModel' }]);

    // What the Data Admin chose stays: a role held is not suggested again.
    const fact = draftOf(resource(fields), proposal);
    chooseType(fact, 'fact');
    holdRole(fact, 'collectorDatetime', 'occurredAt');
    suggestTypeFields(fact);
    expect(fact.typeFields).toEqual([{ field: 'collectorDatetime', role: 'occurredAt', origin: 'here' }]);
  });

  it('records no role whose field is gone, so that it is missing until another field holds it (DEC-RC-23)', () => {
    const recorded = resource(fields);
    recorded.details = {
      ...recorded.details,
      partition: { field: 'collectorDatetime', unit: 'day' },
      modelType: 'event',
      typeFields: [{ field: 'eventDate', role: 'happenedAt', origin: 'here' }],
    };
    const draft = recordedDraftOf(recorded);
    expect(missingOf(draft)).toEqual([{ kind: 'role', role: 'happenedAt' }]);
    expect(requestOf(draft, identities).typeFields).toEqual([]);
    suggestTypeFields(draft);
    expect(draft.typeFields).toEqual([{ field: 'collectorDatetime', role: 'happenedAt', origin: 'here' }]);
  });
});

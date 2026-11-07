import type { ResourceDetail } from './catalogue.js';
import type { Proposal, TypeCardinality } from './registry.js';

/** The model types of a Resource, a fixed list (DEC-RC-10). */
export const MODEL_TYPES = ['event', 'state', 'fact', 'dimension', 'aggregate'] as const;
export type ModelType = (typeof MODEL_TYPES)[number];
export const UNITS = ['hour', 'day', 'month', 'year'] as const;
export type Unit = (typeof UNITS)[number];

/** Where a fact of the step comes from: dbt, a dbt test, the Domain Model, or the Data Admin. */
export type Origin = 'dbt' | 'test' | 'domainModel' | 'here';
export type MappingKind = 'none' | 'is' | 'relation' | 'performedBy';
export type MappingOrigin = 'domainModel' | 'name' | 'here';

export interface FieldDraft {
  name: string;
  dataType: string | null;
  description: string;
  kind: MappingKind;
  relationType: string | null;
  identity: string;
  /** The field mapped as `is` a relation starts from; empty for the default (DEC-RC-08). */
  subject: string | null;
  origin: MappingOrigin;
}

/** What the Data Admin is about to record for one Resource (FR-CO-33, FR-CO-34), as they change it. */
export interface Draft {
  id: string;
  displayName: string;
  level: number;
  builtOn: Proposal['builtOn'] | null;
  partition: { field: string; unit: Unit | null } | null;
  clusterBy: string[];
  partitionFilter: 'none' | 'dataHub' | 'bigQuery';
  /** BigQuery requires the filter, as the table beneath says: it stays required. */
  filterLocked: boolean;
  grain: string[];
  grainSentence: string;
  modelType: ModelType | null;
  origins: Partial<Record<'partition' | 'clusterBy' | 'partitionFilter' | 'grain' | 'grainSentence' | 'modelType', Origin>>;
  fields: FieldDraft[];
  leftOut: ResourceDetail['leftOut'];
  /** The release of the Domain Model the proposal was made with; null without it. */
  release: string | null;
}

const IDENTITY = /^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/;

/** The draft of a Resource from its fields and what registry proposes, or from its fields alone. */
export function draftOf(resource: ResourceDetail, proposal: Proposal | null): Draft {
  const mapped = new Map((proposal?.mappings ?? []).map((mapping) => [mapping.field, mapping]));
  const storage = proposal?.storage;
  const partition = storage?.partition ?? null;
  return {
    id: resource.id,
    displayName: resource.displayName,
    level: resource.level,
    builtOn: proposal?.builtOn ?? null,
    partition,
    clusterBy: storage?.clusterBy ?? [],
    partitionFilter: partition && storage?.requirePartitionFilter ? 'bigQuery' : 'none',
    filterLocked: Boolean(partition && storage?.requirePartitionFilter),
    grain: proposal?.grain?.fields ?? [],
    grainSentence: '',
    modelType: proposal?.modelType?.value ?? null,
    origins: {
      ...(partition ? { partition: 'dbt' as const } : {}),
      ...(storage?.clusterBy.length ? { clusterBy: 'dbt' as const } : {}),
      ...(partition && storage?.requirePartitionFilter ? { partitionFilter: 'dbt' as const } : {}),
      ...(proposal?.grain ? { grain: proposal.grain.origin === 'test' ? ('test' as const) : ('domainModel' as const) } : {}),
      ...(proposal?.modelType ? { modelType: 'domainModel' as const } : {}),
    },
    fields: resource.fields.map((field) => {
      const proposed = mapped.get(field.name);
      return {
        name: field.name,
        dataType: field.dataType,
        description: field.description,
        kind: proposed?.kind ?? 'none',
        relationType: proposed?.relationType ?? null,
        identity: proposed?.identity ?? '',
        subject: null,
        origin: proposed?.origin === 'name' ? 'name' : proposed ? 'domainModel' : 'here',
      };
    }),
    leftOut: resource.leftOut,
    release: proposal?.domainModel?.release ?? null,
  };
}

/** The draft of a Resource from what was recorded when it was added, to change it with Edit relations (DEC-UX-107). */
export function recordedDraftOf(resource: ResourceDetail): Draft {
  const { details } = resource;
  const mapped = new Map(details.mappings.map((mapping) => [mapping.field, mapping]));
  return {
    id: resource.id,
    displayName: resource.displayName,
    level: resource.level,
    builtOn: null,
    partition: details.partition,
    clusterBy: details.clusterBy,
    partitionFilter: details.partitionFilter,
    // BigQuery requires the filter, as dbt said: it stays required.
    filterLocked: details.partitionFilter === 'bigQuery' && details.origins.partitionFilter === 'dbt',
    grain: details.grain,
    grainSentence: details.grainSentence,
    modelType: details.modelType,
    origins: details.origins,
    fields: resource.fields.map((field) => {
      const recorded = mapped.get(field.name);
      return {
        name: field.name,
        dataType: field.dataType,
        description: field.description,
        kind: recorded?.kind ?? 'none',
        relationType: recorded?.relationType ?? null,
        identity: recorded?.identity ?? '',
        subject: recorded?.subject ?? null,
        origin: recorded?.origin ?? 'here',
      };
    }),
    leftOut: resource.leftOut,
    release: details.release,
  };
}

/** The fields mapped as `is`: what a relation can start from. */
export function subjectsOf(draft: Draft): FieldDraft[] {
  return draft.fields.filter((field) => field.kind === 'is' && IDENTITY.test(field.identity));
}

/** The field a relation starts from: the one chosen, else the ID of the event, else the first `is` field. */
export function subjectOf(draft: Draft, field: FieldDraft): FieldDraft | undefined {
  const subjects = subjectsOf(draft);
  const action = draft.builtOn?.action;
  return (
    subjects.find((subject) => subject.name === field.subject) ??
    subjects.find((subject) => action !== null && action !== undefined && subject.identity.endsWith(`.${action}`)) ??
    subjects[0]
  );
}

/** What an identity is about, in a word: the Entity, or the whole of an event such as `homeLoanSimulation.generate`. */
export function nounOf(identity: string): string {
  const [entity = identity, part = ''] = identity.split('.');
  return part.endsWith('Id') ? entity : identity;
}

/** The cardinality of a mapping, shown and never chosen (DEC-RC-08): a badge, when it is known, and words. */
export interface Shown {
  badge: string | null;
  key: string;
  values: Record<string, string>;
}

/**
 * The rows per Entity of an `is` field follow from the grain: one when the grain is exactly this field.
 * A relation counts per instance of its subject, from its type; who performs an event is one per event.
 */
export function cardinalityOf(draft: Draft, field: FieldDraft, types: ReadonlyMap<string, TypeCardinality>): Shown | undefined {
  if (field.kind === 'none' || !IDENTITY.test(field.identity)) {
    return undefined;
  }
  const target = nounOf(field.identity);
  if (field.kind === 'is') {
    return draft.grain.length === 1 && draft.grain[0] === field.name
      ? { badge: '1 row', key: 'grain.rows.one', values: { entity: target } }
      : { badge: 'n rows', key: 'grain.rows.many', values: { entity: target } };
  }
  const subject = subjectOf(draft, field);
  if (!subject) {
    return { badge: null, key: 'grain.subject.none', values: {} };
  }
  const values = { subject: nounOf(subject.identity), target };
  const cardinality = field.kind === 'performedBy' ? 'one' : (types.get(field.relationType ?? '') ?? 'either');
  return cardinality === 'one'
    ? { badge: 'N:1', key: 'grain.relation.one', values }
    : cardinality === 'many'
      ? { badge: 'M:N', key: 'grain.relation.many', values }
      : { badge: null, key: 'grain.relation.either', values };
}

/** The fields mapped without an identity written as `entity.identifier`: they keep the Resources from being added. */
export function unfinished(draft: Draft): string[] {
  return draft.fields.filter((field) => field.kind !== 'none' && (!IDENTITY.test(field.identity) || (field.kind === 'relation' && !field.relationType))).map((field) => field.name);
}

/** The Entities a draft maps to that the Domain Model does not have yet (DEC-CO-21). */
export function strangers(draft: Draft, identities: ReadonlySet<string>): string[] {
  const entities = new Set([...identities].map((identity) => identity.split('.')[0]));
  return [
    ...new Set(
      draft.fields
        .filter((field) => field.kind !== 'none' && IDENTITY.test(field.identity) && !entities.has(field.identity.split('.')[0]))
        .map((field) => field.identity.split('.')[0]!),
    ),
  ];
}

/** What catalogue records for a Resource when it is added (TR-CO-05). */
export function requestOf(draft: Draft, identities: ReadonlySet<string>) {
  const subjects = subjectsOf(draft);
  return {
    id: draft.id,
    partition: draft.partition,
    clusterBy: draft.clusterBy,
    partitionFilter: draft.partition ? draft.partitionFilter : 'none',
    grain: draft.grain,
    grainSentence: draft.grainSentence.trim(),
    modelType: draft.modelType,
    origins: {
      ...draft.origins,
      ...(draft.grainSentence.trim() && !draft.origins.grainSentence ? { grainSentence: 'here' as const } : {}),
    },
    release: draft.release,
    mappings: draft.fields
      .filter((field) => field.kind !== 'none')
      .map((field) => ({
        field: field.name,
        kind: field.kind as 'is' | 'relation' | 'performedBy',
        relationType: field.kind === 'relation' ? field.relationType : null,
        identity: field.identity,
        subject: field.kind === 'is' || subjects.length === 0 ? null : (subjectOf(draft, field)?.name ?? null),
        origin: field.origin,
        inDomainModel: identities.has(field.identity),
      })),
  };
}

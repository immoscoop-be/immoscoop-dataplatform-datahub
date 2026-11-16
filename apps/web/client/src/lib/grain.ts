import { missingOfType, rolesFor, rolesOf, type MissingOfType, type ModelType, type TypeRole } from '@datahub/contracts/model-types';
import type { IconName } from '@datahub/ui/foundations/icons.js';
import type { ResourceDetail } from './catalogue.js';
import type { Proposal, TypeCardinality } from './registry.js';

export const UNITS = ['hour', 'day', 'month', 'year'] as const;
export type Unit = (typeof UNITS)[number];

/** Where a fact of the step comes from: dbt, a dbt test, the Domain Model, or the Data Admin. */
export type Origin = 'dbt' | 'test' | 'domainModel' | 'here';
export type MappingKind = 'none' | 'is' | 'relation' | 'performedBy';
export type MappingOrigin = 'domainModel' | 'name' | 'here';

/** A field holding a role of the model type, with where that came from (FR-CO-44). */
export interface TypeFieldDraft {
  field: string;
  role: TypeRole;
  origin: Origin;
}

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

/** What the Data Admin is about to record for one Resource (FR-CO-33, FR-CO-34, FR-CO-44), as they change it. */
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
  /** The fields that hold the roles of its model type; one field holds one role at most. */
  typeFields: TypeFieldDraft[];
  fields: FieldDraft[];
  leftOut: ResourceDetail['leftOut'];
  /** The release of the Domain Model the proposal was made with; null without it. */
  release: string | null;
}

/** The words and icon of where a value came from, as each step of adding a Resource shows it; a quiet one is greyer. */
export const ORIGINS: Readonly<Record<string, { icon: IconName; key: string; quiet?: boolean }>> = {
  dbt: { icon: 'file-text', key: 'grain.origin.dbt' },
  test: { icon: 'file-text', key: 'grain.origin.test' },
  domainModel: { icon: 'graph', key: 'grain.origin.domainModel' },
  name: { icon: 'lightbulb', key: 'grain.origin.name', quiet: true },
  here: { icon: 'user', key: 'grain.origin.chosen' },
  written: { icon: 'user', key: 'grain.origin.written' },
  bigQuery: { icon: 'lock-simple', key: 'grain.origin.bigQuery' },
  optional: { icon: 'info', key: 'grain.origin.optional', quiet: true },
  before: { icon: 'arrow-left', key: 'fields.need.before', quiet: true },
};

const IDENTITY = /^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/;

/**
 * The draft of a Resource from its fields and what registry proposes, or from its fields alone. It starts without a
 * model type: Data Hub suggests none from the words of a Colleciónes model, so the Data Admin chooses it (DEC-RC-25).
 */
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
    modelType: null,
    origins: {
      ...(partition ? { partition: 'dbt' as const } : {}),
      ...(storage?.clusterBy.length ? { clusterBy: 'dbt' as const } : {}),
      ...(partition && storage?.requirePartitionFilter ? { partitionFilter: 'dbt' as const } : {}),
      ...(proposal?.grain ? { grain: proposal.grain.origin === 'test' ? ('test' as const) : ('domainModel' as const) } : {}),
    },
    typeFields: [],
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
    // A Domain Model without a version records none, rather than an empty one catalogue refuses.
    release: proposal?.domainModel?.release || null,
  };
}

/**
 * The draft of a Resource from what was recorded when it was added, to change it with Edit relations (DEC-UX-107): its
 * model type and the fields that hold its roles too, also a role whose field is gone, for the Data Admin to replace.
 */
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
    typeFields: (details.typeFields ?? []).map(({ field, role, origin }) => ({ field, role, origin })),
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

/**
 * The Display Names of the other Resources that carry an identity, each once, in their order: a Resource that carries
 * it in two fields, such as `identifier_subjectId` and `actorIdentifier_subjectId`, is named once (FR-RC-09).
 */
export function carriersOf(mapping: { resources: readonly { id: string; displayName: string }[] }): string[] {
  return [...new Map(mapping.resources.map((other) => [other.id, other.displayName])).values()];
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

/**
 * Chooses the model type (FR-CO-44): the fields its old model type asked for are dropped, as the new one asks for its own
 * (DEC-RC-22). Choosing the one it has changes nothing.
 */
export function chooseType(draft: Draft, type: ModelType): void {
  if (draft.modelType === type) return;
  const roles = new Set(rolesOf(type).map((rule) => rule.role));
  draft.modelType = type;
  draft.origins.modelType = 'here';
  draft.typeFields = draft.typeFields.filter((typeField) => roles.has(typeField.role));
}

/** The role a field holds for the model type, or null. */
export function roleOf(draft: Draft, name: string): TypeRole | null {
  return draft.typeFields.find((typeField) => typeField.field === name)?.role ?? null;
}

/**
 * Gives a field a role of the model type, or takes its role away with null (FR-CO-44). A field holds one role; a role
 * that one field holds, such as when an event happened, moves to it from the field that held it.
 */
export function holdRole(draft: Draft, name: string, role: TypeRole | null): void {
  const rule = rolesOf(draft.modelType).find((one) => one.role === role);
  draft.typeFields = [
    ...draft.typeFields.filter((typeField) => typeField.field !== name && !(rule?.single && typeField.role === rule.role)),
    ...(rule ? [{ field: name, role: rule.role, origin: 'here' as const }] : []),
  ];
}

/** The roles that take a date and that the partition column can hold, and those the single field of the grain can. */
const FROM_PARTITION: readonly TypeRole[] = ['happenedAt', 'occurredAt', 'period'];
const FROM_GRAIN: readonly TypeRole[] = ['about', 'describes'];

/**
 * Suggests the fields its model type asks for where that is cheap (FR-CO-44), each with where it came from: the
 * partition column, a date, for when an event happened, when a fact occurred or the period of an aggregate; the one
 * field of the grain, mapped `is`, for what a state is about or what a dimension describes. A role a field already
 * holds, and a field that holds a role, stay as they are; a role whose field is gone is given the suggestion.
 */
export function suggestTypeFields(draft: Draft): void {
  const fieldOf = (name: string) => draft.fields.find((field) => field.name === name);
  const offer = (role: TypeRole, name: string, origin: Origin) => {
    const field = fieldOf(name);
    const held = draft.typeFields.some((typeField) => typeField.role === role && fieldOf(typeField.field));
    const busy = draft.typeFields.some((typeField) => typeField.field === name);
    if (!field || held || busy || !rolesFor(draft.modelType, field.dataType).includes(role)) return;
    draft.typeFields = [...draft.typeFields.filter((typeField) => typeField.role !== role), { field: name, role, origin }];
  };
  const partition = draft.partition?.field;
  if (partition) {
    for (const role of FROM_PARTITION) offer(role, partition, draft.origins.partition ?? 'here');
  }
  const [only, ...more] = draft.grain;
  if (only && more.length === 0 && fieldOf(only)?.kind === 'is') {
    for (const role of FROM_GRAIN) offer(role, only, draft.origins.grain ?? 'here');
  }
}

/** What is still missing before the model type of the draft has every field it asks for (FR-CO-44). */
export function missingOf(draft: Draft): MissingOfType[] {
  return missingOfType(
    draft.modelType,
    draft.typeFields,
    draft.fields.map((field) => ({ name: field.name, dataType: field.dataType })),
    draft.grainSentence,
  );
}

/** What catalogue records for a Resource when it is added (TR-CO-05). */
export function requestOf(draft: Draft, identities: ReadonlySet<string>) {
  const subjects = subjectsOf(draft);
  const names = new Set(draft.fields.map((field) => field.name));
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
    release: draft.release || null,
    // A role whose field is gone is not recorded again: it is missing until another field holds it (DEC-RC-23).
    typeFields: draft.typeFields.filter((typeField) => names.has(typeField.field)).map(({ field, role, origin }) => ({ field, role, origin })),
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

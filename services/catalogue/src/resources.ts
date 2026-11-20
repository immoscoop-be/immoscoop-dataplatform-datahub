import { fieldsOf, type GapScope, hasScope } from '@datahub/contracts/gaps';
import { type Journey, type JourneyAnswer, journeyOf, type JourneyStepId, journeyStep } from '@datahub/contracts/journey';
import type { ReliableSince } from '@datahub/contracts/reliable';
import {
  type FieldOfType,
  goneOfType,
  invalidTypeFields,
  kindOf,
  type MissingOfType,
  missingOfType,
  type ModelType,
  type TypeField,
} from '@datahub/contracts/model-types';
import { type Kysely, type Selectable, sql, type Transaction } from 'kysely';
import type { Viewer } from './collections.js';
import type { CatalogueDatabase, MappingKind, MappingOrigin, Origin, Origins, PartitionFilter, PartitionUnit, SchemaChange } from './database.js';
import { type Column, fingerprint, type LeftOut, levelAtRegistration, retyped, splitColumns } from './fields.js';
import { logText, type ResourceLogId } from './log.js';
import { seesAll, seesPublic, theirs } from './viewer.js';

/** A table under an exposure tagged `datahub`, as registry tells it (TR-AR-08). */
export interface ExposedTable {
  key: string;
  /** The full name in its own case, for BigQuery; a registry that does not send it yet leaves the Key. */
  fullName?: string;
  nodeId: string;
  name: string;
  resourceType: string;
  description: string;
  exposures: string[];
  label: string | null;
  /** The checksum of its code, for the Fingerprint (FR-SR-08). */
  checksum: string | null;
  /** Its columns, in the order of the table. */
  columns: Column[];
  /**
   * How it is stored, as dbt says (DEC-SR-34): kept while it waits for a Collection, so that a Preview filters on its
   * partition column from the start; a Data Admin records what holds when adding it. A registry that does not send
   * it yet leaves it out.
   */
  storage?: { partition: { field: string; unit: PartitionUnit | null } | null; clusterBy: string[]; requirePartitionFilter: boolean } | null;
}

/** A Change in a dbt project and the tables of Resources it reaches downstream, as registry follows it (FR-AR-12). */
export interface UpstreamChange {
  kind: 'description' | 'logic' | 'type' | 'structural' | 'added' | 'removed';
  /** The name of the Node that changed. */
  node: string;
  field?: string;
  direction?: 'added' | 'removed';
  old?: string | null;
  new?: string | null;
  /** The Node of each table it reaches, and how many steps downstream; 0 only for a change of its own code. */
  reaches: { nodeId: string; distance: number }[];
}

/** Every exposed table of one dbt project, after a new Current Version. */
export interface ResourcesUpdate {
  projectId: string;
  projectName: string | null;
  runId: string;
  /** When dbt made the manifest of the run, as ISO 8601. */
  generatedAt: string | null;
  tables: ExposedTable[];
  /** What changed since its previous Current Version, followed downstream; a registry that does not send it yet leaves it out. */
  changes?: UpstreamChange[];
}

export interface Resource {
  id: string;
  key: string;
  /** The full name of its table in its own case, as BigQuery knows it: what queries, shows and copies it. */
  fullName: string;
  displayName: string;
  name: string;
  resourceType: string;
  projectId: string;
  projectName: string | null;
  nodeId: string;
  description: string;
  exposures: string[];
  collectionId: string | null;
  /** From 0 · Beta to 5 · Monitored (FR-MR-10). */
  level: number;
  registeredAt: Date;
  /** No exposure tagged `datahub` depends on it any more; it is held (DEC-SR-26). */
  withdrawn: boolean;
  /** Published: everyone who sees its Collection sees it (FR-SR-31). */
  published: boolean;
  /** Its use is discouraged (FR-SR-50). */
  deprecated: boolean;
}

/** The mapping of a field (DEC-RC-05, DEC-RC-06, DEC-RC-14). */
export interface Mapping {
  field: string;
  kind: MappingKind;
  /** The relation type, for a relation. */
  relationType: string | null;
  /** `entity.identifier`, or `entity.action` for the ID of an event. */
  identity: string;
  /** The field mapped as `is` that a relation starts from, when there is more than one (DEC-RC-08). */
  subject: string | null;
  origin: MappingOrigin;
  /** False for an Entity the Domain Model does not have yet, kept as written (DEC-CO-21). */
  inDomainModel: boolean;
}

/** A field that holds a role of the model type of its Resource, with where that came from (FR-CO-44). */
export interface RecordedTypeField extends TypeField {
  origin: Origin;
}

/**
 * What the Data Admin records when adding a Resource (FR-CO-33, FR-CO-34): how it is stored, what one
 * row is, its model type with the fields it asks for (FR-CO-44) and the mapping of its fields, with where
 * each came from and the release of the Domain Model the mappings were made with (FR-AR-17).
 */
export interface Details {
  partition: { field: string; unit: PartitionUnit | null } | null;
  clusterBy: string[];
  partitionFilter: PartitionFilter;
  grain: string[];
  grainSentence: string;
  modelType: ModelType | null;
  /** Each field that holds a role of its model type, in the order of the fields; a role whose field is gone last. */
  typeFields: RecordedTypeField[];
  origins: Origins;
  release: string | null;
  mappings: Mapping[];
}

/**
 * How far the model type of a Resource has the fields it asks for, from its fields now (FR-CO-45, FR-RC-29): what is
 * still missing, and each role whose field is gone from it, removed or renamed in dbt (DEC-RC-23).
 */
export interface TypeState {
  missing: MissingOfType[];
  gone: TypeField[];
}

/** A Resource whose model type misses a field it asks for, or that has none yet, for the Data Team (FR-CO-45, DEC-CO-27). */
export interface ToComplete {
  id: string;
  displayName: string;
  collection: { id: string; name: string };
  level: number;
  missing: MissingOfType[];
  gone: TypeField[];
}

/** What the Owner and the Data Team keep about a Resource in Data Hub, next to what comes from dbt (FR-RC-15). */
export interface Card {
  /** Next to the description from dbt, never over it (DEC-RC-01); empty when there is none. */
  businessDescription: string;
  /** The Known Behaviour (DEC-DH-18): intended use and pitfalls, and the Known Gaps (DEC-RC-12). */
  intendedUse: string;
  pitfalls: string;
  /** One item each, in the order they were added (FR-RC-21). */
  knownGaps: KnownGap[];
  /**
   * Since when its data is reliable (FR-RC-31): from its first row, or from a later day with why not earlier, with who
   * set it and when; null while not set, which is never either. A day set before has no why, nor who.
   */
  reliableSince: (ReliableSince & { setBy: string | null; setAt: Date | null }) | null;
  /** The Date Field its Owner Unit or the Data Team chose; null takes the one its table type gives (FR-RC-32). */
  dateField: string | null;
  /** Fields of the Resource, by name, in the order chosen. */
  keyFields: string[];
  parameters: string[];
}

export const CARD_KEYS = ['businessDescription', 'intendedUse', 'pitfalls', 'knownGaps', 'reliableSince', 'dateField', 'keyFields', 'parameters'] as const;
export type CardKey = (typeof CARD_KEYS)[number];

/** A Known Gap of a Resource, with who added it and when; neither for a gap of before (FR-RC-21). */
export interface KnownGap {
  id: string;
  text: string;
  /** Where it holds: a period, fields and rows; null for a gap of free text (FR-RC-24). */
  scope: GapScope | null;
  addedBy: string | null;
  addedAt: Date | null;
}

/**
 * What changes about a Resource at once (FR-RC-15): its Known Gaps as their texts, the whole list, which Data Hub
 * turns into the gaps added and removed; one gap at a time goes through addGap, changeGap and removeGap.
 */
export type CardChanges = Partial<Omit<Card, 'knownGaps' | 'reliableSince'> & { knownGaps: string[]; reliableSince: ReliableSince | null }>;

/** At most this many Known Gaps per Resource. */
export const MAX_GAPS = 50;

/** A field with its Business Description next to its description from dbt (FR-RC-16). */
export interface Field extends Column {
  businessDescription: string;
}

/** A Resource with its fields, and the columns of its table left out of it (FR-SR-06, DEC-SR-33). */
export interface ResourceDetail extends Resource {
  fields: Field[];
  leftOut: LeftOut[];
  /** Empty until it is added to a Collection with them. */
  details: Details;
  /** What its model type still misses, and each role whose field is gone (FR-CO-45, FR-RC-29). */
  typeState: TypeState;
  card: Card;
  /** Who published it and when, and who confirmed it last and when (FR-RC-12); null until it is published. */
  publication: { publishedAt: Date; publishedBy: string; confirmedAt: Date; confirmedBy: string } | null;
  /** Who deprecated it, when, why and what to use instead (DEC-UX-101); null when it is not. */
  deprecation: { at: Date; by: string; reason: string; insteadOf: { id: string; displayName: string } | null } | null;
  /** The fields that changed since its last Confirmation and were not marked seen yet: its warning (FR-MR-12). */
  changes: { field: string; change: SchemaChange; old: string | null; new: string | null; at: Date }[];
  /** The descriptions from dbt that changed in the last 30 days, with the text before: no field for the table (FR-RC-17). */
  descriptionChanges: { field: string | null; before: string; at: Date }[];
  /** The Owner Journey: its steps, the next one, and whether it is ready to publish (DEC-MR-15, OP-CL-12). */
  journey: Journey;
}

/** What publishing a Resource came to (FR-SR-49): not ready while a step required to publish is open (DEC-MR-15). */
export type PublishOutcome = 'published' | 'not_found' | 'no_collection' | 'not_described' | 'already_published' | { outcome: 'not_ready'; open: JourneyStepId[] };

/** What recording an answer in a step of the Owner Journey came to (DEC-MR-16). */
export type JourneyRecordOutcome = { outcome: 'recorded'; journey: Journey } | { outcome: 'not_found' } | { outcome: 'invalid'; message: string };

/** What deprecating a Resource, or taking it away, came to (FR-SR-50). */
export type DeprecateOutcome = 'done' | 'not_found' | 'not_published' | 'not_deprecated' | 'invalid';

/** A mapping of a Resource with the other Resources that carry the same identity (FR-RC-08, FR-RC-09). */
export interface Related extends Pick<Mapping, 'field' | 'kind' | 'relationType' | 'identity' | 'inDomainModel'> {
  /** The Resources the viewer sees that carry the identity too, with the field that carries it. */
  resources: { id: string; displayName: string; level: number; field: string }[];
}

/** A Resource on a Node of the lineage, as the viewer may see it (FR-SR-54). */
export interface ResourceAtNode {
  nodeId: string;
  id: string;
  displayName: string;
  level: number;
}

/** What changing a Resource came to: done, or why not. */
export type EditOutcome =
  | { outcome: 'edited'; changed: string[] }
  | { outcome: 'not_found' }
  /** A Business Description is written from Described on (DEC-MR-10). */
  | { outcome: 'not_described' }
  | { outcome: 'invalid'; message: string }
  /** A field that changes is one the User may not describe (DEC-PL-03); nothing changed. */
  | { outcome: 'forbidden'; field: CardKey };

/** What adding, changing or removing a Known Gap came to: the gap, or why not. */
export type GapOutcome = { outcome: 'done'; gap: KnownGap | null } | { outcome: 'not_found' } | { outcome: 'invalid'; message: string };

/** A Resource to add, with what the Data Admin recorded for it, if anything. */
export interface AddItem {
  id: string;
  details?: Details;
}

export interface UpdateOutcome {
  /** False for a call about an older run than the last one applied. */
  applied: boolean;
  registered: number;
  renamed: number;
  withdrawn: number;
  back: number;
  /**
   * The Resources withdrawn, brought back, or with a field removed or added (one renamed is both): what reads them
   * may have become Broken, or work again (FR-SR-52).
   */
  changed: string[];
}

export interface LogEntry {
  logId: string;
  text: string;
  params: Record<string, string>;
  at: Date;
}

/** A Resource as the page of its Collection lists it, with the latest entry of its Log (FR-CO-27). */
export interface CollectionResource extends Resource {
  lastChange: LogEntry | null;
}

/** What adding Resources to a Collection came to: all of them added, or none and why (FR-CO-31). */
export type AddOutcome =
  | { outcome: 'added'; added: number }
  | { outcome: 'collection_gone' }
  | { outcome: 'not_found'; ids: string[] }
  | { outcome: 'in_another_collection'; ids: string[] }
  /** What was recorded names a field the Resource does not have, or a subject that is no `is` field. */
  | { outcome: 'invalid'; id: string; message: string };

/** Resources in Postgres (TR-SR-02 to TR-SR-04). Who may do what is decided by the routes. */
/** A Resource that dbt withdrew, as the tool Withdrawn of Admin lists it (FR-SR-55). */
export interface WithdrawnResource {
  id: string;
  displayName: string;
  /** Its full name in BigQuery, in its own case when a run brought it. */
  key: string;
  project: string;
  collection: { id: string; name: string } | null;
  level: number;
  withdrawnAt: Date;
  /** The run of dbt that withdrew it, from its Log; null when the Log does not say. */
  run: string | null;
}

export interface Resources {
  /** Registers, renames, withdraws and brings back the Resources of one dbt project, in one go. */
  apply(update: ResourcesUpdate): Promise<UpdateOutcome>;
  /** The Resources without Collection that wait for one (FR-SR-35): a withdrawn one waits for nothing (DEC-SR-45). */
  withoutCollection(): Promise<Resource[]>;
  /** The Resources of a Collection, withdrawn ones included, each with its last change. */
  inCollection(collectionId: string): Promise<CollectionResource[]>;
  get(id: string): Promise<Resource | undefined>;
  /** A Resource with its fields and the columns left out of it. */
  detail(id: string): Promise<ResourceDetail | undefined>;
  /**
   * Fills the types its fields lack from the types of its table, by the name of the column, in any case: a type that is
   * known, from the catalog of dbt or from BigQuery at a run, stays (DEC-AR-13). Tells how many fields got one.
   */
  fillTypes(id: string, types: ReadonlyMap<string, string>): Promise<number>;
  /**
   * Adds Resources to a Collection in one go, never from another one (FR-CO-08, FR-CO-31): all of
   * them, or none when one cannot be added. One already in the Collection stays as it is.
   */
  add(items: readonly AddItem[], collection: { id: string; name: string }, viewer: Viewer): Promise<AddOutcome>;
  /** Takes a Resource out of its Collection; false when it was in none. */
  remove(id: string, viewer: Viewer): Promise<boolean>;
  log(id: string, limit: number): Promise<LogEntry[]>;
  /**
   * Changes what Data Hub keeps about a Resource, each change in its Log (FR-RC-15, FR-SR-28): nothing when a field that
   * changes is not allowed, as the Permissions of the User say (DEC-PL-03); one sent as it is changes nothing.
   */
  edit(id: string, changes: CardChanges, viewer: Viewer, allowed?: (field: CardKey) => boolean): Promise<EditOutcome>;
  /** Adds a Known Gap, with who added it and when (FR-RC-21). */
  addGap(id: string, text: string, scope: GapScope | null, viewer: Viewer): Promise<GapOutcome>;
  /** Changes the text of one Known Gap; who added it stays. */
  /** Changes its text and, when given, its scope; without one, its scope stays (FR-RC-24). */
  changeGap(id: string, gapId: string, text: string, scope: GapScope | null | undefined, viewer: Viewer): Promise<GapOutcome>;
  /** Removes one Known Gap. */
  removeGap(id: string, gapId: string, viewer: Viewer): Promise<GapOutcome>;
  /** Writes, changes or removes the Business Descriptions of fields; an empty text removes one (FR-RC-16). */
  describeFields(id: string, descriptions: readonly { field: string; text: string }[], viewer: Viewer): Promise<EditOutcome>;
  /**
   * Records the grain, storage, model type and mappings of a Resource again, from Edit relations (DEC-UX-107). When
   * `complete`, its model type must have every field it asks for (FR-CO-44); a change of its mappings alone need not.
   */
  relate(id: string, details: Details, viewer: Viewer, complete?: boolean): Promise<EditOutcome>;
  /**
   * Every Resource in a Collection, not withdrawn, whose model type misses a field it asks for or that has none yet,
   * by Display Name, for the Data Team (FR-CO-45, DEC-CO-27).
   */
  toComplete(): Promise<ToComplete[]>;
  /** Each mapping of a Resource with the other Resources the viewer sees that carry its identity. */
  related(id: string, viewer: Viewer): Promise<Related[]>;
  /** The Resources the viewer sees on the given Nodes. */
  atNodes(nodeIds: readonly string[], viewer: Viewer): Promise<ResourceAtNode[]>;
  /**
   * Every Resource that dbt withdrew, the newest first (FR-SR-55): its Key, dbt project, Collection or none, Level,
   * and when and in which run it was withdrawn, for the tool Withdrawn of Admin (DEC-UX-213).
   */
  withdrawnList(): Promise<WithdrawnResource[]>;
  /**
   * Publishes a Resource once it is ready (DEC-MR-15), and keeps that first Confirmation with its Fingerprint and the
   * declaration the Owner ticked (FR-SR-17, FR-MR-08, DEC-MR-17).
   */
  publish(id: string, viewer: Viewer, declaration: string | null): Promise<PublishOutcome>;
  /** The Owner Journey of a Resource: its steps, the next one, and whether it is ready to publish (OP-CL-12). */
  journey(id: string): Promise<Journey | undefined>;
  /** Keeps what the Owner Unit said in a step: gone through it, or nothing to add, with who and when (DEC-MR-16). */
  recordStep(id: string, step: JourneyStepId, answer: JourneyAnswer, viewer: Viewer): Promise<JourneyRecordOutcome>;
  /** Marks the changes since the last Confirmation seen; how many there were (FR-MR-12). */
  markSeen(id: string, viewer: Viewer): Promise<number>;
  /** Marks a published Resource deprecated, with why and what to use instead (FR-SR-50). */
  deprecate(id: string, reason: string, insteadOf: string | null, viewer: Viewer): Promise<DeprecateOutcome>;
  /** Takes the mark away again. */
  undeprecate(id: string, viewer: Viewer): Promise<DeprecateOutcome>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Selectable<CatalogueDatabase['resources']>;
type Database = Kysely<CatalogueDatabase> | Transaction<CatalogueDatabase>;

function present(row: Row): Resource {
  return {
    id: row.id,
    key: row.key,
    fullName: row.fullName ?? row.key,
    displayName: row.displayName,
    name: row.name,
    resourceType: row.resourceType,
    projectId: row.projectId,
    projectName: row.projectName,
    nodeId: row.nodeId,
    description: row.description,
    exposures: row.exposures,
    collectionId: row.collectionId,
    level: row.level,
    registeredAt: row.registeredAt,
    withdrawn: row.withdrawnAt !== null,
    published: row.publishedAt !== null,
    deprecated: row.deprecatedAt !== null,
  };
}

/** Reliable Since from the row of a Resource, its day read as text; null while not set (FR-RC-31). */
function reliableOf(row: Row, day: string | null): ReliableSince | null {
  return row.reliableSinceFrom === null ? null : { from: row.reliableSinceFrom, day: row.reliableSinceFrom === 'day' ? day : null, why: row.reliableSinceWhy };
}

/** What Data Hub keeps about a Resource, from its row and its Known Gaps, with its reliable day read as text. */
function cardOf(row: Row, reliableDay: string | null, knownGaps: KnownGap[]): Card {
  const reliable = reliableOf(row, reliableDay);
  return {
    businessDescription: row.businessDescription,
    intendedUse: row.intendedUse,
    pitfalls: row.pitfalls,
    knownGaps,
    reliableSince: reliable && { ...reliable, setBy: row.reliableSinceByName, setAt: row.reliableSinceAt },
    dateField: row.dateField,
    keyFields: row.keyFields,
    parameters: row.parameters,
  };
}

/** The Known Gaps of a Resource, in the order they were added (FR-RC-21). */
async function gapsOf(from: Database, resourceId: string): Promise<KnownGap[]> {
  const rows = await from.selectFrom('knownGaps').select(['id', 'text', 'scope', 'addedByName', 'addedAt']).where('resourceId', '=', resourceId).orderBy('id').execute();
  return rows.map(gapOf);
}

function gapOf(row: { id: string; text: string; scope: GapScope | null; addedByName: string | null; addedAt: Date | null }): KnownGap {
  return { id: String(row.id), text: row.text, scope: row.scope, addedBy: row.addedByName, addedAt: row.addedAt };
}

/** The Questions and Signals that open a conversation (FR-CV-01): those not closed are open. */
const ASKING = ['MSG-CNV-01', 'MSG-CNV-03'];

/**
 * The Owner Journey of a Resource, from its row (OP-CL-12): what its card holds, what the Data Admin recorded, the open
 * Questions and Signals on it, and what the Owner Unit said where the card cannot tell it (DEC-MR-16).
 */
async function journeyFrom(from: Database, row: Row): Promise<Journey> {
  const [fields, gaps, mappings, open, records, day] = await Promise.all([
    from
      .selectFrom('resourceFields')
      .leftJoin('fieldDescriptions', (join) => join.onRef('fieldDescriptions.resourceId', '=', 'resourceFields.resourceId').onRef('fieldDescriptions.field', '=', 'resourceFields.name'))
      .select(['resourceFields.name', 'fieldDescriptions.text'])
      .where('resourceFields.resourceId', '=', row.id)
      .execute(),
    from.selectFrom('knownGaps').select((eb) => eb.fn.countAll<string>().as('count')).where('resourceId', '=', row.id).executeTakeFirstOrThrow(),
    from.selectFrom('resourceMappings').select((eb) => eb.fn.countAll<string>().as('count')).where('resourceId', '=', row.id).executeTakeFirstOrThrow(),
    from
      .selectFrom('messages')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('subjectKind', '=', 'resource')
      .where('subjectId', '=', row.id)
      .where('parentId', 'is', null)
      .where('type', 'in', ASKING)
      .where((eb) => eb.or([eb('state', 'is', null), eb('state', '!=', 'closed')]))
      .executeTakeFirstOrThrow(),
    from.selectFrom('journeyRecords').select(['step', 'answer', 'userName', 'at']).where('resourceId', '=', row.id).execute(),
    from.selectFrom('resources').select(sql<string | null>`reliable_since::text`.as('day')).where('id', '=', row.id).executeTakeFirstOrThrow(),
  ]);
  return journeyOf({
    level: row.level,
    inCollection: row.collectionId !== null,
    published: row.publishedAt !== null,
    businessDescription: row.businessDescription,
    keyFields: row.keyFields,
    fields: fields.map((field) => ({ name: field.name, businessDescription: field.text ?? '' })),
    intendedUse: row.intendedUse,
    pitfalls: row.pitfalls,
    knownGaps: Number(gaps.count),
    reliableSince: reliableOf(row, day.day),
    parameters: row.parameters,
    modelType: row.modelType,
    grain: row.grain,
    mappings: Number(mappings.count),
    openMessages: Number(open.count),
    records: records.map((record) => ({ step: record.step, answer: record.answer, by: record.userName, at: record.at.toISOString() })),
  });
}

/**
 * Checks a scope against the fields of the Resource (FR-RC-24): every field it names is one of them. A field the gap
 * named already stays allowed when it left the Resource since, so that its text can still be changed (EC-RC-01). A
 * period names no field (DEC-UX-178). Returns the problem as a sentence when there is one.
 */
async function scopeProblem(from: Database, resourceId: string, scope: GapScope, before: GapScope | null): Promise<string | null> {
  const typed = await from.selectFrom('resourceFields').select(['name', 'dataType']).where('resourceId', '=', resourceId).execute();
  const fields = new Set(typed.map((field) => field.name));
  const kept = new Set(fieldsOf(before));
  const unknown = fieldsOf(scope).find((name) => !fields.has(name) && !kept.has(name));
  if (unknown !== undefined) return `${unknown} is no field of this Resource.`;
  // The date field of a period holds a date (FR-RC-34); one kept from before may have left the Resource.
  const on = scope.period?.dateField;
  const field = on === undefined ? undefined : typed.find((one) => one.name === on);
  return field && kindOf(field.dataType) !== 'date' ? `${on} holds no date: a period is read on a field of type DATE, DATETIME or TIMESTAMP.` : null;
}

/** The words of a Known Gap as its Log Entry keeps them: the first 200 characters. */
const gapWords = (text: string) => (text.length > 200 ? `${text.slice(0, 199)}…` : text);

/** A Business Description is written from 2 · Described on (DEC-MR-10). */
const DESCRIBED = 2;
/** Publishing confirms it: 3 · Confirmed (FR-SR-17). */
const CONFIRMED = 3;

export function createResources(db: Kysely<CatalogueDatabase>): Resources {
  async function write(trx: Database, resourceId: string, logId: ResourceLogId, params: Record<string, string>, actorId: string | null = null) {
    await trx.insertInto('resourceLog').values({ resourceId, logId, params, actorId }).execute();
  }

  /**
   * Which Resources the viewer sees (FR-SR-31, DEC-PL-02), or null for every one: who sees all sees every one; others
   * every Resource in a Collection of their Owner Units, and the published ones in every other Collection they see,
   * a public one when `catalogue.see` says public.
   */
  async function seenScope(viewer: Viewer): Promise<{ managed: string[]; visible: string[] } | null> {
    if (seesAll(viewer)) {
      return null;
    }
    const rows = await db.selectFrom('collections').select(['id', 'ownerUnitId', 'visibility']).where('dissolvedAt', 'is', null).execute();
    const managed = rows.filter((row) => theirs(viewer, row.ownerUnitId));
    return {
      managed: managed.map((row) => row.id),
      visible: rows.filter((row) => (row.visibility === 'public' && seesPublic(viewer)) || managed.includes(row)).map((row) => row.id),
    };
  }

  /** A condition on `resources` (as `r`) that keeps those in a scope. */
  function inScope(scope: { managed: string[]; visible: string[] }) {
    // An empty list is a list of one ID no Collection has, as `in ()` is no SQL.
    const ids = (list: string[]) => (list.length > 0 ? list : ['00000000-0000-0000-0000-000000000000']);
    return sql<boolean>`(r.collection_id in (${sql.join(ids(scope.managed))}) or (r.collection_id in (${sql.join(ids(scope.visible))}) and r.published_at is not null))`;
  }

  /**
   * What a new Current Version means for a Resource Data Hub knows already (FR-MR-15, FR-MR-12, FR-RC-17):
   * every field added, removed or retyped goes into its Log and, after a Confirmation, into its warning;
   * every description that changed goes into its Log with the text before; its Level follows the
   * descriptions in dbt; and once it has an Owner, the Owner is told.
   */
  async function follow(trx: Database, row: Row, before: readonly Column[], table: ExposedTable, fields: readonly Column[], run: string, runDay: string): Promise<boolean> {
    const sourceNode = table.name;
    const was = new Map(before.map((field) => [field.name, field]));
    const now = new Map(fields.map((field) => [field.name, field]));
    const changes: { field: string; change: SchemaChange; old: string | null; new: string | null }[] = [
      ...fields.filter((field) => !was.has(field.name)).map((field) => ({ field: field.name, change: 'added' as const, old: null, new: field.dataType })),
      ...before.filter((field) => !now.has(field.name)).map((field) => ({ field: field.name, change: 'removed' as const, old: field.dataType, new: null })),
      ...fields
        .filter((field) => was.has(field.name) && retyped(was.get(field.name)!.dataType, field.dataType))
        .map((field) => ({ field: field.name, change: 'retyped' as const, old: was.get(field.name)!.dataType, new: field.dataType })),
    ];
    for (const change of changes) {
      if (change.change === 'retyped') {
        await write(trx, row.id, 'ART-012', { field: change.field, old: change.old ?? '', new: change.new ?? '', sourceNode, distance: '0' });
      } else {
        await write(trx, row.id, 'ART-010', { field: change.field, direction: change.change, sourceNode, distance: '0' });
      }
    }

    // Its Level follows dbt: Described with the table and a field described, Confirmed again once it was (DEC-MR-08).
    const confirmation = await trx.selectFrom('resourceConfirmations').select('confirmedAt').where('resourceId', '=', row.id).orderBy('id', 'desc').limit(1).executeTakeFirst();
    const { level: described, reason } = levelAtRegistration(table.description, [...fields]);
    const level = described === 2 && confirmation ? 3 : described;

    if (confirmation && changes.length > 0) {
      await trx.insertInto('resourceChanges').values(changes.map((change) => ({ resourceId: row.id, ...change, runId: run }))).execute();
      if (row.collectionId) {
        await tell(trx, row.id, 'MSG-RES-03', {
          confirmed: confirmation.confirmedAt.toISOString().slice(0, 10),
          level: String(level),
          count: String(changes.length),
          changes: JSON.stringify(changes.map(({ field, change, old, new: after }) => ({ field, change, ...(old ? { old } : {}), ...(after ? { new: after } : {}) }))),
        });
      }
    }

    // A field that held a role of its model type is gone, removed or renamed: the role stays, as its warning, and the
    // Data Team is told to choose another field, once per Artifact Set; the Level stays (DEC-RC-23, FR-RC-29).
    const removed = before.filter((field) => !now.has(field.name)).map((field) => field.name);
    if (row.collectionId && removed.length > 0) {
      const gone = (await trx.selectFrom('resourceTypeFields').select(['field', 'role']).where('resourceId', '=', row.id).where('field', 'in', removed).execute()).sort(
        (a, b) => removed.indexOf(a.field) - removed.indexOf(b.field),
      );
      if (gone.length > 0) {
        await tell(trx, row.id, 'MSG-RES-09', {
          run: runDay,
          modelType: row.modelType ?? '',
          level: String(level),
          count: String(gone.length),
          gone: JSON.stringify(gone.map(({ field, role }) => ({ field, role }))),
        });
      }
    }

    const descriptions = [
      ...(row.description !== table.description ? [{ field: null, before: row.description, after: table.description }] : []),
      ...fields.flatMap((field) => {
        const earlier = was.get(field.name);
        return earlier && earlier.description !== field.description ? [{ field: field.name, before: earlier.description, after: field.description }] : [];
      }),
    ];
    if (descriptions.length > 0) {
      await trx.insertInto('descriptionChanges').values(descriptions.map((change) => ({ resourceId: row.id, ...change, runId: run }))).execute();
      await write(trx, row.id, 'ART-013', { sourceNode, distance: '0' });
      if (row.collectionId) {
        const business = new Map(
          (await trx.selectFrom('fieldDescriptions').select(['field', 'text']).where('resourceId', '=', row.id).execute()).map((entry) => [entry.field, entry.text]),
        );
        await tell(trx, row.id, 'MSG-RES-02', {
          run: runDay,
          count: String(descriptions.length),
          changes: JSON.stringify(
            descriptions.map(({ field, before: earlier, after }) => {
              const text = field === null ? row.businessDescription : (business.get(field) ?? '');
              return { on: field === null ? 'table' : 'field', ...(field ? { field } : {}), before: earlier, after, hasBusiness: text ? 'yes' : 'no', ...(text ? { business: text } : {}) };
            }),
          ),
        });
      }
    }

    const structural = changes.some((change) => change.change !== 'retyped');
    if (level !== row.level) {
      await trx.updateTable('resources').set({ level }).where('id', '=', row.id).execute();
      if (level > row.level) {
        await write(trx, row.id, 'RES-002', { level: String(level), reason });
      } else {
        // A drop gives the Owner an alert (FR-MR-09); it stays published (FR-SR-19).
        await write(trx, row.id, 'MAT-021', { level: String(level), reason });
        if (row.collectionId) {
          await tell(trx, row.id, 'MSG-RES-05', { from: String(row.level), to: String(level), cause: 'description', published: row.publishedAt ? 'yes' : 'no' });
        }
      }
    }
    return structural;
  }

  /**
   * The Changes upstream of Resources, each in the Log of every Resource it reaches with its distance, nothing
   * filtered out (FR-AR-12, EC-AR-04), and one Message per Resource whose code, or code upstream, changed: the
   * nearest such change (MSG-RES-04). The Changes of a Resource's own fields and descriptions are logged as its
   * table is read; registry passes them on only from distance 1.
   */
  async function upstream(trx: Database, changes: readonly UpstreamChange[], runDay: string) {
    if (changes.length === 0) return;
    const nodeIds = [...new Set(changes.flatMap((change) => change.reaches.map((reach) => reach.nodeId)))];
    const rows = await trx.selectFrom('resources').select(['id', 'nodeId', 'collectionId']).where('nodeId', 'in', nodeIds).where('withdrawnAt', 'is', null).execute();
    const byNode = new Map<string, typeof rows>();
    for (const row of rows) byNode.set(row.nodeId, [...(byNode.get(row.nodeId) ?? []), row]);
    const entries: { resourceId: string; logId: ResourceLogId; params: Record<string, string> }[] = [];
    const logic = new Map<string, { node: string; distance: number; owned: boolean }>();
    for (const change of changes) {
      for (const reach of change.reaches) {
        for (const row of byNode.get(reach.nodeId) ?? []) {
          const at = { sourceNode: change.node, distance: String(reach.distance) };
          switch (change.kind) {
            case 'structural':
              entries.push({ resourceId: row.id, logId: 'ART-010', params: { field: change.field ?? '', direction: change.direction ?? 'changed', ...at } });
              break;
            case 'type':
              entries.push({ resourceId: row.id, logId: 'ART-012', params: { field: change.field ?? '', old: change.old ?? '', new: change.new ?? '', ...at } });
              break;
            case 'description':
              entries.push({ resourceId: row.id, logId: 'ART-013', params: at });
              break;
            case 'logic': {
              entries.push({ resourceId: row.id, logId: 'ART-011', params: at });
              const nearest = logic.get(row.id);
              if (!nearest || reach.distance < nearest.distance) logic.set(row.id, { node: change.node, distance: reach.distance, owned: row.collectionId !== null });
              break;
            }
            case 'removed':
              entries.push({ resourceId: row.id, logId: 'ART-014', params: at });
              break;
            case 'added':
              entries.push({ resourceId: row.id, logId: 'ART-015', params: at });
              break;
          }
        }
      }
    }
    for (let start = 0; start < entries.length; start += 500) {
      await trx.insertInto('resourceLog').values(entries.slice(start, start + 500).map((entry) => ({ ...entry, actorId: null }))).execute();
    }
    for (const [resourceId, { node, distance, owned }] of logic) {
      // Its Owner is told, one Message per Artifact Set; a Resource without a Collection has none (DEC-SR-26).
      if (owned) await tell(trx, resourceId, 'MSG-RES-04', { run: runDay, node, distance: String(distance) });
    }
  }

  /** A Message from Data Hub on a Resource, for its Owner; lists are kept as JSON in its parameters. */
  async function tell(trx: Database, resourceId: string, type: string, params: Record<string, string>) {
    await trx.insertInto('messages').values({ type, subjectKind: 'resource', subjectId: resourceId, writerId: null, params, state: null }).execute();
  }

  async function fieldNames(trx: Database, resourceId: string): Promise<string[]> {
    return (await typedFields(trx, resourceId)).map((field) => field.name);
  }

  /** The fields of a Resource with their type in BigQuery, in their order, as its model type reads them (FR-CO-44). */
  async function typedFields(trx: Database, resourceId: string): Promise<FieldOfType[]> {
    return trx.selectFrom('resourceFields').select(['name', 'dataType']).where('resourceId', '=', resourceId).orderBy(sql`position nulls last`).orderBy('name').execute();
  }

  /** The fields that hold a role of the model type of a Resource, in the order of its fields; a role whose field is gone last. */
  async function typeFieldsOf(trx: Database, resourceId: string, fields: readonly FieldOfType[]): Promise<RecordedTypeField[]> {
    const order = new Map(fields.map((field, index) => [field.name, index]));
    const rows = await trx.selectFrom('resourceTypeFields').select(['field', 'role', 'origin']).where('resourceId', '=', resourceId).orderBy('field').execute();
    return rows.sort((a, b) => (order.get(a.field) ?? fields.length) - (order.get(b.field) ?? fields.length));
  }

  async function keepColumns(trx: Database, resourceId: string, columns: { fields: Column[]; leftOut: LeftOut[] }) {
    await trx.deleteFrom('resourceFields').where('resourceId', '=', resourceId).execute();
    await trx.deleteFrom('resourceLeftOut').where('resourceId', '=', resourceId).execute();
    if (columns.fields.length > 0) {
      await trx
        .insertInto('resourceFields')
        .values(columns.fields.map(({ name, position, dataType, description }) => ({ resourceId, name, position, dataType, description })))
        .execute();
    }
    if (columns.leftOut.length > 0) {
      await trx
        .insertInto('resourceLeftOut')
        .values(columns.leftOut.map(({ name, dataType, reason }) => ({ resourceId, name, dataType, reason })))
        .execute();
    }
  }

  /** The state of the Message that a Resource waits for a Collection (MSG-RES-01). */
  async function registrationMessage(trx: Database, resourceId: string, state: 'waiting' | 'inCollection') {
    await trx
      .updateTable('messages')
      .set({ state, updatedAt: new Date() })
      .where('type', '=', 'MSG-RES-01')
      .where('subjectKind', '=', 'resource')
      .where('subjectId', '=', resourceId)
      .execute();
  }

  /**
   * Records how a Resource is stored, its grain, model type with the fields it asks for (FR-CO-44) and mappings, and
   * logs it with the addition (FR-CO-33): a mapping in the same transaction as the Log Entry that tells it.
   */
  async function record(trx: Database, resourceId: string, details: Details, fieldCount: number, viewer: Viewer) {
    await trx
      .updateTable('resources')
      .set({
        grain: details.grain,
        grainSentence: details.grainSentence,
        modelType: details.modelType,
        partitionField: details.partition?.field ?? null,
        partitionUnit: details.partition?.unit ?? null,
        clusterBy: details.clusterBy,
        partitionFilter: details.partition ? details.partitionFilter : 'none',
        origins: details.origins,
        domainModelRelease: details.release,
      })
      .where('id', '=', resourceId)
      .execute();
    await trx.deleteFrom('resourceMappings').where('resourceId', '=', resourceId).execute();
    if (details.mappings.length > 0) {
      await trx
        .insertInto('resourceMappings')
        .values(details.mappings.map((mapping) => ({ resourceId, ...mapping, release: details.release })))
        .execute();
    }
    // The fields of the model type, replaced as a whole: those of a model type it no longer has go (DEC-RC-22).
    await trx.deleteFrom('resourceTypeFields').where('resourceId', '=', resourceId).execute();
    if (details.typeFields.length > 0) {
      await trx
        .insertInto('resourceTypeFields')
        .values(details.typeFields.map(({ field, role, origin }) => ({ resourceId, field, role, origin })))
        .execute();
    }
    await write(
      trx,
      resourceId,
      'RES-009',
      {
        mapped: String(details.mappings.length),
        fields: String(fieldCount),
        grain: details.grain.join(', '),
        modelType: details.modelType ?? '',
        release: details.release ?? '',
        actor: viewer.name,
      },
      viewer.id,
    );
  }

  /**
   * The Display Name a Resource gets (FR-SR-33): the name it asks for when no other Resource that is
   * not withdrawn has it, else with its dbt project in brackets, else with its Key.
   */
  async function freeName(trx: Database, wanted: string, update: ResourcesUpdate, key: string, self?: string): Promise<string> {
    for (const candidate of [wanted, `${wanted} (${update.projectName ?? `project ${update.projectId}`})`, `${wanted} (${key})`]) {
      const taken = await trx
        .selectFrom('resources')
        .select('id')
        .where(sql`lower(display_name)`, '=', candidate.toLowerCase())
        .where('withdrawnAt', 'is', null)
        .$if(self !== undefined, (query) => query.where('id', '<>', self!))
        .executeTakeFirst();
      if (!taken) {
        return candidate;
      }
    }
    return key;
  }

  return {
    async apply(update) {
      return db.transaction().execute(async (trx) => {
        const outcome: UpdateOutcome = { applied: true, registered: 0, renamed: 0, withdrawn: 0, back: 0, changed: [] };
        // One call per dbt project at a time, and never one about an older run (TR-SR-02).
        await trx.insertInto('resourceSyncs').values({ projectId: update.projectId, runId: update.runId }).onConflict((conflict) => conflict.doNothing()).execute();
        const last = await trx.selectFrom('resourceSyncs').select('runId').where('projectId', '=', update.projectId).forUpdate().executeTakeFirstOrThrow();
        if (BigInt(update.runId) < BigInt(last.runId)) {
          return { ...outcome, applied: false };
        }
        const run = update.runId;
        // The day of the run, as the Message about a new Resource says it (MSG-RES-01).
        const runDay = (update.generatedAt ?? new Date().toISOString()).slice(0, 10);
        const keys = new Set(update.tables.map((table) => table.key));

        // First withdraw what is no longer exposed, so that its Display Name is free for others.
        const gone = await trx
          .updateTable('resources')
          .set({ withdrawnAt: new Date(), updatedAt: new Date() })
          .where('projectId', '=', update.projectId)
          .where('withdrawnAt', 'is', null)
          .$if(keys.size > 0, (query) => query.where('key', 'not in', [...keys]))
          .returning(['id', 'collectionId'])
          .execute();
        for (const { id, collectionId } of gone) {
          await write(trx, id, 'RES-004', { run });
          // Its Owner hears of it; a Resource without a Collection has none (MSG-RES-06, DEC-SR-26).
          if (collectionId) await tell(trx, id, 'MSG-RES-06', { run: runDay });
        }
        outcome.withdrawn = gone.length;
        outcome.changed.push(...gone.map((row) => row.id));

        const known = new Map(
          keys.size === 0 ? [] : (await trx.selectFrom('resources').selectAll().where('key', 'in', [...keys]).forUpdate().execute()).map((row) => [row.key, row]),
        );
        for (const table of update.tables) {
          const wanted = table.label ?? table.name;
          const exposure = table.exposures[0] ?? '';
          const facts = {
            projectId: update.projectId,
            projectName: update.projectName,
            nodeId: table.nodeId,
            fullName: table.fullName ?? table.key,
            name: table.name,
            resourceType: table.resourceType,
            description: table.description,
            exposures: table.exposures,
          };
          const columns = splitColumns(table.columns);
          // While it waits for a Collection, it is stored as dbt says; once a Data Admin added it, as they recorded.
          const fromDbt =
            table.storage === undefined
              ? {}
              : {
                  partitionField: table.storage?.partition?.field ?? null,
                  partitionUnit: table.storage?.partition?.unit ?? null,
                  clusterBy: table.storage?.clusterBy ?? [],
                  partitionFilter: table.storage?.partition && table.storage.requirePartitionFilter ? ('bigQuery' as const) : ('none' as const),
                  origins: table.storage ? { partition: 'dbt' as const, clusterBy: 'dbt' as const, partitionFilter: 'dbt' as const } : {},
                };
          const row = known.get(table.key);
          if (!row) {
            // A Registration (the flow "registering a Resource"): the Resource with its Level, its
            // fields, its Fingerprint, the first entries of its Log, and the Message to the Data Team.
            const displayName = await freeName(trx, wanted, update, table.key);
            const { level, reason } = levelAtRegistration(table.description, columns.fields);
            const { id } = await trx
              .insertInto('resources')
              .values({ key: table.key, ...facts, ...fromDbt, requestedName: wanted, displayName, level })
              .returning('id')
              .executeTakeFirstOrThrow();
            await keepColumns(trx, id, columns);
            await trx
              .insertInto('resourceFingerprints')
              .values({ resourceId: id, runId: run, ...fingerprint(table.description, columns.fields, table.checksum) })
              .execute();
            await write(trx, id, 'RES-001', { exposure, key: table.key, run });
            await write(trx, id, 'RES-002', { level: String(level), reason });
            await trx
              .insertInto('messages')
              .values({
                type: 'MSG-RES-01',
                subjectKind: 'resource',
                subjectId: id,
                writerId: null,
                params: { exposure, project: update.projectName ?? `project ${update.projectId}`, run: runDay },
                state: 'waiting',
              })
              .onConflict((conflict) => conflict.doNothing())
              .execute();
            outcome.registered++;
            continue;
          }
          const back = row.withdrawnAt !== null;
          const before = await trx.selectFrom('resourceFields').select(['name', 'position', 'dataType', 'description']).where('resourceId', '=', row.id).execute();
          // A Resource that comes back, or asks for another name, gets its Display Name again.
          const displayName = back || wanted !== row.requestedName ? await freeName(trx, wanted, update, table.key, row.id) : row.displayName;
          await trx
            .updateTable('resources')
            .set({ ...facts, ...(row.collectionId === null ? fromDbt : {}), requestedName: wanted, displayName, withdrawnAt: null, updatedAt: new Date() })
            .where('id', '=', row.id)
            .execute();
          await keepColumns(trx, row.id, columns);
          if ((await follow(trx, row, before, table, columns.fields, run, runDay)) || back) outcome.changed.push(row.id);
          if (back) {
            await write(trx, row.id, 'RES-006', { exposure, run });
            outcome.back++;
          }
          if (displayName !== row.displayName) {
            await write(trx, row.id, 'RES-003', { old: row.displayName, new: displayName, run });
            outcome.renamed++;
          }
        }
        await upstream(trx, update.changes ?? [], runDay);
        await trx.updateTable('resourceSyncs').set({ runId: update.runId, syncedAt: new Date() }).where('projectId', '=', update.projectId).execute();
        return outcome;
      });
    },

    async withoutCollection() {
      const rows = await db
        .selectFrom('resources')
        .selectAll()
        .where('collectionId', 'is', null)
        .where('withdrawnAt', 'is', null)
        .orderBy(sql`lower(display_name)`)
        .execute();
      return rows.map(present);
    },

    async inCollection(collectionId) {
      if (!UUID.test(collectionId)) {
        return [];
      }
      const rows = await db.selectFrom('resources').selectAll().where('collectionId', '=', collectionId).orderBy(sql`lower(display_name)`).execute();
      const latest =
        rows.length === 0
          ? []
          : await db
              .selectFrom('resourceLog')
              .select(['resourceId', 'logId', 'params', 'at'])
              .distinctOn('resourceId')
              .where('resourceId', 'in', rows.map((row) => row.id))
              .orderBy('resourceId')
              .orderBy('id', 'desc')
              .execute();
      const changes = new Map(latest.map((entry) => [entry.resourceId, { logId: entry.logId, text: logText(entry.logId, entry.params), params: entry.params, at: entry.at }]));
      return rows.map((row) => ({ ...present(row), lastChange: changes.get(row.id) ?? null }));
    },

    async get(id) {
      if (!UUID.test(id)) {
        return undefined;
      }
      const row = await db.selectFrom('resources').selectAll().where('id', '=', id).executeTakeFirst();
      return row && present(row);
    },

    async fillTypes(id, types) {
      if (!UUID.test(id) || types.size === 0) {
        return 0;
      }
      return db.transaction().execute(async (trx) => {
        const untyped = await trx.selectFrom('resourceFields').select('name').where('resourceId', '=', id).where('dataType', 'is', null).execute();
        let filled = 0;
        for (const { name } of untyped) {
          const dataType = types.get(name.toLowerCase());
          if (!dataType) continue;
          await trx.updateTable('resourceFields').set({ dataType }).where('resourceId', '=', id).where('name', '=', name).where('dataType', 'is', null).execute();
          filled++;
        }
        return filled;
      });
    },

    async detail(id) {
      if (!UUID.test(id)) {
        return undefined;
      }
      const row = await db
        .selectFrom('resources')
        .selectAll()
        .select(sql<string | null>`reliable_since::text`.as('reliableDay'))
        .where('id', '=', id)
        .executeTakeFirst();
      if (!row) {
        return undefined;
      }
      const written = new Map(
        (await db.selectFrom('fieldDescriptions').select(['field', 'text']).where('resourceId', '=', id).execute()).map((entry) => [entry.field, entry.text]),
      );
      const fields = (
        await db
          .selectFrom('resourceFields')
          .select(['name', 'position', 'dataType', 'description'])
          .where('resourceId', '=', id)
          .orderBy(sql`position nulls last`)
          .orderBy('name')
          .execute()
      ).map((field) => ({ ...field, businessDescription: written.get(field.name) ?? '' }));
      const leftOut = await db.selectFrom('resourceLeftOut').select(['name', 'dataType', 'reason']).where('resourceId', '=', id).orderBy('name').execute();
      const mappings = await db
        .selectFrom('resourceMappings')
        .select(['field', 'kind', 'relationType', 'identity', 'subject', 'origin', 'inDomainModel'])
        .where('resourceId', '=', id)
        .execute();
      const order = new Map(fields.map((field, index) => [field.name, index]));
      const typeFields = await typeFieldsOf(db, id, fields);
      const details: Details = {
        partition: row.partitionField ? { field: row.partitionField, unit: row.partitionUnit } : null,
        clusterBy: row.clusterBy,
        partitionFilter: row.partitionFilter,
        grain: row.grain,
        grainSentence: row.grainSentence,
        modelType: row.modelType,
        typeFields,
        origins: row.origins,
        release: row.domainModelRelease,
        mappings: mappings.sort((a, b) => (order.get(a.field) ?? 0) - (order.get(b.field) ?? 0)),
      };
      const confirmation = await db
        .selectFrom('resourceConfirmations')
        .select(['ownerName', 'confirmedAt'])
        .where('resourceId', '=', id)
        .orderBy('id', 'desc')
        .limit(1)
        .executeTakeFirst();
      const instead = row.insteadOf ? await db.selectFrom('resources').select(['id', 'displayName']).where('id', '=', row.insteadOf).executeTakeFirst() : undefined;
      const changes = await db
        .selectFrom('resourceChanges')
        .select(['field', 'change', 'old', 'new', 'at'])
        .where('resourceId', '=', id)
        .where('seenAt', 'is', null)
        .orderBy('id')
        .execute();
      // The latest change of each description in the last 30 days, with the text before it.
      const descriptionChanges = await db
        .selectFrom('descriptionChanges')
        .select(['field', 'before', 'at'])
        .distinctOn(sql`coalesce(field, '')`)
        .where('resourceId', '=', id)
        .where('at', '>', sql<Date>`now() - interval '30 days'`)
        .orderBy(sql`coalesce(field, '')`)
        .orderBy('id', 'desc')
        .execute();
      return {
        ...present(row),
        fields,
        leftOut,
        details,
        typeState: typeStateOf(row.modelType, typeFields, fields, row.grainSentence),
        card: cardOf(row, row.reliableDay, await gapsOf(db, id)),
        publication:
          row.publishedAt && confirmation
            ? { publishedAt: row.publishedAt, publishedBy: row.publishedBy ?? '', confirmedAt: confirmation.confirmedAt, confirmedBy: confirmation.ownerName }
            : null,
        deprecation: row.deprecatedAt
          ? { at: row.deprecatedAt, by: row.deprecatedBy ?? '', reason: row.deprecationReason ?? '', insteadOf: instead ? { id: instead.id, displayName: instead.displayName } : null }
          : null,
        changes,
        descriptionChanges,
        journey: await journeyFrom(db, row),
      };
    },

    async journey(id) {
      if (!UUID.test(id)) {
        return undefined;
      }
      const row = await db.selectFrom('resources').selectAll().where('id', '=', id).executeTakeFirst();
      return row ? journeyFrom(db, row) : undefined;
    },

    async recordStep(id, step, answer, viewer) {
      if (!UUID.test(id)) {
        return { outcome: 'not_found' };
      }
      if (!journeyStep(step).answers.includes(answer)) {
        return { outcome: 'invalid', message: `The step ${step} takes no answer ${answer}.` };
      }
      return db.transaction().execute(async (trx): Promise<JourneyRecordOutcome> => {
        const row = await trx.selectFrom('resources').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();
        if (!row) {
          return { outcome: 'not_found' };
        }
        // The newest of each answer, with who and when; the Log keeps every one (DEC-MR-16).
        await trx
          .insertInto('journeyRecords')
          .values({ resourceId: id, step, answer, userId: viewer.id, userName: viewer.name })
          .onConflict((conflict) => conflict.columns(['resourceId', 'step', 'answer']).doUpdateSet({ userId: viewer.id, userName: viewer.name, at: new Date() }))
          .execute();
        await write(trx, id, answer === 'nothing' ? 'JRN-002' : 'JRN-001', { step, actor: viewer.name }, viewer.id);
        return { outcome: 'recorded', journey: await journeyFrom(trx, row) };
      });
    },

    async add(items, collection, viewer) {
      const wanted = [...new Map(items.map((item) => [item.id, item])).values()];
      const unknown = wanted.filter((item) => !UUID.test(item.id)).map((item) => item.id);
      if (unknown.length > 0) {
        return { outcome: 'not_found', ids: unknown };
      }
      return db.transaction().execute(async (trx): Promise<AddOutcome> => {
        // Holds the Collection, so that it is not dissolved meanwhile (FR-CO-10).
        const live = await trx.selectFrom('collections').select('id').where('id', '=', collection.id).where('dissolvedAt', 'is', null).forShare().executeTakeFirst();
        if (!live) {
          return { outcome: 'collection_gone' };
        }
        const ids = wanted.map((item) => item.id);
        const rows = ids.length === 0 ? [] : await trx.selectFrom('resources').selectAll().where('id', 'in', ids).orderBy('id').forUpdate().execute();
        const missing = ids.filter((id) => !rows.some((row) => row.id === id));
        if (missing.length > 0) {
          return { outcome: 'not_found', ids: missing };
        }
        const elsewhere = rows.filter((row) => row.collectionId !== null && row.collectionId !== collection.id);
        if (elsewhere.length > 0) {
          return { outcome: 'in_another_collection', ids: elsewhere.map((row) => row.id) };
        }
        const adding = rows.filter((row) => row.collectionId === null).sort((a, b) => a.displayName.localeCompare(b.displayName));
        const fieldsOf = new Map<string, FieldOfType[]>();
        if (adding.length > 0) {
          for (const field of await trx
            .selectFrom('resourceFields')
            .select(['resourceId', 'name', 'dataType'])
            .where('resourceId', 'in', adding.map((row) => row.id))
            .orderBy(sql`position nulls last`)
            .orderBy('name')
            .execute()) {
            fieldsOf.set(field.resourceId, [...(fieldsOf.get(field.resourceId) ?? []), { name: field.name, dataType: field.dataType }]);
          }
        }
        for (const row of adding) {
          // Recorded, its model type has every field it asks for, or it is not added (FR-CO-44); one sent by its ID alone, as before.
          const details = wanted.find((item) => item.id === row.id)?.details;
          const problem = details && (checkDetails(details, fieldsOf.get(row.id) ?? []) ?? incomplete(details, fieldsOf.get(row.id) ?? []));
          if (problem) {
            return { outcome: 'invalid', id: row.id, message: `${row.displayName}: ${problem}` };
          }
        }
        for (const row of adding) {
          const details = wanted.find((item) => item.id === row.id)?.details;
          await trx.updateTable('resources').set({ collectionId: collection.id, updatedAt: new Date() }).where('id', '=', row.id).execute();
          // A Resource comes in at the top of the Collection (FR-CO-38).
          await trx.deleteFrom('folderPlaces').where('kind', '=', 'resource').where('itemId', '=', row.id).execute();
          await registrationMessage(trx, row.id, 'inCollection');
          await write(trx, row.id, 'COL-030', { collection: collection.name, actor: viewer.name }, viewer.id);
          if (details) {
            await record(trx, row.id, details, (fieldsOf.get(row.id) ?? []).length, viewer);
          }
          await trx
            .insertInto('collectionLog')
            .values({ collectionId: collection.id, logId: 'COL-006', params: { resource: row.displayName, actor: viewer.name }, actorId: viewer.id })
            .execute();
          // Its Owner is told that it arrived (DEC-CV-11), with its Level as a number, as a Message keeps it; never who
          // added it, also when they are in the Owner Unit themselves (`actorId`, TR-LN-02).
          await trx
            .insertInto('messages')
            .values({
              type: 'MSG-RES-08',
              subjectKind: 'resource',
              subjectId: row.id,
              writerId: null,
              params: { collection: collection.name, actor: viewer.name, actorId: viewer.id, level: String(row.level) },
              state: null,
            })
            .execute();
        }
        return { outcome: 'added', added: adding.length };
      });
    },

    async remove(id, viewer) {
      return db.transaction().execute(async (trx) => {
        const row = await trx.selectFrom('resources').selectAll().where('id', '=', id).forUpdate().executeTakeFirstOrThrow();
        if (row.collectionId === null) {
          return false;
        }
        const collection = await trx.selectFrom('collections').select('name').where('id', '=', row.collectionId).executeTakeFirstOrThrow();
        await trx.updateTable('resources').set({ collectionId: null, updatedAt: new Date() }).where('id', '=', id).execute();
        // It leaves its folder with its Collection (FR-CO-38).
        await trx.deleteFrom('folderPlaces').where('kind', '=', 'resource').where('itemId', '=', id).execute();
        // Without a Collection, it waits for one again.
        await registrationMessage(trx, id, 'waiting');
        await write(trx, id, 'COL-031', { collection: collection.name, actor: viewer.name }, viewer.id);
        await trx
          .insertInto('collectionLog')
          .values({ collectionId: row.collectionId, logId: 'COL-007', params: { resource: row.displayName, actor: viewer.name }, actorId: viewer.id })
          .execute();
        return true;
      });
    },

    async log(id, limit) {
      if (!UUID.test(id)) {
        return [];
      }
      const rows = await db.selectFrom('resourceLog').select(['logId', 'params', 'at']).where('resourceId', '=', id).orderBy('id', 'desc').limit(limit).execute();
      return rows.map((row) => ({ logId: row.logId, text: logText(row.logId, row.params), params: row.params, at: row.at }));
    },

    async edit(id, changes, viewer, allowed = () => true) {
      if (!UUID.test(id)) {
        return { outcome: 'not_found' };
      }
      return db.transaction().execute(async (trx): Promise<EditOutcome> => {
        const row = await trx
          .selectFrom('resources')
          .selectAll()
          .select(sql<string | null>`reliable_since::text`.as('reliableDay'))
          .where('id', '=', id)
          .forUpdate()
          .executeTakeFirst();
        if (!row) {
          return { outcome: 'not_found' };
        }
        const gaps = await gapsOf(trx, id);
        // As it is compared: the gaps by their texts, Reliable Since without who set it and when.
        const current = { ...cardOf(row, row.reliableDay, gaps), knownGaps: gaps.map((gap) => gap.text), reliableSince: reliableOf(row, row.reliableDay) };
        const changed = CARD_KEYS.filter((key) => changes[key] !== undefined && JSON.stringify(changes[key]) !== JSON.stringify(current[key]));
        const refused = changed.find((key) => !allowed(key));
        if (refused !== undefined) {
          return { outcome: 'forbidden', field: refused };
        }
        if (changed.includes('businessDescription') && changes.businessDescription && row.level < DESCRIBED) {
          return { outcome: 'not_described' };
        }
        const typed = await typedFields(trx, id);
        const fields = new Set(typed.map((field) => field.name));
        const stranger = [...(changes.keyFields ?? []), ...(changes.parameters ?? []), ...(changes.dateField ? [changes.dateField] : [])].find((name) => !fields.has(name));
        if (stranger !== undefined) {
          return { outcome: 'invalid', message: `${row.displayName} has no field ${stranger}.` };
        }
        // The Date Field is one of its date fields (FR-RC-32).
        if (changed.includes('dateField') && changes.dateField && kindOf(typed.find((field) => field.name === changes.dateField)?.dataType ?? null) !== 'date') {
          return { outcome: 'invalid', message: `${changes.dateField} holds no date: the Date Field is of type DATE, DATETIME or TIMESTAMP.` };
        }
        if (changed.length === 0) {
          return { outcome: 'edited', changed };
        }
        if (changes.knownGaps && changes.knownGaps.length > MAX_GAPS) {
          return { outcome: 'invalid', message: `A Resource has at most ${MAX_GAPS} Known Gaps.` };
        }
        const onRow = changed.filter((key) => key !== 'knownGaps');
        const plain = onRow.filter((key) => key !== 'reliableSince');
        // Reliable Since with who set it and when; cleared, none of it (FR-RC-31).
        const reliable = changed.includes('reliableSince') ? (changes.reliableSince ?? null) : undefined;
        await trx
          .updateTable('resources')
          .set({
            ...Object.fromEntries(plain.map((key) => [key, changes[key]])),
            ...(reliable === undefined
              ? {}
              : {
                  reliableSince: reliable?.from === 'day' ? reliable.day : null,
                  reliableSinceFrom: reliable?.from ?? null,
                  reliableSinceWhy: reliable?.from === 'day' ? reliable.why : '',
                  reliableSinceByName: reliable ? viewer.name : null,
                  reliableSinceAt: reliable ? new Date() : null,
                }),
            updatedAt: new Date(),
          })
          .where('id', '=', id)
          .execute();
        for (const key of onRow) {
          await write(trx, id, 'RES-005', { field: key, actor: viewer.name }, viewer.id);
        }
        if (changes.knownGaps && changed.includes('knownGaps')) {
          // The whole list, as its texts: a gap whose text stays keeps who added it; the others go, and the new come.
          const wanted = [...changes.knownGaps];
          const kept = new Set<string>();
          for (const gap of gaps) {
            const place = wanted.indexOf(gap.text);
            if (place >= 0) {
              wanted.splice(place, 1);
              kept.add(gap.id);
            }
          }
          for (const gap of gaps.filter((one) => !kept.has(one.id))) {
            await trx.deleteFrom('knownGaps').where('id', '=', gap.id).execute();
            await write(trx, id, 'RES-013', { actor: viewer.name, gap: gapWords(gap.text) }, viewer.id);
          }
          for (const text of wanted) {
            await trx.insertInto('knownGaps').values({ resourceId: id, text, addedBy: viewer.id, addedByName: viewer.name, addedAt: new Date() }).execute();
            await write(trx, id, 'RES-011', { actor: viewer.name, gap: gapWords(text) }, viewer.id);
          }
        }
        return { outcome: 'edited', changed };
      });
    },

    async addGap(id, text, scope, viewer) {
      if (!UUID.test(id)) {
        return { outcome: 'not_found' };
      }
      return db.transaction().execute(async (trx): Promise<GapOutcome> => {
        const row = await trx.selectFrom('resources').select('id').where('id', '=', id).forUpdate().executeTakeFirst();
        if (!row) {
          return { outcome: 'not_found' };
        }
        const { count } = await trx.selectFrom('knownGaps').select((eb) => eb.fn.countAll<string>().as('count')).where('resourceId', '=', id).executeTakeFirstOrThrow();
        if (Number(count) >= MAX_GAPS) {
          return { outcome: 'invalid', message: `A Resource has at most ${MAX_GAPS} Known Gaps.` };
        }
        const narrowed = hasScope(scope) ? scope : null;
        const problem = narrowed ? await scopeProblem(trx, id, narrowed, null) : null;
        if (problem) {
          return { outcome: 'invalid', message: problem };
        }
        const added = await trx
          .insertInto('knownGaps')
          .values({ resourceId: id, text, scope: narrowed, addedBy: viewer.id, addedByName: viewer.name, addedAt: new Date() })
          .returning(['id', 'text', 'scope', 'addedByName', 'addedAt'])
          .executeTakeFirstOrThrow();
        await trx.updateTable('resources').set({ updatedAt: new Date() }).where('id', '=', id).execute();
        await write(trx, id, 'RES-011', { actor: viewer.name, gap: gapWords(text) }, viewer.id);
        return { outcome: 'done', gap: gapOf(added) };
      });
    },

    async changeGap(id, gapId, text, scope, viewer) {
      if (!UUID.test(id) || !/^\d{1,18}$/.test(gapId)) {
        return { outcome: 'not_found' };
      }
      return db.transaction().execute(async (trx): Promise<GapOutcome> => {
        const gap = await trx.selectFrom('knownGaps').select(['text', 'scope']).where('id', '=', gapId).where('resourceId', '=', id).forUpdate().executeTakeFirst();
        if (!gap) {
          return { outcome: 'not_found' };
        }
        const narrowed = scope === undefined ? gap.scope : hasScope(scope) ? scope : null;
        const problem = narrowed && scope !== undefined ? await scopeProblem(trx, id, narrowed, gap.scope) : null;
        if (problem) {
          return { outcome: 'invalid', message: problem };
        }
        const changed = await trx
          .updateTable('knownGaps')
          .set({ text, scope: narrowed })
          .where('id', '=', gapId)
          .returning(['id', 'text', 'scope', 'addedByName', 'addedAt'])
          .executeTakeFirstOrThrow();
        if (gap.text !== text || JSON.stringify(gap.scope) !== JSON.stringify(narrowed)) {
          await trx.updateTable('resources').set({ updatedAt: new Date() }).where('id', '=', id).execute();
          await write(trx, id, 'RES-012', { actor: viewer.name, gap: gapWords(text) }, viewer.id);
        }
        return { outcome: 'done', gap: gapOf(changed) };
      });
    },

    async removeGap(id, gapId, viewer) {
      if (!UUID.test(id) || !/^\d{1,18}$/.test(gapId)) {
        return { outcome: 'not_found' };
      }
      return db.transaction().execute(async (trx): Promise<GapOutcome> => {
        const gone = await trx.deleteFrom('knownGaps').where('id', '=', gapId).where('resourceId', '=', id).returning('text').executeTakeFirst();
        if (!gone) {
          return { outcome: 'not_found' };
        }
        await trx.updateTable('resources').set({ updatedAt: new Date() }).where('id', '=', id).execute();
        await write(trx, id, 'RES-013', { actor: viewer.name, gap: gapWords(gone.text) }, viewer.id);
        return { outcome: 'done', gap: null };
      });
    },

    async describeFields(id, descriptions, viewer) {
      if (!UUID.test(id)) {
        return { outcome: 'not_found' };
      }
      return db.transaction().execute(async (trx): Promise<EditOutcome> => {
        const row = await trx.selectFrom('resources').select(['displayName', 'level']).where('id', '=', id).forUpdate().executeTakeFirst();
        if (!row) {
          return { outcome: 'not_found' };
        }
        const fields = new Set(await fieldNames(trx, id));
        const stranger = descriptions.find((entry) => !fields.has(entry.field));
        if (stranger) {
          return { outcome: 'invalid', message: `${row.displayName} has no field ${stranger.field}.` };
        }
        const written = new Map(
          (await trx.selectFrom('fieldDescriptions').select(['field', 'text']).where('resourceId', '=', id).execute()).map((entry) => [entry.field, entry.text]),
        );
        const changed = descriptions.filter((entry) => entry.text !== (written.get(entry.field) ?? ''));
        if (changed.some((entry) => entry.text !== '') && row.level < DESCRIBED) {
          return { outcome: 'not_described' };
        }
        for (const { field, text } of changed) {
          if (text === '') {
            await trx.deleteFrom('fieldDescriptions').where('resourceId', '=', id).where('field', '=', field).execute();
          } else {
            await trx
              .insertInto('fieldDescriptions')
              .values({ resourceId: id, field, text, updatedBy: viewer.id })
              .onConflict((conflict) => conflict.columns(['resourceId', 'field']).doUpdateSet({ text, updatedAt: new Date(), updatedBy: viewer.id }))
              .execute();
          }
          await write(trx, id, 'RES-010', { field, actor: viewer.name }, viewer.id);
        }
        return { outcome: 'edited', changed: changed.map((entry) => entry.field) };
      });
    },

    async relate(id, details, viewer, complete = false) {
      if (!UUID.test(id)) {
        return { outcome: 'not_found' };
      }
      return db.transaction().execute(async (trx): Promise<EditOutcome> => {
        const row = await trx.selectFrom('resources').select(['displayName']).where('id', '=', id).forUpdate().executeTakeFirst();
        if (!row) {
          return { outcome: 'not_found' };
        }
        const fields = await typedFields(trx, id);
        // A role whose field is gone may stay as it was recorded: the Resource shows it as gone (DEC-RC-23).
        const kept = await typeFieldsOf(trx, id, fields);
        const problem = checkDetails(details, fields, kept) ?? (complete ? incomplete(details, fields) : undefined);
        if (problem) {
          return { outcome: 'invalid', message: `${row.displayName}: ${problem}` };
        }
        await record(trx, id, details, fields.length, viewer);
        return { outcome: 'edited', changed: ['details'] };
      });
    },

    async toComplete() {
      const rows = await db
        .selectFrom('resources as r')
        .innerJoin('collections as c', 'c.id', 'r.collectionId')
        .select(['r.id', 'r.displayName', 'r.level', 'r.modelType', 'r.grainSentence', 'c.id as collectionId', 'c.name as collectionName'])
        .where('r.withdrawnAt', 'is', null)
        .orderBy(sql`lower(r.display_name)`)
        .orderBy('r.id')
        .execute();
      if (rows.length === 0) {
        return [];
      }
      const ids = rows.map((row) => row.id);
      const fields = new Map<string, FieldOfType[]>();
      for (const field of await db
        .selectFrom('resourceFields')
        .select(['resourceId', 'name', 'dataType'])
        .where('resourceId', 'in', ids)
        .orderBy('resourceId')
        .orderBy(sql`position nulls last`)
        .orderBy('name')
        .execute()) {
        (fields.get(field.resourceId) ?? fields.set(field.resourceId, []).get(field.resourceId)!).push({ name: field.name, dataType: field.dataType });
      }
      const typeFields = new Map<string, TypeField[]>();
      for (const held of await db.selectFrom('resourceTypeFields').select(['resourceId', 'field', 'role']).where('resourceId', 'in', ids).orderBy('field').execute()) {
        (typeFields.get(held.resourceId) ?? typeFields.set(held.resourceId, []).get(held.resourceId)!).push({ field: held.field, role: held.role });
      }
      return rows.flatMap((row) => {
        const state = typeStateOf(row.modelType, typeFields.get(row.id) ?? [], fields.get(row.id) ?? [], row.grainSentence);
        return state.missing.length === 0
          ? []
          : [{ id: row.id, displayName: row.displayName, collection: { id: row.collectionId, name: row.collectionName }, level: row.level, ...state }];
      });
    },

    async related(id, viewer) {
      if (!UUID.test(id)) {
        return [];
      }
      const order = new Map((await fieldNames(db, id)).map((name, index) => [name, index]));
      const mappings = (
        await db
          .selectFrom('resourceMappings')
          .select(['field', 'kind', 'relationType', 'identity', 'inDomainModel'])
          .where('resourceId', '=', id)
          .execute()
      ).sort((a, b) => (order.get(a.field) ?? 0) - (order.get(b.field) ?? 0));
      const scope = await seenScope(viewer);
      const identities = [...new Set(mappings.map((mapping) => mapping.identity))];
      const carriers =
        identities.length === 0
          ? []
          : await db
              .selectFrom('resourceMappings as m')
              .innerJoin('resources as r', 'r.id', 'm.resourceId')
              .select(['m.identity', 'm.field', 'r.id', 'r.displayName', 'r.level'])
              .where('m.identity', 'in', identities)
              .where('r.id', '<>', id)
              .where('r.withdrawnAt', 'is', null)
              .$if(scope !== null, (query) => query.where(inScope(scope!)))
              .orderBy(sql`lower(r.display_name)`)
              .execute();
      return mappings.map((mapping) => ({
        ...mapping,
        resources: carriers
          .filter((carrier) => carrier.identity === mapping.identity)
          .map((carrier) => ({ id: carrier.id, displayName: carrier.displayName, level: carrier.level, field: carrier.field })),
      }));
    },

    async withdrawnList() {
      const rows = await db
        .selectFrom('resources as r')
        .leftJoin('collections as c', 'c.id', 'r.collectionId')
        .select(['r.id', 'r.displayName', 'r.key', 'r.fullName', 'r.projectId', 'r.projectName', 'r.level', 'r.withdrawnAt', 'c.id as collectionId', 'c.name as collectionName'])
        .where('r.withdrawnAt', 'is not', null)
        .orderBy('r.withdrawnAt', 'desc')
        .orderBy(sql`lower(r.display_name)`)
        .execute();
      const ids = rows.map((row) => row.id);
      // The run that withdrew it: the newest RES-004 in its Log.
      const runs = new Map<string, string>();
      if (ids.length > 0) {
        const logged = await db.selectFrom('resourceLog').select(['resourceId', 'params']).where('logId', '=', 'RES-004').where('resourceId', 'in', ids).orderBy('id', 'desc').execute();
        for (const entry of logged) if (!runs.has(entry.resourceId) && typeof entry.params.run === 'string') runs.set(entry.resourceId, entry.params.run);
      }
      return rows.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        key: row.fullName ?? row.key,
        project: row.projectName ?? row.projectId,
        collection: row.collectionId && row.collectionName ? { id: row.collectionId, name: row.collectionName } : null,
        level: row.level,
        withdrawnAt: row.withdrawnAt!,
        run: runs.get(row.id) ?? null,
      }));
    },

    async atNodes(nodeIds, viewer) {
      if (nodeIds.length === 0) {
        return [];
      }
      const scope = await seenScope(viewer);
      return db
        .selectFrom('resources as r')
        .select(['r.nodeId', 'r.id', 'r.displayName', 'r.level'])
        .where('r.nodeId', 'in', [...nodeIds])
        .where('r.withdrawnAt', 'is', null)
        .$if(scope !== null, (query) => query.where(inScope(scope!)))
        .execute();
    },

    async publish(id, viewer, declaration) {
      if (!UUID.test(id)) {
        return 'not_found';
      }
      return db.transaction().execute(async (trx): Promise<PublishOutcome> => {
        const row = await trx.selectFrom('resources').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();
        if (!row) {
          return 'not_found';
        }
        if (row.collectionId === null) {
          return 'no_collection';
        }
        if (row.publishedAt !== null) {
          return 'already_published';
        }
        if (row.level < DESCRIBED) {
          return 'not_described';
        }
        // Only once every step required to publish is done, in Data Hub as in Claude (DEC-MR-15).
        const journey = await journeyFrom(trx, row);
        if (!journey.ready) {
          return { outcome: 'not_ready', open: journey.open };
        }
        // The first Publication is the first Confirmation, kept with the Fingerprint of this moment (FR-MR-08) and the
        // declaration the Owner ticked, which accepts every text on the card (DEC-MR-17).
        const fields = await trx.selectFrom('resourceFields').select(['name', 'position', 'dataType', 'description']).where('resourceId', '=', id).orderBy(sql`position nulls last`).execute();
        const code = (await trx.selectFrom('resourceFingerprints').select('code').where('resourceId', '=', id).orderBy('id', 'desc').limit(1).executeTakeFirst())?.code ?? null;
        const print = fingerprint(row.description, fields, code);
        await trx
          .insertInto('resourceConfirmations')
          .values({ resourceId: id, ownerId: viewer.id, ownerName: viewer.name, ...print, fields: JSON.stringify(fields.map(({ name, dataType }) => ({ name, dataType }))), declaration })
          .execute();
        await trx.updateTable('resources').set({ publishedAt: new Date(), publishedBy: viewer.name, level: CONFIRMED, updatedAt: new Date() }).where('id', '=', id).execute();
        await write(trx, id, 'PUB-040', { owner: viewer.name, level: String(CONFIRMED) }, viewer.id);
        await write(trx, id, 'MAT-020', { owner: viewer.name, fingerprint: print.structure.slice(0, 12) }, viewer.id);
        return 'published';
      });
    },

    async markSeen(id, viewer) {
      if (!UUID.test(id)) {
        return 0;
      }
      return db.transaction().execute(async (trx) => {
        const seen = await trx
          .updateTable('resourceChanges')
          .set({ seenAt: new Date(), seenBy: viewer.name })
          .where('resourceId', '=', id)
          .where('seenAt', 'is', null)
          .returning('id')
          .execute();
        if (seen.length > 0) {
          await write(trx, id, 'MAT-022', { actor: viewer.name, changes: String(seen.length) }, viewer.id);
        }
        return seen.length;
      });
    },

    async deprecate(id, reason, insteadOf, viewer) {
      if (!UUID.test(id) || (insteadOf !== null && !UUID.test(insteadOf))) {
        return UUID.test(id) ? 'invalid' : 'not_found';
      }
      return db.transaction().execute(async (trx): Promise<DeprecateOutcome> => {
        const row = await trx.selectFrom('resources').select(['publishedAt']).where('id', '=', id).forUpdate().executeTakeFirst();
        if (!row) {
          return 'not_found';
        }
        if (row.publishedAt === null) {
          return 'not_published';
        }
        if (insteadOf !== null) {
          const other = await trx.selectFrom('resources').select('id').where('id', '=', insteadOf).where('withdrawnAt', 'is', null).executeTakeFirst();
          if (!other || insteadOf === id) {
            return 'invalid';
          }
        }
        await trx.updateTable('resources').set({ deprecatedAt: new Date(), deprecatedBy: viewer.name, deprecationReason: reason, insteadOf, updatedAt: new Date() }).where('id', '=', id).execute();
        await write(trx, id, 'RES-007', { actor: viewer.name, reason }, viewer.id);
        return 'done';
      });
    },

    async undeprecate(id, viewer) {
      if (!UUID.test(id)) {
        return 'not_found';
      }
      return db.transaction().execute(async (trx): Promise<DeprecateOutcome> => {
        const row = await trx.selectFrom('resources').select(['deprecatedAt']).where('id', '=', id).forUpdate().executeTakeFirst();
        if (!row) {
          return 'not_found';
        }
        if (row.deprecatedAt === null) {
          return 'not_deprecated';
        }
        await trx.updateTable('resources').set({ deprecatedAt: null, deprecatedBy: null, deprecationReason: null, insteadOf: null, updatedAt: new Date() }).where('id', '=', id).execute();
        await write(trx, id, 'RES-008', { actor: viewer.name }, viewer.id);
        return 'done';
      });
    },
  };
}

/**
 * What a change of the details of a Resource changes (DEC-PL-03): how it is stored, its grain, model type and the fields
 * it asks for, the work of a Data Admin (`assigned`); and its mappings with the release of the Domain Model they were made with, its Entity
 * mapping (`mapped`). Each needs its own Permission; what is sent as it is changes nothing.
 */
export function whatDetailsChange(before: Details, after: Details): { assigned: boolean; mapped: boolean } {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const sorted = (origins: Origins) => Object.entries(origins).sort(([a], [b]) => a.localeCompare(b));
  // A partition filter is kept only with a partition (record).
  const filter = (details: Details) => (details.partition ? details.partitionFilter : 'none');
  const mappings = (details: Details) =>
    details.mappings
      .map(({ field, kind, relationType, identity, subject, origin, inDomainModel }) => ({ field, kind, relationType, identity, subject, origin, inDomainModel }))
      .sort((a, b) => a.field.localeCompare(b.field));
  const typeFields = (details: Details) => details.typeFields.map(({ field, role, origin }) => ({ field, role, origin })).sort((a, b) => a.field.localeCompare(b.field));
  return {
    assigned:
      !same(before.partition, after.partition) ||
      !same(before.clusterBy, after.clusterBy) ||
      filter(before) !== filter(after) ||
      !same(before.grain, after.grain) ||
      before.grainSentence !== after.grainSentence ||
      before.modelType !== after.modelType ||
      !same(typeFields(before), typeFields(after)) ||
      !same(sorted(before.origins), sorted(after.origins)),
    mapped: before.release !== after.release || !same(mappings(before), mappings(after)),
  };
}

/**
 * What the Data Admin recorded fits the Resource: every field it names is a field of it, a field maps
 * once, a relation starts from a field mapped as `is` (DEC-RC-08), and every role belongs to its model
 * type and fits the type of its field (FR-CO-44). A role recorded before, `kept`, may stay on a field
 * that left the Resource since, which shows as gone (DEC-RC-23). Returns the problem, if any.
 */
export function checkDetails(details: Details, fields: readonly FieldOfType[], kept: readonly TypeField[] = []): string | undefined {
  const known = new Set(fields.map((field) => field.name));
  const stays = (held: TypeField) => kept.some((before) => before.field === held.field && before.role === held.role);
  const named = [
    ...details.grain,
    ...details.clusterBy,
    ...(details.partition ? [details.partition.field] : []),
    ...details.mappings.flatMap((mapping) => [mapping.field, ...(mapping.subject ? [mapping.subject] : [])]),
    ...details.typeFields.filter((held) => !stays(held)).map((held) => held.field),
  ];
  const stranger = named.find((field) => !known.has(field));
  if (stranger !== undefined) {
    return `it has no field ${stranger}.`;
  }
  const misfit = invalidTypeFields(details.modelType, details.typeFields, fields);
  if (misfit !== undefined) {
    return misfit;
  }
  const mapped = details.mappings.map((mapping) => mapping.field);
  const twice = mapped.find((field, index) => mapped.indexOf(field) !== index);
  if (twice !== undefined) {
    return `the field ${twice} maps twice.`;
  }
  const subjects = new Set(details.mappings.filter((mapping) => mapping.kind === 'is').map((mapping) => mapping.field));
  const loose = details.mappings.find((mapping) => mapping.subject !== null && !subjects.has(mapping.subject));
  if (loose) {
    return `the relation of ${loose.field} starts from ${loose.subject}, which is not mapped as is.`;
  }
  return undefined;
}

/** What the model type of a Resource still misses, and each role whose field is gone, from its fields now (FR-CO-45, FR-RC-29). */
export function typeStateOf(type: ModelType | null, typeFields: readonly TypeField[], fields: readonly FieldOfType[], grainSentence: string): TypeState {
  return {
    missing: missingOfType(type, typeFields, fields, grainSentence),
    gone: goneOfType(typeFields, fields).map(({ field, role }) => ({ field, role })),
  };
}

/** What is missing, as a sentence that names it. */
export function missingSentence(type: ModelType | null, missing: readonly MissingOfType[]): string | undefined {
  if (missing.length === 0) {
    return undefined;
  }
  if (type === null || missing.some((one) => one.kind === 'modelType')) {
    return 'it has no model type yet.';
  }
  const parts = missing.map((one) =>
    one.kind === 'role' ? `a field as ${one.role}` : one.kind === 'unmarked' ? `the number ${one.field} marked as addsUp or uniqueCount` : 'the sentence of One row per',
  );
  const listed = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
  return `its model type ${type} still asks for ${listed}.`;
}

/**
 * Whether what was recorded gives the model type every field it asks for (FR-CO-44): a model type, each required role
 * held by a field the Resource has, every number of an aggregate marked, or the sentence of `other`. Returns what is
 * missing, as a sentence, if anything.
 */
export function incomplete(details: Details, fields: readonly FieldOfType[]): string | undefined {
  return missingSentence(details.modelType, missingOfType(details.modelType, details.typeFields, fields, details.grainSentence));
}

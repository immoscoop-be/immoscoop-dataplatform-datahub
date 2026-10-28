import type { CollectionIcon, CollectionVisibility } from '@datahub/contracts';
import type { SubjectKind } from '@datahub/contracts/messages';
import type { ColumnType, Generated } from 'kysely';
import type { LeftOutReason } from './fields.js';

/** The model types of a Resource, a fixed list (DEC-RC-10). */
export const MODEL_TYPES = ['event', 'state', 'fact', 'dimension', 'aggregate'] as const;
export type ModelType = (typeof MODEL_TYPES)[number];
export type PartitionUnit = 'hour' | 'day' | 'month' | 'year';
/** Who requires a filter on the partition column in every query: nobody, Data Hub, or BigQuery (DEC-SR-35). */
export type PartitionFilter = 'none' | 'dataHub' | 'bigQuery';
export type MappingKind = 'is' | 'relation' | 'performedBy';
export type MappingOrigin = 'domainModel' | 'name' | 'here';
/** Where a recorded fact came from, as the step that adds a Resource says it. */
export type Origin = 'dbt' | 'test' | 'domainModel' | 'here';
export type Origins = Partial<Record<'partition' | 'clusterBy' | 'partitionFilter' | 'grain' | 'grainSentence' | 'modelType', Origin>>;

/** A timestamp: read as a Date, written as a Date or left to the database. */
type Timestamp = ColumnType<Date, Date | undefined, Date>;

/** The tables of catalogue, in camelCase (the columns are snake_case in Postgres). */
/** A field as it was at a Confirmation. */
export interface ConfirmedField {
  name: string;
  dataType: string | null;
}

/** What happened to a field after the last Confirmation; a rename shows as removed and added. */
export type SchemaChange = 'added' | 'removed' | 'retyped';

export interface CatalogueDatabase {
  /** One row per Collection, also once dissolved (TR-CO-01). */
  collections: {
    id: Generated<string>;
    name: string;
    description: string;
    /** The name of an icon of Phosphor, required; a Collection has no colour (DEC-CO-23, DEC-CO-25). */
    icon: CollectionIcon;
    /** The Owner Unit by its fixed Google ID, with its address and name when it was chosen (TR-CO-03). */
    ownerUnitId: string;
    ownerUnitEmail: string;
    ownerUnitName: string;
    visibility: CollectionVisibility;
    /** The fixed Google ID of whoever created it, and their name at that moment. */
    createdBy: string;
    createdByName: string;
    createdAt: Timestamp;
    dissolvedAt: Date | null;
  };
  /** The Log of the Collections: append-only, with a Log ID from the Log catalogue (TR-CO-04). */
  collectionLog: {
    /** A bigint in Postgres, which pg reads as a string. */
    id: Generated<string>;
    collectionId: string;
    logId: string;
    params: ColumnType<Record<string, string>, Record<string, string>, never>;
    /** The fixed Google ID of the person, or null for Data Hub itself (FR-SR-11). */
    actorId: string | null;
    at: Timestamp;
  };
  /** One row per Resource, also once withdrawn (TR-SR-02). */
  resources: {
    id: Generated<string>;
    key: string;
    projectId: string;
    projectName: string | null;
    nodeId: string;
    name: string;
    resourceType: string;
    requestedName: string;
    displayName: string;
    description: string;
    exposures: string[];
    collectionId: string | null;
    /** From 0 · Beta to 5 · Monitored (FR-SR-07). */
    level: number;
    registeredAt: Timestamp;
    updatedAt: Timestamp;
    withdrawnAt: Date | null;
    /** What the Data Admin recorded when adding it (FR-CO-33, FR-CO-34). */
    grain: ColumnType<string[], string[] | undefined, string[]>;
    grainSentence: ColumnType<string, string | undefined, string>;
    modelType: ModelType | null;
    partitionField: string | null;
    partitionUnit: PartitionUnit | null;
    clusterBy: ColumnType<string[], string[] | undefined, string[]>;
    partitionFilter: ColumnType<PartitionFilter, PartitionFilter | undefined, PartitionFilter>;
    origins: ColumnType<Origins, Origins | undefined, Origins>;
    domainModelRelease: string | null;
    /** What the Owner and the Data Team keep about it in Data Hub (FR-RC-15). */
    businessDescription: ColumnType<string, string | undefined, string>;
    intendedUse: ColumnType<string, string | undefined, string>;
    pitfalls: ColumnType<string, string | undefined, string>;
    knownGaps: ColumnType<string[], string[] | undefined, string[]>;
    /** A day, as `YYYY-MM-DD`. */
    reliableSince: ColumnType<Date | null, string | null | undefined, string | null>;
    keyFields: ColumnType<string[], string[] | undefined, string[]>;
    parameters: ColumnType<string[], string[] | undefined, string[]>;
    /** Published, by name; the first Publication is the first Confirmation (DEC-SR-07). */
    publishedAt: Date | null;
    publishedBy: string | null;
    /** Deprecated, by name, why, and what to use instead (DEC-UX-101). */
    deprecatedAt: Date | null;
    deprecatedBy: string | null;
    deprecationReason: string | null;
    insteadOf: string | null;
  };
  /** Each Confirmation, with the Fingerprint and the fields of that moment (FR-MR-08). */
  resourceConfirmations: {
    id: Generated<string>;
    resourceId: string;
    ownerId: string;
    ownerName: string;
    structure: string;
    types: string;
    descriptions: string;
    code: string | null;
    fields: ColumnType<ConfirmedField[], string, string>;
    confirmedAt: Timestamp;
  };
  /** A field that changed after the last Confirmation: the warning, until it is seen (FR-MR-12). */
  resourceChanges: {
    id: Generated<string>;
    resourceId: string;
    field: string;
    change: SchemaChange;
    old: string | null;
    new: string | null;
    /** A bigint in Postgres, which pg reads as a string. */
    runId: ColumnType<string, string, string>;
    at: Timestamp;
    seenAt: Date | null;
    seenBy: string | null;
  };
  /** A description from dbt that changed: of the table when there is no field (FR-RC-17). */
  descriptionChanges: {
    id: Generated<string>;
    resourceId: string;
    field: string | null;
    before: string;
    after: string;
    runId: ColumnType<string, string, string>;
    at: Timestamp;
  };
  /** The Business Description of a field, by its name (FR-RC-16). */
  fieldDescriptions: {
    resourceId: string;
    field: string;
    text: string;
    updatedAt: Timestamp;
    /** The fixed Google ID of whoever wrote it last. */
    updatedBy: string;
  };
  /** The mapping of each field that has one (DEC-RC-05, DEC-RC-06, DEC-RC-14). */
  resourceMappings: {
    resourceId: string;
    field: string;
    kind: MappingKind;
    relationType: string | null;
    identity: string;
    subject: string | null;
    origin: MappingOrigin;
    inDomainModel: boolean;
    release: string | null;
  };
  /** The plain fields of a Resource, as dbt has them (FR-SR-06, DEC-SR-33). */
  resourceFields: {
    resourceId: string;
    name: string;
    position: number | null;
    dataType: string | null;
    description: string;
  };
  /** The columns of its table that are no field of a Resource (DEC-SR-33). */
  resourceLeftOut: {
    resourceId: string;
    name: string;
    dataType: string | null;
    reason: LeftOutReason;
  };
  /** The Fingerprints of the Resources (FR-SR-08). */
  resourceFingerprints: {
    id: Generated<string>;
    resourceId: string;
    runId: ColumnType<string, string, string>;
    structure: string;
    types: string;
    descriptions: string;
    code: string | null;
    takenAt: Timestamp;
  };
  /** The Log of the Resources: append-only, with a Log ID from the Log catalogue (TR-SR-03). */
  resourceLog: {
    id: Generated<string>;
    resourceId: string;
    logId: string;
    params: ColumnType<Record<string, string>, Record<string, string>, never>;
    actorId: string | null;
    at: Timestamp;
  };
  /** Per dbt project, the run of the last call of registry that was applied. */
  resourceSyncs: {
    projectId: string;
    /** A bigint in Postgres, which pg reads as a string. */
    runId: ColumnType<string, string, string>;
    syncedAt: Timestamp;
  };
  /** The Messages, each placed on its object (FR-CV-03). */
  messages: {
    id: Generated<string>;
    /** A Message ID of the Message Catalogue, such as `MSG-RES-01`. */
    type: string;
    subjectKind: SubjectKind;
    subjectId: string;
    /** The fixed Google ID of whoever wrote it, or null for Data Hub itself. */
    writerId: string | null;
    params: ColumnType<Record<string, string>, Record<string, string>, Record<string, string>>;
    state: string | null;
    createdAt: Timestamp;
    updatedAt: Timestamp;
  };
}

import type { CollectionColour, CollectionIcon, CollectionVisibility } from '@datahub/contracts';
import type { SubjectKind } from '@datahub/contracts/messages';
import type { ColumnType, Generated } from 'kysely';
import type { LeftOutReason } from './fields.js';

/** A timestamp: read as a Date, written as a Date or left to the database. */
type Timestamp = ColumnType<Date, Date | undefined, Date>;

/** The tables of catalogue, in camelCase (the columns are snake_case in Postgres). */
export interface CatalogueDatabase {
  /** One row per Collection, also once dissolved (TR-CO-01). */
  collections: {
    id: Generated<string>;
    name: string;
    description: string;
    colour: CollectionColour;
    /** The name of a Tabler icon from the chosen list, or none (DEC-CO-13). */
    icon: ColumnType<CollectionIcon | null, CollectionIcon | null | undefined, CollectionIcon | null>;
    /** The Owner Unit by its fixed Google ID, with its address and name when it was chosen (TR-CO-03). */
    ownerUnitId: string;
    ownerUnitEmail: string;
    ownerUnitName: string;
    visibility: CollectionVisibility;
    createdBy: string;
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

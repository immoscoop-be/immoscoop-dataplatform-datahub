import type { CollectionColour, CollectionVisibility } from '@datahub/contracts';
import type { ColumnType, Generated } from 'kysely';

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
}

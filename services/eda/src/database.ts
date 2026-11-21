import type { DataHubReading, EdaStatus, OwnerReading, ProbeKey, ProbeResult } from '@datahub/contracts/eda';
import type { ColumnType, Generated } from 'kysely';

/** A timestamp: read as a Date, written as a Date or left to the database. */
type Timestamp = ColumnType<Date, Date | undefined, Date>;

/** A JSON column: read as its value, written as JSON text. */
type Json<T> = ColumnType<T, string, string>;

/** The tables of eda, in camelCase (the columns are snake_case in Postgres) (TR-ED-01). */
export interface EdaDatabase {
  /** One row per EDA, at most one per Resource (DEC-ED-20, FR-ED-02). */
  edas: {
    id: Generated<string>;
    /** The Resource, by its ID in catalogue. */
    resourceId: string;
    status: Generated<EdaStatus>;
    /** Who started it, by the fixed Google ID, and their name then. */
    startedById: string;
    startedByName: string;
    startedAt: Timestamp;
    /** When it became Explored (FR-ED-12); null while it is in progress. */
    exploredAt: ColumnType<Date | null, Date | null | undefined, Date | null>;
    /** When catalogue heard that it is Explored (TR-ED-05); null until it did, so that it is told again. */
    toldAt: ColumnType<Date | null, Date | null | undefined, Date | null>;
    /** How many needed EDA-Probes it has, and how many are complete, as last computed: for the panel (FR-ED-03). */
    neededTotal: Generated<number>;
    neededComplete: Generated<number>;
  };
  /** The EDA-Probes added to an EDA, one per EDA and EDA-Probe, with what they are set on (DEC-ED-17). */
  edaProbes: {
    edaId: string;
    probe: ProbeKey;
    fields: Json<string[]>;
    params: Json<Record<string, unknown>>;
    addedById: string;
    addedByName: string;
    addedAt: Timestamp;
  };
  /** One row per run of an EDA-Probe (FR-ED-06). */
  edaRuns: {
    id: Generated<string>;
    edaId: string;
    probe: ProbeKey;
    fields: Json<string[]>;
    params: Json<Record<string, unknown>>;
    ranById: string;
    ranByName: string;
    ranAt: Timestamp;
    /** What it read; a bigint, which pg reads as a string. */
    bytes: ColumnType<string, number, number>;
    /** The ID of its run in the Query Log of query, such as q-20261121-4c2e1a. */
    queryRunId: string;
  };
  /** The result of a run per subject: the table as a whole ('') or a field (TR-ED-03). */
  edaResults: {
    runId: string;
    subject: string;
    /** Its place among the results of its run: the order of the Resource Card. */
    position: number;
    data: Json<ProbeResult>;
    reading: DataHubReading;
  };
  /** The reading of who works on the EDA, per EDA, EDA-Probe and subject (FR-ED-11). */
  edaReadings: {
    edaId: string;
    probe: ProbeKey;
    subject: string;
    reading: OwnerReading;
    byId: string;
    byName: string;
    at: Timestamp;
  };
}

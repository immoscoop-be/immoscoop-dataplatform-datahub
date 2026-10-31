import type { ColumnType, Generated } from 'kysely';

/** A timestamp: read as a Date, written as a Date or left to the database. */
type Timestamp = ColumnType<Date, Date | undefined, Date>;

/** A dbt Cloud ID: a bigint in Postgres, which pg reads as a string. */
type DbtId = ColumnType<string, string | number, string | number>;

/** The unit of the partitions of a table partitioned by time. */
export type PartitionUnit = 'hour' | 'day' | 'month' | 'year';

/** Where an Artifact Set stands (TR-AR-01 to TR-AR-04). */
export type SetStatus = 'pending' | 'processing' | 'processed' | 'failed';

/** What Data Hub did with a delivery of the webhook (FR-AR-19). */
export type DeliveryOutcome = 'recorded' | 'ignored' | 'refused';
/** Why a delivery was ignored or refused. */
export type DeliveryReason = 'notARun' | 'otherAccount' | 'notSucceeded' | 'notSourceJob' | 'otherProject' | 'signature';

/** The tables of registry, in camelCase (the columns are snake_case in Postgres). */
export interface RegistryDatabase {
  /** The Source Job a Data Admin set per dbt project, in place of the configuration (FR-AR-18). */
  sourceJobs: {
    projectId: DbtId;
    jobId: DbtId;
    jobName: string;
    setBy: string;
    setByName: string;
    setAt: Timestamp;
  };
  /** Every delivery of the webhook of the last 30 days, and what Data Hub did with it (FR-AR-19). */
  deliveries: {
    id: Generated<string>;
    receivedAt: Timestamp;
    outcome: DeliveryOutcome;
    reason: DeliveryReason | null;
    eventType: string | null;
    webhookName: string | null;
    accountId: string | null;
    projectId: string | null;
    jobId: string | null;
    jobName: string | null;
    environmentName: string | null;
    runId: string | null;
    runStatus: string | null;
    runStartedAt: string | null;
    runFinishedAt: string | null;
  };
  artifactSets: {
    id: Generated<number>;
    projectId: DbtId;
    jobId: DbtId;
    runId: DbtId;
    status: ColumnType<SetStatus, SetStatus | undefined, SetStatus>;
    error: string | null;
    dbtVersion: string | null;
    generatedAt: Date | null;
    receivedAt: Timestamp;
    claimedAt: Date | null;
    processedAt: Date | null;
  };
  projects: {
    projectId: DbtId;
    name: string | null;
    currentSetId: number | null;
    previousSetId: number | null;
  };
  nodes: {
    setId: number;
    uniqueId: string;
    resourceType: string;
    name: string;
    packageName: string;
    databaseName: string | null;
    schemaName: string | null;
    tableName: string | null;
    relation: string | null;
    description: string;
    materialized: string | null;
    tags: ColumnType<string[], string[], string[]>;
    filePath: string | null;
    checksum: string | null;
    meta: ColumnType<Record<string, unknown>, Record<string, unknown> | undefined, Record<string, unknown>>;
    entity: string | null;
    action: string | null;
    strategy: string | null;
    layer: string | null;
    /** How its table is stored in BigQuery, from its dbt config (FR-CO-34). */
    partitionField: string | null;
    partitionUnit: PartitionUnit | null;
    clusterBy: ColumnType<string[], string[] | undefined, string[]>;
    requirePartitionFilter: ColumnType<boolean, boolean | undefined, boolean>;
  };
  columns: {
    setId: number;
    nodeId: string;
    name: string;
    position: number | null;
    dataType: string | null;
    description: string;
    meta: ColumnType<Record<string, unknown>, Record<string, unknown> | undefined, Record<string, unknown>>;
  };
  edges: {
    setId: number;
    parentId: string;
    childId: string;
  };
  tests: {
    setId: number;
    uniqueId: string;
    name: string;
    nodeId: string;
    columnName: string | null;
    severity: string | null;
    targetNodeId: string | null;
    targetColumn: string | null;
  };
}

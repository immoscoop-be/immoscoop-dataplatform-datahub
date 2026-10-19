import type { ColumnType, Generated } from 'kysely';

/** A timestamp: read as a Date, written as a Date or left to the database. */
type Timestamp = ColumnType<Date, Date | undefined, Date>;

/** A dbt Cloud ID: a bigint in Postgres, which pg reads as a string. */
type DbtId = ColumnType<string, string | number, string | number>;

/** Where an Artifact Set stands (TR-AR-01 to TR-AR-04). */
export type SetStatus = 'pending' | 'processing' | 'processed' | 'failed';

/** The tables of registry, in camelCase (the columns are snake_case in Postgres). */
export interface RegistryDatabase {
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
  };
  columns: {
    setId: number;
    nodeId: string;
    name: string;
    position: number | null;
    dataType: string | null;
    description: string;
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

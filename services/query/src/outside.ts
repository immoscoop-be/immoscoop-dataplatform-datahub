import type { TableInfo } from './bigquery.js';
import type { KnownTable } from './registry.js';

/** A column of a table outside Data Hub, as a power user reads it (FR-SR-62). */
export interface OutsideColumn {
  /** Its name; a field of a STRUCT as `parent.child`, right after its parent. */
  name: string;
  type: string | null;
  description: string;
  /** Where its description comes from: dbt, or BigQuery where dbt has none; null without one. */
  from: 'dbt' | 'bigquery' | null;
  partition: boolean;
  /** Its place among the cluster columns, from 1; null when it is none. */
  cluster: number | null;
}

/** What Data Hub knows of a table outside it, for a power user who double-clicks its name in the SQL (FR-SR-62, DEC-UX-247). */
export interface OutsideTableView {
  key: string;
  fullName: string;
  name: string;
  layer: string;
  resourceType: string;
  projectName: string | null;
  /** How dbt makes it: `table`, `view`, `incremental` and so on; null for a source. */
  materialized: string | null;
  /** Its description from dbt, or from BigQuery where dbt has none. */
  description: string;
  /** What BigQuery says of it now; null when BigQuery did not answer, and what dbt knew stands instead. */
  bigquery: { type: string; bytes: number | null; rows: number | null; partitions: number | null; modifiedAt: string | null } | null;
  /** `required` only when BigQuery says so: dbt does not tell. */
  partition: { field: string; unit: string | null; required: boolean } | null;
  clusterBy: string[];
  columns: OutsideColumn[];
}

/**
 * dbt and BigQuery together, each for what it knows best (OP-UX-89): the description, layer and project from dbt; the
 * kind, partitioning, cluster columns, size and the type of each column from BigQuery; the description of a column from
 * dbt, or from BigQuery where dbt has none. Without BigQuery, what dbt knew at its last run. The partition column comes
 * first, then the cluster columns in their order, then the others in the order of the table, each STRUCT with its fields.
 */
export function outsideTable(table: KnownTable, live: TableInfo | null): OutsideTableView {
  const fromDbt = new Map((table.columns ?? []).map((column) => [column.name.toLowerCase(), column]));
  const partition = live ? live.partition : table.partition ? { ...table.partition, required: false } : null;
  const clusterBy = live ? live.clusterBy : (table.clusterBy ?? []);
  const listed = live ? live.columns.map((column) => ({ name: column.name, type: column.type, bigquery: column.description })) : (table.columns ?? []).map((column) => ({ name: column.name, type: column.dataType, bigquery: '' }));
  const lower = (name: string) => name.toLowerCase();
  const columns: OutsideColumn[] = listed.map((column) => {
    const dbt = fromDbt.get(lower(column.name))?.description ?? '';
    const at = clusterBy.findIndex((name) => lower(name) === lower(column.name));
    return {
      name: column.name,
      type: column.type,
      description: dbt || column.bigquery,
      from: dbt ? 'dbt' : column.bigquery ? 'bigquery' : null,
      partition: !!partition && lower(partition.field) === lower(column.name),
      cluster: at >= 0 ? at + 1 : null,
    };
  });
  // Each column of the top level with the fields under it, kept together as they are ordered.
  const groups: OutsideColumn[][] = [];
  for (const column of columns) {
    const last = groups.at(-1);
    if (last && column.name.toLowerCase().startsWith(`${last[0]!.name.toLowerCase()}.`)) last.push(column);
    else groups.push([column]);
  }
  const rank = (group: OutsideColumn[]) => (group[0]!.partition ? 0 : group[0]!.cluster !== null ? group[0]!.cluster : Number.POSITIVE_INFINITY);
  const ordered = groups.map((group, index) => ({ group, index })).sort((a, b) => rank(a.group) - rank(b.group) || a.index - b.index);
  return {
    key: table.key,
    fullName: table.fullName,
    name: table.name,
    layer: table.layer,
    resourceType: table.resourceType,
    projectName: table.projectName,
    materialized: table.materialized ?? null,
    description: table.description || live?.description || '',
    bigquery: live ? { type: live.type, bytes: live.bytes, rows: live.rows, partitions: live.partitions, modifiedAt: live.modifiedAt } : null,
    partition,
    clusterBy,
    columns: ordered.flatMap(({ group }) => group),
  };
}

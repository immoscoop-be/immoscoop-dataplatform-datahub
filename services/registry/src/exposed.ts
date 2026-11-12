import type { NodeRow, NormalisedSet } from './normalise.js';

/** The tag with which an exposure makes the tables it depends on Resources of Data Hub (DEC-SR-22). */
export const DATAHUB_TAG = 'datahub';

/** A column of an exposed table, as the catalog has it, with its description from the manifest. */
export interface ExposedColumn {
  name: string;
  position: number | null;
  dataType: string | null;
  description: string;
}

/**
 * How an exposed table is stored, as dbt says (DEC-SR-34): of its own model, or, for a view, of the nearest model
 * beneath it that is partitioned or clustered, and only the columns the table passes through by name, as the
 * proposal of the step that adds it to a Collection has it. Until a Data Admin records its details, catalogue keeps
 * these, so that a Preview filters on its partition column from the start.
 */
export interface ExposedStorage {
  partition: { field: string; unit: NodeRow['partitionUnit'] } | null;
  clusterBy: string[];
  requirePartitionFilter: boolean;
}

/** How far up the lineage to look for the model beneath a view, as the proposal does. */
const DEPTH = 10;

/** A table that an exposure with the tag `datahub` depends on: a Resource to be (TR-AR-08). */
export interface ExposedTable {
  /** The Key of the Resource: `database.schema.table` in lowercase, as `relation` (DEC-SR-04). */
  key: string;
  /** The same full name in its own case, as BigQuery knows it: BigQuery names are case-sensitive. */
  fullName: string;
  nodeId: string;
  name: string;
  resourceType: string;
  description: string;
  /** The names of the exposures with the tag that depend on it, sorted. */
  exposures: string[];
  /** The label of an exposure with the tag that depends on this table alone, if it has one (DEC-SR-24). */
  label: string | null;
  /** The checksum of its code in the manifest, for the Fingerprint (FR-SR-08); a source has none. */
  checksum: string | null;
  /** Its columns, in the order of the table (FR-SR-06). */
  columns: ExposedColumn[];
  /** How it is stored, as dbt says; null when neither it nor a model beneath it is partitioned or clustered. */
  storage: ExposedStorage | null;
}

/**
 * The tables under the exposures tagged `datahub` of one Artifact Set, once each, by Key. Only a Node
 * with a `relation` is a table: an ephemeral model or a metric is not (DEC-SR-23). Also tells which
 * of those exposures depend on no table at all, so that processing can say so.
 */
export function exposedTables(set: NormalisedSet): { tables: ExposedTable[]; empty: string[] } {
  const nodes = new Map(set.nodes.map((node) => [node.uniqueId, node]));
  const columnsOf = new Map<string, ExposedColumn[]>();
  for (const { nodeId, name, position, dataType, description } of set.columns) {
    (columnsOf.get(nodeId) ?? columnsOf.set(nodeId, []).get(nodeId)!).push({ name, position, dataType, description });
  }
  const exposures = set.nodes.filter((node) => node.resourceType === 'exposure' && node.tags.includes(DATAHUB_TAG));
  const tablesOf = new Map<string, string[]>(exposures.map((exposure) => [exposure.uniqueId, []]));
  const parentsOf = new Map<string, string[]>();
  for (const edge of set.edges) {
    const parent = nodes.get(edge.parentId);
    if (parent?.relation) {
      tablesOf.get(edge.childId)?.push(parent.uniqueId);
    }
    (parentsOf.get(edge.childId) ?? parentsOf.set(edge.childId, []).get(edge.childId)!).push(edge.parentId);
  }

  /** The nearest Node up the lineage, the Node itself first, that is partitioned or clustered. */
  const stored = (start: NodeRow): NodeRow | undefined => {
    const fits = (node: NodeRow) => node.partitionField !== null || node.clusterBy.length > 0;
    if (fits(start)) return start;
    const seen = new Set([start.uniqueId]);
    let level = [start.uniqueId];
    for (let depth = 0; depth < DEPTH && level.length > 0; depth++) {
      const next: string[] = [];
      for (const id of level) {
        for (const parentId of parentsOf.get(id) ?? []) {
          if (seen.has(parentId)) continue;
          seen.add(parentId);
          next.push(parentId);
        }
      }
      const found = next
        .map((id) => nodes.get(id))
        .find((node): node is NodeRow => node !== undefined && ['model', 'seed', 'snapshot'].includes(node.resourceType) && fits(node));
      if (found) return found;
      level = next;
    }
    return undefined;
  };

  const storageOf = (node: NodeRow, columns: ExposedColumn[]): ExposedStorage | null => {
    const beneath = stored(node);
    if (!beneath) return null;
    const names = new Map(columns.map((column) => [column.name.toLowerCase(), column.name]));
    const own = (name: string | null) => (name ? names.get(name.toLowerCase()) : undefined);
    const field = own(beneath.partitionField);
    const clusterBy = beneath.clusterBy.flatMap((name) => own(name) ?? []);
    if (!field && clusterBy.length === 0) return null;
    return {
      partition: field ? { field, unit: beneath.partitionUnit } : null,
      clusterBy,
      requirePartitionFilter: Boolean(field && beneath.requirePartitionFilter),
    };
  };

  const tables = new Map<string, ExposedTable>();
  const empty: string[] = [];
  for (const exposure of [...exposures].sort((a, b) => a.name.localeCompare(b.name))) {
    const parents = tablesOf.get(exposure.uniqueId) ?? [];
    if (parents.length === 0) {
      empty.push(exposure.name);
    }
    for (const parentId of parents) {
      const node = nodes.get(parentId);
      if (!node?.relation) {
        continue;
      }
      const columns = (columnsOf.get(node.uniqueId) ?? []).toSorted((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || a.name.localeCompare(b.name));
      const table =
        tables.get(node.relation) ??
        tables
          .set(node.relation, {
            key: node.relation,
            fullName: fullNameOf(node),
            nodeId: node.uniqueId,
            name: node.name,
            resourceType: node.resourceType,
            description: node.description,
            exposures: [],
            label: null,
            checksum: node.checksum,
            columns,
            storage: storageOf(node, columns),
          })
          .get(node.relation)!;
      table.exposures.push(exposure.name);
      // The first exposure by name that depends on this table alone names it.
      const label = set.labels[exposure.uniqueId];
      if (parents.length === 1 && label && table.label === null) {
        table.label = label;
      }
    }
  }
  return { tables: [...tables.values()].sort((a, b) => a.key.localeCompare(b.key)), empty };
}

/** `database.schema.table` as dbt names them, without quotes: the Key in its own case. */
function fullNameOf(node: NormalisedSet['nodes'][number]): string {
  const parts = [node.databaseName, node.schemaName, node.tableName];
  return parts.every((part) => part) ? parts.map((part) => (part as string).replace(/[`"]/g, '')).join('.') : (node.relation as string);
}

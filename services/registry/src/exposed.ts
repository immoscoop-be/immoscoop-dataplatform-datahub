import type { NormalisedSet } from './normalise.js';

/** The tag with which an exposure makes the tables it depends on Resources of Data Hub (DEC-SR-22). */
export const DATAHUB_TAG = 'datahub';

/** A table that an exposure with the tag `datahub` depends on: a Resource to be (TR-AR-08). */
export interface ExposedTable {
  /** The Key of the Resource: `database.schema.table` in lowercase, as `relation` (DEC-SR-04). */
  key: string;
  nodeId: string;
  name: string;
  resourceType: string;
  description: string;
  /** The names of the exposures with the tag that depend on it, sorted. */
  exposures: string[];
  /** The label of an exposure with the tag that depends on this table alone, if it has one (DEC-SR-24). */
  label: string | null;
}

/**
 * The tables under the exposures tagged `datahub` of one Artifact Set, once each, by Key. Only a Node
 * with a `relation` is a table: an ephemeral model or a metric is not (DEC-SR-23). Also tells which
 * of those exposures depend on no table at all, so that processing can say so.
 */
export function exposedTables(set: NormalisedSet): { tables: ExposedTable[]; empty: string[] } {
  const nodes = new Map(set.nodes.map((node) => [node.uniqueId, node]));
  const exposures = set.nodes.filter((node) => node.resourceType === 'exposure' && node.tags.includes(DATAHUB_TAG));
  const tablesOf = new Map<string, string[]>(exposures.map((exposure) => [exposure.uniqueId, []]));
  for (const edge of set.edges) {
    const parent = nodes.get(edge.parentId);
    if (parent?.relation) {
      tablesOf.get(edge.childId)?.push(parent.uniqueId);
    }
  }

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
      const table =
        tables.get(node.relation) ??
        tables
          .set(node.relation, { key: node.relation, nodeId: node.uniqueId, name: node.name, resourceType: node.resourceType, description: node.description, exposures: [], label: null })
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

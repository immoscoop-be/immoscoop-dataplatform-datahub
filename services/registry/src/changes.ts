import { type Kysely, sql } from 'kysely';
import type { RegistryDatabase } from './database.js';
import { DATAHUB_TAG } from './exposed.js';

/** The kinds of Change between two versions of a Node (FR-AR-11, Kinds of Change), and a model that appears or goes. */
export type ChangeKind = 'description' | 'logic' | 'type' | 'structural' | 'added' | 'removed';

/** A Change of one Node between the previous Current Version of its dbt project and the new one (FR-AR-11). */
export interface NodeChange {
  kind: ChangeKind;
  /** The unique ID and the name of the Node that changed. */
  nodeId: string;
  node: string;
  /** The field it is about, for a change of type or structure. */
  field?: string;
  /** For a change of structure: whether the field came or went. */
  direction?: 'added' | 'removed';
  /** For a change of type: the type before and after. */
  old?: string | null;
  new?: string | null;
}

/** A Change and the Resources it reaches downstream, each with how many steps away it is (FR-AR-12). */
export interface UpstreamChange extends Omit<NodeChange, 'nodeId'> {
  /** The Node of a Resource's table, and how far downstream it is; 0 only for a change of logic of its own code. */
  reaches: { nodeId: string; distance: number }[];
}

interface NodeLike {
  uniqueId: string;
  resourceType: string;
  name: string;
  description: string;
  checksum: string | null;
}
interface ColumnLike {
  nodeId: string;
  name: string;
  dataType: string | null;
  description: string;
}
export interface Version {
  nodes: readonly NodeLike[];
  columns: readonly ColumnLike[];
}

/** What can change: the Nodes that are data, not the exposures, tests or metrics around them. */
const DATA = new Set(['model', 'seed', 'snapshot', 'source']);
/** However deep the lineage goes, a walk stops here, as a cycle never ends. */
const DEEPEST = 100;

/**
 * Every Change between two versions of a dbt project, Node by Node (FR-AR-11): a description of the table
 * or of a field, the code (its checksum), the type of a field, a field added or removed, and a Node that
 * appears or goes. A field renamed is one removed and one added. Sorted by Node, then field, so that the
 * same versions always give the same list.
 */
export function compare(before: Version, after: Version): NodeChange[] {
  const columnsOf = (version: Version) => {
    const byNode = new Map<string, Map<string, ColumnLike>>();
    for (const column of version.columns) {
      (byNode.get(column.nodeId) ?? byNode.set(column.nodeId, new Map()).get(column.nodeId)!).set(column.name, column);
    }
    return byNode;
  };
  const was = new Map(before.nodes.filter((node) => DATA.has(node.resourceType)).map((node) => [node.uniqueId, node]));
  const now = new Map(after.nodes.filter((node) => DATA.has(node.resourceType)).map((node) => [node.uniqueId, node]));
  const wasColumns = columnsOf(before);
  const nowColumns = columnsOf(after);
  const changes: NodeChange[] = [];
  for (const [id, node] of now) {
    const earlier = was.get(id);
    if (!earlier) {
      changes.push({ kind: 'added', nodeId: id, node: node.name });
      continue;
    }
    const of = { nodeId: id, node: node.name };
    if (earlier.checksum !== null && node.checksum !== null && earlier.checksum !== node.checksum) {
      changes.push({ kind: 'logic', ...of });
    }
    const old = wasColumns.get(id) ?? new Map<string, ColumnLike>();
    const fresh = nowColumns.get(id) ?? new Map<string, ColumnLike>();
    let described = earlier.description !== node.description;
    for (const [name, column] of fresh) {
      const prior = old.get(name);
      if (!prior) {
        changes.push({ kind: 'structural', ...of, field: name, direction: 'added' });
      } else {
        if ((prior.dataType ?? '') !== (column.dataType ?? '')) changes.push({ kind: 'type', ...of, field: name, old: prior.dataType, new: column.dataType });
        if (prior.description !== column.description) described = true;
      }
    }
    for (const name of old.keys()) {
      if (!fresh.has(name)) changes.push({ kind: 'structural', ...of, field: name, direction: 'removed' });
    }
    if (described) changes.push({ kind: 'description', ...of });
  }
  for (const [id, node] of was) {
    if (!now.has(id)) changes.push({ kind: 'removed', nodeId: id, node: node.name });
  }
  const order: ChangeKind[] = ['removed', 'added', 'logic', 'structural', 'type', 'description'];
  return changes.sort((a, b) => a.nodeId.localeCompare(b.nodeId) || order.indexOf(a.kind) - order.indexOf(b.kind) || (a.field ?? '').localeCompare(b.field ?? ''));
}

/**
 * Follows Changes downstream through the lineage, across both dbt projects, however deep (FR-AR-12), to the
 * Nodes that are tables of Resources: those an exposure tagged `datahub` depends on. A Node that went is
 * followed from where it fed in the previous version (EC-AR-04). Each Resource is reached once per Change,
 * at its shortest distance. The Changes of a Resource's own table are Data Hub's to log at distance 0
 * already, as it reads its fields; only a change of its own code is passed on at distance 0.
 */
export function propagate(
  changes: readonly NodeChange[],
  children: ReadonlyMap<string, readonly string[]>,
  formerChildren: ReadonlyMap<string, readonly string[]>,
  tables: ReadonlySet<string>,
): UpstreamChange[] {
  const reached = new Map<string, Map<string, number>>();
  const walk = (start: string, removed: boolean) => {
    const known = reached.get(start);
    if (known) return known;
    const distances = new Map<string, number>([[start, 0]]);
    let frontier: (readonly [string, number])[] = removed ? [...(formerChildren.get(start) ?? [])].map((id) => [id, 1] as const) : [[start, 0]];
    for (const [id, distance] of frontier) if (!distances.has(id) || distances.get(id)! > distance) distances.set(id, distance);
    for (let step = 0; frontier.length > 0 && step < DEEPEST; step++) {
      const next: (readonly [string, number])[] = [];
      for (const [id, distance] of frontier) {
        for (const child of children.get(id) ?? []) {
          if (!distances.has(child)) {
            distances.set(child, distance + 1);
            next.push([child, distance + 1]);
          }
        }
      }
      frontier = next;
    }
    if (removed) distances.delete(start);
    reached.set(start, distances);
    return distances;
  };
  return changes.flatMap((change) => {
    const distances = walk(change.nodeId, change.kind === 'removed');
    const reaches = [...distances]
      .filter(([id, distance]) => tables.has(id) && (distance > 0 || change.kind === 'logic'))
      .map(([nodeId, distance]) => ({ nodeId, distance }))
      .sort((a, b) => a.distance - b.distance || a.nodeId.localeCompare(b.nodeId));
    if (reaches.length === 0) return [];
    const { nodeId: _nodeId, ...rest } = change;
    return [{ ...rest, reaches }];
  });
}

/** The Changes of a new Current Version and the Resources they reach, from what registry keeps. */
export function createChanges(db: Kysely<RegistryDatabase>) {
  /** The links of the Current Versions, also across the projects: a source is fed by the model that builds its table. */
  async function currentChildren(): Promise<Map<string, string[]>> {
    const { rows } = await sql<{ parentId: string; childId: string }>`
      with current_sets as (select current_set_id as set_id from projects where current_set_id is not null)
      select e.parent_id, e.child_id
      from edges e
      where e.set_id in (select set_id from current_sets)
      union
      select builder.unique_id, source.unique_id
      from nodes source
      join nodes builder on builder.relation = source.relation and builder.set_id <> source.set_id
      where source.resource_type = 'source'
        and builder.resource_type in ('model', 'seed', 'snapshot')
        and source.set_id in (select set_id from current_sets)
        and builder.set_id in (select set_id from current_sets)`.execute(db);
    return childrenOf(rows);
  }

  /** The tables that exposures tagged `datahub` depend on, in every Current Version: the tables of Resources. */
  async function resourceTables(): Promise<Set<string>> {
    const { rows } = await sql<{ nodeId: string }>`
      with current_sets as (select current_set_id as set_id from projects where current_set_id is not null)
      select distinct p.unique_id as node_id
      from edges e
      join nodes x on x.set_id = e.set_id and x.unique_id = e.child_id
      join nodes p on p.set_id = e.set_id and p.unique_id = e.parent_id
      where e.set_id in (select set_id from current_sets)
        and x.resource_type = 'exposure' and ${DATAHUB_TAG} = any(x.tags)
        and p.relation is not null`.execute(db);
    return new Set(rows.map((row) => row.nodeId));
  }

  return {
    /** What changed between the previous Current Version and the new one, and the Resources it reaches. */
    async since(previousSetId: number, currentSetId: number): Promise<UpstreamChange[]> {
      const versionOf = async (setId: number): Promise<Version> => ({
        nodes: await db.selectFrom('nodes').select(['uniqueId', 'resourceType', 'name', 'description', 'checksum']).where('setId', '=', setId).execute(),
        columns: await db.selectFrom('columns').select(['nodeId', 'name', 'dataType', 'description']).where('setId', '=', setId).execute(),
      });
      const changes = compare(await versionOf(previousSetId), await versionOf(currentSetId));
      if (changes.length === 0) return [];
      const former = await db.selectFrom('edges').select(['parentId', 'childId']).where('setId', '=', previousSetId).execute();
      return propagate(changes, await currentChildren(), childrenOf(former), await resourceTables());
    },
  };
}

export type Changes = ReturnType<typeof createChanges>;

function childrenOf(rows: readonly { parentId: string; childId: string }[]): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const { parentId, childId } of rows) {
    (children.get(parentId) ?? children.set(parentId, []).get(parentId)!).push(childId);
  }
  return children;
}

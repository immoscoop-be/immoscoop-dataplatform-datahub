import { type Kysely, sql } from 'kysely';
import type { RegistryDatabase, SetStatus } from './database.js';

/** A Node in a list: enough to recognise it and find its table. */
export interface NodeSummary {
  uniqueId: string;
  name: string;
  resourceType: string;
  projectId: string;
  projectName: string | null;
  description: string;
  relation: string | null;
}

export interface SearchHit extends NodeSummary {
  /** Up to five columns whose name or description matches. */
  matchedColumns: string[];
}

export interface NodeDetail extends NodeSummary {
  packageName: string;
  databaseName: string | null;
  schemaName: string | null;
  tableName: string | null;
  materialized: string | null;
  tags: string[];
  filePath: string | null;
  columns: { name: string; position: number | null; dataType: string | null; description: string }[];
  tests: { name: string; columnName: string | null; severity: string | null; targetNodeId: string | null; targetColumn: string | null }[];
}

export type Direction = 'upstream' | 'downstream';

export interface Lineage {
  direction: Direction;
  /** The Nodes reached, with how many steps away they are; the Node itself at 0. */
  nodes: (NodeSummary & { distance: number })[];
  /** The links between the Nodes reached, also those across the two dbt projects. */
  edges: { parentId: string; childId: string }[];
  /** True when more Nodes are reachable than were returned. */
  truncated: boolean;
}

export interface ProjectSummary {
  projectId: string;
  name: string | null;
  runId: string | null;
  dbtVersion: string | null;
  generatedAt: Date | null;
  processedAt: Date | null;
  nodeCount: number;
}

export interface RunSummary {
  projectId: string;
  jobId: string;
  runId: string;
  status: SetStatus;
  error: string | null;
  current: boolean;
  receivedAt: Date;
  processedAt: Date | null;
}

/** At most this many Nodes in a lineage, the nearest first. */
const LINEAGE_LIMIT = 500;

/**
 * What registry tells about the dbt projects (TR-AR-05, TR-AR-06): always about the Current
 * Version of each project, never about a set that is still being processed.
 */
export function createReading(db: Kysely<RegistryDatabase>) {
  const summary = sql`n.unique_id, n.name, n.resource_type, p.project_id, p.name as project_name, n.description, n.relation`;

  /**
   * Every link of the Current Versions: the Edges within each project, and a source linked to the
   * model of the other project that builds the same table (DEC-AR-03).
   */
  const links = sql`
    current_sets as (select current_set_id as set_id from projects where current_set_id is not null),
    links as (
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
        and builder.set_id in (select set_id from current_sets)
    )`;

  async function summaries(ids: string[]): Promise<NodeSummary[]> {
    if (ids.length === 0) {
      return [];
    }
    const result = await sql<NodeSummary>`
      select ${summary}
      from nodes n join projects p on p.current_set_id = n.set_id
      where n.unique_id = any(${ids})`.execute(db);
    return result.rows;
  }

  return {
    /** Each dbt project with its Current Version. */
    async projects(): Promise<ProjectSummary[]> {
      const result = await sql<ProjectSummary & { nodeCount: string }>`
        select p.project_id, p.name, s.run_id, s.dbt_version, s.generated_at, s.processed_at,
          (select count(*) from nodes n where n.set_id = p.current_set_id) as node_count
        from projects p left join artifact_sets s on s.id = p.current_set_id
        order by p.project_id`.execute(db);
      return result.rows.map((row) => ({ ...row, nodeCount: Number(row.nodeCount) }));
    },

    /** The latest runs dbt Cloud reported, with where each one stands. */
    async runs(limit: number): Promise<RunSummary[]> {
      const result = await sql<RunSummary>`
        select s.project_id, s.job_id, s.run_id, s.status, s.error, s.received_at, s.processed_at,
          exists (select 1 from projects p where p.current_set_id = s.id) as current
        from artifact_sets s
        order by s.run_id desc
        limit ${limit}`.execute(db);
      return result.rows;
    },

    /**
     * Searches the Nodes by name, also with a typo or half a name, and by free text in their
     * descriptions and columns (FR-AR-10). An exact name comes first, then names that start with
     * the words, then the closest.
     */
    async search(query: string, options: { type?: string; limit: number }): Promise<SearchHit[]> {
      const words = sql`websearch_to_tsquery('simple', ${query})`;
      const escaped = query.replace(/[\\%_]/g, (character) => `\\${character}`);
      const pattern = `%${escaped}%`;
      const result = await sql<SearchHit>`
        select ${summary},
          array(
            select c.name from columns c
            where c.set_id = n.set_id and c.node_id = n.unique_id and (c.search @@ ${words} or c.name ilike ${pattern})
            order by c.position limit 5
          ) as matched_columns
        from nodes n join projects p on p.current_set_id = n.set_id
        where (${options.type ?? null}::text is null or n.resource_type = ${options.type ?? null})
          and (
            n.name ilike ${pattern}
            or n.name % ${query}
            or ${query} <% n.name
            or n.search @@ ${words}
            or exists (
              select 1 from columns c
              where c.set_id = n.set_id and c.node_id = n.unique_id and (c.search @@ ${words} or c.name ilike ${pattern})
            )
          )
        order by
          lower(n.name) = lower(${query}) desc,
          n.name ilike ${`${escaped}%`} desc,
          greatest(similarity(n.name, ${query}), word_similarity(${query}, n.name)) desc,
          ts_rank(n.search, ${words}) desc,
          n.name
        limit ${options.limit}`.execute(db);
      return result.rows;
    },

    /** One Node of a Current Version, with its columns and tests. */
    async node(uniqueId: string): Promise<NodeDetail | undefined> {
      const found = await db
        .selectFrom('nodes as n')
        .innerJoin('projects as p', 'p.currentSetId', 'n.setId')
        .select([
          'n.setId',
          'n.uniqueId',
          'n.name',
          'n.resourceType',
          'p.projectId',
          'p.name as projectName',
          'n.description',
          'n.relation',
          'n.packageName',
          'n.databaseName',
          'n.schemaName',
          'n.tableName',
          'n.materialized',
          'n.tags',
          'n.filePath',
        ])
        .where('n.uniqueId', '=', uniqueId)
        .executeTakeFirst();
      if (!found) {
        return undefined;
      }
      const { setId, ...node } = found;
      const columns = await db
        .selectFrom('columns')
        .select(['name', 'position', 'dataType', 'description'])
        .where('setId', '=', setId)
        .where('nodeId', '=', uniqueId)
        .orderBy(sql`position nulls last`)
        .orderBy('name')
        .execute();
      const tests = await db
        .selectFrom('tests')
        .select(['name', 'columnName', 'severity', 'targetNodeId', 'targetColumn'])
        .where('setId', '=', setId)
        .where('nodeId', '=', uniqueId)
        .orderBy('columnName')
        .orderBy('name')
        .execute();
      return { ...node, columns, tests };
    },

    /**
     * Follows the lineage of a Node up- or downstream, across both dbt projects (FR-AR-08, FR-AR-10),
     * up to `depth` steps. Undefined when the Node is not in a Current Version.
     */
    async lineage(uniqueId: string, direction: Direction, depth: number): Promise<Lineage | undefined> {
      const [start] = await summaries([uniqueId]);
      if (!start) {
        return undefined;
      }
      const [from, to] = direction === 'downstream' ? ['parent_id', 'child_id'] : ['child_id', 'parent_id'];
      const walked = await sql<{ nodeId: string; distance: number }>`
        with recursive ${links},
        walk(node_id, distance) as (
          select ${uniqueId}::text, 0
          union
          select l.${sql.raw(to)}, w.distance + 1
          from walk w join links l on l.${sql.raw(from)} = w.node_id
          where w.distance < ${depth}
        )
        select node_id, min(distance)::int as distance
        from walk group by node_id
        order by distance, node_id
        limit ${LINEAGE_LIMIT + 1}`.execute(db);

      const reached = walked.rows.slice(0, LINEAGE_LIMIT);
      const ids = reached.map((row) => row.nodeId);
      const byId = new Map((await summaries(ids)).map((node) => [node.uniqueId, node]));
      const edges = await sql<{ parentId: string; childId: string }>`
        with ${links}
        select parent_id, child_id from links
        where parent_id = any(${ids}) and child_id = any(${ids})
        order by parent_id, child_id`.execute(db);
      return {
        direction,
        nodes: reached.flatMap((row) => {
          const node = byId.get(row.nodeId);
          return node ? [{ ...node, distance: row.distance }] : [];
        }),
        edges: edges.rows,
        truncated: walked.rows.length > LINEAGE_LIMIT,
      };
    },
  };
}

export type Reading = ReturnType<typeof createReading>;

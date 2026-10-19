/** A Node of an Artifact Set: a model, seed, snapshot, source or exposure (TR-AR-03). */
export interface NodeRow {
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
  tags: string[];
  filePath: string | null;
  checksum: string | null;
  /** The meta of the Node in the dbt project, as it is written there: any JSON object. */
  meta: Record<string, unknown>;
}

export interface ColumnRow {
  nodeId: string;
  name: string;
  position: number | null;
  dataType: string | null;
  description: string;
}

export interface EdgeRow {
  parentId: string;
  childId: string;
}

export interface TestRow {
  uniqueId: string;
  name: string;
  nodeId: string;
  columnName: string | null;
  severity: string | null;
  targetNodeId: string | null;
  targetColumn: string | null;
}

/** What processing makes of one Artifact Set, before it is written. */
export interface NormalisedSet {
  projectName: string | null;
  dbtVersion: string | null;
  generatedAt: Date | null;
  nodes: NodeRow[];
  columns: ColumnRow[];
  edges: EdgeRow[];
  tests: TestRow[];
  /** The `label` of every exposure that has one, by unique ID; not stored, but handed to catalogue (TR-AR-08). */
  labels: Record<string, string>;
}

/** The kinds of Node in `manifest.nodes`; sources and exposures have their own sections. */
const NODE_TYPES = new Set(['model', 'seed', 'snapshot']);

type Json = Record<string, unknown>;

/**
 * Turns the manifest and catalog of one run into Nodes, columns, Edges and tests (FR-AR-07). The
 * columns are the actual ones from the catalog, with the descriptions of the manifest; Edges only
 * link Nodes of this set. Links to the other dbt project are made when the lineage is read, through
 * `relation` (DEC-AR-03).
 */
export function normalise(manifest: unknown, catalog: unknown): NormalisedSet {
  if (!isObject(manifest) || !isObject(manifest.nodes)) {
    throw new Error('The manifest has no nodes');
  }
  if (!isObject(catalog) || !isObject(catalog.nodes)) {
    throw new Error('The catalog has no nodes');
  }
  const metadata = object(manifest.metadata);
  const manifestNodes = entries(manifest.nodes);
  const catalogEntries = new Map([...entries(catalog.nodes), ...entries(catalog.sources)]);

  const sources = entries(manifest.sources);
  const exposures = entries(manifest.exposures);
  const built = manifestNodes.filter(([, node]) => NODE_TYPES.has(string(node.resource_type) ?? ''));

  const nodes: NodeRow[] = [
    ...built.map(([id, node]) => nodeRow(id, node, string(node.alias) ?? string(node.name))),
    ...sources.map(([id, node]) => nodeRow(id, node, string(node.identifier) ?? string(node.name))),
    ...exposures.map(([id, node]) => nodeRow(id, node, null)),
  ];
  const known = new Set(nodes.map((node) => node.uniqueId));

  const columns = [...built, ...sources, ...exposures].flatMap(([id, node]) => columnRows(id, node, catalogEntries.get(id)));

  const edges = [...built, ...exposures].flatMap(([id, node]) =>
    [...new Set(strings(object(node.depends_on).nodes))]
      .filter((parent) => known.has(parent) && parent !== id)
      .map((parent) => ({ parentId: parent, childId: id })),
  );

  const tests = manifestNodes
    .filter(([, node]) => node.resource_type === 'test')
    .flatMap(([id, node]) => {
      const row = testRow(id, node);
      return row && known.has(row.nodeId) ? [row] : [];
    });

  const labels: Record<string, string> = {};
  for (const [id, node] of exposures) {
    const label = string(node.label)?.trim();
    if (label) {
      labels[id] = label;
    }
  }

  return {
    projectName: string(metadata.project_name),
    dbtVersion: string(metadata.dbt_version),
    generatedAt: date(metadata.generated_at),
    nodes,
    columns,
    edges,
    tests,
    labels,
  };
}

function nodeRow(uniqueId: string, node: Json, table: string | null): NodeRow {
  const config = object(node.config);
  const materialized = string(config.materialized);
  const databaseName = string(node.database);
  const schemaName = string(node.schema);
  // An ephemeral model and an exposure build no table, so nothing can read them from elsewhere.
  const relation =
    table && databaseName && schemaName && materialized !== 'ephemeral' ? relationOf(databaseName, schemaName, table) : null;
  return {
    uniqueId,
    resourceType: string(node.resource_type) ?? 'unknown',
    name: string(node.name) ?? uniqueId,
    packageName: string(node.package_name) ?? '',
    databaseName,
    schemaName,
    tableName: materialized === 'ephemeral' ? null : table,
    relation,
    description: string(node.description) ?? '',
    materialized,
    // dbt-core repeats the tags of the config at the top; read both, so that an engine that keeps
    // them in the config only, such as for an exposure, is understood too (DEC-SR-22).
    tags: [...new Set([...strings(node.tags), ...strings(config.tags)])],
    filePath: string(node.original_file_path),
    checksum: string(object(node.checksum).checksum),
    // dbt keeps the meta of a Node in two places; its config wins, as it does in dbt itself.
    meta: { ...object(node.meta), ...object(config.meta) },
  };
}

/** `database.schema.table` in lowercase without quotes, the same for both dbt projects. */
export function relationOf(database: string, schema: string, table: string): string {
  return [database, schema, table].map((part) => part.replace(/[`"]/g, '').toLowerCase()).join('.');
}

function columnRows(nodeId: string, node: Json, catalogEntry: Json | undefined): ColumnRow[] {
  const documented = entries(node.columns).map(([key, column]) => ({
    name: string(column.name) ?? key,
    description: string(column.description) ?? '',
    dataType: string(column.data_type),
  }));
  const descriptions = new Map(documented.map((column) => [column.name.toLowerCase(), column.description]));

  if (catalogEntry) {
    return entries(catalogEntry.columns).map(([key, column]) => {
      const name = string(column.name) ?? key;
      return {
        nodeId,
        name,
        position: typeof column.index === 'number' ? column.index : null,
        dataType: string(column.type),
        description: descriptions.get(name.toLowerCase()) ?? string(column.comment) ?? '',
      };
    });
  }
  // Not in the catalog, such as an ephemeral model or an exposure: the columns of the manifest.
  return documented.map((column, index) => ({ nodeId, name: column.name, position: index + 1, dataType: column.dataType, description: column.description }));
}

function testRow(uniqueId: string, test: Json): TestRow | undefined {
  const metadata = object(test.test_metadata);
  const kwargs = object(metadata.kwargs);
  const dependsOn = strings(object(test.depends_on).nodes);
  const nodeId = string(test.attached_node) ?? (dependsOn.length === 1 ? dependsOn[0] : undefined);
  if (!nodeId) {
    // A singular test across several Nodes belongs to none of them.
    return undefined;
  }
  const name = string(metadata.name) ?? string(test.name) ?? uniqueId;
  const relationships = name === 'relationships';
  return {
    uniqueId,
    name,
    nodeId,
    columnName: string(test.column_name),
    severity: string(object(test.config).severity)?.toLowerCase() ?? null,
    targetNodeId: relationships ? (dependsOn.find((id) => id !== nodeId) ?? null) : null,
    targetColumn: relationships ? string(kwargs.field) : null,
  };
}

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function object(value: unknown): Json {
  return isObject(value) ? value : {};
}

function entries(value: unknown): [string, Json][] {
  return Object.entries(object(value)).filter((entry): entry is [string, Json] => isObject(entry[1]));
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function date(value: unknown): Date | null {
  const text = string(value);
  const parsed = text ? new Date(text) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

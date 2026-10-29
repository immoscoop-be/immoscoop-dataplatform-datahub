import { type BigQuery, BigQueryRefused } from './bigquery.js';
import type { QueryResource } from './catalogue.js';
import type { NamedResource } from './database.js';
import { filtersOn, recent, tablesOf, withFilter } from './sql.js';

/** The two thresholds, in bytes: above the first the User approves, above the second the Data Team decides (DEC-SR-29). */
export interface Thresholds {
  approve: number;
  request: number;
}

/** Up to 100 MB a query runs; up to 1 GB its author approves it; above, it goes to the Data Team (DEC-SR-29). */
export type Range = 'free' | 'approve' | 'request';

/** What keeps a query from running. */
export type Problem =
  | { kind: 'empty' }
  /** One of its Resources the User may no longer see. */
  | { kind: 'notVisible'; resource: Pick<NamedResource, 'id' | 'displayName'> }
  /** A table that is not one of its Resources, where it stands in the SQL if it is named there (DEC-UX-73). */
  | { kind: 'outside'; name: string; start: number | null; end: number | null }
  /** A change or a script: a query only reads. */
  | { kind: 'notSelect'; statementType: string }
  /** No filter on the partition column of a Resource that requires one (DEC-SR-35), with the SQL that adds one where Data Hub can tell where. */
  | { kind: 'filterRequired'; resource: Pick<NamedResource, 'id' | 'displayName'>; column: string; fix: string | null }
  /** BigQuery refused it, in its own words. */
  | { kind: 'invalid'; message: string };

/** No filter on the partition column of a Resource that does not require one: it runs, warned (FR-SR-40). */
export interface Warning {
  kind: 'noPartitionFilter';
  resource: Pick<NamedResource, 'id' | 'displayName'>;
  column: string;
  /** The SQL with a filter on its recent partitions, where Data Hub can tell where it goes. */
  fix: string | null;
  /** What that SQL reads at most, from a dry run of its own (FR-SR-40). */
  bytesWithFilter: number | null;
}

export interface Preflight {
  /** Whether it can run, in its range. */
  runnable: boolean;
  /** What it reads at most, from the dry run; null when there was none. */
  bytes: number | null;
  range: Range | null;
  partitions: number | null;
  problems: Problem[];
  warnings: Warning[];
  thresholds: Thresholds;
}

/** A Resource of a query: as catalogue gives it to this User, or null when they may not see it. */
export interface ResourceOfQuery {
  named: NamedResource;
  resource: QueryResource | null;
}

export const rangeOf = (bytes: number, thresholds: Thresholds): Range => (bytes > thresholds.request ? 'request' : bytes > thresholds.approve ? 'approve' : 'free');

/** BigQuery's own words for a table that requires a filter on its partition column. */
const REQUIRES_FILTER = /without a filter over column\(s\) '([^']+)'/i;

/**
 * The tables beneath each Resource, as BigQuery reads them for `select *` of it: itself for a table, the
 * tables beneath for a view. A table that requires a filter on its partition column gets one that keeps
 * only its partition of null values. A dry run costs nothing; the answer is kept a few minutes.
 */
export function createBeneath(bigquery: BigQuery, ttl = 10 * 60_000, now: () => number = Date.now) {
  const cache = new Map<string, { tables: string[]; until: number }>();
  return async (resource: Pick<QueryResource, 'key' | 'partition'>): Promise<string[]> => {
    const cached = cache.get(resource.key);
    if (cached && cached.until > now()) return cached.tables;
    const all = `select * from \`${resource.key}\``;
    let referenced: string[];
    try {
      referenced = (await bigquery.dryRun(all)).referencedTables;
    } catch (error) {
      if (!(error instanceof BigQueryRefused) || !resource.partition) throw error;
      referenced = (await bigquery.dryRun(`${all} where ${resource.partition.field} is null`)).referencedTables;
    }
    const tables = [resource.key, ...referenced];
    cache.set(resource.key, { tables, until: now() + ttl });
    return tables;
  };
}

/** The SQL with a filter on the recent partitions of this Resource, where Data Hub can tell where it goes. */
function fixFor(sql: string, resource: QueryResource, project: string): string | null {
  if (!resource.partition) return null;
  const { field, unit } = resource.partition;
  const filter = recent(field, resource.fields.find((candidate) => candidate.name === field)?.dataType ?? null, unit);
  return filter ? withFilter(sql, (name) => names(name, resource.key, project), filter) : null;
}

/** Whether a name in the SQL is this Key: in full, or without its project when that is the project the query runs in. */
function names(written: string, key: string, project: string): boolean {
  if (written === key) return true;
  const [keyProject, ...rest] = key.split('.');
  return keyProject === project && written === rest.join('.');
}

/**
 * The Pre-flight of a query (FR-SR-36, FR-SR-37, FR-SR-40, DEC-SR-35, DEC-UX-73): whether it reads only its
 * own Resources and only reads, by the names in its SQL and again by what BigQuery says it reads; what it
 * reads at most, and in which range; and whether it filters on the partition column of each Resource it
 * reads. It runs again, the same, before every run.
 */
export async function preflight(
  sql: string,
  resources: ResourceOfQuery[],
  context: { bigquery: BigQuery; beneath: (resource: QueryResource) => Promise<string[]>; project: string; thresholds: Thresholds },
): Promise<Preflight> {
  const { bigquery, beneath, project, thresholds } = context;
  const done = (fields: Partial<Preflight>): Preflight => {
    const problems = fields.problems ?? [];
    return { bytes: null, range: null, partitions: null, warnings: [], ...fields, problems, thresholds, runnable: problems.length === 0 && fields.range !== undefined && fields.range !== null };
  };
  if (sql.trim() === '') return done({ problems: [{ kind: 'empty' }] });

  const problems: Problem[] = resources
    .filter((entry) => entry.resource === null)
    .map((entry) => ({ kind: 'notVisible', resource: { id: entry.named.id, displayName: entry.named.displayName } }));
  const visible = resources.flatMap((entry) => (entry.resource ? [entry.resource] : []));

  // Every table named in the SQL is one of its Resources; a table function never is.
  const { tables, functions } = tablesOf(sql);
  const read = new Set<QueryResource>();
  for (const table of [...tables, ...functions]) {
    const resource = functions.includes(table) ? undefined : visible.find((candidate) => names(table.name, candidate.key, project));
    if (resource) read.add(resource);
    else problems.push({ kind: 'outside', name: table.name, start: table.start, end: table.end });
  }
  if (problems.length > 0) return done({ problems });

  let dry: Awaited<ReturnType<BigQuery['dryRun']>>;
  try {
    dry = await bigquery.dryRun(sql);
  } catch (error) {
    if (!(error instanceof BigQueryRefused)) throw error;
    const required = REQUIRES_FILTER.exec(error.message);
    const column = required?.[1]?.split(',')[0]?.trim();
    const resource = column ? [...read].find((candidate) => candidate.partition?.field === column) : undefined;
    return done({
      problems: [
        resource && column
          ? { kind: 'filterRequired', resource: { id: resource.id, displayName: resource.displayName }, column, fix: fixFor(sql, resource, project) }
          : { kind: 'invalid', message: error.message },
      ],
    });
  }
  if (dry.statementType !== 'SELECT') return done({ problems: [{ kind: 'notSelect', statementType: dry.statementType }] });

  // And again by what BigQuery reads: only its Resources, or the tables beneath them.
  const allowed = new Set((await Promise.all([...read].map((resource) => beneath(resource)))).flat());
  for (const table of dry.referencedTables) {
    if (!allowed.has(table)) problems.push({ kind: 'outside', name: table, start: null, end: null });
  }

  const warnings: Warning[] = [];
  for (const resource of read) {
    if (!resource.partition || filtersOn(sql, resource.partition.field)) continue;
    const named = { id: resource.id, displayName: resource.displayName };
    const fix = fixFor(sql, resource, project);
    if (resource.partitionFilter === 'none') {
      // What it would read with the filter: one more dry run, which costs nothing.
      const bytesWithFilter = fix ? await bigquery.dryRun(fix).then((filtered) => filtered.bytes, () => null) : null;
      warnings.push({ kind: 'noPartitionFilter', resource: named, column: resource.partition.field, fix, bytesWithFilter });
    }
    else problems.push({ kind: 'filterRequired', resource: named, column: resource.partition.field, fix });
  }
  return done({ bytes: dry.bytes, range: rangeOf(dry.bytes, thresholds), partitions: dry.partitions, problems, warnings });
}

import type { ArtifactSets, ClaimedSet } from './artifact-sets.js';
import type { Bucket } from './bucket.js';
import type { Catalogue } from './catalogue.js';
import type { Changes, UpstreamChange } from './changes.js';
import type { DbtCloud } from './dbt-cloud.js';
import { exposedTables } from './exposed.js';
import { type ColumnRow, type NormalisedSet, normalise } from './normalise.js';
import type { TableSchemas } from './table-schemas.js';

/** Structured logging, as pino offers it. */
export interface Log {
  info(details: object, message: string): void;
  error(details: object, message: string): void;
}

export interface ProcessingOptions {
  sets: Pick<ArtifactSets, 'claimNext' | 'save' | 'fail'>;
  bucket: Bucket;
  dbtCloud: Pick<DbtCloud, 'artifact'>;
  /** Told the exposed tables of every new Current Version (TR-AR-08); left out in tests that do not need it. */
  catalogue?: Catalogue;
  /** What changed since the previous Current Version, and the Resources it reaches (FR-AR-11, FR-AR-12). */
  changes?: Pick<Changes, 'since'>;
  /** The columns of the tables the catalog lacks, from BigQuery (EC-AR-06); left out in tests that do not need it. */
  schemas?: TableSchemas;
  log: Log;
}

/** How many tables are asked of BigQuery at the same time. */
const AT_ONCE = 8;

/**
 * What the ingest job does (TR-AR-02): takes the pending Artifact Sets one by one, gets their files,
 * normalises them and saves them as the Current Version (TR-AR-04). A set that fails gets its reason
 * and the job goes on with the next one.
 */
export function createProcessing({ sets, bucket, dbtCloud, catalogue, changes, schemas, log }: ProcessingOptions) {
  /**
   * The columns of the tables the catalog lacks, from BigQuery (EC-AR-06, TR-AR-15): their names, order and types as
   * BigQuery keeps them, with the descriptions and meta of the manifest, as the catalog would have given them. A
   * table BigQuery does not know, or may not show, keeps the columns of the manifest. BigQuery not answering fails
   * the set, so that no version becomes current whose fields lost their types.
   */
  async function withTypes(set: ClaimedSet, normalised: NormalisedSet): Promise<NormalisedSet> {
    if (!schemas || normalised.uncatalogued.length === 0) {
      return normalised;
    }
    const nodes = new Map(normalised.nodes.map((node) => [node.uniqueId, node]));
    const documented = new Map<string, Map<string, ColumnRow>>();
    for (const column of normalised.columns) {
      (documented.get(column.nodeId) ?? documented.set(column.nodeId, new Map()).get(column.nodeId)!).set(column.name.toLowerCase(), column);
    }
    const filled = new Map<string, ColumnRow[]>();
    const queue = [...normalised.uncatalogued];
    let unknown = 0;
    const work = async () => {
      for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
        const node = nodes.get(id);
        const found =
          node?.databaseName && node.schemaName && node.tableName
            ? await schemas.columns({ project: node.databaseName, dataset: node.schemaName, table: node.tableName }).catch((error: unknown) => {
                queue.length = 0;
                throw error;
              })
            : undefined;
        if (!found) {
          unknown++;
          continue;
        }
        const known = documented.get(id);
        filled.set(
          id,
          found.map((column) => {
            const manifest = known?.get(column.name.toLowerCase());
            return { nodeId: id, name: column.name, position: column.position, dataType: column.dataType, description: manifest ? manifest.description : column.description, meta: manifest?.meta ?? {} };
          }),
        );
      }
    };
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, work));
    log.info(
      { runId: set.runId, projectId: set.projectId, uncatalogued: normalised.uncatalogued.length, fromBigQuery: filled.size, unknown },
      `${filled.size} of the ${normalised.uncatalogued.length} tables the catalog lacks got their columns from BigQuery${unknown > 0 ? `; ${unknown} kept those of the manifest` : ''}`,
    );
    if (filled.size === 0) {
      return normalised;
    }
    // In the order of the set, the columns of a filled table where its first column stood.
    const columns: ColumnRow[] = [];
    const placed = new Set<string>();
    for (const column of normalised.columns) {
      const replaced = filled.get(column.nodeId);
      if (!replaced) {
        columns.push(column);
      } else if (!placed.has(column.nodeId)) {
        placed.add(column.nodeId);
        columns.push(...replaced);
      }
    }
    // A table the manifest documents no column of.
    for (const [id, replaced] of filled) {
      if (!placed.has(id)) columns.push(...replaced);
    }
    return { ...normalised, columns };
  }

  /**
   * Tells catalogue every table the exposures tagged `datahub` of the project depend on. A failure is
   * logged and does not fail the set: the next run of the project tells the whole state again.
   */
  async function tellCatalogue(set: ClaimedSet, normalised: NormalisedSet, upstream: UpstreamChange[]): Promise<void> {
    if (!catalogue) {
      return;
    }
    const { tables, empty } = exposedTables(normalised);
    const about = { runId: set.runId, projectId: set.projectId };
    if (empty.length > 0) {
      log.info({ ...about, exposures: empty }, `Exposures tagged datahub that depend on no table: ${empty.join(', ')}`);
    }
    try {
      await catalogue.resources({
        projectId: set.projectId,
        projectName: normalised.projectName,
        runId: set.runId,
        generatedAt: normalised.generatedAt?.toISOString() ?? null,
        tables,
        changes: upstream,
      });
      log.info({ ...about, tables: tables.length, changes: upstream.length }, `catalogue told the ${tables.length} exposed tables and ${upstream.length} changes`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      log.error({ ...about, err: error }, `catalogue was not told the exposed tables: ${reason}`);
    }
  }

  /**
   * What changed since the version that was current before, followed to the Resources it reaches (FR-AR-11,
   * FR-AR-12); nothing for the first version of a project. A failure is logged and does not fail the set:
   * catalogue is still told the tables.
   */
  async function changesSince(set: ClaimedSet, previous: number | null): Promise<UpstreamChange[]> {
    if (!changes || previous === null) return [];
    try {
      return await changes.since(previous, set.id);
    } catch (error) {
      log.error({ runId: set.runId, projectId: set.projectId, err: error }, 'the changes since the previous version could not be followed');
      return [];
    }
  }

  /**
   * A file of the run from the bucket; the first time from dbt Cloud, stored in the bucket byte for
   * byte, so a run processed again no longer depends on dbt Cloud.
   */
  async function file(set: ClaimedSet, name: string, wait: boolean): Promise<Uint8Array | undefined> {
    const path = `${set.projectId}/${set.runId}/${name}`;
    const stored = await bucket.read(path);
    if (stored) {
      return stored;
    }
    const fetched = await dbtCloud.artifact(set.runId, name, { wait });
    if (fetched) {
      await bucket.write(path, fetched);
    }
    return fetched;
  }

  async function process(set: ClaimedSet): Promise<boolean> {
    try {
      // dbt Cloud publishes the files of a run together, so only the first is waited for.
      const manifest = await file(set, 'manifest.json', true);
      if (!manifest) {
        throw new Error('dbt Cloud has no manifest.json for this run');
      }
      const catalog = await file(set, 'catalog.json', false);
      if (!catalog) {
        throw new Error('dbt Cloud has no catalog.json for this run: does the Source Job generate the docs?');
      }
      const normalised = await withTypes(set, normalise(parse(manifest, 'manifest.json'), parse(catalog, 'catalog.json')));
      const { current, previous } = await sets.save(set, normalised);
      log.info(
        { runId: set.runId, projectId: set.projectId, nodes: normalised.nodes.length, columns: normalised.columns.length, current },
        current ? 'Artifact Set processed and made current' : 'Artifact Set processed; a later run is current',
      );
      if (current) {
        await tellCatalogue(set, normalised, await changesSince(set, previous));
      }
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await sets.fail(set.id, reason);
      log.error({ runId: set.runId, projectId: set.projectId, err: error }, `Artifact Set failed: ${reason}`);
      return false;
    }
  }

  return {
    /** Works through every pending set; tells how many were processed and how many failed. */
    async runPending(): Promise<{ processed: number; failed: number }> {
      const result = { processed: 0, failed: 0 };
      for (let set = await sets.claimNext(); set; set = await sets.claimNext()) {
        if (await process(set)) {
          result.processed++;
        } else {
          result.failed++;
        }
      }
      return result;
    },
  };
}

function parse(bytes: Uint8Array, name: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error(`${name} is not JSON`);
  }
}

import type { ArtifactSets, ClaimedSet } from './artifact-sets.js';
import type { Bucket } from './bucket.js';
import type { DbtCloud } from './dbt-cloud.js';
import { normalise } from './normalise.js';

/** Structured logging, as pino offers it. */
export interface Log {
  info(details: object, message: string): void;
  error(details: object, message: string): void;
}

export interface ProcessingOptions {
  sets: Pick<ArtifactSets, 'claimNext' | 'save' | 'fail'>;
  bucket: Bucket;
  dbtCloud: Pick<DbtCloud, 'artifact'>;
  log: Log;
}

/**
 * What the ingest job does (TR-AR-02): takes the pending Artifact Sets one by one, gets their files,
 * normalises them and saves them as the Current Version (TR-AR-04). A set that fails gets its reason
 * and the job goes on with the next one.
 */
export function createProcessing({ sets, bucket, dbtCloud, log }: ProcessingOptions) {
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
      const normalised = normalise(parse(manifest, 'manifest.json'), parse(catalog, 'catalog.json'));
      const { current } = await sets.save(set, normalised);
      log.info(
        { runId: set.runId, projectId: set.projectId, nodes: normalised.nodes.length, columns: normalised.columns.length, current },
        current ? 'Artifact Set processed and made current' : 'Artifact Set processed; a later run is current',
      );
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

import { describe, expect, it } from 'vitest';
import type { ClaimedSet } from './artifact-sets.js';
import type { Bucket } from './bucket.js';
import type { ResourcesUpdate } from './catalogue.js';
import type { DbtCloud } from './dbt-cloud.js';
import { sampleCatalog, sampleManifest } from './fixtures.js';
import type { NormalisedSet } from './normalise.js';
import { createProcessing, type Log } from './processing.js';

const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

/** The ingest job against fakes: a queue of sets, a bucket in memory and dbt Cloud with given files. */
function harness(
  options: { dbtFiles?: Record<string, Uint8Array>; stored?: Record<string, Uint8Array>; saveFails?: boolean; current?: boolean; catalogueFails?: boolean } = {},
) {
  const queue: ClaimedSet[] = [
    { id: 1, projectId: '9367', jobId: '322951', runId: '100' },
    { id: 2, projectId: '17121', jobId: '739003', runId: '101' },
  ];
  const saved: { set: ClaimedSet; normalised: NormalisedSet }[] = [];
  const failed: { id: number; error: string }[] = [];
  const objects = new Map(Object.entries(options.stored ?? {}));
  const asked: { runId: string; file: string; wait: boolean }[] = [];
  const logged: string[] = [];
  const told: ResourcesUpdate[] = [];

  const bucket: Bucket = {
    read: async (path) => objects.get(path),
    write: async (path, data) => {
      objects.set(path, data);
    },
  };
  const dbtCloud: Pick<DbtCloud, 'artifact'> = {
    artifact: async (runId, file, { wait = false } = {}) => {
      asked.push({ runId, file, wait });
      return options.dbtFiles?.[`${runId}/${file}`];
    },
  };
  const log: Log = { info: (_details, message) => logged.push(message), error: (_details, message) => logged.push(message) };
  const processing = createProcessing({
    sets: {
      claimNext: async () => queue.shift(),
      save: async (set, normalised) => {
        if (options.saveFails) {
          throw new Error('insert or update on table "edges" violates foreign key constraint');
        }
        saved.push({ set, normalised });
        return { current: options.current ?? true };
      },
      fail: async (id, error) => {
        failed.push({ id, error });
      },
    },
    bucket,
    dbtCloud,
    catalogue: {
      resources: async (update) => {
        if (options.catalogueFails) {
          throw new Error('catalogue answered 503');
        }
        told.push(update);
      },
    },
    log,
  });
  return { processing, saved, failed, objects, asked, logged, told };
}

const run100 = { '100/manifest.json': bytes(sampleManifest()), '100/catalog.json': bytes(sampleCatalog()) };
const run101 = { '101/manifest.json': bytes(sampleManifest()), '101/catalog.json': bytes(sampleCatalog()) };

describe('the ingest job', () => {
  it('fetches the files of every pending set, keeps them in the bucket and saves what they hold', async () => {
    const { processing, saved, objects, asked } = harness({ dbtFiles: { ...run100, ...run101 } });
    expect(await processing.runPending()).toEqual({ processed: 2, failed: 0 });
    expect(saved.map((entry) => entry.set.runId)).toEqual(['100', '101']);
    expect(saved[0]?.normalised.nodes).toHaveLength(7);
    expect([...objects.keys()].sort()).toEqual(['17121/101/catalog.json', '17121/101/manifest.json', '9367/100/catalog.json', '9367/100/manifest.json']);
    // Stored byte for byte as dbt Cloud served them.
    expect(objects.get('9367/100/manifest.json')).toBe(run100['100/manifest.json']);
    // Only the first file of a run is waited for.
    expect(asked.filter((request) => request.runId === '100')).toEqual([
      { runId: '100', file: 'manifest.json', wait: true },
      { runId: '100', file: 'catalog.json', wait: false },
    ]);
  });

  it('reads the files of a run processed before from the bucket, not from dbt Cloud', async () => {
    const { processing, saved, asked } = harness({
      stored: { '9367/100/manifest.json': run100['100/manifest.json'], '9367/100/catalog.json': run100['100/catalog.json'] },
      dbtFiles: run101,
    });
    await processing.runPending();
    expect(saved).toHaveLength(2);
    expect(asked.some((request) => request.runId === '100')).toBe(false);
  });

  it('fails a set without a catalog, with the reason, and goes on with the next (EC-AR-02)', async () => {
    const { processing, saved, failed, objects } = harness({ dbtFiles: { '100/manifest.json': run100['100/manifest.json'], ...run101 } });
    expect(await processing.runPending()).toEqual({ processed: 1, failed: 1 });
    expect(failed).toEqual([{ id: 1, error: 'dbt Cloud has no catalog.json for this run: does the Source Job generate the docs?' }]);
    expect(saved.map((entry) => entry.set.runId)).toEqual(['101']);
    // The manifest is kept all the same: the run can be processed again once the docs exist.
    expect(objects.has('9367/100/manifest.json')).toBe(true);
  });

  it('fails a set whose files are not Artifacts or cannot be saved', async () => {
    const broken = harness({ dbtFiles: { '100/manifest.json': new TextEncoder().encode('<html>'), '100/catalog.json': bytes({}), ...run101 } });
    await broken.processing.runPending();
    expect(broken.failed).toEqual([{ id: 1, error: 'manifest.json is not JSON' }]);

    const failing = harness({ dbtFiles: { ...run100 }, saveFails: true });
    await failing.processing.runPending();
    expect(failing.failed[0]?.error).toMatch(/violates foreign key constraint/);
    expect(failing.failed[1]?.error).toBe('dbt Cloud has no manifest.json for this run');
  });

  it('tells catalogue the exposed tables of every new Current Version, the whole state of the project (TR-AR-08)', async () => {
    const withExposures = { '100/manifest.json': bytes(sampleManifest({ datahub: true })), '100/catalog.json': bytes(sampleCatalog()) };
    const { processing, told, logged } = harness({ dbtFiles: { ...withExposures, ...run101 } });
    await processing.runPending();
    expect(told.map((update) => [update.projectId, update.runId, update.projectName, update.tables.map((table) => table.name)])).toEqual([
      ['9367', '100', 'immoscoop_dataplatform_sql', ['countries', 'customers', 'orders']],
      // A project without exposures for Data Hub is told too: none of its tables are Resources any more.
      ['17121', '101', 'immoscoop_dataplatform_sql', []],
    ]);
    expect(logged).toContain('Exposures tagged datahub that depend on no table: datahub_lines');
  });

  it('tells catalogue nothing about a set that does not become current, and survives catalogue failing', async () => {
    const older = harness({ dbtFiles: { ...run100, ...run101 }, current: false });
    await older.processing.runPending();
    expect(older.told).toEqual([]);

    const down = harness({ dbtFiles: { ...run100, ...run101 }, catalogueFails: true });
    expect(await down.processing.runPending()).toEqual({ processed: 2, failed: 0 });
    expect(down.logged).toContain('catalogue was not told the exposed tables: catalogue answered 503');
  });
});

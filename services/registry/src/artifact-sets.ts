import type { Kysely, Transaction } from 'kysely';
import type { RegistryDatabase, SetStatus } from './database.js';
import type { NormalisedSet } from './normalise.js';

/** A run of a Source Job, as dbt Cloud reports it (TR-AR-01). */
export interface Run {
  projectId: string;
  jobId: string;
  runId: string;
}

/** An Artifact Set taken by the ingest job. */
export interface ClaimedSet extends Run {
  id: number;
}

/** After this long in progress, a set counts as pending again: a run of the job stopped halfway. */
const STALE_AFTER_MS = 60 * 60 * 1000;

/** Rows per insert: well below the 65,535 parameters Postgres takes in one statement. */
const BATCH = 1000;

/** The Artifact Sets and what processing makes of them, in the schema of registry. */
export function createArtifactSets(db: Kysely<RegistryDatabase>, now: () => Date = () => new Date()) {
  return {
    /**
     * Records a run as a pending set, at most once (FR-AR-05), and tells where it stands: a repeated
     * delivery of the same run changes nothing.
     */
    async record(run: Run): Promise<SetStatus> {
      await db
        .insertInto('artifactSets')
        .values({ projectId: run.projectId, jobId: run.jobId, runId: run.runId })
        .onConflict((conflict) => conflict.column('runId').doNothing())
        .execute();
      const set = await db.selectFrom('artifactSets').select('status').where('runId', '=', run.runId).executeTakeFirstOrThrow();
      return set.status;
    },

    /**
     * Takes the oldest pending set and marks it in progress. The lock skips sets another run of the
     * job holds, so two runs never take the same set (TR-AR-02).
     */
    async claimNext(): Promise<ClaimedSet | undefined> {
      const staleBefore = new Date(now().getTime() - STALE_AFTER_MS);
      return db
        .updateTable('artifactSets')
        .set({ status: 'processing', claimedAt: now(), error: null })
        .where('id', '=', (eb) =>
          eb
            .selectFrom('artifactSets')
            .select('id')
            .where((where) =>
              where.or([where('status', '=', 'pending'), where.and([where('status', '=', 'processing'), where('claimedAt', '<', staleBefore)])]),
            )
            .orderBy('runId')
            .limit(1)
            .forUpdate()
            .skipLocked(),
        )
        .returning(['id', 'projectId', 'jobId', 'runId'])
        .executeTakeFirst();
    },

    /** The set could not be processed: the reason stays with it, the Current Version stays as it was. */
    async fail(id: number, error: string): Promise<void> {
      await db.updateTable('artifactSets').set({ status: 'failed', error, processedAt: now() }).where('id', '=', id).execute();
    },

    /**
     * Writes the rows of a processed set and, in the same transaction, makes it the Current Version of
     * its project, unless the project already has one from a later run (TR-AR-04). Afterwards only the
     * Current Version and the one before it keep their rows. Tells whether the set became current.
     */
    async save(set: ClaimedSet, normalised: NormalisedSet): Promise<{ current: boolean }> {
      return db.transaction().execute(async (trx) => {
        await deleteRows(trx, [set.id]);
        await insertRows(trx, set.id, normalised);

        await trx
          .insertInto('projects')
          .values({ projectId: set.projectId, name: normalised.projectName })
          .onConflict((conflict) => conflict.column('projectId').doUpdateSet({ name: normalised.projectName }))
          .execute();
        // One switch at a time per project.
        const project = await trx
          .selectFrom('projects')
          .select(['currentSetId', 'previousSetId'])
          .where('projectId', '=', set.projectId)
          .forUpdate()
          .executeTakeFirstOrThrow();
        const currentRun = project.currentSetId
          ? (await trx.selectFrom('artifactSets').select('runId').where('id', '=', project.currentSetId).executeTakeFirstOrThrow()).runId
          : undefined;

        // The Current Version never goes back in time (EC-AR-01).
        const current = currentRun === undefined || BigInt(set.runId) >= BigInt(currentRun);
        let keep = [project.currentSetId, project.previousSetId];
        if (current && project.currentSetId !== set.id) {
          await trx
            .updateTable('projects')
            .set({ currentSetId: set.id, previousSetId: project.currentSetId })
            .where('projectId', '=', set.projectId)
            .execute();
          keep = [set.id, project.currentSetId];
        }

        await trx
          .updateTable('artifactSets')
          .set({ status: 'processed', error: null, processedAt: now(), dbtVersion: normalised.dbtVersion, generatedAt: normalised.generatedAt })
          .where('id', '=', set.id)
          .execute();

        const kept = keep.filter((id): id is number => id !== null);
        const others = await trx
          .selectFrom('artifactSets')
          .select('id')
          .where('projectId', '=', set.projectId)
          .where('id', 'not in', kept)
          .execute();
        await deleteRows(
          trx,
          others.map((other) => other.id),
        );
        return { current };
      });
    },
  };
}

export type ArtifactSets = ReturnType<typeof createArtifactSets>;

async function insertRows(trx: Transaction<RegistryDatabase>, setId: number, set: NormalisedSet): Promise<void> {
  for (const rows of batches(set.nodes)) {
    await trx
      .insertInto('nodes')
      .values(rows.map((row) => ({ ...row, setId })))
      .execute();
  }
  for (const rows of batches(set.columns)) {
    await trx
      .insertInto('columns')
      .values(rows.map((row) => ({ ...row, setId })))
      .execute();
  }
  for (const rows of batches(set.edges)) {
    await trx
      .insertInto('edges')
      .values(rows.map((row) => ({ ...row, setId })))
      .execute();
  }
  for (const rows of batches(set.tests)) {
    await trx
      .insertInto('tests')
      .values(rows.map((row) => ({ ...row, setId })))
      .execute();
  }
}

/** Removes the rows of sets, children before the Nodes they point to; the sets themselves stay. */
async function deleteRows(trx: Transaction<RegistryDatabase>, setIds: number[]): Promise<void> {
  if (setIds.length === 0) {
    return;
  }
  for (const table of ['tests', 'columns', 'edges', 'nodes'] as const) {
    await trx.deleteFrom(table).where('setId', 'in', setIds).execute();
  }
}

function* batches<T>(rows: T[]): Generator<T[]> {
  for (let start = 0; start < rows.length; start += BATCH) {
    yield rows.slice(start, start + BATCH);
  }
}

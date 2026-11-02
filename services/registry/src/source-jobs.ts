import type { Kysely } from 'kysely';
import type { RegistryDatabase } from './database.js';

/** A dbt project Data Hub follows, and its Source Job, as it stands now (FR-AR-18). */
export interface SourceJob {
  projectId: string;
  jobId: string;
  /** Its name in dbt Cloud when a Data Admin chose it; null for one taken over from the configuration of before. */
  jobName: string | null;
  /** Who chose it and when; null for one taken over from the configuration of before. */
  setBy: string | null;
  setAt: Date | null;
}

/** The last Artifact Set of a dbt project: the last run of its Source Job that dbt Cloud reported. */
export interface LastSet {
  projectId: string;
  runId: string;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  receivedAt: Date;
  processedAt: Date | null;
}

type Job = { id: string; name: string };
type Person = { id: string; name: string };

export interface SourceJobs {
  /** Job ID → dbt project ID, of every dbt project Data Hub follows: what the webhook takes (DEC-AR-01). */
  current(): Promise<ReadonlyMap<string, string>>;
  /** The dbt projects Data Hub follows, each with its Source Job, by dbt project ID. */
  list(): Promise<SourceJob[]>;
  /** Follows a dbt project with a job as its Source Job, from its next run; null when Data Hub follows it already. */
  follow(projectId: string, job: Job, by: Person): Promise<SourceJob | null>;
  /** Makes a job the Source Job of a dbt project Data Hub follows, from the next run; null when it does not follow it. */
  set(projectId: string, job: Job, by: Person): Promise<SourceJob | null>;
  /** Stops following a dbt project; its Artifact Sets and Resources stay. False when it did not follow it. */
  stop(projectId: string): Promise<boolean>;
  /** The last Artifact Set of each dbt project Data Hub follows. */
  lastSets(): Promise<LastSet[]>;
}

/**
 * The dbt projects this environment follows and their Source Jobs (FR-AR-18). The page Webhooks is the only place
 * they are set, and the table source_jobs the only place they are kept (DEC-AR-10); it started with what the
 * configuration held (migration 0007-source-jobs).
 */
export function createSourceJobs(db: Kysely<RegistryDatabase>): SourceJobs {
  const shown = (row: { projectId: string; jobId: string; jobName: string | null; setByName: string | null; setAt: Date }): SourceJob => ({
    projectId: String(row.projectId),
    jobId: String(row.jobId),
    jobName: row.jobName,
    setBy: row.setByName,
    // A Source Job taken over from the configuration has no moment it was chosen.
    setAt: row.setByName === null ? null : row.setAt,
  });
  const columns = ['projectId', 'jobId', 'jobName', 'setByName', 'setAt'] as const;

  async function list(): Promise<SourceJob[]> {
    const rows = await db.selectFrom('sourceJobs').select(columns).orderBy('projectId').execute();
    return rows.map(shown);
  }

  return {
    async current() {
      return new Map((await list()).map((job) => [job.jobId, job.projectId]));
    },

    list,

    async follow(projectId, job, by) {
      const row = await db
        .insertInto('sourceJobs')
        .values({ projectId, jobId: job.id, jobName: job.name, setBy: by.id, setByName: by.name })
        .onConflict((conflict) => conflict.column('projectId').doNothing())
        .returning(columns)
        .executeTakeFirst();
      return row ? shown(row) : null;
    },

    async set(projectId, job, by) {
      const row = await db
        .updateTable('sourceJobs')
        .set({ jobId: job.id, jobName: job.name, setBy: by.id, setByName: by.name, setAt: new Date() })
        .where('projectId', '=', projectId)
        .returning(columns)
        .executeTakeFirst();
      return row ? shown(row) : null;
    },

    async stop(projectId) {
      const gone = await db.deleteFrom('sourceJobs').where('projectId', '=', projectId).executeTakeFirst();
      return gone.numDeletedRows > 0n;
    },

    async lastSets() {
      const rows = await db
        .selectFrom('artifactSets')
        .select(['projectId', 'runId', 'status', 'receivedAt', 'processedAt'])
        .distinctOn('projectId')
        .where('projectId', 'in', db.selectFrom('sourceJobs').select('projectId'))
        .orderBy('projectId')
        .orderBy('runId', 'desc')
        .execute();
      return rows.map((row) => ({ projectId: String(row.projectId), runId: String(row.runId), status: row.status, receivedAt: row.receivedAt, processedAt: row.processedAt }));
    },
  };
}

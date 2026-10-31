import type { Kysely } from 'kysely';
import type { RegistryDatabase } from './database.js';

/** The Source Job of a dbt project, as it stands now (FR-AR-18). */
export interface SourceJob {
  projectId: string;
  jobId: string;
  /** Its name in dbt Cloud when a Data Admin chose it; null for the one of the configuration. */
  jobName: string | null;
  /** Who chose it and when; null for the one of the configuration. */
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

export interface SourceJobs {
  /** Job ID → dbt project ID, of every dbt project Data Hub follows: what the webhook takes (DEC-AR-01). */
  current(): Promise<ReadonlyMap<string, string>>;
  /** The Source Job per dbt project, by dbt project ID. */
  list(): Promise<SourceJob[]>;
  /** Makes a job the Source Job of a dbt project Data Hub follows, from the next run (FR-AR-18). */
  set(projectId: string, job: { id: string; name: string }, by: { id: string; name: string }): Promise<SourceJob>;
  /** The last Artifact Set of each dbt project. */
  lastSets(): Promise<LastSet[]>;
}

/**
 * The Source Jobs of this environment (FR-AR-18). The configuration of the environment, from Terraform,
 * names the dbt projects Data Hub follows and their first Source Job; a job a Data Admin chose on the page
 * Webhooks takes its place, from the next run, without a deploy. How the two relate later is OP-AR-10.
 */
export function createSourceJobs(db: Kysely<RegistryDatabase>, configured: ReadonlyMap<string, string>): SourceJobs {
  /** dbt project ID → job ID, as the configuration has it. */
  const byProject = new Map([...configured].map(([job, project]) => [project, job]));

  async function chosen() {
    if (byProject.size === 0) return [];
    return db.selectFrom('sourceJobs').selectAll().where('projectId', 'in', [...byProject.keys()]).execute();
  }

  async function list(): Promise<SourceJob[]> {
    const rows = new Map((await chosen()).map((row) => [String(row.projectId), row]));
    return [...byProject].map(([projectId, jobId]) => {
      const row = rows.get(projectId);
      return row
        ? { projectId, jobId: String(row.jobId), jobName: row.jobName, setBy: row.setByName, setAt: row.setAt }
        : { projectId, jobId, jobName: null, setBy: null, setAt: null };
    });
  }

  return {
    async current() {
      return new Map((await list()).map((job) => [job.jobId, job.projectId]));
    },

    list,

    async set(projectId, job, by) {
      if (!byProject.has(projectId)) {
        throw new Error(`Data Hub does not follow the dbt project ${projectId}`);
      }
      const values = { projectId, jobId: job.id, jobName: job.name, setBy: by.id, setByName: by.name, setAt: new Date() };
      await db
        .insertInto('sourceJobs')
        .values(values)
        .onConflict((conflict) => conflict.column('projectId').doUpdateSet({ jobId: job.id, jobName: job.name, setBy: by.id, setByName: by.name, setAt: values.setAt }))
        .execute();
      return { projectId, jobId: job.id, jobName: job.name, setBy: by.name, setAt: values.setAt };
    },

    async lastSets() {
      if (byProject.size === 0) return [];
      const rows = await db
        .selectFrom('artifactSets')
        .select(['projectId', 'runId', 'status', 'receivedAt', 'processedAt'])
        .distinctOn('projectId')
        .where('projectId', 'in', [...byProject.keys()])
        .orderBy('projectId')
        .orderBy('runId', 'desc')
        .execute();
      return rows.map((row) => ({ projectId: String(row.projectId), runId: String(row.runId), status: row.status, receivedAt: row.receivedAt, processedAt: row.processedAt }));
    },
  };
}

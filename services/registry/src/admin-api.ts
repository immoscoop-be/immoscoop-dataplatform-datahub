import type { FastifyInstance } from 'fastify';
import type { DbtCloud, DbtJob } from './dbt-cloud.js';
import type { Deliveries } from './deliveries.js';
import type { Reading } from './reading.js';
import type { LastSet, SourceJob, SourceJobs } from './source-jobs.js';

export interface AdminOptions {
  sourceJobs: SourceJobs;
  deliveries: Pick<Deliveries, 'list' | 'toLookAt'>;
  dbtCloud: Pick<DbtCloud, 'jobs'>;
  reading: Pick<Reading, 'projects'>;
  /** The Source Jobs of the configuration of this environment: job ID → dbt project ID (DEC-AR-01). */
  configured: ReadonlyMap<string, string>;
  /** Where dbt Cloud sends its webhook to: registry's own address and `/webhooks/dbt-cloud`. */
  webhookUrl: string;
}

/** The role of the Data Team, from its Role Group `datahub-datateam@` (Naming Convention). */
const DATA_TEAM = 'datateam';

/** Why a job cannot be a Source Job of this environment. */
type NotChoosable = 'ci' | 'otherEnvironment';

/**
 * The page Webhooks of Admin (FR-AR-18, FR-AR-19), for the Data Team only: the Source Job of every dbt
 * project Data Hub follows, the jobs of a project to choose another one from, and every delivery of the
 * webhook of the last 30 days with what Data Hub did with it.
 */
export async function adminRoutes(app: FastifyInstance, options: AdminOptions): Promise<void> {
  const { sourceJobs, deliveries, dbtCloud, reading, configured, webhookUrl } = options;

  // Runs after the token check of @datahub/auth, which has set request.user.
  app.addHook('onRequest', async (request, reply) => {
    if (!request.user?.roles.includes(DATA_TEAM)) {
      return reply.code(403).send({ error: 'forbidden', message: 'Only the Data Team manages the webhooks of Data Hub.' });
    }
  });

  /** The jobs of a project from dbt Cloud, or undefined when dbt Cloud does not answer. */
  async function jobsOf(projectId: string, log: { warn: (object: unknown, message: string) => void }): Promise<DbtJob[] | undefined> {
    try {
      return await dbtCloud.jobs(projectId);
    } catch (error) {
      log.warn({ err: error, projectId }, 'dbt Cloud did not list the jobs of a project');
      return undefined;
    }
  }

  /** The environment in dbt Cloud whose jobs this environment of Data Hub reads: that of the Source Job in its configuration. */
  function environmentOf(projectId: string, jobs: readonly DbtJob[], current: string): string | null {
    const first = [...configured].find(([, project]) => project === projectId)?.[0];
    return jobs.find((job) => job.id === first)?.environmentId ?? jobs.find((job) => job.id === current)?.environmentId ?? null;
  }

  function notChoosable(job: DbtJob, environmentId: string | null): NotChoosable | null {
    if (job.kind === 'ci') return 'ci';
    if (environmentId !== null && job.environmentId !== environmentId) return 'otherEnvironment';
    return null;
  }

  function tile(source: SourceJob, name: string | null, jobs: readonly DbtJob[] | undefined, last: LastSet | undefined) {
    const job = jobs?.find((candidate) => candidate.id === source.jobId);
    return {
      projectId: source.projectId,
      projectName: name,
      job: {
        id: source.jobId,
        name: job?.name ?? source.jobName,
        environmentName: job?.environmentName ?? null,
        kind: job?.kind ?? null,
        generatesDocs: job?.generatesDocs ?? null,
      },
      setBy: source.setBy,
      setAt: source.setAt,
      lastSet: last ?? null,
      /** dbt Cloud answered: without it, only what Data Hub keeps itself shows. */
      dbtCloud: jobs !== undefined,
    };
  }

  async function names(): Promise<Map<string, string | null>> {
    return new Map((await reading.projects()).map((project) => [project.projectId, project.name]));
  }

  app.get('/admin/source-jobs', async (request) => {
    const [list, lastSets, projectNames] = await Promise.all([sourceJobs.list(), sourceJobs.lastSets(), names()]);
    const tiles = await Promise.all(
      list.map(async (source) =>
        tile(source, projectNames.get(source.projectId) ?? null, await jobsOf(source.projectId, request.log), lastSets.find((last) => last.projectId === source.projectId)),
      ),
    );
    return { projects: tiles, webhookUrl };
  });

  app.get<{ Params: { projectId: string } }>('/admin/source-jobs/:projectId/jobs', async (request, reply) => {
    const source = (await sourceJobs.list()).find((candidate) => candidate.projectId === request.params.projectId);
    if (!source) return reply.code(404).send({ error: 'not_found', message: 'Data Hub does not follow this dbt project.' });
    const jobs = await jobsOf(source.projectId, request.log);
    if (!jobs) return reply.code(503).header('retry-after', '30').send({ error: 'temporarily_unavailable', message: 'dbt Cloud did not list the jobs; try again later.' });
    const environmentId = environmentOf(source.projectId, jobs, source.jobId);
    return {
      environment: environmentId ? { id: environmentId, name: jobs.find((job) => job.environmentId === environmentId)?.environmentName ?? null } : null,
      jobs: jobs.map((job) => ({ ...job, current: job.id === source.jobId, notChoosable: notChoosable(job, environmentId) })),
    };
  });

  // A Data Admin makes a job the Source Job of a dbt project, from the next run (FR-AR-18): a job of dbt
  // Cloud as it names it now, of the right environment and no CI job; nobody types an ID.
  app.put<{ Params: { projectId: string }; Body: unknown }>('/admin/source-jobs/:projectId', async (request, reply) => {
    const jobId = (request.body as { jobId?: unknown } | null)?.jobId;
    if (typeof jobId !== 'string' || !/^\d+$/.test(jobId)) {
      return reply.code(400).send({ error: 'invalid_request', message: 'Send the jobId of a job of dbt Cloud.' });
    }
    const source = (await sourceJobs.list()).find((candidate) => candidate.projectId === request.params.projectId);
    if (!source) return reply.code(404).send({ error: 'not_found', message: 'Data Hub does not follow this dbt project.' });
    const jobs = await jobsOf(source.projectId, request.log);
    if (!jobs) return reply.code(503).header('retry-after', '30').send({ error: 'temporarily_unavailable', message: 'dbt Cloud did not list the jobs; try again later.' });
    const job = jobs.find((candidate) => candidate.id === jobId);
    if (!job) return reply.code(404).send({ error: 'not_found', message: `dbt Cloud knows no job ${jobId} in this dbt project.` });
    const why = notChoosable(job, environmentOf(source.projectId, jobs, source.jobId));
    if (why) {
      return reply
        .code(409)
        .send({ error: 'not_choosable', reason: why, message: why === 'ci' ? 'A CI job builds pull requests in schemas of their own: it cannot be a Source Job.' : 'This job belongs to another environment of dbt Cloud.' });
    }
    const user = request.user;
    const saved = await sourceJobs.set(source.projectId, { id: job.id, name: job.name }, { id: user?.sub ?? '', name: user?.name || user?.email || '' });
    request.log.info({ projectId: source.projectId, jobId: job.id, by: user?.email }, 'Source Job set on the page Webhooks');
    const [lastSets, projectNames] = await Promise.all([sourceJobs.lastSets(), names()]);
    return tile(saved, projectNames.get(saved.projectId) ?? null, jobs, lastSets.find((last) => last.projectId === saved.projectId));
  });

  app.get('/admin/deliveries', async () => {
    const [list, toLookAt] = await Promise.all([deliveries.list(), deliveries.toLookAt()]);
    const following = await sourceJobs.current();
    return { deliveries: list.map((delivery) => ({ ...delivery, sourceJob: delivery.jobId !== null && following.has(delivery.jobId) })), toLookAt };
  });
}

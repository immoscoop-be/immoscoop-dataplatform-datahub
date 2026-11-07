import type { FastifyInstance, FastifyReply } from 'fastify';
import { forbidden, opensWebhooks } from './access.js';
import type { DbtCloud, DbtJob, DbtProject } from './dbt-cloud.js';
import type { Deliveries } from './deliveries.js';
import type { Reading } from './reading.js';
import type { LastSet, SourceJob, SourceJobs } from './source-jobs.js';

export interface AdminOptions {
  sourceJobs: SourceJobs;
  deliveries: Pick<Deliveries, 'list' | 'toLookAt'>;
  dbtCloud: Pick<DbtCloud, 'jobs' | 'projects'>;
  reading: Pick<Reading, 'projects'>;
  /** Where dbt Cloud sends its webhook to: registry's own address and `/webhooks/dbt-cloud`. */
  webhookUrl: string;
}

/** Why a job cannot be a Source Job of this environment. */
type NotChoosable = 'ci' | 'otherEnvironment' | 'noDocs';

const REFUSED: Record<NotChoosable, string> = {
  ci: 'A CI job builds pull requests in schemas of their own: it cannot be a Source Job.',
  otherEnvironment: 'This job belongs to another environment of dbt Cloud.',
  noDocs: 'This job does not generate the docs, so its runs have no catalog: it cannot be a Source Job.',
};

type Log = { warn: (object: unknown, message: string) => void };

/**
 * The page Webhooks of Admin (FR-AR-18, FR-AR-19), for who opens it (`admin.open`): the dbt projects Data Hub follows and
 * the Source Job of each, which a Data Admin sets here and nowhere else (DEC-AR-10): following a dbt project of the
 * account, changing its Source Job, or no longer following it. And every delivery of the webhook of the last 30
 * days, with what Data Hub did with it.
 */
export async function adminRoutes(app: FastifyInstance, options: AdminOptions): Promise<void> {
  const { sourceJobs, deliveries, dbtCloud, reading, webhookUrl } = options;

  // Runs after the token check of @datahub/auth, which has set request.user.
  app.addHook('onRequest', async (request, reply) => {
    if (!opensWebhooks(request)) {
      return forbidden(reply, 'admin.open', 'Only who opens the Webhooks of Admin manages the webhooks of Data Hub.');
    }
  });

  /** The jobs of a project from dbt Cloud, or undefined when dbt Cloud does not answer. */
  async function jobsOf(projectId: string, log: Log): Promise<DbtJob[] | undefined> {
    try {
      return await dbtCloud.jobs(projectId);
    } catch (error) {
      log.warn({ err: error, projectId }, 'dbt Cloud did not list the jobs of a project');
      return undefined;
    }
  }

  /** The dbt projects of the account, or undefined when dbt Cloud does not answer. */
  async function projectsOf(log: Log): Promise<DbtProject[] | undefined> {
    try {
      return await dbtCloud.projects();
    } catch (error) {
      log.warn({ err: error }, 'dbt Cloud did not list the dbt projects of the account');
      return undefined;
    }
  }

  /**
   * The environment in dbt Cloud whose jobs this environment of Data Hub reads for a dbt project: that of its
   * Source Job now. A dbt project not followed yet has none, so a job of any environment may be its first.
   */
  function environmentOf(jobs: readonly DbtJob[], current: string | undefined): string | null {
    return jobs.find((job) => job.id === current)?.environmentId ?? null;
  }

  function notChoosable(job: DbtJob, environmentId: string | null): NotChoosable | null {
    if (job.kind === 'ci') return 'ci';
    if (environmentId !== null && job.environmentId !== environmentId) return 'otherEnvironment';
    // Its runs have no catalog.json, so the real columns would not be known (EC-AR-02).
    if (!job.generatesDocs) return 'noDocs';
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

  /** The name of each dbt project: the one of its manifest, or else the one in dbt Cloud. */
  async function names(log: Log): Promise<Map<string, string | null>> {
    const [processed, account] = await Promise.all([reading.projects(), projectsOf(log)]);
    const named = new Map<string, string | null>((account ?? []).map((project) => [project.id, project.name]));
    for (const project of processed) if (project.name) named.set(project.projectId, project.name);
    return named;
  }

  async function tileOf(source: SourceJob, jobs: readonly DbtJob[], log: Log) {
    const [lastSets, projectNames] = await Promise.all([sourceJobs.lastSets(), names(log)]);
    return tile(source, projectNames.get(source.projectId) ?? null, jobs, lastSets.find((last) => last.projectId === source.projectId));
  }

  const followed = async (projectId: string) => (await sourceJobs.list()).find((candidate) => candidate.projectId === projectId);
  const dbtCloudDown = (reply: FastifyReply, what: string) =>
    reply.code(503).header('retry-after', '30').send({ error: 'temporarily_unavailable', message: `dbt Cloud did not list ${what}; try again later.` });
  const notFollowed = (reply: FastifyReply) => reply.code(404).send({ error: 'not_found', message: 'Data Hub does not follow this dbt project.' });
  const by = (user: { sub?: string; name?: string; email?: string } | null | undefined) => ({ id: user?.sub ?? '', name: user?.name || user?.email || '' });

  /** The job a Data Admin sent, checked with dbt Cloud: its answer is sent when it is refused. */
  async function chosen(reply: FastifyReply, projectId: string, jobId: string, current: string | undefined, log: Log) {
    const jobs = await jobsOf(projectId, log);
    if (!jobs) return { refused: dbtCloudDown(reply, 'the jobs') };
    const job = jobs.find((candidate) => candidate.id === jobId);
    if (!job) return { refused: reply.code(404).send({ error: 'not_found', message: `dbt Cloud knows no job ${jobId} in this dbt project.` }) };
    const why = notChoosable(job, environmentOf(jobs, current));
    if (why) return { refused: reply.code(409).send({ error: 'not_choosable', reason: why, message: REFUSED[why] }) };
    return { job, jobs };
  }

  app.get('/admin/source-jobs', async (request) => {
    const [list, lastSets, projectNames] = await Promise.all([sourceJobs.list(), sourceJobs.lastSets(), names(request.log)]);
    const tiles = await Promise.all(
      list.map(async (source) =>
        tile(source, projectNames.get(source.projectId) ?? null, await jobsOf(source.projectId, request.log), lastSets.find((last) => last.projectId === source.projectId)),
      ),
    );
    return { projects: tiles, webhookUrl };
  });

  // The dbt projects of the account, for "Follow a dbt project" (DEC-AR-10).
  app.get('/admin/dbt-projects', async (request, reply) => {
    const [projects, list] = await Promise.all([projectsOf(request.log), sourceJobs.list()]);
    if (!projects) return dbtCloudDown(reply, 'the dbt projects');
    const following = new Set(list.map((source) => source.projectId));
    return { projects: projects.map((project) => ({ ...project, following: following.has(project.id) })) };
  });

  // The jobs that can be the Source Job of a dbt project: of the environment of its Source Job when Data Hub
  // follows it, of every environment when it does not yet.
  app.get<{ Params: { projectId: string } }>('/admin/source-jobs/:projectId/jobs', async (request, reply) => {
    const { projectId } = request.params;
    if (!/^\d+$/.test(projectId)) return reply.code(400).send({ error: 'invalid_request', message: 'A dbt project is named by its numeric ID.' });
    const source = await followed(projectId);
    const jobs = await jobsOf(projectId, request.log);
    if (!jobs) return dbtCloudDown(reply, 'the jobs');
    const environmentId = environmentOf(jobs, source?.jobId);
    return {
      environment: environmentId ? { id: environmentId, name: jobs.find((job) => job.environmentId === environmentId)?.environmentName ?? null } : null,
      jobs: jobs.map((job) => ({ ...job, current: job.id === source?.jobId, notChoosable: notChoosable(job, environmentId) })),
    };
  });

  // A Data Admin follows a dbt project of the account with a job as its Source Job, from its next run (DEC-AR-10).
  app.post<{ Body: unknown }>('/admin/source-jobs', async (request, reply) => {
    const { projectId, jobId } = (request.body ?? {}) as { projectId?: unknown; jobId?: unknown };
    if (typeof projectId !== 'string' || !/^\d+$/.test(projectId) || typeof jobId !== 'string' || !/^\d+$/.test(jobId)) {
      return reply.code(400).send({ error: 'invalid_request', message: 'Send the projectId and jobId of dbt Cloud.' });
    }
    const following = { error: 'following', message: 'Data Hub follows this dbt project already: change its Source Job instead.' };
    if (await followed(projectId)) return reply.code(409).send(following);
    const checked = await chosen(reply, projectId, jobId, undefined, request.log);
    if ('refused' in checked) return checked.refused;
    const saved = await sourceJobs.follow(projectId, { id: checked.job.id, name: checked.job.name }, by(request.user));
    if (!saved) return reply.code(409).send(following);
    request.log.info({ projectId, jobId, by: request.user?.email }, 'dbt project followed on the page Webhooks');
    return reply.code(201).send(await tileOf(saved, checked.jobs, request.log));
  });

  // A Data Admin makes a job the Source Job of a dbt project, from the next run (FR-AR-18): a job of dbt
  // Cloud as it names it now, of the right environment, that generates the docs and is no CI job; nobody types an ID.
  app.put<{ Params: { projectId: string }; Body: unknown }>('/admin/source-jobs/:projectId', async (request, reply) => {
    const jobId = (request.body as { jobId?: unknown } | null)?.jobId;
    if (typeof jobId !== 'string' || !/^\d+$/.test(jobId)) {
      return reply.code(400).send({ error: 'invalid_request', message: 'Send the jobId of a job of dbt Cloud.' });
    }
    const source = await followed(request.params.projectId);
    if (!source) return notFollowed(reply);
    const checked = await chosen(reply, source.projectId, jobId, source.jobId, request.log);
    if ('refused' in checked) return checked.refused;
    const saved = await sourceJobs.set(source.projectId, { id: checked.job.id, name: checked.job.name }, by(request.user));
    if (!saved) return notFollowed(reply);
    request.log.info({ projectId: source.projectId, jobId, by: request.user?.email }, 'Source Job set on the page Webhooks');
    return tileOf(saved, checked.jobs, request.log);
  });

  // A Data Admin stops following a dbt project: its runs are ignored from then on, and its Artifact Sets, Current
  // Version and Resources stay as they are (DEC-AR-10).
  app.delete<{ Params: { projectId: string } }>('/admin/source-jobs/:projectId', async (request, reply) => {
    const { projectId } = request.params;
    if (!(await sourceJobs.stop(projectId))) return notFollowed(reply);
    request.log.info({ projectId, by: request.user?.email }, 'dbt project no longer followed, on the page Webhooks');
    return reply.code(204).send();
  });

  app.get('/admin/deliveries', async () => {
    const [list, toLookAt] = await Promise.all([deliveries.list(), deliveries.toLookAt()]);
    const following = await sourceJobs.current();
    return { deliveries: list.map((delivery) => ({ ...delivery, sourceJob: delivery.jobId !== null && following.has(delivery.jobId) })), toLookAt };
  });
}

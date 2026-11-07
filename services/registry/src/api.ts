import { can, sees } from '@datahub/contracts';
import type { FastifyInstance } from 'fastify';
import { forbidden, opensWebhooks, permissionsOf } from './access.js';
import type { ArtifactSets } from './artifact-sets.js';
import type { DbtCloud } from './dbt-cloud.js';
import { type DomainModel, DomainModelUnavailable, identitiesOf, offeredTypes } from './domain-model.js';
import type { Proposals } from './proposal.js';
import type { Direction, Reading } from './reading.js';

export interface ApiOptions {
  reading: Reading;
  sets: Pick<ArtifactSets, 'record' | 'reprocess'>;
  dbtCloud: Pick<DbtCloud, 'run'>;
  /** The Source Jobs of this environment now: job ID → dbt project ID (DEC-AR-01, FR-AR-18). */
  sourceJobs: () => Promise<ReadonlyMap<string, string>>;
  /** Starts the ingest job, which processes the pending sets. */
  startIngest: () => Promise<void>;
  /** The Domain Model in use, read from the collector each time (DEC-AR-05). */
  domainModel: () => Promise<DomainModel>;
  /** What Data Hub proposes for a Resource when it is added (FR-CO-33, FR-CO-34). */
  proposals: Proposals;
}

const NODE_TYPES = new Set(['model', 'seed', 'snapshot', 'source', 'exposure']);

type Query = Record<string, string | undefined>;

/**
 * What registry tells about the dbt projects (TR-AR-05 to TR-AR-07). Every route needs an Access
 * Token, and a Permission that needs the registry (DEC-AR-06, TR-PL-06); the lineage around a Resource
 * everyone who sees it reads through catalogue.
 */
export async function apiRoutes(app: FastifyInstance, options: ApiOptions): Promise<void> {
  // Runs after the token check of @datahub/auth, which has set request.user.
  app.addHook('onRequest', async (request, reply) => {
    const permissions = permissionsOf(request);
    // It holds every Node of every dbt project: for adding Resources (Add Resources, Edit relations), the Webhooks of Admin, and who sees all.
    if (!can(permissions, 'resources.assign') && !opensWebhooks(request) && sees(permissions) !== 'all') {
      return forbidden(reply, 'resources.assign', 'Only who adds Resources to Collections, opens the Webhooks of Admin or sees all of Data Hub reads the registry.');
    }
  });

  app.get('/projects', async () => ({ projects: await options.reading.projects() }));

  app.get<{ Querystring: Query }>('/runs', async (request) => ({
    runs: await options.reading.runs(number(request.query.limit, 20, 100)),
  }));

  app.get<{ Querystring: Query }>('/nodes', async (request, reply) => {
    const query = (request.query.q ?? '').trim();
    const type = request.query.type;
    if (query.length === 0 || query.length > 200) {
      return reply.code(400).send({ error: 'invalid_request', message: 'Give a search text of 1 to 200 characters in q.' });
    }
    if (type !== undefined && !NODE_TYPES.has(type)) {
      return reply.code(400).send({ error: 'invalid_request', message: `type is one of ${[...NODE_TYPES].join(', ')}.` });
    }
    const project = request.query.project;
    if (project !== undefined && !/^\d{1,18}$/.test(project)) {
      return reply.code(400).send({ error: 'invalid_request', message: 'A dbt project is named by its numeric ID.' });
    }
    return { nodes: await options.reading.search(query, { type, project, limit: number(request.query.limit, 25, 100) }) };
  });

  app.get<{ Params: { id: string } }>('/nodes/:id', async (request, reply) => {
    const node = await options.reading.node(request.params.id);
    return node ?? reply.code(404).send({ error: 'not_found', message: 'No such Node in the Current Version of a dbt project.' });
  });

  // The grain, storage and mappings Data Hub proposes for the Resource on a Node (FR-CO-33, FR-CO-34,
  // FR-AR-17); without the Domain Model when the collector does not answer (EC-AR-05).
  app.get<{ Params: { id: string } }>('/nodes/:id/proposal', async (request, reply) => {
    const proposal = await options.proposals.proposal(request.params.id);
    return proposal ?? reply.code(404).send({ error: 'not_found', message: 'No such Node in the Current Version of a dbt project.' });
  });

  // The Domain Model in use, as the step that adds a Resource needs it (FR-AR-15): its release, the
  // relation types a field can map to, and every identity.
  app.get('/domain-model', async (request, reply) => {
    try {
      const model = await options.domainModel();
      return {
        domain: model.domain,
        version: model.version,
        release: model.release,
        relationTypes: offeredTypes(model),
        identities: identitiesOf(model),
      };
    } catch (error) {
      if (!(error instanceof DomainModelUnavailable)) {
        throw error;
      }
      request.log.warn({ err: error }, 'the collector did not give the Domain Model');
      return reply.code(503).header('retry-after', '30').send({ error: 'domain_model_unavailable', message: 'The collector of Colleciónes did not answer; try again.' });
    }
  });

  app.get<{ Params: { id: string }; Querystring: Query }>('/nodes/:id/lineage', async (request, reply) => {
    const direction = request.query.direction ?? 'downstream';
    if (direction !== 'upstream' && direction !== 'downstream') {
      return reply.code(400).send({ error: 'invalid_request', message: 'direction is upstream or downstream.' });
    }
    const lineage = await options.reading.lineage(request.params.id, direction as Direction, number(request.query.depth, 10, 50));
    return lineage ?? reply.code(404).send({ error: 'not_found', message: 'No such Node in the Current Version of a dbt project.' });
  });

  // Fetches and processes a run again (FR-AR-14): a set registry knows goes back in the queue; a run
  // whose webhook never arrived is first checked with dbt Cloud (DEC-AR-02).
  app.post<{ Params: { runId: string } }>('/runs/:runId/reprocess', async (request, reply) => {
    if (!opensWebhooks(request)) {
      return forbidden(reply, 'admin.open', 'Only who opens the Webhooks of Admin processes a run again.');
    }
    const { runId } = request.params;
    if (!/^\d+$/.test(runId)) {
      return reply.code(400).send({ error: 'invalid_request', message: 'A run is named by its numeric ID.' });
    }
    let status = await options.sets.reprocess(runId);
    if (status === undefined) {
      const run = await options.dbtCloud.run(runId);
      if (!run) {
        return reply.code(404).send({ error: 'not_found', message: `dbt Cloud knows no run ${runId}.` });
      }
      if (!run.success || (await options.sourceJobs()).get(run.jobId) !== run.projectId) {
        return reply.code(409).send({ error: 'not_a_source_run', message: `Run ${runId} is not a successful run of a Source Job of this environment.` });
      }
      status = await options.sets.record({ runId, jobId: run.jobId, projectId: run.projectId });
    }
    if (status === 'processing') {
      return reply.code(409).send({ error: 'busy', message: `Run ${runId} is being processed right now.` });
    }
    await options.startIngest();
    request.log.info({ runId, by: request.user?.email }, 'run queued again by hand');
    return reply.code(202).send({ runId, status });
  });
}

/** A whole number from the query string between 1 and `max`, or the default. */
function number(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? Math.min(parsed, max) : fallback;
}

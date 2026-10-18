import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ArtifactSets, Run } from './artifact-sets.js';

export interface WebhookOptions {
  /** The secret dbt Cloud signs with (datahub-dbt-webhook-secret), read when first needed. */
  secret: () => Promise<string>;
  /** The dbt Cloud account of Data Hub (DATAHUB_DBT_ACCOUNT_ID). */
  accountId: string;
  /** The Source Jobs of this environment: job ID → dbt project ID (DEC-AR-01). */
  sourceJobs: ReadonlyMap<string, string>;
  sets: Pick<ArtifactSets, 'record'>;
  /** Starts the ingest job, which processes the pending sets. */
  startIngest: () => Promise<void>;
}

/**
 * `POST /webhooks/dbt-cloud`, where dbt Cloud reports finished runs (TR-AR-01). It has no Access
 * Token, so the route is public and the signature of the body protects it instead.
 */
export async function webhookRoutes(app: FastifyInstance, options: WebhookOptions): Promise<void> {
  // The signature covers the body exactly as it was sent, so it is kept as bytes. This parser only
  // applies to the routes of this plugin.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => done(null, body));

  app.post('/webhooks/dbt-cloud', { config: { public: true } }, async (request, reply) => {
    let secret: string;
    try {
      secret = await options.secret();
    } catch (error) {
      request.log.error({ err: error }, 'the webhook secret could not be read');
      return reply.code(503).send({ error: 'temporarily_unavailable', message: 'The webhook secret is not available.' });
    }
    const body = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    if (!signed(body, request.headers.authorization, secret)) {
      request.log.warn('webhook refused: the signature does not match');
      return reply.code(401).send({ error: 'unauthorized', message: 'The signature does not match.' });
    }

    let event: unknown;
    try {
      event = JSON.parse(body.toString('utf8'));
    } catch {
      return reply.code(400).send({ error: 'invalid_request', message: 'The body is not JSON.' });
    }
    const run = sourceRun(event, options);
    if (!run) {
      request.log.info({ event: summary(event) }, 'webhook ignored: not a successful run of a Source Job');
      return reply.code(204).send();
    }

    const status = await options.sets.record(run);
    // A set still pending was not taken by the job yet, also when this is dbt Cloud trying again.
    if (status === 'pending') {
      await options.startIngest();
    }
    request.log.info({ ...run, status }, 'run of a Source Job recorded');
    return reply.code(202).send({ runId: run.runId, status });
  });
}

/** Whether the header is the HMAC-SHA256 of the body with the secret, in hex, as dbt Cloud sends it. */
function signed(body: Buffer, header: string | undefined, secret: string): boolean {
  const expected = Buffer.from(createHmac('sha256', secret).update(body).digest('hex'));
  const given = Buffer.from(header ?? '');
  return secret.length > 0 && given.length === expected.length && timingSafeEqual(given, expected);
}

/** The run, if the event reports a successful run of a Source Job of this environment's account. */
function sourceRun(event: unknown, options: Pick<WebhookOptions, 'accountId' | 'sourceJobs'>): Run | undefined {
  const { accountId, eventType, data } = (event ?? {}) as { accountId?: unknown; eventType?: unknown; data?: Record<string, unknown> };
  if (eventType !== 'job.run.completed' || String(accountId) !== options.accountId || data?.runStatus !== 'Success') {
    return undefined;
  }
  const jobId = String(data.jobId);
  const projectId = String(data.projectId);
  const runId = String(data.runId);
  if (options.sourceJobs.get(jobId) !== projectId || !/^\d+$/.test(runId)) {
    return undefined;
  }
  return { projectId, jobId, runId };
}

/** What the log keeps of an ignored event. */
function summary(event: unknown): Record<string, unknown> {
  const { eventType, data } = (event ?? {}) as { eventType?: unknown; data?: Record<string, unknown> };
  return { eventType, jobId: data?.jobId, runId: data?.runId, runStatus: data?.runStatus };
}

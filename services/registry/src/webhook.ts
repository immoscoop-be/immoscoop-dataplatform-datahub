import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ArtifactSets, Run } from './artifact-sets.js';
import type { DeliveryReason } from './database.js';
import type { Deliveries, DeliveryFacts } from './deliveries.js';

export interface WebhookOptions {
  /** The secret dbt Cloud signs with (datahub-dbt-webhook-secret), read when first needed. */
  secret: () => Promise<string>;
  /** The dbt Cloud account of Data Hub (DATAHUB_DBT_ACCOUNT_ID). */
  accountId: string;
  /** The Source Jobs of this environment now: job ID → dbt project ID (DEC-AR-01, FR-AR-18). */
  sourceJobs: () => Promise<ReadonlyMap<string, string>>;
  sets: Pick<ArtifactSets, 'record'>;
  /** Where every delivery is kept, with what Data Hub did with it (FR-AR-19); left out in tests that do not need it. */
  deliveries?: Pick<Deliveries, 'record'>;
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

  /** Keeps a delivery for the page Webhooks; a delivery that cannot be kept is still handled. */
  async function keep(delivery: Parameters<Deliveries['record']>[0], log: { error: (object: unknown, message: string) => void }) {
    try {
      await options.deliveries?.record(delivery);
    } catch (error) {
      log.error({ err: error }, 'a delivery of the webhook could not be kept');
    }
  }

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
      // Nothing of a delivery that is not signed is read: anyone can send to this address.
      await keep({ outcome: 'refused', reason: 'signature' }, request.log);
      return reply.code(401).send({ error: 'unauthorized', message: 'The signature does not match.' });
    }

    let event: unknown;
    try {
      event = JSON.parse(body.toString('utf8'));
    } catch {
      return reply.code(400).send({ error: 'invalid_request', message: 'The body is not JSON.' });
    }
    const facts = factsOf(event);
    const taken = classify(event, options.accountId, await options.sourceJobs());
    if ('reason' in taken) {
      request.log.info({ event: summary(event), reason: taken.reason }, 'webhook ignored: not a successful run of a Source Job');
      await keep({ ...facts, outcome: 'ignored', reason: taken.reason }, request.log);
      return reply.code(204).send();
    }
    const { run } = taken;

    const status = await options.sets.record(run);
    await keep({ ...facts, outcome: 'recorded' }, request.log);
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

/**
 * The run, if the event reports a successful run of a Source Job of this environment's account; else why
 * it is ignored (FR-AR-19). A test from dbt Cloud names no account and no project: it is no run.
 */
export function classify(event: unknown, accountId: string, sourceJobs: ReadonlyMap<string, string>): { run: Run } | { reason: DeliveryReason } {
  const { accountId: account, eventType, data } = (event ?? {}) as { accountId?: unknown; eventType?: unknown; data?: Record<string, unknown> };
  if (eventType !== 'job.run.completed' || account === undefined || data?.projectId === undefined || !/^\d+$/.test(String(data.runId))) {
    return { reason: 'notARun' };
  }
  if (String(account) !== accountId) return { reason: 'otherAccount' };
  if (data.runStatus !== 'Success') return { reason: 'notSucceeded' };
  const jobId = String(data.jobId);
  const projectId = String(data.projectId);
  const follows = sourceJobs.get(jobId);
  if (follows === undefined) return { reason: 'notSourceJob' };
  if (follows !== projectId) return { reason: 'otherProject' };
  return { run: { projectId, jobId, runId: String(data.runId) } };
}

/** What a delivery says about its job and run, as the page Webhooks shows it. */
function factsOf(event: unknown): DeliveryFacts {
  const { accountId, eventType, webhookName, data } = (event ?? {}) as { accountId?: unknown; eventType?: unknown; webhookName?: unknown; data?: Record<string, unknown> };
  const text = (value: unknown) => (value === undefined || value === null ? null : String(value).slice(0, 300));
  return {
    eventType: text(eventType),
    webhookName: text(webhookName),
    accountId: text(accountId),
    projectId: text(data?.projectId),
    jobId: text(data?.jobId),
    jobName: text(data?.jobName),
    environmentName: text(data?.environmentName),
    runId: text(data?.runId),
    runStatus: text(data?.runStatus),
    runStartedAt: text(data?.runStartedAt),
    runFinishedAt: text(data?.runFinishedAt),
  };
}

/** What the log keeps of an ignored event. */
function summary(event: unknown): Record<string, unknown> {
  const { eventType, data } = (event ?? {}) as { eventType?: unknown; data?: Record<string, unknown> };
  return { eventType, jobId: data?.jobId, runId: data?.runId, runStatus: data?.runStatus };
}

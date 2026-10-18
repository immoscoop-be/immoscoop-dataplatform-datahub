import { createHmac } from 'node:crypto';
import { createTestIssuer } from '@datahub/auth/testing';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { Run } from './artifact-sets.js';
import type { SetStatus } from './database.js';

const SECRET = 'webhook-secret';

/** A delivery as dbt Cloud sends it for a finished run. */
function event(data: Record<string, unknown> = {}, overrides: Record<string, unknown> = {}) {
  return {
    accountId: 576,
    webhookId: 'wsu_1',
    eventId: 'wev_1',
    timestamp: '2026-10-18T06:23:20Z',
    eventType: 'job.run.completed',
    webhookName: 'Data Hub uat',
    data: {
      jobId: '322951',
      jobName: 'daily UAT build (uat)',
      runId: '56757522',
      environmentId: '22845',
      projectId: '9367',
      runStatus: 'Success',
      runStatusCode: 10,
      ...data,
    },
    ...overrides,
  };
}

describe('the webhook of dbt Cloud', () => {
  let app: FastifyInstance;
  let recorded: Run[];
  let status: SetStatus;
  let started: number;
  let secretReadable: boolean;

  beforeEach(async () => {
    recorded = [];
    status = 'pending';
    started = 0;
    secretReadable = true;
    app = await buildApp({
      verifier: (await createTestIssuer()).verifier,
      logger: false,
      webhook: {
        secret: async () => {
          if (!secretReadable) {
            throw new Error('Secret version not found');
          }
          return SECRET;
        },
        accountId: '576',
        sourceJobs: new Map([
          ['322951', '9367'],
          ['739003', '17121'],
        ]),
        sets: {
          record: async (run) => {
            recorded.push(run);
            return status;
          },
        },
        startIngest: async () => {
          started++;
        },
      },
    });
  });

  afterEach(() => app.close());

  /** Sends a body as dbt Cloud would, signed with `secret`. */
  function deliver(body: unknown, secret = SECRET) {
    const payload = JSON.stringify(body);
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    return app.inject({ method: 'POST', url: '/webhooks/dbt-cloud', headers: { 'content-type': 'application/json', authorization: signature }, payload });
  }

  it('records a successful run of a Source Job and starts the ingest job, without an Access Token', async () => {
    const response = await deliver(event());
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ runId: '56757522', status: 'pending' });
    expect(recorded).toEqual([{ projectId: '9367', jobId: '322951', runId: '56757522' }]);
    expect(started).toBe(1);
  });

  it('does not start the job again for a run it has already taken', async () => {
    status = 'processing';
    expect((await deliver(event())).statusCode).toBe(202);
    expect(started).toBe(0);
  });

  it('refuses a delivery that is not signed with the secret', async () => {
    expect((await deliver(event(), 'another-secret')).statusCode).toBe(401);
    const unsigned = await app.inject({ method: 'POST', url: '/webhooks/dbt-cloud', headers: { 'content-type': 'application/json' }, payload: JSON.stringify(event()) });
    expect(unsigned.statusCode).toBe(401);
    // The signature covers the body exactly as sent: the same JSON with other spacing does not match.
    const signature = createHmac('sha256', SECRET).update(JSON.stringify(event())).digest('hex');
    const respaced = await app.inject({
      method: 'POST',
      url: '/webhooks/dbt-cloud',
      headers: { 'content-type': 'application/json', authorization: signature },
      payload: JSON.stringify(event(), null, 2),
    });
    expect(respaced.statusCode).toBe(401);
    expect(recorded).toEqual([]);
  });

  it.each([
    ['a failed run', event({ runStatus: 'Error', runStatusCode: 20 })],
    ['a run that started', event({}, { eventType: 'job.run.started' })],
    ['another job', event({ jobId: '324451' })],
    ['a Source Job of the other environment', event({ jobId: '322950', projectId: '9367' })],
    ['a job with the wrong project', event({ jobId: '739003', projectId: '9367' })],
    ['another dbt Cloud account', event({}, { accountId: 1 })],
    ['the test event of dbt Cloud', { eventType: 'job.run.completed', data: { jobId: '123', runId: '456', runStatus: 'Success' } }],
  ])('ignores %s', async (_case, body) => {
    expect((await deliver(body)).statusCode).toBe(204);
    expect(recorded).toEqual([]);
    expect(started).toBe(0);
  });

  it('records a run of the other dbt project too', async () => {
    await deliver(event({ jobId: '739003', projectId: '17121', runId: '56757384' }));
    expect(recorded).toEqual([{ projectId: '17121', jobId: '739003', runId: '56757384' }]);
  });

  it('asks dbt Cloud to try again while the secret has no value yet', async () => {
    secretReadable = false;
    expect((await deliver(event())).statusCode).toBe(503);
    expect(recorded).toEqual([]);
  });

  it('keeps every other route behind the Access Token', async () => {
    expect((await app.inject({ method: 'POST', url: '/runs/1/reprocess' })).statusCode).toBe(401);
  });
});

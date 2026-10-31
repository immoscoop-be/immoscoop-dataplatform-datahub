import { createTestIssuer, type TestIssuer } from '@datahub/auth/testing';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { DbtJob } from './dbt-cloud.js';
import type { SourceJob } from './source-jobs.js';

const job = (id: string, name: string, environmentId: string, kind: DbtJob['kind'], generatesDocs = true): DbtJob => ({
  id,
  name,
  projectId: '9367',
  environmentId,
  environmentName: environmentId === 'e-uat' ? 'UAT' : 'Production',
  kind,
  generatesDocs,
  lastRun: null,
});

const JOBS = [
  job('322951', 'daily UAT build (uat)', 'e-uat', 'scheduled'),
  job('352118', 'UAT - Deploy - Merge build', 'e-uat', 'merge'),
  job('324451', 'CI/CD - UAT - triggered by Github Pipelines', 'e-uat', 'ci', false),
  job('322950', 'daily production build (prod)', 'e-prod', 'scheduled'),
];

describe('the page Webhooks in registry (FR-AR-18, FR-AR-19)', () => {
  let issuer: TestIssuer;
  let app: FastifyInstance;
  let chosen: SourceJob | undefined;
  let dbtDown: boolean;

  beforeEach(async () => {
    issuer = await createTestIssuer();
    chosen = undefined;
    dbtDown = false;
    const list = async (): Promise<SourceJob[]> => [chosen ?? { projectId: '9367', jobId: '322951', jobName: null, setBy: null, setAt: null }];
    app = await buildApp({
      verifier: issuer.verifier,
      logger: false,
      admin: {
        configured: new Map([['322951', '9367']]),
        webhookUrl: 'https://registry.test/webhooks/dbt-cloud',
        reading: { projects: async () => [{ projectId: '9367', name: 'immoscoop_dataplatform_sql', runId: null, dbtVersion: null, generatedAt: null, processedAt: null, nodeCount: 0 }] },
        dbtCloud: {
          jobs: async () => {
            if (dbtDown) throw new Error('dbt Cloud answered 503');
            return JOBS;
          },
        },
        sourceJobs: {
          list,
          current: async () => new Map((await list()).map((source) => [source.jobId, source.projectId])),
          set: async (projectId, picked, by) => {
            chosen = { projectId, jobId: picked.id, jobName: picked.name, setBy: by.name, setAt: new Date('2026-10-31T11:40:00Z') };
            return chosen;
          },
          lastSets: async () => [{ projectId: '9367', runId: '58209931', status: 'processed', receivedAt: new Date('2026-10-31T11:52:00Z'), processedAt: new Date('2026-10-31T11:53:00Z') }],
        },
        deliveries: {
          list: async () => [
            { id: '2', receivedAt: new Date(), outcome: 'ignored', reason: 'notSourceJob', eventType: 'job.run.completed', webhookName: null, accountId: '576', projectId: '9367', jobId: '324451', jobName: 'CI/CD', environmentName: null, runId: '1', runStatus: 'Success', runStartedAt: null, runFinishedAt: null, set: null },
            { id: '1', receivedAt: new Date(), outcome: 'recorded', reason: null, eventType: 'job.run.completed', webhookName: null, accountId: '576', projectId: '9367', jobId: '322951', jobName: 'daily', environmentName: null, runId: '2', runStatus: 'Success', runStartedAt: null, runFinishedAt: null, set: { status: 'processed', error: null, processedAt: new Date(), current: true } },
          ],
          toLookAt: async () => 0,
        },
      },
    });
  });

  afterEach(() => app.close());

  async function call(method: 'GET' | 'PUT', url: string, payload?: object, roles = ['datateam']) {
    const token = await issuer.sign({ roles, sub: 'u-max', name: 'Maxime Passenier', email: 'maxime@thenextimmoscoop.be' });
    return app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...(payload ? { payload } : {}) });
  }

  it('is for the Data Team only', async () => {
    expect((await call('GET', '/admin/source-jobs', undefined, [])).statusCode).toBe(403);
    expect((await call('GET', '/admin/deliveries', undefined, [])).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/admin/deliveries' })).statusCode).toBe(401);
  });

  it('shows the Source Job of each dbt project by name, with its last set and the address of the webhook', async () => {
    const answer = (await call('GET', '/admin/source-jobs')).json();
    expect(answer.webhookUrl).toBe('https://registry.test/webhooks/dbt-cloud');
    expect(answer.projects).toEqual([
      expect.objectContaining({
        projectId: '9367',
        projectName: 'immoscoop_dataplatform_sql',
        job: { id: '322951', name: 'daily UAT build (uat)', environmentName: 'UAT', kind: 'scheduled', generatesDocs: true },
        setBy: null,
        lastSet: expect.objectContaining({ runId: '58209931', status: 'processed' }),
        dbtCloud: true,
      }),
    ]);
    // Without dbt Cloud, what Data Hub keeps itself still shows.
    dbtDown = true;
    expect((await call('GET', '/admin/source-jobs')).json().projects[0]).toMatchObject({ job: { id: '322951', name: null }, dbtCloud: false });
  });

  it('offers the jobs of a project, a CI job and a job of another environment not to be chosen', async () => {
    const answer = (await call('GET', '/admin/source-jobs/9367/jobs')).json();
    expect(answer.environment).toEqual({ id: 'e-uat', name: 'UAT' });
    expect(answer.jobs.map((one: { id: string; current: boolean; notChoosable: string | null }) => [one.id, one.current, one.notChoosable])).toEqual([
      ['322951', true, null],
      ['352118', false, null],
      ['324451', false, 'ci'],
      ['322950', false, 'otherEnvironment'],
    ]);
    expect((await call('GET', '/admin/source-jobs/5/jobs')).statusCode).toBe(404);
    dbtDown = true;
    expect((await call('GET', '/admin/source-jobs/9367/jobs')).statusCode).toBe(503);
  });

  it('makes a job of dbt Cloud the Source Job, with who set it, and refuses one that cannot be', async () => {
    const saved = await call('PUT', '/admin/source-jobs/9367', { jobId: '352118' });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({ job: { id: '352118', name: 'UAT - Deploy - Merge build', kind: 'merge' }, setBy: 'Maxime Passenier' });
    expect((await call('PUT', '/admin/source-jobs/9367', { jobId: '324451' })).json()).toMatchObject({ error: 'not_choosable', reason: 'ci' });
    expect((await call('PUT', '/admin/source-jobs/9367', { jobId: '322950' })).json()).toMatchObject({ error: 'not_choosable', reason: 'otherEnvironment' });
    expect((await call('PUT', '/admin/source-jobs/9367', { jobId: '999' })).statusCode).toBe(404);
    expect((await call('PUT', '/admin/source-jobs/9367', { jobId: 'abc' })).statusCode).toBe(400);
  });

  it('lists the deliveries, saying which came from a Source Job', async () => {
    const answer = (await call('GET', '/admin/deliveries')).json();
    expect(answer.toLookAt).toBe(0);
    expect(answer.deliveries.map((delivery: { id: string; sourceJob: boolean }) => [delivery.id, delivery.sourceJob])).toEqual([
      ['2', false],
      ['1', true],
    ]);
  });
});

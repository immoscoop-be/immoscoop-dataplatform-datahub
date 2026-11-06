import { createTestIssuer, type TestClaims, type TestIssuer } from '@datahub/auth/testing';
import { type Permissions, startingPermissions } from '@datahub/contracts';
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
  job('351870', 'UAT - Hourly freshness', 'e-uat', 'scheduled', false),
  job('322950', 'daily production build (prod)', 'e-prod', 'scheduled'),
];
const PROJECTS = [
  { id: '9367', name: 'dbt-prod' },
  { id: '15890', name: 'dbt-marketing' },
];

describe('the page Webhooks in registry (FR-AR-18, FR-AR-19)', () => {
  let issuer: TestIssuer;
  let app: FastifyInstance;
  /** The dbt projects followed, by dbt project ID, as the table source_jobs keeps them. */
  let following: Map<string, SourceJob>;
  let dbtDown: boolean;

  beforeEach(async () => {
    issuer = await createTestIssuer();
    // Taken over from the configuration: no name, nobody who set it.
    following = new Map([['9367', { projectId: '9367', jobId: '322951', jobName: null, setBy: null, setAt: null }]]);
    dbtDown = false;
    const list = async (): Promise<SourceJob[]> => [...following.values()];
    const saved = (projectId: string, picked: { id: string; name: string }, by: { name: string }): SourceJob => {
      const source = { projectId, jobId: picked.id, jobName: picked.name, setBy: by.name, setAt: new Date('2026-10-31T11:40:00Z') };
      following.set(projectId, source);
      return source;
    };
    app = await buildApp({
      verifier: issuer.verifier,
      logger: false,
      admin: {
        webhookUrl: 'https://registry.test/webhooks/dbt-cloud',
        reading: { projects: async () => [{ projectId: '9367', name: 'immoscoop_dataplatform_sql', runId: null, dbtVersion: null, generatedAt: null, processedAt: null, nodeCount: 0 }] },
        dbtCloud: {
          jobs: async (projectId) => {
            if (dbtDown) throw new Error('dbt Cloud answered 503');
            return JOBS.map((one) => ({ ...one, projectId }));
          },
          projects: async () => {
            if (dbtDown) throw new Error('dbt Cloud answered 503');
            return PROJECTS;
          },
        },
        sourceJobs: {
          list,
          current: async () => new Map((await list()).map((source) => [source.jobId, source.projectId])),
          follow: async (projectId, picked, by) => (following.has(projectId) ? null : saved(projectId, picked, by)),
          set: async (projectId, picked, by) => (following.has(projectId) ? saved(projectId, picked, by) : null),
          stop: async (projectId) => following.delete(projectId),
          lastSets: async () => [{ projectId: '9367', runId: '58209931', status: 'processed', receivedAt: new Date('2026-10-31T11:52:00Z'), processedAt: new Date('2026-10-31T11:53:00Z') }],
        },
        deliveries: {
          list: async () => [
            { id: '2', receivedAt: new Date(), outcome: 'ignored', reason: 'notSourceJob', eventType: 'job.run.completed', webhookName: null, accountId: '576', projectId: '9367', jobId: '324451', jobName: 'CI/CD', environmentName: null, runId: '1', runStatus: 'Success', runStartedAt: null, runFinishedAt: null, set: null },
            { id: '1', receivedAt: new Date(), outcome: 'recorded', reason: null, eventType: 'job.run.completed', webhookName: null, accountId: '576', projectId: '9367', jobId: '322951', jobName: 'daily', environmentName: null, runId: '2', runStatus: 'Success', runStartedAt: null, runFinishedAt: null, set: { status: 'processed', error: null, processedAt: new Date(), current: true, nodes: 4812, exposures: 18, catalogue: { applied: true, registered: 5, registeredIds: ['r-1', 'r-2', 'r-3', 'r-4', 'r-5'], renamed: 0, withdrawn: 0, back: 0 } } },
          ],
          toLookAt: async () => 0,
        },
      },
    });
  });

  afterEach(() => app.close());

  async function call(method: 'GET' | 'PUT' | 'POST' | 'DELETE', url: string, payload?: object, claims: TestClaims = { as: 'admin' }) {
    const token = await issuer.sign({ ...claims, sub: 'u-max', name: 'Maxime Passenier', email: 'maxime@thenextimmoscoop.be' });
    return app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...(payload ? { payload } : {}) });
  }

  /** A Business analyst whose group opens these tools of Admin, and no other. */
  const opening = (tools: string[]): TestClaims => {
    const permissions: Permissions = startingPermissions('businessAnalyst');
    permissions['admin.open'] = { on: true, values: { tools } };
    return { permissions };
  };

  it('is for who opens the Webhooks of Admin only (admin.open, TR-PL-06)', async () => {
    const analyst: TestClaims = { as: 'businessAnalyst' };
    const refused = await call('GET', '/admin/source-jobs', undefined, analyst);
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ error: 'forbidden', permission: 'admin.open' });
    expect((await call('POST', '/admin/source-jobs', { projectId: '15890', jobId: '352118' }, analyst)).statusCode).toBe(403);
    expect((await call('DELETE', '/admin/source-jobs/9367', undefined, analyst)).statusCode).toBe(403);
    expect((await call('GET', '/admin/deliveries', undefined, { as: 'lensUser' })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/admin/deliveries' })).statusCode).toBe(401);
    // Admin with the other tools, not Webhooks, does not; Webhooks alone does.
    expect((await call('GET', '/admin/deliveries', undefined, opening(['excelKeys', 'users', 'permissionGroups']))).statusCode).toBe(403);
    expect((await call('GET', '/admin/deliveries', undefined, opening(['webhooks']))).statusCode).toBe(200);
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

  it('names a dbt project by its manifest, or else as dbt Cloud does', async () => {
    following.set('15890', { projectId: '15890', jobId: '352118', jobName: 'UAT - Deploy - Merge build', setBy: 'Maxime Passenier', setAt: new Date() });
    const answer = (await call('GET', '/admin/source-jobs')).json();
    expect(answer.projects.map((tile: { projectId: string; projectName: string }) => [tile.projectId, tile.projectName])).toEqual([
      ['9367', 'immoscoop_dataplatform_sql'],
      ['15890', 'dbt-marketing'],
    ]);
  });

  it('offers the jobs of a project, a CI job, a job without the docs and a job of another environment not to be chosen', async () => {
    const answer = (await call('GET', '/admin/source-jobs/9367/jobs')).json();
    expect(answer.environment).toEqual({ id: 'e-uat', name: 'UAT' });
    const offered = (jobs: { id: string; current: boolean; notChoosable: string | null }[]) => jobs.map((one) => [one.id, one.current, one.notChoosable]);
    expect(offered(answer.jobs)).toEqual([
      ['322951', true, null],
      ['352118', false, null],
      ['324451', false, 'ci'],
      ['351870', false, 'noDocs'],
      ['322950', false, 'otherEnvironment'],
    ]);
    // A dbt project not followed yet: no environment, so its jobs of every environment may be the first.
    const fresh = (await call('GET', '/admin/source-jobs/15890/jobs')).json();
    expect(fresh.environment).toBeNull();
    expect(offered(fresh.jobs)).toEqual([
      ['322951', false, null],
      ['352118', false, null],
      ['324451', false, 'ci'],
      ['351870', false, 'noDocs'],
      ['322950', false, null],
    ]);
    expect((await call('GET', '/admin/source-jobs/abc/jobs')).statusCode).toBe(400);
    dbtDown = true;
    expect((await call('GET', '/admin/source-jobs/9367/jobs')).statusCode).toBe(503);
  });

  it('lists the dbt projects of the account, saying which Data Hub follows', async () => {
    expect((await call('GET', '/admin/dbt-projects')).json()).toEqual({
      projects: [
        { id: '9367', name: 'dbt-prod', following: true },
        { id: '15890', name: 'dbt-marketing', following: false },
      ],
    });
    dbtDown = true;
    expect((await call('GET', '/admin/dbt-projects')).statusCode).toBe(503);
  });

  it('follows a dbt project with a job that can be its Source Job, once (DEC-AR-10)', async () => {
    expect((await call('POST', '/admin/source-jobs', { projectId: '15890', jobId: '324451' })).json()).toMatchObject({ error: 'not_choosable', reason: 'ci' });
    expect((await call('POST', '/admin/source-jobs', { projectId: '15890', jobId: '351870' })).json()).toMatchObject({ error: 'not_choosable', reason: 'noDocs' });
    expect((await call('POST', '/admin/source-jobs', { projectId: '15890', jobId: '999' })).statusCode).toBe(404);
    expect((await call('POST', '/admin/source-jobs', { projectId: '15890' })).statusCode).toBe(400);

    const followed = await call('POST', '/admin/source-jobs', { projectId: '15890', jobId: '322950' });
    expect(followed.statusCode).toBe(201);
    expect(followed.json()).toMatchObject({ projectId: '15890', projectName: 'dbt-marketing', job: { id: '322950', environmentName: 'Production' }, setBy: 'Maxime Passenier', lastSet: null });
    expect(following.get('15890')?.jobId).toBe('322950');
    // Followed already: its Source Job is changed, not followed again.
    expect((await call('POST', '/admin/source-jobs', { projectId: '15890', jobId: '352118' })).json()).toMatchObject({ error: 'following' });
    // From then on its environment is that of its Source Job.
    expect((await call('PUT', '/admin/source-jobs/15890', { jobId: '352118' })).json()).toMatchObject({ reason: 'otherEnvironment' });
    dbtDown = true;
    expect((await call('POST', '/admin/source-jobs', { projectId: '17121', jobId: '352118' })).statusCode).toBe(503);
  });

  it('stops following a dbt project, which keeps its Resources', async () => {
    expect((await call('DELETE', '/admin/source-jobs/9367')).statusCode).toBe(204);
    expect(following.has('9367')).toBe(false);
    expect((await call('DELETE', '/admin/source-jobs/9367')).statusCode).toBe(404);
    expect((await call('GET', '/admin/source-jobs')).json().projects).toEqual([]);
    expect((await call('PUT', '/admin/source-jobs/9367', { jobId: '352118' })).statusCode).toBe(404);
  });

  it('makes a job of dbt Cloud the Source Job, with who set it, and refuses one that cannot be', async () => {
    const saved = await call('PUT', '/admin/source-jobs/9367', { jobId: '352118' });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({ job: { id: '352118', name: 'UAT - Deploy - Merge build', kind: 'merge' }, setBy: 'Maxime Passenier' });
    expect((await call('PUT', '/admin/source-jobs/9367', { jobId: '324451' })).json()).toMatchObject({ error: 'not_choosable', reason: 'ci' });
    expect((await call('PUT', '/admin/source-jobs/9367', { jobId: '322950' })).json()).toMatchObject({ error: 'not_choosable', reason: 'otherEnvironment' });
    expect((await call('PUT', '/admin/source-jobs/9367', { jobId: '351870' })).json()).toMatchObject({ error: 'not_choosable', reason: 'noDocs' });
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
    // A recorded run says what it held and what catalogue did with it (FR-AR-19).
    expect(answer.deliveries[1].set).toMatchObject({ nodes: 4812, exposures: 18, catalogue: { registered: 5 } });
  });
});

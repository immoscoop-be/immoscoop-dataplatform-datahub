import { describe, expect, it } from 'vitest';
import { createBucket } from './bucket.js';
import { createCatalogue } from './catalogue.js';
import { createDbtCloud } from './dbt-cloud.js';
import { createIngestStarter } from './ingest-job.js';
import { lazy, settingsFromEnv } from './settings.js';

const token = async () => 'access-token';

describe('catalogue', () => {
  it('is told the exposed tables with a Google ID token of registry for its own address (DEC-PF-26)', async () => {
    const calls: { url: string; authorization: string | null; body: unknown }[] = [];
    const audiences: string[] = [];
    const catalogue = createCatalogue(
      'https://catalogue.test',
      async (audience) => (audiences.push(audience), 'id-token'),
      async (url, init) => {
        calls.push({ url: String(url), authorization: new Headers(init?.headers).get('authorization'), body: JSON.parse(String(init?.body)) });
        return Response.json({ registered: 0 });
      },
    );
    await catalogue.resources({ projectId: '9367', projectName: 'p', runId: '100', generatedAt: null, tables: [] });
    expect(audiences).toEqual(['https://catalogue.test']);
    expect(calls).toEqual([{ url: 'https://catalogue.test/internal/resources', authorization: 'Bearer id-token', body: { projectId: '9367', projectName: 'p', runId: '100', generatedAt: null, tables: [] } }]);

    const refusing = createCatalogue('https://catalogue.test', async () => 't', async () => Response.json({ message: 'Not a service that may call.' }, { status: 401 }));
    await expect(refusing.resources({ projectId: '9367', projectName: null, runId: '100', generatedAt: null, tables: [] })).rejects.toThrow('catalogue answered 401: Not a service that may call.');
  });
});

describe('dbt Cloud', () => {
  it('serves the Artifacts of a run with the service token', async () => {
    const requests: { url: string; authorization: string | null }[] = [];
    const dbt = createDbtCloud({
      url: 'https://emea.dbt.com/',
      accountId: '576',
      token: async () => 'service-token',
      request: async (url, init) => {
        requests.push({ url: String(url), authorization: new Headers(init?.headers).get('authorization') });
        return new Response('{"metadata":{}}');
      },
    });
    expect(new TextDecoder().decode(await dbt.artifact('56757522', 'manifest.json'))).toBe('{"metadata":{}}');
    expect(requests).toEqual([{ url: 'https://emea.dbt.com/api/v2/accounts/576/runs/56757522/artifacts/manifest.json', authorization: 'Token service-token' }]);
  });

  it('asks again for a file that is not there yet, when told to wait, and then gives up', async () => {
    const pauses: number[] = [];
    let calls = 0;
    const dbt = createDbtCloud({
      url: 'https://emea.dbt.com',
      accountId: '576',
      token: async () => 'service-token',
      sleep: async (ms) => {
        pauses.push(ms);
      },
      request: async () => {
        calls++;
        return calls === 3 ? new Response('{}') : new Response('not found', { status: 404 });
      },
    });
    expect(await dbt.artifact('1', 'manifest.json', { wait: true })).toBeDefined();
    expect(pauses).toEqual([5_000, 10_000]);

    calls = -100;
    pauses.length = 0;
    expect(await dbt.artifact('1', 'manifest.json', { wait: true })).toBeUndefined();
    expect(pauses).toEqual([5_000, 10_000, 20_000, 40_000]);
    expect(await dbt.artifact('1', 'catalog.json')).toBeUndefined();
  });

  it('fails on anything but a file or its absence, such as a token without access', async () => {
    const dbt = createDbtCloud({
      url: 'https://emea.dbt.com',
      accountId: '576',
      token: async () => 'service-token',
      request: async () => new Response('{"status":{"user_message":"Invalid token"}}', { status: 401 }),
    });
    await expect(dbt.artifact('1', 'manifest.json')).rejects.toThrow(/did not give manifest.json of run 1: 401 .*Invalid token/);
  });
});

describe('the artifact bucket', () => {
  it('reads a file, or tells that it is not there', async () => {
    const asked: string[] = [];
    const bucket = createBucket('p-datahub-artifacts', token, async (url) => {
      asked.push(String(url));
      return String(url).includes('9367%2F1%2Fmanifest.json') ? new Response('{}') : new Response(null, { status: 404 });
    });
    expect(await bucket.read('9367/1/manifest.json')).toEqual(new TextEncoder().encode('{}'));
    expect(await bucket.read('9367/1/catalog.json')).toBeUndefined();
    expect(asked[0]).toBe('https://storage.googleapis.com/storage/v1/b/p-datahub-artifacts/o/9367%2F1%2Fmanifest.json?alt=media');
  });

  it('stores a file once and never replaces it', async () => {
    let request: { url: URL; method?: string; body?: unknown } | undefined;
    const bucket = createBucket('p-datahub-artifacts', token, async (url, init) => {
      request = { url: new URL(String(url)), method: init?.method, body: init?.body };
      return new Response(null, { status: 412 });
    });
    const data = new TextEncoder().encode('{}');
    await bucket.write('9367/1/manifest.json', data);
    expect(request?.method).toBe('POST');
    expect(request?.body).toBe(data);
    expect(Object.fromEntries(request?.url.searchParams ?? [])).toEqual({ uploadType: 'media', name: '9367/1/manifest.json', ifGenerationMatch: '0' });

    const failing = createBucket('p-datahub-artifacts', token, async () => Response.json({ error: { message: 'Permission denied' } }, { status: 403 }));
    await expect(failing.write('9367/1/manifest.json', data)).rejects.toThrow('The bucket did not store 9367/1/manifest.json: 403 Permission denied');
  });
});

describe('starting the ingest job', () => {
  it('asks Cloud Run to run the job', async () => {
    let asked = '';
    const start = createIngestStarter('projects/p/locations/europe-west1/jobs/datahub-registry-ingest', token, async (url, init) => {
      asked = `${init?.method} ${String(url)}`;
      return Response.json({ name: 'operation' });
    });
    await start();
    expect(asked).toBe('POST https://run.googleapis.com/v2/projects/p/locations/europe-west1/jobs/datahub-registry-ingest:run');
  });
});

describe('the settings', () => {
  const env = {
    DATAHUB_DBT_CLOUD_URL: 'https://emea.dbt.com',
    DATAHUB_DBT_ACCOUNT_ID: '576',
    DATAHUB_DBT_SOURCE_JOBS: '9367:322951,17121:739003',
    DATAHUB_DBT_CLOUD_TOKEN: 'projects/p/secrets/datahub-dbt-cloud-token/versions/latest',
    DATAHUB_DBT_WEBHOOK_SECRET: 'projects/p/secrets/datahub-dbt-webhook-secret/versions/latest',
    DATAHUB_ARTIFACT_BUCKET: 'p-datahub-artifacts',
    DATAHUB_INGEST_JOB: 'projects/p/locations/europe-west1/jobs/datahub-registry-ingest',
    DATAHUB_CATALOGUE_URL: 'https://catalogue.test',
  };

  it('reads the Source Jobs as job → project', () => {
    expect(settingsFromEnv(env).sourceJobs).toEqual(
      new Map([
        ['322951', '9367'],
        ['739003', '17121'],
      ]),
    );
    expect(() => settingsFromEnv({ ...env, DATAHUB_DBT_SOURCE_JOBS: '9367' })).toThrow(/expected <project>:<job>/);
    expect(() => settingsFromEnv({ ...env, DATAHUB_INGEST_JOB: '' })).toThrow('Missing environment variable DATAHUB_INGEST_JOB');
  });

  it('reads a secret once, but again after a failure', async () => {
    let reads = 0;
    const secret = lazy(async () => {
      reads++;
      if (reads === 1) {
        throw new Error('no version yet');
      }
      return 'value';
    });
    await expect(secret()).rejects.toThrow('no version yet');
    expect(await secret()).toBe('value');
    expect(await secret()).toBe('value');
    expect(reads).toBe(2);
  });
});

describe('dbt Cloud runs', () => {
  it('tells which job and project a run belongs to, and whether it succeeded', async () => {
    let asked = '';
    const dbt = createDbtCloud({
      url: 'https://emea.dbt.com',
      accountId: '576',
      token: async () => 'service-token',
      request: async (url) => {
        asked = String(url);
        return String(url).includes('/runs/1/')
          ? Response.json({ data: { id: 1, job_definition_id: 322951, project_id: 9367, status: 10 } })
          : new Response('{}', { status: 404 });
      },
    });
    expect(await dbt.run('1')).toEqual({ jobId: '322951', projectId: '9367', success: true });
    expect(asked).toBe('https://emea.dbt.com/api/v2/accounts/576/runs/1/');
    expect(await dbt.run('2')).toBeUndefined();
  });
});

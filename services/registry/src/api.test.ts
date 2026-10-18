import { createTestIssuer, type TestIssuer } from '@datahub/auth/testing';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { Run } from './artifact-sets.js';
import type { SetStatus } from './database.js';
import type { Reading } from './reading.js';

/** What the routes are asked; the queries themselves are tested against Postgres in reading.test.ts. */
function fakeReading(asked: unknown[]): Reading {
  const node = { uniqueId: 'model.p.orders', name: 'orders', resourceType: 'model', projectId: '9367', projectName: 'p', description: '', relation: null };
  return {
    projects: async () => [],
    runs: async (limit) => {
      asked.push({ runs: limit });
      return [];
    },
    search: async (query, options) => {
      asked.push({ search: query, ...options });
      return [{ ...node, matchedColumns: [] }];
    },
    node: async (id) => (id === 'model.p.orders' ? { ...node, packageName: 'p', databaseName: null, schemaName: null, tableName: null, materialized: 'view', tags: [], filePath: null, columns: [], tests: [] } : undefined),
    lineage: async (id, direction, depth) => {
      asked.push({ lineage: id, direction, depth });
      return id === 'model.p.orders' ? { direction, nodes: [{ ...node, distance: 0 }], edges: [], truncated: false } : undefined;
    },
  };
}

describe('the registry API', () => {
  let issuer: TestIssuer;
  let app: FastifyInstance;
  let asked: unknown[];
  let known: Map<string, SetStatus>;
  let recorded: Run[];
  let started: number;
  let dbtRuns: Record<string, { jobId: string; projectId: string; success: boolean }>;

  beforeEach(async () => {
    issuer = await createTestIssuer();
    asked = [];
    known = new Map([
      ['100', 'pending'],
      ['200', 'processing'],
    ]);
    recorded = [];
    started = 0;
    dbtRuns = {
      '300': { jobId: '322951', projectId: '9367', success: true },
      '301': { jobId: '322951', projectId: '9367', success: false },
      '302': { jobId: '324451', projectId: '9367', success: true },
    };
    app = await buildApp({
      verifier: issuer.verifier,
      logger: false,
      api: {
        reading: fakeReading(asked),
        sets: {
          reprocess: async (runId) => known.get(runId),
          record: async (run) => {
            recorded.push(run);
            return 'pending';
          },
        },
        dbtCloud: { run: async (runId) => dbtRuns[runId] },
        sourceJobs: new Map([['322951', '9367']]),
        startIngest: async () => {
          started++;
        },
      },
    });
  });

  afterEach(() => app.close());

  async function call(method: 'GET' | 'POST', url: string, roles = ['datateam']) {
    const token = await issuer.sign({ roles, email: 'jan@thenextimmoscoop.be' });
    return app.inject({ method, url, headers: { authorization: `Bearer ${token}` } });
  }

  it('is for the Data Team only, for now', async () => {
    expect((await app.inject({ url: '/projects' })).statusCode).toBe(401);
    const other = await call('GET', '/nodes?q=orders', []);
    expect(other.statusCode).toBe(403);
    expect(other.json().error).toBe('forbidden');
    expect((await call('GET', '/projects')).json()).toEqual({ projects: [] });
  });

  it('searches with a text, a kind of Node and a limit within bounds', async () => {
    const response = await call('GET', '/nodes?q=%20orders%20&type=source&limit=500');
    expect(response.statusCode).toBe(200);
    expect(response.json().nodes[0].name).toBe('orders');
    expect(asked).toEqual([{ search: 'orders', type: 'source', limit: 100 }]);
    expect((await call('GET', '/nodes?q=')).statusCode).toBe(400);
    expect((await call('GET', `/nodes?q=${'x'.repeat(201)}`)).statusCode).toBe(400);
    expect((await call('GET', '/nodes?q=orders&type=macro')).statusCode).toBe(400);
  });

  it('reads one Node and its lineage by its unique ID', async () => {
    expect((await call('GET', '/nodes/model.p.orders')).json().name).toBe('orders');
    expect((await call('GET', '/nodes/model.p.gone')).statusCode).toBe(404);

    const lineage = await call('GET', '/nodes/model.p.orders/lineage?direction=upstream&depth=3');
    expect(lineage.json().nodes).toHaveLength(1);
    expect((await call('GET', '/nodes/model.p.orders/lineage')).statusCode).toBe(200);
    expect(asked).toEqual([
      { lineage: 'model.p.orders', direction: 'upstream', depth: 3 },
      { lineage: 'model.p.orders', direction: 'downstream', depth: 10 },
    ]);
    expect((await call('GET', '/nodes/model.p.orders/lineage?direction=sideways')).statusCode).toBe(400);
    expect((await call('GET', '/nodes/model.p.gone/lineage')).statusCode).toBe(404);
  });

  it('lists the latest runs', async () => {
    await call('GET', '/runs?limit=5');
    await call('GET', '/runs?limit=nonsense');
    expect(asked).toEqual([{ runs: 5 }, { runs: 20 }]);
  });

  describe('processing a run again', () => {
    it('puts a known run back in the queue and starts the job', async () => {
      const response = await call('POST', '/runs/100/reprocess');
      expect(response.statusCode).toBe(202);
      expect(response.json()).toEqual({ runId: '100', status: 'pending' });
      expect(started).toBe(1);
    });

    it('does not take a run that is being processed right now', async () => {
      expect((await call('POST', '/runs/200/reprocess')).statusCode).toBe(409);
      expect(started).toBe(0);
    });

    it('checks a run it never heard of with dbt Cloud, and takes only a successful run of a Source Job', async () => {
      expect((await call('POST', '/runs/300/reprocess')).statusCode).toBe(202);
      expect(recorded).toEqual([{ runId: '300', jobId: '322951', projectId: '9367' }]);
      expect(started).toBe(1);

      expect((await call('POST', '/runs/301/reprocess')).json().error).toBe('not_a_source_run');
      expect((await call('POST', '/runs/302/reprocess')).json().error).toBe('not_a_source_run');
      expect((await call('POST', '/runs/999/reprocess')).statusCode).toBe(404);
      expect((await call('POST', '/runs/abc/reprocess')).statusCode).toBe(400);
      expect(recorded).toHaveLength(1);
    });

    it('is for the Data Team only', async () => {
      expect((await call('POST', '/runs/100/reprocess', ['admins'])).statusCode).toBe(403);
      expect(started).toBe(0);
    });
  });
});

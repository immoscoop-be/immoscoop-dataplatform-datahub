import { TokenError } from '@datahub/auth';
import { createTestIssuer } from '@datahub/auth/testing';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { layerOf } from './internal.js';
import type { Lineage, NodeSummary } from './reading.js';

const summary = (uniqueId: string, extra: Partial<NodeSummary> = {}): NodeSummary => ({
  uniqueId,
  name: uniqueId.split('.').pop()!,
  resourceType: uniqueId.split('.')[0]!,
  projectId: '9367',
  projectName: 'dbt-prod',
  description: 'what it holds',
  relation: `p.d.${uniqueId.split('.').pop()}`,
  layer: null,
  filePath: null,
  ...extra,
});

describe('the lineage around a Resource, for catalogue (DEC-AR-06)', () => {
  let app: FastifyInstance;
  let asked: unknown[];

  beforeEach(async () => {
    asked = [];
    app = await buildApp({
      verifier: (await createTestIssuer()).verifier,
      logger: false,
      internal: {
        reading: {
          async lineage(id, direction, depth): Promise<Lineage | undefined> {
            asked.push({ id, direction, depth });
            if (id !== 'model.p.weekly') {
              return undefined;
            }
            return {
              direction,
              nodes: [
                { ...summary('model.p.weekly', { filePath: 'models/marts/weekly.sql' }), distance: 0 },
                { ...summary('model.p.leads', { filePath: 'models/intermediate/leads.sql' }), distance: 1 },
                { ...summary('exposure.p.datahub'), distance: 1 },
              ],
              edges: [
                { parentId: 'model.p.weekly', childId: 'model.p.leads' },
                { parentId: 'model.p.weekly', childId: 'exposure.p.datahub' },
              ],
              truncated: false,
            };
          },
        },
        serviceCallers: {
          async verify(token) {
            if (token !== 'catalogue-id-token') {
              throw new TokenError('Service token rejected: ERR_JWS_INVALID');
            }
            return 'datahub-catalogue@project.iam.gserviceaccount.com';
          },
        },
      },
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const ask = (url: string, token = 'catalogue-id-token') => app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });

  it('gives catalogue the names, layers and projects of the models, without exposures or descriptions', async () => {
    const response = await ask('/internal/nodes/model.p.weekly/lineage?direction=downstream');
    expect(response.statusCode).toBe(200);
    expect(asked).toEqual([{ id: 'model.p.weekly', direction: 'downstream', depth: 50 }]);
    expect(response.json()).toEqual({
      direction: 'downstream',
      nodes: [
        { uniqueId: 'model.p.weekly', name: 'weekly', resourceType: 'model', layer: 'marts', projectId: '9367', projectName: 'dbt-prod', distance: 0 },
        { uniqueId: 'model.p.leads', name: 'leads', resourceType: 'model', layer: 'intermediate', projectId: '9367', projectName: 'dbt-prod', distance: 1 },
      ],
      edges: [{ parentId: 'model.p.weekly', childId: 'model.p.leads' }],
      truncated: false,
    });
  });

  it('answers only catalogue', async () => {
    expect((await ask('/internal/nodes/model.p.weekly/lineage?direction=downstream', 'someone-else')).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/internal/nodes/model.p.weekly/lineage?direction=downstream' })).statusCode).toBe(401);
    expect(asked).toEqual([]);
  });

  it('names a wrong direction and an unknown Node', async () => {
    expect((await ask('/internal/nodes/model.p.weekly/lineage?direction=sideways')).statusCode).toBe(400);
    expect((await ask('/internal/nodes/model.p.gone/lineage?direction=upstream')).statusCode).toBe(404);
  });

  it('names the layer from Colleciónes, the folder of the model, or its kind', () => {
    expect(layerOf({ layer: 'mart', filePath: 'models/generated/x.sql', resourceType: 'model' })).toBe('mart');
    expect(layerOf({ layer: null, filePath: 'models/staging/stg_leads.sql', resourceType: 'model' })).toBe('staging');
    expect(layerOf({ layer: null, filePath: 'models/top.sql', resourceType: 'model' })).toBe('model');
    expect(layerOf({ layer: null, filePath: 'seeds/lead_channels.csv', resourceType: 'seed' })).toBe('seed');
  });
});

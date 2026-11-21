import { describe, expect, it } from 'vitest';
import { createCatalogue, CatalogueUnavailable, sourceOf } from './catalogue.js';
import { CREDIT, WEEKLY_ANSWER } from './testing.js';

const BASE = 'https://catalogue.test';

/** A fetch that answers from a table of paths, and records what was asked. */
function fakeFetch(answers: Record<string, { status: number; body?: unknown }>) {
  const asked: { url: string; method: string; headers: Record<string, string>; body?: string }[] = [];
  const request = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    asked.push({ url: url.pathname, method: init?.method ?? 'GET', headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body as string | undefined });
    const answer = answers[`${init?.method ?? 'GET'} ${url.pathname}`];
    if (!answer) throw new Error('no answer');
    return new Response(answer.body === undefined ? null : JSON.stringify(answer.body), { status: answer.status });
  }) as typeof fetch;
  return { request, asked };
}

describe('a Resource as the EDA sees it, from catalogue (TR-ED-01)', () => {
  it('maps its fields in the order of the Resource Card, with Key Fields, roles, grain and mappings, and keeps its table and partitions', () => {
    expect(sourceOf(WEEKLY_ANSWER)).toEqual({
      resource: {
        id: WEEKLY_ANSWER.id,
        displayName: 'Weekly lead volume',
        modelType: 'aggregate',
        level: 3,
        fields: [
          { name: 'week_start', dataType: 'DATE', keyField: true, role: 'period', grain: true, mapped: false },
          { name: 'lead_source', dataType: 'STRING', keyField: true, role: 'groupedBy', grain: true, mapped: true },
          { name: 'lead_count', dataType: 'INT64', keyField: true, role: 'addsUp', grain: false, mapped: false },
          { name: 'lead_channel', dataType: 'STRING', keyField: true, role: null, grain: false, mapped: false },
          { name: 'lead_origin', dataType: 'STRING', keyField: false, role: null, grain: false, mapped: false },
          { name: 'unique_applicants', dataType: 'INT64', keyField: false, role: 'uniqueCount', grain: false, mapped: false },
          { name: 'loaded_at', dataType: 'TIMESTAMP', keyField: false, role: null, grain: false, mapped: false },
        ],
      },
      collectionId: CREDIT.id,
      fullName: 'immoscoop-dataplatform.dbt_prod_stacks.Weekly_Lead_Volume',
      partition: { field: 'week_start', unit: 'day' },
      partitionFilter: 'dataHub',
      explored: false,
    });
  });

  it('reads a Resource without details yet: no model type, no partition, its Key as its full name', () => {
    const { details: _details, card: _card, fullName: _fullName, explored: _explored, ...bare } = WEEKLY_ANSWER;
    const source = sourceOf(bare);
    expect(source).toMatchObject({ fullName: WEEKLY_ANSWER.key, partition: null, partitionFilter: 'none', explored: null });
    expect(source.resource.modelType).toBeNull();
    expect(source.resource.fields.every((field) => !field.keyField && !field.grain && field.role === null)).toBe(true);
  });

  it('asks with the token of the User, and takes what they may not see as not found', async () => {
    const { request, asked } = fakeFetch({
      [`GET /resources/${WEEKLY_ANSWER.id}`]: { status: 200, body: { resource: { ...WEEKLY_ANSWER, canEdit: true } } },
      'GET /resources/hidden': { status: 404, body: { error: 'not_found' } },
      [`GET /collections/${CREDIT.id}`]: { status: 200, body: { ...CREDIT, resources: [] } },
      'GET /collections': {
        status: 200,
        body: {
          collections: [
            {
              ...CREDIT,
              resources: [
                { id: 'r1', displayName: 'Weekly lead volume', level: 3 },
                { id: 'r2', displayName: 'Old leads', level: 3, withdrawn: true },
              ],
            },
          ],
        },
      },
      'GET /resources/broken': { status: 500 },
    });
    const catalogue = createCatalogue(BASE, request);
    expect((await catalogue.resource(WEEKLY_ANSWER.id, 'Bearer an'))?.resource.displayName).toBe('Weekly lead volume');
    expect(asked[0]?.headers).toEqual({ authorization: 'Bearer an' });
    expect(await catalogue.resource('hidden', 'Bearer an')).toBeNull();
    expect(await catalogue.collectionName(CREDIT.id, 'Bearer an')).toBe('Credit leads');
    expect(await catalogue.seen('Bearer an')).toEqual([{ id: 'r1', displayName: 'Weekly lead volume', level: 3, collection: CREDIT }]);
    await expect(catalogue.resource('broken', 'Bearer an')).rejects.toThrow(CatalogueUnavailable);
  });

  it('tells catalogue an EDA is Explored as eda itself, with its Google ID token for catalogue’s address (TR-ED-05)', async () => {
    const { request, asked } = fakeFetch({ [`POST /internal/resources/${WEEKLY_ANSWER.id}/eda`]: { status: 200, body: { explored: true, level: 4 } } });
    const audiences: string[] = [];
    const catalogue = createCatalogue(BASE, request, async (audience) => {
      audiences.push(audience);
      return 'eda-id-token';
    });
    await catalogue.explored(WEEKLY_ANSWER.id);
    expect(audiences).toEqual([BASE]);
    expect(asked[0]).toMatchObject({ method: 'POST', headers: { authorization: 'Bearer eda-id-token' }, body: '{"explored":true}' });
    await expect(createCatalogue(BASE, request).explored(WEEKLY_ANSWER.id)).rejects.toThrow(CatalogueUnavailable);
    const refused = fakeFetch({ [`POST /internal/resources/${WEEKLY_ANSWER.id}/eda`]: { status: 401 } });
    await expect(createCatalogue(BASE, refused.request, async () => 'x').explored(WEEKLY_ANSWER.id)).rejects.toThrow(CatalogueUnavailable);
  });
});

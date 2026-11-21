import { describe, expect, it } from 'vitest';
import { createQuery, QueryRefused, QueryUnavailable } from './query.js';

const RESOURCE = '6f1c2b4e-8a1d-4c3e-9f20-1b2c3d4e5f60';

function answering(status: number, body: unknown) {
  const asked: { url: string; init?: RequestInit }[] = [];
  const request = (async (input: string | URL | Request, init?: RequestInit) => {
    asked.push({ url: String(input), init });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { request, asked };
}

describe('query runs an EDA-Probe as the User (TR-ED-04)', () => {
  it('posts the probe, its SQL and the approval with the token of the User, and takes 201 for ran and 200 for the rest', async () => {
    const ran = { state: 'ran', rows: [{ row_count: '3' }], bytes: 1000, runId: 'q-20261121-4c2e1a' };
    const { request, asked } = answering(201, ran);
    const run = { probe: 'nullsPerKeyField' as const, sql: 'select 1', approve: true };
    expect(await createQuery('https://query.test', request).run(RESOURCE, run, 'Bearer an')).toEqual(ran);
    expect(asked[0]?.url).toBe(`https://query.test/resources/${RESOURCE}/eda/runs`);
    expect(asked[0]?.init).toMatchObject({ method: 'POST', headers: { authorization: 'Bearer an', 'content-type': 'application/json' }, body: JSON.stringify(run) });
    const approve = answering(200, { state: 'approve', bytes: 300_000_000 });
    expect(await createQuery('https://query.test', approve.request).run(RESOURCE, run, 'Bearer an')).toEqual({ state: 'approve', bytes: 300_000_000 });
  });

  it('passes on what query refuses the User, and takes anything else it answers as unavailable', async () => {
    const hidden = answering(404, { error: 'not_found', message: 'There is no such Resource, or you may not see it.' });
    await expect(createQuery('https://query.test', hidden.request).run(RESOURCE, { probe: 'grainHolds', sql: 'x' }, 'Bearer an')).rejects.toEqual(
      new QueryRefused(404, 'There is no such Resource, or you may not see it.'),
    );
    const broken = answering(503, { error: 'unavailable' });
    await expect(createQuery('https://query.test', broken.request).run(RESOURCE, { probe: 'grainHolds', sql: 'x' }, 'Bearer an')).rejects.toThrow(QueryUnavailable);
    const silent = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    await expect(createQuery('https://query.test', silent).run(RESOURCE, { probe: 'grainHolds', sql: 'x' }, 'Bearer an')).rejects.toThrow(QueryUnavailable);
  });
});

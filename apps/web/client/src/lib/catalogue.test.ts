import { describe, expect, it } from 'vitest';
import { NotFound, SignedOut } from './api.js';
import { createCatalogue } from './catalogue.js';

const config = { identityUrl: 'https://identity.test', catalogueUrl: 'https://catalogue.test', registryUrl: 'https://registry.test', queryUrl: 'https://query.test', semgraphUrl: 'https://semgraph.test' };

function answering(answer: (url: string) => Response) {
  const asked: { url: string; authorization: string | null }[] = [];
  const catalogue = createCatalogue(config, { accessToken: async () => 'a-1' }, (async (input: string | URL | Request, init?: RequestInit) => {
    asked.push({ url: String(input), authorization: new Headers(init?.headers).get('authorization') });
    return answer(String(input));
  }) as typeof fetch);
  return { catalogue, asked };
}

describe('the calls of the page to catalogue', () => {
  it('reads the Resources that wait for a Collection, one Resource and its Log, with the Access Token', async () => {
    const { catalogue, asked } = answering((url) =>
      url.endsWith('collection=none')
        ? Response.json({ resources: [{ id: 'r1', displayName: 'Saved searches' }] })
        : url.endsWith('/log')
          ? Response.json({ entries: [{ logId: 'RES-001', params: { exposure: 'x' }, at: '2026-10-26T06:12:00Z' }] })
          : Response.json({ resource: { id: 'r1', fields: [] } }),
    );
    expect((await catalogue.waiting())[0]?.displayName).toBe('Saved searches');
    expect((await catalogue.resource('r1')).fields).toEqual([]);
    expect((await catalogue.log('r1'))[0]?.logId).toBe('RES-001');
    expect(asked).toEqual([
      { url: 'https://catalogue.test/resources?collection=none', authorization: 'Bearer a-1' },
      { url: 'https://catalogue.test/resources/r1', authorization: 'Bearer a-1' },
      { url: 'https://catalogue.test/resources/r1/log', authorization: 'Bearer a-1' },
    ]);
  });

  it('tells apart what does not exist, an ended session and a failure', async () => {
    await expect(answering(() => Response.json({}, { status: 404 })).catalogue.resource('gone')).rejects.toBeInstanceOf(NotFound);
    await expect(answering(() => Response.json({}, { status: 401 })).catalogue.waiting()).rejects.toBeInstanceOf(SignedOut);
    await expect(answering(() => new Response('', { status: 503 })).catalogue.waiting()).rejects.toThrow('catalogue answered 503 to GET /resources?collection=none');
  });
});

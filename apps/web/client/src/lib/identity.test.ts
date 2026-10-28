import { describe, expect, it } from 'vitest';
import { createIdentity, SignedOut } from './identity.js';

const config = { identityUrl: 'https://identity.test', catalogueUrl: 'https://catalogue.test', registryUrl: 'https://registry.test', semgraphUrl: 'https://semgraph.test' };

describe('the calls of the page to identity', () => {
  it('reads who the User is, their groups and their settings, and writes a setting, with the Access Token', async () => {
    const asked: { method: string; url: string; authorization: string | null; type: string | null; body?: unknown }[] = [];
    const identity = createIdentity(config, { accessToken: async () => 'a-1' }, (async (input: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      asked.push({
        method: init?.method ?? 'GET',
        url: String(input),
        authorization: headers.get('authorization'),
        type: headers.get('content-type'),
        ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}),
      });
      if (init?.method === 'PUT' || init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      return Response.json({ sub: 's', groups: [{ id: 'g', email: 'sales@thenextimmoscoop.be', name: 'Sales' }], settings: { language: 'en' } });
    }) as typeof fetch);
    await identity.me();
    expect(await identity.groups()).toEqual([{ id: 'g', email: 'sales@thenextimmoscoop.be', name: 'Sales' }]);
    expect(await identity.settings()).toEqual({ language: 'en' });
    await identity.saveSetting('background.dark', 'aurora');
    await identity.removeSetting('theme');
    expect(asked).toEqual([
      { method: 'GET', url: 'https://identity.test/me', authorization: 'Bearer a-1', type: null },
      { method: 'GET', url: 'https://identity.test/me/groups', authorization: 'Bearer a-1', type: null },
      { method: 'GET', url: 'https://identity.test/me/settings', authorization: 'Bearer a-1', type: null },
      { method: 'PUT', url: 'https://identity.test/me/settings/background.dark', authorization: 'Bearer a-1', type: 'application/json', body: { value: 'aurora' } },
      { method: 'DELETE', url: 'https://identity.test/me/settings/theme', authorization: 'Bearer a-1', type: null },
    ]);
  });

  it('tells a session that ended apart from a refusal', async () => {
    await expect(createIdentity(config, { accessToken: async () => null }).me()).rejects.toBeInstanceOf(SignedOut);
    const answering = (response: Response) => createIdentity(config, { accessToken: async () => 'a-1' }, (async () => response) as typeof fetch);
    await expect(answering(Response.json({}, { status: 401 })).settings()).rejects.toBeInstanceOf(SignedOut);
    await expect(answering(new Response('Bad gateway', { status: 502 })).groups()).rejects.toThrow('identity answered 502 to GET /me/groups');
  });
});

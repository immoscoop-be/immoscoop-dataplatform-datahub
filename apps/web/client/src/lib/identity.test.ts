import { describe, expect, it } from 'vitest';
import { createIdentity, SignedOut } from './identity.js';

/** A Group as identity lists it (FR-UM-18). */
const SALES = { id: 'g', name: 'Sales', sentence: '', managedBy: { id: 'g', name: 'Sales', isMember: true }, memberCount: 3, isMember: true, mayChange: true };

const config = { identityUrl: 'https://identity.test', catalogueUrl: 'https://catalogue.test', registryUrl: 'https://registry.test', queryUrl: 'https://query.test', semgraphUrl: 'https://semgraph.test' };

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
      return Response.json({ sub: 's', groups: [SALES], settings: { language: 'en' } });
    }) as typeof fetch);
    await identity.me();
    expect(await identity.groups()).toEqual([SALES]);
    expect(await identity.settings()).toEqual({ language: 'en' });
    await identity.saveSetting('background.dark', 'borealis');
    await identity.removeSetting('panel.open');
    expect(asked).toEqual([
      { method: 'GET', url: 'https://identity.test/me', authorization: 'Bearer a-1', type: null },
      { method: 'GET', url: 'https://identity.test/me/groups', authorization: 'Bearer a-1', type: null },
      { method: 'GET', url: 'https://identity.test/me/settings', authorization: 'Bearer a-1', type: null },
      { method: 'PUT', url: 'https://identity.test/me/settings/background.dark', authorization: 'Bearer a-1', type: 'application/json', body: { value: 'borealis' } },
      { method: 'DELETE', url: 'https://identity.test/me/settings/panel.open', authorization: 'Bearer a-1', type: null },
    ]);
  });

  it('reads, makes and changes the Groups kept in Data Hub, and suggests colleagues (FR-UM-13 to FR-UM-16, FR-UM-18)', async () => {
    const asked: { method: string; url: string; body?: unknown }[] = [];
    const identity = createIdentity(config, { accessToken: async () => 'a-1' }, (async (input: string | URL | Request, init?: RequestInit) => {
      asked.push({ method: init?.method ?? 'GET', url: String(input), ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
      if (String(input).includes('/people')) return Response.json({ people: [{ email: 'an.claes@immoscoop.be', name: 'An Claes' }] });
      if (init?.method === 'DELETE' && String(input).endsWith('/groups/g')) return new Response(null, { status: 204 });
      return Response.json({ group: { ...SALES, members: [], manages: [], log: [] }, groups: [SALES] });
    }) as typeof fetch);
    expect(await identity.allGroups()).toEqual([SALES]);
    expect((await identity.group('g')).name).toBe('Sales');
    await identity.makeGroup({ name: 'Sales', sentence: 'Who sells', managedBy: 'itself' });
    await identity.changeGroup('g', { managedBy: 'g-sm' });
    await identity.addMember('g', 'joke.vermeulen@immoscoop.be');
    await identity.removeMember('g', 'joke+test@immoscoop.be');
    await identity.deleteGroup('g');
    expect(await identity.people('an cl')).toEqual([{ email: 'an.claes@immoscoop.be', name: 'An Claes' }]);
    expect(asked).toEqual([
      { method: 'GET', url: 'https://identity.test/groups' },
      { method: 'GET', url: 'https://identity.test/groups/g' },
      { method: 'POST', url: 'https://identity.test/groups', body: { name: 'Sales', sentence: 'Who sells', managedBy: 'itself' } },
      { method: 'PATCH', url: 'https://identity.test/groups/g', body: { managedBy: 'g-sm' } },
      { method: 'PUT', url: 'https://identity.test/groups/g/members', body: { email: 'joke.vermeulen@immoscoop.be' } },
      { method: 'DELETE', url: 'https://identity.test/groups/g/members/joke%2Btest%40immoscoop.be' },
      { method: 'DELETE', url: 'https://identity.test/groups/g' },
      { method: 'GET', url: 'https://identity.test/people?q=an+cl' },
    ]);
  });

  it('tells a session that ended apart from a refusal', async () => {
    await expect(createIdentity(config, { accessToken: async () => null }).me()).rejects.toBeInstanceOf(SignedOut);
    const answering = (response: Response) => createIdentity(config, { accessToken: async () => 'a-1' }, (async () => response) as typeof fetch);
    await expect(answering(Response.json({}, { status: 401 })).settings()).rejects.toBeInstanceOf(SignedOut);
    await expect(answering(new Response('Bad gateway', { status: 502 })).groups()).rejects.toThrow('identity answered 502 to GET /me/groups');
  });
});

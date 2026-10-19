import { describe, expect, it } from 'vitest';
import { createApi, ServiceError, SignedOut } from './api.js';
import { createSession, explain, SignInProblem } from './session.js';

/** The server of the web app, answering /auth/token with the given responses in turn. */
function server(...responses: (() => Response)[]) {
  const calls: string[] = [];
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${String(input)}`);
    const next = responses.shift();
    return next ? next() : Response.json({ error: 'signed_out' }, { status: 401 });
  }) as typeof globalThis.fetch;
  return { calls, fetch };
}

const token = (value: string) => () => Response.json({ access_token: value, expires_in: 900 });

describe('the session of the page', () => {
  it('keeps the Access Token until a minute before it expires', async () => {
    let time = 0;
    const { calls, fetch } = server(token('a-1'), token('a-2'));
    const session = createSession({ fetch, now: () => time });
    expect(await session.accessToken()).toBe('a-1');
    time = 839_000;
    expect(await session.accessToken()).toBe('a-1');
    time = 840_000;
    expect(await session.accessToken()).toBe('a-2');
    expect(calls).toEqual(['POST /auth/token', 'POST /auth/token']);
  });

  it('tries once more when another tab renewed at the same moment', async () => {
    const pauses: number[] = [];
    const { fetch } = server(() => Response.json({ error: 'renewal_refused' }, { status: 401 }), token('a-1'));
    const session = createSession({ fetch, sleep: async (ms) => void pauses.push(ms) });
    expect(await session.accessToken()).toBe('a-1');
    expect(pauses).toEqual([1000]);
  });

  it('has no Access Token without a session', async () => {
    expect(await createSession({ fetch: server().fetch }).accessToken()).toBeNull();
  });

  it('keeps the session when Google or a server could not answer', async () => {
    const unavailable = createSession({ fetch: server(() => Response.json({ error: 'temporarily_unavailable' }, { status: 503 })).fetch });
    await expect(unavailable.accessToken()).rejects.toEqual(new SignInProblem('temporarily_unavailable'));
    const broken = createSession({ fetch: server(() => new Response('<html>Bad gateway</html>', { status: 502 })).fetch });
    await expect(broken.accessToken()).rejects.toBeInstanceOf(SignInProblem);
  });

  it('signs out through the server, and forgets the Access Token', async () => {
    const { calls, fetch } = server(token('a-1'), () => new Response(null, { status: 204 }));
    const session = createSession({ fetch });
    await session.accessToken();
    await session.signOut();
    expect(await session.accessToken()).toBeNull();
    expect(calls).toEqual(['POST /auth/token', 'POST /auth/logout', 'POST /auth/token']);
  });

  it('explains every sign-in problem, also one it does not know', () => {
    expect(explain('access_denied')).toBe('Only active accounts of the company can sign in.');
    expect(explain('something_new')).toBe('Signing in did not work (something_new).');
  });
});

describe('the calls to the services', () => {
  const config = { identityUrl: 'https://identity.test', catalogueUrl: 'https://catalogue.test', registryUrl: 'https://registry.test', semgraphUrl: 'https://semgraph.test' };

  it('calls identity and registry with the Access Token, with IDs and texts escaped', async () => {
    const asked: { url: string; authorization: string | null }[] = [];
    const api = createApi(config, { accessToken: async () => 'a-1' }, (async (input: string | URL | Request, init?: RequestInit) => {
      asked.push({ url: String(input), authorization: new Headers(init?.headers).get('authorization') });
      return Response.json(String(input).includes('/nodes?') ? { nodes: [] } : {});
    }) as typeof fetch);
    await api.me();
    await api.search('orders & co');
    await api.search('orders', '17121');
    await api.lineage('model.p.my model', 'upstream');
    expect(asked).toEqual([
      { url: 'https://identity.test/me', authorization: 'Bearer a-1' },
      { url: 'https://registry.test/nodes?q=orders%20%26%20co', authorization: 'Bearer a-1' },
      { url: 'https://registry.test/nodes?q=orders&project=17121', authorization: 'Bearer a-1' },
      { url: 'https://registry.test/nodes/model.p.my%20model/lineage?direction=upstream', authorization: 'Bearer a-1' },
    ]);
  });

  it('reads, creates, changes and dissolves Collections at catalogue, and the groups of the User at identity', async () => {
    const asked: { method: string; url: string; authorization: string | null; type: string | null; body?: unknown }[] = [];
    const api = createApi(config, { accessToken: async () => 'a-1' }, (async (input: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      asked.push({
        method: init?.method ?? 'GET',
        url: String(input),
        authorization: headers.get('authorization'),
        type: headers.get('content-type'),
        ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}),
      });
      if (init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      return Response.json({ groups: [], collections: [], entries: [] });
    }) as typeof fetch);
    const fields = { name: 'Leads', description: 'Leads.', colour: 'rose' as const, icon: 'users' as const, ownerUnit: 'g-1', visibility: 'private' as const };
    await api.groups();
    await api.collections();
    await api.createCollection(fields);
    await api.changeCollection('c 1', { visibility: 'public' });
    await api.collectionLog('c 1');
    expect(await api.dissolveCollection('c 1')).toBeUndefined();
    expect(asked).toEqual([
      { method: 'GET', url: 'https://identity.test/me/groups', authorization: 'Bearer a-1', type: null },
      { method: 'GET', url: 'https://catalogue.test/collections', authorization: 'Bearer a-1', type: null },
      { method: 'POST', url: 'https://catalogue.test/collections', authorization: 'Bearer a-1', type: 'application/json', body: fields },
      { method: 'PATCH', url: 'https://catalogue.test/collections/c%201', authorization: 'Bearer a-1', type: 'application/json', body: { visibility: 'public' } },
      { method: 'GET', url: 'https://catalogue.test/collections/c%201/log', authorization: 'Bearer a-1', type: null },
      { method: 'DELETE', url: 'https://catalogue.test/collections/c%201', authorization: 'Bearer a-1', type: null },
    ]);
  });

  it('tells a missing session apart from a refusal, with the message of the service', async () => {
    const signedOut = createApi(config, { accessToken: async () => null });
    await expect(signedOut.projects()).rejects.toBeInstanceOf(SignedOut);

    const answering = (response: Response) => createApi(config, { accessToken: async () => 'a-1' }, (async () => response) as typeof fetch);
    await expect(answering(Response.json({}, { status: 401 })).projects()).rejects.toBeInstanceOf(SignedOut);
    await expect(answering(Response.json({ error: 'forbidden', message: 'Only the Data Team may read the registry for now.' }, { status: 403 })).projects()).rejects.toEqual(
      new ServiceError(403, 'Only the Data Team may read the registry for now.'),
    );
    await expect(answering(new Response('Bad gateway', { status: 502 })).node('x')).rejects.toThrow('registry answered 502.');
  });

  it('calls semgraph without Access Token, as it is open to everyone, and tells why it refuses', async () => {
    const asked: { url: string; authorization: string | null }[] = [];
    const tokens: string[] = [];
    const api = createApi(config, { accessToken: async () => (tokens.push('asked'), 'a-1') }, (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      asked.push({ url, authorization: new Headers(init?.headers).get('authorization') });
      if (url.includes('/examples/')) {
        return Response.json({ outcome: 'refused', issues: [{ level: 'caution', message: 'Few observations.' }, { level: 'refusal', message: 'Say how unique counts were counted.' }] }, { status: 422 });
      }
      if (url.endsWith('/semgraphs/nothing')) {
        return Response.json({ outcome: 'invalid', issues: [{ level: 'inputError', message: 'There is no semgraph nothing.' }] }, { status: 404 });
      }
      return Response.json({ semgraphs: [], planned: [] });
    }) as typeof fetch);
    expect(await api.charts()).toEqual({ semgraphs: [], planned: [] });
    expect(await api.refusal('/semgraphs/kpiTile/examples/unique?theme=dark')).toBe('Say how unique counts were counted.');
    await expect(api.chart('nothing')).rejects.toEqual(new ServiceError(404, 'There is no semgraph nothing.'));
    expect(asked.map((call) => call.url)).toEqual([
      'https://semgraph.test/semgraphs',
      'https://semgraph.test/semgraphs/kpiTile/examples/unique?theme=dark',
      'https://semgraph.test/semgraphs/nothing',
    ]);
    expect(asked.every((call) => call.authorization === null)).toBe(true);
    expect(tokens).toEqual([]);
  });
});

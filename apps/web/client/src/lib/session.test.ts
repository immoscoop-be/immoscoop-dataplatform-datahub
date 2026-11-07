import { describe, expect, it } from 'vitest';
import { createSession, SignInProblem } from './session.js';

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

describe('the session of the page (TR-PF-27)', () => {
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
});

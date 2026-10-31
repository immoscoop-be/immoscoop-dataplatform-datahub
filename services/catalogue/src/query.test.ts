import { describe, expect, it } from 'vitest';
import { createQueryService, QueryUnavailable } from './query.js';

describe('asking query to check what reads the Resources that changed (FR-SR-52)', () => {
  const answering = (status: number, asked: { url: string; authorization: string | null; body: unknown }[]) =>
    (async (input: string | URL | Request, init?: RequestInit) => {
      asked.push({ url: String(input), authorization: new Headers(init?.headers).get('authorization'), body: JSON.parse(String(init?.body)) });
      return new Response('{}', { status, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

  it('asks as catalogue, with an ID token for the address of query, and not at all for no Resource', async () => {
    const asked: { url: string; authorization: string | null; body: unknown }[] = [];
    const query = createQueryService('https://query.example', async (audience) => `token-for-${audience}`, answering(200, asked));
    await query.check([]);
    await query.check(['6f1c2b4e-8a1d-4c3e-9f20-1b2c3d4e5f60']);
    expect(asked).toEqual([
      { url: 'https://query.example/internal/checks', authorization: 'Bearer token-for-https://query.example', body: { resources: ['6f1c2b4e-8a1d-4c3e-9f20-1b2c3d4e5f60'] } },
    ]);
  });

  it('says when query fails', async () => {
    const query = createQueryService('https://query.example', async () => 'token', answering(503, []));
    await expect(query.check(['6f1c2b4e-8a1d-4c3e-9f20-1b2c3d4e5f60'])).rejects.toBeInstanceOf(QueryUnavailable);
  });
});

import { describe, expect, it } from 'vitest';
import { createRegistry, RegistryUnavailable } from './registry.js';

describe('asking registry the lineage around a Resource (DEC-AR-06)', () => {
  const answering = (status: number, body: unknown, asked: { url: string; authorization: string | null }[]) =>
    (async (input: string | URL | Request, init?: RequestInit) => {
      asked.push({ url: String(input), authorization: new Headers(init?.headers).get('authorization') });
      return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

  it('asks as catalogue, with an ID token for the address of registry', async () => {
    const asked: { url: string; authorization: string | null }[] = [];
    const lineage = { direction: 'upstream', nodes: [], edges: [], truncated: false };
    const registry = createRegistry('https://registry.example', async (audience) => `token-for-${audience}`, answering(200, lineage, asked));
    expect(await registry.lineage('model.p.a b', 'upstream')).toEqual(lineage);
    expect(asked).toEqual([{ url: 'https://registry.example/internal/nodes/model.p.a%20b/lineage?direction=upstream', authorization: 'Bearer token-for-https://registry.example' }]);
  });

  it('knows no lineage for a Node no Current Version holds, and says when registry fails', async () => {
    const registry = (status: number) => createRegistry('https://registry.example', async () => 'token', answering(status, {}, []));
    expect(await registry(404).lineage('model.p.gone', 'downstream')).toBeUndefined();
    await expect(registry(503).lineage('model.p.a', 'downstream')).rejects.toBeInstanceOf(RegistryUnavailable);
  });
});

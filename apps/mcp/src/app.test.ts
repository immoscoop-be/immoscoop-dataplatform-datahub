import { createTestIssuer, type TestIssuer } from '@datahub/auth/testing';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const RESOURCE = 'https://mcp.test/mcp';
const IDENTITY = 'https://identity.test';

let issuer: TestIssuer;
let app: FastifyInstance;

beforeAll(async () => {
  issuer = await createTestIssuer();
  app = await buildApp({ verifier: issuer.verifier, resource: RESOURCE, authorizationServer: IDENTITY, logger: false });
});

afterAll(() => app.close());

/** One JSON-RPC call over Streamable HTTP, as Claude makes it. */
async function call(method: string, params: Record<string, unknown>, token?: string) {
  return app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    payload: { jsonrpc: '2.0', id: 1, method, params },
  });
}

describe('mcp', () => {
  it('tells MCP clients that identity is where they sign in', async () => {
    for (const url of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
      const response = await app.inject({ url });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ resource: RESOURCE, authorization_servers: [IDENTITY] });
    }
  });

  it('answers without a token with where to find that', async () => {
    const response = await call('tools/list', {});
    expect(response.statusCode).toBe(401);
    expect(response.headers['www-authenticate']).toBe('Bearer resource_metadata="https://mcp.test/.well-known/oauth-protected-resource/mcp"');
  });

  it('starts an MCP conversation for a signed-in User', async () => {
    const response = await call(
      'initialize',
      { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } },
      await issuer.sign(),
    );
    expect(response.statusCode).toBe(200);
    expect(response.json().result.serverInfo).toMatchObject({ name: 'datahub' });
  });

  it('offers who_am_i, which answers as the User of the token', async () => {
    const token = await issuer.sign({ name: 'Jan Peeters', email: 'jan@thenextimmoscoop.be', groups: ['g1'], roles: ['datateam'] });
    const tools = (await call('tools/list', {}, token)).json().result.tools;
    expect(tools.map((tool: { name: string }) => tool.name)).toEqual(['who_am_i']);

    const result = (await call('tools/call', { name: 'who_am_i', arguments: {} }, token)).json().result;
    expect(result.structuredContent).toEqual({ name: 'Jan Peeters', email: 'jan@thenextimmoscoop.be', groups: ['g1'], roles: ['datateam'] });
  });

  it('has no sessions to open with GET or close with DELETE', async () => {
    const token = await issuer.sign();
    for (const method of ['GET', 'DELETE'] as const) {
      const response = await app.inject({ method, url: '/mcp', headers: { authorization: `Bearer ${token}` } });
      expect(response.statusCode).toBe(405);
    }
  });
});

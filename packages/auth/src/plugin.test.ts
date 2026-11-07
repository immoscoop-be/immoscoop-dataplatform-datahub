import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authPlugin } from './plugin.js';
import { createTestIssuer, type TestIssuer } from './testing.js';

let issuer: TestIssuer;
let app: FastifyInstance;

beforeAll(async () => {
  issuer = await createTestIssuer();
  app = Fastify();
  await app.register(authPlugin, { verifier: issuer.verifier });
  app.get('/open', { config: { public: true } }, async () => ({ open: true }));
  app.get('/whoami', async (request) => ({ sub: request.user?.sub }));
  await app.ready();
});

afterAll(() => app.close());

describe('authPlugin', () => {
  it('lets anyone reach a public route', async () => {
    const response = await app.inject({ url: '/open' });
    expect(response.statusCode).toBe(200);
  });

  it('protects every other route by default', async () => {
    const response = await app.inject({ url: '/whoami' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'unauthorized', message: 'An access token is required.' });
  });

  it('rejects an invalid token', async () => {
    const response = await app.inject({ url: '/whoami', headers: { authorization: 'Bearer nonsense' } });
    expect(response.statusCode).toBe(401);
    expect(response.json().message).toBe('The access token is not valid.');
  });

  it('passes the claims of a valid token to the route', async () => {
    const token = await issuer.sign({ sub: 'google-7' });
    const response = await app.inject({ url: '/whoami', headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ sub: 'google-7' });
  });

  it('answers 401, not 404, for an unknown route without a token', async () => {
    const response = await app.inject({ url: '/does-not-exist' });
    expect(response.statusCode).toBe(401);
  });

  it('answers 404 for an unknown route with a valid token', async () => {
    const token = await issuer.sign();
    const response = await app.inject({ url: '/does-not-exist', headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(404);
  });

  it('tells the client where to sign in, on a 401 only, when asked to', async () => {
    const withChallenge = Fastify();
    await withChallenge.register(authPlugin, { verifier: issuer.verifier, challenge: 'Bearer resource_metadata="https://mcp.test/meta"' });
    withChallenge.get('/whoami', async (request) => ({ sub: request.user?.sub }));

    const denied = await withChallenge.inject({ url: '/whoami' });
    expect(denied.statusCode).toBe(401);
    expect(denied.headers['www-authenticate']).toBe('Bearer resource_metadata="https://mcp.test/meta"');
    const allowed = await withChallenge.inject({ url: '/whoami', headers: { authorization: `Bearer ${await issuer.sign()}` } });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.headers['www-authenticate']).toBeUndefined();
    expect((await app.inject({ url: '/whoami' })).headers['www-authenticate']).toBeUndefined();
    await withChallenge.close();
  });
});

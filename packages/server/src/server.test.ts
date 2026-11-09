import { createTestIssuer } from '@datahub/auth/testing';
import { describe, expect, it } from 'vitest';
import { createServer } from './server.js';

describe('createServer', () => {
  it('answers the health check without a token', async () => {
    const { verifier } = await createTestIssuer();
    const app = await createServer({ name: 'example', verifier, logger: false });
    const response = await app.inject({ url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', service: 'example' });
    await app.close();
  });

  it('requires a token on routes the service adds', async () => {
    const issuer = await createTestIssuer();
    const app = await createServer({ name: 'example', verifier: issuer.verifier, logger: false });
    app.get('/things', async () => ['thing']);

    expect((await app.inject({ url: '/things' })).statusCode).toBe(401);
    const token = await issuer.sign();
    const response = await app.inject({ url: '/things', headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('lets the web app call it from the browser, and no other site', async () => {
    const issuer = await createTestIssuer();
    const app = await createServer({ name: 'example', verifier: issuer.verifier, logger: false, allowedOrigins: ['https://web.test'] });
    app.get('/things', async () => ['thing']);
    const preflight = (origin: string) =>
      app.inject({ method: 'OPTIONS', url: '/things', headers: { origin, 'access-control-request-method': 'GET', 'access-control-request-headers': 'authorization' } });

    const allowed = await preflight('https://web.test');
    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe('https://web.test');
    expect(allowed.headers['access-control-allow-headers']).toContain('authorization');
    expect(allowed.headers['access-control-allow-credentials']).toBeUndefined();

    const other = await preflight('https://evil.test');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();

    const call = await app.inject({ url: '/things', headers: { origin: 'https://web.test', authorization: `Bearer ${await issuer.sign()}` } });
    expect(call.statusCode).toBe(200);
    expect(call.headers['access-control-allow-origin']).toBe('https://web.test');
    // The token check still applies to the call itself.
    expect((await app.inject({ url: '/things', headers: { origin: 'https://web.test' } })).statusCode).toBe(401);
    await app.close();
  });
});

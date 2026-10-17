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
});

import { createTestIssuer } from '@datahub/auth/testing';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('query', () => {
  it('reports its health without a token', async () => {
    const { verifier } = await createTestIssuer();
    const app = await buildApp({ verifier, logger: false });
    const response = await app.inject({ url: '/health' });
    expect(response.json()).toEqual({ status: 'ok', service: 'query' });
    await app.close();
  });

  it('refuses everything else without a valid token', async () => {
    const { verifier } = await createTestIssuer();
    const app = await buildApp({ verifier, logger: false });
    expect((await app.inject({ url: '/' })).statusCode).toBe(401);
    await app.close();
  });
});

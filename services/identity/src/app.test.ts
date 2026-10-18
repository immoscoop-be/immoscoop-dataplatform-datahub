import { createTestIssuer } from '@datahub/auth/testing';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { createLocalKeyService } from './testing.js';
import { createTokenIssuer } from './tokens.js';

async function app() {
  const { verifier } = await createTestIssuer();
  const tokens = createTokenIssuer({
    keys: createLocalKeyService(['v1']),
    signingKey: 'v1',
    publicKeys: ['v1'],
    issuer: 'https://identity.test',
    audience: 'datahub',
  });
  return buildApp({ verifier, tokens, logger: false });
}

describe('identity', () => {
  it('reports its health without a token', async () => {
    const identity = await app();
    const response = await identity.inject({ url: '/health' });
    expect(response.json()).toEqual({ status: 'ok', service: 'identity' });
    await identity.close();
  });

  it('publishes its public keys without a token', async () => {
    const identity = await app();
    const response = await identity.inject({ url: '/.well-known/jwks.json' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=300');
    expect(response.json().keys).toHaveLength(1);
    await identity.close();
  });

  it('refuses everything else without a valid token', async () => {
    const identity = await app();
    expect((await identity.inject({ url: '/' })).statusCode).toBe(401);
    await identity.close();
  });
});

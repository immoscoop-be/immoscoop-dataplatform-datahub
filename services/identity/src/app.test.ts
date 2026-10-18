import { createTestIssuer } from '@datahub/auth/testing';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { createLocalKeyService } from './testing.js';
import { createTokenIssuer } from './tokens.js';

async function app(issuer?: Awaited<ReturnType<typeof createTestIssuer>>) {
  const { verifier } = issuer ?? (await createTestIssuer());
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

  it('tells the signed-in User who they are', async () => {
    const issuer = await createTestIssuer();
    const identity = await app(issuer);
    const token = await issuer.sign({ sub: 'g-1', name: 'Jan Peeters', email: 'jan@thenextimmoscoop.be', groups: ['g'], roles: ['datateam'] });
    const response = await identity.inject({ url: '/me', headers: { authorization: `Bearer ${token}` } });
    expect(response.json()).toEqual({ sub: 'g-1', email: 'jan@thenextimmoscoop.be', name: 'Jan Peeters', groups: ['g'], roles: ['datateam'] });
    expect((await identity.inject({ url: '/me' })).statusCode).toBe(401);
    await identity.close();
  });
});

import { createVerifier } from '@datahub/auth';
import { createLocalJWKSet } from 'jose';
import { describe, expect, it } from 'vitest';
import { tokenIssuerFromEnv } from './env.js';
import { createLocalKeyService } from './testing.js';

const ENV = {
  DATAHUB_TOKEN_SIGNING_KEY: 'v2',
  DATAHUB_TOKEN_PUBLIC_KEYS: 'v1,v2',
  DATAHUB_TOKEN_ISSUER: 'https://identity.test',
  DATAHUB_TOKEN_AUDIENCE: 'datahub',
};

describe('tokenIssuerFromEnv', () => {
  it('publishes every listed key and signs with the signing key', async () => {
    const tokens = tokenIssuerFromEnv(createLocalKeyService(['v1', 'v2']), ENV);
    const jwks = await tokens.jwks();
    const verifier = createVerifier({ issuer: ENV.DATAHUB_TOKEN_ISSUER, audience: 'datahub', keys: createLocalJWKSet(jwks) });

    expect(jwks.keys).toHaveLength(2);
    await expect(
      verifier.verify(await tokens.issue({ sub: '1', email: 'jan@immoscoop.be', name: 'Jan', groups: [], roles: [] })),
    ).resolves.toMatchObject({ sub: '1' });
  });

  it('needs every variable', () => {
    const keys = createLocalKeyService(['v1', 'v2']);
    for (const name of Object.keys(ENV)) {
      expect(() => tokenIssuerFromEnv(keys, { ...ENV, [name]: '' })).toThrow(name);
    }
  });
});

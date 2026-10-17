import { describe, expect, it } from 'vitest';
import { verifierFromEnv } from './env.js';

describe('verifierFromEnv', () => {
  it('needs the issuer, audience and JWKS URL', () => {
    expect(() => verifierFromEnv({})).toThrow('Missing environment variable DATAHUB_TOKEN_ISSUER');
  });

  it('builds a verifier when everything is set', () => {
    const verifier = verifierFromEnv({
      DATAHUB_TOKEN_ISSUER: 'https://identity.example',
      DATAHUB_TOKEN_AUDIENCE: 'datahub',
      DATAHUB_JWKS_URL: 'https://identity.example/.well-known/jwks.json',
    });
    expect(typeof verifier.verify).toBe('function');
  });
});

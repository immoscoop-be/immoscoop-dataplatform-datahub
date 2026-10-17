import type { AccessTokenClaims } from '@datahub/contracts';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createVerifier, type TokenVerifier } from './verifier.js';

export const TEST_ISSUER = 'https://identity.test';
export const TEST_AUDIENCE = 'datahub';

export interface TestIssuer {
  verifier: TokenVerifier;
  /** Signs an access token for tests; claims can be overridden, lifetime defaults to 15 minutes. */
  sign(overrides?: Partial<AccessTokenClaims>, options?: { expiresIn?: string }): Promise<string>;
}

/** A stand-in for identity in tests: its own key pair, a verifier that trusts it, and a signer. */
export async function createTestIssuer(): Promise<TestIssuer> {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'ES256' };
  const verifier = createVerifier({
    issuer: TEST_ISSUER,
    audience: TEST_AUDIENCE,
    keys: createLocalJWKSet({ keys: [jwk] }),
  });

  return {
    verifier,
    async sign(overrides = {}, options = {}) {
      const { sub = 'user-1', iss = TEST_ISSUER, aud = TEST_AUDIENCE, iat, exp, ...claims } = overrides;
      const jwt = new SignJWT({
        email: 'user@immoscoop.be',
        name: 'Test User',
        groups: [],
        roles: [],
        ...claims,
      })
        .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
        .setSubject(sub)
        .setIssuer(iss)
        .setAudience(aud)
        .setIssuedAt(iat)
        .setExpirationTime(exp ?? options.expiresIn ?? '15m');
      return jwt.sign(privateKey);
    },
  };
}

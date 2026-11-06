import { STARTING_GROUPS, type AccessTokenClaims, type StartingGroup } from '@datahub/contracts';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createVerifier, type TokenVerifier } from './verifier.js';

export const TEST_ISSUER = 'https://identity.test';
export const TEST_AUDIENCE = 'datahub';

/** Claims to override in a test token; `as` gives the Permissions of a starting group, Business analyst by default. */
export type TestClaims = Partial<AccessTokenClaims> & { as?: StartingGroup };

export interface TestIssuer {
  verifier: TokenVerifier;
  /** Signs an access token for tests; claims can be overridden, lifetime defaults to 15 minutes. */
  sign(overrides?: TestClaims, options?: { expiresIn?: string }): Promise<string>;
}

/** The Permission group and Permissions of a starting group, as identity puts them in an Access Token. */
export function claimsAs(group: StartingGroup): Pick<AccessTokenClaims, 'permissionGroup' | 'permissions'> {
  const { name, permissions } = STARTING_GROUPS[group];
  return { permissionGroup: { id: `pg-${group}`, name }, permissions: structuredClone(permissions) };
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
      const { sub = 'user-1', iss = TEST_ISSUER, aud = TEST_AUDIENCE, iat, exp, as = 'businessAnalyst', ...claims } = overrides;
      const jwt = new SignJWT({
        email: 'user@immoscoop.be',
        name: 'Test User',
        groups: [],
        ...claimsAs(as),
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

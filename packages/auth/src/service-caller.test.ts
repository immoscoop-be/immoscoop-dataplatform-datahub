import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { createServiceCallerVerifier, type ServiceCallerVerifier } from './service-caller.js';
import { TokenError } from './verifier.js';

const CATALOGUE = 'https://datahub-catalogue.test';
const REGISTRY = 'datahub-registry@project.iam.gserviceaccount.com';

describe('createServiceCallerVerifier', () => {
  let sign: (claims: Record<string, unknown>, audience?: string) => Promise<string>;
  let verifier: ServiceCallerVerifier;

  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'google-key', alg: 'RS256' };
    sign = (claims, audience = CATALOGUE) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: 'RS256', kid: 'google-key' })
        .setIssuer('https://accounts.google.com')
        .setAudience(audience)
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
    verifier = createServiceCallerVerifier({ audience: CATALOGUE, serviceAccounts: [REGISTRY], keys: createLocalJWKSet({ keys: [jwk] }) });
  });

  it('accepts the ID token of a service account that may call, for this service', async () => {
    await expect(verifier.verify(await sign({ email: REGISTRY.toUpperCase(), email_verified: true }))).resolves.toBe(REGISTRY);
  });

  it.each([
    ['another service account', { email: 'someone@project.iam.gserviceaccount.com', email_verified: true }],
    ['an address that is not verified', { email: REGISTRY, email_verified: false }],
    ['no address', {}],
  ])('refuses %s', async (_case, claims) => {
    await expect(verifier.verify(await sign(claims))).rejects.toBeInstanceOf(TokenError);
  });

  it('refuses a token for another service', async () => {
    await expect(verifier.verify(await sign({ email: REGISTRY, email_verified: true }, 'https://other.test'))).rejects.toThrow(/ERR_JWT_CLAIM_VALIDATION_FAILED/);
  });
});

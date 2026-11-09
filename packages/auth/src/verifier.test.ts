import { generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestIssuer, TEST_AUDIENCE, TEST_ISSUER, type TestIssuer } from './testing.js';
import { TokenError } from './verifier.js';

let issuer: TestIssuer;

beforeAll(async () => {
  issuer = await createTestIssuer();
});

describe('createVerifier', () => {
  it('accepts a valid token and returns its claims', async () => {
    const token = await issuer.sign({ sub: 'google-42', groups: ['owners-digikom'] });
    const claims = await issuer.verifier.verify(token);
    expect(claims).toMatchObject({ sub: 'google-42', groups: ['owners-digikom'], iss: TEST_ISSUER, aud: TEST_AUDIENCE });
  });

  it.each([
    ['another issuer', { iss: 'https://evil.example' }],
    ['another audience', { aud: 'other-app' }],
  ])('rejects a token from %s', async (_label, overrides) => {
    const token = await issuer.sign(overrides);
    await expect(issuer.verifier.verify(token)).rejects.toBeInstanceOf(TokenError);
  });

  it('rejects an expired token', async () => {
    const token = await issuer.sign({}, { expiresIn: '-5m' });
    await expect(issuer.verifier.verify(token)).rejects.toThrow('ERR_JWT_EXPIRED');
  });

  it('rejects a token signed with another key', async () => {
    const other = await createTestIssuer();
    const token = await other.sign();
    await expect(issuer.verifier.verify(token)).rejects.toBeInstanceOf(TokenError);
  });

  it('rejects a token with a shared-secret algorithm', async () => {
    const token = await new SignJWT({ email: 'user@immoscoop.be', name: 'x', groups: [], roles: [] })
      .setProtectedHeader({ alg: 'HS256', kid: 'test-key' })
      .setSubject('user-1')
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode('a-shared-secret-of-at-least-32-bytes!'));
    await expect(issuer.verifier.verify(token)).rejects.toBeInstanceOf(TokenError);
  });

  it('rejects a token whose claims break the contract', async () => {
    const token = await issuer.sign({ email: 'not-an-email' });
    await expect(issuer.verifier.verify(token)).rejects.toThrow('claims do not match');
  });

  it('rejects garbage', async () => {
    await expect(issuer.verifier.verify('not.a.token')).rejects.toBeInstanceOf(TokenError);
  });

  it('cannot be fooled by an unsigned token', async () => {
    const { privateKey } = await generateKeyPair('ES256');
    const signed = await new SignJWT({}).setProtectedHeader({ alg: 'ES256' }).sign(privateKey);
    const [, payload] = signed.split('.');
    const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${payload}.`;
    await expect(issuer.verifier.verify(unsigned)).rejects.toBeInstanceOf(TokenError);
  });
});

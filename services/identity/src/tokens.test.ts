import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { createVerifier, TokenError } from '@datahub/auth';
import { createLocalJWKSet, decodeProtectedHeader, type JWK } from 'jose';
import { describe, expect, it } from 'vitest';
import { createLocalKeyService } from './testing.js';
import { createTokenIssuer, derToJose, type TokenIssuerOptions } from './tokens.js';

const ISSUER = 'https://identity.test';
const AUDIENCE = 'datahub';
const SUBJECT = {
  sub: '108234567890',
  email: 'jan@immoscoop.be',
  name: 'Jan Peeters',
  groups: ['03x8tuzt1abc'],
  roles: ['datateam'],
};

function issuer(options: Partial<TokenIssuerOptions> & Pick<TokenIssuerOptions, 'keys'>) {
  return createTokenIssuer({
    signingKey: 'v1',
    publicKeys: ['v1'],
    issuer: ISSUER,
    audience: AUDIENCE,
    ...options,
  });
}

/** How every other service checks a token: @datahub/auth against the published keys. */
function verifierFor(jwks: { keys: JWK[] }) {
  return createVerifier({ issuer: ISSUER, audience: AUDIENCE, keys: createLocalJWKSet(jwks) });
}

describe('createTokenIssuer', () => {
  it('issues Access Tokens that every service accepts', async () => {
    const tokens = issuer({ keys: createLocalKeyService(['v1']) });
    const claims = await verifierFor(await tokens.jwks()).verify(await tokens.issue(SUBJECT));

    expect(claims).toMatchObject({ ...SUBJECT, iss: ISSUER, aud: AUDIENCE });
    expect(claims.exp - claims.iat).toBe(15 * 60);
  });

  it('expires tokens after 15 minutes', async () => {
    const minutesAgo = (minutes: number) => () => Date.now() - minutes * 60 * 1000;
    const recent = issuer({ keys: createLocalKeyService(['v1']), now: minutesAgo(14) });
    const old = issuer({ keys: createLocalKeyService(['v1']), now: minutesAgo(16) });

    await expect(verifierFor(await recent.jwks()).verify(await recent.issue(SUBJECT))).resolves.toBeDefined();
    await expect(verifierFor(await old.jwks()).verify(await old.issue(SUBJECT))).rejects.toThrow(TokenError);
  });

  it('publishes only public keys, each with its own key ID', async () => {
    const tokens = issuer({ keys: createLocalKeyService(['v1', 'v2']), signingKey: 'v2', publicKeys: ['v1', 'v2'] });
    const { keys } = await tokens.jwks();

    expect(keys).toHaveLength(2);
    for (const key of keys) {
      expect(key).toMatchObject({ kty: 'EC', crv: 'P-256', alg: 'ES256', use: 'sig' });
      expect(key).not.toHaveProperty('d');
    }
    expect(keys[0]?.kid).not.toBe(keys[1]?.kid);
  });

  it('signs with the signing key and keeps accepting tokens of the previous one during a rotation', async () => {
    const keys = createLocalKeyService(['v1', 'v2']);
    const before = issuer({ keys, signingKey: 'v1', publicKeys: ['v1'] });
    const during = issuer({ keys, signingKey: 'v2', publicKeys: ['v1', 'v2'] });
    const jwks = await during.jwks();
    const verifier = verifierFor(jwks);

    const token = await during.issue(SUBJECT);
    expect(decodeProtectedHeader(token).kid).toBe(jwks.keys[1]?.kid);
    await expect(verifier.verify(token)).resolves.toBeDefined();
    await expect(verifier.verify(await before.issue(SUBJECT))).resolves.toBeDefined();
  });

  it('no longer accepts tokens of a key that is not published any more', async () => {
    const keys = createLocalKeyService(['v1', 'v2']);
    const old = issuer({ keys, signingKey: 'v1', publicKeys: ['v1'] });
    const after = issuer({ keys, signingKey: 'v2', publicKeys: ['v2'] });

    await expect(verifierFor(await after.jwks()).verify(await old.issue(SUBJECT))).rejects.toThrow(TokenError);
  });

  it('refuses a signing key that it does not publish', () => {
    expect(() => issuer({ keys: createLocalKeyService(['v1', 'v2']), signingKey: 'v2', publicKeys: ['v1'] })).toThrow(
      /published/,
    );
  });

  it('refuses a key that cannot sign ES256 tokens', async () => {
    const tokens = issuer({ keys: createLocalKeyService(['v1'], 'secp384r1') });
    await expect(tokens.jwks()).rejects.toThrow(/P-256/);
  });

  it('never issues a token whose signature does not match the published key', async () => {
    const keys = createLocalKeyService(['v1', 'other']);
    const tokens = issuer({ keys: { ...keys, sign: (_version, data) => keys.sign('other', data) } });
    await expect(tokens.issue(SUBJECT)).rejects.toThrow(/does not match/);
  });

  it('refuses claims that break the Access Token contract', async () => {
    const tokens = issuer({ keys: createLocalKeyService(['v1']) });
    await expect(tokens.issue({ ...SUBJECT, email: 'not an address' })).rejects.toThrow();
  });

  it('reads the public keys again after a failure', async () => {
    const keys = createLocalKeyService(['v1']);
    let failures = 1;
    const tokens = issuer({
      keys: {
        ...keys,
        publicKeyPem: async (version) => {
          if (failures-- > 0) {
            throw new Error('Cloud KMS is unavailable');
          }
          return keys.publicKeyPem(version);
        },
      },
    });

    await expect(tokens.jwks()).rejects.toThrow(/unavailable/);
    await expect(tokens.jwks()).resolves.toHaveProperty('keys');
  });
});

describe('derToJose', () => {
  it('turns DER signatures into the 64 bytes a JWS carries', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    // Enough signatures to meet numbers that DER pads with a zero byte, and ones it shortens.
    for (let i = 0; i < 300; i++) {
      const data = Buffer.from(`token ${i}`);
      const jose = derToJose(sign('sha256', data, { key: privateKey, dsaEncoding: 'der' }));
      expect(jose).toHaveLength(64);
      expect(verify('sha256', data, { key: publicKey, dsaEncoding: 'ieee-p1363' }, jose)).toBe(true);
    }
  });

  it('pads short numbers on the left', () => {
    const der = Uint8Array.from([0x30, 0x06, 0x02, 0x01, 0x05, 0x02, 0x01, 0x07]);
    const jose = derToJose(der);
    expect(jose[31]).toBe(5);
    expect(jose[63]).toBe(7);
    expect(jose.slice(0, 31).every((byte) => byte === 0)).toBe(true);
  });

  it('refuses anything that is not a DER signature', () => {
    expect(() => derToJose(Uint8Array.from([0x31, 0x00]))).toThrow();
    expect(() => derToJose(Uint8Array.from([0x30, 0x06, 0x02, 0x01, 0x05]))).toThrow();
    expect(() => derToJose(new Uint8Array([0x30, 0x24, 0x02, 0x21, ...new Array<number>(33).fill(1), 0x02, 0x01, 0x01]))).toThrow(
      /32 bytes/,
    );
  });
});

import { createPublicKey, verify, type KeyObject } from 'node:crypto';
import { accessTokenClaims, type AccessTokenClaims } from '@datahub/contracts';
import { base64url, calculateJwkThumbprint, type JWK } from 'jose';
import type { KeyService } from './signing-keys.js';

/** The User an Access Token is for; identity adds who issued it, for whom, and until when. */
export type TokenSubject = Pick<AccessTokenClaims, 'sub' | 'email' | 'name' | 'groups' | 'roles'>;

export interface TokenIssuerOptions {
  keys: KeyService;
  /** The key version that signs: the newest enabled one (DATAHUB_TOKEN_SIGNING_KEY). */
  signingKey: string;
  /** Every enabled key version; their public keys are published (DATAHUB_TOKEN_PUBLIC_KEYS). */
  publicKeys: string[];
  /** The URL of identity, which every service expects in `iss`. */
  issuer: string;
  /** The Data Hub services, which every service expects in `aud`. */
  audience: string;
  /** How long an Access Token is valid, in seconds: 15 minutes (TR-PF-02). */
  lifetimeSeconds?: number;
  /** The current time in milliseconds; tests pass their own clock. */
  now?: () => number;
}

export interface TokenIssuer {
  /** The public keys of every enabled key version, as served at `/.well-known/jwks.json`. */
  jwks(): Promise<{ keys: JWK[] }>;
  /** Issues a signed Access Token for a User. */
  issue(subject: TokenSubject): Promise<string>;
}

interface PublicKey {
  version: string;
  key: KeyObject;
  jwk: JWK;
}

/**
 * Issues Access Tokens signed with the key in Cloud KMS (TR-PF-02, TR-PF-24). The public keys are
 * read once per instance; a key version changes only with a new deployment of identity.
 */
export function createTokenIssuer(options: TokenIssuerOptions): TokenIssuer {
  if (!options.publicKeys.includes(options.signingKey)) {
    throw new Error('The signing key must be one of the published keys, or no service accepts its tokens');
  }
  const lifetimeSeconds = options.lifetimeSeconds ?? 15 * 60;
  const now = options.now ?? Date.now;

  let loading: Promise<PublicKey[]> | undefined;
  function load(): Promise<PublicKey[]> {
    loading ??= Promise.all(options.publicKeys.map((version) => readPublicKey(options.keys, version))).catch(
      (error: unknown) => {
        loading = undefined;
        throw error;
      },
    );
    return loading;
  }

  return {
    async jwks() {
      return { keys: (await load()).map((publicKey) => publicKey.jwk) };
    },

    async issue(subject) {
      const signing = (await load()).find((publicKey) => publicKey.version === options.signingKey);
      if (!signing) {
        throw new Error(`No public key for the signing key ${options.signingKey}`);
      }

      const iat = Math.floor(now() / 1000);
      const claims = accessTokenClaims.parse({
        ...subject,
        iss: options.issuer,
        aud: options.audience,
        iat,
        exp: iat + lifetimeSeconds,
      });
      const header = { alg: 'ES256', typ: 'JWT', kid: signing.jwk.kid };
      const input = `${base64url.encode(JSON.stringify(header))}.${base64url.encode(JSON.stringify(claims))}`;
      const data = new TextEncoder().encode(input);

      const signature = await options.keys.sign(options.signingKey, data);
      // A token that no service would accept is better not issued at all.
      if (!verify('sha256', data, { key: signing.key, dsaEncoding: 'der' }, signature)) {
        throw new Error(`The signature of ${options.signingKey} does not match its public key`);
      }
      return `${input}.${base64url.encode(derToJose(signature))}`;
    },
  };
}

async function readPublicKey(keys: KeyService, version: string): Promise<PublicKey> {
  const key = createPublicKey(await keys.publicKeyPem(version));
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new Error(`Key version ${version} is not an EC P-256 key, so it cannot sign ES256 tokens`);
  }
  const jwk = key.export({ format: 'jwk' }) as JWK;
  const kid = await calculateJwkThumbprint(jwk);
  return { version, key, jwk: { ...jwk, kid, alg: 'ES256', use: 'sig' } };
}

/**
 * Cloud KMS returns an ECDSA signature in DER: SEQUENCE { INTEGER r, INTEGER s }. A JWS needs r and
 * s as two numbers of 32 bytes each, back to back (RFC 7518, section 3.4).
 */
export function derToJose(der: Uint8Array, size = 32): Uint8Array {
  let offset = 0;
  const byte = (): number => {
    const value = der[offset++];
    if (value === undefined) {
      throw new Error('The signature is not a DER-encoded ECDSA signature');
    }
    return value;
  };
  const header = (tag: number): number => {
    if (byte() !== tag) {
      throw new Error('The signature is not a DER-encoded ECDSA signature');
    }
    const length = byte();
    if (length < 0x80) {
      return length;
    }
    let long = 0;
    for (let i = 0; i < (length & 0x7f); i++) {
      long = long * 256 + byte();
    }
    return long;
  };

  header(0x30);
  const jose = new Uint8Array(size * 2);
  for (const position of [0, size]) {
    const length = header(0x02);
    let integer = der.subarray(offset, offset + length);
    offset += length;
    // DER adds a zero byte in front of a number whose first bit is set; JWS has no sign.
    while (integer.length > size && integer[0] === 0) {
      integer = integer.subarray(1);
    }
    if (integer.length > size || integer.length < 1) {
      throw new Error(`The signature does not hold two numbers of ${size} bytes`);
    }
    jose.set(integer, position + size - integer.length);
  }
  if (offset !== der.length) {
    throw new Error('The signature is not a DER-encoded ECDSA signature');
  }
  return jose;
}

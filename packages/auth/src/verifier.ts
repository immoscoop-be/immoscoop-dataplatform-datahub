import { accessTokenClaims, type AccessTokenClaims } from '@datahub/contracts';
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface VerifierOptions {
  /** The issuer every token must carry: the URL of identity. */
  issuer: string;
  /** The audience every token must carry: the Data Hub services. */
  audience: string;
  /** Where the public keys of identity come from: its JWKS URL, or a key set for tests. */
  keys: URL | JWTVerifyGetKey;
  /** Accepted signing algorithms. Asymmetric only; never `none` or a shared secret. */
  algorithms?: string[];
  /** Allowed clock skew between identity and this service, in seconds. */
  clockToleranceSeconds?: number;
}

export interface TokenVerifier {
  /** Verifies an access token and returns its claims, or throws a TokenError. */
  verify(token: string): Promise<AccessTokenClaims>;
}

/** Raised for every token that must not be accepted; the message is safe to log, not to return. */
export class TokenError extends Error {
  override name = 'TokenError';
}

/** Validates Data Hub access tokens locally, against the public keys of identity (TR-PF-03). */
export function createVerifier(options: VerifierOptions): TokenVerifier {
  const getKey = options.keys instanceof URL ? createRemoteJWKSet(options.keys) : options.keys;
  const algorithms = options.algorithms ?? ['ES256'];

  return {
    async verify(token) {
      let payload: unknown;
      try {
        ({ payload } = await jwtVerify(token, getKey, {
          issuer: options.issuer,
          audience: options.audience,
          algorithms,
          clockTolerance: options.clockToleranceSeconds ?? 30,
        }));
      } catch (error) {
        const reason = error instanceof errors.JOSEError ? error.code : 'ERR_UNKNOWN';
        throw new TokenError(`Token rejected: ${reason}`, { cause: error });
      }
      const claims = accessTokenClaims.safeParse(payload);
      if (!claims.success) {
        throw new TokenError('Token rejected: claims do not match the access token contract');
      }
      return claims.data;
    },
  };
}

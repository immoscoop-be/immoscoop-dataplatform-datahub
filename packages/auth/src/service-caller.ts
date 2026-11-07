import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { TokenError } from './verifier.js';

const GOOGLE_KEYS = new URL('https://www.googleapis.com/oauth2/v3/certs');
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export interface ServiceCallerOptions {
  /** The address of the receiving service, which the caller asked its token for. */
  audience: string;
  /** The service accounts that may call, by address. */
  serviceAccounts: string[];
  /** Google's public keys; tests pass their own. */
  keys?: JWTVerifyGetKey;
}

export interface ServiceCallerVerifier {
  /** Verifies a Google ID token and returns the service account that holds it, or throws a TokenError. */
  verify(token: string): Promise<string>;
}

/**
 * Checks the calls between services that no User started (TR-PF-05): a Google ID token, signed by
 * Google, for this service, of one of the given service accounts.
 */
export function createServiceCallerVerifier(options: ServiceCallerOptions): ServiceCallerVerifier {
  const getKey = options.keys ?? createRemoteJWKSet(GOOGLE_KEYS);
  const allowed = new Set(options.serviceAccounts.map((account) => account.toLowerCase()));
  return {
    async verify(token) {
      let payload: Record<string, unknown>;
      try {
        ({ payload } = await jwtVerify(token, getKey, { issuer: GOOGLE_ISSUERS, audience: options.audience, algorithms: ['RS256'], clockTolerance: 30 }));
      } catch (error) {
        const reason = error instanceof errors.JOSEError ? error.code : 'ERR_UNKNOWN';
        throw new TokenError(`Service token rejected: ${reason}`, { cause: error });
      }
      const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
      if (payload.email_verified !== true || !allowed.has(email)) {
        throw new TokenError('Service token rejected: not a service account that may call');
      }
      return email;
    },
  };
}

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_KEYS = new URL('https://www.googleapis.com/oauth2/v3/certs');
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/** Who signed in at Google, once the ID token is verified. */
export interface GoogleIdentity {
  /** The fixed Google ID of the User (FR-UM-03). */
  sub: string;
  email: string;
  name: string;
}

/** Sign in with Google through OpenID Connect (FR-UM-01). */
export interface GoogleSignIn {
  /** The address at Google where the User signs in; Google sends them back to identity's callback. */
  authorizationUrl(request: { state: string; nonce: string; codeChallenge: string }): string;
  /** Exchanges the code from Google for the verified identity of the User, or throws. */
  identity(request: { code: string; codeVerifier: string; nonce: string }): Promise<GoogleIdentity>;
}

export interface GoogleSignInOptions {
  /** identity's OAuth client at Google (the secret datahub-google-oauth-client). */
  clientId: string;
  clientSecret: string;
  /** identity's callback, as registered at Google. */
  redirectUri: string;
  /** The only Workspace domain that gets in (DEC-UM-06). */
  domain: string;
  /** Google's public keys; tests pass their own. */
  keys?: JWTVerifyGetKey;
  fetch?: typeof fetch;
}

/** Raised for every sign-in that must not get in; the message is safe to log. */
export class SignInError extends Error {
  override name = 'SignInError';
}

export function createGoogleSignIn(options: GoogleSignInOptions): GoogleSignIn {
  const keys = options.keys ?? createRemoteJWKSet(GOOGLE_KEYS);
  const request = options.fetch ?? fetch;

  return {
    authorizationUrl({ state, nonce, codeChallenge }) {
      const url = new URL(AUTHORIZATION_ENDPOINT);
      url.search = new URLSearchParams({
        client_id: options.clientId,
        redirect_uri: options.redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        // Offers the accounts of the company's own domain first; the check below decides.
        hd: options.domain,
      }).toString();
      return url.toString();
    },

    async identity({ code, codeVerifier, nonce }) {
      const response = await request(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          code_verifier: codeVerifier,
          client_id: options.clientId,
          client_secret: options.clientSecret,
          redirect_uri: options.redirectUri,
        }),
      });
      if (!response.ok) {
        throw new SignInError(`Google refused the code: ${response.status}`);
      }
      const { id_token: idToken } = (await response.json()) as { id_token?: string };
      if (!idToken) {
        throw new SignInError('Google returned no ID token');
      }

      // Signature, issuer, audience and expiry (FR-UM-01) ...
      const { payload } = await jwtVerify(idToken, keys, { issuer: GOOGLE_ISSUERS, audience: options.clientId }).catch(
        (error: unknown) => {
          throw new SignInError('The ID token from Google is not valid', { cause: error });
        },
      );
      // ... that it answers this sign-in, and only accounts of the own Workspace domain (FR-UM-02).
      if (payload.nonce !== nonce) {
        throw new SignInError('The ID token does not belong to this sign-in');
      }
      if (payload.hd !== options.domain || payload.email_verified !== true) {
        throw new SignInError(`Only accounts of ${options.domain} get in`);
      }
      if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
        throw new SignInError('The ID token has no subject or email');
      }
      return {
        sub: payload.sub,
        email: payload.email,
        name: typeof payload.name === 'string' ? payload.name : payload.email,
      };
    },
  };
}

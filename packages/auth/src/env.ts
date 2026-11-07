import { createVerifier, type TokenVerifier } from './verifier.js';

/**
 * Builds the verifier from the environment of a service:
 * DATAHUB_TOKEN_ISSUER, DATAHUB_TOKEN_AUDIENCE and DATAHUB_JWKS_URL.
 */
export function verifierFromEnv(env: NodeJS.ProcessEnv = process.env): TokenVerifier {
  const issuer = required(env, 'DATAHUB_TOKEN_ISSUER');
  const audience = required(env, 'DATAHUB_TOKEN_AUDIENCE');
  const jwksUrl = required(env, 'DATAHUB_JWKS_URL');
  return createVerifier({ issuer, audience, keys: new URL(jwksUrl) });
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

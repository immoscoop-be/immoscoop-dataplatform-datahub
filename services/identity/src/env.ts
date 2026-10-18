import type { KeyService } from './signing-keys.js';
import { createTokenIssuer, type TokenIssuer } from './tokens.js';

/**
 * Builds the token issuer from the environment that Terraform gives identity:
 * DATAHUB_TOKEN_SIGNING_KEY, DATAHUB_TOKEN_PUBLIC_KEYS (comma-separated), DATAHUB_TOKEN_ISSUER
 * and DATAHUB_TOKEN_AUDIENCE.
 */
export function tokenIssuerFromEnv(keys: KeyService, env: NodeJS.ProcessEnv = process.env): TokenIssuer {
  return createTokenIssuer({
    keys,
    signingKey: required(env, 'DATAHUB_TOKEN_SIGNING_KEY'),
    publicKeys: required(env, 'DATAHUB_TOKEN_PUBLIC_KEYS').split(','),
    issuer: required(env, 'DATAHUB_TOKEN_ISSUER'),
    audience: required(env, 'DATAHUB_TOKEN_AUDIENCE'),
  });
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

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

/** The settings of signing in, from the environment Terraform gives identity. */
export interface SignInSettings {
  /** identity's own address, the issuer of the Access Tokens (DATAHUB_TOKEN_ISSUER). */
  issuer: string;
  /** The Workspace domains that get in (DATAHUB_WORKSPACE_DOMAIN, comma-separated, DEC-UM-09). */
  domains: string[];
  /** The secret version that holds identity's OAuth client at Google (DATAHUB_GOOGLE_OAUTH_CLIENT). */
  googleClientSecret: string;
  /** The callbacks MCP clients may register (DATAHUB_MCP_REDIRECT_URIS, comma-separated). */
  mcpRedirectUris: string[];
  /** The callback of the web app's server (DATAHUB_WEB_REDIRECT_URI), once it exists. */
  webClient?: { clientId: string; redirectUri: string };
}

export function signInSettingsFromEnv(env: NodeJS.ProcessEnv = process.env): SignInSettings {
  return {
    issuer: required(env, 'DATAHUB_TOKEN_ISSUER'),
    domains: required(env, 'DATAHUB_WORKSPACE_DOMAIN')
      .split(',')
      .map((domain) => domain.trim().toLowerCase())
      .filter((domain) => domain.length > 0),
    googleClientSecret: required(env, 'DATAHUB_GOOGLE_OAUTH_CLIENT'),
    mcpRedirectUris: (env.DATAHUB_MCP_REDIRECT_URIS ?? '').split(',').filter((uri) => uri.length > 0),
    webClient: env.DATAHUB_WEB_REDIRECT_URI ? { clientId: 'datahub-web', redirectUri: env.DATAHUB_WEB_REDIRECT_URI } : undefined,
  };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

import { createPublicKey, verify, type JsonWebKey } from 'node:crypto';

/**
 * REQ-091: who may use the MCP server. Claude connects from outside the platform, so the gate cannot let it
 * through with a cookie; /mcp checks an OAuth access token itself, issued to a gate account (Cognito Pool 1).
 *
 * - oauth: MCP_AUTH_ISSUER, MCP_AUTH_CLIENT_IDS and MCP_RESOURCE_URL are set.
 * - open: MCP_AUTH=none, for a local server and the tests, or when the platform checks the token itself.
 * - off: neither. /mcp then refuses every request: fail closed, so a gate exception without configuration
 *   never opens the service.
 */
export type McpAuth = { mode: 'off' } | { mode: 'open' } | OAuthConfig;

export interface OAuthConfig {
  mode: 'oauth';
  /** The issuer of the access tokens, e.g. https://cognito-idp.eu-central-1.amazonaws.com/<pool id>. */
  issuer: string;
  /** The authorization server Claude signs in with; the issuer unless the platform puts metadata elsewhere. */
  authorizationServer: string;
  /** The OAuth clients whose tokens are accepted, such as the one registered for Claude. */
  clientIds: string[];
  /** The URL of /mcp as users enter it in Claude; the resource in the protected resource metadata. */
  resource: string;
  /** A scope every token must carry, such as semgraph/mcp; none when absent. */
  scope?: string;
}

export interface AccessToken {
  subject: string;
  clientId: string;
  scopes: string[];
}

export type FetchJson = (url: string) => Promise<unknown>;

/** Reads the configuration; an incomplete one stops the service from starting, like a failed conformance check. */
export function mcpAuthFromEnv(env: NodeJS.ProcessEnv = process.env): McpAuth {
  const issuer = env.MCP_AUTH_ISSUER?.trim();
  if (env.MCP_AUTH !== undefined && env.MCP_AUTH !== 'none') throw new Error(`MCP_AUTH must be "none" or absent, not "${env.MCP_AUTH}"`);
  if (env.MCP_AUTH === 'none') {
    if (issuer) throw new Error('MCP_AUTH=none and MCP_AUTH_ISSUER exclude each other');
    return { mode: 'open' };
  }
  if (!issuer) return { mode: 'off' };
  const clientIds = (env.MCP_AUTH_CLIENT_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean);
  const resource = env.MCP_RESOURCE_URL?.trim();
  const missing = [clientIds.length === 0 && 'MCP_AUTH_CLIENT_IDS', !resource && 'MCP_RESOURCE_URL'].filter(Boolean);
  if (missing.length > 0) throw new Error(`MCP_AUTH_ISSUER is set, so ${missing.join(' and ')} must be set too`);
  for (const [name, url] of [['MCP_AUTH_ISSUER', issuer], ['MCP_RESOURCE_URL', resource!], ['MCP_AUTHORIZATION_SERVER', env.MCP_AUTHORIZATION_SERVER]] as const) {
    if (url !== undefined && !/^https:\/\/[^\s/]+/.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
      throw new Error(`${name} must be an https URL, not "${url}"`);
    }
  }
  return {
    mode: 'oauth',
    issuer: issuer.replace(/\/$/, ''),
    authorizationServer: env.MCP_AUTHORIZATION_SERVER?.trim() || issuer.replace(/\/$/, ''),
    clientIds,
    resource: resource!,
    ...(env.MCP_AUTH_SCOPE?.trim() ? { scope: env.MCP_AUTH_SCOPE.trim() } : {}),
  };
}

/** Where the protected resource metadata (RFC 9728) of /mcp lives: the well-known path in front of the path of the resource. */
export function resourceMetadataUrl(resource: string): string {
  const url = new URL(resource);
  const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
  return `${url.origin}/.well-known/oauth-protected-resource${path}`;
}

/** The protected resource metadata: Claude reads it to find where to sign in. */
export function resourceMetadata(config: OAuthConfig) {
  return {
    resource: config.resource,
    authorization_servers: [config.authorizationServer],
    bearer_methods_supported: ['header'],
    ...(config.scope ? { scopes_supported: [config.scope] } : {}),
    resource_name: 'semgraph',
  };
}

/** The WWW-Authenticate header of a 401: where the metadata is, and what was wrong with a token that was sent. */
export function bearerChallenge(config: OAuthConfig, error?: 'invalid_token' | 'insufficient_scope'): string {
  const parts = [`resource_metadata="${resourceMetadataUrl(config.resource)}"`];
  if (config.scope) parts.push(`scope="${config.scope}"`);
  if (error) parts.push(`error="${error}"`);
  return `Bearer ${parts.join(', ')}`;
}

interface Jwk extends JsonWebKey {
  kid?: string;
}

const JWKS_TTL_MS = 60 * 60 * 1000;
/** An unknown key id may mean the keys were rotated, but refetch at most this often. */
const JWKS_REFETCH_MS = 60 * 1000;

/**
 * Checks access tokens of the issuer, like the platform's gate checks its ID tokens: signature (RS256)
 * against the issuer's keys, issuer, token use, client, expiry and scope.
 */
export function createTokenVerifier(
  config: OAuthConfig,
  { fetchJson = defaultFetchJson, now = () => new Date() }: { fetchJson?: FetchJson; now?: () => Date } = {},
): (token: string) => Promise<AccessToken | undefined> {
  let keys: Jwk[] = [];
  let fetchedAt = -Infinity;

  async function keysFor(kid: string): Promise<Jwk | undefined> {
    const age = Date.now() - fetchedAt;
    const known = keys.find((key) => key.kid === kid);
    if (known && age < JWKS_TTL_MS) return known;
    if (!known && age < JWKS_REFETCH_MS) return undefined;
    const jwks = (await fetchJson(`${config.issuer}/.well-known/jwks.json`)) as { keys?: Jwk[] };
    keys = Array.isArray(jwks.keys) ? jwks.keys : [];
    fetchedAt = Date.now();
    return keys.find((key) => key.kid === kid);
  }

  return async (token) => {
    const parts = token.split('.');
    if (parts.length !== 3) return undefined;
    const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
    let header: Record<string, unknown>;
    let payload: Record<string, unknown>;
    try {
      header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
      payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    } catch {
      return undefined;
    }
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return undefined;
    const seconds = Math.floor(now().getTime() / 1000);
    // A missing exp must fail too: `undefined < seconds` is false.
    if (typeof payload.exp !== 'number' || payload.exp <= seconds) return undefined;
    if (typeof payload.nbf === 'number' && payload.nbf > seconds + 60) return undefined;
    if (payload.iss !== config.issuer) return undefined;
    // Cognito: an access token says token_use access and names its client in client_id.
    if (payload.token_use !== 'access') return undefined;
    const clientId = payload.client_id;
    if (typeof clientId !== 'string' || !config.clientIds.includes(clientId)) return undefined;
    const scopes = typeof payload.scope === 'string' ? payload.scope.split(' ').filter(Boolean) : [];
    if (config.scope && !scopes.includes(config.scope)) return undefined;
    if (typeof payload.sub !== 'string') return undefined;

    let jwk: Jwk | undefined;
    try {
      jwk = await keysFor(header.kid);
    } catch {
      return undefined;
    }
    if (!jwk || jwk.kty !== 'RSA') return undefined;
    const signed = verify(
      'RSA-SHA256',
      Buffer.from(`${headerPart}.${payloadPart}`),
      createPublicKey({ key: { kty: jwk.kty, n: jwk.n, e: jwk.e }, format: 'jwk' }),
      Buffer.from(signaturePart, 'base64url'),
    );
    return signed ? { subject: payload.sub, clientId, scopes } : undefined;
  };
}

async function defaultFetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

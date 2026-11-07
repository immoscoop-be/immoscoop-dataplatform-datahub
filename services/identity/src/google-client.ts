import { type AccessTokenSource, readSecret } from '@datahub/google';

/** identity's OAuth client at Google, as stored in the secret datahub-google-oauth-client (step 8 of the GCP setup). */
export interface GoogleClient {
  clientId: string;
  clientSecret: string;
}

/**
 * Reads the OAuth client from Secret Manager: the JSON file the Google console downloads, which
 * holds the client under `web`, or the same fields at the top.
 */
export async function readGoogleClient(
  secretVersion: string,
  token: AccessTokenSource,
  request: typeof fetch = fetch,
): Promise<GoogleClient> {
  return parseGoogleClient(await readSecret(secretVersion, token, request));
}

export function parseGoogleClient(json: string): GoogleClient {
  let parsed: { web?: Record<string, unknown> } & Record<string, unknown>;
  try {
    parsed = JSON.parse(json) as typeof parsed;
  } catch {
    throw new Error('The OAuth client secret is not JSON');
  }
  const fields = parsed.web ?? parsed;
  if (typeof fields.client_id !== 'string' || typeof fields.client_secret !== 'string') {
    throw new Error('The OAuth client secret has no client_id and client_secret');
  }
  return { clientId: fields.client_id, clientSecret: fields.client_secret };
}

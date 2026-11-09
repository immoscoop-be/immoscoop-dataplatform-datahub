const METADATA_TOKEN = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';

/** An access token for Google's APIs, as the service account the code runs as. */
export type AccessTokenSource = (scopes: string[]) => Promise<string>;

/** The scope that lets a service account call every Google Cloud API its roles allow. */
export const CLOUD_PLATFORM = 'https://www.googleapis.com/auth/cloud-platform';

/**
 * Access tokens from the metadata server of Cloud Run, for the service account the service runs
 * as, kept until shortly before they expire.
 */
export function metadataAccessToken(request: typeof fetch = fetch, now: () => number = Date.now): AccessTokenSource {
  const cache = new Map<string, { token: string; expiresAt: number }>();
  return async (scopes) => {
    const key = scopes.join(',');
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now()) {
      return cached.token;
    }
    const response = await request(`${METADATA_TOKEN}?scopes=${encodeURIComponent(key)}`, {
      headers: { 'metadata-flavor': 'Google' },
    });
    if (!response.ok) {
      throw new Error(`The metadata server gave no access token: ${response.status}`);
    }
    const { access_token: token, expires_in: expiresIn } = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    cache.set(key, { token, expiresAt: now() + (expiresIn - 60) * 1000 });
    return token;
  };
}

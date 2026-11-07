const METADATA_IDENTITY = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';

/** A Google ID token for the given audience, as the service account the code runs as. */
export type IdTokenSource = (audience: string) => Promise<string>;

/** Google's ID tokens last an hour; one is used again until well before that. */
const KEEP_MS = 50 * 60 * 1000;

/**
 * Google ID tokens from the metadata server of Cloud Run, with which a service proves to another
 * that it is its own service account (TR-PF-05), kept per audience.
 */
export function metadataIdToken(request: typeof fetch = fetch, now: () => number = Date.now): IdTokenSource {
  const cache = new Map<string, { token: string; until: number }>();
  return async (audience) => {
    const cached = cache.get(audience);
    if (cached && cached.until > now()) {
      return cached.token;
    }
    // `format=full` puts the address of the service account in the token, which the receiver checks.
    const response = await request(`${METADATA_IDENTITY}?audience=${encodeURIComponent(audience)}&format=full`, {
      headers: { 'metadata-flavor': 'Google' },
    });
    if (!response.ok) {
      throw new Error(`The metadata server gave no ID token: ${response.status}`);
    }
    const token = (await response.text()).trim();
    cache.set(audience, { token, until: now() + KEEP_MS });
    return token;
  };
}

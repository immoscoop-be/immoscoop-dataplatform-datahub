import { type AccessTokenSource, CLOUD_PLATFORM } from './access-token.js';
import { googleApiError } from './errors.js';

/**
 * Reads the value of a secret version from Secret Manager, such as
 * `projects/<project>/secrets/<secret>/versions/latest`. Services read a secret when they first need
 * it, not at start, so a secret without a value does not block a deploy (TR-PF-23).
 */
export async function readSecret(secretVersion: string, token: AccessTokenSource, request: typeof fetch = fetch): Promise<string> {
  const response = await request(`https://secretmanager.googleapis.com/v1/${secretVersion}:access`, {
    headers: { authorization: `Bearer ${await token([CLOUD_PLATFORM])}` },
  });
  if (!response.ok) {
    throw await googleApiError(`The secret ${secretVersion} could not be read`, response);
  }
  const { payload } = (await response.json()) as { payload?: { data?: string } };
  return Buffer.from(payload?.data ?? '', 'base64').toString('utf8');
}

import type { IdTokenSource } from '@datahub/google';
import type { KeyNotice, Notices } from './excel-keys.js';

/**
 * catalogue, as identity tells it to put a Message to the User of an Excel key (MSG-KEY-01, MSG-KEY-02),
 * with the Google ID token of identity for catalogue's own address (TR-PF-05).
 */
export function createCatalogueNotices(baseUrl: string, request: typeof fetch, idToken: IdTokenSource): Notices {
  return {
    async tell(notice: KeyNotice) {
      const response = await request(`${baseUrl}/internal/excel-keys/notices`, {
        method: 'POST',
        headers: { authorization: `Bearer ${await idToken(baseUrl)}`, 'content-type': 'application/json' },
        body: JSON.stringify(notice),
      });
      if (!response.ok) {
        throw new Error(`catalogue answered ${response.status} to a notice about an Excel key`);
      }
    },
  };
}

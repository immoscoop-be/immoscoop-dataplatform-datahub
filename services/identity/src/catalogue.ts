import type { IdTokenSource } from '@datahub/google';
import type { KeyNotice, Notices } from './excel-keys.js';
import type { OwnerUnits } from './groups.js';
import type { UserNotice, UserNotices } from './permission-groups.js';

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

/**
 * catalogue, as identity tells it to put a Message to a User whose Permission group changed for them
 * (MSG-USR-01, FR-PL-12), or to the Data Team when Admin was given back through datahub-datateam@
 * (MSG-USR-02, EC-PL-03) or when a new User signed in for the first time (MSG-USR-03, FR-PL-16), with the
 * Google ID token of identity for catalogue's own address.
 */
export function createCatalogueUserNotices(baseUrl: string, request: typeof fetch, idToken: IdTokenSource): UserNotices {
  return {
    async tellUser(notice: UserNotice) {
      const response = await request(`${baseUrl}/internal/users/notices`, {
        method: 'POST',
        headers: { authorization: `Bearer ${await idToken(baseUrl)}`, 'content-type': 'application/json' },
        body: JSON.stringify(notice),
      });
      if (!response.ok) {
        throw new Error(`catalogue answered ${response.status} to a notice about a Permission group`);
      }
    },
  };
}

/**
 * catalogue, as identity asks it what a Group owns as the Owner Unit of Collections before it deletes the Group
 * (TR-UM-05), with the Google ID token of identity for catalogue's own address.
 */
export function createCatalogueOwnerUnits(baseUrl: string, request: typeof fetch, idToken: IdTokenSource): OwnerUnits {
  return {
    async collectionsOf(groupId: string) {
      const response = await request(`${baseUrl}/internal/owner-units/${encodeURIComponent(groupId)}`, {
        headers: { authorization: `Bearer ${await idToken(baseUrl)}` },
      });
      if (!response.ok) {
        throw new Error(`catalogue answered ${response.status} when asked what a group owns`);
      }
      const body = (await response.json()) as { count?: unknown; names?: unknown };
      return { count: Number(body.count ?? 0), names: Array.isArray(body.names) ? body.names.map(String) : [] };
    },
  };
}

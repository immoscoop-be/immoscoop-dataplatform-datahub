import type { IdTokenSource } from '@datahub/google';
import type { People, Person } from './notifications.js';

/** A group of the User, as identity reads it from Workspace (TR-CO-03). */
export interface Group {
  id: string;
  email: string;
  name: string;
}

/** What catalogue asks identity, always with the Access Token of the User. */
export interface Identity {
  /** The groups the User is in right now, from `GET /me/groups`. */
  groups(authorization: string): Promise<Group[]>;
  /** Every group of the Workspace domain, from `GET /groups`, for who makes Collections for any group (FR-CO-35). */
  domainGroups(authorization: string): Promise<Group[]>;
}

/** identity did not tell the groups of the User; catalogue answers 503 rather than guess. */
export class IdentityUnavailable extends Error {}

export function createIdentity(baseUrl: string, request: typeof fetch = fetch): Identity {
  async function groups(path: string, authorization: string): Promise<Group[]> {
    let response: Response;
    try {
      response = await request(new URL(path, baseUrl), { headers: { authorization }, signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      throw new IdentityUnavailable('identity did not answer', { cause: error });
    }
    if (!response.ok) {
      throw new IdentityUnavailable(`identity answered ${response.status} for ${path}`);
    }
    const body = (await response.json()) as { groups?: Group[] };
    return body.groups ?? [];
  }

  return {
    groups: (authorization) => groups('/me/groups', authorization),
    domainGroups: (authorization) => groups('/groups', authorization),
  };
}

/**
 * Who catalogue notifies, as identity knows them from their last sign-in (DEC-LN-07): the Users asked for, the
 * members of the Groups asked for, and the Users whose Permission group has the Permissions asked for on, each with
 * which of those they have (TR-PL-08). Asked as catalogue, with a Google ID token for identity's address.
 */
export function createPeople(baseUrl: string, idToken: IdTokenSource, request: typeof fetch = fetch): People {
  return {
    async find(asked) {
      if (asked.users.length + asked.groups.length + asked.permissions.length === 0) return [];
      let response: Response;
      try {
        response = await request(new URL('/internal/people', baseUrl), {
          method: 'POST',
          headers: { authorization: `Bearer ${await idToken(baseUrl)}`, 'content-type': 'application/json' },
          body: JSON.stringify(asked),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (error) {
        throw new IdentityUnavailable('identity did not answer', { cause: error });
      }
      if (!response.ok) {
        throw new IdentityUnavailable(`identity answered ${response.status} for /internal/people`);
      }
      return ((await response.json()) as { people: Person[] }).people;
    },
  };
}

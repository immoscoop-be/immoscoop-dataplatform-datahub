import type { IdTokenSource } from '@datahub/google';
import type { People, Person } from './notifications.js';

/** A Group kept in Data Hub (DEC-UM-10), as identity tells it (TR-CO-03); it has no address. */
export interface Group {
  id: string;
  /** The address of a Google group an older Collection kept as its Owner Unit; null for a Group of Data Hub. */
  email?: string | null;
  name: string;
}

/** What catalogue asks identity, always with the Access Token of the User. */
export interface Identity {
  /** The Groups the User is in right now, from `GET /me/groups`, without those they only manage. */
  groups(authorization: string): Promise<Group[]>;
  /** Every Group, from `GET /groups`, for who makes Collections for any Group (FR-CO-35). */
  domainGroups(authorization: string): Promise<Group[]>;
}

/** identity did not tell the groups of the User; catalogue answers 503 rather than guess. */
export class IdentityUnavailable extends Error {}

export function createIdentity(baseUrl: string, request: typeof fetch = fetch): Identity {
  async function groups(path: string, authorization: string): Promise<(Group & { isMember?: boolean })[]> {
    let response: Response;
    try {
      response = await request(new URL(path, baseUrl), { headers: { authorization }, signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      throw new IdentityUnavailable('identity did not answer', { cause: error });
    }
    if (!response.ok) {
      throw new IdentityUnavailable(`identity answered ${response.status} for ${path}`);
    }
    const body = (await response.json()) as { groups?: (Group & { isMember?: boolean })[] };
    return body.groups ?? [];
  }

  return {
    groups: async (authorization) =>
      (await groups('/me/groups', authorization)).filter((group) => group.isMember !== false).map((group) => ({ id: group.id, name: group.name, email: null })),
    domainGroups: async (authorization) => (await groups('/groups', authorization)).map((group) => ({ id: group.id, name: group.name, email: null })),
  };
}

/**
 * Sends identity the Owner Units of the Collections, so that each Google group among them becomes a Group of Data
 * Hub once (FR-UM-20, TR-UM-04), as catalogue, with a Google ID token for identity's address. It repeats at every start.
 */
export function createGroupMoves(baseUrl: string, idToken: IdTokenSource, request: typeof fetch = fetch) {
  return async (owners: { id: string; name: string }[]): Promise<string[]> => {
    const response = await request(new URL('/internal/groups/move', baseUrl), {
      method: 'POST',
      headers: { authorization: `Bearer ${await idToken(baseUrl)}`, 'content-type': 'application/json' },
      body: JSON.stringify({ groups: owners }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new IdentityUnavailable(`identity answered ${response.status} for /internal/groups/move`);
    return ((await response.json()) as { moved: string[] }).moved;
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

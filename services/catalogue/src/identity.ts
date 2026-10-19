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
}

/** identity did not tell the groups of the User; catalogue answers 503 rather than guess. */
export class IdentityUnavailable extends Error {}

export function createIdentity(baseUrl: string, request: typeof fetch = fetch): Identity {
  return {
    async groups(authorization) {
      let response: Response;
      try {
        response = await request(new URL('/me/groups', baseUrl), { headers: { authorization }, signal: AbortSignal.timeout(10_000) });
      } catch (error) {
        throw new IdentityUnavailable('identity did not answer', { cause: error });
      }
      if (!response.ok) {
        throw new IdentityUnavailable(`identity answered ${response.status} for the groups of the User`);
      }
      const body = (await response.json()) as { groups?: Group[] };
      return body.groups ?? [];
    },
  };
}

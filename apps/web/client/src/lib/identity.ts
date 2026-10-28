import type { SettingKey, UserSettings } from '@datahub/contracts/settings';
import type { Config } from './config.js';
import type { Session } from './session.js';

/** The User as identity knows them, from their Access Token. */
export interface Me {
  sub: string;
  email: string;
  name: string;
  groups: string[];
  roles: string[];
}

/** A group of the User, read from Workspace (FR-UM-11). */
export interface Group {
  id: string;
  email: string;
  name: string;
}

/** The session ended: the page signs in again. */
export class SignedOut extends Error {
  constructor() {
    super('The session has ended');
  }
}

/** The calls of the page to identity, with the Access Token of the User. */
export function createIdentity(config: Config, session: Pick<Session, 'accessToken'>, request: typeof fetch = (input, init) => fetch(input, init)) {
  async function call(path: string, init: { method?: string; body?: unknown } = {}): Promise<Response> {
    const token = await session.accessToken();
    if (!token) {
      throw new SignedOut();
    }
    const headers: Record<string, string> = { authorization: `Bearer ${token}` };
    if (init.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    const response = await request(`${config.identityUrl}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (response.status === 401) {
      throw new SignedOut();
    }
    if (!response.ok) {
      throw new Error(`identity answered ${response.status} to ${init.method ?? 'GET'} ${path}`);
    }
    return response;
  }
  const setting = (key: SettingKey) => `/me/settings/${encodeURIComponent(key)}`;

  return {
    async me(): Promise<Me> {
      return (await call('/me')).json() as Promise<Me>;
    },
    async groups(): Promise<Group[]> {
      return ((await (await call('/me/groups')).json()) as { groups: Group[] }).groups;
    },
    async settings(): Promise<UserSettings> {
      return ((await (await call('/me/settings')).json()) as { settings: UserSettings }).settings;
    },
    async saveSetting(key: SettingKey, value: unknown): Promise<void> {
      await call(setting(key), { method: 'PUT', body: { value } });
    },
    async removeSetting(key: SettingKey): Promise<void> {
      await call(setting(key), { method: 'DELETE' });
    },
  };
}

export type Identity = ReturnType<typeof createIdentity>;

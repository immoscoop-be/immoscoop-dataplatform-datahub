import type { SettingKey, UserSettings } from '@datahub/contracts/settings';
import { createCall } from './api.js';
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

export { SignedOut } from './api.js';

/** The calls of the page to identity, with the Access Token of the User. */
export function createIdentity(config: Config, session: Pick<Session, 'accessToken'>, request?: typeof fetch) {
  const call = createCall('identity', config.identityUrl, session, request);
  const setting = (key: SettingKey) => `/me/settings/${encodeURIComponent(key)}`;

  return {
    async me(): Promise<Me> {
      return (await call('/me')).json() as Promise<Me>;
    },
    async groups(): Promise<Group[]> {
      return ((await (await call('/me/groups')).json()) as { groups: Group[] }).groups;
    },
    /** Every group of the domain: only the Data Team may ask, to hand a Collection to any of them (FR-CO-35). */
    async domainGroups(): Promise<Group[]> {
      return ((await (await call('/groups')).json()) as { groups: Group[] }).groups;
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

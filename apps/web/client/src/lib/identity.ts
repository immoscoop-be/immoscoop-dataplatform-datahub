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
/** An Excel key as identity lists it: never the key itself (FR-PL-02). */
export interface ExcelKey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  revokedAt: string | null;
  /** Who revoked it, by name. */
  revokedBy: string | null;
}

/** An Excel key with its User, as the Data Team lists every key (FR-PL-03). */
export interface KeyOfUser extends ExcelKey {
  user: { id: string; name: string; email: string };
}

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
    /** The Excel keys of the User (FR-PL-02). */
    async excelKeys(): Promise<ExcelKey[]> {
      return ((await (await call('/me/excel-keys')).json()) as { keys: ExcelKey[] }).keys;
    },
    /** Makes an Excel key: the key itself comes this once, and never again (FR-PL-01). */
    async makeExcelKey(name: string): Promise<{ key: ExcelKey; secret: string }> {
      return (await call('/me/excel-keys', { method: 'POST', body: { name } })).json() as Promise<{ key: ExcelKey; secret: string }>;
    },
    async revokeExcelKey(id: string): Promise<void> {
      await call(`/me/excel-keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    /** Every Excel key with its User: only the Data Team may ask (FR-PL-03). */
    async allExcelKeys(): Promise<KeyOfUser[]> {
      return ((await (await call('/excel-keys')).json()) as { keys: KeyOfUser[] }).keys;
    },
    /** Revokes the key of anyone: only the Data Team may, and its User gets a Message (MSG-KEY-02). */
    async revokeAnyExcelKey(id: string): Promise<void> {
      await call(`/excel-keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
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

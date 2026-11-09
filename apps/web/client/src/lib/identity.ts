import { completePermissions, type Permissions } from '@datahub/contracts/permissions';
import type { SettingKey, UserSettings } from '@datahub/contracts/settings';
import { createCall } from './api.js';
import type { Config } from './config.js';
import type { Session } from './session.js';

/** A Permission group by its id and name, as a User carries it (FR-PL-04). */
export interface GroupRef {
  id: string;
  name: string;
}

/** The User as identity knows them, from their Access Token: their Permission group and its Permissions, never a role (FR-PL-14). */
export interface Me {
  sub: string;
  email: string;
  name: string;
  groups: string[];
  permissionGroup: GroupRef;
  /** Complete: a Permission identity did not send is no (TR-PL-05). */
  permissions: Permissions;
}

/** A User as Admin lists them on Users (FR-PL-06). */
export interface UserOfAdmin {
  googleId: string;
  email: string;
  name: string;
  permissionGroup: GroupRef;
  /** Their Google groups, by fixed id: their Owner Units among them. */
  groups: string[];
  /** Their first sign-in. */
  createdAt: string;
  lastLoginAt: string | null;
  /** What they used: the web app, Claude, Excel. */
  uses: { web: boolean; claude: boolean; excel: boolean };
  /** Whether they can still sign in with Google. */
  active: boolean;
}

/** One move of the Permission group of a User, newest first; `from` and `by` are null for the default at their first sign-in (FR-PL-07). */
export interface GroupMove {
  at: string;
  from: string | null;
  to: string;
  by: string | null;
}

/** A Permission group as Admin shows it (FR-PL-05, FR-PL-09). */
export interface PermissionGroup {
  id: string;
  name: string;
  sentence: string;
  permissions: Permissions;
  /** The group a new User gets at their first sign-in. */
  isDefault: boolean;
  /** Admin: every Permission at its widest, never changed nor deleted (FR-PL-08). */
  locked: boolean;
  /** How many Users are in it. */
  users: number;
  updatedAt: string;
  updatedBy: string | null;
}

/** A group as identity sends it, with its Permissions completed. */
const groupOf = (group: PermissionGroup): PermissionGroup => ({ ...group, permissions: completePermissions(group.permissions) });

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
  /** Who revoked it, by name, and by Google ID. */
  revokedBy: string | null;
  revokedById: string | null;
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
      const me = (await (await call('/me')).json()) as Me;
      return { ...me, permissionGroup: me.permissionGroup ?? { id: '', name: '' }, permissions: completePermissions(me.permissions) };
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
    /** Every User who signed in, with their Permission group: with `admin.open` for Users (FR-PL-06). */
    async users(): Promise<UserOfAdmin[]> {
      return ((await (await call('/users')).json()) as { users: UserOfAdmin[] }).users;
    },
    /** One User, with the history of their Permission group, newest first (FR-PL-07). */
    async user(googleId: string): Promise<{ user: UserOfAdmin; history: GroupMove[] }> {
      return (await call(`/users/${encodeURIComponent(googleId)}`)).json() as Promise<{ user: UserOfAdmin; history: GroupMove[] }>;
    },
    /** Moves a User to another Permission group: refused for yourself (own_group) and for the last User of Admin (last_admin, FR-PL-08). */
    async moveUser(googleId: string, groupId: string): Promise<UserOfAdmin> {
      const answer = await call(`/users/${encodeURIComponent(googleId)}/permission-group`, { method: 'PUT', body: { groupId } });
      return ((await answer.json()) as { user: UserOfAdmin }).user;
    },
    /** Every Permission group, with its Permissions and number of Users (FR-PL-09). */
    async permissionGroups(): Promise<PermissionGroup[]> {
      return ((await (await call('/permission-groups')).json()) as { groups: PermissionGroup[] }).groups.map(groupOf);
    },
    /** A new Permission group, a copy of another or with every Permission no, without Users (FR-PL-10). */
    async makePermissionGroup(fields: { name: string; sentence: string; from: string | null }): Promise<PermissionGroup> {
      return groupOf(((await (await call('/permission-groups', { method: 'POST', body: fields })).json()) as { group: PermissionGroup }).group);
    },
    /** Renames a Permission group, or changes its sentence or Permissions, all at once; Admin is refused (locked). */
    async changePermissionGroup(id: string, changes: { name?: string; sentence?: string; permissions?: Permissions }): Promise<PermissionGroup> {
      const answer = await call(`/permission-groups/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes });
      return groupOf(((await answer.json()) as { group: PermissionGroup }).group);
    },
    /** Makes a Permission group the default for new Users, taking it from the one before. */
    async makeDefault(id: string): Promise<PermissionGroup> {
      return groupOf(((await (await call(`/permission-groups/${encodeURIComponent(id)}/default`, { method: 'PUT' })).json()) as { group: PermissionGroup }).group);
    },
    /** Deletes a Permission group, its Users going to another, which becomes the default when the deleted one was. */
    async deletePermissionGroup(id: string, moveTo: string): Promise<void> {
      await call(`/permission-groups/${encodeURIComponent(id)}`, { method: 'DELETE', body: { moveTo } });
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

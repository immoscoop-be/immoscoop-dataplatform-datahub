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
  /** The Groups they are in, by id and name: their Owner Units among them (FR-UM-12). */
  groups: { id: string; name: string }[];
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

/** Who did something to a Group: by Google ID and name, both null for what Data Hub did itself, such as a move from Google. */
export interface GroupActor {
  id: string | null;
  name: string | null;
}

/**
 * A Group kept in Data Hub, as a list shows it (FR-UM-12, FR-UM-18): how the User stands to it, for its tag. A Group
 * manages itself when `managedBy.id` is its own id; `mayChange` is whether the User is in the Group that manages it,
 * or may change every Group (`groups.all.manage`).
 */
export interface GroupSummary {
  id: string;
  name: string;
  sentence: string;
  managedBy: { id: string; name: string; isMember: boolean };
  memberCount: number;
  isMember: boolean;
  mayChange: boolean;
}

/** A member of a Group, kept by address: without a name until they signed in (OP-UX-70), not active once they left (FR-UM-15). */
export interface GroupMember {
  email: string;
  name: string | null;
  signedIn: boolean;
  active: boolean;
  addedAt: string;
  addedBy: GroupActor;
}

/** What happened to a Group, as its history shows it (FR-UM-17). */
export interface GroupLogEntry {
  at: string;
  kind: 'made' | 'renamed' | 'sentence' | 'managedBy' | 'added' | 'removed' | 'moved' | 'deleted';
  by: GroupActor;
  /** Such as `{ from, to }` for a rename, `{ email }` for a member added or taken out, `{ from: 'Google', members }` for a move. */
  detail: Record<string, unknown>;
}

/** A Group opened: its members, the Groups it manages, who made it and when, and its history, newest first (FR-UM-18). */
export interface GroupDetail extends GroupSummary {
  members: GroupMember[];
  manages: { id: string; name: string }[];
  createdAt: string;
  createdBy: GroupActor;
  log: GroupLogEntry[];
}

/** A colleague to suggest while adding a member (FR-UM-15). */
export interface Person {
  email: string;
  name: string;
}

/** What a change of a Group sends: `itself` lets it manage itself (FR-UM-13, FR-UM-14). */
export interface GroupFields {
  name: string;
  sentence: string;
  managedBy: string | 'itself';
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
  const group = (id: string) => `/groups/${encodeURIComponent(id)}`;

  return {
    async me(): Promise<Me> {
      const me = (await (await call('/me')).json()) as Me;
      return { ...me, permissionGroup: me.permissionGroup ?? { id: '', name: '' }, permissions: completePermissions(me.permissions) };
    },
    /** The Groups the User is in or manages (FR-UM-18). */
    async groups(): Promise<GroupSummary[]> {
      return ((await (await call('/me/groups')).json()) as { groups: GroupSummary[] }).groups;
    },
    /**
     * Every Group: only with `groups.all.manage`, or to hand a Collection to any Group (`collections.make`, any,
     * FR-CO-35).
     */
    async allGroups(): Promise<GroupSummary[]> {
      return ((await (await call('/groups')).json()) as { groups: GroupSummary[] }).groups;
    },
    /** One Group, for any signed-in User (FR-UM-18). */
    async group(id: string): Promise<GroupDetail> {
      return ((await (await call(group(id))).json()) as { group: GroupDetail }).group;
    },
    /** A new Group, with the User as its first member (FR-UM-13). */
    async makeGroup(fields: GroupFields): Promise<GroupDetail> {
      return ((await (await call('/groups', { method: 'POST', body: fields })).json()) as { group: GroupDetail }).group;
    },
    /** Renames a Group, changes its sentence, or the Group that manages it (FR-UM-14). */
    async changeGroup(id: string, changes: Partial<GroupFields>): Promise<GroupDetail> {
      return ((await (await call(group(id), { method: 'PATCH', body: changes })).json()) as { group: GroupDetail }).group;
    },
    /** Adds a colleague by address, also one who has not signed in yet: refused for another domain (invalid_email, FR-UM-15). */
    async addMember(id: string, email: string): Promise<GroupDetail> {
      return ((await (await call(`${group(id)}/members`, { method: 'PUT', body: { email } })).json()) as { group: GroupDetail }).group;
    },
    async removeMember(id: string, email: string): Promise<GroupDetail> {
      return ((await (await call(`${group(id)}/members/${encodeURIComponent(email)}`, { method: 'DELETE' })).json()) as { group: GroupDetail }).group;
    },
    /** Deletes a Group that owns and manages nothing: refused otherwise with still_owns, and what it still has (FR-UM-16). */
    async deleteGroup(id: string): Promise<void> {
      await call(group(id), { method: 'DELETE' });
    },
    /** Colleagues whose name or address holds what was typed, from two characters on (FR-UM-15). */
    async people(q: string): Promise<Person[]> {
      return ((await (await call(`/people?${new URLSearchParams({ q })}`)).json()) as { people: Person[] }).people;
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

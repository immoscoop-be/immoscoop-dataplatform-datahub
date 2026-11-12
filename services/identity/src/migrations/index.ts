import type { Migration } from 'kysely/migration';
import * as users from './0001-users.js';
import * as signIn from './0002-sign-in.js';
import * as settings from './0003-settings.js';
import * as groups from './0004-groups.js';
import * as excelKeys from './0005-excel-keys.js';
import * as forgetTheme from './0006-forget-theme.js';
import * as permissionGroups from './0007-permission-groups.js';
import * as groupsInDataHub from './0008-groups.js';
import * as removeAndWithdrawn from './0009-remove-and-withdrawn.js';

/** The migrations of identity, by name; they run in the order of their names (TR-PF-09). */
export const migrations: Record<string, Migration> = {
  '0001-users': users,
  '0002-sign-in': signIn,
  '0003-settings': settings,
  '0004-groups': groups,
  '0005-excel-keys': excelKeys,
  '0006-forget-theme': forgetTheme,
  '0007-permission-groups': permissionGroups,
  '0008-groups': groupsInDataHub,
  '0009-remove-and-withdrawn': removeAndWithdrawn,
};

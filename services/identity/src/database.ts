import type { Permissions } from '@datahub/contracts';
import type { ColumnType, Generated } from 'kysely';
import type { TokenSubject } from './tokens.js';

/** A timestamp: read as a Date, written as a Date or left to the database. */
type Timestamp = ColumnType<Date, Date | undefined, Date>;

/** The tables of identity, in camelCase (the columns are snake_case in Postgres). */
export interface IdentityDatabase {
  users: {
    googleId: string;
    email: string;
    name: string;
    createdAt: Timestamp;
    lastLoginAt: Timestamp;
    /** The fixed IDs of their Groups of the own domains, and their roles, as last read (DEC-LN-07). */
    groups: ColumnType<string[], string[] | undefined, string[]>;
    roles: ColumnType<string[], string[] | undefined, string[]>;
    /** Their Permission group (FR-PL-04): the default at their first sign-in. */
    permissionGroupId: string;
  };
  /** The Permission groups (TR-PL-04): one is the default, Admin is locked. */
  permissionGroups: {
    id: Generated<string>;
    name: string;
    sentence: ColumnType<string, string | undefined, string>;
    permissions: ColumnType<Permissions, string, string>;
    isDefault: ColumnType<boolean, boolean | undefined, boolean>;
    locked: ColumnType<boolean, boolean | undefined, boolean>;
    /** The starting group it was made as, if any: admin, businessAnalyst or lensUser. */
    starting: ColumnType<string | null, string | null | undefined, string | null>;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    updatedById: ColumnType<string | null, string | null | undefined, string | null>;
    updatedByName: ColumnType<string | null, string | null | undefined, string | null>;
  };
  /** Every move of a User and every change of a Permission group (FR-PL-07). */
  permissionGroupLog: {
    id: Generated<string>;
    at: Timestamp;
    kind: string;
    googleId: string | null;
    groupId: string | null;
    fromName: string | null;
    toName: string | null;
    byId: string | null;
    byName: string | null;
    detail: ColumnType<Record<string, unknown>, string | undefined, string>;
  };
  clients: {
    clientId: string;
    name: string;
    redirectUris: ColumnType<string[], string, string>;
    createdAt: Timestamp;
  };
  authorizationRequests: {
    id: string;
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    clientState: string | null;
    nonce: string;
    googleCodeVerifier: string;
    expiresAt: Date;
  };
  authorizationCodes: {
    codeHash: string;
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    googleId: string;
    claims: ColumnType<TokenSubject, string, string>;
    expiresAt: Date;
  };
  sessions: {
    id: Generated<string>;
    googleId: string;
    clientId: string;
    createdAt: Timestamp;
    expiresAt: Date;
    endedAt: Date | null;
    endReason: string | null;
  };
  refreshTokens: {
    tokenHash: string;
    sessionId: string;
    createdAt: Timestamp;
    usedAt: Date | null;
  };
  /** The Excel keys of the Users, by hash only (TR-PF-07). */
  excelKeys: {
    id: Generated<string>;
    googleId: string;
    name: string;
    keyHash: string;
    createdAt: Timestamp;
    expiresAt: Date;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
    revokedBy: string | null;
    revokedByName: string | null;
    warnedAt: Date | null;
  };
  settings: {
    googleId: string;
    key: string;
    value: ColumnType<unknown, string, string>;
    updatedAt: Timestamp;
  };
}

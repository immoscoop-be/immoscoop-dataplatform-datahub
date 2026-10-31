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

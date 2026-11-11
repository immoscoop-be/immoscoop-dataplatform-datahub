import { createHash, randomBytes } from 'node:crypto';
import { type Kysely, sql, type SqlBool } from 'kysely';
import type { IdentityDatabase } from './database.js';
import { createGroups } from './groups.js';
import type { GoogleIdentity } from './google-sign-in.js';
import type { TokenSubject } from './tokens.js';

/** A random value of 256 bits, as base64url: for state, nonce, verifiers, codes and Refresh Tokens. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Codes and Refresh Tokens are stored as their SHA-256 hash only: a copy of the database signs no one in. */
export function hash(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export interface AuthorizationRequest {
  id: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  clientState: string | null;
  nonce: string;
  googleCodeVerifier: string;
}

export interface Session {
  id: string;
  googleId: string;
  clientId: string;
  expiresAt: Date;
}

/** A User as catalogue asks for them, to notify them (DEC-LN-07). */
export interface Person {
  /** Their fixed Google ID; null for a member of a Group who has not signed in yet (FR-UM-15). */
  id: string | null;
  email: string;
  name: string;
  language: 'nl' | 'en';
  /** Which of the Groups and Permissions asked for they hold (TR-PL-08). */
  groups: string[];
  permissions: string[];
}

/** Why a Refresh Token gives no new Access Token. */
export type RefreshRefusal = 'unknown' | 'other-client' | 'ended' | 'expired' | 'used-just-now' | 'reused';

/** Everything identity keeps about signing in, in its own schema (TR-PF-08). */
export function createStore(db: Kysely<IdentityDatabase>, now: () => Date = () => new Date()) {
  const groups = createGroups(db, now);
  const inSeconds = (seconds: number) => new Date(now().getTime() + seconds * 1000);

  return {
    async registerClient(client: { name: string; redirectUris: string[] }): Promise<string> {
      const clientId = randomToken();
      await db
        .insertInto('clients')
        .values({ clientId, name: client.name, redirectUris: JSON.stringify(client.redirectUris) })
        .execute();
      return clientId;
    },

    async client(clientId: string): Promise<{ clientId: string; name: string; redirectUris: string[] } | undefined> {
      return db.selectFrom('clients').select(['clientId', 'name', 'redirectUris']).where('clientId', '=', clientId).executeTakeFirst();
    },

    /** A sign-in at Google under way, valid for 10 minutes. */
    async startAuthorization(request: Omit<AuthorizationRequest, 'id'>): Promise<AuthorizationRequest> {
      const stored = { ...request, id: randomToken() };
      await db.insertInto('authorizationRequests').values({ ...stored, expiresAt: inSeconds(600) }).execute();
      return stored;
    },

    /** Takes a sign-in under way, once: Google's answer cannot be replayed. */
    async takeAuthorization(id: string): Promise<AuthorizationRequest | undefined> {
      const request = await db.deleteFrom('authorizationRequests').where('id', '=', id).returningAll().executeTakeFirst();
      if (!request || request.expiresAt < now()) {
        return undefined;
      }
      return request;
    },

    /**
     * Creates the User at the first login, in the default Permission group (FR-PL-04), and recognises them
     * after that (FR-UM-03); says whether they are new.
     */
    async saveUser(identity: GoogleIdentity): Promise<{ created: boolean }> {
      const known = await db.selectFrom('users').select('googleId').where('googleId', '=', identity.sub).executeTakeFirst();
      await db
        .insertInto('users')
        .values({
          googleId: identity.sub,
          email: identity.email,
          name: identity.name,
          permissionGroupId: sql<string>`(select id from permission_groups where is_default)`,
        })
        .onConflict((conflict) =>
          conflict.column('googleId').doUpdateSet({ email: identity.email, name: identity.name, lastLoginAt: now(), active: true }),
        )
        .execute();
      return { created: !known };
    },

    /** The Groups kept in Data Hub (TR-UM-01), on the same database. */
    dataHubGroups: groups,

    /** The Groups of Data Hub an address is in, for the claim `groups` (TR-UM-03). */
    groupsOf: groups.groupsOf,

    /** Keeps the Groups of a User as they went into their Access Token, at a sign-in or a renewal. */
    async saveGroups(googleId: string, list: string[]): Promise<void> {
      await db.updateTable('users').set({ groups: list }).where('googleId', '=', googleId).execute();
    },

    /** The directory said the account is no longer active (DEC-UM-12): nobody reaches them through a Group any more. */
    async markInactive(googleId: string): Promise<void> {
      await db.updateTable('users').set({ active: false, groups: [] }).where('googleId', '=', googleId).execute();
    },

    /**
     * The people among those asked: Users by their fixed Google ID; the members of the Groups asked, also who
     * has not signed in yet (TR-UM-07); and the Users whose Permission group has a Permission on, such as
     * `messages.dataTeam` (TR-PL-08). Each with their address, their name, the language they read Data Hub in,
     * Dutch unless they chose another (DEC-UX-96), and which of the Groups and Permissions asked they hold.
     * A User whose account is no longer active is found only by their ID.
     */
    async people(asked: { users: string[]; groups: string[]; permissions: string[] }): Promise<Person[]> {
      if (asked.users.length + asked.groups.length + asked.permissions.length === 0) return [];
      const held = (key: string) => sql<SqlBool>`(permission_groups.permissions -> ${key} ->> 'on') = 'true'`;
      const memberOf = sql<string[]>`coalesce((select array_agg(group_members.group_id order by group_members.group_id)
        from group_members join groups on groups.id = group_members.group_id and groups.deleted_at is null
        where group_members.email = lower(users.email) and group_members.group_id = any(${asked.groups}::text[])), '{}')`;
      const rows = await db
        .selectFrom('users')
        .innerJoin('permissionGroups', 'permissionGroups.id', 'users.permissionGroupId')
        .leftJoin('settings', (join) => join.onRef('settings.googleId', '=', 'users.googleId').on('settings.key', '=', 'language'))
        .select(['users.googleId', 'users.email', 'users.name', 'users.active', 'permissionGroups.permissions', 'settings.value as language', memberOf.as('inGroups')])
        .where((where) =>
          where.or([
            ...(asked.users.length ? [where('users.googleId', 'in', asked.users)] : []),
            ...(asked.groups.length ? [sql<SqlBool>`(users.active and cardinality(${memberOf}) > 0)`] : []),
            ...asked.permissions.map((key) => sql<SqlBool>`(${held(key)} and users.active)`),
          ]),
        )
        .orderBy('users.googleId')
        .execute();
      const people: Person[] = rows.map((row) => {
        const permissions = row.permissions as unknown as Record<string, { on?: unknown } | undefined>;
        return {
          id: row.googleId,
          email: row.email,
          name: row.name,
          language: row.language === 'en' ? 'en' : 'nl',
          groups: row.active ? row.inGroups : [],
          permissions: row.active ? asked.permissions.filter((key) => permissions[key]?.on === true) : [],
        };
      });
      if (asked.groups.length) {
        // Members who have not signed in yet: only their address, read in Dutch.
        const pending = await db
          .selectFrom('groupMembers')
          .innerJoin('groups', 'groups.id', 'groupMembers.groupId')
          .select(['groupMembers.email', sql<string[]>`array_agg(group_members.group_id order by group_members.group_id)`.as('inGroups')])
          .where('groupMembers.groupId', 'in', asked.groups)
          .where('groups.deletedAt', 'is', null)
          .where(sql<SqlBool>`not exists (select 1 from users where lower(users.email) = group_members.email)`)
          .groupBy('groupMembers.email')
          .orderBy('groupMembers.email')
          .execute();
        for (const member of pending) people.push({ id: null, email: member.email, name: '', language: 'nl', groups: member.inGroups, permissions: [] });
      }
      return people;
    },

    async user(googleId: string): Promise<{ googleId: string; email: string; name: string } | undefined> {
      return db.selectFrom('users').select(['googleId', 'email', 'name']).where('googleId', '=', googleId).executeTakeFirst();
    },

    /** A one-time code for the client, valid for one minute, with what goes into the first Access Token. */
    async createCode(code: { clientId: string; redirectUri: string; codeChallenge: string; claims: TokenSubject }): Promise<string> {
      const value = randomToken();
      await db
        .insertInto('authorizationCodes')
        .values({
          codeHash: hash(value),
          clientId: code.clientId,
          redirectUri: code.redirectUri,
          codeChallenge: code.codeChallenge,
          googleId: code.claims.sub,
          claims: JSON.stringify(code.claims),
          expiresAt: inSeconds(60),
        })
        .execute();
      return value;
    },

    /** Takes a code, once. */
    async takeCode(value: string) {
      const code = await db.deleteFrom('authorizationCodes').where('codeHash', '=', hash(value)).returningAll().executeTakeFirst();
      if (!code || code.expiresAt < now()) {
        return undefined;
      }
      return code;
    },

    /** Starts a session and returns its first Refresh Token. */
    async startSession(session: { googleId: string; clientId: string; lifetimeSeconds: number }): Promise<{ session: Session; refreshToken: string }> {
      const started = await db
        .insertInto('sessions')
        .values({ googleId: session.googleId, clientId: session.clientId, expiresAt: inSeconds(session.lifetimeSeconds) })
        .returning(['id', 'googleId', 'clientId', 'expiresAt'])
        .executeTakeFirstOrThrow();
      const refreshToken = await this.addRefreshToken(started.id);
      return { session: started, refreshToken };
    },

    async addRefreshToken(sessionId: string): Promise<string> {
      const value = randomToken();
      await db.insertInto('refreshTokens').values({ tokenHash: hash(value), sessionId }).execute();
      return value;
    },

    /**
     * Checks a Refresh Token, which works once (TR-PF-25), without using it yet: the checks at
     * Workspace come first, so a short outage at Google never costs a client its token. A token
     * that was used before has been copied, so the whole session ends; except within a few
     * seconds of its first use, when two tabs of the same browser renewed at the same moment.
     */
    async checkRefreshToken(value: string, clientId: string): Promise<Session | RefreshRefusal> {
      const found = await db
        .selectFrom('refreshTokens')
        .innerJoin('sessions', 'sessions.id', 'refreshTokens.sessionId')
        .select(['sessions.id', 'sessions.googleId', 'sessions.clientId', 'sessions.expiresAt', 'sessions.endedAt', 'refreshTokens.usedAt'])
        .where('refreshTokens.tokenHash', '=', hash(value))
        .executeTakeFirst();
      if (!found) {
        return 'unknown';
      }
      if (found.clientId !== clientId) {
        return 'other-client';
      }
      if (found.endedAt) {
        return 'ended';
      }
      if (found.expiresAt < now()) {
        return 'expired';
      }
      if (found.usedAt) {
        if (now().getTime() - found.usedAt.getTime() < 30_000) {
          return 'used-just-now';
        }
        await this.endSession(found.id, 'refresh-token-reused');
        return 'reused';
      }
      return { id: found.id, googleId: found.googleId, clientId: found.clientId, expiresAt: found.expiresAt };
    },

    /** Uses a checked Refresh Token; false when another request used it in the meantime. */
    async consumeRefreshToken(value: string): Promise<boolean> {
      const marked = await db
        .updateTable('refreshTokens')
        .set({ usedAt: now() })
        .where('tokenHash', '=', hash(value))
        .where('usedAt', 'is', null)
        .executeTakeFirst();
      return marked.numUpdatedRows > 0n;
    },

    /** Moves the end of a session that is renewed as it is used (Claude: 30 days from now). */
    async extendSession(sessionId: string, lifetimeSeconds: number): Promise<void> {
      await db.updateTable('sessions').set({ expiresAt: inSeconds(lifetimeSeconds) }).where('id', '=', sessionId).execute();
    },

    async endSession(sessionId: string, reason: string): Promise<void> {
      await db.updateTable('sessions').set({ endedAt: now(), endReason: reason }).where('id', '=', sessionId).where('endedAt', 'is', null).execute();
    },

    /** Ends every session of a User at once, such as when the account is suspended (TR-PF-26). */
    async endSessionsOf(googleId: string, reason: string): Promise<void> {
      await db.updateTable('sessions').set({ endedAt: now(), endReason: reason }).where('googleId', '=', googleId).where('endedAt', 'is', null).execute();
    },

    /** Ends the session a Refresh Token belongs to (logging out). Unknown tokens are ignored. */
    async endSessionOf(refreshToken: string, reason: string): Promise<void> {
      const found = await db.selectFrom('refreshTokens').select('sessionId').where('tokenHash', '=', hash(refreshToken)).executeTakeFirst();
      if (found) {
        await this.endSession(found.sessionId, reason);
      }
    },

    /** The settings of a User, as keys and values (DEC-UX-96). */
    async settings(googleId: string): Promise<Record<string, unknown>> {
      const rows = await db.selectFrom('settings').select(['key', 'value']).where('googleId', '=', googleId).orderBy('key').execute();
      return Object.fromEntries(rows.map((row) => [row.key, row.value]));
    },

    async saveSetting(googleId: string, key: string, value: unknown): Promise<void> {
      await db
        .insertInto('settings')
        .values({ googleId, key, value: JSON.stringify(value) })
        .onConflict((conflict) => conflict.columns(['googleId', 'key']).doUpdateSet({ value: JSON.stringify(value), updatedAt: now() }))
        .execute();
    },

    async removeSetting(googleId: string, key: string): Promise<void> {
      await db.deleteFrom('settings').where('googleId', '=', googleId).where('key', '=', key).execute();
    },
  };
}

export type Store = ReturnType<typeof createStore>;

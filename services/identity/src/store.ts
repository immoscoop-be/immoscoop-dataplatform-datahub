import { createHash, randomBytes } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { IdentityDatabase } from './database.js';
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

/** Why a Refresh Token gives no new Access Token. */
export type RefreshRefusal = 'unknown' | 'other-client' | 'ended' | 'expired' | 'used-just-now' | 'reused';

/** Everything identity keeps about signing in, in its own schema (TR-PF-08). */
export function createStore(db: Kysely<IdentityDatabase>, now: () => Date = () => new Date()) {
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

    /** Creates the User at the first login and recognises them after that (FR-UM-03). */
    async saveUser(identity: GoogleIdentity): Promise<void> {
      await db
        .insertInto('users')
        .values({ googleId: identity.sub, email: identity.email, name: identity.name })
        .onConflict((conflict) =>
          conflict.column('googleId').doUpdateSet({ email: identity.email, name: identity.name, lastLoginAt: now() }),
        )
        .execute();
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
  };
}

export type Store = ReturnType<typeof createStore>;

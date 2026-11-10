import { randomBytes } from 'node:crypto';
import type { ServiceCallerVerifier } from '@datahub/auth';
import { can, canWith, permissionValue } from '@datahub/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Kysely, Selectable } from 'kysely';
import type { IdentityDatabase } from './database.js';
import type { PermissionGroups } from './permission-groups.js';
import { hash } from './store.js';
import type { TokenIssuer } from './tokens.js';
import type { Workspace } from './workspace.js';

/** An Excel key starts with this, so that it is recognised when it is pasted where it should not be. */
export const KEY_PREFIX = 'dhx_';
/** A key lasts a year (FR-PL-03). */
const LIFETIME_DAYS = 365;
/** Its User is told a month before it expires (FR-PL-03). */
const WARN_DAYS = 30;
/** A key is marked used at most once a minute, not at every request of a refresh. */
const TOUCH_SECONDS = 60;
const DAY = 24 * 60 * 60 * 1000;

/** An Excel key as its User and the Data Team see it: never the key itself. */
export interface ExcelKey {
  id: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
  /** Who revoked it, by name, and by Google ID. */
  revokedBy: string | null;
  revokedById: string | null;
}

/** An Excel key with its User, for the Data Team (FR-PL-03). */
export interface KeyOfUser extends ExcelKey {
  user: { id: string; name: string; email: string };
}

/** What catalogue is told, to put a Message to the User of a key (MSG-KEY-01, MSG-KEY-02). */
export interface KeyNotice {
  type: 'MSG-KEY-01' | 'MSG-KEY-02';
  keyId: string;
  userId: string;
  name: string;
  /** The day it expires, `YYYY-MM-DD`, for MSG-KEY-01; who of the Data Team revoked it, for MSG-KEY-02. */
  expires?: string;
  actor?: string;
}

export interface Notices {
  tell(notice: KeyNotice): Promise<void>;
}

type Row = Selectable<IdentityDatabase['excelKeys']>;

const view = (row: Row): ExcelKey => ({
  id: row.id,
  name: row.name,
  createdAt: row.createdAt,
  lastUsedAt: row.lastUsedAt,
  expiresAt: row.expiresAt,
  revokedAt: row.revokedAt,
  revokedBy: row.revokedByName,
  revokedById: row.revokedBy,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The Excel keys in the schema of identity, by hash only (TR-PF-07). */
export function createExcelKeys(db: Kysely<IdentityDatabase>, now: () => Date = () => new Date()) {
  return {
    async of(googleId: string): Promise<ExcelKey[]> {
      const rows = await db.selectFrom('excelKeys').selectAll().where('googleId', '=', googleId).orderBy('createdAt', 'desc').execute();
      return rows.map(view);
    },

    async all(): Promise<KeyOfUser[]> {
      const rows = await db
        .selectFrom('excelKeys')
        .innerJoin('users', 'users.googleId', 'excelKeys.googleId')
        .selectAll('excelKeys')
        .select(['users.name as userName', 'users.email as userEmail'])
        .orderBy('excelKeys.lastUsedAt', (order) => order.desc().nullsLast())
        .orderBy('excelKeys.createdAt', 'desc')
        .execute();
      return rows.map((row) => ({ ...view(row), user: { id: row.googleId, name: row.userName, email: row.userEmail } }));
    },

    /** Makes a key for a User: the key itself is returned once, and only its hash is kept (FR-PL-01). */
    /** How many keys of a User are neither revoked nor expired. */
    async activeCount(googleId: string): Promise<number> {
      const row = await db
        .selectFrom('excelKeys')
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .where('googleId', '=', googleId)
        .where('revokedAt', 'is', null)
        .where('expiresAt', '>', now())
        .executeTakeFirstOrThrow();
      return Number(row.count);
    },

    async make(googleId: string, name: string, lifetimeDays = LIFETIME_DAYS): Promise<{ key: ExcelKey; secret: string }> {
      const secret = `${KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
      const made = now();
      const row = await db
        .insertInto('excelKeys')
        .values({ googleId, name, keyHash: hash(secret), createdAt: made, expiresAt: new Date(made.getTime() + lifetimeDays * DAY) })
        .returningAll()
        .executeTakeFirstOrThrow();
      return { key: view(row), secret };
    },

    /** Revokes a key at once; only one of `owner` when given. Undefined when there is no such key. */
    async revoke(id: string, by: { id: string; name: string }, owner?: string): Promise<{ key: ExcelKey; userId: string; fresh: boolean } | undefined> {
      if (!UUID.test(id)) return undefined;
      const row = await db
        .selectFrom('excelKeys')
        .selectAll()
        .where('id', '=', id)
        .$if(owner !== undefined, (query) => query.where('googleId', '=', owner!))
        .executeTakeFirst();
      if (!row) return undefined;
      if (row.revokedAt) return { key: view(row), userId: row.googleId, fresh: false };
      const revoked = await db
        .updateTable('excelKeys')
        .set({ revokedAt: now(), revokedBy: by.id, revokedByName: by.name })
        .where('id', '=', id)
        .where('revokedAt', 'is', null)
        .returningAll()
        .executeTakeFirstOrThrow();
      return { key: view(revoked), userId: revoked.googleId, fresh: true };
    },

    /** The key and its User for a key as Excel sends it, if it may be used now: not revoked, not expired. */
    async use(secret: string): Promise<{ key: Row; user: { googleId: string; email: string; name: string } } | undefined> {
      if (!secret.startsWith(KEY_PREFIX) || secret.length > 200) return undefined;
      const found = await db
        .selectFrom('excelKeys')
        .innerJoin('users', 'users.googleId', 'excelKeys.googleId')
        .selectAll('excelKeys')
        .select(['users.email', 'users.name as userName'])
        .where('keyHash', '=', hash(secret))
        .executeTakeFirst();
      if (!found || found.revokedAt || found.expiresAt <= now()) return undefined;
      if (!found.lastUsedAt || now().getTime() - found.lastUsedAt.getTime() > TOUCH_SECONDS * 1000) {
        await db.updateTable('excelKeys').set({ lastUsedAt: now() }).where('id', '=', found.id).execute();
      }
      return { key: found, user: { googleId: found.googleId, email: found.email, name: found.userName } };
    },

    /** The keys that expire within a month and whose User was not told yet; they are marked told. */
    async expiring(): Promise<Row[]> {
      const until = new Date(now().getTime() + WARN_DAYS * DAY);
      return db
        .updateTable('excelKeys')
        .set({ warnedAt: now() })
        .where('revokedAt', 'is', null)
        .where('warnedAt', 'is', null)
        .where('expiresAt', '>', now())
        .where('expiresAt', '<=', until)
        .returningAll()
        .execute();
    },
  };
}

export type ExcelKeys = ReturnType<typeof createExcelKeys>;

export interface ExcelKeyOptions {
  keys: ExcelKeys;
  workspace: Workspace;
  tokens: TokenIssuer;
  /** The Groups of Data Hub a User is in, for the claim `groups` (TR-UM-03). */
  memberships: { groupsOf(email: string): Promise<string[]> };
  /** query, which exchanges a key for an Access Token (TR-PF-07). */
  exchangers: ServiceCallerVerifier;
  /** Cloud Scheduler, which asks once a day which keys expire within a month. */
  schedulers?: ServiceCallerVerifier;
  /** catalogue, told to put a Message to the User of a key. */
  notices: Notices;
  /** The Permission groups, for excel.keys and the Permissions in the Access Token of a key (TR-PL-05). */
  groups: PermissionGroups;
}

/**
 * The Excel keys (FR-PL-01 to FR-PL-03, TR-PF-07): a User makes, lists and revokes their own on My page;
 * the Data Team lists and revokes anyone's in Admin, and its User is told. query exchanges a key Excel sends
 * for an Access Token of its User, its account checked again in Workspace as at a renewal, so that a key stops at once
 * when its User can no longer sign in.
 */
export async function excelKeyRoutes(app: FastifyInstance, options: ExcelKeyOptions): Promise<void> {
  const { keys, workspace, tokens, memberships, exchangers, schedulers, notices, groups } = options;
  // Every Excel key in Admin, with the tool Excel keys (admin.open, FR-PL-03).
  const admin = (request: FastifyRequest) => (request.user ? canWith(request.user.permissions, 'admin.open', 'tools', 'excelKeys') : false);

  function onlyFrom(callers: ServiceCallerVerifier, who: string) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const token = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1] ?? '';
      try {
        await callers.verify(token);
      } catch (error) {
        request.log.warn({ err: error }, `a call for ${request.url} was refused`);
        return reply.code(401).send({ error: 'unauthorized', message: `Only ${who} calls this.` });
      }
    };
  }

  app.get('/me/excel-keys', async (request) => ({ keys: await keys.of(request.user?.sub ?? '') }));

  app.post<{ Body: unknown }>('/me/excel-keys', async (request, reply) => {
    const name = (request.body as { name?: unknown } | null)?.name;
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (trimmed.length < 1 || trimmed.length > 80) {
      return reply.code(400).send({ error: 'invalid_request', message: 'The name of a key has 1 to 80 characters.' });
    }
    // Only with excel.keys, below the number of keys and for the life the Permission group gives (EC-PL-04).
    const permissions = request.user!.permissions;
    if (!can(permissions, 'excel.keys')) {
      return reply.code(403).send({ error: 'forbidden', message: 'Your Permission group does not use Excel keys.', permission: 'excel.keys' });
    }
    const most = permissionValue(permissions, 'excel.keys', 'most');
    if (typeof most === 'number' && (await keys.activeCount(request.user!.sub)) >= most) {
      return reply.code(409).send({ error: 'too_many', message: `Your Permission group allows at most ${most} Excel keys: revoke one first.` });
    }
    const days = Number(permissionValue(permissions, 'excel.keys', 'lifetimeDays') ?? 365);
    const made = await keys.make(request.user?.sub ?? '', trimmed, days);
    reply.header('cache-control', 'no-store');
    return reply.code(201).send(made);
  });

  app.delete<{ Params: { id: string } }>('/me/excel-keys/:id', async (request, reply) => {
    const user = request.user;
    const revoked = await keys.revoke(request.params.id, { id: user?.sub ?? '', name: user?.name || user?.email || '' }, user?.sub ?? '');
    return revoked ? reply.code(204).send() : reply.code(404).send({ error: 'not_found', message: 'No such key of yours.' });
  });

  app.get('/excel-keys', async (request, reply) => {
    if (!admin(request)) return reply.code(403).send({ error: 'forbidden', message: 'Only who may open Excel keys in Admin sees every key.', permission: 'admin.open' });
    return { keys: await keys.all() };
  });

  // The Data Team revokes any key, and its User gets a Message that says so (FR-PL-03, MSG-KEY-02).
  app.delete<{ Params: { id: string } }>('/excel-keys/:id', async (request, reply) => {
    if (!admin(request)) return reply.code(403).send({ error: 'forbidden', message: 'Only who may open Excel keys in Admin revokes the key of someone else.', permission: 'admin.open' });
    const user = request.user!;
    const actor = user.name || user.email;
    const revoked = await keys.revoke(request.params.id, { id: user.sub, name: actor });
    if (!revoked) return reply.code(404).send({ error: 'not_found', message: 'No such key.' });
    if (revoked.fresh && revoked.userId !== user.sub) {
      try {
        await notices.tell({ type: 'MSG-KEY-02', keyId: revoked.key.id, userId: revoked.userId, name: revoked.key.name, actor });
      } catch (error) {
        // The key is revoked whatever catalogue says; the Message is not worth an error.
        request.log.error({ err: error }, 'catalogue was not told that a key was revoked');
      }
    }
    return reply.code(204).send();
  });

  // query exchanges a key for an Access Token of its User (TR-PF-07); the key travels in the body, never in an address.
  app.post<{ Body: unknown }>('/internal/excel-keys/exchange', { config: { public: true }, onRequest: onlyFrom(exchangers, 'query') }, async (request, reply) => {
    const secret = (request.body as { key?: unknown } | null)?.key;
    const found = typeof secret === 'string' ? await keys.use(secret) : undefined;
    if (!found) return reply.code(401).send({ error: 'invalid_key', message: 'This Excel key is not known, revoked or expired.' });
    let claims;
    try {
      // It stops at once when its User can no longer sign in with Google (FR-PL-03).
      if (!(await workspace.isActive(found.user.googleId))) {
        return reply.code(401).send({ error: 'invalid_key', message: 'The User of this Excel key can no longer sign in.' });
      }
      const own = await memberships.groupsOf(found.user.email);
      const granted = await groups.claimsOf(found.user.googleId);
      // Without excel.keys, Excel gets nothing with the keys of its User until they have it again (EC-PL-04).
      if (!can(granted.permissions, 'excel.keys')) {
        return reply.code(401).send({ error: 'invalid_key', message: 'The Permission group of the User of this Excel key does not use Excel keys.' });
      }
      claims = { sub: found.user.googleId, email: found.user.email, name: found.user.name, groups: own, ...granted };
    } catch (error) {
      request.log.error({ err: error }, 'Workspace did not answer for an Excel key');
      return reply.code(503).header('retry-after', '30').send({ error: 'temporarily_unavailable', message: 'Workspace did not answer; try again later.' });
    }
    reply.header('cache-control', 'no-store');
    return { accessToken: await tokens.issue(claims), keyId: found.key.id };
  });

  // Once a day: the Users whose key expires within a month get a Message, once per key (FR-PL-03, MSG-KEY-01).
  if (schedulers) {
    app.post('/internal/excel-keys/expiring', { config: { public: true }, onRequest: onlyFrom(schedulers, 'Cloud Scheduler') }, async (request) => {
      const expiring = await keys.expiring();
      let told = 0;
      for (const key of expiring) {
        try {
          await notices.tell({ type: 'MSG-KEY-01', keyId: key.id, userId: key.googleId, name: key.name, expires: key.expiresAt.toISOString().slice(0, 10) });
          told++;
        } catch (error) {
          request.log.error({ err: error, keyId: key.id }, 'catalogue was not told that a key expires');
        }
      }
      return { expiring: expiring.length, told };
    });
  }
}

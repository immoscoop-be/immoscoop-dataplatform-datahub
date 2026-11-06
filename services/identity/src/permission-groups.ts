import {
  can,
  canWith,
  completePermissions,
  NO_PERMISSIONS,
  PERMISSION_KEYS,
  PERMISSIONS,
  type PermissionKey,
  type Permissions,
  permissionsSchema,
} from '@datahub/contracts';
import type { AccessTokenClaims } from '@datahub/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { type Kysely, sql } from 'kysely';
import type { IdentityDatabase } from './database.js';
import type { Workspace } from './workspace.js';

/** A Permission group as Admin shows it (FR-PL-05, FR-PL-09). */
export interface PermissionGroupView {
  id: string;
  name: string;
  sentence: string;
  permissions: Permissions;
  isDefault: boolean;
  locked: boolean;
  users: number;
  updatedAt: string;
  updatedBy: string | null;
}

/** A User as Users in Admin lists them (FR-PL-06). */
export interface UserView {
  googleId: string;
  email: string;
  name: string;
  permissionGroup: { id: string; name: string };
  groups: string[];
  createdAt: string;
  lastLoginAt: string;
  uses: { web: boolean; claude: boolean; excel: boolean };
  active: boolean;
}

/** One move of a User from one Permission group to another (FR-PL-07). */
export interface HistoryLine {
  at: string;
  from: string | null;
  to: string;
  by: string | null;
}

/** Who did something, by fixed Google ID and name. */
export interface Actor {
  id: string;
  name: string;
}

/** What identity tells catalogue, to write a Message (FR-PL-12, EC-PL-03). */
export type UserNotice =
  | { type: 'MSG-USR-01'; userId: string; name: string; actor: string; from: string; to: string; gains: string[]; losses: string[]; deleted: boolean }
  | { type: 'MSG-USR-02'; userId: string; name: string };

export interface UserNotices {
  tellUser(notice: UserNotice): Promise<void>;
}

export type GroupError = 'not_found' | 'locked' | 'name_taken' | 'own_group' | 'last_admin' | 'invalid_move';

export class PermissionGroupError extends Error {
  constructor(readonly code: GroupError) {
    super(code);
  }
}

/** The names of the Permissions a User gains and loses when they go from one set to another (FR-PL-07, FR-PL-12). */
export function changesBetween(from: Permissions, to: Permissions): { gains: string[]; losses: string[] } {
  const gains: string[] = [];
  const losses: string[] = [];
  for (const key of PERMISSION_KEYS) {
    const before = can(from, key);
    const after = can(to, key);
    if (after && !before) gains.push(PERMISSIONS[key].name);
    else if (before && !after) losses.push(PERMISSIONS[key].name);
    else if (after && JSON.stringify(from[key].values) !== JSON.stringify(to[key].values)) gains.push(`${PERMISSIONS[key].name}, changed`);
  }
  return { gains, losses };
}

/** The Permission groups and the group of every User, as identity keeps them (TR-PL-04). */
export function createPermissionGroups(db: Kysely<IdentityDatabase>, now: () => Date = () => new Date()) {
  const view = (row: {
    id: string;
    name: string;
    sentence: string;
    permissions: Permissions;
    isDefault: boolean;
    locked: boolean;
    users: number | string | bigint;
    updatedAt: Date;
    updatedByName: string | null;
  }): PermissionGroupView => ({
    id: row.id,
    name: row.name,
    sentence: row.sentence,
    permissions: completePermissions(row.permissions),
    isDefault: row.isDefault,
    locked: row.locked,
    users: Number(row.users),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedByName,
  });

  const groupsWithCounts = () =>
    db
      .selectFrom('permissionGroups as g')
      .leftJoin('users as u', 'u.permissionGroupId', 'g.id')
      .select(['g.id', 'g.name', 'g.sentence', 'g.permissions', 'g.isDefault', 'g.locked', 'g.updatedAt', 'g.updatedByName'])
      .select((eb) => eb.fn.count<number>('u.googleId').as('users'))
      .groupBy('g.id');

  async function one(id: string): Promise<PermissionGroupView> {
    const row = await groupsWithCounts().where('g.id', '=', id).executeTakeFirst();
    if (!row) throw new PermissionGroupError('not_found');
    return view(row);
  }

  async function nameTaken(name: string, except?: string): Promise<boolean> {
    const row = await db
      .selectFrom('permissionGroups')
      .select('id')
      .where(sql<boolean>`lower(name) = lower(${name})`)
      .$if(except !== undefined, (query) => query.where('id', '<>', except!))
      .executeTakeFirst();
    return row !== undefined;
  }

  const log = (entry: {
    kind: string;
    googleId?: string | null;
    groupId?: string | null;
    fromName?: string | null;
    toName?: string | null;
    by?: Actor | null;
    detail?: Record<string, unknown>;
  }) =>
    db
      .insertInto('permissionGroupLog')
      .values({
        kind: entry.kind,
        googleId: entry.googleId ?? null,
        groupId: entry.groupId ?? null,
        fromName: entry.fromName ?? null,
        toName: entry.toName ?? null,
        byId: entry.by?.id ?? null,
        byName: entry.by?.name ?? null,
        detail: JSON.stringify(entry.detail ?? {}),
        at: now(),
      })
      .execute();

  const adminId = async () => (await db.selectFrom('permissionGroups').select('id').where('starting', '=', 'admin').executeTakeFirstOrThrow()).id;

  return {
    async list(): Promise<PermissionGroupView[]> {
      const rows = await groupsWithCounts().orderBy(sql`g.locked desc, lower(g.name)`).execute();
      return rows.map(view);
    },

    get: one,

    /** The default Permission group, which a new User gets at their first sign-in (FR-PL-04). */
    async defaultId(): Promise<string> {
      return (await db.selectFrom('permissionGroups').select('id').where('isDefault', '=', true).executeTakeFirstOrThrow()).id;
    },

    /** The Permission group of a User and its Permissions, for their Access Token (TR-PL-05). */
    async claimsOf(googleId: string): Promise<Pick<AccessTokenClaims, 'permissionGroup' | 'permissions'>> {
      const row = await db
        .selectFrom('users')
        .innerJoin('permissionGroups', 'permissionGroups.id', 'users.permissionGroupId')
        .select(['permissionGroups.id', 'permissionGroups.name', 'permissionGroups.permissions'])
        .where('users.googleId', '=', googleId)
        .executeTakeFirst();
      if (!row) return { permissionGroup: { id: 'none', name: 'None' }, permissions: structuredClone(NO_PERMISSIONS) };
      return { permissionGroup: { id: row.id, name: row.name }, permissions: completePermissions(row.permissions) };
    },

    async make(input: { name: string; sentence: string; from: string | null }, by: Actor): Promise<PermissionGroupView> {
      if (await nameTaken(input.name)) throw new PermissionGroupError('name_taken');
      const permissions = input.from ? (await one(input.from)).permissions : structuredClone(NO_PERMISSIONS);
      const made = await db
        .insertInto('permissionGroups')
        .values({ name: input.name, sentence: input.sentence, permissions: JSON.stringify(permissions), updatedById: by.id, updatedByName: by.name, updatedAt: now(), createdAt: now() })
        .returning('id')
        .executeTakeFirstOrThrow();
      await log({ kind: 'made', groupId: made.id, toName: input.name, by, detail: { from: input.from } });
      return one(made.id);
    },

    async change(id: string, input: { name?: string; sentence?: string; permissions?: Permissions }, by: Actor): Promise<PermissionGroupView> {
      const group = await one(id);
      if (group.locked) throw new PermissionGroupError('locked');
      if (input.name !== undefined && (await nameTaken(input.name, id))) throw new PermissionGroupError('name_taken');
      await db
        .updateTable('permissionGroups')
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.sentence !== undefined ? { sentence: input.sentence } : {}),
          ...(input.permissions !== undefined ? { permissions: JSON.stringify(input.permissions) } : {}),
          updatedAt: now(),
          updatedById: by.id,
          updatedByName: by.name,
        })
        .where('id', '=', id)
        .execute();
      const changed = input.permissions ? PERMISSION_KEYS.filter((key) => JSON.stringify(group.permissions[key]) !== JSON.stringify(input.permissions![key])) : [];
      await log({ kind: 'changed', groupId: id, fromName: group.name, toName: input.name ?? group.name, by, detail: { permissions: changed, sentence: input.sentence !== undefined } });
      return one(id);
    },

    /** Makes a group the default, which takes it from the one before (FR-PL-10). */
    async makeDefault(id: string, by: Actor): Promise<PermissionGroupView> {
      const group = await one(id);
      await db.transaction().execute(async (trx) => {
        await trx.updateTable('permissionGroups').set({ isDefault: false }).where('isDefault', '=', true).execute();
        await trx.updateTable('permissionGroups').set({ isDefault: true, updatedAt: now(), updatedById: by.id, updatedByName: by.name }).where('id', '=', id).execute();
      });
      await log({ kind: 'default', groupId: id, toName: group.name, by });
      return one(id);
    },

    /** Deletes a group and moves its Users to another, which becomes the default when it was (FR-PL-10). */
    async remove(id: string, moveTo: string, by: Actor): Promise<{ moved: { googleId: string; name: string; from: Permissions; to: Permissions }[]; from: string; to: string }> {
      const group = await one(id);
      if (group.locked) throw new PermissionGroupError('locked');
      if (moveTo === id) throw new PermissionGroupError('invalid_move');
      const target = await one(moveTo).catch(() => {
        throw new PermissionGroupError('invalid_move');
      });
      if (target.locked) throw new PermissionGroupError('invalid_move');
      const users = await db.selectFrom('users').select(['googleId', 'name']).where('permissionGroupId', '=', id).execute();
      await db.transaction().execute(async (trx) => {
        await trx.updateTable('users').set({ permissionGroupId: moveTo }).where('permissionGroupId', '=', id).execute();
        // The group goes first, so that there is never more than one default (FR-PL-10).
        await trx.deleteFrom('permissionGroups').where('id', '=', id).execute();
        if (group.isDefault) await trx.updateTable('permissionGroups').set({ isDefault: true }).where('id', '=', moveTo).execute();
      });
      for (const user of users) await log({ kind: 'moved', googleId: user.googleId, groupId: moveTo, fromName: group.name, toName: target.name, by, detail: { deleted: true } });
      await log({ kind: 'deleted', groupId: id, fromName: group.name, toName: target.name, by, detail: { users: users.length } });
      return { moved: users.map((user) => ({ googleId: user.googleId, name: user.name, from: group.permissions, to: target.permissions })), from: group.name, to: target.name };
    },

    /**
     * Moves a User to another Permission group (FR-PL-07): never the one who asks, and never the last User
     * of Admin (FR-PL-08).
     */
    async move(googleId: string, groupId: string, by: Actor): Promise<{ name: string; from: PermissionGroupView; to: PermissionGroupView } | null> {
      if (googleId === by.id) throw new PermissionGroupError('own_group');
      const user = await db.selectFrom('users').select(['googleId', 'name', 'permissionGroupId']).where('googleId', '=', googleId).executeTakeFirst();
      if (!user) throw new PermissionGroupError('not_found');
      const to = await one(groupId).catch(() => {
        throw new PermissionGroupError('invalid_move');
      });
      if (user.permissionGroupId === groupId) return null;
      const from = await one(user.permissionGroupId);
      if (from.locked && from.users <= 1) throw new PermissionGroupError('last_admin');
      await db.updateTable('users').set({ permissionGroupId: groupId }).where('googleId', '=', googleId).execute();
      await log({ kind: 'moved', googleId, groupId, fromName: from.name, toName: to.name, by });
      return { name: user.name, from, to };
    },

    /**
     * EC-PL-03: when no User of Admin can still sign in, a member of `datahub-datateam@` who signs in gets
     * Admin back. Whether someone of Admin can still sign in is first read from their sessions, and only
     * when none is open asked of Workspace.
     */
    async restoreAdminIfNoneLeft(googleId: string, workspace: Pick<Workspace, 'isActive'>): Promise<boolean> {
      const admin = await adminId();
      const members = await db.selectFrom('users').select('googleId').where('permissionGroupId', '=', admin).execute();
      if (members.some((member) => member.googleId === googleId)) return false;
      const open = await db
        .selectFrom('sessions')
        .select('googleId')
        .where('googleId', 'in', members.length ? members.map((member) => member.googleId) : [''])
        .where('endedAt', 'is', null)
        .where('expiresAt', '>', now())
        .executeTakeFirst();
      if (open) return false;
      for (const member of members) {
        if (await workspace.isActive(member.googleId)) return false;
      }
      await db.updateTable('users').set({ permissionGroupId: admin }).where('googleId', '=', googleId).execute();
      await log({ kind: 'restored', googleId, groupId: admin, toName: 'Admin', detail: { reason: 'no User of Admin can still sign in' } });
      return true;
    },

    async users(webClientId: string | undefined): Promise<UserView[]> {
      const rows = await db
        .selectFrom('users')
        .innerJoin('permissionGroups', 'permissionGroups.id', 'users.permissionGroupId')
        .select([
          'users.googleId',
          'users.email',
          'users.name',
          'users.groups',
          'users.createdAt',
          'users.lastLoginAt',
          'permissionGroups.id as groupId',
          'permissionGroups.name as groupName',
        ])
        .select((eb) => [
          eb
            .exists(eb.selectFrom('sessions').select('id').whereRef('sessions.googleId', '=', 'users.googleId').where('clientId', '=', webClientId ?? ''))
            .as('web'),
          eb
            .exists(eb.selectFrom('sessions').select('id').whereRef('sessions.googleId', '=', 'users.googleId').where('clientId', '<>', webClientId ?? ''))
            .as('claude'),
          eb.exists(eb.selectFrom('excelKeys').select('id').whereRef('excelKeys.googleId', '=', 'users.googleId').where('revokedAt', 'is', null)).as('excel'),
          eb
            .exists(
              eb
                .selectFrom('sessions')
                .select('id')
                .whereRef('sessions.googleId', '=', 'users.googleId')
                .where('endReason', '=', 'account-inactive')
                .whereRef('endedAt', '>', 'users.lastLoginAt'),
            )
            .as('gone'),
        ])
        .orderBy('users.lastLoginAt', 'desc')
        .execute();
      return rows.map((row) => ({
        googleId: row.googleId,
        email: row.email,
        name: row.name,
        permissionGroup: { id: row.groupId, name: row.groupName },
        groups: row.groups,
        createdAt: row.createdAt.toISOString(),
        lastLoginAt: row.lastLoginAt.toISOString(),
        uses: { web: Boolean(row.web), claude: Boolean(row.claude), excel: Boolean(row.excel) },
        active: !row.gone,
      }));
    },

    /** The history of the Permission group of a User, newest first (FR-PL-07). */
    async history(googleId: string): Promise<HistoryLine[]> {
      const rows = await db
        .selectFrom('permissionGroupLog')
        .select(['at', 'kind', 'fromName', 'toName', 'byName'])
        .where('googleId', '=', googleId)
        .where('kind', 'in', ['moved', 'switch', 'default-at-sign-in', 'restored'])
        .orderBy('at', 'desc')
        .orderBy('id', 'desc')
        .execute();
      return rows.map((row) => ({ at: row.at.toISOString(), from: row.fromName, to: row.toName ?? '', by: row.byName }));
    },

    /** Notes that a new User got the default at their first sign-in. */
    async noteFirstSignIn(googleId: string): Promise<void> {
      const group = await db
        .selectFrom('users')
        .innerJoin('permissionGroups', 'permissionGroups.id', 'users.permissionGroupId')
        .select(['permissionGroups.id', 'permissionGroups.name'])
        .where('users.googleId', '=', googleId)
        .executeTakeFirst();
      if (group) await log({ kind: 'default-at-sign-in', googleId, groupId: group.id, toName: group.name });
    },
  };
}

export type PermissionGroups = ReturnType<typeof createPermissionGroups>;

const ERRORS: Record<GroupError, [number, string]> = {
  not_found: [404, 'There is no such Permission group or User.'],
  locked: [409, 'Admin can do everything and keeps it: it cannot be changed or deleted.'],
  name_taken: [409, 'Another Permission group has this name.'],
  own_group: [403, 'Nobody changes their own Permission group: another User of Admin can.'],
  last_admin: [409, 'Admin keeps at least one User: this is its last.'],
  invalid_move: [400, 'Choose another Permission group, not Admin and not this one.'],
};

/** Users and Permission groups in Admin (FR-PL-06 to FR-PL-10, TR-PL-07). */
export async function permissionGroupRoutes(
  app: FastifyInstance,
  options: { groups: PermissionGroups; notices?: UserNotices; webClientId?: string },
): Promise<void> {
  const { groups, notices } = options;
  const tool = (request: FastifyRequest, name: string) => canWith(request.user!.permissions, 'admin.open', 'tools', name);
  const actor = (request: FastifyRequest): Actor => ({ id: request.user!.sub, name: request.user!.name || request.user!.email });
  const forbidden = (reply: FastifyReply, tools: string) =>
    reply.code(403).send({ error: 'forbidden', message: `Only who may open ${tools} in Admin does this.`, permission: 'admin.open' as PermissionKey });
  const fail = (reply: FastifyReply, error: unknown) => {
    if (error instanceof PermissionGroupError) {
      const [status, message] = ERRORS[error.code];
      return reply.code(status).send({ error: error.code, message });
    }
    throw error;
  };
  const tell = async (request: FastifyRequest, notice: UserNotice) => {
    try {
      await notices?.tellUser(notice);
    } catch (error) {
      request.log.error({ err: error, type: notice.type }, 'catalogue was not told of a change of Permission group');
    }
  };
  const text = (value: unknown, max: number, min = 0) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;

  app.get('/users', async (request, reply) => {
    if (!tool(request, 'users')) return forbidden(reply, 'Users');
    return { users: await groups.users(options.webClientId) };
  });

  app.get<{ Params: { googleId: string } }>('/users/:googleId', async (request, reply) => {
    if (!tool(request, 'users')) return forbidden(reply, 'Users');
    const user = (await groups.users(options.webClientId)).find((one) => one.googleId === request.params.googleId);
    if (!user) return reply.code(404).send({ error: 'not_found', message: ERRORS.not_found[1] });
    return { user, history: await groups.history(user.googleId) };
  });

  app.put<{ Params: { googleId: string }; Body: unknown }>('/users/:googleId/permission-group', async (request, reply) => {
    if (!tool(request, 'users')) return forbidden(reply, 'Users');
    const groupId = (request.body as { groupId?: unknown } | null)?.groupId;
    if (typeof groupId !== 'string' || !groupId) return reply.code(400).send({ error: 'invalid_request', message: 'Name the Permission group.' });
    try {
      const moved = await groups.move(request.params.googleId, groupId, actor(request));
      if (moved) {
        const { gains, losses } = changesBetween(moved.from.permissions, moved.to.permissions);
        await tell(request, { type: 'MSG-USR-01', userId: request.params.googleId, name: moved.name, actor: actor(request).name, from: moved.from.name, to: moved.to.name, gains, losses, deleted: false });
      }
      const user = (await groups.users(options.webClientId)).find((one) => one.googleId === request.params.googleId);
      return { user };
    } catch (error) {
      return fail(reply, error);
    }
  });

  app.get('/permission-groups', async (request, reply) => {
    if (!tool(request, 'users') && !tool(request, 'permissionGroups')) return forbidden(reply, 'Users or Permission groups');
    return { groups: await groups.list() };
  });

  app.post<{ Body: unknown }>('/permission-groups', async (request, reply) => {
    if (!tool(request, 'permissionGroups')) return forbidden(reply, 'Permission groups');
    const body = (request.body ?? {}) as Record<string, unknown>;
    if (!text(body.name, 60, 1) || (body.sentence !== undefined && !text(body.sentence, 200)) || (body.from !== null && body.from !== undefined && typeof body.from !== 'string')) {
      return reply.code(400).send({ error: 'invalid_request', message: 'A Permission group has a name of 1 to 60 characters, a sentence of at most 200, and maybe a group to copy.' });
    }
    try {
      const group = await groups.make({ name: (body.name as string).trim(), sentence: ((body.sentence as string | undefined) ?? '').trim(), from: (body.from as string | null | undefined) ?? null }, actor(request));
      return reply.code(201).send({ group });
    } catch (error) {
      return fail(reply, error);
    }
  });

  app.patch<{ Params: { id: string }; Body: unknown }>('/permission-groups/:id', async (request, reply) => {
    if (!tool(request, 'permissionGroups')) return forbidden(reply, 'Permission groups');
    const body = (request.body ?? {}) as Record<string, unknown>;
    if ((body.name !== undefined && !text(body.name, 60, 1)) || (body.sentence !== undefined && !text(body.sentence, 200))) {
      return reply.code(400).send({ error: 'invalid_request', message: 'A name has 1 to 60 characters, a sentence at most 200.' });
    }
    let permissions: Permissions | undefined;
    if (body.permissions !== undefined) {
      const parsed = permissionsSchema.safeParse(body.permissions);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_permissions', message: 'Every Permission, each with values of its kind.', issues: parsed.error.issues.slice(0, 10) });
      }
      permissions = parsed.data;
    }
    try {
      const group = await groups.change(
        request.params.id,
        { ...(body.name !== undefined ? { name: (body.name as string).trim() } : {}), ...(body.sentence !== undefined ? { sentence: (body.sentence as string).trim() } : {}), ...(permissions ? { permissions } : {}) },
        actor(request),
      );
      return { group };
    } catch (error) {
      return fail(reply, error);
    }
  });

  app.put<{ Params: { id: string } }>('/permission-groups/:id/default', async (request, reply) => {
    if (!tool(request, 'permissionGroups')) return forbidden(reply, 'Permission groups');
    try {
      return { group: await groups.makeDefault(request.params.id, actor(request)) };
    } catch (error) {
      return fail(reply, error);
    }
  });

  app.delete<{ Params: { id: string }; Body: unknown }>('/permission-groups/:id', async (request, reply) => {
    if (!tool(request, 'permissionGroups')) return forbidden(reply, 'Permission groups');
    const moveTo = (request.body as { moveTo?: unknown } | null)?.moveTo;
    if (typeof moveTo !== 'string' || !moveTo) return reply.code(400).send({ error: 'invalid_move', message: ERRORS.invalid_move[1] });
    try {
      const removed = await groups.remove(request.params.id, moveTo, actor(request));
      for (const user of removed.moved) {
        const { gains, losses } = changesBetween(user.from, user.to);
        await tell(request, { type: 'MSG-USR-01', userId: user.googleId, name: user.name, actor: actor(request).name, from: removed.from, to: removed.to, gains, losses, deleted: true });
      }
      return reply.code(204).send();
    } catch (error) {
      return fail(reply, error);
    }
  });
}

import { randomUUID } from 'node:crypto';
import type { ServiceCallerVerifier } from '@datahub/auth';
import { can, permissionValue, type Permissions } from '@datahub/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { type Kysely, sql, type SqlBool } from 'kysely';
import type { IdentityDatabase } from './database.js';

/**
 * The Groups kept in Data Hub (DEC-UM-10, TR-UM-01, TR-UM-02): a set of Users, managed by another Group
 * or by itself. A member is kept by address, so that a colleague who has not signed in yet can be one
 * (OP-UX-70); a Group holds Users only (OP-UX-71). The members of the Group that manages a Group change
 * it; a User with `groups.all.manage` changes every Group (DEC-UX-201).
 */

/** Who asks: their address, their name and their Google ID, from the Access Token. */
export interface Viewer {
  id: string;
  email: string;
  name: string;
  /** May change every Group (`groups.all.manage`). */
  all: boolean;
}

/** A Group in a list: how the viewer stands to it, for the tag on Groups (FR-UM-18). */
export interface GroupSummary {
  id: string;
  name: string;
  sentence: string;
  /** The Group that manages it, the Group itself included, and whether the viewer is in it. */
  managedBy: { id: string; name: string; isMember: boolean };
  memberCount: number;
  isMember: boolean;
  /** Whether the viewer changes it: they are in the Group that manages it, or change every Group. */
  mayChange: boolean;
}

export interface GroupMember {
  email: string;
  /** Their name once they signed in; null until then. */
  name: string | null;
  signedIn: boolean;
  /** False once the directory said their account is no longer active (FR-UM-15). */
  active: boolean;
  addedAt: string;
  addedBy: { id: string | null; name: string | null };
}

export interface GroupLogEntry {
  at: string;
  kind: string;
  by: { id: string | null; name: string | null };
  detail: Record<string, unknown>;
}

export interface GroupDetail extends GroupSummary {
  members: GroupMember[];
  /** The other Groups it manages. */
  manages: { id: string; name: string }[];
  createdAt: string;
  createdBy: { id: string | null; name: string | null };
  log: GroupLogEntry[];
}

/** What catalogue knows a Group owns, as its Owner Unit (TR-UM-05). */
export interface OwnerUnits {
  collectionsOf(groupId: string): Promise<{ count: number; names: string[] }>;
}

export class GroupError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

const NAME_MAX = 80;
const SENTENCE_MAX = 200;
const LOG_SHOWN = 100;

const lower = (email: string) => email.trim().toLowerCase();

export function createGroups(db: Kysely<IdentityDatabase>, now: () => Date = () => new Date()) {
  const inGroup = (groupId: unknown, email: string) =>
    sql<SqlBool>`exists (select 1 from group_members where group_members.group_id = ${groupId} and group_members.email = ${lower(email)})`;

  async function summaries(viewer: Viewer, where: { ids?: string[]; every?: boolean; q?: string }): Promise<GroupSummary[]> {
    const rows = await db
      .selectFrom('groups as g')
      .innerJoin('groups as m', 'm.id', 'g.managedBy')
      .select([
        'g.id',
        'g.name',
        'g.sentence',
        'g.managedBy',
        'm.name as managedByName',
        sql<string>`(select count(*) from group_members where group_members.group_id = g.id)`.as('memberCount'),
        inGroup(sql.ref('g.id'), viewer.email).as('isMember'),
        inGroup(sql.ref('g.managed_by'), viewer.email).as('inManager'),
      ])
      .where('g.deletedAt', 'is', null)
      .$if(where.ids !== undefined, (query) => query.where('g.id', 'in', where.ids!.length ? where.ids! : ['']))
      .$if(where.q !== undefined && where.q !== '', (query) => query.where(sql<SqlBool>`g.name ilike ${`%${where.q}%`}`))
      .$if(!where.every && where.ids === undefined, (query) =>
        query.where((eb) => eb.or([inGroup(sql.ref('g.id'), viewer.email), inGroup(sql.ref('g.managed_by'), viewer.email)])),
      )
      .orderBy(sql`lower(g.name)`)
      .execute();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      sentence: row.sentence,
      managedBy: { id: row.managedBy, name: row.managedByName, isMember: Boolean(row.inManager) },
      memberCount: Number(row.memberCount),
      isMember: Boolean(row.isMember),
      mayChange: viewer.all || Boolean(row.inManager),
    }));
  }

  async function log(groupId: string, kind: string, by: Viewer | null, detail: Record<string, unknown> = {}) {
    await db
      .insertInto('groupLog')
      .values({ groupId, kind, at: now(), byId: by?.id ?? null, byName: by?.name ?? null, detail: JSON.stringify(detail) })
      .execute();
  }

  async function nameTaken(name: string, except?: string): Promise<boolean> {
    const found = await db
      .selectFrom('groups')
      .select('id')
      .where(sql<SqlBool>`lower(name) = lower(${name})`)
      .where('deletedAt', 'is', null)
      .$if(except !== undefined, (query) => query.where('id', '<>', except!))
      .executeTakeFirst();
    return Boolean(found);
  }

  /** A Group the viewer may change, or why not. */
  async function changeable(id: string, viewer: Viewer): Promise<GroupSummary> {
    const [group] = await summaries(viewer, { ids: [id] });
    if (!group) throw new GroupError(404, 'not_found', 'This group does not exist.');
    if (!group.mayChange) throw new GroupError(403, 'forbidden', `Only the members of ${group.managedBy.name} change this group.`, { managedBy: group.managedBy });
    return group;
  }

  /** The Group that is to manage another: the Group itself, one the viewer is in, or any with `groups.all.manage`. */
  async function checkManager(managedBy: string, self: string | null, viewer: Viewer): Promise<void> {
    if (managedBy === self) return;
    const [manager] = await summaries(viewer, { ids: [managedBy] });
    if (!manager) throw new GroupError(400, 'invalid_manager', 'The group that manages it does not exist.');
    if (!viewer.all && !manager.isMember) throw new GroupError(403, 'forbidden', 'Choose a group you are in, or the group itself, to manage it.');
  }

  return {
    /** The identifiers of the Groups an address is in, for the claim `groups` (TR-UM-03). */
    async groupsOf(email: string): Promise<string[]> {
      const rows = await db
        .selectFrom('groupMembers')
        .innerJoin('groups', 'groups.id', 'groupMembers.groupId')
        .select('groups.id')
        .where('groupMembers.email', '=', lower(email))
        .where('groups.deletedAt', 'is', null)
        .orderBy('groups.id')
        .execute();
      return rows.map((row) => row.id);
    },

    /** The Groups the viewer is in or manages, or every Group (FR-UM-18). */
    async list(viewer: Viewer, options: { every?: boolean; q?: string } = {}): Promise<GroupSummary[]> {
      return summaries(viewer, { every: options.every ?? false, ...(options.q !== undefined ? { q: options.q } : {}) });
    },

    /** One Group, for any signed-in User (FR-UM-18). */
    async detail(id: string, viewer: Viewer): Promise<GroupDetail | undefined> {
      const [group] = await summaries(viewer, { ids: [id] });
      if (!group) return undefined;
      const [members, manages, made, entries] = await Promise.all([
        db
          .selectFrom('groupMembers')
          .leftJoin('users', (join) => join.on(sql<SqlBool>`lower(users.email) = group_members.email`))
          .select(['groupMembers.email', 'groupMembers.addedAt', 'groupMembers.addedById', 'groupMembers.addedByName', 'users.name', 'users.active', 'users.googleId'])
          .where('groupMembers.groupId', '=', id)
          .orderBy(sql`coalesce(users.name, group_members.email)`)
          .execute(),
        db.selectFrom('groups').select(['id', 'name']).where('managedBy', '=', id).where('id', '<>', id).where('deletedAt', 'is', null).orderBy(sql`lower(name)`).execute(),
        db.selectFrom('groups').select(['createdAt', 'createdById', 'createdByName']).where('id', '=', id).executeTakeFirstOrThrow(),
        db.selectFrom('groupLog').select(['at', 'kind', 'byId', 'byName', 'detail']).where('groupId', '=', id).orderBy('at', 'desc').limit(LOG_SHOWN).execute(),
      ]);
      return {
        ...group,
        members: members.map((member) => ({
          email: member.email,
          name: member.name ?? null,
          signedIn: member.googleId !== null,
          active: member.active ?? true,
          addedAt: member.addedAt.toISOString(),
          addedBy: { id: member.addedById, name: member.addedByName },
        })),
        manages,
        createdAt: made.createdAt.toISOString(),
        createdBy: { id: made.createdById, name: made.createdByName },
        log: entries.map((entry) => ({ at: entry.at.toISOString(), kind: entry.kind, by: { id: entry.byId, name: entry.byName }, detail: entry.detail })),
      };
    },

    /** Makes a Group; its maker is its first member (FR-UM-13). */
    async make(input: { name: string; sentence: string; managedBy: string | 'itself' }, viewer: Viewer): Promise<string> {
      const id = randomUUID();
      const managedBy = input.managedBy === 'itself' ? id : input.managedBy;
      await checkManager(managedBy, id, viewer);
      if (await nameTaken(input.name)) throw new GroupError(409, 'name_taken', 'Another group has this name.');
      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto('groups')
          .values({ id, name: input.name, sentence: input.sentence, managedBy, createdAt: now(), updatedAt: now(), createdById: viewer.id, createdByName: viewer.name, deletedAt: null } as never)
          .execute();
        await trx.insertInto('groupMembers').values({ groupId: id, email: lower(viewer.email), addedAt: now(), addedById: viewer.id, addedByName: viewer.name }).execute();
      });
      await log(id, 'made', viewer, { name: input.name, managedBy });
      await log(id, 'added', viewer, { email: lower(viewer.email) });
      return id;
    },

    /** Renames a Group, changes its sentence, or chooses which Group manages it (FR-UM-14). */
    async change(id: string, input: { name?: string; sentence?: string; managedBy?: string | 'itself' }, viewer: Viewer): Promise<void> {
      const group = await changeable(id, viewer);
      const managedBy = input.managedBy === 'itself' ? id : input.managedBy;
      if (managedBy !== undefined && managedBy !== group.managedBy.id) await checkManager(managedBy, id, viewer);
      if (input.name !== undefined && input.name !== group.name && (await nameTaken(input.name, id))) {
        throw new GroupError(409, 'name_taken', 'Another group has this name.');
      }
      const set: { name?: string; sentence?: string; managedBy?: string } = {};
      if (input.name !== undefined && input.name !== group.name) set.name = input.name;
      if (input.sentence !== undefined && input.sentence !== group.sentence) set.sentence = input.sentence;
      if (managedBy !== undefined && managedBy !== group.managedBy.id) set.managedBy = managedBy;
      if (Object.keys(set).length === 0) return;
      await db.updateTable('groups').set({ ...set, updatedAt: now() }).where('id', '=', id).execute();
      if (set.name !== undefined) await log(id, 'renamed', viewer, { from: group.name, to: set.name });
      if (set.sentence !== undefined) await log(id, 'sentence', viewer, { from: group.sentence, to: set.sentence });
      if (set.managedBy !== undefined) {
        const manager = await db.selectFrom('groups').select('name').where('id', '=', set.managedBy).executeTakeFirstOrThrow();
        await log(id, 'managedBy', viewer, { from: group.managedBy.name, to: manager.name, toId: set.managedBy });
      }
    },

    /** Adds a colleague by address, also one who has not signed in yet (FR-UM-15). */
    async add(id: string, email: string, viewer: Viewer): Promise<boolean> {
      await changeable(id, viewer);
      const added = await db
        .insertInto('groupMembers')
        .values({ groupId: id, email: lower(email), addedAt: now(), addedById: viewer.id, addedByName: viewer.name })
        .onConflict((conflict) => conflict.columns(['groupId', 'email']).doNothing())
        .returning('email')
        .executeTakeFirst();
      if (added) await log(id, 'added', viewer, { email: lower(email) });
      return Boolean(added);
    },

    /** Takes a member out (FR-UM-14). */
    async remove(id: string, email: string, viewer: Viewer): Promise<boolean> {
      await changeable(id, viewer);
      const removed = await db.deleteFrom('groupMembers').where('groupId', '=', id).where('email', '=', lower(email)).returning('email').executeTakeFirst();
      if (removed) await log(id, 'removed', viewer, { email: lower(email) });
      return Boolean(removed);
    },

    /** Deletes a Group that manages no other Group and is the Owner Unit of no Collection (FR-UM-16). */
    async delete(id: string, viewer: Viewer, owners: OwnerUnits): Promise<void> {
      const group = await changeable(id, viewer);
      const manages = await db.selectFrom('groups').select('name').where('managedBy', '=', id).where('id', '<>', id).where('deletedAt', 'is', null).execute();
      const collections = await owners.collectionsOf(id);
      if (manages.length > 0 || collections.count > 0) {
        throw new GroupError(409, 'still_owns', `${group.name} still manages other groups or is the Owner Unit of Collections.`, {
          manages: manages.map((row) => row.name),
          collections,
        });
      }
      await db.transaction().execute(async (trx) => {
        await trx.deleteFrom('groupMembers').where('groupId', '=', id).execute();
        await trx.updateTable('groups').set({ deletedAt: now(), deletedById: viewer.id, deletedByName: viewer.name, updatedAt: now() }).where('id', '=', id).execute();
      });
      await log(id, 'deleted', viewer, { name: group.name });
    },

    /**
     * The Owner Units of Google become Groups of Data Hub, once (FR-UM-20, TR-UM-04): with their Google ID,
     * their name, managing themselves, and as members the Users whose Google groups, as last read, held them.
     * A Group that exists already, or was deleted, stays as it is, so that this can repeat at every start.
     */
    async move(owners: { id: string; name: string }[]): Promise<string[]> {
      const moved: string[] = [];
      for (const owner of owners) {
        const exists = await db.selectFrom('groups').select('id').where('id', '=', owner.id).executeTakeFirst();
        if (exists) continue;
        let name = (owner.name || owner.id).slice(0, NAME_MAX);
        for (let n = 2; await nameTaken(name); n += 1) name = `${(owner.name || owner.id).slice(0, NAME_MAX - 4)} (${n})`;
        const members = await db.selectFrom('users').select(sql<string>`lower(email)`.as('email')).where(sql<SqlBool>`${owner.id} = any(workspace_groups)`).execute();
        await db.transaction().execute(async (trx) => {
          await trx
            .insertInto('groups')
            .values({ id: owner.id, name, sentence: '', managedBy: owner.id, createdAt: now(), updatedAt: now(), createdById: null, createdByName: null, deletedAt: null } as never)
            .onConflict((conflict) => conflict.column('id').doNothing())
            .execute();
          if (members.length) {
            await trx
              .insertInto('groupMembers')
              .values(members.map((member) => ({ groupId: owner.id, email: member.email, addedAt: now(), addedById: null, addedByName: null })))
              .onConflict((conflict) => conflict.columns(['groupId', 'email']).doNothing())
              .execute();
          }
        });
        await log(owner.id, 'moved', null, { from: 'Google', members: members.length });
        moved.push(owner.id);
      }
      return moved;
    },

    /** Users whose name or address holds the text, to suggest while adding a member (FR-UM-15). */
    async people(q: string): Promise<{ email: string; name: string }[]> {
      const like = `%${q.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
      return db
        .selectFrom('users')
        .select([sql<string>`lower(email)`.as('email'), 'name'])
        .where('active', '=', true)
        .where((eb) => eb.or([sql<SqlBool>`name ilike ${like}`, sql<SqlBool>`email ilike ${like}`]))
        .orderBy('name')
        .limit(8)
        .execute();
    },
  };
}

export type Groups = ReturnType<typeof createGroups>;

export interface GroupRouteOptions {
  groups: Groups;
  /** The Workspace domains whose addresses may be members (DEC-UM-09). */
  domains: string[];
  /** catalogue, asked what a Group owns before it is deleted (TR-UM-05). */
  owners: OwnerUnits;
  /** catalogue, which sends the Owner Units to move at its start (TR-UM-04). */
  movers?: ServiceCallerVerifier;
}

const text = (value: unknown, max: number, min = 0): string | null =>
  typeof value === 'string' && value.trim().length >= min && value.trim().length <= max ? value.trim() : null;

const domainOf = (email: string): string => email.slice(email.lastIndexOf('@') + 1).toLowerCase();
const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function groupRoutes(app: FastifyInstance, options: GroupRouteOptions): Promise<void> {
  const { groups, domains, owners } = options;

  const viewerOf = (request: FastifyRequest): Viewer => {
    const user = request.user!;
    return { id: user.sub, email: user.email ?? '', name: user.name || user.email || user.sub, all: can(user.permissions as Permissions, 'groups.all.manage') };
  };
  const fail = (reply: FastifyReply, error: unknown) => {
    if (error instanceof GroupError) return reply.code(error.status).send({ error: error.code, message: error.message, ...error.extra });
    throw error;
  };
  const anyGroup = (permissions: Permissions) =>
    can(permissions, 'groups.all.manage') || (can(permissions, 'collections.make') && permissionValue(permissions, 'collections.make', 'ownerUnit') === 'any');

  // The Groups the User is in or manages; catalogue asks it too, to check the Owner Unit chosen (TR-CO-03).
  app.get('/me/groups', async (request) => ({ groups: await groups.list(viewerOf(request)) }));

  // Every Group, for a Data Admin and for who may give a Collection to any Group (FR-CO-35).
  app.get<{ Querystring: { q?: string } }>('/groups', async (request, reply) => {
    if (!anyGroup(request.user!.permissions as Permissions)) {
      return reply.code(403).send({ error: 'forbidden', message: 'Only who may change every group, or give a Collection to any group, sees every group.', permission: 'groups.all.manage' });
    }
    const q = typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 80) : undefined;
    return { groups: await groups.list(viewerOf(request), { every: true, ...(q ? { q } : {}) }) };
  });

  app.get<{ Params: { id: string } }>('/groups/:id', async (request, reply) => {
    const group = await groups.detail(request.params.id, viewerOf(request));
    if (!group) return reply.code(404).send({ error: 'not_found', message: 'This group does not exist.' });
    return { group };
  });

  app.post<{ Body: unknown }>('/groups', async (request, reply) => {
    if (!can(request.user!.permissions as Permissions, 'groups.manage')) {
      return reply.code(403).send({ error: 'forbidden', message: 'Your Permission group does not allow making groups.', permission: 'groups.manage' });
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    const name = text(body.name, NAME_MAX, 1);
    const sentence = body.sentence === undefined ? '' : text(body.sentence, SENTENCE_MAX);
    const managedBy = text(body.managedBy, 100, 1);
    if (name === null || sentence === null || managedBy === null) {
      return reply.code(400).send({ error: 'invalid_request', message: `A group has a name of 1 to ${NAME_MAX} characters, a sentence of at most ${SENTENCE_MAX}, and the group that manages it, or "itself".` });
    }
    try {
      const id = await groups.make({ name, sentence, managedBy }, viewerOf(request));
      return reply.code(201).send({ group: await groups.detail(id, viewerOf(request)) });
    } catch (error) {
      return fail(reply, error);
    }
  });

  app.patch<{ Params: { id: string }; Body: unknown }>('/groups/:id', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const name = body.name === undefined ? undefined : text(body.name, NAME_MAX, 1);
    const sentence = body.sentence === undefined ? undefined : text(body.sentence, SENTENCE_MAX);
    const managedBy = body.managedBy === undefined ? undefined : text(body.managedBy, 100, 1);
    if (name === null || sentence === null || managedBy === null) {
      return reply.code(400).send({ error: 'invalid_request', message: `A name has 1 to ${NAME_MAX} characters, a sentence at most ${SENTENCE_MAX}.` });
    }
    try {
      await groups.change(
        request.params.id,
        { ...(name !== undefined ? { name } : {}), ...(sentence !== undefined ? { sentence } : {}), ...(managedBy !== undefined ? { managedBy } : {}) },
        viewerOf(request),
      );
      return { group: await groups.detail(request.params.id, viewerOf(request)) };
    } catch (error) {
      return fail(reply, error);
    }
  });

  app.put<{ Params: { id: string }; Body: unknown }>('/groups/:id/members', async (request, reply) => {
    const email = text(((request.body ?? {}) as Record<string, unknown>).email, 200, 3)?.toLowerCase() ?? null;
    if (email === null || !ADDRESS.test(email) || !domains.includes(domainOf(email))) {
      return reply.code(400).send({ error: 'invalid_email', message: `Add a colleague by their address of ${domains.join(' or ')}.` });
    }
    try {
      const added = await groups.add(request.params.id, email, viewerOf(request));
      return reply.code(added ? 201 : 200).send({ group: await groups.detail(request.params.id, viewerOf(request)) });
    } catch (error) {
      return fail(reply, error);
    }
  });

  app.delete<{ Params: { id: string; email: string } }>('/groups/:id/members/:email', async (request, reply) => {
    try {
      await groups.remove(request.params.id, decodeURIComponent(request.params.email), viewerOf(request));
      return { group: await groups.detail(request.params.id, viewerOf(request)) };
    } catch (error) {
      return fail(reply, error);
    }
  });

  app.delete<{ Params: { id: string } }>('/groups/:id', async (request, reply) => {
    try {
      await groups.delete(request.params.id, viewerOf(request), owners);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof GroupError) return fail(reply, error);
      request.log.error({ err: error }, 'catalogue did not say what the group owns');
      return reply.code(503).header('retry-after', '30').send({ error: 'temporarily_unavailable', message: 'catalogue did not say what the group owns; try again later.' });
    }
  });

  // Colleagues to suggest while adding a member: only to who may change a Group (FR-UM-15).
  app.get<{ Querystring: { q?: string } }>('/people', async (request) => {
    const q = typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 80) : '';
    return { people: q.length < 2 ? [] : await groups.people(q) };
  });

  if (options.movers) {
    const movers = options.movers;
    // catalogue sends the Owner Units of its Collections at its start, to move them once (TR-UM-04).
    app.post<{ Body: unknown }>(
      '/internal/groups/move',
      {
        config: { public: true },
        onRequest: async (request, reply) => {
          const token = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1] ?? '';
          try {
            await movers.verify(token);
          } catch (error) {
            request.log.warn({ err: error }, 'a call to move groups was refused');
            return reply.code(401).send({ error: 'unauthorized', message: 'Only catalogue moves its Owner Units.' });
          }
        },
      },
      async (request, reply) => {
        const list = ((request.body ?? {}) as Record<string, unknown>).groups;
        const valid =
          Array.isArray(list) &&
          list.length <= 1000 &&
          list.every((item) => item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string' && (item as { id: string }).id.length > 0 && (item as { id: string }).id.length <= 200);
        if (!valid) return reply.code(400).send({ error: 'invalid_request', message: 'A list of at most 1000 groups, each with its id and name.' });
        const owners = (list as { id: string; name?: unknown }[]).map((item) => ({ id: item.id, name: typeof item.name === 'string' ? item.name : '' }));
        return { moved: await groups.move(owners) };
      },
    );
  }
}

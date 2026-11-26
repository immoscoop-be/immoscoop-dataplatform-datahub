import { type Kysely, sql } from 'kysely';
import type { Missing, NamedResource, QueryDatabase, RunState } from './database.js';
import type { Viewer } from './queries.js';

/** A Project: a set of queries Users work on together (FR-SR-63, DEC-UX-282), any number of them (DEC-SR-49). */
export interface Project {
  id: string;
  name: string;
  description: string;
  madeById: string;
  madeByName: string;
  createdAt: Date;
  updatedAt: Date;
  /** When, by whom and why it was deleted; null while it is not (OP-UX-100). */
  deletedAt: Date | null;
  deletedById: string | null;
  deletedByName: string | null;
  deletedReason: string | null;
}

/** Someone in a Project, and who added them (FR-SR-65). */
export interface Member {
  userId: string;
  userName: string;
  addedById: string | null;
  addedByName: string | null;
  addedAt: Date;
}

/** A Project as the panel lists it: how many queries, and who is in it (DEC-UX-285). */
export interface ProjectItem extends Pick<Project, 'id' | 'name' | 'description' | 'updatedAt'> {
  queries: number;
  members: { id: string; name: string }[];
  /** When the User archived it, out of their panel; null while it is in it (DEC-UX-354). */
  archivedAt: Date | null;
}

/** A query of a Project, in its order, as its page and the row on top show it (FR-SR-63). */
export interface ProjectQuery {
  id: string;
  name: string;
  question: string;
  ownerId: string;
  ownerName: string;
  resources: NamedResource[];
  broken: Missing | null;
  position: number;
  lastRun: { userName: string; state: RunState; startedAt: Date } | null;
}

export interface Projects {
  /** The Projects the User is in, the one changed last first, the ones they archived too (DEC-UX-354). */
  list(userId: string): Promise<ProjectItem[]>;
  /**
   * Archives a Project for this User, out of their panel and nobody else's, or puts it back (DEC-UX-354, DEC-UX-355);
   * answers when it was archived, null once it is back. Neither changes the Project itself, nor when it changed.
   */
  archive(id: string, userId: string, archived: boolean): Promise<Date | null>;
  /** When this User archived the Project; null while it is in their panel. */
  archivedAt(id: string, userId: string): Promise<Date | null>;
  /** A Project by its ID, deleted or not. */
  get(id: string): Promise<Project | undefined>;
  members(id: string): Promise<Member[]>;
  isMember(id: string, userId: string): Promise<boolean>;
  /** The Project a query is in, if any, and whether this User is in it (DEC-SR-47). */
  ofQuery(queryId: string, userId: string): Promise<{ id: string; name: string; member: boolean } | undefined>;
  /** Makes a Project with its maker in it, and these queries, moved from where they were (OP-UX-93). */
  create(fields: { name: string; description: string; by: Viewer; queryIds: string[] }): Promise<Project>;
  update(id: string, fields: { name?: string; description?: string }): Promise<Project | undefined>;
  /** Deletes it for everyone: its queries leave it, its members stay listed for its address (OP-UX-100). */
  delete(id: string, by: Viewer, reason: string | null): Promise<void>;
  addMember(id: string, member: { id: string; name: string }, by: Viewer): Promise<boolean>;
  /** Takes someone out; the last one out deletes it (OP-UX-100). Answers how many are left. */
  removeMember(id: string, userId: string, by: Viewer): Promise<number>;
  /** Its queries in their order, for everyone in it the same (OP-UX-95). */
  queries(id: string): Promise<ProjectQuery[]>;
  /** Puts a query at the end of a Project, out of any other (OP-UX-93); a Project holds any number (DEC-SR-49). */
  addQuery(id: string, queryId: string, by: Viewer): Promise<void>;
  removeQuery(id: string, queryId: string): Promise<boolean>;
  /** The order of its queries, the ones named first in this order, any others after them as they were. */
  order(id: string, queryIds: string[]): Promise<void>;
}

export function createProjects(db: Kysely<QueryDatabase>): Projects {
  const live = (id: string) => db.selectFrom('projects').selectAll().where('id', '=', id).where('deletedAt', 'is', null);

  async function touch(id: string) {
    await db.updateTable('projects').set({ updatedAt: new Date() }).where('id', '=', id).execute();
  }

  return {
    async list(userId) {
      const rows = await db
        .selectFrom('projects as p')
        .innerJoin('projectMembers as m', 'm.projectId', 'p.id')
        .select(['p.id', 'p.name', 'p.description', 'p.updatedAt', 'm.archivedAt'])
        .select((eb) => eb.selectFrom('projectQueries as pq').whereRef('pq.projectId', '=', 'p.id').select(sql<string>`count(*)`.as('n')).as('queries'))
        .where('m.userId', '=', userId)
        .where('p.deletedAt', 'is', null)
        .orderBy('p.updatedAt', 'desc')
        .execute();
      if (rows.length === 0) return [];
      const members = await db
        .selectFrom('projectMembers')
        .select(['projectId', 'userId', 'userName'])
        .where(
          'projectId',
          'in',
          rows.map((row) => row.id),
        )
        .orderBy('addedAt')
        .execute();
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        updatedAt: row.updatedAt,
        queries: Number(row.queries ?? 0),
        members: members.filter((member) => member.projectId === row.id).map((member) => ({ id: member.userId, name: member.userName })),
        archivedAt: row.archivedAt,
      }));
    },

    async archive(id, userId, archived) {
      const row = await db
        .updateTable('projectMembers')
        // Archived again keeps when it was first archived.
        .set({ archivedAt: archived ? sql<Date>`coalesce(archived_at, now())` : null })
        .where('projectId', '=', id)
        .where('userId', '=', userId)
        .returning('archivedAt')
        .executeTakeFirst();
      return row?.archivedAt ?? null;
    },

    async archivedAt(id, userId) {
      const row = await db.selectFrom('projectMembers').select('archivedAt').where('projectId', '=', id).where('userId', '=', userId).executeTakeFirst();
      return row?.archivedAt ?? null;
    },

    async get(id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
      return db.selectFrom('projects').selectAll().where('id', '=', id).executeTakeFirst();
    },

    async members(id) {
      return db.selectFrom('projectMembers').select(['userId', 'userName', 'addedById', 'addedByName', 'addedAt']).where('projectId', '=', id).orderBy('addedAt').execute();
    },

    async isMember(id, userId) {
      const row = await db
        .selectFrom('projectMembers as m')
        .innerJoin('projects as p', 'p.id', 'm.projectId')
        .select('m.userId')
        .where('m.projectId', '=', id)
        .where('m.userId', '=', userId)
        .where('p.deletedAt', 'is', null)
        .executeTakeFirst();
      return row !== undefined;
    },

    async ofQuery(queryId, userId) {
      const row = await db
        .selectFrom('projectQueries as pq')
        .innerJoin('projects as p', 'p.id', 'pq.projectId')
        .select(['p.id', 'p.name'])
        .select((eb) => eb.exists(eb.selectFrom('projectMembers as m').select('m.userId').whereRef('m.projectId', '=', 'p.id').where('m.userId', '=', userId)).as('member'))
        .where('pq.queryId', '=', queryId)
        .where('p.deletedAt', 'is', null)
        .executeTakeFirst();
      return row ? { id: row.id, name: row.name, member: row.member === true } : undefined;
    },

    async create({ name, description, by, queryIds }) {
      return db.transaction().execute(async (trx) => {
        const project = await trx.insertInto('projects').values({ name, description, madeById: by.id, madeByName: by.name }).returningAll().executeTakeFirstOrThrow();
        await trx.insertInto('projectMembers').values({ projectId: project.id, userId: by.id, userName: by.name, addedById: null, addedByName: null }).execute();
        if (queryIds.length > 0) {
          await trx.deleteFrom('projectQueries').where('queryId', 'in', queryIds).execute();
          await trx
            .insertInto('projectQueries')
            .values(queryIds.map((queryId, position) => ({ projectId: project.id, queryId, position, addedById: by.id })))
            .execute();
        }
        return project;
      });
    },

    async update(id, fields) {
      if (Object.keys(fields).length === 0) return live(id).executeTakeFirst();
      return db
        .updateTable('projects')
        .set({ ...fields, updatedAt: new Date() })
        .where('id', '=', id)
        .where('deletedAt', 'is', null)
        .returningAll()
        .executeTakeFirst();
    },

    async delete(id, by, reason) {
      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable('projects')
          .set({ deletedAt: new Date(), deletedById: by.id, deletedByName: by.name, deletedReason: reason, updatedAt: new Date() })
          .where('id', '=', id)
          .where('deletedAt', 'is', null)
          .execute();
        await trx.deleteFrom('projectQueries').where('projectId', '=', id).execute();
      });
    },

    async addMember(id, member, by) {
      const added = await db
        .insertInto('projectMembers')
        .values({ projectId: id, userId: member.id, userName: member.name, addedById: by.id, addedByName: by.name })
        .onConflict((conflict) => conflict.columns(['projectId', 'userId']).doNothing())
        .returning('userId')
        .executeTakeFirst();
      if (added) await touch(id);
      return added !== undefined;
    },

    async removeMember(id, userId, by) {
      await db.deleteFrom('projectMembers').where('projectId', '=', id).where('userId', '=', userId).execute();
      const left = Number((await db.selectFrom('projectMembers').select(sql<string>`count(*)`.as('n')).where('projectId', '=', id).executeTakeFirstOrThrow()).n);
      // The last one out deletes it (OP-UX-100).
      if (left === 0) await this.delete(id, by, null);
      else await touch(id);
      return left;
    },

    async queries(id) {
      const rows = await db
        .selectFrom('projectQueries as pq')
        .innerJoin('queries as q', 'q.id', 'pq.queryId')
        .select(['q.id', 'q.name', 'q.question', 'q.ownerId', 'q.ownerName', 'q.resources', 'q.broken', 'pq.position'])
        .select((eb) =>
          eb
            .selectFrom('runs as r')
            .whereRef('r.queryId', '=', 'q.id')
            .where('r.purpose', '=', 'run')
            .select(sql<{ userName: string; state: RunState; startedAt: string } | null>`json_build_object('userName', r.user_name, 'state', r.state, 'startedAt', r.started_at)`.as('run'))
            .orderBy('r.number', 'desc')
            .limit(1)
            .as('lastRun'),
        )
        .where('pq.projectId', '=', id)
        .orderBy('pq.position')
        .orderBy('pq.addedAt')
        .execute();
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        question: row.question,
        ownerId: row.ownerId,
        ownerName: row.ownerName,
        resources: row.resources,
        broken: row.broken,
        position: row.position,
        lastRun: row.lastRun ? { userName: row.lastRun.userName, state: row.lastRun.state, startedAt: new Date(row.lastRun.startedAt) } : null,
      }));
    },

    async addQuery(id, queryId, by) {
      await db.transaction().execute(async (trx) => {
        const here = await trx.selectFrom('projectQueries').select('projectId').where('queryId', '=', queryId).executeTakeFirst();
        if (here?.projectId === id) return;
        const last = await trx.selectFrom('projectQueries').select(sql<number | null>`max(position)`.as('max')).where('projectId', '=', id).executeTakeFirstOrThrow();
        // It leaves the Project it was in: a query is in one at most (OP-UX-93).
        if (here) await trx.deleteFrom('projectQueries').where('queryId', '=', queryId).execute();
        await trx.insertInto('projectQueries').values({ projectId: id, queryId, position: (last.max ?? -1) + 1, addedById: by.id }).execute();
        await trx.updateTable('projects').set({ updatedAt: new Date() }).where('id', '=', id).execute();
      });
    },

    async removeQuery(id, queryId) {
      const removed = await db.deleteFrom('projectQueries').where('projectId', '=', id).where('queryId', '=', queryId).executeTakeFirst();
      if (Number(removed.numDeletedRows) > 0) await touch(id);
      return Number(removed.numDeletedRows) > 0;
    },

    async order(id, queryIds) {
      await db.transaction().execute(async (trx) => {
        const current = (await trx.selectFrom('projectQueries').select('queryId').where('projectId', '=', id).orderBy('position').orderBy('addedAt').execute()).map((row) => row.queryId);
        const named = queryIds.filter((queryId) => current.includes(queryId));
        const next = [...new Set(named), ...current.filter((queryId) => !named.includes(queryId))];
        for (const [position, queryId] of next.entries()) {
          await trx.updateTable('projectQueries').set({ position }).where('projectId', '=', id).where('queryId', '=', queryId).execute();
        }
        await trx.updateTable('projects').set({ updatedAt: new Date() }).where('id', '=', id).execute();
      });
    },
  };
}

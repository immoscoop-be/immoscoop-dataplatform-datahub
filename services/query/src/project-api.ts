import { can } from '@datahub/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { forbidden, permissionsOf } from './access.js';
import type { Catalogue, ProjectNotice } from './catalogue.js';
import type { Project, Projects } from './projects.js';
import type { Queries, Query, Viewer } from './queries.js';

export interface ProjectRouteOptions {
  projects: Projects;
  queries: Queries;
  catalogue: Catalogue;
  viewer: (request: FastifyRequest) => Viewer;
  authorization: (request: FastifyRequest) => string;
  /** Whether the User writes and runs this query: theirs, or of a Project they are in (DEC-SR-47). */
  writable: (request: FastifyRequest, query: Query) => Promise<boolean>;
  unavailable: (error: unknown, reply: FastifyReply, request: FastifyRequest) => FastifyReply | undefined;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_PROJECT = { error: 'not_found', message: 'There is no such Project, or you are not in it.' };
const NEEDS_QUERIES = 'Only who may make queries adds or removes the queries of a Project (OP-UX-98).';

/** The name and the sentence of a Project, new or changed; a string says what does not fit. */
export function parseProject(body: unknown, creating: boolean): { name?: string; description?: string; queries?: string[] } | string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return 'Send a JSON object.';
  const fields = body as Record<string, unknown>;
  const known = new Set(creating ? ['name', 'description', 'queries'] : ['name', 'description']);
  const unknown = Object.keys(fields).find((key) => !known.has(key));
  if (unknown) return `A Project has no field ${unknown} here.`;
  const result: { name?: string; description?: string; queries?: string[] } = {};
  if (fields.name !== undefined || creating) {
    if (typeof fields.name !== 'string' || fields.name.trim().length < 1 || fields.name.trim().length > 80) return 'The name has 1 to 80 characters.';
    result.name = fields.name.trim();
  }
  if (fields.description !== undefined) {
    if (typeof fields.description !== 'string' || fields.description.trim().length > 500) return 'What it is for has at most 500 characters.';
    result.description = fields.description.trim();
  }
  if (fields.queries !== undefined) {
    const ids = fields.queries;
    // Any number of them: a Project holds any number of queries (DEC-SR-49).
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string' && UUID.test(id)) || new Set(ids).size !== ids.length) {
      return 'A Project starts with queries, each named once by its ID.';
    }
    result.queries = (ids as string[]).map((id) => id.toLowerCase());
  }
  if (!creating && Object.keys(result).length === 0) return 'Send its name or what it is for.';
  return result;
}

/**
 * The routes of Projects (FR-SR-63 to FR-SR-66, TR-SR-33): who is in a Project reads it and changes it, shares it,
 * leaves it and deletes it; who may also make queries adds and removes its queries (OP-UX-98). A query of a Project
 * that reads a Resource someone may not see is locked to them: its name, who made it, its last run and which Resource,
 * never its SQL (OP-UX-97).
 */
export async function projectRoutes(app: FastifyInstance, options: ProjectRouteOptions): Promise<void> {
  const { projects, queries, catalogue, viewer, authorization, writable, unavailable } = options;

  /** The Project, if the User is in it; otherwise answered as not found. */
  async function member(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<Project | undefined> {
    const found = UUID.test(request.params.id) ? await projects.get(request.params.id.toLowerCase()) : undefined;
    if (!found || found.deletedAt || !(await projects.isMember(found.id, viewer(request).id))) {
      void reply.code(404).send(NO_PROJECT);
      return undefined;
    }
    return found;
  }

  /**
   * Tells a colleague what happened to them in a Project (MSG-QRY-03 to MSG-QRY-05, OP-UX-101). The Project never waits
   * on it: when catalogue does not answer, the change stands and nobody is told.
   */
  async function tell(request: FastifyRequest, notices: ProjectNotice[]): Promise<void> {
    if (!catalogue.projectNotice || notices.length === 0) return;
    const results = await Promise.allSettled(notices.map((notice) => catalogue.projectNotice?.(notice)));
    for (const result of results) {
      if (result.status === 'rejected') request.log.warn({ err: result.reason }, 'a Message about a Project was not sent');
    }
  }

  /** A Project as its page shows it: who is in it, and its queries in their order, locked where the User may not see a Resource. */
  async function view(request: FastifyRequest, project: Project) {
    const [members, list, archivedAt] = await Promise.all([projects.members(project.id), projects.queries(project.id), projects.archivedAt(project.id, viewer(request).id)]);
    const ids = [...new Set(list.flatMap((query) => query.resources.map((resource) => resource.id)))];
    const seen = new Map(await Promise.all(ids.map(async (id) => [id, (await catalogue.resource(id, authorization(request))) !== null] as const)));
    const made = (userId: string) => list.filter((query) => query.ownerId === userId).length;
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      madeBy: { id: project.madeById, name: project.madeByName },
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      // Archived by this User: its page says so, with Back in your panel (DEC-UX-356); for the others it is as before.
      archivedAt,
      members: members.map((one) => ({
        id: one.userId,
        name: one.userName,
        addedBy: one.addedByName,
        addedAt: one.addedAt,
        queriesMade: made(one.userId),
      })),
      queries: list.map((query) => {
        const hidden = query.resources.filter((resource) => !seen.get(resource.id));
        const base = { id: query.id, name: query.name, owner: { id: query.ownerId, name: query.ownerName }, lastRun: query.lastRun, position: query.position };
        // Locked: its name, who made it, its last run and what the User may not see (OP-UX-97).
        if (hidden.length > 0) return { ...base, locked: true, notSeen: hidden.map((resource) => resource.displayName) };
        return { ...base, locked: false, question: query.question, resources: query.resources.map(({ id, displayName }) => ({ id, displayName })), broken: query.broken };
      }),
    };
  }

  app.get('/projects', async (request) => ({ projects: await projects.list(viewer(request).id) }));

  // A new Project, with its maker in it and the queries they put in it (FR-SR-63).
  app.post<{ Body: unknown }>('/projects', async (request, reply) => {
    if (!can(permissionsOf(request), 'queries.make')) return forbidden(reply, 'queries.make', 'Only who may make queries makes a Project.');
    const fields = parseProject(request.body, true);
    if (typeof fields === 'string') return reply.code(400).send({ error: 'invalid_request', message: fields });
    const ids = fields.queries ?? [];
    for (const id of ids) {
      const query = await queries.get(id);
      if (!query || query.kind !== 'query' || !(await writable(request, query))) return reply.code(400).send({ error: 'invalid_request', message: 'A Project holds only queries you write.' });
    }
    try {
      const made = await projects.create({ name: fields.name as string, description: fields.description ?? '', by: viewer(request), queryIds: ids });
      return reply.code(201).send({ project: await view(request, made) });
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });

  app.get<{ Params: { id: string } }>('/projects/:id', async (request, reply) => {
    const found = UUID.test(request.params.id) ? await projects.get(request.params.id.toLowerCase()) : undefined;
    // A deleted Project says so, by whom, when and why, to who was in it (OP-UX-100).
    if (found?.deletedAt && (await projects.members(found.id)).some((one) => one.userId === viewer(request).id)) {
      return { project: { id: found.id, name: found.name, deleted: { at: found.deletedAt, by: found.deletedByName, reason: found.deletedReason } } };
    }
    const project = await member(request, reply);
    if (!project) return reply;
    try {
      return { project: await view(request, project) };
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });

  // Its name and what it is for, changed in place by anyone in it (FR-SR-63).
  app.patch<{ Params: { id: string }; Body: unknown }>('/projects/:id', async (request, reply) => {
    const fields = parseProject(request.body, false);
    if (typeof fields === 'string') return reply.code(400).send({ error: 'invalid_request', message: fields });
    if (!(await member(request, reply))) return reply;
    const changed = await projects.update(request.params.id.toLowerCase(), { name: fields.name, description: fields.description });
    return { project: changed && { id: changed.id, name: changed.name, description: changed.description, updatedAt: changed.updatedAt } };
  });

  // Deleted for everyone, by anyone in it, with an optional reason; its queries stay with whoever made them (OP-UX-100).
  app.delete<{ Params: { id: string }; Body: unknown }>('/projects/:id', async (request, reply) => {
    const reason = ((request.body ?? {}) as Record<string, unknown>).reason;
    if (reason !== undefined && (typeof reason !== 'string' || reason.trim().length > 500)) return reply.code(400).send({ error: 'invalid_request', message: 'The reason has at most 500 characters.' });
    const project = await member(request, reply);
    if (!project) return reply;
    const who = viewer(request);
    const why = typeof reason === 'string' && reason.trim() ? reason.trim() : null;
    // Read before it goes: who else is in it, and how many of its queries each made, which stay theirs.
    const [members, list] = await Promise.all([projects.members(project.id), projects.queries(project.id)]);
    await projects.delete(project.id, who, why);
    await tell(
      request,
      members
        .filter((one) => one.userId !== who.id)
        .map((one) => ({
          type: 'MSG-QRY-05' as const,
          recipient: { id: one.userId, name: one.userName },
          projectId: project.id,
          project: project.name,
          actor: who.name,
          mine: list.filter((query) => query.ownerId === one.userId).length,
          ...(why ? { reason: why } : {}),
        })),
    );
    return reply.code(204).send();
  });

  // Archived by the User, out of their panel and nobody else's, or put back in it (DEC-UX-354, DEC-UX-355): at once,
  // as the one undoes the other, and nobody is told. It changes nothing of the Project itself.
  for (const [method, archived] of [['PUT', true], ['DELETE', false]] as const) {
    app.route<{ Params: { id: string } }>({
      method,
      url: '/projects/:id/archive',
      handler: async (request, reply) => {
        const project = await member(request, reply);
        if (!project) return reply;
        return { archivedAt: await projects.archive(project.id, viewer(request).id, archived) };
      },
    });
  }

  // Shared with a colleague, by anyone in it (FR-SR-65): who cannot run queries is added all the same (OP-UX-98), and
  // told so; whoever is added is told (MSG-QRY-03, OP-UX-101).
  app.put<{ Params: { id: string; userId: string }; Body: unknown }>('/projects/:id/members/:userId', async (request, reply) => {
    const { name, canQuery } = (request.body ?? {}) as Record<string, unknown>;
    const userId = request.params.userId;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 200 || !userId || userId.length > 128) {
      return reply.code(400).send({ error: 'invalid_request', message: 'A colleague, by their ID and name.' });
    }
    if (canQuery !== undefined && typeof canQuery !== 'boolean') {
      return reply.code(400).send({ error: 'invalid_request', message: 'Whether the colleague may make and run queries is true or false.' });
    }
    const project = await member(request, reply);
    if (!project) return reply;
    const who = viewer(request);
    const added = await projects.addMember(project.id, { id: userId, name: name.trim() }, who);
    if (added && userId !== who.id) {
      const queries = (await projects.queries(project.id)).length;
      await tell(request, [
        { type: 'MSG-QRY-03', recipient: { id: userId, name: name.trim() }, projectId: project.id, project: project.name, actor: who.name, queries, canRun: canQuery !== false },
      ]);
    }
    return reply.code(added ? 201 : 200).send({ added });
  });

  // Taken out by someone in it, who is told (MSG-QRY-04), or left, which tells nobody: the last one out deletes it
  // (OP-UX-100).
  app.delete<{ Params: { id: string; userId: string } }>('/projects/:id/members/:userId', async (request, reply) => {
    const project = await member(request, reply);
    if (!project) return reply;
    const who = viewer(request);
    const out = request.params.userId === who.id ? undefined : (await projects.members(project.id)).find((one) => one.userId === request.params.userId);
    const left = await projects.removeMember(project.id, request.params.userId, who);
    if (out) {
      await tell(request, [{ type: 'MSG-QRY-04', recipient: { id: out.userId, name: out.userName }, projectId: project.id, project: project.name, actor: who.name }]);
    }
    return { left, deleted: left === 0 };
  });

  // A query put in the Project, at its end, out of any other (OP-UX-93); only a query the User writes. A Project holds
  // any number of queries, so it is never full (DEC-SR-49).
  app.put<{ Params: { id: string; queryId: string } }>('/projects/:id/queries/:queryId', async (request, reply) => {
    if (!can(permissionsOf(request), 'queries.make')) return forbidden(reply, 'queries.make', NEEDS_QUERIES);
    const project = await member(request, reply);
    if (!project) return reply;
    const query = UUID.test(request.params.queryId) ? await queries.get(request.params.queryId.toLowerCase()) : undefined;
    if (!query || query.kind !== 'query' || !(await writable(request, query))) return reply.code(404).send({ error: 'not_found', message: 'There is no such query, or you do not write it.' });
    await projects.addQuery(project.id, query.id, viewer(request));
    return { added: true };
  });

  // A query out of the Project, without asking (OP-UX-106); it stays with whoever made it.
  app.delete<{ Params: { id: string; queryId: string } }>('/projects/:id/queries/:queryId', async (request, reply) => {
    if (!can(permissionsOf(request), 'queries.make')) return forbidden(reply, 'queries.make', NEEDS_QUERIES);
    const project = await member(request, reply);
    if (!project) return reply;
    const removed = UUID.test(request.params.queryId) && (await projects.removeQuery(project.id, request.params.queryId.toLowerCase()));
    return { removed };
  });

  // One order for everyone in it, and so one key for each of its first ten queries (OP-UX-95), of any number (DEC-SR-49).
  app.put<{ Params: { id: string }; Body: unknown }>('/projects/:id/order', async (request, reply) => {
    const ids = ((request.body ?? {}) as Record<string, unknown>).queries;
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string' && UUID.test(id))) {
      return reply.code(400).send({ error: 'invalid_request', message: 'The order is a list of queries, by their ID.' });
    }
    const project = await member(request, reply);
    if (!project) return reply;
    await projects.order(
      project.id,
      (ids as string[]).map((id) => id.toLowerCase()),
    );
    return { queries: (await projects.queries(project.id)).map((query) => query.id) };
  });
}

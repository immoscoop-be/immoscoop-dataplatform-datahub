import { z } from 'zod';
import { answer, attempt, refusal } from './answers.js';
import { type Context, READ, WRITE } from './context.js';
import { pages } from './datahub.js';

const id = z.string().min(1).describe('The ID of the Project.');
const name = z.string().min(1).max(80).describe('A short name, such as "Credit leads Q4".');
const description = z.string().max(500).describe('What it is for, in a sentence.');

/** A Project as the panel lists it: how many queries, and who is in it (DEC-UX-285). */
interface ProjectItem {
  id: string;
  name: string;
  description: string;
  queries: number;
  members: { id: string; name: string }[];
  /** When the User archived it, out of their panel only (DEC-UX-354); null while it is in it. */
  archivedAt?: string | null;
  [key: string]: unknown;
}

/** A query of a Project, in its order; locked when it reads a Resource the User may not see (OP-UX-97). */
interface ProjectQuery {
  id: string;
  name: string;
  locked: boolean;
  notSeen?: string[];
  [key: string]: unknown;
}

/** A Project as its page shows it: who is in it, and its queries in their order. */
interface LiveProject {
  id: string;
  name: string;
  description: string;
  members: { id: string; name: string }[];
  queries: ProjectQuery[];
  [key: string]: unknown;
}

/** A deleted Project, as it says so to who was in it: by whom, when and why (OP-UX-100). */
interface DeletedProject {
  id: string;
  name: string;
  deleted: { at: string; by: string | null; reason: string | null };
}

type Project = LiveProject | DeletedProject;
const isDeleted = (project: Project): project is DeletedProject => 'deleted' in project && typeof project.deleted === 'object' && project.deleted !== null;

/** A query as query answers it: the Project it is in, if any (DEC-SR-47). */
interface Query {
  id: string;
  name: string;
  project: { id: string; name: string } | null;
  [key: string]: unknown;
}

/**
 * Projects through Claude (FR-CL-39, DEC-CL-23), for a User whose Permission group lets them make queries
 * (queries.make): Claude sets up a Project for an analysis that takes many queries, any number of them (DEC-SR-49),
 * keeps its queries there and sets their order. A query is in one Project at most, so putting it in one moves it out
 * of another (OP-UX-93); Claude says so to the User first.
 *
 * Not through Claude, on purpose: sharing a Project with colleagues or taking someone out, which sends them Messages
 * (MSG-QRY-03, MSG-QRY-04), leaving it, and deleting it, for everyone in it (OP-UX-100). The User does that on its
 * page in Data Hub.
 */
export function projectTools({ server, hub, permits }: Context): void {
  if (!permits.query) return;
  const enc = encodeURIComponent;
  const pageOf = (projectId: string) => hub.page(pages.project(projectId));
  const queryPage = (queryId: string) => hub.page(pages.query(queryId));
  /** A Project with the link to its page, and each of its queries with the link to theirs. */
  const linked = (project: Project) =>
    isDeleted(project)
      ? { ...project, page: pageOf(project.id) }
      : { ...project, queries: project.queries.map((query) => ({ ...query, page: queryPage(query.id) })), page: pageOf(project.id) };
  /** What Claude says of the queries locked to the User: never their SQL, nor a guess at it (OP-UX-97). */
  const lockedNote = (project: Project): string => {
    if (isDeleted(project)) return '';
    const locked = project.queries.filter((query) => query.locked);
    return locked.length === 0
      ? ''
      : ` ${locked.length === 1 ? 'One of its queries is' : `${locked.length} of its queries are`} locked to the User: ${locked.map((query) => `${query.name} reads ${(query.notSeen ?? []).join(', ')}`).join('; ')}, which they may not see. Say so; never guess at their SQL.`;
  };
  /** The query, or null when the User may not read it: the call that follows says so then. */
  const queryOf = (queryId: string) =>
    hub
      .get<{ query: Query }>('query', `/queries/${enc(queryId)}`)
      .then(({ query }) => query)
      .catch(() => null);
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

  server.registerTool(
    'list_projects',
    {
      title: 'Find your Projects',
      description:
        'The Projects the User is in, the one changed last first, each with its name, what it is for, how many queries it holds and who is in it. A Project holds the queries of an analysis, worked on together by who is in it, in one order. archivedAt says when the User archived it, out of their panel only: it works as before, and they find it under All projects in Query.',
      annotations: READ,
    },
    () =>
      attempt(async () => {
        const { projects } = await hub.get<{ projects: ProjectItem[] }>('query', '/projects');
        return answer(
          { projects: projects.map((project) => ({ ...project, page: pageOf(project.id) })) },
          projects.length === 0 ? 'The User is in no Project. For an analysis that takes many queries, you may offer to set one up with create_project.' : undefined,
        );
      }),
  );

  server.registerTool(
    'get_project',
    {
      title: 'Read a Project',
      description:
        'A Project the User is in: its name, what it is for, who is in it, and its queries in their order, each with its question, Resources and last run. A query that reads a Resource the User may not see is locked to them: only its name, who made it, its last run and which Resource, never its SQL. A deleted Project says by whom, when and why.',
      inputSchema: { id },
      annotations: READ,
    },
    ({ id: projectId }) =>
      attempt(async () => {
        const { project } = await hub.get<{ project: Project }>('query', `/projects/${enc(projectId)}`);
        if (isDeleted(project)) {
          const { at, by, reason } = project.deleted;
          return answer(
            { project: linked(project) },
            `The Project ${project.name} was deleted${by ? ` by ${by}` : ''} on ${at}${reason ? `, because: ${reason}` : ', without a reason'}. Its queries stay with whoever made them, in their history of Query.`,
          );
        }
        return answer({ project: linked(project) }, `${project.queries.length === 0 ? 'It holds no queries yet.' : `It holds ${project.queries.length} queries, in the order everyone in it sees.`}${lockedNote(project)}`);
      }),
  );

  server.registerTool(
    'create_project',
    {
      title: 'Make a Project',
      description:
        'Makes a Project for an analysis that takes many queries: a name, what it is for, and queries of the User to start with, in their order. A query is in one Project at most: one in another Project moves out of it, so say so to the User first. Only the User is in the new Project; they share it with colleagues themselves, on its page in Data Hub. Make its queries in it with create_query and project, or put others in it with add_query_to_project.',
      inputSchema: {
        name,
        description: description.optional(),
        queries: z.array(z.string()).optional().describe('The IDs of queries of the User to start with, in their order.'),
      },
      annotations: WRITE,
    },
    ({ name: given, description: what, queries = [] }) =>
      attempt(async () => {
        // Where its starting queries were, to say which moved out of another Project (OP-UX-93).
        const before = await Promise.all(queries.map(queryOf));
        const { project } = await hub.send<{ project: Project }>('query', 'POST', '/projects', { name: given, ...(what === undefined ? {} : { description: what }), queries });
        const moved = before.filter((query): query is Query => Boolean(query?.project));
        const note = [
          `The Project ${project.name} is made${queries.length > 0 ? `, with ${queries.length} ${queries.length === 1 ? 'query' : 'queries'}` : ''}: ${pageOf(project.id)}.`,
          moved.length > 0 && `Moved into it, out of the Project they were in: ${moved.map((query) => `${query.name} (from ${query.project?.name})`).join(', ')}. Tell the User.`,
          'Only the User is in it: they share it with colleagues themselves, on its page in Data Hub. Make its queries in it with create_query and project.',
        ];
        return answer({ project: linked(project), movedFrom: moved.map((query) => ({ query: query.id, project: query.project })) }, note.filter(Boolean).join(' '));
      }),
  );

  server.registerTool(
    'update_project',
    {
      title: 'Change a Project',
      description:
        'Changes the name of a Project the User is in, what it is for, or the order of its queries. The order is one for everyone in the Project, and gives its first ten queries their keys Cmd+1 to Cmd+0 in Query. Name its queries in the order wanted: those left out follow them, in the order they had; an ID that is not in it is passed over.',
      inputSchema: {
        id,
        name: name.optional(),
        description: description.optional(),
        order: z.array(z.string()).min(1).optional().describe('The IDs of its queries, in the order wanted.'),
      },
      annotations: WRITE,
    },
    ({ id: projectId, name: given, description: what, order }) =>
      attempt(async () => {
        const fields = Object.fromEntries(Object.entries({ name: given, description: what }).filter(([, value]) => value !== undefined));
        if (Object.keys(fields).length === 0 && !order) return refusal('Name at least one thing to change: its name, what it is for, or the order of its queries.');
        if (Object.keys(fields).length > 0) await hub.send('query', 'PATCH', `/projects/${enc(projectId)}`, fields);
        if (order) await hub.send('query', 'PUT', `/projects/${enc(projectId)}/order`, { queries: order });
        const { project } = await hub.get<{ project: Project }>('query', `/projects/${enc(projectId)}`);
        const held = isDeleted(project) ? [] : project.queries.map((query) => query.id);
        const passed = (order ?? []).filter((queryId) => !held.some((one) => same(one, queryId)));
        const note = ['Changed.', order && 'Everyone in the Project sees this order; its first ten queries have the keys Cmd+1 to Cmd+0.', passed.length > 0 && `Not in this Project, so passed over: ${passed.join(', ')}.`];
        return answer({ project: linked(project) }, note.filter(Boolean).join(' '));
      }),
  );

  server.registerTool(
    'add_query_to_project',
    {
      title: 'Put a query in a Project',
      description:
        'Puts a query the User writes at the end of a Project they are in. A query is in one Project at most: putting it in this one moves it out of the one it is in, for everyone in that one. When it is in another Project (get_query names it), say so to the User first, and put it in only once they agree.',
      inputSchema: { id, query: z.string().min(1).describe('The ID of the query.') },
      annotations: WRITE,
    },
    ({ id: projectId, query: queryId }) =>
      attempt(async () => {
        const { query } = await hub.get<{ query: Query }>('query', `/queries/${enc(queryId)}`);
        const from = query.project;
        const shown = { query: { id: query.id, name: query.name, page: queryPage(query.id) }, project: { id: projectId, page: pageOf(projectId) } };
        if (from && same(from.id, projectId)) return answer({ ...shown, added: false, movedFrom: null }, `The query ${query.name} is in this Project already: nothing changed.`);
        await hub.send('query', 'PUT', `/projects/${enc(projectId)}/queries/${enc(query.id)}`);
        return answer(
          { ...shown, added: true, movedFrom: from ? { ...from, page: pageOf(from.id) } : null },
          from
            ? `The query ${query.name} moved out of the Project ${from.name} into this one, at the end of its row: who is in ${from.name} no longer finds it there. Tell the User.`
            : `The query ${query.name} is in the Project now, at the end of its row.`,
        );
      }),
  );

  server.registerTool(
    'remove_query_from_project',
    {
      title: 'Take a query out of a Project',
      description:
        'Takes a query out of a Project the User is in, for everyone in it. The query stays with whoever made it, in their history of Query; it is not deleted.',
      inputSchema: { id, query: z.string().min(1).describe('The ID of the query.') },
      annotations: WRITE,
    },
    ({ id: projectId, query: queryId }) =>
      attempt(async () => {
        const { removed } = await hub.send<{ removed: boolean }>('query', 'DELETE', `/projects/${enc(projectId)}/queries/${enc(queryId)}`);
        return answer(
          { removed, project: { id: projectId, page: pageOf(projectId) } },
          removed ? 'Taken out of the Project. The query stays with whoever made it, in their history of Query.' : 'The query was not in this Project: nothing changed.',
        );
      }),
  );
}

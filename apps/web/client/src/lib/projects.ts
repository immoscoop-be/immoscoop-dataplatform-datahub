import { type Call, createCall } from './api.js';
import type { Config } from './config.js';
import type { Run } from './query.js';
import type { Session } from './session.js';

/**
 * Projects (FR-SR-63, DEC-UX-282): a set of queries Users work on together, alone or with colleagues. Its queries are
 * the row on top of Query while the User works in it (OP-UX-94); a query is in one Project at most (OP-UX-93), in one
 * order for everyone in it (OP-UX-95), as many as the work needs (DEC-SR-49).
 */

/** A Project as the panel and "Work in" list it (DEC-UX-285). */
export interface ProjectItem {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  /** How many queries it holds. */
  queries: number;
  /** Who is in it, in the order they were added. */
  members: { id: string; name: string }[];
}

/** Someone in a Project, with who added them and how many of its queries they made (FR-SR-65). */
export interface ProjectMember {
  id: string;
  name: string;
  addedBy: string | null;
  addedAt: string;
  queriesMade: number;
}

/** A query of a Project, in its order; locked to a User who may not see one of its Resources (OP-UX-97). */
export interface ProjectQuery {
  id: string;
  name: string;
  owner: { id: string; name: string };
  lastRun: { userName: string; state: Run['state']; startedAt: string } | null;
  position: number;
  locked: boolean;
  /** Locked: the Resources the User may not see. */
  notSeen?: string[];
  question?: string;
  resources?: { id: string; displayName: string }[];
  broken?: unknown;
}

/** The page of a Project (DEC-UX-285); a deleted one says by whom, when and why (OP-UX-100). */
export interface Project {
  id: string;
  name: string;
  description: string;
  madeBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  members: ProjectMember[];
  queries: ProjectQuery[];
}

export interface DeletedProject {
  id: string;
  name: string;
  deleted: { at: string; by: string | null; reason: string | null };
}

export type ProjectPage = Project | DeletedProject;

export const isDeleted = (project: ProjectPage): project is DeletedProject => 'deleted' in project;

/**
 * Who is in a Project besides the User, as the panel and "Work in" say it: "only you", "with Karel Leys and An Claes",
 * or "with 4 colleagues" (DEC-UX-285).
 */
export function withWhom(members: readonly { id: string; name: string }[], me: string): { kind: 'alone' } | { kind: 'named'; names: string[] } | { kind: 'many'; count: number } {
  const others = members.filter((member) => member.id !== me);
  if (others.length === 0) return { kind: 'alone' };
  if (others.length <= 2) return { kind: 'named', names: others.map((member) => member.name) };
  return { kind: 'many', count: others.length };
}

/** Whether a Project matches the words of the search of the panel by its name or what it is for (DEC-UX-285). */
export function projectMatches(project: Pick<ProjectItem, 'name' | 'description'>, words: string): boolean {
  const wanted = words.trim().toLowerCase();
  return wanted === '' || project.name.toLowerCase().includes(wanted) || project.description.toLowerCase().includes(wanted);
}

/** The order with a query at one place moved to another, as dragging a tab or a row does (OP-UX-95). */
export function moved<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length || to < 0 || to >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

export const projectPath = (id: string): string => `/query/projects/${encodeURIComponent(id)}`;

export function createProjects(config: Config, session: Pick<Session, 'accessToken'>, request?: typeof fetch) {
  const call: Call = createCall('query', config.queryUrl, session, request);
  const project = (id: string) => `/projects/${encodeURIComponent(id)}`;
  return {
    /** The Projects the User is in, the one changed last first. */
    async list(): Promise<ProjectItem[]> {
      return ((await (await call('/projects')).json()) as { projects: ProjectItem[] }).projects;
    },
    /** Its page; a deleted one to who was in it says by whom, when and why. */
    async get(id: string): Promise<ProjectPage> {
      return ((await (await call(project(id))).json()) as { project: ProjectPage }).project;
    },
    /** A new Project, with the User in it and these queries, moved from where they were (OP-UX-93). */
    async create(fields: { name: string; description?: string; queries?: string[] }): Promise<Project> {
      return ((await (await call('/projects', { method: 'POST', body: fields })).json()) as { project: Project }).project;
    },
    /** Its name or what it is for, changed in place by anyone in it. */
    async update(id: string, fields: { name?: string; description?: string }): Promise<void> {
      await call(project(id), { method: 'PATCH', body: fields });
    },
    /** Deletes it for everyone, with an optional reason (OP-UX-100). */
    async remove(id: string, reason?: string): Promise<void> {
      await call(project(id), { method: 'DELETE', body: reason ? { reason } : {} });
    },
    /** Shares it with a colleague; who cannot run queries is added all the same (OP-UX-98). */
    async addMember(id: string, person: { id: string; name: string; canQuery?: boolean }): Promise<boolean> {
      return ((await (await call(`${project(id)}/members/${encodeURIComponent(person.id)}`, { method: 'PUT', body: { name: person.name, canQuery: person.canQuery ?? true } })).json()) as { added: boolean }).added;
    },
    /** Takes someone out, or leaves it; the last one out deletes it. */
    async removeMember(id: string, userId: string): Promise<{ left: number; deleted: boolean }> {
      return (await (await call(`${project(id)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' })).json()) as { left: number; deleted: boolean };
    },
    /** Puts a query at the end of it, out of any other (OP-UX-93); a Project holds any number (DEC-SR-49). */
    async addQuery(id: string, queryId: string): Promise<void> {
      await call(`${project(id)}/queries/${encodeURIComponent(queryId)}`, { method: 'PUT' });
    },
    /** Takes a query out, without asking; it stays with whoever made it (OP-UX-106). */
    async removeQuery(id: string, queryId: string): Promise<void> {
      await call(`${project(id)}/queries/${encodeURIComponent(queryId)}`, { method: 'DELETE' });
    },
    /** The one order of its queries, for everyone in it (OP-UX-95). */
    async order(id: string, queryIds: readonly string[]): Promise<string[]> {
      return ((await (await call(`${project(id)}/order`, { method: 'PUT', body: { queries: queryIds } })).json()) as { queries: string[] }).queries;
    },
  };
}

export type Projects = ReturnType<typeof createProjects>;

import type { Config } from './config.js';
import type { Session } from './session.js';

// The shapes the page reads from identity and registry. Once the services describe their APIs with
// zod in @datahub/contracts (TR-PF-10), these come from there.

export interface Me {
  sub: string;
  email: string;
  name: string;
  groups: string[];
  roles: string[];
}

export interface Project {
  projectId: string;
  name: string | null;
  runId: string | null;
  processedAt: string | null;
  nodeCount: number;
}

export interface NodeSummary {
  uniqueId: string;
  name: string;
  resourceType: string;
  projectId: string;
  projectName: string | null;
  description: string;
  relation: string | null;
}

export interface SearchHit extends NodeSummary {
  matchedColumns: string[];
}

export interface NodeDetail extends NodeSummary {
  materialized: string | null;
  tags: string[];
  filePath: string | null;
  columns: { name: string; dataType: string | null; description: string }[];
  tests: { name: string; columnName: string | null; severity: string | null; targetNodeId: string | null; targetColumn: string | null }[];
}

export type Direction = 'upstream' | 'downstream';

export interface Lineage {
  direction: Direction;
  /** The Nodes reached, with how many steps away they are; the Node itself at 0. */
  nodes: (NodeSummary & { distance: number })[];
  truncated: boolean;
}

/** The User has no session (any more): the page shows the sign-in. */
export class SignedOut extends Error {
  constructor() {
    super('signed out');
  }
}

/** A service answered with an error; the message is the one it gave, when it gave one. */
export class ServiceError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Api = ReturnType<typeof createApi>;

/** The calls of the page to the services, with the Access Token of the User (DEC-PF-03). */
export function createApi(config: Pick<Config, 'identityUrl' | 'registryUrl'>, session: Pick<Session, 'accessToken'>, request: typeof fetch = (input, init) => fetch(input, init)) {
  async function get<T>(base: string, path: string, service: string): Promise<T> {
    const token = await session.accessToken();
    if (!token) {
      throw new SignedOut();
    }
    const response = await request(`${base}${path}`, { headers: { authorization: `Bearer ${token}` } });
    if (response.status === 401) {
      throw new SignedOut();
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      throw new ServiceError(response.status, body.message ?? `${service} answered ${response.status}.`);
    }
    return (await response.json()) as T;
  }
  const registry = <T>(path: string) => get<T>(config.registryUrl, path, 'registry');
  const id = encodeURIComponent;

  return {
    me: () => get<Me>(config.identityUrl, '/me', 'identity'),
    projects: async () => (await registry<{ projects: Project[] }>('/projects')).projects,
    search: async (query: string) => (await registry<{ nodes: SearchHit[] }>(`/nodes?q=${id(query)}`)).nodes,
    node: (uniqueId: string) => registry<NodeDetail>(`/nodes/${id(uniqueId)}`),
    lineage: (uniqueId: string, direction: Direction) => registry<Lineage>(`/nodes/${id(uniqueId)}/lineage?direction=${direction}`),
  };
}

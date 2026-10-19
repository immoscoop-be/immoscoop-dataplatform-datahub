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
  /** The meta of the Node in its dbt project: any JSON object. */
  meta: Record<string, unknown>;
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

/** An example request of a chart, which semgraph draws at its `href`. */
export interface ChartExample {
  name: string;
  title: string;
  href: string;
}

/** A chart semgraph offers, as its overview lists it. */
export interface ChartSummary {
  id: string;
  title: string;
  /** The question the chart answers. */
  answers: string;
  links: { figma?: string; learning?: string };
  examples: ChartExample[];
}

export interface ChartCatalog {
  semgraphs: ChartSummary[];
  /** The IDs of the charts still to come. */
  planned: string[];
}

export interface ChartDetail extends ChartSummary {
  exampleQuestions: string[];
  /** When another chart fits better: the intent, and the ID of that chart. */
  doNotUseWhen: { intent: string; use: string }[];
  /** The contract of a request; a chart that takes `size` can be drawn in every size. */
  schema: { properties?: Record<string, unknown> };
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
export function createApi(config: Pick<Config, 'identityUrl' | 'registryUrl' | 'semgraphUrl'>, session: Pick<Session, 'accessToken'>, request: typeof fetch = (input, init) => fetch(input, init)) {
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

  /** semgraph is open to everyone (DEC-PF-24): no Access Token. Its problems carry their reason in issues. */
  async function semgraph<T>(path: string): Promise<T> {
    const response = await request(`${config.semgraphUrl}${path}`);
    const body = (await response.json().catch(() => ({}))) as T & { issues?: { message?: string }[] };
    if (!response.ok) {
      throw new ServiceError(response.status, body.issues?.[0]?.message ?? `semgraph answered ${response.status}.`);
    }
    return body;
  }

  return {
    me: () => get<Me>(config.identityUrl, '/me', 'identity'),
    projects: async () => (await registry<{ projects: Project[] }>('/projects')).projects,
    search: async (query: string) => (await registry<{ nodes: SearchHit[] }>(`/nodes?q=${id(query)}`)).nodes,
    node: (uniqueId: string) => registry<NodeDetail>(`/nodes/${id(uniqueId)}`),
    lineage: (uniqueId: string, direction: Direction) => registry<Lineage>(`/nodes/${id(uniqueId)}/lineage?direction=${direction}`),
    charts: () => semgraph<ChartCatalog>('/semgraphs'),
    chart: (chartId: string) => semgraph<ChartDetail>(`/semgraphs/${id(chartId)}`),
    /** Why semgraph refuses to draw an example: the message of its refusal, in the language of the example. */
    refusal: async (href: string): Promise<string | undefined> => {
      const response = await request(`${config.semgraphUrl}${href}`);
      const body = (await response.json().catch(() => ({}))) as { issues?: { level: string; message: string }[] };
      return body.issues?.find((issue) => issue.level === 'refusal' || issue.level === 'inputError')?.message;
    },
  };
}

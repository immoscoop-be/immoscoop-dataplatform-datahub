import type { CollectionColour, CollectionVisibility } from '@datahub/contracts/collections';
import type { Config } from './config.js';
import type { Session } from './session.js';

// The shapes the page reads from identity, catalogue and registry. Once the services describe their APIs with
// zod in @datahub/contracts (TR-PF-10), these come from there.

export interface Me {
  sub: string;
  email: string;
  name: string;
  groups: string[];
  roles: string[];
}

/** A group of the User, which they can choose as Owner Unit (TR-CO-03). */
export interface Group {
  id: string;
  email: string;
  name: string;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  colour: CollectionColour;
  ownerUnit: Group;
  visibility: CollectionVisibility;
  createdAt: string;
  /** Whether the User may change and dissolve it: its Owner Unit and the Data Team (FR-CO-13). */
  canManage: boolean;
}

/** What the User fills in for a Collection; the Owner Unit by the ID of one of their groups. */
export interface CollectionFields {
  name: string;
  description: string;
  colour: CollectionColour;
  ownerUnit: string;
  visibility: CollectionVisibility;
}

/** A table a dbt project exposes to Data Hub with the tag `datahub` (DEC-SR-22). */
export interface Resource {
  id: string;
  /** The full name of the table in BigQuery. */
  key: string;
  displayName: string;
  name: string;
  resourceType: string;
  projectId: string;
  projectName: string | null;
  /** The unique ID of its Node in registry. */
  nodeId: string;
  description: string;
  /** The exposures that make it a Resource. */
  exposures: string[];
  collectionId: string | null;
  registeredAt: string;
  /** No exposure depends on it any more; it is held until one does again (DEC-SR-26). */
  withdrawn: boolean;
}

/** A Log Entry of a Collection, with the text catalogue built from its template. */
export interface LogEntry {
  logId: string;
  text: string;
  at: string;
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
export function createApi(
  config: Pick<Config, 'identityUrl' | 'catalogueUrl' | 'registryUrl' | 'semgraphUrl'>,
  session: Pick<Session, 'accessToken'>,
  request: typeof fetch = (input, init) => fetch(input, init),
) {
  async function call<T>(base: string, path: string, service: string, method = 'GET', body?: object): Promise<T> {
    const token = await session.accessToken();
    if (!token) {
      throw new SignedOut();
    }
    const headers: Record<string, string> = { authorization: `Bearer ${token}` };
    if (body) {
      headers['content-type'] = 'application/json';
    }
    const response = await request(`${base}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (response.status === 401) {
      throw new SignedOut();
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      throw new ServiceError(response.status, body.message ?? `${service} answered ${response.status}.`);
    }
    return (response.status === 204 ? undefined : await response.json()) as T;
  }
  const registry = <T>(path: string) => call<T>(config.registryUrl, path, 'registry');
  const catalogue = <T>(path: string, method?: string, body?: object) => call<T>(config.catalogueUrl, path, 'catalogue', method, body);
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
    me: () => call<Me>(config.identityUrl, '/me', 'identity'),
    /** The groups of the User, read from Workspace now: the Owner Units they can choose. */
    groups: async () => (await call<{ groups: Group[] }>(config.identityUrl, '/me/groups', 'identity')).groups,
    collections: async () => (await catalogue<{ collections: Collection[] }>('/collections')).collections,
    collection: (collectionId: string) => catalogue<Collection>(`/collections/${id(collectionId)}`),
    collectionLog: async (collectionId: string) => (await catalogue<{ entries: LogEntry[] }>(`/collections/${id(collectionId)}/log`)).entries,
    createCollection: (fields: CollectionFields) => catalogue<Collection>('/collections', 'POST', fields),
    changeCollection: (collectionId: string, fields: Partial<CollectionFields>) => catalogue<Collection>(`/collections/${id(collectionId)}`, 'PATCH', fields),
    dissolveCollection: (collectionId: string) => catalogue<void>(`/collections/${id(collectionId)}`, 'DELETE'),
    /** The Resources of a Collection, as far as the User may see them. */
    collectionResources: async (collectionId: string) => (await catalogue<{ resources: Resource[] }>(`/collections/${id(collectionId)}/resources`)).resources,
    /** The Resources that wait for a Collection; for the Data Team. */
    waitingResources: async () => (await catalogue<{ resources: Resource[] }>('/resources?collection=none')).resources,
    addToCollection: (resourceId: string, collectionId: string) => catalogue<Resource>(`/resources/${id(resourceId)}/collection`, 'PUT', { collectionId }),
    removeFromCollection: (resourceId: string) => catalogue<void>(`/resources/${id(resourceId)}/collection`, 'DELETE'),
    projects: async () => (await registry<{ projects: Project[] }>('/projects')).projects,
    /** Searches the Current Versions, of every dbt project or of one. */
    search: async (query: string, project?: string) =>
      (await registry<{ nodes: SearchHit[] }>(`/nodes?q=${id(query)}${project ? `&project=${id(project)}` : ''}`)).nodes,
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

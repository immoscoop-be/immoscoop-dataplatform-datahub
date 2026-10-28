import { createCall } from './api.js';
import type { Config } from './config.js';
import type { Session } from './session.js';

/** A Resource as catalogue gives it (TR-SR-05). */
export interface Resource {
  id: string;
  key: string;
  displayName: string;
  name: string;
  resourceType: string;
  projectId: string;
  projectName: string | null;
  /** The Node of the registry it is the table of. */
  nodeId: string;
  description: string;
  exposures: string[];
  collectionId: string | null;
  level: number;
  registeredAt: string;
  withdrawn: boolean;
}

export interface Field {
  name: string;
  position: number | null;
  dataType: string | null;
  description: string;
}

/** A Resource with its fields, and the columns of its table left out of it (DEC-SR-33). */
export interface ResourceDetail extends Resource {
  fields: Field[];
  leftOut: { name: string; dataType: string | null; reason: string }[];
}

/** An entry of a Log: its Log ID and parameters; the page builds its text in the language of the reader. */
export interface LogEntry {
  logId: string;
  params: Record<string, string>;
  at: string;
}

/** A group of Workspace, as the Owner Unit of a Collection (TR-CO-03). */
export interface OwnerUnit {
  id: string;
  email: string;
  name: string;
}

/** A Resource as its Collection lists it, in the panel. */
export interface CollectionItem {
  id: string;
  displayName: string;
  level: number;
  published: boolean;
  withdrawn: boolean;
}

/** A Collection as the User sees it (TR-CO-02): with the Resources in it they see, and its last change. */
export interface Collection {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  ownerUnit: OwnerUnit;
  visibility: 'private' | 'public';
  createdAt: string;
  createdBy: string;
  canManage: boolean;
  resources: CollectionItem[];
  lastChange: LogEntry | null;
}

/** A Resource as the page of its Collection lists it, with the latest entry of its Log (FR-CO-27). */
export interface CollectionResource extends Resource {
  lastChange: LogEntry | null;
}

/** What a User sends to make a Collection, or what they change of one. */
export interface CollectionFields {
  name: string;
  description: string;
  icon: string;
  ownerUnit: string;
  visibility: 'private' | 'public';
}

/** The calls of the page to catalogue, with the Access Token of the User. */
export function createCatalogue(config: Config, session: Pick<Session, 'accessToken'>, request?: typeof fetch) {
  const call = createCall('catalogue', config.catalogueUrl, session, request);
  const resource = (id: string) => `/resources/${encodeURIComponent(id)}`;
  const collection = (id: string) => `/collections/${encodeURIComponent(id)}`;

  return {
    /** The Resources that wait for a Collection: only the Data Team may ask (FR-SR-35). */
    async waiting(): Promise<Resource[]> {
      return ((await (await call('/resources?collection=none')).json()) as { resources: Resource[] }).resources;
    },
    async resource(id: string): Promise<ResourceDetail> {
      return ((await (await call(resource(id))).json()) as { resource: ResourceDetail }).resource;
    },
    async log(id: string): Promise<LogEntry[]> {
      return ((await (await call(`${resource(id)}/log`)).json()) as { entries: LogEntry[] }).entries;
    },
    /** Every Collection the User sees, by name (FR-CO-17, FR-CO-18). */
    async collections(): Promise<Collection[]> {
      return ((await (await call('/collections')).json()) as { collections: Collection[] }).collections;
    },
    async collection(id: string): Promise<Collection> {
      return (await call(collection(id))).json() as Promise<Collection>;
    },
    async collectionResources(id: string): Promise<CollectionResource[]> {
      return ((await (await call(`${collection(id)}/resources`)).json()) as { resources: CollectionResource[] }).resources;
    },
    async collectionLog(id: string): Promise<LogEntry[]> {
      return ((await (await call(`${collection(id)}/log`)).json()) as { entries: LogEntry[] }).entries;
    },
    async createCollection(fields: CollectionFields): Promise<Collection> {
      return (await call('/collections', { method: 'POST', body: fields })).json() as Promise<Collection>;
    },
    /** Changes what is sent; catalogue logs every change (FR-CO-11). */
    async changeCollection(id: string, changes: Partial<CollectionFields>): Promise<Collection> {
      return (await call(collection(id), { method: 'PATCH', body: changes })).json() as Promise<Collection>;
    },
    /** Dissolves an empty Collection (FR-CO-10). */
    async dissolveCollection(id: string): Promise<void> {
      await call(collection(id), { method: 'DELETE' });
    },
    /**
     * Adds Resources without a Collection to it, all of them or none (FR-CO-31): only the Data Team may.
     * Each by its ID, or with what the Data Admin recorded for it (FR-CO-33, FR-CO-34).
     */
    async addResources(id: string, resources: readonly (string | ({ id: string } & Record<string, unknown>))[]): Promise<CollectionResource[]> {
      return ((await (await call(`${collection(id)}/resources`, { method: 'POST', body: { resources } })).json()) as { resources: CollectionResource[] }).resources;
    },
    /** Takes a Resource out of its Collection: only the Data Team may (FR-CO-14). */
    async removeResource(id: string): Promise<void> {
      await call(`${resource(id)}/collection`, { method: 'DELETE' });
    },
  };
}

export type Catalogue = ReturnType<typeof createCatalogue>;

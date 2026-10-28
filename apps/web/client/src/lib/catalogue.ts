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
  /** Published: everyone who sees its Collection sees it (FR-SR-31). */
  published: boolean;
  /** Its use is discouraged (FR-SR-50). */
  deprecated: boolean;
}

export interface Field {
  name: string;
  position: number | null;
  dataType: string | null;
  /** From dbt. */
  description: string;
  /** From the Owner or the Data Team, next to the one from dbt; empty when there is none (FR-RC-16). */
  businessDescription: string;
}

/** The mapping of a field, as the Data Admin recorded it (DEC-RC-05, DEC-RC-06, DEC-RC-14). */
export interface Mapping {
  field: string;
  kind: 'is' | 'relation' | 'performedBy';
  relationType: string | null;
  identity: string;
  subject: string | null;
  origin: 'domainModel' | 'name' | 'here';
  inDomainModel: boolean;
}

/** What the Data Admin recorded when adding a Resource (FR-CO-33, FR-CO-34, TR-CO-05). */
export interface Details {
  partition: { field: string; unit: 'hour' | 'day' | 'month' | 'year' | null } | null;
  clusterBy: string[];
  partitionFilter: 'none' | 'dataHub' | 'bigQuery';
  grain: string[];
  grainSentence: string;
  modelType: 'event' | 'state' | 'fact' | 'dimension' | 'aggregate' | null;
  origins: Partial<Record<'partition' | 'clusterBy' | 'partitionFilter' | 'grain' | 'grainSentence' | 'modelType', 'dbt' | 'test' | 'domainModel' | 'here'>>;
  release: string | null;
  mappings: Mapping[];
}

/** What the Owner and the Data Team keep about a Resource in Data Hub (FR-RC-15, TR-SR-10). */
export interface Card {
  businessDescription: string;
  intendedUse: string;
  pitfalls: string;
  knownGaps: string[];
  /** A day, `YYYY-MM-DD`, or null. */
  reliableSince: string | null;
  keyFields: string[];
  parameters: string[];
}

/** A Resource with its fields, and the columns of its table left out of it (DEC-SR-33). */
export interface ResourceDetail extends Resource {
  fields: Field[];
  leftOut: { name: string; dataType: string | null; reason: string }[];
  details: Details;
  card: Card;
  /** Who published it and when, and who confirmed it last and when (FR-RC-12); null until it is published. */
  publication: { publishedAt: string; publishedBy: string; confirmedAt: string; confirmedBy: string } | null;
  /** Who deprecated it, when, why and what to use instead (DEC-UX-101). */
  deprecation: { at: string; by: string; reason: string; insteadOf: { id: string; displayName: string } | null } | null;
  /** The fields that changed since its last Confirmation, not marked seen yet: its warning (FR-MR-12). */
  changes: { field: string; change: 'added' | 'removed' | 'retyped'; old: string | null; new: string | null; at: string }[];
  /** The descriptions from dbt that changed in the last 30 days, with the text before; no field for the table (FR-RC-17). */
  descriptionChanges: { field: string | null; before: string; at: string }[];
}

/** A mapping of a Resource with the other Resources the User sees that carry the same identity (FR-RC-09). */
export interface Related extends Pick<Mapping, 'field' | 'kind' | 'relationType' | 'identity' | 'inDomainModel'> {
  resources: { id: string; displayName: string; level: number; field: string }[];
}

/** A model in the lineage around a Resource (DEC-AR-06). */
export interface LineageNode {
  uniqueId: string;
  name: string;
  resourceType: string;
  layer: string;
  projectId: string;
  projectName: string | null;
  distance: number;
}

export interface LineageSide {
  nodes: LineageNode[];
  edges: { parentId: string; childId: string }[];
  truncated: boolean;
}

/** The lineage around a Resource, with the Resources on it the User sees (TR-SR-11). */
export interface ResourceLineage {
  nodeId: string;
  upstream: LineageSide | null;
  downstream: LineageSide | null;
  resources: { nodeId: string; id: string; displayName: string; level: number }[];
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
  deprecated: boolean;
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
    /** Changes what is sent of the Resource Card; catalogue logs every change (FR-RC-15). */
    async editResource(id: string, changes: Partial<Card>): Promise<ResourceDetail> {
      return ((await (await call(resource(id), { method: 'PATCH', body: changes })).json()) as { resource: ResourceDetail }).resource;
    },
    /** Writes the Business Descriptions of fields; an empty one removes it (FR-RC-16). */
    async describeFields(id: string, fields: readonly { name: string; businessDescription: string }[]): Promise<ResourceDetail> {
      return ((await (await call(`${resource(id)}/fields`, { method: 'PUT', body: { fields } })).json()) as { resource: ResourceDetail }).resource;
    },
    /** Records the grain, storage and mappings again, from Edit relations: only a Data Admin may (DEC-UX-107). */
    async relate(id: string, details: Record<string, unknown>): Promise<ResourceDetail> {
      return ((await (await call(`${resource(id)}/details`, { method: 'PUT', body: details })).json()) as { resource: ResourceDetail }).resource;
    },
    /** Publishes it, its first Confirmation: only its Owner may (FR-SR-49). */
    async publish(id: string): Promise<ResourceDetail> {
      return ((await (await call(`${resource(id)}/publication`, { method: 'POST' })).json()) as { resource: ResourceDetail }).resource;
    },
    /** Marks the changes since its last Confirmation seen (FR-MR-12). */
    async markSeen(id: string): Promise<ResourceDetail> {
      return ((await (await call(`${resource(id)}/changes/seen`, { method: 'POST' })).json()) as { resource: ResourceDetail }).resource;
    },
    /** Marks it deprecated, with why and what to use instead, or takes that away (FR-SR-50). */
    async deprecate(id: string, reason: string, insteadOf: string | null): Promise<ResourceDetail> {
      return ((await (await call(`${resource(id)}/deprecation`, { method: 'PUT', body: { reason, insteadOf } })).json()) as { resource: ResourceDetail }).resource;
    },
    async undeprecate(id: string): Promise<ResourceDetail> {
      return ((await (await call(`${resource(id)}/deprecation`, { method: 'DELETE' })).json()) as { resource: ResourceDetail }).resource;
    },
    async related(id: string): Promise<Related[]> {
      return ((await (await call(`${resource(id)}/related`)).json()) as { related: Related[] }).related;
    },
    async lineage(id: string): Promise<ResourceLineage> {
      return (await call(`${resource(id)}/lineage`)).json() as Promise<ResourceLineage>;
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

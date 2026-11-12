import type { GapScope } from '@datahub/contracts/gaps';
import { createCall, NotFound, Refused } from './api.js';
import type { Config } from './config.js';
import type { Session } from './session.js';
import type { Marked } from './query.js';

/** A Resource as catalogue gives it (TR-SR-05). */
export interface Resource {
  id: string;
  key: string;
  /** The full name of its table in its own case, as BigQuery knows it; what is shown and copied. */
  fullName?: string;
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

/** A Known Gap, with who added it and when; neither for a gap of before (FR-RC-21). */
export interface KnownGap {
  id: string;
  text: string;
  /** Where it holds: a period, fields and rows; null for a gap of free text (FR-RC-24). */
  scope: GapScope | null;
  addedBy: string | null;
  addedAt: string | null;
}

/** What changes about a Resource at once; its Known Gaps change one at a time (FR-RC-21). */
export type CardChanges = Partial<Omit<Card, 'knownGaps'>>;

/** What the Owner and the Data Team keep about a Resource in Data Hub (FR-RC-15, TR-SR-10). */
export interface Card {
  businessDescription: string;
  intendedUse: string;
  pitfalls: string;
  /** One item each, in the order they were added (FR-RC-21). */
  knownGaps: KnownGap[];
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
  /**
   * What the User may do with it, as catalogue says from their Permissions and its Owner Unit (TR-PL-06): describe
   * any attribute, each attribute (DEC-PL-03), publish it as its Owner (DEC-PL-06), deprecate it, and the work of a
   * Data Admin. Left out by an older catalogue, when the page falls back on whether the User manages its Collection.
   */
  canEdit?: boolean;
  canDescribe?: Readonly<Record<DescribeAttribute, boolean>>;
  canPublish?: boolean;
  canDeprecate?: boolean;
  canAssign?: boolean;
}

/** The attributes of a Resource that are described one by one (DEC-PL-03). */
export type DescribeAttribute = 'description' | 'behaviour' | 'pitfalls' | 'availableSince' | 'gaps' | 'keyFields' | 'entityMapping';

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

/** A Group of Data Hub, as the Owner Unit of a Collection (TR-CO-03): named, without an address (FR-UM-12). */
export interface OwnerUnit {
  id: string;
  name: string;
  /** Left over from the groups of Google: null now, and never shown. */
  email?: string | null;
}

/** A Collection as the Group that is its Owner Unit shows it (FR-UM-18). */
export interface OwnedCollection {
  id: string;
  name: string;
  icon: string | null;
  visibility: 'private' | 'public';
}

/** A Resource as its Collection lists it, in the panel. */
export interface CollectionItem {
  id: string;
  /** Its full name in BigQuery, by which a query names it (DEC-UX-73). */
  key: string;
  displayName: string;
  level: number;
  published: boolean;
  deprecated: boolean;
  withdrawn: boolean;
  /** The folder it sits in, or null at the top of its Collection (FR-CO-38). */
  folderId: string | null;
}

/** A folder of a Collection (FR-CO-38, TR-CO-07). */
export interface Folder {
  id: string;
  name: string;
  /** Plain text under its name, empty when it has none (FR-CO-42). */
  description: string;
  /** The folder it sits in, or null at the top of its Collection. */
  parentId: string | null;
  /** The name of whoever made it, and when. */
  createdBy: string;
  createdAt: string;
}

/** What moves between the folders of a Collection (FR-CO-40). */
export type MovableKind = 'resource' | 'lens' | 'folder';

/** A Collection as the User sees it (TR-CO-02): with the Resources in it they see, and its last change. */
export interface Collection {
  id: string;
  name: string;
  description: string;
  /** What its Owner Unit tells about it, in Markdown; empty when there is none (FR-CO-41). */
  intro: string;
  icon: string | null;
  ownerUnit: OwnerUnit;
  visibility: 'private' | 'public';
  createdAt: string;
  createdBy: string;
  /** The User may change it (`collections.manage`, within its reach). */
  canManage: boolean;
  /** Its Owner Unit is one of the groups of the User; left out by an older catalogue. */
  owned?: boolean;
  resources: CollectionItem[];
  /** Its folders, by name (FR-CO-38). */
  folders: Folder[];
  /** The folder of each of its Lenses that sits in one, by the ID of the Lens. */
  lensFolders: Record<string, string>;
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
  /** In Markdown (FR-CO-41); a new Collection may be made without. */
  intro?: string;
}

/** The calls of the page to catalogue, with the Access Token of the User. */
/** A Collection that shares words with a question, its name and description with them marked (DEC-UX-127). */
export interface FoundCollection {
  id: string;
  name: Marked[];
  description: Marked[];
  icon: string | null;
  /** How many of its Resources the User sees. */
  resources: number;
  shared: number;
}

/** A Resource that shares words with a question: its name and its description, the Business Description first. */
export interface FoundResource {
  id: string;
  displayName: Marked[];
  description: Marked[];
  collectionId: string;
  collectionName: string;
  level: number;
  shared: number;
}

/** What Profile shows of Slack (FR-LN-07). */
export interface SlackState {
  /** Whether the Slack app of Data Hub is set up here; without it there is no tile (OP-UX-78). */
  on: boolean;
  /** The address of the User's Google account. */
  google: string;
  /** The address Data Hub finds them by in Slack. */
  address: string;
  /** When they confirmed another address; null while it is the Google address. */
  confirmedAt: string | null;
  /** The name of the Slack account of that address; null when no one has it. */
  name: string | null;
}

export function createCatalogue(config: Config, session: Pick<Session, 'accessToken'>, request?: typeof fetch) {
  const call = createCall('catalogue', config.catalogueUrl, session, request);
  const resource = (id: string) => `/resources/${encodeURIComponent(id)}`;
  const collection = (id: string) => `/collections/${encodeURIComponent(id)}`;

  return {
    /** The Slack account Data Hub finds the User by, or that it finds none; `on` is false without the Slack app (FR-LN-07). */
    async slack(): Promise<SlackState> {
      return (await (await call('/me/slack')).json()) as SlackState;
    },
    /** The name of the Slack account that has this address; null when no one has it. */
    async slackLookup(email: string): Promise<string | null> {
      try {
        return ((await (await call('/me/slack/lookup', { method: 'POST', body: { email } })).json()) as { name: string }).name;
      } catch (error) {
        if (error instanceof NotFound) return null;
        throw error;
      }
    },
    /** Sends a code to that Slack account, in the language of the User (OP-LN-08). */
    async slackCode(email: string, language: 'nl' | 'en'): Promise<{ name: string; expiresAt: string }> {
      return (await (await call('/me/slack/code', { method: 'POST', body: { email, language } })).json()) as { name: string; expiresAt: string };
    },
    /** Takes the address once the code is right: the new state, or how many tries are left, or that the code ended. */
    async slackConfirm(code: string): Promise<SlackState | { wrong: number } | 'expired'> {
      try {
        return (await (await call('/me/slack/confirm', { method: 'POST', body: { code } })).json()) as SlackState;
      } catch (error) {
        if (error instanceof Refused && error.code === 'wrong_code') return { wrong: Number((error.body as { triesLeft?: number }).triesLeft ?? 0) };
        if (error instanceof Refused && (error.code === 'expired' || error.code === 'no_code')) return 'expired';
        throw error;
      }
    },
    /** Back to the address of the Google account. */
    async slackReset(): Promise<SlackState> {
      return (await (await call('/me/slack', { method: 'DELETE' })).json()) as SlackState;
    },
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
    async editResource(id: string, changes: CardChanges): Promise<ResourceDetail> {
      return ((await (await call(resource(id), { method: 'PATCH', body: changes })).json()) as { resource: ResourceDetail }).resource;
    },
    /** Adds a Known Gap, with who added it and when (FR-RC-21). */
    async addGap(id: string, text: string, scope: GapScope | null): Promise<KnownGap> {
      return ((await (await call(`${resource(id)}/gaps`, { method: 'POST', body: { text, scope } })).json()) as { gap: KnownGap }).gap;
    },
    /** Changes the text of one Known Gap; who added it stays. */
    async changeGap(id: string, gapId: string, text: string, scope: GapScope | null): Promise<KnownGap> {
      return ((await (await call(`${resource(id)}/gaps/${encodeURIComponent(gapId)}`, { method: 'PATCH', body: { text, scope } })).json()) as { gap: KnownGap }).gap;
    },
    /** Removes one Known Gap. */
    async removeGap(id: string, gapId: string): Promise<void> {
      await call(`${resource(id)}/gaps/${encodeURIComponent(gapId)}`, { method: 'DELETE' });
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
    /** The Collections and Resources the User sees that share words with a question (FR-CO-37, DEC-UX-127). */
    async search(question: string): Promise<{ collections: FoundCollection[]; resources: FoundResource[] }> {
      return (await (await call(`/search?${new URLSearchParams({ question })}`)).json()) as { collections: FoundCollection[]; resources: FoundResource[] };
    },
    /** Every Collection the User sees, by name (FR-CO-17, FR-CO-18). */
    async collections(): Promise<Collection[]> {
      return ((await (await call('/collections')).json()) as { collections: Collection[] }).collections;
    },
    /** The Collections of an Owner Unit the User may see, for the Group opened on Groups (FR-UM-18). */
    async ownerUnitCollections(groupId: string): Promise<OwnedCollection[]> {
      return ((await (await call(`/owner-units/${encodeURIComponent(groupId)}/collections`)).json()) as { collections: OwnedCollection[] }).collections;
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
    /** Makes a folder at the top of a Collection, or in one of its folders (FR-CO-39). */
    async makeFolder(id: string, name: string, parentId: string | null): Promise<Folder> {
      return (await call(`${collection(id)}/folders`, { method: 'POST', body: { name, parentId } })).json() as Promise<Folder>;
    },
    /** Its name, its description or both (FR-CO-39, FR-CO-42). */
    async changeFolder(id: string, folderId: string, changes: { name?: string; description?: string }): Promise<Folder> {
      return (await call(`${collection(id)}/folders/${encodeURIComponent(folderId)}`, { method: 'PATCH', body: changes })).json() as Promise<Folder>;
    },
    /** Deletes an empty folder; one that holds something is refused with not_empty (FR-CO-39). */
    async deleteFolder(id: string, folderId: string): Promise<void> {
      await call(`${collection(id)}/folders/${encodeURIComponent(folderId)}`, { method: 'DELETE' });
    },
    /** Puts a Resource, Lens or folder of a Collection in one of its folders, or at its top with null (FR-CO-40). */
    async move(id: string, kind: MovableKind, itemId: string, folderId: string | null): Promise<void> {
      await call(`${collection(id)}/places/${kind}/${encodeURIComponent(itemId)}`, { method: 'PUT', body: { folderId } });
    },
    /** Takes a Resource out of its Collection: only the Data Team may (FR-CO-14). */
    async removeResource(id: string): Promise<void> {
      await call(`${resource(id)}/collection`, { method: 'DELETE' });
    },
  };
}

export type Catalogue = ReturnType<typeof createCatalogue>;

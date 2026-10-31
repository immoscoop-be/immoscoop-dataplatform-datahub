/** A field of a Resource, as the editor suggests it: with its type and both its descriptions (DEC-UX-115). */
export interface ResourceField {
  name: string;
  dataType: string | null;
  description: string;
  businessDescription: string;
}

/** A Resource as a query needs it, read from catalogue with the token of the User. */
export interface QueryResource {
  id: string;
  /** Its Key, in lower case: what knows it again, also in the SQL, whatever the case it is written in. */
  key: string;
  /** The full name of its table in its own case: what BigQuery is asked for, as its names are case-sensitive. */
  fullName: string;
  displayName: string;
  collectionId: string | null;
  level: number;
  deprecated: boolean;
  partition: { field: string; unit: string | null } | null;
  clusterBy: string[];
  /** Who requires a filter on its partition column in every query: nobody, Data Hub or BigQuery (DEC-SR-35). */
  partitionFilter: 'none' | 'dataHub' | 'bigQuery';
  fields: ResourceField[];
  /** The fields its Owner marked as its Parameters, which its Preview offers to choose by (FR-SR-38). */
  parameters: string[];
}

import type { IdTokenSource } from '@datahub/google';
import type { Lens } from './lenses.js';

/** A Request to the Data Team, on a query (MSG-QRY-01) or a Lens (MSG-LEN-01, MSG-LEN-03), as catalogue keeps it. */
export interface QueryRequest {
  id: string;
  type: 'MSG-QRY-01' | 'MSG-LEN-01' | 'MSG-LEN-03';
  subjectId: string;
  /** Who sent it; empty for Data Hub itself (MSG-LEN-03). */
  writerId: string;
  reads: number;
  text: string;
  /** It waits until the Data Team answers it in the Message Centre (DEC-SR-36). */
  state: 'waiting' | 'accepted' | 'refused';
  /** The decision of the Data Team, its reply (MSG-CNV-05). */
  decision: { outcome: 'accepted' | 'refused'; text: string; writerName: string; at: string } | null;
  createdAt: string;
}

/** A Collection the User sees, with the Resources in it they may use (FR-SR-31): who sees a Lens follows from them (DEC-CO-16). */
export interface SeenCollection {
  id: string;
  name: string;
  /** Whether the User manages it, as its Owner Unit or the Data Team (DEC-CO-15, DEC-CO-18). */
  canManage: boolean;
  visibility: 'private' | 'public';
  resources: { id: string; displayName: string; level: number }[];
}

export interface Catalogue {
  /** The Resource, if the User may see it; null when they may not, which catalogue answers as not found. */
  resource(id: string, authorization: string): Promise<QueryResource | null>;
  /** Whether the User manages the Collection, as its Owner Unit or the Data Team; null when they may not see it. */
  manages(collectionId: string, authorization: string): Promise<boolean | null>;
  /** The Requests of the User on queries or Lenses, newest first: on one, or on all; the Data Team sees everyone's on one. */
  requests(subjectId: string | null, authorization: string, subjectKind?: 'query' | 'lens'): Promise<QueryRequest[]>;
  /** Sends a Request for the User; one that still waits is given back instead. */
  sendRequest(fields: { queryId: string; name: string; reads: number; threshold: number; text: string }, authorization: string): Promise<QueryRequest>;
  /** Sends the Request to accept a very large Lens for its author (MSG-LEN-01, FR-LE-09). */
  sendLensRequest(fields: { lensId: string; name: string; reads: number; threshold: number; text: string; partitions: number | null }, authorization: string): Promise<QueryRequest>;
  /** The Collections the User sees, with the Resources in them they may use. */
  collections(authorization: string): Promise<SeenCollection[]>;
  /** Tells catalogue what decides who sees the Messages on a Lens, as query itself (DEC-PF-30). */
  keepLens(lens: Lens): Promise<void>;
  /** Sends the Request of Data Hub on a Lens that grew into very large, as query itself (MSG-LEN-03). */
  lensGrew(fields: { lensId: string; reads: number; threshold: number }): Promise<{ id: string }>;
  /** Tells the author of a Lens that grew into large, past 100 MB a run, as query itself; it keeps running (MSG-LEN-02). */
  lensGrewLarge(fields: { lensId: string; reads: number; threshold: number }): Promise<void>;
  /** Records the decision of a member of the Data Team on a Request on a Lens, as query itself (FR-LE-09). */
  decideLensRequest(requestId: string, decision: { outcome: 'accepted' | 'refused'; text: string; decider: { id: string; name: string } }): Promise<void>;
  /** Tells who made a query, or the Owner Unit of a Lens, that it became Broken, as query itself (MSG-QRY-02, MSG-LEN-05). */
  broken(subject: { kind: 'query'; id: string; name: string; ownerId: string } | { kind: 'lens'; id: string }, fields: BrokenMessage): Promise<void>;
  /** Tells them it works again, in the same Message (MSG-QRY-02, MSG-LEN-05). */
  worksAgain(subject: { kind: 'query' | 'lens'; id: string }): Promise<void>;
}

/** What a Message on a Broken query or Lens names: the day it was found and what no longer exists (FR-SR-52). */
export interface BrokenMessage {
  /** `YYYY-MM-DD`. */
  since: string;
  missing: { kind: 'resource' | 'column'; resource: string; column?: string }[];
}

/** catalogue did not tell what the User may see; query answers 503 rather than guess. */
export class CatalogueUnavailable extends Error {}

interface ResourceBody {
  resource: Omit<QueryResource, 'fullName' | 'partition' | 'clusterBy' | 'partitionFilter' | 'parameters'> & {
    /** Missing from a catalogue that does not keep it yet: then the Key. */
    fullName?: string;
    details?: { partition?: QueryResource['partition']; clusterBy?: string[]; partitionFilter?: QueryResource['partitionFilter'] };
    card?: { parameters?: string[] };
  };
}

interface RequestBody {
  request: QueryRequest;
}

/**
 * catalogue, asked with the Access Token of the User, so that it answers for them; about the Lenses
 * themselves as query, with a Google ID token for catalogue's address.
 */
export function createCatalogue(baseUrl: string, request: typeof fetch = fetch, idToken?: IdTokenSource): Catalogue {
  async function asQuery(method: 'PUT' | 'POST', path: string, body: unknown): Promise<Response> {
    if (!idToken) throw new CatalogueUnavailable('query has no identity of its own to call catalogue with');
    let response: Response;
    try {
      response = await request(new URL(path, baseUrl), {
        method,
        headers: { authorization: `Bearer ${await idToken(baseUrl)}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new CatalogueUnavailable('catalogue did not answer', { cause: error });
    }
    if (!response.ok) throw new CatalogueUnavailable(`catalogue answered ${response.status} for ${path.split('/').slice(0, 3).join('/')}`);
    return response;
  }

  async function call(path: string, authorization: string, body?: unknown): Promise<Response> {
    let response: Response;
    try {
      response = await request(new URL(path, baseUrl), {
        method: body === undefined ? 'GET' : 'POST',
        headers: { authorization, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new CatalogueUnavailable('catalogue did not answer', { cause: error });
    }
    if (!response.ok) throw new CatalogueUnavailable(`catalogue answered ${response.status} for ${path.split('?')[0]}`);
    return response;
  }
  const requestOf = ({ id, type, subjectId, writerId, reads, text, state, decision, createdAt }: QueryRequest): QueryRequest => ({
    id,
    type,
    subjectId,
    writerId,
    reads,
    text,
    state,
    decision: decision ?? null,
    createdAt,
  });

  return {
    async keepLens(lens) {
      await asQuery('PUT', `/internal/lenses/${lens.id}`, {
        name: lens.name,
        collectionId: lens.collectionId,
        resourceIds: lens.resources.map((resource) => resource.id),
        state: lens.state,
        authorId: lens.authorId,
        authorName: lens.authorName,
      });
    },

    async lensGrew({ lensId, reads, threshold }) {
      return ((await (await asQuery('POST', `/internal/lenses/${lensId}/requests`, { reads, threshold })).json()) as { request: { id: string } }).request;
    },

    async lensGrewLarge({ lensId, reads, threshold }) {
      await asQuery('POST', `/internal/lenses/${lensId}/growth`, { reads, threshold });
    },

    async decideLensRequest(requestId, decision) {
      await asQuery('POST', `/internal/messages/${requestId}/decision`, decision);
    },

    async broken(subject, fields) {
      const body = subject.kind === 'query' ? { ...fields, name: subject.name, ownerId: subject.ownerId } : fields;
      await asQuery('POST', `/internal/${subject.kind === 'query' ? 'queries' : 'lenses'}/${subject.id}/broken`, body);
    },

    async worksAgain(subject) {
      await asQuery('POST', `/internal/${subject.kind === 'query' ? 'queries' : 'lenses'}/${subject.id}/works`, {});
    },

    async requests(subjectId, authorization, subjectKind = 'query') {
      const query = new URLSearchParams({ subjectKind, ...(subjectId ? { subjectId } : {}) });
      const { requests } = (await (await call(`/requests?${query}`, authorization)).json()) as { requests: QueryRequest[] };
      return requests.map(requestOf);
    },

    async sendRequest({ queryId, name, reads, threshold, text }, authorization) {
      const body = { type: 'MSG-QRY-01', subjectId: queryId, subject: name, reads, threshold, text };
      return requestOf(((await (await call('/requests', authorization, body)).json()) as RequestBody).request);
    },

    async sendLensRequest({ lensId, name, reads, threshold, text, partitions }, authorization) {
      const body = { type: 'MSG-LEN-01', subjectId: lensId, subject: name, reads, threshold, text, ...(partitions === null ? {} : { partitions }) };
      return requestOf(((await (await call('/requests', authorization, body)).json()) as RequestBody).request);
    },

    async collections(authorization) {
      const { collections } = (await (await call('/collections', authorization)).json()) as {
        collections: (Omit<SeenCollection, 'resources'> & { resources: (SeenCollection['resources'][number] & { withdrawn?: boolean })[] })[];
      };
      return collections.map(({ id, name, canManage, visibility, resources }) => ({
        id,
        name,
        canManage: canManage === true,
        visibility,
        resources: resources.filter((resource) => resource.withdrawn !== true).map(({ id: resourceId, displayName, level }) => ({ id: resourceId, displayName, level })),
      }));
    },

    async resource(id, authorization) {
      let response: Response;
      try {
        response = await request(new URL(`/resources/${encodeURIComponent(id)}`, baseUrl), { headers: { authorization }, signal: AbortSignal.timeout(10_000) });
      } catch (error) {
        throw new CatalogueUnavailable('catalogue did not answer', { cause: error });
      }
      if (response.status === 404 || response.status === 400) return null;
      if (!response.ok) throw new CatalogueUnavailable(`catalogue answered ${response.status} for a Resource`);
      const { resource } = (await response.json()) as ResourceBody;
      return {
        id: resource.id,
        key: resource.key,
        fullName: resource.fullName ?? resource.key,
        displayName: resource.displayName,
        collectionId: resource.collectionId,
        level: resource.level,
        deprecated: resource.deprecated,
        partition: resource.details?.partition ?? null,
        clusterBy: resource.details?.clusterBy ?? [],
        partitionFilter: resource.details?.partition ? (resource.details.partitionFilter ?? 'none') : 'none',
        fields: resource.fields.map(({ name, dataType, description, businessDescription }) => ({ name, dataType, description, businessDescription })),
        parameters: resource.card?.parameters ?? [],
      };
    },

    async manages(collectionId, authorization) {
      let response: Response;
      try {
        response = await request(new URL(`/collections/${encodeURIComponent(collectionId)}`, baseUrl), { headers: { authorization }, signal: AbortSignal.timeout(10_000) });
      } catch (error) {
        throw new CatalogueUnavailable('catalogue did not answer', { cause: error });
      }
      if (response.status === 404 || response.status === 400) return null;
      if (!response.ok) throw new CatalogueUnavailable(`catalogue answered ${response.status} for a Collection`);
      return ((await response.json()) as { canManage?: boolean }).canManage === true;
    },
  };
}

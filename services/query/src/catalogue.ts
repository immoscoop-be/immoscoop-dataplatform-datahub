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
  key: string;
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

/** A Request to the Data Team to run a query above 1 GB (MSG-QRY-01), as catalogue keeps it. */
export interface QueryRequest {
  id: string;
  subjectId: string;
  writerId: string;
  reads: number;
  text: string;
  /** It waits until the Data Team answers it in the Message Centre (DEC-SR-36). */
  state: 'waiting' | 'accepted' | 'refused';
  createdAt: string;
}

export interface Catalogue {
  /** The Resource, if the User may see it; null when they may not, which catalogue answers as not found. */
  resource(id: string, authorization: string): Promise<QueryResource | null>;
  /** Whether the User manages the Collection, as its Owner Unit or the Data Team; null when they may not see it. */
  manages(collectionId: string, authorization: string): Promise<boolean | null>;
  /** The Requests of the User on queries, newest first: on one, or on all; the Data Team sees everyone's on one. */
  requests(queryId: string | null, authorization: string): Promise<QueryRequest[]>;
  /** Sends a Request for the User; one that still waits is given back instead. */
  sendRequest(fields: { queryId: string; name: string; reads: number; threshold: number; text: string }, authorization: string): Promise<QueryRequest>;
}

/** catalogue did not tell what the User may see; query answers 503 rather than guess. */
export class CatalogueUnavailable extends Error {}

interface ResourceBody {
  resource: Omit<QueryResource, 'partition' | 'clusterBy' | 'partitionFilter' | 'parameters'> & {
    details?: { partition?: QueryResource['partition']; clusterBy?: string[]; partitionFilter?: QueryResource['partitionFilter'] };
    card?: { parameters?: string[] };
  };
}

interface RequestBody {
  request: QueryRequest;
}

/** catalogue, asked with the Access Token of the User, so that it answers for them. */
export function createCatalogue(baseUrl: string, request: typeof fetch = fetch): Catalogue {
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
  const requestOf = ({ id, subjectId, writerId, reads, text, state, createdAt }: QueryRequest): QueryRequest => ({ id, subjectId, writerId, reads, text, state, createdAt });

  return {
    async requests(queryId, authorization) {
      const query = new URLSearchParams({ subjectKind: 'query', ...(queryId ? { subjectId: queryId } : {}) });
      const { requests } = (await (await call(`/requests?${query}`, authorization)).json()) as { requests: QueryRequest[] };
      return requests.map(requestOf);
    },

    async sendRequest({ queryId, name, reads, threshold, text }, authorization) {
      const body = { type: 'MSG-QRY-01', subjectId: queryId, subject: name, reads, threshold, text };
      return requestOf(((await (await call('/requests', authorization, body)).json()) as RequestBody).request);
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

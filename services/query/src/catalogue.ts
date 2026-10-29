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
}

export interface Catalogue {
  /** The Resource, if the User may see it; null when they may not, which catalogue answers as not found. */
  resource(id: string, authorization: string): Promise<QueryResource | null>;
}

/** catalogue did not tell what the User may see; query answers 503 rather than guess. */
export class CatalogueUnavailable extends Error {}

interface ResourceBody {
  resource: Omit<QueryResource, 'partition' | 'clusterBy' | 'partitionFilter'> & {
    details?: { partition?: QueryResource['partition']; clusterBy?: string[]; partitionFilter?: QueryResource['partitionFilter'] };
  };
}

/** catalogue's `GET /resources/{id}`, asked with the Access Token of the User, so that it answers for them. */
export function createCatalogue(baseUrl: string, request: typeof fetch = fetch): Catalogue {
  return {
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
      };
    },
  };
}

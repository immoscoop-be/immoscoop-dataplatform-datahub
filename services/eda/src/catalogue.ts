import type { EdaField, EdaResource } from '@datahub/contracts/eda';
import type { ModelType, TypeRole } from '@datahub/contracts/model-types';
import type { IdTokenSource } from '@datahub/google';

/** Who requires a filter on the partition column of a table in every query: nobody, Data Hub or BigQuery (DEC-SR-35). */
export type PartitionFilter = 'none' | 'dataHub' | 'bigQuery';

/**
 * A Resource as eda works on it, read from catalogue with the token of the User (TR-ED-01): the Resource as the EDA
 * sees it, and what the SQL of its EDA-Probes needs, its table by its full name and its partitions (TR-ED-03).
 */
export interface EdaSource {
  resource: EdaResource;
  collectionId: string | null;
  /** The full name of its table in its own case, `project.dataset.table`, as BigQuery knows it. */
  fullName: string;
  partition: { field: string; unit: string | null } | null;
  partitionFilter: PartitionFilter;
  /** Whether catalogue keeps that its EDA is Explored (TR-ED-05); null from a catalogue that does not say yet. */
  explored: boolean | null;
}

/** A Resource in a Collection the User sees, as the panel of the section EDA lists it (FR-ED-03). */
export interface SeenResource {
  id: string;
  displayName: string;
  level: number;
  collection: { id: string; name: string };
}

export interface Catalogue {
  /** The Resource, if the User may see it; null when they may not, which catalogue answers as not found. */
  resource(id: string, authorization: string): Promise<EdaSource | null>;
  /** The name of a Collection the User sees; null when they may not see it. */
  collectionName(id: string, authorization: string): Promise<string | null>;
  /** The Resources the User sees in the Collections they see, in the order of catalogue; withdrawn ones left out. */
  seen(authorization: string): Promise<SeenResource[]>;
  /** Tells catalogue, as eda itself, that the EDA of a Resource is Explored (TR-ED-05). */
  explored(resourceId: string): Promise<void>;
}

/** catalogue did not tell what the User may see, or did not take what eda told it; eda answers 503 rather than guess. */
export class CatalogueUnavailable extends Error {}

/** A Resource as `GET /resources/{id}` of catalogue answers it: only what eda reads of it. */
export interface CatalogueResource {
  id: string;
  key: string;
  /** Missing from a catalogue that does not keep it yet: then the Key. */
  fullName?: string;
  displayName: string;
  collectionId: string | null;
  level: number;
  /** Whether catalogue keeps that its EDA is Explored (TR-ED-05). */
  explored?: boolean;
  /** In the order of the Resource Card. */
  fields: { name: string; dataType: string | null }[];
  /** Empty until it is added to a Collection with them. */
  details?: {
    partition?: { field: string; unit: string | null } | null;
    partitionFilter?: PartitionFilter;
    grain?: string[];
    modelType?: ModelType | null;
    typeFields?: { field: string; role: TypeRole }[];
    mappings?: { field: string }[];
  };
  card?: { keyFields?: string[] };
}

/**
 * The Resource as the EDA sees it (TR-ED-01): its fields in the order of its Resource Card (DEC-UX-323), each with its
 * type, whether it is a Key Field, the role it holds for the model type, whether it is in the grain and whether it is
 * mapped to an Entity; with its table and partitions for the SQL.
 */
export function sourceOf(resource: CatalogueResource): EdaSource {
  const details = resource.details ?? {};
  const keyFields = new Set(resource.card?.keyFields ?? []);
  const grain = new Set(details.grain ?? []);
  const mapped = new Set((details.mappings ?? []).map((mapping) => mapping.field));
  const roles = new Map((details.typeFields ?? []).map((typeField) => [typeField.field, typeField.role]));
  const fields = resource.fields.map(
    (field): EdaField => ({
      name: field.name,
      dataType: field.dataType,
      keyField: keyFields.has(field.name),
      role: roles.get(field.name) ?? null,
      grain: grain.has(field.name),
      mapped: mapped.has(field.name),
    }),
  );
  const partition = details.partition ?? null;
  return {
    resource: { id: resource.id, displayName: resource.displayName, modelType: details.modelType ?? null, level: resource.level, fields },
    collectionId: resource.collectionId,
    fullName: resource.fullName ?? resource.key,
    partition,
    partitionFilter: partition ? (details.partitionFilter ?? 'none') : 'none',
    explored: typeof resource.explored === 'boolean' ? resource.explored : null,
  };
}

/**
 * catalogue, asked with the Access Token of the User, so that it answers for them; told that an EDA is Explored as
 * eda itself, with a Google ID token for catalogue's address (TR-ED-05).
 */
export function createCatalogue(baseUrl: string, request: typeof fetch = fetch, idToken?: IdTokenSource): Catalogue {
  /** A GET as the User: null for what they may not see (404, or 400 for an ID that is none). */
  async function read<T>(path: string, authorization: string, what: string): Promise<T | null> {
    let response: Response;
    try {
      response = await request(new URL(path, baseUrl), { headers: { authorization }, signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      throw new CatalogueUnavailable('catalogue did not answer', { cause: error });
    }
    if (response.status === 404 || response.status === 400) return null;
    if (!response.ok) throw new CatalogueUnavailable(`catalogue answered ${response.status} for ${what}`);
    return (await response.json()) as T;
  }

  return {
    async resource(id, authorization) {
      const body = await read<{ resource: CatalogueResource }>(`/resources/${encodeURIComponent(id)}`, authorization, 'a Resource');
      return body ? sourceOf(body.resource) : null;
    },

    async collectionName(id, authorization) {
      return (await read<{ name: string }>(`/collections/${encodeURIComponent(id)}`, authorization, 'a Collection'))?.name ?? null;
    },

    async seen(authorization) {
      const body = await read<{ collections: { id: string; name: string; resources: { id: string; displayName: string; level: number; withdrawn?: boolean }[] }[] }>(
        '/collections',
        authorization,
        'the Collections',
      );
      if (!body) throw new CatalogueUnavailable('catalogue did not list the Collections');
      return body.collections.flatMap((collection) =>
        collection.resources
          .filter((resource) => resource.withdrawn !== true)
          .map(({ id, displayName, level }) => ({ id, displayName, level, collection: { id: collection.id, name: collection.name } })),
      );
    },

    async explored(resourceId) {
      if (!idToken) throw new CatalogueUnavailable('eda has no identity of its own to call catalogue with');
      let response: Response;
      try {
        response = await request(new URL(`/internal/resources/${encodeURIComponent(resourceId)}/eda`, baseUrl), {
          method: 'POST',
          headers: { authorization: `Bearer ${await idToken(baseUrl)}`, 'content-type': 'application/json' },
          body: JSON.stringify({ explored: true }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (error) {
        throw new CatalogueUnavailable('catalogue did not answer', { cause: error });
      }
      if (!response.ok) throw new CatalogueUnavailable(`catalogue answered ${response.status} for an EDA that is Explored`);
    },
  };
}

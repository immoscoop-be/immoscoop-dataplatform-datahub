/** A table Data Hub knows from a dbt project it follows, as registry names it for a power user's query (FR-SR-56). */
export interface KnownTable {
  /** `database.schema.table` in lowercase, as the Key of a Resource is (DEC-SR-04). */
  key: string;
  /** The same in its own case, as BigQuery knows it: BigQuery names are case-sensitive. */
  fullName: string;
  name: string;
  resourceType: string;
  layer: string;
  projectId: string;
  projectName: string | null;
  /** An exposure with the tag `datahub` depends on it: it is a Resource, read as one (DEC-SR-46). */
  resource: boolean;
  partition: { field: string; unit: string | null } | null;
}

/** registry did not answer: the query cannot be checked now, never guessed. */
export class RegistryUnavailable extends Error {}

export interface Registry {
  /** Which of these tables Data Hub knows, asked with the Access Token of the User, who needs `queries.outside`. */
  knownTables(relations: readonly string[], authorization: string): Promise<KnownTable[]>;
}

/** registry, asked with the Access Token of the User, so that it answers for them (DEC-SR-46). */
export function createRegistry(baseUrl: string, request: typeof fetch = fetch): Registry {
  return {
    async knownTables(relations, authorization) {
      if (relations.length === 0) return [];
      const url = new URL('/known-tables', baseUrl);
      url.searchParams.set('relations', relations.join(','));
      let response: Response;
      try {
        response = await request(url, { headers: { authorization }, signal: AbortSignal.timeout(10_000) });
      } catch (error) {
        throw new RegistryUnavailable('registry did not answer', { cause: error });
      }
      // Without the Permission, or with a name registry does not take, no table is known.
      if (response.status === 403 || response.status === 400) return [];
      if (!response.ok) throw new RegistryUnavailable(`registry answered ${response.status} for the known tables`);
      return ((await response.json()) as { tables: KnownTable[] }).tables;
    },
  };
}

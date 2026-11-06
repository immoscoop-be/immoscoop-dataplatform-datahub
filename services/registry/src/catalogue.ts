import type { IdTokenSource } from '@datahub/google';
import type { UpstreamChange } from './changes.js';
import type { ExposedTable } from './exposed.js';

/** What registry tells catalogue about one dbt project after a new Current Version (TR-AR-08). */
export interface ResourcesUpdate {
  projectId: string;
  projectName: string | null;
  runId: string;
  /** When dbt made the manifest of the run, as ISO 8601; the day a new Resource came in (MSG-RES-01). */
  generatedAt: string | null;
  /** Every exposed table of the project: the whole state, so a lost call is repaired by the next. */
  tables: ExposedTable[];
  /** What changed since the previous Current Version, with the Resources it reaches downstream (FR-AR-12). */
  changes: UpstreamChange[];
}

/** What catalogue did with the exposed tables of one run, as its delivery on Webhooks shows it (FR-AR-19). */
export interface CatalogueOutcome {
  /** False when catalogue had already applied a later run of the project, and left this one. */
  applied: boolean;
  registered: number;
  /** The Resources it registered, which wait without a Collection: the way to them. */
  registeredIds: string[];
  renamed: number;
  withdrawn: number;
  back: number;
}

/** What an Artifact Set keeps of telling catalogue: what catalogue did, or why it was not told. */
export type CatalogueAnswer = CatalogueOutcome | { error: string };

export interface Catalogue {
  resources(update: ResourcesUpdate): Promise<CatalogueOutcome>;
}

/** The answer of catalogue, read safely: a catalogue that does not send the IDs yet sends none. */
export function readOutcome(body: unknown): CatalogueOutcome {
  const answer = (body !== null && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const count = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0);
  return {
    applied: answer.applied !== false,
    registered: count(answer.registered),
    registeredIds: Array.isArray(answer.registeredIds) ? answer.registeredIds.filter((id): id is string => typeof id === 'string') : [],
    renamed: count(answer.renamed),
    withdrawn: count(answer.withdrawn),
    back: count(answer.back),
  };
}

/** Calls catalogue as the service account of registry, with a Google ID token for its address (DEC-PF-26). */
export function createCatalogue(url: string, idToken: IdTokenSource, request: typeof fetch = fetch): Catalogue {
  return {
    async resources(update) {
      const response = await request(new URL('/internal/resources', url), {
        method: 'POST',
        headers: { authorization: `Bearer ${await idToken(url)}`, 'content-type': 'application/json' },
        body: JSON.stringify(update),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(`catalogue answered ${response.status}${body.message ? `: ${body.message}` : ''}`);
      }
      return readOutcome(await response.json().catch(() => ({})));
    },
  };
}

import type { IdTokenSource } from '@datahub/google';
import type { ExposedTable } from './exposed.js';

/** What registry tells catalogue about one dbt project after a new Current Version (TR-AR-08). */
export interface ResourcesUpdate {
  projectId: string;
  projectName: string | null;
  runId: string;
  /** Every exposed table of the project: the whole state, so a lost call is repaired by the next. */
  tables: ExposedTable[];
}

export interface Catalogue {
  resources(update: ResourcesUpdate): Promise<void>;
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
    },
  };
}

import type { IdTokenSource } from '@datahub/google';

/** query, asked as catalogue with a Google ID token for its address. */
export interface QueryService {
  /**
   * Has query dry-run every Lens and query that reads one of these Resources, after a new Current Version
   * withdrew them, brought them back, or removed, renamed or brought back a field (FR-SR-52, the first moment).
   */
  check(resourceIds: readonly string[]): Promise<void>;
}

/** query did not answer as it should; its daily check finds the same within a day. */
export class QueryUnavailable extends Error {}

/** How long catalogue waits for query, so that registry, which waits for catalogue, is not kept too long. */
const WAIT = 20_000;

export function createQueryService(url: string, idToken: IdTokenSource, request: typeof fetch = fetch): QueryService {
  return {
    async check(resourceIds) {
      if (resourceIds.length === 0) return;
      let response: Response;
      try {
        response = await request(new URL('/internal/checks', url), {
          method: 'POST',
          headers: { authorization: `Bearer ${await idToken(url)}`, 'content-type': 'application/json' },
          body: JSON.stringify({ resources: resourceIds }),
          signal: AbortSignal.timeout(WAIT),
        });
      } catch (error) {
        throw new QueryUnavailable('query did not answer', { cause: error });
      }
      if (!response.ok) throw new QueryUnavailable(`query answered ${response.status}`);
    },
  };
}

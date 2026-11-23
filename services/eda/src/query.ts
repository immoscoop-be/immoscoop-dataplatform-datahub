import type { ProbeRunAnswer, ProbeRunRequest } from '@datahub/contracts/eda';

/** query, which runs the SQL of an EDA-Probe as the User (TR-ED-04): eda reads no data itself (DEC-ED-26). */
export interface Query {
  /** Runs the SQL of an EDA-Probe on the table of a Resource, with the Access Token of the User who runs it. */
  run(resourceId: string, run: ProbeRunRequest, authorization: string): Promise<ProbeRunAnswer>;
}

/** query did not answer, or answered with an error of its own; eda answers 503. */
export class QueryUnavailable extends Error {}

/** query refused the run for the User: they may not see the Resource (404) or may not explore (403). */
export class QueryRefused extends Error {
  constructor(
    readonly status: 403 | 404,
    message: string,
  ) {
    super(message);
  }
}

/** query at its address (DATAHUB_QUERY_URL), asked with the Access Token of the User (TR-ED-04). */
export function createQuery(baseUrl: string, request: typeof fetch = fetch): Query {
  return {
    async run(resourceId, run, authorization) {
      let response: Response;
      try {
        response = await request(new URL(`/resources/${encodeURIComponent(resourceId)}/eda/runs`, baseUrl), {
          method: 'POST',
          headers: { authorization, 'content-type': 'application/json' },
          body: JSON.stringify(run),
          // A run waits for BigQuery: up to a few minutes for a large table.
          signal: AbortSignal.timeout(300_000),
        });
      } catch (error) {
        throw new QueryUnavailable('query did not answer', { cause: error });
      }
      if (response.status === 403 || response.status === 404) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new QueryRefused(response.status, body.message ?? (response.status === 404 ? 'There is no such Resource, or you may not see it.' : 'You may not run this.'));
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new QueryUnavailable(`query answered ${response.status} for an EDA-Probe${body.message ? `: ${body.message}` : ''}`);
      }
      return (await response.json()) as ProbeRunAnswer;
    },
  };
}

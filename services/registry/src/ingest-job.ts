import { type AccessTokenSource, CLOUD_PLATFORM, googleApiError } from '@datahub/google';

/**
 * Starts a run of the ingest job, `projects/<project>/locations/<region>/jobs/<name>`
 * (DATAHUB_INGEST_JOB), without waiting for it (TR-AR-01, DEC-PF-20).
 */
export function createIngestStarter(job: string, token: AccessTokenSource, request: typeof fetch = fetch): () => Promise<void> {
  return async () => {
    const response = await request(`https://run.googleapis.com/v2/${job}:run`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await token([CLOUD_PLATFORM])}`, 'content-type': 'application/json' },
      body: '{}',
    });
    if (!response.ok) {
      throw await googleApiError(`The job ${job} could not be started`, response);
    }
  };
}

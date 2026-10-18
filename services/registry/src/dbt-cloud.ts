/** The Artifacts of a run, from the dbt Cloud Admin API (TR-AR-02). */
export interface DbtCloud {
  /**
   * The file as dbt Cloud serves it, or undefined when the run has no such file. With `wait`, a
   * missing file is asked for again a few times: dbt Cloud may publish the files a moment after
   * it reports the run.
   */
  artifact(runId: string, file: string, options?: { wait?: boolean }): Promise<Uint8Array | undefined>;
}

export interface DbtCloudOptions {
  /** The access URL of the account, such as https://emea.dbt.com (DATAHUB_DBT_CLOUD_URL). */
  url: string;
  accountId: string;
  /** The service token, read from Secret Manager when first needed. */
  token: () => Promise<string>;
  request?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

/** The pauses before asking again for a file that is not there yet: about a minute and a half in all. */
const PAUSES_MS = [5_000, 10_000, 20_000, 40_000];

export function createDbtCloud(options: DbtCloudOptions): DbtCloud {
  const request = options.request ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  return {
    async artifact(runId, file, { wait = false } = {}) {
      const url = `${options.url.replace(/\/$/, '')}/api/v2/accounts/${options.accountId}/runs/${runId}/artifacts/${file}`;
      const pauses = wait ? [...PAUSES_MS] : [];
      for (;;) {
        const response = await request(url, { headers: { authorization: `Token ${await options.token()}` } });
        if (response.ok) {
          return new Uint8Array(await response.arrayBuffer());
        }
        if (response.status !== 404) {
          throw new Error(`dbt Cloud did not give ${file} of run ${runId}: ${response.status} ${(await response.text()).slice(0, 200)}`);
        }
        const pause = pauses.shift();
        if (pause === undefined) {
          return undefined;
        }
        await sleep(pause);
      }
    },
  };
}

/** What a job of dbt Cloud does: build after a merge, build pull requests, build on a schedule, or else. */
export type JobKind = 'merge' | 'ci' | 'scheduled' | 'other';

/** A job of a dbt project in dbt Cloud, as the page Webhooks offers it to be a Source Job (FR-AR-18). */
export interface DbtJob {
  id: string;
  name: string;
  projectId: string;
  environmentId: string | null;
  /** The name of its environment in dbt Cloud, such as UAT or Production; null when dbt Cloud did not tell it. */
  environmentName: string | null;
  kind: JobKind;
  /** It runs `dbt docs generate`, so its runs have a catalog (EC-AR-02). */
  generatesDocs: boolean;
  /** Its last run, when dbt Cloud tells it. */
  lastRun: { at: string | null; status: string | null } | null;
}

/** The Artifacts of a run, from the dbt Cloud Admin API (TR-AR-02). */
export interface DbtCloud {
  /**
   * The file as dbt Cloud serves it, or undefined when the run has no such file. With `wait`, a
   * missing file is asked for again a few times: dbt Cloud may publish the files a moment after
   * it reports the run.
   */
  artifact(runId: string, file: string, options?: { wait?: boolean }): Promise<Uint8Array | undefined>;
  /** Which job and project a run belongs to and whether it succeeded, or undefined for an unknown run. */
  run(runId: string): Promise<{ jobId: string; projectId: string; success: boolean } | undefined>;
  /** The jobs of a dbt project, with the name of their environment (FR-AR-18). */
  jobs(projectId: string): Promise<DbtJob[]>;
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

  const base = options.url.replace(/\/$/, '');
  const runs = `${base}/api/v2/accounts/${options.accountId}/runs`;

  async function read<T>(url: string, what: string): Promise<T> {
    const response = await request(url, { headers: { authorization: `Token ${await options.token()}`, accept: 'application/json' } });
    if (!response.ok) {
      throw new Error(`dbt Cloud did not give ${what}: ${response.status} ${(await response.text()).slice(0, 200)}`);
    }
    return (await response.json()) as T;
  }

  return {
    async artifact(runId, file, { wait = false } = {}) {
      const url = `${runs}/${runId}/artifacts/${file}`;
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

    async run(runId) {
      const response = await request(`${runs}/${runId}/`, { headers: { authorization: `Token ${await options.token()}` } });
      if (response.status === 404) {
        return undefined;
      }
      if (!response.ok) {
        throw new Error(`dbt Cloud did not describe run ${runId}: ${response.status} ${(await response.text()).slice(0, 200)}`);
      }
      const { data } = (await response.json()) as { data?: { job_definition_id?: number; project_id?: number; status?: number } };
      // Status 10 is a successful run in the dbt Cloud API.
      return data ? { jobId: String(data.job_definition_id), projectId: String(data.project_id), success: data.status === 10 } : undefined;
    },

    async jobs(projectId) {
      const query = new URLSearchParams({ project_id: projectId, include_related: '["most_recent_run"]', limit: '100' });
      const { data } = await read<{ data?: RawJob[] }>(`${base}/api/v2/accounts/${options.accountId}/jobs/?${query}`, `the jobs of project ${projectId}`);
      // The names of the environments come from the API v3; without them, the jobs still show by name and ID.
      let environments = new Map<string, string>();
      try {
        const answer = await read<{ data?: { id: number; name: string }[] }>(
          `${base}/api/v3/accounts/${options.accountId}/projects/${projectId}/environments/`,
          `the environments of project ${projectId}`,
        );
        environments = new Map((answer.data ?? []).map((environment) => [String(environment.id), environment.name]));
      } catch {
        // Left without names.
      }
      return (data ?? [])
        .filter((job) => String(job.project_id) === projectId && job.state !== 2)
        .map((job) => {
          const environmentId = job.environment_id === undefined || job.environment_id === null ? null : String(job.environment_id);
          return {
            id: String(job.id),
            name: job.name ?? `Job ${job.id}`,
            projectId,
            environmentId,
            environmentName: environmentId ? (environments.get(environmentId) ?? null) : null,
            kind: kindOf(job),
            generatesDocs: job.generate_docs === true,
            lastRun: job.most_recent_run ? { at: job.most_recent_run.finished_at ?? job.most_recent_run.created_at ?? null, status: job.most_recent_run.status_humanized ?? null } : null,
          };
        });
    },
  };
}

/** A job as the dbt Cloud API v2 gives it, as far as Data Hub reads it. */
interface RawJob {
  id: number;
  name?: string;
  project_id: number;
  environment_id?: number | null;
  /** 2 is a deleted job. */
  state?: number;
  job_type?: string | null;
  generate_docs?: boolean;
  triggers?: { github_webhook?: boolean; git_provider_webhook?: boolean; schedule?: boolean; on_merge?: boolean };
  most_recent_run?: { finished_at?: string | null; created_at?: string | null; status_humanized?: string | null } | null;
}

/** What a job does, from its type, or else from what triggers it. */
export function kindOf(job: Pick<RawJob, 'job_type' | 'triggers'>): JobKind {
  const type = job.job_type?.toLowerCase();
  if (type === 'merge' || job.triggers?.on_merge) return 'merge';
  if (type === 'ci' || job.triggers?.github_webhook || job.triggers?.git_provider_webhook) return 'ci';
  if (type === 'scheduled' || job.triggers?.schedule) return 'scheduled';
  return 'other';
}

/** The settings of registry and its ingest job, from the environment Terraform gives them. */
export interface RegistrySettings {
  /** The access URL of the dbt Cloud account (DATAHUB_DBT_CLOUD_URL). */
  dbtCloudUrl: string;
  /** The dbt Cloud account (DATAHUB_DBT_ACCOUNT_ID). */
  accountId: string;
  /**
   * The Source Jobs of this environment, job ID → dbt project ID (DEC-AR-01), from
   * DATAHUB_DBT_SOURCE_JOBS as `<project>:<job>`, comma-separated.
   */
  sourceJobs: Map<string, string>;
  /** The secret version of the dbt Cloud service token (DATAHUB_DBT_CLOUD_TOKEN). */
  dbtCloudToken: string;
  /** The secret version dbt Cloud signs its webhook with (DATAHUB_DBT_WEBHOOK_SECRET). */
  webhookSecret: string;
  /** The artifact bucket (DATAHUB_ARTIFACT_BUCKET). */
  bucket: string;
  /** The ingest job, `projects/<project>/locations/<region>/jobs/<name>` (DATAHUB_INGEST_JOB). */
  ingestJob: string;
}

export function settingsFromEnv(env: NodeJS.ProcessEnv = process.env): RegistrySettings {
  return {
    dbtCloudUrl: required(env, 'DATAHUB_DBT_CLOUD_URL'),
    accountId: required(env, 'DATAHUB_DBT_ACCOUNT_ID'),
    sourceJobs: sourceJobs(required(env, 'DATAHUB_DBT_SOURCE_JOBS')),
    dbtCloudToken: required(env, 'DATAHUB_DBT_CLOUD_TOKEN'),
    webhookSecret: required(env, 'DATAHUB_DBT_WEBHOOK_SECRET'),
    bucket: required(env, 'DATAHUB_ARTIFACT_BUCKET'),
    ingestJob: required(env, 'DATAHUB_INGEST_JOB'),
  };
}

function sourceJobs(value: string): Map<string, string> {
  const jobs = new Map<string, string>();
  for (const pair of value.split(',').filter(Boolean)) {
    const [project, job] = pair.split(':');
    if (!project || !job || !/^\d+$/.test(project) || !/^\d+$/.test(job)) {
      throw new Error(`DATAHUB_DBT_SOURCE_JOBS holds "${pair}"; expected <project>:<job>`);
    }
    jobs.set(job, project);
  }
  return jobs;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

/**
 * A secret read when first needed, then kept; a failed read is tried again next time, so a secret
 * that gets its value after the deploy works without a restart (TR-PF-23).
 */
export function lazy(read: () => Promise<string>): () => Promise<string> {
  let value: Promise<string> | undefined;
  return () => {
    value ??= read().catch((error: unknown) => {
      value = undefined;
      throw error;
    });
    return value;
  };
}

/**
 * The settings of registry and its ingest job, from the environment Terraform gives them. The dbt projects
 * Data Hub follows and their Source Jobs are no setting: a Data Admin sets them on the page Webhooks (DEC-AR-10).
 */
export interface RegistrySettings {
  /** The access URL of the dbt Cloud account (DATAHUB_DBT_CLOUD_URL). */
  dbtCloudUrl: string;
  /** The dbt Cloud account (DATAHUB_DBT_ACCOUNT_ID). */
  accountId: string;
  /** The secret version of the dbt Cloud service token (DATAHUB_DBT_CLOUD_TOKEN). */
  dbtCloudToken: string;
  /** The secret version dbt Cloud signs its webhook with (DATAHUB_DBT_WEBHOOK_SECRET). */
  webhookSecret: string;
  /** The artifact bucket (DATAHUB_ARTIFACT_BUCKET). */
  bucket: string;
  /** The ingest job, `projects/<project>/locations/<region>/jobs/<name>` (DATAHUB_INGEST_JOB). */
  ingestJob: string;
  /** catalogue's address, which the ingest job tells the exposed tables (DATAHUB_CATALOGUE_URL, TR-AR-08). */
  catalogueUrl: string;
}

export function settingsFromEnv(env: NodeJS.ProcessEnv = process.env): RegistrySettings {
  return {
    dbtCloudUrl: required(env, 'DATAHUB_DBT_CLOUD_URL'),
    accountId: required(env, 'DATAHUB_DBT_ACCOUNT_ID'),
    dbtCloudToken: required(env, 'DATAHUB_DBT_CLOUD_TOKEN'),
    webhookSecret: required(env, 'DATAHUB_DBT_WEBHOOK_SECRET'),
    bucket: required(env, 'DATAHUB_ARTIFACT_BUCKET'),
    ingestJob: required(env, 'DATAHUB_INGEST_JOB'),
    catalogueUrl: required(env, 'DATAHUB_CATALOGUE_URL'),
  };
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

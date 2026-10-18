import type { Migration } from 'kysely/migration';
import { connectCloudSql, type CloudSqlOptions } from './connect.js';
import { migrate } from './migrate.js';

/**
 * The connection of a service, from the environment Terraform gives it: DATAHUB_DB_INSTANCE,
 * DATAHUB_DB_NAME and DATAHUB_DB_USER.
 */
export function cloudSqlOptionsFromEnv(schema: string, env: NodeJS.ProcessEnv = process.env): CloudSqlOptions {
  return {
    instance: required(env, 'DATAHUB_DB_INSTANCE'),
    database: required(env, 'DATAHUB_DB_NAME'),
    user: required(env, 'DATAHUB_DB_USER'),
    schema,
  };
}

/**
 * What the migration job of a service runs (TR-PF-09): it logs in as `datahub-migrator`
 * (DATAHUB_DB_USER) and gives the service's login (DATAHUB_DB_SERVICE_USER) its access.
 */
export async function migrateFromEnv(
  schema: string,
  migrations: Record<string, Migration>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const serviceUser = required(env, 'DATAHUB_DB_SERVICE_USER');
  const database = await connectCloudSql<unknown>(cloudSqlOptionsFromEnv(schema, env));
  try {
    const results = await migrate({ db: database.db, schema, migrations, serviceUser });
    const ran = results.map((result) => result.migrationName);
    log('INFO', ran.length ? `Ran ${ran.join(', ')} on ${schema}` : `${schema} is up to date`);
  } catch (error) {
    log('ERROR', error instanceof Error ? `${error.message}: ${String(error.cause)}` : String(error));
    throw error;
  } finally {
    await database.close();
  }
}

/** One line of structured log, as Cloud Logging reads it. */
function log(severity: 'INFO' | 'ERROR', message: string): void {
  console.log(JSON.stringify({ severity, message }));
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

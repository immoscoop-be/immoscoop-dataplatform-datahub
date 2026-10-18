import { AuthTypes, Connector, IpAddressTypes } from '@google-cloud/cloud-sql-connector';
import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

export interface CloudSqlOptions {
  /** The connection name of the instance, `project:region:instance` (DATAHUB_DB_INSTANCE). */
  instance: string;
  /** The database (DATAHUB_DB_NAME). */
  database: string;
  /** The database login: the service account's email without `.gserviceaccount.com` (DATAHUB_DB_USER). */
  user: string;
  /** The schema every query runs in: the service's own (TR-PF-08). */
  schema: string;
  /** The most connections one instance opens. */
  maxConnections?: number;
}

export interface Database<T> {
  db: Kysely<T>;
  /** Closes the connections. */
  close(): Promise<void>;
}

/**
 * Connects to Cloud SQL as the service account the code runs as, through the Cloud SQL connector:
 * encrypted, checked by IAM, and without a password (TR-PF-22).
 */
export async function connectCloudSql<T>(options: CloudSqlOptions): Promise<Database<T>> {
  const connector = new Connector();
  const connection = await connector.getOptions({
    instanceConnectionName: options.instance,
    authType: AuthTypes.IAM,
    ipType: IpAddressTypes.PUBLIC,
  });
  const database = createDatabase<T>(
    { ...connection, user: options.user, database: options.database, max: options.maxConnections ?? 5 },
    options.schema,
  );
  return {
    db: database.db,
    async close() {
      await database.close();
      connector.close();
    },
  };
}

/**
 * Opens a connection pool in which every query runs in `schema`, with snake_case columns in
 * Postgres and camelCase in TypeScript; keys inside JSON columns stay as stored. Tests pass the
 * address of a local Postgres.
 */
export function createDatabase<T>(config: pg.PoolConfig, schema: string): Database<T> {
  const pool = new pg.Pool({ ...config, options: `-c search_path=${schemaName(schema)}` });
  const db = new Kysely<T>({
    dialect: new PostgresDialect({ pool }),
    plugins: [new CamelCasePlugin({ maintainNestedObjectKeys: true })],
  });
  return { db, close: () => db.destroy() };
}

/** A schema is named after its service: lowercase letters, digits and underscores only. */
export function schemaName(schema: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(schema)) {
    throw new Error(`"${schema}" is not a valid schema name`);
  }
  return schema;
}

/** Quotes a Postgres identifier, such as a login with `@` in it. */
export function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

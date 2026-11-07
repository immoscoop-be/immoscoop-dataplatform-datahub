import { type DatabaseIntrospector, type Kysely, sql } from 'kysely';
import { type Migration, type MigrationResult, Migrator } from 'kysely/migration';
import { quoteIdentifier, schemaName } from './connect.js';

const MIGRATION_TABLE = 'kysely_migration';
const MIGRATION_LOCK_TABLE = 'kysely_migration_lock';

export interface MigrateOptions {
  /** A connection as the migration identity, `datahub-migrator`, which owns the schema and its tables. */
  db: Kysely<unknown>;
  /** The schema of the service; created when it does not exist yet. */
  schema: string;
  /** The migrations of the service, by name; they run in the order of their names. */
  migrations: Record<string, Migration>;
  /** The database login of the service: it may read and write the rows, not change the tables. */
  serviceUser: string;
  /**
   * The database roles that may read the rows, and nothing more: the Role Group of the Data Team,
   * in Cloud SQL Studio (TR-PF-28). Left out for a schema no person may read, such as identity's.
   */
  readers?: string[];
}

/**
 * Brings the schema of a service up to date (TR-PF-09), then gives the service read and write
 * access to its tables and nothing more (TR-PF-08, TR-PF-22), and the readers read access (TR-PF-28).
 * The grants are given again at every run, so new tables are included. Safe to run again:
 * migrations that already ran are skipped, and two runs at once wait for each other.
 */
export async function migrate(options: MigrateOptions): Promise<MigrationResult[]> {
  const schema = sql.id(schemaName(options.schema));
  const service = sql.raw(quoteIdentifier(options.serviceUser));
  await sql`create schema if not exists ${schema}`.execute(options.db);

  const migrator = new Migrator({
    db: introspectingOnly(options.db, options.schema),
    provider: { getMigrations: async () => options.migrations },
    migrationTableSchema: options.schema,
    migrationTableName: MIGRATION_TABLE,
    migrationLockTableName: MIGRATION_LOCK_TABLE,
  });
  const { error, results = [] } = await migrator.migrateToLatest();
  if (error) {
    const failed = results.find((result) => result.status === 'Error')?.migrationName ?? 'unknown';
    throw new Error(`Migration ${failed} of ${options.schema} failed`, { cause: error });
  }

  await sql`grant usage on schema ${schema} to ${service}`.execute(options.db);
  await sql`grant select, insert, update, delete on all tables in schema ${schema} to ${service}`.execute(options.db);
  await sql`grant usage, select on all sequences in schema ${schema} to ${service}`.execute(options.db);
  // The bookkeeping of the migrations is not the service's to touch.
  await sql`revoke all on ${schema}.${sql.id(MIGRATION_TABLE)}, ${schema}.${sql.id(MIGRATION_LOCK_TABLE)} from ${service}`.execute(
    options.db,
  );
  for (const reader of options.readers ?? []) {
    const role = sql.raw(quoteIdentifier(reader));
    await sql`grant usage on schema ${schema} to ${role}`.execute(options.db);
    await sql`grant select on all tables in schema ${schema} to ${role}`.execute(options.db);
  }
  return results;
}

/**
 * `db`, with an introspection that sees `schema` only: the Migrator asks it whether the schema
 * and its own tables exist. Kysely's own lists every column of every table in the database and
 * looks each up by name (`has_schema_privilege`, `pg_get_serial_sequence`), so it fails when
 * another schema is dropped while it runs, as the tests of the other services do alongside.
 * Kysely 0.30 limits the check to the schema itself.
 */
function introspectingOnly(db: Kysely<unknown>, schema: string): Kysely<unknown> {
  const introspection: DatabaseIntrospector = {
    async getSchemas() {
      const { rows } = await sql<{ name: string }>`
        select nspname as name from pg_catalog.pg_namespace where nspname = ${schema}`.execute(db);
      return rows;
    },
    async getTables() {
      const { rows } = await sql<{ name: string }>`
        select c.relname as name
        from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = ${schema} and c.relkind in ('r', 'p')`.execute(db);
      return rows.map(({ name }) => ({ name, schema, isView: false, isForeign: false, columns: [] }));
    },
  };
  return new Proxy(db, {
    get(target, property) {
      if (property === 'introspection') {
        return introspection;
      }
      // Kysely keeps its state in private fields, which only the instance itself can read.
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

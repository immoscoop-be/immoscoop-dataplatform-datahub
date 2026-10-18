import { randomBytes } from 'node:crypto';
import { createDatabase, migrate } from '@datahub/db';
import { sql } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';
import { migrations } from './migrations/index.js';

// A Postgres to run against: CI starts one; locally, set DATAHUB_TEST_DATABASE_URL.
const url = process.env.DATAHUB_TEST_DATABASE_URL;
if (!url && process.env.CI) {
  throw new Error('DATAHUB_TEST_DATABASE_URL must be set in CI');
}

describe.skipIf(!url)('identity migrations', () => {
  const schema = `identity_test_${randomBytes(4).toString('hex')}`;
  const admin = createDatabase<unknown>({ connectionString: url }, schema);

  afterAll(async () => {
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(admin.db);
    await admin.close();
  });

  it('run on an empty database and create the Users', async () => {
    const results = await migrate({ db: admin.db, schema, migrations, serviceUser: 'postgres' });
    expect(results.every((result) => result.status === 'Success')).toBe(true);

    // The camelCase of the database wrapper also applies to the names of these result columns.
    const columns = await sql<{ columnName: string }>`
      select column_name from information_schema.columns
      where table_schema = ${schema} and table_name = 'users' order by ordinal_position`.execute(admin.db);
    expect(columns.rows.map((row) => row.columnName)).toEqual(['google_id', 'email', 'name', 'created_at', 'last_login_at']);
  });
});

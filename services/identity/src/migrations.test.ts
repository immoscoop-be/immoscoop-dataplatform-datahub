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

/** The migrations before the one named, to find the database as it was. */
const before = (name: string) => Object.fromEntries(Object.entries(migrations).filter(([migration]) => migration < name));

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
    expect(columns.rows.map((row) => row.columnName)).toEqual(['google_id', 'email', 'name', 'created_at', 'last_login_at', 'groups', 'roles']);
  });
});

describe.skipIf(!url)('identity migration 0006-forget-theme', () => {
  const schema = `identity_test_${randomBytes(4).toString('hex')}`;
  const admin = createDatabase<unknown>({ connectionString: url }, schema);

  afterAll(async () => {
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(admin.db);
    await admin.close();
  });

  it('forgets the theme a User switched to, and keeps their other settings (DEC-UX-172)', async () => {
    await migrate({ db: admin.db, schema, migrations: before('0006'), serviceUser: 'postgres' });
    await sql`insert into ${sql.id(schema, 'users')} (google_id, email, name) values ('jan', 'jan@thenextimmoscoop.be', 'Jan')`.execute(admin.db);
    await sql`insert into ${sql.id(schema, 'settings')} (google_id, key, value) values ('jan', 'theme', '"dark"'), ('jan', 'language', '"en"')`.execute(admin.db);

    const results = await migrate({ db: admin.db, schema, migrations, serviceUser: 'postgres' });
    expect(results.map((result) => [result.migrationName, result.status])).toEqual([['0006-forget-theme', 'Success']]);
    const kept = await sql<{ key: string }>`select key from ${sql.id(schema, 'settings')} order by key`.execute(admin.db);
    expect(kept.rows.map((row) => row.key)).toEqual(['language']);
  });
});

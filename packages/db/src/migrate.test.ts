import { randomBytes } from 'node:crypto';
import { type Generated, type Kysely, sql } from 'kysely';
import type { Migration } from 'kysely/migration';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, type Database } from './connect.js';
import { migrate } from './migrate.js';

// A Postgres to run against: CI starts one; locally, set DATAHUB_TEST_DATABASE_URL.
const url = process.env.DATAHUB_TEST_DATABASE_URL;
if (!url && process.env.CI) {
  throw new Error('DATAHUB_TEST_DATABASE_URL must be set in CI');
}

const suffix = randomBytes(4).toString('hex');
const SCHEMA = `test_${suffix}`;
const SERVICE = `test-service-${suffix}@project.iam`;
const OTHER = `test-other-${suffix}@project.iam`;
const READER = `datahub-datateam-${suffix}@example.be`;

const users: Migration = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable('users')
      .addColumn('id', 'serial', (column) => column.primaryKey())
      .addColumn('display_name', 'text', (column) => column.notNull())
      .execute();
  },
};

const groups: Migration = {
  async up(db: Kysely<unknown>) {
    await db.schema.createTable('groups').addColumn('id', 'text', (column) => column.primaryKey()).execute();
  },
};

interface TestTables {
  users: { id: Generated<number>; displayName: string };
}

describe.skipIf(!url)('migrate', () => {
  let admin: Database<unknown>;
  const opened: Database<unknown>[] = [];

  /** Connects as `user` with the schema of the test, as a service would. */
  function connectAs<T>(user: string): Kysely<T> {
    // The user in the address wins over a separate `user`, so it is replaced in the address.
    const address = new URL(url ?? '');
    address.username = encodeURIComponent(user);
    const database = createDatabase<T>({ connectionString: address.toString() }, SCHEMA);
    opened.push(database as Database<unknown>);
    return database.db;
  }

  beforeAll(async () => {
    admin = createDatabase({ connectionString: url }, SCHEMA);
    for (const role of [SERVICE, OTHER, READER]) {
      await sql`create role ${sql.id(role)} login`.execute(admin.db);
    }
  });

  afterAll(async () => {
    for (const database of opened) {
      await database.close();
    }
    await sql`drop schema if exists ${sql.id(SCHEMA)} cascade`.execute(admin.db);
    for (const role of [SERVICE, OTHER, READER]) {
      await sql`drop owned by ${sql.id(role)}`.execute(admin.db);
      await sql`drop role ${sql.id(role)}`.execute(admin.db);
    }
    await admin.close();
  });

  it('creates the schema and runs the migrations in the order of their names', async () => {
    const results = await migrate({
      db: admin.db,
      schema: SCHEMA,
      migrations: { '0002_groups': groups, '0001_users': users },
      serviceUser: SERVICE,
    });

    expect(results.map((result) => [result.migrationName, result.status])).toEqual([
      ['0001_users', 'Success'],
      ['0002_groups', 'Success'],
    ]);
  });

  it('skips the migrations that already ran', async () => {
    const results = await migrate({
      db: admin.db,
      schema: SCHEMA,
      migrations: { '0001_users': users, '0002_groups': groups },
      serviceUser: SERVICE,
    });
    expect(results).toEqual([]);
  });

  it('looks at its own schema only, while another schema is dropped', async () => {
    // Other test files drop their schemas while this one migrates. Like a query that started
    // before such a drop, a transaction whose snapshot is older still sees the tables of the
    // dropped schema, but looking them up by name fails: the race, every time.
    const other = sql.id(`${SCHEMA}_dropped`);
    await sql`create schema ${other}`.execute(admin.db);
    await sql`create table ${other}.items (id serial primary key)`.execute(admin.db);
    await admin.db
      .transaction()
      .setIsolationLevel('repeatable read')
      .execute(async (trx) => {
        await sql`select 1`.execute(trx);
        await sql`drop schema ${other} cascade`.execute(admin.db);
        const results = await migrate({
          db: trx,
          schema: SCHEMA,
          migrations: { '0001_users': users, '0002_groups': groups },
          serviceUser: SERVICE,
        });
        expect(results).toEqual([]);
      });
  });

  it('lets the service read and write its rows, in camelCase', async () => {
    const db = connectAs<TestTables>(SERVICE);
    await db.insertInto('users').values({ displayName: 'Jan' }).execute();
    await expect(db.selectFrom('users').select('displayName').execute()).resolves.toEqual([{ displayName: 'Jan' }]);
  });

  it('does not let the service change its tables or the bookkeeping of the migrations', async () => {
    const db = connectAs<unknown>(SERVICE);
    await expect(sql`drop table users`.execute(db)).rejects.toThrow(/must be owner/);
    await expect(sql`create table extra (id int)`.execute(db)).rejects.toThrow(/permission denied/);
    await expect(sql`delete from kysely_migration`.execute(db)).rejects.toThrow(/permission denied/);
  });

  it('lets the readers read the rows, and nothing more', async () => {
    const reader = connectAs<TestTables>(READER);
    // Without access to the schema, its tables are not even visible.
    await expect(reader.selectFrom('users').select('displayName').execute()).rejects.toThrow(/relation "users" does not exist/);
    await migrate({ db: admin.db, schema: SCHEMA, migrations: { '0001_users': users, '0002_groups': groups }, serviceUser: SERVICE, readers: [READER] });
    await expect(reader.selectFrom('users').select('displayName').execute()).resolves.toEqual([{ displayName: 'Jan' }]);
    await expect(reader.insertInto('users').values({ displayName: 'Piet' }).execute()).rejects.toThrow(/permission denied/);
    await expect(sql`delete from users`.execute(reader)).rejects.toThrow(/permission denied/);
  });

  it('does not let any other login in', async () => {
    const db = connectAs<unknown>(OTHER);
    await expect(sql`select * from ${sql.id(SCHEMA)}.users`.execute(db)).rejects.toThrow(/permission denied for schema/);
  });

  it('stops at a failing migration and says which one', async () => {
    const broken: Migration = {
      async up(db: Kysely<unknown>) {
        await sql`select * from no_such_table`.execute(db);
      },
    };
    await expect(
      migrate({ db: admin.db, schema: SCHEMA, migrations: { '0001_users': users, '0002_groups': groups, '0003_broken': broken }, serviceUser: SERVICE }),
    ).rejects.toThrow(/0003_broken/);
  });

  it('refuses a schema name that is not a plain name', async () => {
    await expect(
      migrate({ db: admin.db, schema: 'identity; drop', migrations: {}, serviceUser: SERVICE }),
    ).rejects.toThrow(/not a valid schema name/);
  });
});

describe('createDatabase', () => {
  it('refuses a schema name that is not a plain name', () => {
    expect(() => createDatabase({ connectionString: 'postgresql://localhost/none' }, 'Public')).toThrow(/schema name/);
  });

});

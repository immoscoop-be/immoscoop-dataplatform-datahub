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
    expect(columns.rows.map((row) => row.columnName)).toEqual(['google_id', 'email', 'name', 'created_at', 'last_login_at', 'groups', 'roles', 'permission_group_id', 'active', 'workspace_groups']);
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

    const results = await migrate({ db: admin.db, schema, migrations: before('0007'), serviceUser: 'postgres' });
    expect(results.map((result) => [result.migrationName, result.status])).toEqual([['0006-forget-theme', 'Success']]);
    const kept = await sql<{ key: string }>`select key from ${sql.id(schema, 'settings')} order by key`.execute(admin.db);
    expect(kept.rows.map((row) => row.key)).toEqual(['language']);
  });
});

describe.skipIf(!url)('identity migration 0007-permission-groups', () => {
  const schema = `identity_test_${randomBytes(4).toString('hex')}`;
  const admin = createDatabase<unknown>({ connectionString: url }, schema);

  afterAll(async () => {
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(admin.db);
    await admin.close();
  });

  it('makes the three Permission groups, and puts the Data Team in Admin and every other User in Business analyst (TR-PL-08)', async () => {
    await migrate({ db: admin.db, schema, migrations: before('0007'), serviceUser: 'postgres' });
    await sql`insert into ${sql.id(schema, 'users')} (google_id, email, name, roles) values
      ('dirk', 'dirk@immoscoop.be', 'Dirk', '{datateam}'), ('an', 'an@immoscoop.be', 'An', '{}')`.execute(admin.db);

    const results = await migrate({ db: admin.db, schema, migrations: before('0008'), serviceUser: 'postgres' });
    expect(results.map((result) => [result.migrationName, result.status])).toEqual([['0007-permission-groups', 'Success']]);
    const groups = await sql<{ name: string; isDefault: boolean; locked: boolean; starting: string }>`
      select name, is_default, locked, starting from ${sql.id(schema, 'permission_groups')} order by name`.execute(admin.db);
    expect(groups.rows).toEqual([
      { name: 'Admin', isDefault: false, locked: true, starting: 'admin' },
      { name: 'Business analyst', isDefault: false, locked: false, starting: 'businessAnalyst' },
      { name: 'Lens user', isDefault: true, locked: false, starting: 'lensUser' },
    ]);
    const users = await sql<{ googleId: string; name: string }>`
      select u.google_id, g.name from ${sql.id(schema, 'users')} u join ${sql.id(schema, 'permission_groups')} g on g.id = u.permission_group_id
      order by u.google_id`.execute(admin.db);
    expect(users.rows).toEqual([
      { googleId: 'an', name: 'Business analyst' },
      { googleId: 'dirk', name: 'Admin' },
    ]);
    const log = await sql<{ kind: string }>`select kind from ${sql.id(schema, 'permission_group_log')}`.execute(admin.db);
    expect(log.rows.map((row) => row.kind)).toEqual(['switch', 'switch']);
  });
});

describe.skipIf(!url)('identity migration 0008-groups', () => {
  const schema = `identity_test_${randomBytes(4).toString('hex')}`;
  const admin = createDatabase<unknown>({ connectionString: url }, schema);

  afterAll(async () => {
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(admin.db);
    await admin.close();
  });

  it('keeps the Google groups last read, empties the claim, marks who left, and gives the Permissions of Groups (TR-UM-01, TR-UM-04)', async () => {
    await migrate({ db: admin.db, schema, migrations: before('0008'), serviceUser: 'postgres' });
    await sql`insert into ${sql.id(schema, 'users')} (google_id, email, name, groups, permission_group_id) values
      ('an', 'An@immoscoop.be', 'An', '{g-sales}', (select id from ${sql.id(schema, 'permission_groups')} where starting = 'businessAnalyst')),
      ('jan', 'jan@immoscoop.be', 'Jan', '{}', (select id from ${sql.id(schema, 'permission_groups')} where starting = 'lensUser'))`.execute(admin.db);
    await sql`insert into ${sql.id(schema, 'sessions')} (google_id, client_id, expires_at, ended_at, end_reason)
      values ('jan', 'web', now(), now() + interval '1 minute', 'account-inactive')`.execute(admin.db);

    const results = await migrate({ db: admin.db, schema, migrations: before('0009'), serviceUser: 'postgres' });
    expect(results.map((result) => [result.migrationName, result.status])).toEqual([['0008-groups', 'Success']]);
    const users = await sql<{ googleId: string; groups: string[]; workspaceGroups: string[]; active: boolean }>`
      select google_id, groups, workspace_groups, active from ${sql.id(schema, 'users')} order by google_id`.execute(admin.db);
    expect(users.rows).toEqual([
      { googleId: 'an', groups: [], workspaceGroups: ['g-sales'], active: true },
      { googleId: 'jan', groups: [], workspaceGroups: [], active: false },
    ]);
    const held = await sql<{ starting: string; manage: string; all: string }>`
      select starting, permissions -> 'groups.manage' ->> 'on' as manage, permissions -> 'groups.all.manage' ->> 'on' as all
      from ${sql.id(schema, 'permission_groups')} order by starting`.execute(admin.db);
    expect(held.rows).toEqual([
      { starting: 'admin', manage: 'true', all: 'true' },
      { starting: 'businessAnalyst', manage: 'true', all: 'false' },
      { starting: 'lensUser', manage: 'false', all: 'false' },
    ]);
  });
});

describe.skipIf(!url)('identity migration 0009-remove-and-withdrawn', () => {
  const schema = `identity_test_${randomBytes(4).toString('hex')}`;
  const admin = createDatabase<unknown>({ connectionString: url }, schema);

  afterAll(async () => {
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(admin.db);
    await admin.close();
  });

  it('gives each Permission group the Permission to remove Resources as DEC-PL-08 says, and Admin the tool Withdrawn', async () => {
    await migrate({ db: admin.db, schema, migrations: before('0009'), serviceUser: 'postgres' });
    const groups = sql.id(schema, 'permission_groups');
    // The groups as they were before: without the new Permission, and Admin without the new tool.
    await sql`update ${groups} set permissions = (permissions - 'resources.remove')
      || jsonb_build_object('admin.open', jsonb_set(permissions -> 'admin.open', '{values,tools}', (permissions #> '{admin.open,values,tools}') - 'withdrawn'))`.execute(admin.db);
    // A group made since, that adds Resources to Collections without being Admin.
    await sql`insert into ${groups} (name, sentence, permissions, is_default, locked)
      select 'Data stewards', '', jsonb_set(permissions, '{resources.assign,on}', 'true'), false, false from ${groups} where starting = 'lensUser'`.execute(admin.db);

    const results = await migrate({ db: admin.db, schema, migrations: before('0010'), serviceUser: 'postgres' });
    expect(results.map((result) => [result.migrationName, result.status])).toEqual([['0009-remove-and-withdrawn', 'Success']]);
    const held = await sql<{ name: string; on: string; reach: string; withdrawn: boolean }>`
      select name, permissions -> 'resources.remove' ->> 'on' as on, permissions #>> '{resources.remove,values,reach}' as reach,
        (permissions #> '{admin.open,values,tools}') ? 'withdrawn' as withdrawn
      from ${groups} order by name`.execute(admin.db);
    expect(held.rows).toEqual([
      { name: 'Admin', on: 'true', reach: 'every', withdrawn: true },
      { name: 'Business analyst', on: 'true', reach: 'theirs', withdrawn: false },
      { name: 'Data stewards', on: 'true', reach: 'every', withdrawn: false },
      { name: 'Lens user', on: 'false', reach: 'theirs', withdrawn: false },
    ]);
  });
});

describe.skipIf(!url)('identity migration 0010-query-outside', () => {
  const schema = `identity_test_${randomBytes(4).toString('hex')}`;
  const admin = createDatabase<unknown>({ connectionString: url }, schema);

  afterAll(async () => {
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(admin.db);
    await admin.close();
  });

  it('gives Admin the Permission to query tables outside Data Hub, and every other group it off (DEC-PL-09)', async () => {
    await migrate({ db: admin.db, schema, migrations: before('0010'), serviceUser: 'postgres' });
    const groups = sql.id(schema, 'permission_groups');
    // The groups as they were before, and a group made since by copying Admin.
    await sql`update ${groups} set permissions = permissions - 'queries.outside'`.execute(admin.db);
    await sql`insert into ${groups} (name, sentence, permissions, is_default, locked)
      select 'Power users', '', permissions, false, false from ${groups} where starting = 'admin'`.execute(admin.db);

    const results = await migrate({ db: admin.db, schema, migrations, serviceUser: 'postgres' });
    expect(results.map((result) => [result.migrationName, result.status])).toEqual([['0010-query-outside', 'Success']]);
    const held = await sql<{ name: string; on: string }>`
      select name, permissions -> 'queries.outside' ->> 'on' as on from ${groups} order by name`.execute(admin.db);
    expect(held.rows).toEqual([
      { name: 'Admin', on: 'true' },
      { name: 'Business analyst', on: 'false' },
      { name: 'Lens user', on: 'false' },
      { name: 'Power users', on: 'false' },
    ]);
  });
});

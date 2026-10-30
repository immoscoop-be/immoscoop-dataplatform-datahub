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

/** The migrations up to, not including, the one of this name. */
const before = (name: string) => Object.fromEntries(Object.entries(migrations).filter(([migration]) => migration < name));

describe.skipIf(!url)('catalogue migrations', () => {
  const schema = `catalogue_migrations_${randomBytes(4).toString('hex')}`;
  const admin = createDatabase<unknown>({ connectionString: url }, schema);
  const count = async (table: string) => Number((await sql<{ count: string }>`select count(*) from ${sql.table(table)}`.execute(admin.db)).rows[0]?.count);

  afterAll(async () => {
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(admin.db);
    await admin.close();
  });

  it('start the Resources afresh over those registered before, and keep the Collections (DEC-DH-76)', async () => {
    // The database as it was before the rebuild: a Collection, a Resource in it, and its Log.
    await migrate({ db: admin.db, schema, migrations: before('0004'), serviceUser: 'postgres' });
    await sql`
      insert into collections (id, name, description, colour, owner_unit_id, owner_unit_email, owner_unit_name, created_by)
      values ('7c0b5a52-3f4a-4bf0-9a49-2f3f5c1d9a10', 'Leads', 'Leads.', 'rose', 'g1', 'g1@thenextimmoscoop.be', 'G1', 'u1')`.execute(admin.db);
    await sql`
      insert into resources (id, key, project_id, node_id, name, resource_type, requested_name, display_name, collection_id)
      values ('0d4b1f0e-2a8e-4d5e-9b62-9a1e0c3f7b21', 'p.d.leads', '9367', 'model.p.leads', 'leads', 'model', 'leads', 'leads', '7c0b5a52-3f4a-4bf0-9a49-2f3f5c1d9a10')`.execute(admin.db);
    await sql`insert into resource_log (resource_id, log_id) values ('0d4b1f0e-2a8e-4d5e-9b62-9a1e0c3f7b21', 'RES-001')`.execute(admin.db);
    await sql`insert into resource_syncs (project_id, run_id) values ('9367', 100)`.execute(admin.db);

    const results = await migrate({ db: admin.db, schema, migrations: before('0005'), serviceUser: 'postgres' });
    expect(results.map((result) => [result.migrationName, result.status])).toEqual([['0004-resources-afresh', 'Success']]);

    expect(await count('collections')).toBe(1);
    expect(await count('resources')).toBe(0);
    expect(await count('resource_log')).toBe(0);
    // No run is remembered, so the next call of registry registers every exposed table anew.
    expect(await count('resource_syncs')).toBe(0);
    // The new Log is append-only again.
    await expect(sql`truncate resource_log`.execute(admin.db)).rejects.toThrow(/append-only/);
  });

  it('start the Collections afresh, without colour and with a required icon, and every Resource waits for one again (DEC-CO-23, DEC-CO-25)', async () => {
    // Where the test before left off: a Collection with a colour and its Log, and a Resource in it.
    await sql`insert into collection_log (collection_id, log_id) values ('7c0b5a52-3f4a-4bf0-9a49-2f3f5c1d9a10', 'COL-001')`.execute(admin.db);
    await sql`
      insert into resources (id, key, project_id, node_id, name, resource_type, requested_name, display_name, level, collection_id)
      values ('0d4b1f0e-2a8e-4d5e-9b62-9a1e0c3f7b21', 'p.d.leads', '9367', 'model.p.leads', 'leads', 'model', 'leads', 'leads', 1, '7c0b5a52-3f4a-4bf0-9a49-2f3f5c1d9a10')`.execute(admin.db);
    await sql`
      insert into messages (type, subject_kind, subject_id, state)
      values ('MSG-RES-01', 'resource', '0d4b1f0e-2a8e-4d5e-9b62-9a1e0c3f7b21', 'inCollection')`.execute(admin.db);

    const results = await migrate({ db: admin.db, schema, migrations, serviceUser: 'postgres' });
    expect(results.map((result) => [result.migrationName, result.status])).toEqual([
      ['0005-collections-afresh', 'Success'],
      ['0006-grain-and-mappings', 'Success'],
      ['0007-resource-card', 'Success'],
      ['0008-publication', 'Success'],
      ['0009-requests', 'Success'],
      ['0010-search-words', 'Success'],
      ['0011-conversations', 'Success'],
      ['0012-full-name', 'Success'],
      ['0013-notifications', 'Success'],
    ]);

    expect(await count('collections')).toBe(0);
    expect(await count('collection_log')).toBe(0);
    expect((await sql<{ collectionId: string | null }>`select collection_id from resources`.execute(admin.db)).rows).toEqual([{ collectionId: null }]);
    expect((await sql<{ state: string }>`select state from messages`.execute(admin.db)).rows).toEqual([{ state: 'waiting' }]);
    // No colour any more, an icon always, and a Resource still points at a Collection that exists.
    const columns = (await sql<{ columnName: string }>`
      select column_name from information_schema.columns where table_schema = ${schema} and table_name = 'collections'`.execute(admin.db)).rows.map((row) => row.columnName);
    expect(columns).toContain('icon');
    expect(columns).not.toContain('colour');
    await expect(sql`
      insert into collections (name, description, owner_unit_id, owner_unit_email, owner_unit_name, created_by, created_by_name)
      values ('Leads', 'Leads.', 'g1', 'g1@thenextimmoscoop.be', 'G1', 'u1', 'An')`.execute(admin.db)).rejects.toThrow(/icon/);
    await expect(sql`update resources set collection_id = '7c0b5a52-3f4a-4bf0-9a49-2f3f5c1d9a10'`.execute(admin.db)).rejects.toThrow(/foreign key/);
    await expect(sql`truncate collection_log`.execute(admin.db)).rejects.toThrow(/append-only/);
    // A Message from before is not notified; one written now is, from the moment it is written (DEC-LN-02).
    expect(await count('notifications')).toBe(0);
    await sql`insert into messages (type, subject_kind, subject_id, state) values ('MSG-RES-01', 'resource', 'r-2', 'waiting')`.execute(admin.db);
    expect(await count('notifications')).toBe(1);
  });
});

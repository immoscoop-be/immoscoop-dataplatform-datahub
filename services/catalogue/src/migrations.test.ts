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

describe.skipIf(!url)('catalogue migrations', () => {
  const schema = `catalogue_migrations_${randomBytes(4).toString('hex')}`;
  const admin = createDatabase<unknown>({ connectionString: url }, schema);

  afterAll(async () => {
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(admin.db);
    await admin.close();
  });

  it('start the Resources afresh over those registered before, and keep the Collections (DEC-DH-76)', async () => {
    // The database as it was before the rebuild: a Collection, a Resource in it, and its Log.
    const before = Object.fromEntries(Object.entries(migrations).filter(([name]) => name < '0004'));
    await migrate({ db: admin.db, schema, migrations: before, serviceUser: 'postgres' });
    await sql`
      insert into collections (id, name, description, colour, owner_unit_id, owner_unit_email, owner_unit_name, created_by)
      values ('7c0b5a52-3f4a-4bf0-9a49-2f3f5c1d9a10', 'Leads', 'Leads.', 'rose', 'g1', 'g1@thenextimmoscoop.be', 'G1', 'u1')`.execute(admin.db);
    await sql`
      insert into resources (id, key, project_id, node_id, name, resource_type, requested_name, display_name, collection_id)
      values ('0d4b1f0e-2a8e-4d5e-9b62-9a1e0c3f7b21', 'p.d.leads', '9367', 'model.p.leads', 'leads', 'model', 'leads', 'leads', '7c0b5a52-3f4a-4bf0-9a49-2f3f5c1d9a10')`.execute(admin.db);
    await sql`insert into resource_log (resource_id, log_id) values ('0d4b1f0e-2a8e-4d5e-9b62-9a1e0c3f7b21', 'RES-001')`.execute(admin.db);
    await sql`insert into resource_syncs (project_id, run_id) values ('9367', 100)`.execute(admin.db);

    const results = await migrate({ db: admin.db, schema, migrations, serviceUser: 'postgres' });
    expect(results.map((result) => [result.migrationName, result.status])).toEqual([['0004-resources-afresh', 'Success']]);

    const count = async (table: string) => Number((await sql<{ count: string }>`select count(*) from ${sql.table(table)}`.execute(admin.db)).rows[0]?.count);
    expect(await count('collections')).toBe(1);
    expect(await count('resources')).toBe(0);
    expect(await count('resource_log')).toBe(0);
    // No run is remembered, so the next call of registry registers every exposed table anew.
    expect(await count('resource_syncs')).toBe(0);
    // The new Log is append-only again.
    await expect(sql`truncate resource_log`.execute(admin.db)).rejects.toThrow(/append-only/);
  });
});

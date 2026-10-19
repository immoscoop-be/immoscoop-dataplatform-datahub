import { randomBytes } from 'node:crypto';
import { createDatabase, migrate, type Database } from '@datahub/db';
import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Collections, createCollections, NameTaken, type Viewer } from './collections.js';
import type { CatalogueDatabase } from './database.js';
import { migrations } from './migrations/index.js';

// A Postgres to run against: CI starts one; locally, set DATAHUB_TEST_DATABASE_URL.
const url = process.env.DATAHUB_TEST_DATABASE_URL;
if (!url && process.env.CI) {
  throw new Error('DATAHUB_TEST_DATABASE_URL must be set in CI');
}

const DIGIKOM = { id: 'g-digikom', email: 'digikom@thenextimmoscoop.be', name: 'DigiKom' };
const SALES = { id: 'g-sales', email: 'sales@thenextimmoscoop.be', name: 'Sales' };

const an: Viewer = { id: 'u-an', name: 'An', groups: [DIGIKOM.id], dataTeam: false };
const bert: Viewer = { id: 'u-bert', name: 'Bert', groups: [SALES.id], dataTeam: false };
const dataTeam: Viewer = { id: 'u-dt', name: 'Dirk', groups: [], dataTeam: true };

describe.skipIf(!url)('Collections in Postgres', () => {
  const schema = `catalogue_collections_${randomBytes(4).toString('hex')}`;
  let database: Database<CatalogueDatabase>;
  let collections: Collections;

  beforeAll(async () => {
    database = createDatabase<CatalogueDatabase>({ connectionString: url }, schema);
    await migrate({ db: database.db as Kysely<unknown>, schema, migrations, serviceUser: 'postgres' });
    collections = createCollections(database.db);
  });

  afterAll(async () => {
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(database.db);
    await database.close();
  });

  it('shows a private Collection to its Owner Unit and the Data Team only, a public one to everyone (FR-CO-17)', async () => {
    const leads = await collections.create(
      { name: 'Leads', description: 'Leads of the agencies.', colour: 'rose', ownerUnit: DIGIKOM, visibility: 'private' },
      an,
    );
    const visits = await collections.create(
      { name: 'Web visits', description: 'Visits to the website.', colour: 'teal', ownerUnit: SALES, visibility: 'public' },
      bert,
    );
    expect(leads).toMatchObject({ name: 'Leads', ownerUnit: DIGIKOM, visibility: 'private', canManage: true });

    expect((await collections.list(an)).map((collection) => collection.name)).toEqual(['Leads', 'Web visits']);
    expect((await collections.list(bert)).map((collection) => collection.name)).toEqual(['Web visits']);
    expect((await collections.list(dataTeam)).map((collection) => [collection.name, collection.canManage])).toEqual([
      ['Leads', true],
      ['Web visits', true],
    ]);
    expect(await collections.get(leads.id, bert)).toBeUndefined();
    expect((await collections.get(visits.id, an))?.canManage).toBe(false);
    expect(await collections.get('not-a-uuid', an)).toBeUndefined();
  });

  it('keeps names unique whatever their case, until a Collection is dissolved (FR-CO-02)', async () => {
    const agencies = await collections.create(
      { name: 'Agencies', description: 'The agencies.', colour: 'sand', ownerUnit: DIGIKOM, visibility: 'private' },
      an,
    );
    await expect(
      collections.create({ name: 'AGENCIES', description: 'Again.', colour: 'sand', ownerUnit: SALES, visibility: 'private' }, bert),
    ).rejects.toThrow(NameTaken);
    expect(await collections.dissolve(agencies.id, an)).toBe(true);
    expect(await collections.dissolve(agencies.id, an)).toBe(false);
    expect(await collections.get(agencies.id, dataTeam)).toBeUndefined();
    await expect(
      collections.create({ name: 'agencies', description: 'Again.', colour: 'sand', ownerUnit: SALES, visibility: 'private' }, bert),
    ).resolves.toMatchObject({ name: 'agencies' });
  });

  it('changes only what differs, and logs every change with its actor, newest first (FR-CO-11)', async () => {
    const created = await collections.create(
      { name: 'Listings', description: 'Listings.', colour: 'green', ownerUnit: DIGIKOM, visibility: 'private' },
      an,
    );
    const changed = await collections.change(
      created.id,
      { name: 'Listings', description: 'Every listing on the site.', colour: 'olive', ownerUnit: SALES, visibility: 'public' },
      dataTeam,
    );
    expect(changed).toMatchObject({ description: 'Every listing on the site.', colour: 'olive', ownerUnit: SALES, visibility: 'public' });
    // Nothing differs: no Log Entry.
    await collections.change(created.id, { colour: 'olive' }, an);

    expect((await collections.log(created.id, 50)).map((entry) => [entry.logId, entry.text])).toEqual([
      ['COL-004', 'Made public by Dirk'],
      ['COL-003', 'Owner Unit changed from DigiKom to Sales by Dirk'],
      ['COL-002', 'Colour changed by Dirk'],
      ['COL-002', 'Description changed by Dirk'],
      ['COL-001', 'Collection created by An'],
    ]);
    const [, , colour] = await collections.log(created.id, 50);
    expect(colour?.params).toEqual({ field: 'colour', old: 'green', new: 'olive', actor: 'Dirk' });

    await expect(collections.change(created.id, { name: 'leads' }, dataTeam)).rejects.toThrow(NameTaken);
    expect(await collections.change('00000000-0000-4000-8000-000000000000', { name: 'Gone' }, dataTeam)).toBeUndefined();
  });

  it('carries an optional Tabler icon, which can be changed and taken away, each time logged (FR-CO-05)', async () => {
    const agencies = await collections.create(
      { name: 'Agency offices', description: 'Offices.', colour: 'indigo', icon: 'building-estate', ownerUnit: DIGIKOM, visibility: 'private' },
      an,
    );
    expect(agencies.icon).toBe('building-estate');
    expect((await collections.create({ name: 'No icon', description: 'None.', colour: 'sand', ownerUnit: DIGIKOM, visibility: 'private' }, an)).icon).toBeNull();

    expect((await collections.change(agencies.id, { icon: 'map-pin' }, an))?.icon).toBe('map-pin');
    expect((await collections.change(agencies.id, { icon: null }, an))?.icon).toBeNull();
    const [removed, changed] = await collections.log(agencies.id, 10);
    expect(changed?.params).toEqual({ field: 'icon', old: 'building-estate', new: 'map-pin', actor: 'An' });
    expect(removed?.params).toEqual({ field: 'icon', old: 'map-pin', new: 'none', actor: 'An' });
    expect(removed?.text).toBe('Icon changed by An');
  });

  it('never lets a Log Entry be changed or removed, not even by the service (FR-CO-11)', async () => {
    await expect(sql`update collection_log set log_id = 'COL-005'`.execute(database.db)).rejects.toThrow(/append-only/);
    await expect(sql`delete from collection_log`.execute(database.db)).rejects.toThrow(/append-only/);
    await expect(sql`truncate collection_log`.execute(database.db)).rejects.toThrow(/append-only/);
  });
});

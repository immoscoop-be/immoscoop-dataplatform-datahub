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
      { name: 'Leads', description: 'Leads of the agencies.', icon: 'coins', ownerUnit: DIGIKOM, visibility: 'private' },
      an,
    );
    const visits = await collections.create(
      { name: 'Web visits', description: 'Visits to the website.', icon: 'globe', ownerUnit: SALES, visibility: 'public' },
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
      { name: 'Agencies', description: 'The agencies.', icon: 'handshake', ownerUnit: DIGIKOM, visibility: 'private' },
      an,
    );
    await expect(
      collections.create({ name: 'AGENCIES', description: 'Again.', icon: 'handshake', ownerUnit: SALES, visibility: 'private' }, bert),
    ).rejects.toThrow(NameTaken);
    expect(await collections.dissolve(agencies.id, an)).toBe(true);
    expect(await collections.dissolve(agencies.id, an)).toBe(false);
    expect(await collections.get(agencies.id, dataTeam)).toBeUndefined();
    await expect(
      collections.create({ name: 'agencies', description: 'Again.', icon: 'handshake', ownerUnit: SALES, visibility: 'private' }, bert),
    ).resolves.toMatchObject({ name: 'agencies' });
  });

  it('changes only what differs, and logs every change with its actor, newest first (FR-CO-11)', async () => {
    const created = await collections.create(
      { name: 'Listings', description: 'Listings.', icon: 'house-line', ownerUnit: DIGIKOM, visibility: 'private' },
      an,
    );
    const changed = await collections.change(
      created.id,
      { name: 'Listings', description: 'Every listing on the site.', icon: 'buildings', ownerUnit: SALES, visibility: 'public' },
      dataTeam,
    );
    expect(changed).toMatchObject({ description: 'Every listing on the site.', icon: 'buildings', ownerUnit: SALES, visibility: 'public', createdBy: 'An' });
    // Nothing differs: no Log Entry.
    await collections.change(created.id, { icon: 'buildings' }, an);

    const log = await collections.log({ id: created.id, canManage: true }, 50);
    expect(log.map((entry) => [entry.logId, entry.text])).toEqual([
      ['COL-004', 'Made public by Dirk'],
      ['COL-003', 'Owner Unit changed from DigiKom to Sales by Dirk'],
      ['COL-002', 'Icon changed by Dirk'],
      ['COL-002', 'Description changed by Dirk'],
      ['COL-001', 'Collection created by An'],
    ]);
    expect(log[2]?.params).toEqual({ field: 'icon', old: 'house-line', new: 'buildings', actor: 'Dirk' });
    // The last change since it was created, for the start screen.
    expect((await collections.get(created.id, an))?.lastChange).toMatchObject({ logId: 'COL-004', text: 'Made public by Dirk' });

    await expect(collections.change(created.id, { name: 'leads' }, dataTeam)).rejects.toThrow(NameTaken);
    expect(await collections.change('00000000-0000-4000-8000-000000000000', { name: 'Gone' }, dataTeam)).toBeUndefined();
  });

  it('shows an icon that Phosphor no longer has as none (DEC-CO-19)', async () => {
    const dropped = await collections.create(
      { name: 'Dropped icon', description: 'An icon of an older Phosphor.', icon: 'rocket', ownerUnit: DIGIKOM, visibility: 'private' },
      an,
    );
    expect(dropped.icon).toBe('rocket');
    await sql`update collections set icon = 'gone-in-a-later-version' where id = ${dropped.id}`.execute(database.db);
    expect((await collections.get(dropped.id, an))?.icon).toBeNull();
  });

  it('lists its Resources and their additions to its Owner Unit and the Data Team only, while none is published (DEC-CO-12)', async () => {
    const credit = await collections.create(
      { name: 'Credit leads', description: 'The credit leads.', icon: 'coins', ownerUnit: DIGIKOM, visibility: 'public' },
      an,
    );
    await sql`
      insert into resources (id, key, project_id, node_id, name, resource_type, requested_name, display_name, level, collection_id)
      values ('0d4b1f0e-2a8e-4d5e-9b62-9a1e0c3f7b21', 'p.d.leads', '9367', 'model.p.leads', 'leads', 'model', 'leads', 'Weekly leads', 2, ${credit.id})`.execute(database.db);
    await sql`insert into collection_log (collection_id, log_id, params) values (${credit.id}, 'COL-006', '{"resource": "Weekly leads", "actor": "Dirk"}')`.execute(
      database.db,
    );

    expect((await collections.get(credit.id, an))?.resources).toEqual([
      { id: '0d4b1f0e-2a8e-4d5e-9b62-9a1e0c3f7b21', key: 'p.d.leads', displayName: 'Weekly leads', level: 2, published: false, deprecated: false, withdrawn: false, folderId: null },
    ]);
    expect((await collections.get(credit.id, an))?.lastChange?.text).toBe('Weekly leads added by Dirk');
    const colleague = await collections.get(credit.id, bert);
    expect(colleague).toMatchObject({ resources: [], lastChange: null, canManage: false });
    expect((await collections.log(colleague!, 10)).map((entry) => entry.logId)).toEqual(['COL-001']);
    expect((await collections.log({ id: credit.id, canManage: true }, 10)).map((entry) => entry.logId)).toEqual(['COL-006', 'COL-001']);
  });

  it('keeps folders as deep as needed, and moves Resources, Lenses and folders between them (FR-CO-38 to FR-CO-40)', async () => {
    const homes = await collections.create({ name: 'Homes', description: 'Homes for sale.', icon: 'house', ownerUnit: DIGIKOM, visibility: 'public' }, an);
    const resource = 'a1b2c3d4-0000-4000-8000-000000000001';
    const lens = 'a1b2c3d4-0000-4000-8000-000000000002';
    await sql`
      insert into resources (id, key, project_id, node_id, name, resource_type, requested_name, display_name, level, collection_id, published_at)
      values (${resource}, 'p.d.homes', '9367', 'model.p.homes', 'homes', 'model', 'homes', 'Homes per week', 3, ${homes.id}, now())`.execute(database.db);
    await sql`
      insert into lenses (id, name, collection_id, resource_ids, state, author_id, author_name)
      values (${lens}, 'Homes by region', ${homes.id}, ${[resource]}, 'published', 'u-an', 'An')`.execute(database.db);

    const made = await collections.makeFolder(homes.id, 'By region', null, an);
    expect(made).toMatchObject({ outcome: 'done', value: { name: 'By region', parentId: null } });
    const region = made.outcome === 'done' ? made.value.id : '';
    const inner = await collections.makeFolder(homes.id, 'Antwerp', region, an);
    const antwerp = inner.outcome === 'done' ? inner.value.id : '';
    const deeper = await collections.makeFolder(homes.id, 'Old town', antwerp, an);
    expect(deeper).toMatchObject({ outcome: 'done', value: { parentId: antwerp } });
    // A folder of another Collection is no place to make one in.
    const other = await collections.create({ name: 'Elsewhere', description: 'Another.', icon: 'house', ownerUnit: DIGIKOM, visibility: 'public' }, an);
    expect(await collections.makeFolder(other.id, 'Lost', region, an)).toEqual({ outcome: 'no_folder' });

    expect(await collections.move(homes.id, { kind: 'resource', id: resource }, antwerp, an)).toEqual({ outcome: 'done', value: undefined });
    expect(await collections.move(homes.id, { kind: 'lens', id: lens }, region, an)).toEqual({ outcome: 'done', value: undefined });
    // A folder does not go into itself, nor into a folder inside it.
    expect(await collections.move(homes.id, { kind: 'folder', id: region }, region, an)).toEqual({ outcome: 'into_itself' });
    const oldTown = deeper.outcome === 'done' ? deeper.value.id : '';
    expect(await collections.move(homes.id, { kind: 'folder', id: region }, oldTown, an)).toEqual({ outcome: 'into_itself' });
    // Something of another Collection does not move here.
    expect(await collections.move(other.id, { kind: 'resource', id: resource }, null, an)).toEqual({ outcome: 'not_found' });

    // Everyone who sees the Collection sees its folders and where everything sits.
    const seen = await collections.get(homes.id, bert);
    expect(seen?.folders.map((folder) => [folder.name, folder.parentId])).toEqual([
      ['Antwerp', region],
      ['By region', null],
      ['Old town', antwerp],
    ]);
    expect(seen?.resources.map((item) => item.folderId)).toEqual([antwerp]);
    expect(seen?.lensFolders).toEqual({ [lens]: region });

    // Only an empty folder is deleted (FR-CO-39).
    expect(await collections.deleteFolder(homes.id, antwerp, an)).toEqual({ outcome: 'not_empty', holds: 2 });
    expect(await collections.move(homes.id, { kind: 'resource', id: resource }, null, an)).toMatchObject({ outcome: 'done' });
    expect(await collections.move(homes.id, { kind: 'folder', id: oldTown }, null, an)).toMatchObject({ outcome: 'done' });
    expect(await collections.renameFolder(homes.id, antwerp, 'Antwerpen', an)).toMatchObject({ outcome: 'done', value: { name: 'Antwerpen' } });
    expect(await collections.deleteFolder(homes.id, antwerp, an)).toEqual({ outcome: 'done', value: undefined });
    expect(await collections.deleteFolder(homes.id, antwerp, an)).toEqual({ outcome: 'not_found' });

    expect((await collections.log({ id: homes.id, canManage: true }, 20)).map((entry) => entry.text)).toEqual([
      'Folder Antwerpen deleted by An',
      'Folder Antwerp renamed to Antwerpen by An',
      'Folder Old town moved to Homes by An',
      'Homes per week moved to Homes by An',
      'Homes by region moved to By region by An',
      'Homes per week moved to Antwerp by An',
      'Folder Old town made in Antwerp by An',
      'Folder Antwerp made in By region by An',
      'Folder By region made in Homes by An',
      'Collection created by An',
    ]);
  });

  it('keeps an intro in Markdown, and logs only that it changed (FR-CO-41)', async () => {
    const created = await collections.create(
      { name: 'With an intro', description: 'An intro.', icon: 'book-open', ownerUnit: DIGIKOM, visibility: 'private', intro: '### Start here' },
      an,
    );
    expect(created.intro).toBe('### Start here');
    const changed = await collections.change(created.id, { intro: '**Read** this first.' }, an);
    expect(changed?.intro).toBe('**Read** this first.');
    expect(changed?.lastChange).toMatchObject({ logId: 'COL-014', text: 'Intro changed by An', params: { actor: 'An' } });
  });

  it('never lets a Log Entry be changed or removed, not even by the service (FR-CO-11)', async () => {
    await expect(sql`update collection_log set log_id = 'COL-005'`.execute(database.db)).rejects.toThrow(/append-only/);
    await expect(sql`delete from collection_log`.execute(database.db)).rejects.toThrow(/append-only/);
    await expect(sql`truncate collection_log`.execute(database.db)).rejects.toThrow(/append-only/);
  });
});

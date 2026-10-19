import { randomBytes } from 'node:crypto';
import { createDatabase, migrate, type Database } from '@datahub/db';
import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Collections, createCollections, NotEmpty, type Viewer } from './collections.js';
import type { CatalogueDatabase } from './database.js';
import { migrations } from './migrations/index.js';
import { createResources, type ExposedTable, type Resources, type ResourcesUpdate } from './resources.js';

const url = process.env.DATAHUB_TEST_DATABASE_URL;
if (!url && process.env.CI) {
  throw new Error('DATAHUB_TEST_DATABASE_URL must be set in CI');
}

const dirk: Viewer = { id: 'u-dt', name: 'Dirk', groups: [], dataTeam: true };
const DIGIKOM = { id: 'g-digikom', email: 'digikom@thenextimmoscoop.be', name: 'DigiKom' };

function table(name: string, extra: Partial<ExposedTable> = {}): ExposedTable {
  return {
    key: `immoscoop-dataplatform.dbt_marts.${name}`,
    nodeId: `model.immoscoop_dataplatform_sql.${name}`,
    name,
    resourceType: 'model',
    description: `About ${name}.`,
    exposures: [`datahub_${name}`],
    label: null,
    ...extra,
  };
}

const prod = (runId: string, tables: ExposedTable[]): ResourcesUpdate => ({ projectId: '9367', projectName: 'immoscoop_dataplatform_sql', runId, tables });

describe.skipIf(!url)('Resources in Postgres', () => {
  const schema = `catalogue_resources_${randomBytes(4).toString('hex')}`;
  let database: Database<CatalogueDatabase>;
  let resources: Resources;
  let collections: Collections;

  beforeAll(async () => {
    database = createDatabase<CatalogueDatabase>({ connectionString: url }, schema);
    await migrate({ db: database.db as Kysely<unknown>, schema, migrations, serviceUser: 'postgres' });
    resources = createResources(database.db);
    collections = createCollections(database.db);
  });

  afterAll(async () => {
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(database.db);
    await database.close();
  });

  const byKey = async () => Object.fromEntries((await resources.withoutCollection()).map((resource) => [resource.name, resource]));
  const texts = async (id: string) => (await resources.log(id, 50)).map((entry) => entry.text);

  it('registers every exposed table once, named by its label or its Node, and waits for a Collection (FR-SR-32, FR-SR-35)', async () => {
    const outcome = await resources.apply(prod('100', [table('orders', { label: 'Orders', exposures: ['datahub_marts', 'datahub_orders'] }), table('customers')]));
    expect(outcome).toEqual({ applied: true, registered: 2, renamed: 0, withdrawn: 0, back: 0 });
    const known = await byKey();
    expect(known.orders).toMatchObject({ displayName: 'Orders', key: 'immoscoop-dataplatform.dbt_marts.orders', description: 'About orders.', collectionId: null, withdrawn: false });
    expect(known.customers?.displayName).toBe('customers');
    expect(await texts(known.orders!.id)).toEqual(['Registered through exposure datahub_marts']);
  });

  it('renames, refreshes, withdraws and brings back, with the whole state of the project each time (FR-SR-33, FR-SR-34)', async () => {
    // The label changes, the description too, and customers is no longer exposed.
    await resources.apply(prod('101', [table('orders', { label: 'All orders', description: 'Every order.' })]));
    let known = await byKey();
    expect(known.orders).toMatchObject({ displayName: 'All orders', description: 'Every order.' });
    expect(known.customers?.withdrawn).toBe(true);

    // customers comes back as it was.
    const outcome = await resources.apply(prod('102', [table('orders', { label: 'All orders' }), table('customers')]));
    expect(outcome).toMatchObject({ registered: 0, renamed: 0, withdrawn: 0, back: 1 });
    known = await byKey();
    expect(known.customers?.withdrawn).toBe(false);
    expect(await texts(known.customers!.id)).toEqual([
      'Back through exposure datahub_customers',
      'Withdrawn: no exposure with the tag datahub depends on it any more',
      'Registered through exposure datahub_customers',
    ]);
    expect(await texts(known.orders!.id)).toEqual(['Renamed from Orders to All orders', 'Registered through exposure datahub_marts']);
  });

  it('changes nothing for a call about an older run, as when a run is processed again', async () => {
    expect(await resources.apply(prod('99', []))).toMatchObject({ applied: false, withdrawn: 0 });
    expect((await byKey()).orders?.withdrawn).toBe(false);
  });

  it('keeps Display Names unique, adding the dbt project or the Key (FR-SR-33)', async () => {
    await resources.apply({ projectId: '17121', projectName: 'compilacion_colleciones_dbt', runId: '5', tables: [table('agency_orders', { key: 'immoscoop-dataplatform.colleciones.orders', label: 'All orders' })] });
    expect((await byKey()).agency_orders?.displayName).toBe('All orders (compilacion_colleciones_dbt)');
  });

  it('adds a Resource to one Collection, never moves it, and logs both sides (FR-CO-07, FR-CO-08, FR-CO-11)', async () => {
    const leads = await collections.create({ name: 'Leads', description: 'Leads.', colour: 'rose', ownerUnit: DIGIKOM, visibility: 'private' }, dirk);
    const other = await collections.create({ name: 'Other', description: 'Other.', colour: 'teal', ownerUnit: DIGIKOM, visibility: 'private' }, dirk);
    const orders = (await byKey()).orders!;

    expect(await resources.add(orders.id, leads, dirk)).toBe('added');
    expect(await resources.add(orders.id, leads, dirk)).toBe('already');
    expect(await resources.add(orders.id, other, dirk)).toBe('in_another_collection');
    expect((await resources.inCollection(leads.id)).map((resource) => resource.displayName)).toEqual(['All orders']);
    expect((await byKey()).orders).toBeUndefined();

    // A Collection that holds Resources, withdrawn ones too, cannot be dissolved (FR-CO-10).
    await expect(collections.dissolve(leads.id, dirk)).rejects.toThrow(NotEmpty);
    await resources.apply(prod('103', [table('customers')]));
    expect((await resources.inCollection(leads.id))[0]).toMatchObject({ displayName: 'All orders', withdrawn: true });
    await expect(collections.dissolve(leads.id, dirk)).rejects.toThrow('The Collection still holds 1 Resource; the Data Team removes them first.');

    expect(await resources.remove(orders.id, dirk)).toBe(true);
    expect(await resources.remove(orders.id, dirk)).toBe(false);
    expect(await collections.dissolve(leads.id, dirk)).toBe(true);
    expect(await resources.add(orders.id, leads, dirk)).toBe('collection_gone');

    expect((await collections.log(leads.id, 50)).map((entry) => entry.text).slice(0, 3)).toEqual([
      'Collection dissolved by Dirk',
      'All orders removed by Dirk',
      'All orders added by Dirk',
    ]);
    expect((await texts(orders.id)).slice(0, 3)).toEqual([
      'Removed from collection Leads by Dirk',
      'Withdrawn: no exposure with the tag datahub depends on it any more',
      'Added to collection Leads by Dirk',
    ]);
  });

  it('never lets a Log Entry of a Resource be changed or removed (FR-SR-11)', async () => {
    await expect(sql`update resource_log set log_id = 'RES-004'`.execute(database.db)).rejects.toThrow(/append-only/);
    await expect(sql`delete from resource_log`.execute(database.db)).rejects.toThrow(/append-only/);
  });
});

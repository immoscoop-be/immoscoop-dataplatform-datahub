import { randomBytes } from 'node:crypto';
import { createDatabase, migrate, type Database } from '@datahub/db';
import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Collections, createCollections, NotEmpty, type Viewer } from './collections.js';
import type { CatalogueDatabase } from './database.js';
import { migrations } from './migrations/index.js';
import { checkDetails, createResources, type Details, type ExposedTable, type Resources, type ResourcesUpdate } from './resources.js';

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
    checksum: `sum-${name}`,
    columns: [
      { name: `${name}_id`, position: 1, dataType: 'STRING', description: `The ${name}.` },
      { name: 'created_at', position: 2, dataType: 'TIMESTAMP', description: '' },
    ],
    ...extra,
  };
}

/** orders, as the first run exposes it: with its label, through two exposures. */
const orders = table('orders', { label: 'Orders', exposures: ['datahub_marts', 'datahub_orders'] });

const prod = (runId: string, tables: ExposedTable[]): ResourcesUpdate => ({
  projectId: '9367',
  projectName: 'immoscoop_dataplatform_sql',
  runId,
  generatedAt: '2026-10-26T06:12:00Z',
  tables,
});

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
    const outcome = await resources.apply(prod('100', [orders, table('customers')]));
    expect(outcome).toEqual({ applied: true, registered: 2, renamed: 0, withdrawn: 0, back: 0 });
    const known = await byKey();
    expect(known.orders).toMatchObject({ displayName: 'Orders', key: 'immoscoop-dataplatform.dbt_marts.orders', description: 'About orders.', collectionId: null, withdrawn: false });
    expect(known.customers?.displayName).toBe('customers');
    // The first entries of its Log: the Registration and the Level (FR-SR-09).
    expect(await texts(known.orders!.id)).toEqual(['Maturity assessed at Level 2', 'Registered through exposure datahub_marts']);
  });

  it('assesses the Level at Registration from the descriptions in dbt, at most Described (FR-SR-07)', async () => {
    const known = await byKey();
    expect(known.orders?.level).toBe(2);
    // One field described is enough; the table itself must be described.
    await resources.apply(prod('100', [orders, table('customers'), table('visits', { description: '' })]));
    expect((await byKey()).visits?.level).toBe(1);
    const entries = await resources.log((await byKey()).visits!.id, 50);
    expect(entries[0]).toMatchObject({ logId: 'RES-002', params: { level: '1', reason: 'table-undescribed' } });
  });

  it('keeps the plain fields of a Resource and names the columns it leaves out, refreshed by every call (FR-SR-06, DEC-SR-33)', async () => {
    const withArray = (fields: ExposedTable['columns']) => table('visits', { description: '', columns: fields });
    await resources.apply(
      prod('100', [
        orders,
        table('customers'),
        withArray([
          { name: 'visit_id', position: 1, dataType: 'STRING', description: 'The visit.' },
          { name: 'pages', position: 2, dataType: 'ARRAY<STRING>', description: 'The pages seen.' },
          { name: 'context', position: 3, dataType: 'JSON', description: '' },
        ]),
      ]),
    );
    const visits = (await byKey()).visits!;
    expect(await resources.detail(visits.id)).toMatchObject({
      fields: [{ name: 'visit_id', position: 1, dataType: 'STRING', description: 'The visit.' }],
      leftOut: [
        { name: 'context', dataType: 'JSON', reason: 'json' },
        { name: 'pages', dataType: 'ARRAY<STRING>', reason: 'array' },
      ],
    });
    // dbt describes no field of it: it stays at 1 · Available (FR-MR-15).
    expect((await resources.detail(visits.id))?.level).toBe(1);
  });

  it('takes a Fingerprint and places one Message for the Data Team at Registration, never again (FR-SR-08, MSG-RES-01, DEC-CV-10)', async () => {
    const visits = (await byKey()).visits!;
    const prints = await database.db.selectFrom('resourceFingerprints').selectAll().where('resourceId', '=', visits.id).execute();
    expect(prints).toHaveLength(1);
    expect(prints[0]).toMatchObject({ runId: '100', code: 'sum-visits' });
    expect(prints[0]?.structure).toMatch(/^[0-9a-f]{64}$/);

    const messages = await database.db.selectFrom('messages').selectAll().where('subjectId', '=', visits.id).execute();
    expect(messages).toEqual([
      expect.objectContaining({
        type: 'MSG-RES-01',
        subjectKind: 'resource',
        writerId: null,
        params: { exposure: 'datahub_visits', project: 'immoscoop_dataplatform_sql', run: '2026-10-26' },
        state: 'waiting',
      }),
    ]);
  });

  it('renames, refreshes, withdraws and brings back, with the whole state of the project each time (FR-SR-33, FR-SR-34)', async () => {
    // The label changes, the description too, and customers and visits are no longer exposed.
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
      'Maturity assessed at Level 2',
      'Registered through exposure datahub_customers',
    ]);
    // Its description changed, and changed back: each goes into its Log (FR-RC-17).
    expect(await texts(known.orders!.id)).toEqual([
      'Description changed in orders',
      'Renamed from Orders to All orders',
      'Description changed in orders',
      'Maturity assessed at Level 2',
      'Registered through exposure datahub_marts',
    ]);
    // Coming back is no new Registration: no second Message (DEC-CV-10).
    const messages = await database.db.selectFrom('messages').select('type').where('subjectId', '=', known.customers!.id).execute();
    expect(messages).toHaveLength(1);
  });

  it('changes nothing for a call about an older run, as when a run is processed again', async () => {
    expect(await resources.apply(prod('99', []))).toMatchObject({ applied: false, withdrawn: 0 });
    expect((await byKey()).orders?.withdrawn).toBe(false);
  });

  it('keeps Display Names unique, adding the dbt project or the Key (FR-SR-33)', async () => {
    await resources.apply({
      projectId: '17121',
      projectName: 'compilacion_colleciones_dbt',
      runId: '5',
      generatedAt: null,
      tables: [table('agency_orders', { key: 'immoscoop-dataplatform.colleciones.orders', label: 'All orders' })],
    });
    expect((await byKey()).agency_orders?.displayName).toBe('All orders (compilacion_colleciones_dbt)');
  });

  it('adds Resources to one Collection in one go, never moves them, logs both sides and tells the Owner (FR-CO-07, FR-CO-08, FR-CO-11, FR-CO-31)', async () => {
    const leads = await collections.create({ name: 'Leads', description: 'Leads.', icon: 'coins', ownerUnit: DIGIKOM, visibility: 'private' }, dirk);
    const other = await collections.create({ name: 'Other', description: 'Other.', icon: 'globe', ownerUnit: DIGIKOM, visibility: 'private' }, dirk);
    await resources.apply(prod('103', [orders, table('customers')]));
    const { orders: ordersResource, customers } = await byKey();
    const order = ordersResource!;

    const message = () =>
      database.db.selectFrom('messages').select('state').where('type', '=', 'MSG-RES-01').where('subjectId', '=', order.id).executeTakeFirstOrThrow();
    expect((await message()).state).toBe('waiting');
    // One that cannot be added stops them all.
    const missing = '00000000-0000-4000-8000-000000000000';
    expect(await resources.add([{ id: order.id }, { id: missing }], leads, dirk)).toEqual({ outcome: 'not_found', ids: [missing] });
    expect(await resources.add([{ id: order.id }, { id: 'not-a-uuid' }], leads, dirk)).toEqual({ outcome: 'not_found', ids: ['not-a-uuid'] });
    expect(await resources.add([{ id: customers!.id }], other, dirk)).toEqual({ outcome: 'added', added: 1 });
    expect(await resources.add([{ id: order.id }, { id: customers!.id }], leads, dirk)).toEqual({ outcome: 'in_another_collection', ids: [customers!.id] });
    expect((await message()).state).toBe('waiting');

    expect(await resources.add([{ id: order.id }], leads, dirk)).toEqual({ outcome: 'added', added: 1 });
    // The Message to the Data Team has done what it asked (MSG-RES-01), and the Owner is told (MSG-RES-08, DEC-CV-11).
    expect((await message()).state).toBe('inCollection');
    const arrived = await database.db.selectFrom('messages').select(['subjectKind', 'writerId', 'params', 'state']).where('type', '=', 'MSG-RES-08').where('subjectId', '=', order.id).execute();
    expect(arrived).toEqual([{ subjectKind: 'resource', writerId: null, params: { collection: 'Leads', actor: 'Dirk', level: '2' }, state: null }]);
    // Already in it: nothing changes, and nobody is told again.
    expect(await resources.add([{ id: order.id }], leads, dirk)).toEqual({ outcome: 'added', added: 0 });
    expect(await resources.add([{ id: order.id }], other, dirk)).toEqual({ outcome: 'in_another_collection', ids: [order.id] });
    const listed = await resources.inCollection(leads.id);
    expect(listed.map((resource) => resource.displayName)).toEqual(['Orders']);
    expect(listed[0]?.lastChange?.text).toBe('Added to the Collection Leads by Dirk');
    expect((await byKey()).orders).toBeUndefined();

    // A Collection that holds Resources, withdrawn ones too, cannot be dissolved (FR-CO-10).
    await expect(collections.dissolve(leads.id, dirk)).rejects.toThrow(NotEmpty);
    await resources.apply(prod('104', [table('customers')]));
    expect((await resources.inCollection(leads.id))[0]).toMatchObject({ displayName: 'Orders', withdrawn: true });
    await expect(collections.dissolve(leads.id, dirk)).rejects.toThrow('The Collection still holds 1 Resource; the Data Team removes them first.');

    expect(await resources.remove(order.id, dirk)).toBe(true);
    // Without a Collection, it waits for one again.
    expect((await message()).state).toBe('waiting');
    expect(await resources.remove(order.id, dirk)).toBe(false);
    expect(await collections.dissolve(leads.id, dirk)).toBe(true);
    expect(await resources.add([{ id: order.id }], leads, dirk)).toEqual({ outcome: 'collection_gone' });

    expect((await collections.log({ id: leads.id, canManage: true }, 50)).map((entry) => entry.text).slice(0, 3)).toEqual([
      'Collection dissolved by Dirk',
      'Orders removed by Dirk',
      'Orders added by Dirk',
    ]);
    expect((await texts(order.id)).slice(0, 3)).toEqual([
      'Removed from the Collection Leads by Dirk',
      'Withdrawn: no exposure with the tag datahub depends on it any more',
      'Added to the Collection Leads by Dirk',
    ]);
  });

  it('records how a Resource is stored, its grain, model type and mappings when it is added, and logs them (FR-CO-33, FR-CO-34)', async () => {
    const credit = await collections.create({ name: 'Credit', description: 'Credit.', icon: 'coins', ownerUnit: DIGIKOM, visibility: 'private' }, dirk);
    await resources.apply(prod('105', [table('simulations'), table('reviews')]));
    const { simulations, reviews } = await byKey();
    const details: Details = {
      partition: { field: 'created_at', unit: 'day' },
      clusterBy: ['simulations_id'],
      partitionFilter: 'bigQuery',
      grain: ['simulations_id'],
      grainSentence: 'generated simulation',
      modelType: 'event',
      origins: { partition: 'dbt', clusterBy: 'dbt', partitionFilter: 'dbt', grain: 'domainModel', grainSentence: 'here', modelType: 'domainModel' },
      release: '0.0.70',
      mappings: [{ field: 'simulations_id', kind: 'is', relationType: null, identity: 'homeLoanSimulation.homeLoanSimulationId', subject: null, origin: 'domainModel', inDomainModel: true }],
    };
    // A field the Resource does not have stops them all.
    const wrong = await resources.add([{ id: simulations!.id, details }, { id: reviews!.id, details: { ...details, grain: ['nope'] } }], credit, dirk);
    expect(wrong).toMatchObject({ outcome: 'invalid', id: reviews!.id });
    expect((await resources.get(simulations!.id))?.collectionId).toBeNull();

    expect(await resources.add([{ id: simulations!.id, details }, { id: reviews!.id }], credit, dirk)).toEqual({ outcome: 'added', added: 2 });
    expect((await resources.detail(simulations!.id))?.details).toEqual({ ...details, mappings: details.mappings });
    expect((await texts(simulations!.id))[0]).toBe('Grain and mappings recorded by Dirk: 1 of 2 fields mapped');
    // Added without them: nothing recorded, and no entry that says so.
    expect((await resources.detail(reviews!.id))?.details).toMatchObject({ grain: [], partition: null, mappings: [], partitionFilter: 'none' });
    expect((await texts(reviews!.id))[0]).toBe('Added to the Collection Credit by Dirk');
  });

  it('checks what was recorded against the fields of the Resource (FR-CO-33, DEC-RC-08)', () => {
    const base: Details = { partition: null, clusterBy: [], partitionFilter: 'none', grain: [], grainSentence: '', modelType: null, origins: {}, release: null, mappings: [] };
    const is = { kind: 'is' as const, relationType: null, subject: null, origin: 'here' as const, inDomainModel: true };
    expect(checkDetails({ ...base, grain: ['a'] }, ['a', 'b'])).toBeUndefined();
    expect(checkDetails({ ...base, clusterBy: ['c'] }, ['a'])).toBe('it has no field c.');
    expect(checkDetails({ ...base, mappings: [{ field: 'a', identity: 'x.a', ...is }, { field: 'a', identity: 'x.b', ...is }] }, ['a'])).toBe('the field a maps twice.');
    expect(
      checkDetails({ ...base, mappings: [{ field: 'b', kind: 'relation', relationType: 'basedOn', identity: 'y.b', subject: 'a', origin: 'here', inDomainModel: true }] }, ['a', 'b']),
    ).toBe('the relation of b starts from a, which is not mapped as is.');
  });

  it('never lets a Log Entry of a Resource be changed or removed (FR-SR-11)', async () => {
    await expect(sql`update resource_log set log_id = 'RES-004'`.execute(database.db)).rejects.toThrow(/append-only/);
    await expect(sql`delete from resource_log`.execute(database.db)).rejects.toThrow(/append-only/);
  });
});

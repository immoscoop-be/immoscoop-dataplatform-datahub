import { randomBytes } from 'node:crypto';
import { startingPermissions } from '@datahub/contracts';
import { createDatabase, migrate, type Database } from '@datahub/db';
import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Collections, createCollections, NotEmpty, type Viewer } from './collections.js';
import type { CatalogueDatabase } from './database.js';
import { migrations } from './migrations/index.js';
import {
  checkDetails,
  createResources,
  type Details,
  type ExposedTable,
  incomplete,
  missingSentence,
  type Resources,
  type ResourcesUpdate,
  whatDetailsChange,
} from './resources.js';

const url = process.env.DATAHUB_TEST_DATABASE_URL;
if (!url && process.env.CI) {
  throw new Error('DATAHUB_TEST_DATABASE_URL must be set in CI');
}

const dirk: Viewer = { id: 'u-dt', name: 'Dirk', groups: [], permissions: startingPermissions('admin') };
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
    expect(outcome).toEqual({ applied: true, registered: 2, renamed: 0, withdrawn: 0, back: 0, changed: [] });
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
    const outcome = await resources.apply(
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
    // Its fields were removed and others added: what reads it is checked (FR-SR-52); the others did not change.
    expect(outcome.changed).toEqual([visits.id]);
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

  it('renames, refreshes, withdraws and brings back, with the whole state of the project each time (FR-SR-33, FR-SR-34, DEC-SR-45)', async () => {
    const before = await byKey();
    // The label changes, the description too, and customers and visits are no longer exposed.
    const withdrawing = await resources.apply(prod('101', [table('orders', { label: 'All orders', description: 'Every order.' })]));
    let known = await byKey();
    expect(known.orders).toMatchObject({ displayName: 'All orders', description: 'Every order.' });
    // Withdrawn, they wait for nothing and leave the list without a Collection, but are held (DEC-SR-26, DEC-SR-45).
    expect(known.customers).toBeUndefined();
    expect(known.visits).toBeUndefined();
    expect(await resources.get(before.customers!.id)).toMatchObject({ name: 'customers', collectionId: null, withdrawn: true });
    // What reads a Resource that was withdrawn, or comes back, is checked; a new label or description changes nothing it reads (FR-SR-52).
    expect(withdrawing.changed.sort()).toEqual([before.customers!.id, before.visits!.id].sort());

    // customers comes back as it was, and waits for a Collection again.
    const outcome = await resources.apply(prod('102', [table('orders', { label: 'All orders' }), table('customers')]));
    expect(outcome).toMatchObject({ registered: 0, renamed: 0, withdrawn: 0, back: 1 });
    known = await byKey();
    expect(known.customers).toMatchObject({ id: before.customers!.id, withdrawn: false });
    expect(outcome.changed).toEqual([known.customers!.id]);
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
    expect(arrived).toEqual([{ subjectKind: 'resource', writerId: null, params: { collection: 'Leads', actor: 'Dirk', actorId: 'u-dt', level: '2' }, state: null }]);
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
    // Its Owner hears that it was withdrawn (MSG-RES-06); one without a Collection tells nobody.
    const withdrawn = await database.db.selectFrom('messages').select(['subjectId', 'writerId', 'params']).where('type', '=', 'MSG-RES-06').execute();
    expect(withdrawn).toEqual([{ subjectId: order.id, writerId: null, params: { run: '2026-10-26' } }]);
    await expect(collections.dissolve(leads.id, dirk)).rejects.toThrow('The Collection still holds 1 Resource; the Data Team removes them first.');

    expect(await resources.remove(order.id, dirk)).toBe(true);
    // Without a Collection, it waits for one again.
    expect((await message()).state).toBe('waiting');
    expect(await resources.remove(order.id, dirk)).toBe(false);
    expect(await collections.dissolve(leads.id, dirk)).toBe(true);
    expect(await resources.add([{ id: order.id }], leads, dirk)).toEqual({ outcome: 'collection_gone' });

    expect((await collections.log(leads, dirk, 50)).map((entry) => entry.text).slice(0, 3)).toEqual([
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
      typeFields: [{ field: 'created_at', role: 'happenedAt', origin: 'dbt' }],
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

  it('keeps how a Resource is stored as dbt says while it waits for a Collection, and what a Data Admin recorded after (DEC-SR-34)', async () => {
    const credit = await collections.create({ name: 'Events', description: 'Events.', icon: 'coins', ownerUnit: DIGIKOM, visibility: 'private' }, dirk);
    const stored = { partition: { field: 'created_at', unit: 'day' as const }, clusterBy: ['events_id'], requirePartitionFilter: true };
    await resources.apply(prod('106', [table('simulations'), table('reviews'), table('events', { storage: stored })]));
    const { events } = await byKey();
    // Waiting for a Collection, a Preview already filters on its partition column, as dbt says.
    expect((await resources.detail(events!.id))?.details).toMatchObject({
      partition: { field: 'created_at', unit: 'day' },
      clusterBy: ['events_id'],
      partitionFilter: 'bigQuery',
      origins: { partition: 'dbt', clusterBy: 'dbt', partitionFilter: 'dbt' },
    });
    // dbt changes it while it still waits: Data Hub follows.
    await resources.apply(prod('107', [table('simulations'), table('reviews'), table('events', { storage: { ...stored, requirePartitionFilter: false } })]));
    expect((await resources.detail(events!.id))?.details).toMatchObject({ partitionFilter: 'none' });
    // A Data Admin adds it and records what holds; dbt no longer changes that.
    const details: Details = {
      partition: { field: 'created_at', unit: 'month' },
      clusterBy: [],
      partitionFilter: 'dataHub',
      grain: ['events_id'],
      grainSentence: '',
      modelType: 'event',
      typeFields: [{ field: 'created_at', role: 'happenedAt', origin: 'here' }],
      origins: { partition: 'here', partitionFilter: 'here' },
      release: null,
      mappings: [],
    };
    expect(await resources.add([{ id: events!.id, details }], credit, dirk)).toEqual({ outcome: 'added', added: 1 });
    await resources.apply(prod('108', [table('simulations'), table('reviews'), table('events', { storage: stored })]));
    expect((await resources.detail(events!.id))?.details).toMatchObject({ partition: { field: 'created_at', unit: 'month' }, clusterBy: [], partitionFilter: 'dataHub' });
    // A registry that does not send it yet changes nothing.
    await resources.apply(prod('109', [table('simulations'), table('reviews'), table('events')]));
    expect((await resources.detail(events!.id))?.details).toMatchObject({ partition: { field: 'created_at', unit: 'month' } });
  });

  it('checks what was recorded against the fields of the Resource (FR-CO-33, DEC-RC-08)', () => {
    const base: Details = { partition: null, clusterBy: [], partitionFilter: 'none', grain: [], grainSentence: '', modelType: null, typeFields: [], origins: {}, release: null, mappings: [] };
    const is = { kind: 'is' as const, relationType: null, subject: null, origin: 'here' as const, inDomainModel: true };
    const named = (...names: string[]) => names.map((name) => ({ name, dataType: 'STRING' }));
    expect(checkDetails({ ...base, grain: ['a'] }, named('a', 'b'))).toBeUndefined();
    expect(checkDetails({ ...base, clusterBy: ['c'] }, named('a'))).toBe('it has no field c.');
    expect(checkDetails({ ...base, mappings: [{ field: 'a', identity: 'x.a', ...is }, { field: 'a', identity: 'x.b', ...is }] }, named('a'))).toBe('the field a maps twice.');
    expect(
      checkDetails({ ...base, mappings: [{ field: 'b', kind: 'relation', relationType: 'basedOn', identity: 'y.b', subject: 'a', origin: 'here', inDomainModel: true }] }, named('a', 'b')),
    ).toBe('the relation of b starts from a, which is not mapped as is.');
  });

  it('checks the fields of the model type: a field of the Resource, a role of its model type that fits the field (FR-CO-44)', () => {
    const base: Details = { partition: null, clusterBy: [], partitionFilter: 'none', grain: [], grainSentence: '', modelType: 'event', typeFields: [], origins: {}, release: null, mappings: [] };
    const fields = [
      { name: 'lead_id', dataType: 'STRING' },
      { name: 'sent_at', dataType: 'TIMESTAMP' },
      { name: 'amount', dataType: 'NUMERIC(10, 2)' },
    ];
    const held = (field: string, role: Details['typeFields'][number]['role']) => ({ field, role, origin: 'here' as const });
    expect(checkDetails({ ...base, typeFields: [held('sent_at', 'happenedAt')] }, fields)).toBeUndefined();
    // A field the Resource does not have is a stranger, as for the grain.
    expect(checkDetails({ ...base, typeFields: [held('sent_on', 'happenedAt')] }, fields)).toBe('it has no field sent_on.');
    // A role of another model type, a field whose type does not fit, a role that takes one field held twice.
    expect(checkDetails({ ...base, typeFields: [held('lead_id', 'about')] }, fields)).toBe('an event has no role about.');
    expect(checkDetails({ ...base, typeFields: [held('lead_id', 'happenedAt')] }, fields)).toBe('the field lead_id does not fit the role happenedAt.');
    expect(checkDetails({ ...base, modelType: 'fact', typeFields: [held('amount', 'measure'), held('amount', 'occurredAt')] }, fields)).toBe('the field amount holds more than one role.');
    expect(checkDetails({ ...base, modelType: null, typeFields: [held('sent_at', 'happenedAt')] }, fields)).toBe('without a model type, sent_at holds no role.');
    // A role recorded before on a field that left the Resource since may stay as it was: it shows as gone (DEC-RC-23).
    const before = [{ field: 'sent_on', role: 'happenedAt' as const }];
    expect(checkDetails({ ...base, typeFields: [held('sent_on', 'happenedAt')] }, fields, before)).toBeUndefined();
    expect(checkDetails({ ...base, typeFields: [held('sent_on', 'happenedAt')] }, fields, [{ field: 'sent_on', role: 'measure' }])).toBe('it has no field sent_on.');
  });

  it('says what the model type still misses before a Resource is added with it (FR-CO-44)', () => {
    const base: Details = { partition: null, clusterBy: [], partitionFilter: 'none', grain: [], grainSentence: '', modelType: null, typeFields: [], origins: {}, release: null, mappings: [] };
    const fields = [
      { name: 'source', dataType: 'STRING' },
      { name: 'week_start', dataType: 'DATE' },
      { name: 'lead_count', dataType: 'INT64' },
      { name: 'visitors', dataType: 'INT64' },
    ];
    expect(incomplete(base, fields)).toBe('it has no model type yet.');
    expect(incomplete({ ...base, modelType: 'event' }, fields)).toBe('its model type event still asks for a field as happenedAt.');
    expect(incomplete({ ...base, modelType: 'other' }, fields)).toBe('its model type other still asks for the sentence of One row per.');
    expect(incomplete({ ...base, modelType: 'other', grainSentence: 'lead source per week' }, fields)).toBeUndefined();
    const aggregate: Details = { ...base, modelType: 'aggregate', typeFields: [{ field: 'source', role: 'groupedBy', origin: 'here' }, { field: 'lead_count', role: 'addsUp', origin: 'here' }] };
    expect(incomplete(aggregate, fields)).toBe('its model type aggregate still asks for the number visitors marked as addsUp or uniqueCount.');
    expect(incomplete({ ...aggregate, typeFields: [...aggregate.typeFields, { field: 'visitors', role: 'uniqueCount', origin: 'here' }] }, fields)).toBeUndefined();
    expect(missingSentence('state', [{ kind: 'role', role: 'about' }, { kind: 'role', role: 'createdAt' }, { kind: 'role', role: 'updatedAt' }])).toBe(
      'its model type state still asks for a field as about, a field as createdAt and a field as updatedAt.',
    );
    expect(missingSentence('event', [])).toBeUndefined();
  });

  it('tells apart what changes of the grain and storage, and what of the Entity mapping (DEC-PL-03)', () => {
    const base: Details = { partition: null, clusterBy: [], partitionFilter: 'none', grain: [], grainSentence: '', modelType: null, typeFields: [], origins: { grain: 'here', modelType: 'dbt' }, release: null, mappings: [] };
    const is = { kind: 'is' as const, relationType: null, subject: null, origin: 'here' as const, inDomainModel: true };
    const mapped: Details = { ...base, release: '0.0.70', mappings: [{ field: 'b', identity: 'x.b', ...is }, { field: 'a', identity: 'x.a', ...is }] };
    expect(whatDetailsChange(base, { ...base, origins: { modelType: 'dbt', grain: 'here' } })).toEqual({ assigned: false, mapped: false });
    expect(whatDetailsChange(base, { ...base, grain: ['a'] })).toEqual({ assigned: true, mapped: false });
    // A partition filter counts only with a partition.
    expect(whatDetailsChange(base, { ...base, partitionFilter: 'dataHub' })).toEqual({ assigned: false, mapped: false });
    expect(whatDetailsChange(base, mapped)).toEqual({ assigned: false, mapped: true });
    // The same mappings in another order are the same.
    expect(whatDetailsChange(mapped, { ...mapped, mappings: [...mapped.mappings].reverse() })).toEqual({ assigned: false, mapped: false });
    expect(whatDetailsChange(mapped, { ...base, modelType: 'fact' })).toEqual({ assigned: true, mapped: true });
    // The fields of the model type are the work of a Data Admin, in any order the same (FR-CO-44).
    const typed: Details = { ...base, modelType: 'fact', typeFields: [{ field: 'a', role: 'occurredAt', origin: 'here' }, { field: 'b', role: 'measure', origin: 'here' }] };
    expect(whatDetailsChange(typed, { ...typed, typeFields: [...typed.typeFields].reverse() })).toEqual({ assigned: false, mapped: false });
    expect(whatDetailsChange(typed, { ...typed, typeFields: typed.typeFields.slice(1) })).toEqual({ assigned: true, mapped: false });
    expect(whatDetailsChange(typed, { ...typed, typeFields: [{ ...typed.typeFields[0]!, origin: 'domainModel' }, typed.typeFields[1]!] })).toEqual({ assigned: true, mapped: false });
  });

  it('logs every Change upstream in each Resource it reaches, with its distance, and tells the Owner of new code once (FR-AR-12, EC-AR-04, MSG-RES-04)', async () => {
    const other = (runId: string, tables: ExposedTable[], changes?: ResourcesUpdate['changes']): ResourcesUpdate => ({
      projectId: '4242',
      projectName: 'colleciones',
      runId,
      generatedAt: '2026-10-30T06:00:00Z',
      tables,
      ...(changes ? { changes } : {}),
    });
    const funnel = table('funnel_upstream');
    const report = table('report_upstream');
    await resources.apply(other('1', [funnel, report]));
    const { funnel_upstream: funnelResource, report_upstream: reportResource } = await byKey();
    const team = await collections.create({ name: 'Funnels', description: 'Funnels.', icon: 'funnel', ownerUnit: DIGIKOM, visibility: 'private' }, dirk);
    await resources.add([{ id: reportResource!.id }], team, dirk);

    await resources.apply(
      other('2', [funnel, report], [
        { kind: 'logic', node: 'stg_leads', reaches: [{ nodeId: funnel.nodeId, distance: 2 }, { nodeId: report.nodeId, distance: 3 }] },
        { kind: 'logic', node: 'int_leads', reaches: [{ nodeId: report.nodeId, distance: 1 }] },
        { kind: 'structural', node: 'stg_leads', field: 'channel', direction: 'removed', reaches: [{ nodeId: report.nodeId, distance: 3 }] },
        { kind: 'type', node: 'stg_leads', field: 'amount', old: 'INT64', new: 'NUMERIC', reaches: [{ nodeId: report.nodeId, distance: 3 }] },
        { kind: 'description', node: 'raw_leads', reaches: [{ nodeId: report.nodeId, distance: 4 }] },
        { kind: 'removed', node: 'old_leads', reaches: [{ nodeId: report.nodeId, distance: 2 }] },
        { kind: 'added', node: 'new_leads', reaches: [{ nodeId: report.nodeId, distance: 1 }] },
        // A table that is no Resource is passed over.
        { kind: 'logic', node: 'stg_visits', reaches: [{ nodeId: 'model.immoscoop_dataplatform_sql.nobody', distance: 1 }] },
      ]),
    );
    const logged = (await texts(reportResource!.id)).slice(0, 7);
    expect(logged).toEqual([
      'Model new_leads upstream was added',
      'Model old_leads upstream was removed',
      'Description changed in raw_leads',
      'Type of amount changed from INT64 to NUMERIC in stg_leads',
      'Structural change: field channel removed in stg_leads',
      'Logic change in int_leads',
      'Logic change in stg_leads',
    ]);
    expect(await texts(funnelResource!.id)).toContain('Logic change in stg_leads');
    // The Owner hears once per Artifact Set, of the nearest change of code; a Resource without a Collection has none.
    const told = await database.db.selectFrom('messages').select(['subjectId', 'params']).where('type', '=', 'MSG-RES-04').execute();
    expect(told).toEqual([{ subjectId: reportResource!.id, params: { run: '2026-10-30', node: 'int_leads', distance: '1' } }]);
  });

  it('records the fields of its model type, refuses a Resource whose model type misses one, and lists those to complete (FR-CO-44, FR-CO-45)', async () => {
    const typed = (runId: string, tables: ExposedTable[]): ResourcesUpdate => ({ projectId: '5151', projectName: 'typed', runId, generatedAt: '2026-11-15T06:00:00Z', tables });
    const weekly = table('weekly_leads', {
      columns: [
        { name: 'lead_source', position: 1, dataType: 'STRING', description: 'The source.' },
        { name: 'week_start', position: 2, dataType: 'DATE', description: '' },
        { name: 'lead_count', position: 3, dataType: 'INT64', description: '' },
        { name: 'visitors', position: 4, dataType: 'INT64', description: '' },
      ],
    });
    await resources.apply(typed('1', [weekly, table('leads_sent'), table('older_leads')]));
    const { weekly_leads: weeklyLeads, leads_sent: leadsSent, older_leads: olderLeads } = await byKey();
    const typedCollection = await collections.create({ name: 'Typed', description: 'Typed.', icon: 'coins', ownerUnit: DIGIKOM, visibility: 'private' }, dirk);
    const base: Details = { partition: null, clusterBy: [], partitionFilter: 'none', grain: [], grainSentence: '', modelType: null, typeFields: [], origins: {}, release: null, mappings: [] };
    const aggregate: Details = {
      ...base,
      grain: ['lead_source', 'week_start'],
      grainSentence: 'lead source per week',
      modelType: 'aggregate',
      typeFields: [
        { field: 'visitors', role: 'uniqueCount', origin: 'here' },
        { field: 'week_start', role: 'period', origin: 'dbt' },
        { field: 'lead_source', role: 'groupedBy', origin: 'here' },
        { field: 'lead_count', role: 'addsUp', origin: 'here' },
      ],
    };
    const adding = (details: Details, id = weeklyLeads!.id) => resources.add([{ id, details }], typedCollection, dirk);
    // Recorded without a model type, or with one that misses a field it asks for, it is not added (FR-CO-44).
    expect(await adding(base)).toEqual({ outcome: 'invalid', id: weeklyLeads!.id, message: 'weekly_leads: it has no model type yet.' });
    expect(await adding({ ...aggregate, typeFields: aggregate.typeFields.slice(1) })).toEqual({
      outcome: 'invalid',
      id: weeklyLeads!.id,
      message: 'weekly_leads: its model type aggregate still asks for the number visitors marked as addsUp or uniqueCount.',
    });
    // A role of another model type, a field that does not fit its role, a field it does not have.
    const event = (typeFields: Details['typeFields']): Details => ({ ...base, modelType: 'event', typeFields });
    expect(await adding(event([{ field: 'created_at', role: 'createdAt', origin: 'here' }]), leadsSent!.id)).toMatchObject({ message: 'leads_sent: an event has no role createdAt.' });
    expect(await adding(event([{ field: 'leads_sent_id', role: 'happenedAt', origin: 'here' }]), leadsSent!.id)).toMatchObject({
      message: 'leads_sent: the field leads_sent_id does not fit the role happenedAt.',
    });
    expect(await adding(event([{ field: 'sent_at', role: 'happenedAt', origin: 'here' }]), leadsSent!.id)).toMatchObject({ message: 'leads_sent: it has no field sent_at.' });
    expect((await resources.get(weeklyLeads!.id))?.collectionId).toBeNull();

    // Complete, it is added; one sent by its ID alone is added as before, and is to complete (DEC-CO-27).
    expect(await resources.add([{ id: weeklyLeads!.id, details: aggregate }, { id: olderLeads!.id }], typedCollection, dirk)).toEqual({ outcome: 'added', added: 2 });
    const weeklyDetail = await resources.detail(weeklyLeads!.id);
    // Kept in the order of the fields.
    expect(weeklyDetail?.details.typeFields).toEqual([
      { field: 'lead_source', role: 'groupedBy', origin: 'here' },
      { field: 'week_start', role: 'period', origin: 'dbt' },
      { field: 'lead_count', role: 'addsUp', origin: 'here' },
      { field: 'visitors', role: 'uniqueCount', origin: 'here' },
    ]);
    expect(weeklyDetail?.typeState).toEqual({ missing: [], gone: [] });
    expect((await resources.detail(olderLeads!.id))?.typeState).toEqual({ missing: [{ kind: 'modelType' }], gone: [] });
    const toComplete = async () => (await resources.toComplete()).filter((resource) => resource.collection.id === typedCollection.id);
    expect(await toComplete()).toEqual([
      { id: olderLeads!.id, displayName: 'older_leads', collection: { id: typedCollection.id, name: 'Typed' }, level: 2, missing: [{ kind: 'modelType' }], gone: [] },
    ]);
    // Of every Collection, each missing something, by Display Name: reviews was added to Credit by its ID alone.
    const listed = await resources.toComplete();
    expect(listed.find((resource) => resource.displayName === 'reviews')).toMatchObject({ collection: { name: 'Credit' }, missing: [{ kind: 'modelType' }] });
    expect(listed.every((resource) => resource.missing.length > 0)).toBe(true);
    expect(listed.map((resource) => resource.displayName.toLowerCase())).toEqual(listed.map((resource) => resource.displayName.toLowerCase()).sort());

    // Its mappings change without completing it, as the Entity mapping of an Owner Unit does; the work of a Data Admin completes it.
    const mapping = { field: 'older_leads_id', kind: 'is' as const, relationType: null, identity: 'lead.leadId', subject: null, origin: 'here' as const, inDomainModel: true };
    expect(await resources.relate(olderLeads!.id, { ...base, mappings: [mapping] }, dirk)).toEqual({ outcome: 'edited', changed: ['details'] });
    expect(await resources.relate(olderLeads!.id, { ...base, grain: ['older_leads_id'] }, dirk, true)).toEqual({ outcome: 'invalid', message: 'older_leads: it has no model type yet.' });
    const happened = event([{ field: 'created_at', role: 'happenedAt', origin: 'here' }]);
    expect(await resources.relate(olderLeads!.id, { ...happened, mappings: [mapping] }, dirk, true)).toEqual({ outcome: 'edited', changed: ['details'] });
    expect(await toComplete()).toEqual([]);
    // Another model type drops the fields of the old one (DEC-RC-22).
    expect(await resources.relate(weeklyLeads!.id, { ...aggregate, modelType: 'other', typeFields: [] }, dirk, true)).toEqual({ outcome: 'edited', changed: ['details'] });
    expect((await resources.detail(weeklyLeads!.id))?.details).toMatchObject({ modelType: 'other', typeFields: [] });
  });

  it('warns when a field of its model type is gone, tells the Data Team once, and keeps the Level (FR-RC-29, DEC-RC-23, MSG-RES-09)', async () => {
    const typed = (runId: string, tables: ExposedTable[]): ResourcesUpdate => ({ projectId: '5151', projectName: 'typed', runId, generatedAt: '2026-11-16T06:00:00Z', tables });
    const renamed = table('older_leads', {
      columns: [
        { name: 'older_leads_id', position: 1, dataType: 'STRING', description: 'The older_leads.' },
        { name: 'sent_at', position: 2, dataType: 'TIMESTAMP', description: '' },
      ],
    });
    const { id } = (await resources.inCollection((await collections.list(dirk)).find((collection) => collection.name === 'Typed')!.id)).find((resource) => resource.name === 'older_leads')!;
    // created_at, which says when it happened, is renamed to sent_at in dbt.
    await resources.apply(typed('2', [table('weekly_leads'), table('leads_sent'), renamed]));
    const told = () => database.db.selectFrom('messages').select(['type', 'writerId', 'params', 'state']).where('subjectId', '=', id).where('type', '=', 'MSG-RES-09').execute();
    expect(await told()).toEqual([
      {
        type: 'MSG-RES-09',
        writerId: null,
        params: { run: '2026-11-16', modelType: 'event', level: '2', count: '1', gone: JSON.stringify([{ field: 'created_at', role: 'happenedAt' }]) },
        state: null,
      },
    ]);
    const detail = await resources.detail(id);
    expect(detail?.level).toBe(2);
    // The role stays as recorded, and shows as gone and missing until a field holds it again.
    expect(detail?.details.typeFields).toEqual([{ field: 'created_at', role: 'happenedAt', origin: 'here' }]);
    expect(detail?.typeState).toEqual({ missing: [{ kind: 'role', role: 'happenedAt' }], gone: [{ field: 'created_at', role: 'happenedAt' }] });
    expect((await resources.toComplete()).find((resource) => resource.id === id)).toMatchObject({ missing: [{ kind: 'role', role: 'happenedAt' }], gone: [{ field: 'created_at', role: 'happenedAt' }] });
    // Once per Artifact Set: the next run that does not change it tells nobody again.
    await resources.apply(typed('3', [table('weekly_leads'), table('leads_sent'), renamed]));
    expect(await told()).toHaveLength(1);

    // What else changes keeps the role as it is; another field takes it, and the warning goes.
    const kept: Details = { ...detail!.details, grainSentence: 'one lead' };
    expect(await resources.relate(id, kept, dirk)).toEqual({ outcome: 'edited', changed: ['details'] });
    expect(await resources.relate(id, kept, dirk, true)).toEqual({ outcome: 'invalid', message: 'older_leads: its model type event still asks for a field as happenedAt.' });
    expect(await resources.relate(id, { ...kept, typeFields: [{ field: 'sent_at', role: 'happenedAt', origin: 'here' }] }, dirk, true)).toEqual({ outcome: 'edited', changed: ['details'] });
    expect((await resources.detail(id))?.typeState).toEqual({ missing: [], gone: [] });
    // A withdrawn Resource is not to complete.
    await resources.relate(id, { ...kept, typeFields: [] }, dirk);
    expect((await resources.toComplete()).map((resource) => resource.id)).toContain(id);
    await resources.apply(typed('4', [table('weekly_leads'), table('leads_sent')]));
    expect((await resources.toComplete()).map((resource) => resource.id)).not.toContain(id);
  });

  it('makes a Confirmed Resource Explored while its EDA-Setup is complete, keeps it so, and drops it to Confirmed when its EDA goes (TR-ED-05, DEC-MR-21, FR-MR-22, FR-MR-07)', async () => {
    const run = (runId: string, extra: Partial<ExposedTable> = {}): ResourcesUpdate => ({
      projectId: '7272',
      projectName: 'explored',
      runId,
      generatedAt: '2026-11-21T06:00:00Z',
      tables: [table('explored_leads', extra)],
    });
    await resources.apply(run('1'));
    const collection = await collections.create({ name: 'Explored', description: 'Explored.', icon: 'globe', ownerUnit: DIGIKOM, visibility: 'private' }, dirk);
    const { id } = (await resources.withoutCollection()).find((resource) => resource.name === 'explored_leads')!;
    expect(await resources.add([{ id }], collection, dirk)).toEqual({ outcome: 'added', added: 1 });
    const level = async () => (await resources.detail(id))!;
    const dropped = () => database.db.selectFrom('messages').select('params').where('subjectId', '=', id).where('type', '=', 'MSG-RES-05').orderBy('createdAt').execute();
    const levels = async () => (await resources.log(id, 50)).filter((entry) => ['RES-002', 'MAT-021'].includes(entry.logId)).map((entry) => [entry.logId, entry.params]);

    // Below 3 · Confirmed it is kept, and nothing rises yet; never explored, it is never 4 (DEC-MR-21).
    expect(await resources.explore(id, true)).toEqual({ outcome: 'done', explored: true, level: 2 });
    expect(await resources.explore(id, false)).toEqual({ outcome: 'done', explored: false, level: 2 });
    expect(await levels()).toEqual([['RES-002', { level: '2', reason: 'described' }]]);

    // Confirmed, as its Publication leaves it; a new Current Version keeps it at 3 · Confirmed, not explored.
    await database.db
      .insertInto('resourceConfirmations')
      .values({ resourceId: id, ownerId: 'u-an', ownerName: 'An', structure: 's', types: 't', descriptions: 'd', code: null, fields: '[]', declaration: null })
      .execute();
    await database.db.updateTable('resources').set({ level: 3, publishedAt: new Date(), publishedBy: 'An' }).where('id', '=', id).execute();
    await resources.apply(run('2'));
    expect(await level()).toMatchObject({ level: 3, explored: false });

    // The EDA-Setup complete: 4 · Explored, in its Log (FR-ED-12). Said again, as after an EDA-Rerun, nothing changes.
    expect(await resources.explore(id, true)).toEqual({ outcome: 'done', explored: true, level: 4 });
    expect(await level()).toMatchObject({ level: 4, explored: true });
    expect((await resources.log(id, 1))[0]).toMatchObject({ logId: 'RES-002', text: 'Maturity assessed at Level 4', params: { level: '4', reason: 'eda' } });
    const logged = (await resources.log(id, 50)).length;
    expect(await resources.explore(id, true)).toEqual({ outcome: 'done', explored: true, level: 4 });
    expect(await resources.log(id, 50)).toHaveLength(logged);

    // Whenever the Level is worked out again it stays 4: a new Current Version, a field added (FR-MR-22).
    await resources.apply(run('3'));
    await resources.apply(run('4', { columns: [...table('explored_leads').columns, { name: 'channel', position: 3, dataType: 'STRING', description: '' }] }));
    expect((await level()).level).toBe(4);
    // Without a description in dbt it drops to Available, as any Resource does; with it back, it is Explored again.
    await resources.apply(run('5', { description: '' }));
    expect(await level()).toMatchObject({ level: 1, explored: true });
    expect(await dropped()).toEqual([{ params: { from: '4', to: '1', cause: 'description', published: 'yes' } }]);
    await resources.apply(run('6'));
    expect((await level()).level).toBe(4);

    // Its EDA gone: back to 3 · Confirmed, with MAT-021 and the Message of a Level that drops, cause eda (MSG-RES-05).
    expect(await resources.explore(id, false)).toEqual({ outcome: 'done', explored: false, level: 3 });
    expect((await resources.log(id, 1))[0]).toMatchObject({ logId: 'MAT-021', params: { level: '3', reason: 'eda' } });
    expect((await dropped()).at(-1)).toEqual({ params: { from: '4', to: '3', cause: 'eda', published: 'yes' } });
    // Not explored, a new Current Version never makes it 4.
    await resources.apply(run('7'));
    expect(await level()).toMatchObject({ level: 3, explored: false });
    expect(await levels()).toEqual([
      ['MAT-021', { level: '3', reason: 'eda' }],
      ['RES-002', { level: '4', reason: 'described' }],
      ['MAT-021', { level: '1', reason: 'table-undescribed' }],
      ['RES-002', { level: '4', reason: 'eda' }],
      ['RES-002', { level: '2', reason: 'described' }],
    ]);

    expect(await resources.explore('00000000-0000-4000-8000-000000000000', true)).toEqual({ outcome: 'not_found' });
    expect(await resources.explore('explored_leads', true)).toEqual({ outcome: 'not_found' });
  });

  it('never lets a Log Entry of a Resource be changed or removed (FR-SR-11)', async () => {
    await expect(sql`update resource_log set log_id = 'RES-004'`.execute(database.db)).rejects.toThrow(/append-only/);
    await expect(sql`delete from resource_log`.execute(database.db)).rejects.toThrow(/append-only/);
  });
});

describe.skipIf(!url)('the full name of a table, in its own case', () => {
  const schema = `catalogue_full_name_${randomBytes(4).toString('hex')}`;
  let database: Database<CatalogueDatabase>;
  let resources: Resources;

  beforeAll(async () => {
    database = createDatabase<CatalogueDatabase>({ connectionString: url }, schema);
    await migrate({ db: database.db as Kysely<unknown>, schema, migrations, serviceUser: 'postgres' });
    resources = createResources(database.db);
  });

  afterAll(async () => {
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(database.db);
    await database.close();
  });

  it('is kept next to the Key, also for a Resource registered before registry handed it over', async () => {
    const colleciones = (runId: string, tables: ExposedTable[]): ResourcesUpdate => ({ projectId: '17121', projectName: 'immoscoop_colleciones', runId, generatedAt: '2026-10-30T12:45:00Z', tables });
    const state = table('mrt_immoscoop__leadsource__state', { key: 'immoscoop-dataplatform.colleciones_dbt.mrt_immoscoop__leadsource__state' });
    await resources.apply(colleciones('500', [state]));
    const before = (await resources.withoutCollection()).find((one) => one.key === state.key);
    // Without it, the Key stands in, as before.
    expect(before?.fullName).toBe(state.key);

    const fullName = 'immoscoop-dataplatform.colleciones_dbt.mrt_immoscoop__leadSource__state';
    await resources.apply(colleciones('501', [{ ...state, fullName }]));
    const after = (await resources.withoutCollection()).find((one) => one.key === state.key);
    expect(after).toMatchObject({ id: before?.id, key: state.key, fullName });
  });
});

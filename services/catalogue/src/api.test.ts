import { randomBytes } from 'node:crypto';
import { TokenError } from '@datahub/auth';
import { createTestIssuer, type TestIssuer } from '@datahub/auth/testing';
import { createDatabase, migrate, type Database } from '@datahub/db';
import type { FastifyInstance } from 'fastify';
import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parse, parseAdd, parseUpdate } from './api.js';
import { buildApp } from './app.js';
import { createCollections } from './collections.js';
import type { CatalogueDatabase } from './database.js';
import { type Group, IdentityUnavailable } from './identity.js';
import { migrations } from './migrations/index.js';
import { createResources } from './resources.js';

const url = process.env.DATAHUB_TEST_DATABASE_URL;
if (!url && process.env.CI) {
  throw new Error('DATAHUB_TEST_DATABASE_URL must be set in CI');
}

const DIGIKOM: Group = { id: 'g-digikom', email: 'digikom@thenextimmoscoop.be', name: 'DigiKom' };
const SALES: Group = { id: 'g-sales', email: 'sales@thenextimmoscoop.be', name: 'Sales' };

describe('the fields of a Collection in a request', () => {
  const complete = { name: ' Leads ', description: 'Leads of the agencies.', icon: 'coins', ownerUnit: 'g-digikom' };

  it('needs all of them to create one, and is private unless said otherwise', () => {
    expect(parse(complete, true)).toEqual({ ...complete, name: 'Leads' });
    expect(parse({ ...complete, visibility: 'public' }, true)).toMatchObject({ visibility: 'public' });
    expect(parse({ ...complete, ownerUnit: undefined }, true)).toBe('A new Collection needs an Owner Unit.');
    expect(parse({ ...complete, icon: undefined }, true)).toBe('A new Collection needs an icon.');
  });

  it('needs at least one to change one', () => {
    expect(parse({ visibility: 'public' }, false)).toEqual({ visibility: 'public' });
    expect(parse({}, false)).toBe('Send at least one field to change.');
  });

  it('refuses what does not fit', () => {
    expect(parse([], true)).toMatch(/JSON object/);
    expect(parse({ ...complete, name: '  ' }, true)).toBe('The name has 1 to 80 characters.');
    expect(parse({ ...complete, description: 'x'.repeat(501) }, true)).toBe('The description has 1 to 500 characters.');
    expect(parse({ ...complete, colour: 'rose' }, true)).toBe('A Collection has no field colour.');
    expect(parse({ ...complete, visibility: 'secret' }, true)).toBe('The visibility is private or public.');
    expect(parse({ ...complete, ownerUnit: 'sales@thenextimmoscoop.be' }, true)).toBe('The Owner Unit is named by the ID of a group.');
    expect(parse({ ...complete, owner: 'me' }, true)).toBe('A Collection has no field owner.');
    const refused = 'The icon is the name of an icon of Phosphor that is not the logo of a brand.';
    expect(parse({ ...complete, icon: 'unicorn' }, true)).toBe(refused);
    expect(parse({ ...complete, icon: 'google-logo' }, true)).toBe(refused);
    expect(parse({ ...complete, icon: 'house-line' }, true)).toMatchObject({ icon: 'house-line' });
    // The icon is required: it cannot be taken away (DEC-CO-25).
    expect(parse({ icon: null }, false)).toBe(refused);
  });
});

describe('the Resources to add, in a request (FR-CO-31, FR-CO-33, FR-CO-34)', () => {
  const details = {
    partition: { field: 'created_at', unit: 'day' },
    clusterBy: ['listing_id'],
    partitionFilter: 'dataHub',
    grain: ['event_id'],
    grainSentence: ' generated simulation ',
    modelType: 'event',
    origins: { partition: 'dbt', grain: 'domainModel', grainSentence: 'here' },
    release: '0.0.70',
    mappings: [{ field: 'listing_id', kind: 'relation', relationType: 'basedOn', identity: 'listing.listingId', subject: 'event_id', origin: 'domainModel', inDomainModel: true }],
  };

  it('are IDs, or objects with what the Data Admin recorded', () => {
    expect(parseAdd({ resources: ['r1'] })).toEqual([{ id: 'r1' }]);
    expect(parseAdd({ resources: [{ id: 'r2', ...details }] })).toEqual([{ id: 'r2', details: { ...details, grainSentence: 'generated simulation' } }]);
  });

  it('refuses what does not fit', () => {
    expect(parseAdd({ resources: [] })).toMatch(/list of 1 to 200/);
    expect(parseAdd({ resources: [{ ...details }] })).toBe('Each Resource to add has its ID.');
    expect(parseAdd({ resources: [{ id: 'r', ...details, partition: null }] })).toMatch(/needs a partition/);
    expect(parseAdd({ resources: [{ id: 'r', ...details, clusterBy: ['a', 'b', 'c', 'd', 'e'] }] })).toMatch(/at most four/);
    expect(parseAdd({ resources: [{ id: 'r', ...details, modelType: 'cube' }] })).toMatch(/model type/);
    expect(parseAdd({ resources: [{ id: 'r', ...details, origins: { grain: 'guessed' } }] })).toMatch(/origins/);
    const mapping = details.mappings[0]!;
    for (const wrong of [{ identity: 'listing' }, { kind: 'relation', relationType: null }, { kind: 'is', relationType: 'basedOn' }, { origin: 'dbt' }, { inDomainModel: 'yes' }]) {
      expect(parseAdd({ resources: [{ id: 'r', ...details, mappings: [{ ...mapping, ...wrong }] }] })).toMatch(/Each mapping/);
    }
  });
});

describe.skipIf(!url)('the routes of Collections', () => {
  const schema = `catalogue_api_${randomBytes(4).toString('hex')}`;
  let database: Database<CatalogueDatabase>;
  let issuer: TestIssuer;
  let app: FastifyInstance;
  /** The groups identity tells, per token: each test User is in the groups their token names. */
  const groupsOf = new Map<string, Group[]>();
  let identityDown = false;

  beforeAll(async () => {
    database = createDatabase<CatalogueDatabase>({ connectionString: url }, schema);
    await migrate({ db: database.db as Kysely<unknown>, schema, migrations, serviceUser: 'postgres' });
    issuer = await createTestIssuer();
    app = await buildApp({
      verifier: issuer.verifier,
      logger: false,
      api: {
        collections: createCollections(database.db),
        identity: {
          async groups(authorization) {
            if (identityDown) {
              throw new IdentityUnavailable('identity answered 503');
            }
            return groupsOf.get(authorization) ?? [];
          },
          async domainGroups() {
            if (identityDown) {
              throw new IdentityUnavailable('identity answered 503');
            }
            return [DIGIKOM, SALES];
          },
        },
        resources: createResources(database.db),
        serviceCallers: {
          async verify(token) {
            if (token !== 'registry-id-token') {
              throw new TokenError('Service token rejected: ERR_JWS_INVALID');
            }
            return 'datahub-registry@project.iam.gserviceaccount.com';
          },
        },
      },
    });
  });

  afterAll(async () => {
    await app.close();
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(database.db);
    await database.close();
  });

  /** A User in the given groups, with or without the role of the Data Team. */
  async function user(name: string, groups: Group[], roles: string[] = []) {
    const authorization = `Bearer ${await issuer.sign({ sub: `u-${name}`, name, groups: groups.map((group) => group.id), roles })}`;
    groupsOf.set(authorization, groups);
    return (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, payload?: object) =>
      app.inject({ method, url: path, headers: { authorization }, ...(payload ? { payload } : {}) });
  }

  it('lets anyone create a Collection with one of their own groups, and only those (FR-CO-12, FR-CO-15)', async () => {
    const an = await user('An', [DIGIKOM]);
    const created = await an('POST', '/collections', { name: 'Leads', description: 'Leads of the agencies.', icon: 'coins', ownerUnit: DIGIKOM.id });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ name: 'Leads', ownerUnit: DIGIKOM, visibility: 'private', canManage: true });

    const notHers = await an('POST', '/collections', { name: 'Sales', description: 'Sales.', icon: 'storefront', ownerUnit: SALES.id });
    expect(notHers.statusCode).toBe(400);
    expect(notHers.json().error).toBe('not_your_group');

    const again = await an('POST', '/collections', { name: 'LEADS', description: 'Again.', icon: 'coins', ownerUnit: DIGIKOM.id });
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toBe('name_taken');

    expect((await an('POST', '/collections', { name: 'Leads' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/collections', payload: {} })).statusCode).toBe(401);
  });

  it('hides a private Collection from everyone but its Owner Unit and the Data Team (FR-CO-17, DEC-CO-11)', async () => {
    const an = await user('An', [DIGIKOM]);
    const bert = await user('Bert', [SALES]);
    const dirk = await user('Dirk', [], ['datateam']);
    const id = (await an('POST', '/collections', { name: 'Agencies', description: 'The agencies.', icon: 'handshake', ownerUnit: DIGIKOM.id })).json().id;

    expect((await bert('GET', `/collections/${id}`)).statusCode).toBe(404);
    expect((await bert('GET', `/collections/${id}/log`)).statusCode).toBe(404);
    expect((await bert('PATCH', `/collections/${id}`, { name: 'Mine' })).statusCode).toBe(404);
    expect((await bert('GET', '/collections')).json().collections.map((collection: { name: string }) => collection.name)).not.toContain('Agencies');
    expect((await dirk('GET', `/collections/${id}`)).json()).toMatchObject({ name: 'Agencies', canManage: true });
    expect((await an('GET', '/collections/not-a-uuid')).statusCode).toBe(404);
  });

  it('lets the Owner Unit and the Data Team manage a public Collection, and no one else (FR-CO-13)', async () => {
    const an = await user('An', [DIGIKOM]);
    const bert = await user('Bert', [SALES]);
    const dirk = await user('Dirk', [], ['datateam']);
    const id = (
      await an('POST', '/collections', { name: 'Web visits', description: 'Visits.', icon: 'globe', ownerUnit: DIGIKOM.id, visibility: 'public' })
    ).json().id;

    expect((await bert('GET', `/collections/${id}`)).json()).toMatchObject({ name: 'Web visits', canManage: false });
    expect((await bert('PATCH', `/collections/${id}`, { description: 'Mine now.' })).statusCode).toBe(403);
    expect((await bert('DELETE', `/collections/${id}`)).statusCode).toBe(403);

    expect((await dirk('PATCH', `/collections/${id}`, { description: 'Every visit to the website.' })).json().description).toBe('Every visit to the website.');
    // The Data Team chooses any group of the domain (FR-CO-35), but no group the domain does not have.
    expect((await dirk('PATCH', `/collections/${id}`, { ownerUnit: 'g-gone' })).json().error).toBe('not_your_group');

    // An hands it to Sales once she is in it; then it is Bert's to manage, and no longer hers.
    const anInBoth = await user('An', [DIGIKOM, SALES]);
    expect((await anInBoth('PATCH', `/collections/${id}`, { ownerUnit: SALES.id, visibility: 'private' })).json()).toMatchObject({
      ownerUnit: SALES,
      visibility: 'private',
    });
    expect((await an('GET', `/collections/${id}`)).statusCode).toBe(404);
    expect((await bert('GET', `/collections/${id}`)).json().canManage).toBe(true);

    const log = (await bert('GET', `/collections/${id}/log`)).json().entries.map((entry: { text: string }) => entry.text);
    expect(log).toEqual([
      'Made private by An',
      'Owner Unit changed from DigiKom to Sales by An',
      'Description changed by Dirk',
      'Collection created by An',
    ]);

    expect((await bert('DELETE', `/collections/${id}`)).statusCode).toBe(204);
    expect((await bert('GET', `/collections/${id}`)).statusCode).toBe(404);
  });

  it('lets the Data Team hand a Collection to any group of the domain, also one it is not in (FR-CO-35)', async () => {
    const dirk = await user('Dirk', [], ['datateam']);
    const created = await dirk('POST', '/collections', { name: 'Sales leads', description: 'Leads of sales.', icon: 'storefront', ownerUnit: SALES.id });
    expect(created.json()).toMatchObject({ ownerUnit: SALES, createdBy: 'Dirk', canManage: true });
    const handed = await dirk('PATCH', `/collections/${created.json().id}`, { ownerUnit: DIGIKOM.id });
    expect(handed.json()).toMatchObject({ ownerUnit: DIGIKOM });
  });

  describe('Resources', () => {
    const update = (runId: string, names: string[]) => ({
      projectId: '9367',
      projectName: 'immoscoop_dataplatform_sql',
      runId,
      generatedAt: '2026-10-26T06:12:00Z',
      tables: names.map((name) => ({
        key: `immoscoop-dataplatform.dbt_marts.${name}`,
        nodeId: `model.immoscoop_dataplatform_sql.${name}`,
        name,
        resourceType: 'model',
        description: '',
        exposures: [`datahub_${name}`],
        label: null,
        checksum: `sum-${name}`,
        columns: [
          { name: `${name}_id`, position: 1, dataType: 'STRING', description: '' },
          { name: 'tags', position: 2, dataType: 'ARRAY<STRING>', description: '' },
        ],
      })),
    });
    const fromRegistry = (payload: object, token = 'registry-id-token') =>
      app.inject({ method: 'POST', url: '/internal/resources', headers: { authorization: `Bearer ${token}` }, payload });

    it('takes the exposed tables from registry only, without an Access Token (TR-SR-01)', async () => {
      expect((await fromRegistry(update('1', ['visits']), 'someone-else')).statusCode).toBe(401);
      // Refused before the body is read: a body that is not even JSON gets 401, not 400.
      const unread = await app.inject({ method: 'POST', url: '/internal/resources', headers: { authorization: 'Bearer forged', 'content-type': 'application/json' }, payload: '{not json' });
      expect(unread.statusCode).toBe(401);
      const an = await user('An', [DIGIKOM]);
      expect((await an('POST', '/internal/resources', update('1', ['visits']))).statusCode).toBe(401);
      expect((await fromRegistry({ projectId: 'prod', runId: '1', tables: [] })).statusCode).toBe(400);

      const answer = await fromRegistry(update('1', ['visits', 'leads']));
      expect(answer.statusCode).toBe(200);
      expect(answer.json()).toEqual({ applied: true, registered: 2, renamed: 0, withdrawn: 0, back: 0 });
    });

    it('lets only the Data Team see the Resources without Collection and add them to one (TR-SR-04)', async () => {
      const an = await user('An', [DIGIKOM]);
      const bert = await user('Bert', [SALES]);
      const dirk = await user('Dirk', [], ['datateam']);
      await fromRegistry(update('2', ['visits', 'leads', 'agencies']));
      const waiting = (await dirk('GET', '/resources?collection=none')).json().resources as { id: string; name: string }[];
      expect(waiting.map((resource) => resource.name)).toEqual(['agencies', 'leads', 'visits']);
      expect((await an('GET', '/resources?collection=none')).statusCode).toBe(403);
      expect((await dirk('GET', '/resources')).statusCode).toBe(400);

      const collection = (
        await an('POST', '/collections', { name: 'Visits', description: 'Visits.', icon: 'binoculars', ownerUnit: DIGIKOM.id, visibility: 'public' })
      ).json();
      const visits = waiting.find((resource) => resource.name === 'visits')!;
      const leads = waiting.find((resource) => resource.name === 'leads')!;
      expect((await an('PUT', `/resources/${visits.id}/collection`, { collectionId: collection.id })).statusCode).toBe(403);
      const added = await dirk('PUT', `/resources/${visits.id}/collection`, { collectionId: collection.id });
      expect(added.json()).toMatchObject({ name: 'visits', collectionId: collection.id });
      expect((await dirk('PUT', `/resources/${visits.id}/collection`, { collectionId: '00000000-0000-4000-8000-000000000000' })).statusCode).toBe(404);

      // Several at once from the page of the Collection (FR-CO-31): all or none.
      expect((await an('POST', `/collections/${collection.id}/resources`, { resources: [leads.id] })).statusCode).toBe(403);
      expect((await dirk('POST', `/collections/${collection.id}/resources`, { resources: [] })).statusCode).toBe(400);
      expect((await dirk('POST', `/collections/${collection.id}/resources`, { resources: [leads.id, 7] })).statusCode).toBe(400);
      const other = (await dirk('POST', '/collections', { name: 'Other', description: 'Other.', icon: 'globe', ownerUnit: SALES.id })).json();
      const elsewhere = await dirk('POST', `/collections/${other.id}/resources`, { resources: [leads.id, visits.id] });
      expect(elsewhere.statusCode).toBe(409);
      expect(elsewhere.json()).toMatchObject({ error: 'in_another_collection', resources: [visits.id] });
      const both = await dirk('POST', `/collections/${collection.id}/resources`, { resources: [leads.id, visits.id] });
      expect(both.json().resources.map((resource: { name: string; lastChange: { text: string } }) => [resource.name, resource.lastChange.text])).toEqual([
        ['leads', 'Added to the Collection Visits by Dirk'],
        ['visits', 'Added to the Collection Visits by Dirk'],
      ]);
      expect((await dirk('DELETE', `/resources/${leads.id}/collection`)).statusCode).toBe(204);
      // With what the Data Admin recorded at step 2: a field the Resource lacks is refused (FR-CO-33).
      const recorded = { partition: null, clusterBy: [], partitionFilter: 'none', grain: ['leads_id'], grainSentence: 'lead', modelType: 'fact', origins: { grain: 'here' }, release: null, mappings: [] };
      const lacking = await dirk('POST', `/collections/${collection.id}/resources`, { resources: [{ id: leads.id, ...recorded, grain: ['nope'] }] });
      expect(lacking.statusCode).toBe(400);
      expect(lacking.json().message).toBe('leads: it has no field nope.');
      expect((await dirk('POST', `/collections/${collection.id}/resources`, { resources: [{ id: leads.id, ...recorded }] })).statusCode).toBe(200);
      expect((await dirk('GET', `/resources/${leads.id}`)).json().resource.details).toMatchObject({ grain: ['leads_id'], grainSentence: 'lead', modelType: 'fact' });
      expect((await dirk('DELETE', `/resources/${leads.id}/collection`)).statusCode).toBe(204);
      expect((await an('GET', `/collections/${collection.id}`)).json().resources.map((resource: { displayName: string }) => resource.displayName)).toEqual(['visits']);

      // The Owner Unit sees it; someone else who sees the public Collection does not, until it is published.
      expect((await an('GET', `/collections/${collection.id}/resources`)).json().resources.map((resource: { name: string }) => resource.name)).toEqual(['visits']);
      expect((await bert('GET', `/collections/${collection.id}/resources`)).json().resources).toEqual([]);
      expect((await an('GET', `/resources/${visits.id}/log`)).json().entries.map((entry: { text: string }) => entry.text)).toEqual([
        'Added to the Collection Visits by Dirk',
        'Maturity assessed at Level 1',
        'Registered through exposure datahub_visits',
      ]);
      expect((await bert('GET', `/resources/${visits.id}/log`)).statusCode).toBe(404);

      // Only an empty Collection is dissolved (FR-CO-10).
      const refused = await an('DELETE', `/collections/${collection.id}`);
      expect(refused.statusCode).toBe(409);
      expect(refused.json().error).toBe('not_empty');
      expect((await dirk('DELETE', `/resources/${visits.id}/collection`)).statusCode).toBe(204);
      expect((await dirk('DELETE', `/resources/${visits.id}/collection`)).json().error).toBe('not_in_a_collection');
      expect((await an('DELETE', `/collections/${collection.id}`)).statusCode).toBe(204);
    });

    it('shows a Resource with its fields to whoever sees it, and the columns left out of it (FR-SR-06, DEC-SR-33)', async () => {
      const an = await user('An', [DIGIKOM]);
      const dirk = await user('Dirk', [], ['datateam']);
      await fromRegistry(update('4', ['searches']));
      const waiting = (await dirk('GET', '/resources?collection=none')).json().resources as { id: string; name: string; level: number }[];
      const searches = waiting.find((resource) => resource.name === 'searches')!;
      expect(searches.level).toBe(1);
      const shown = await dirk('GET', `/resources/${searches.id}`);
      expect(shown.statusCode).toBe(200);
      expect(shown.json().resource).toMatchObject({
        name: 'searches',
        level: 1,
        collectionId: null,
        fields: [{ name: 'searches_id', position: 1, dataType: 'STRING', description: '' }],
        leftOut: [{ name: 'tags', dataType: 'ARRAY<STRING>', reason: 'array' }],
      });
      // Without a Collection, only the Data Team sees it (FR-SR-31).
      expect((await an('GET', `/resources/${searches.id}`)).statusCode).toBe(404);
      expect((await dirk('GET', '/resources/not-an-id')).statusCode).toBe(404);
    });

    it('checks what registry sends', () => {
      expect(parseUpdate(update('3', ['visits']))).toMatchObject({ projectId: '9367', runId: '3' });
      expect(parseUpdate({ ...update('3', []), tables: 'all' })).toBe('The exposed tables come as a list.');
      expect(parseUpdate({ ...update('3', []), tables: [{ key: 'x' }] })).toMatch(/Every exposed table/);
      expect(parseUpdate({ ...update('3', []), projectName: 5 })).toBe('The name of the dbt project is a text, or null.');
      expect(parseUpdate({ ...update('3', []), generatedAt: 'yesterday' })).toMatch(/ISO 8601/);
      const [visits] = update('3', ['visits']).tables;
      expect(parseUpdate({ ...update('3', []), tables: [{ ...visits, columns: undefined }] })).toMatch(/Every exposed table/);
      expect(parseUpdate({ ...update('3', []), tables: [{ ...visits, columns: [{ name: 'x', position: 1.5, dataType: null, description: '' }] }] })).toMatch(
        /Every exposed table/,
      );
    });
  });

  it('answers 503 rather than guess when identity cannot tell the groups', async () => {
    const an = await user('An', [DIGIKOM]);
    identityDown = true;
    try {
      const response = await an('POST', '/collections', { name: 'Later', description: 'Later.', icon: 'binoculars', ownerUnit: DIGIKOM.id });
      expect(response.statusCode).toBe(503);
      expect(response.json().error).toBe('temporarily_unavailable');
    } finally {
      identityDown = false;
    }
  });
});

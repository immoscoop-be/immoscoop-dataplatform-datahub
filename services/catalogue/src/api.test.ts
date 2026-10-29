import { randomBytes } from 'node:crypto';
import { TokenError } from '@datahub/auth';
import { createTestIssuer, type TestIssuer } from '@datahub/auth/testing';
import { createDatabase, migrate, type Database } from '@datahub/db';
import type { FastifyInstance } from 'fastify';
import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parse, parseAdd, parseCard, parseFieldDescriptions, parseRequest, parseUpdate } from './api.js';
import { buildApp } from './app.js';
import { createCollections } from './collections.js';
import type { CatalogueDatabase } from './database.js';
import { type Group, IdentityUnavailable } from './identity.js';
import { migrations } from './migrations/index.js';
import { RegistryUnavailable } from './registry.js';
import { createMessages } from './messages.js';
import { createRequests } from './requests.js';
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

describe('what changes about a Resource, in a request (FR-RC-15, FR-RC-16)', () => {
  it('takes texts, a list of gaps, a day and lists of fields, trimmed', () => {
    expect(parseCard({ businessDescription: ' Leads per week. ', knownGaps: [' no partner leads before March ', ' '], reliableSince: '2025-01-01', keyFields: ['week_start'] })).toEqual({
      businessDescription: 'Leads per week.',
      knownGaps: ['no partner leads before March'],
      reliableSince: '2025-01-01',
      keyFields: ['week_start'],
    });
    expect(parseCard({ reliableSince: null, pitfalls: '' })).toEqual({ reliableSince: null, pitfalls: '' });
  });

  it('refuses what does not fit', () => {
    expect(parseCard({})).toBe('Send at least one thing to change.');
    expect(parseCard({ stability: 'D-3' })).toBe('A Resource has no stability to change.');
    expect(parseCard({ intendedUse: 'x'.repeat(2001) })).toMatch(/at most 2000/);
    expect(parseCard({ reliableSince: '2025-02-30' })).toMatch(/YYYY-MM-DD/);
    expect(parseCard({ reliableSince: 'yesterday' })).toMatch(/YYYY-MM-DD/);
    expect(parseCard({ keyFields: ['a', 'a'] })).toMatch(/different fields/);
    expect(parseCard({ knownGaps: 'none' })).toMatch(/Known Gaps/);
  });

  it('takes the Business Descriptions of fields, each once; an empty one removes it', () => {
    expect(parseFieldDescriptions({ fields: [{ name: 'a', businessDescription: ' The a. ' }, { name: 'b', businessDescription: '' }] })).toEqual([
      { field: 'a', text: 'The a.' },
      { field: 'b', text: '' },
    ]);
    expect(parseFieldDescriptions({ fields: [] })).toMatch(/list of 1 to 1000/);
    expect(parseFieldDescriptions({ fields: [{ name: 'a', businessDescription: 'x' }, { name: 'a', businessDescription: 'y' }] })).toBe('Name each field once.');
    expect(parseFieldDescriptions({ fields: [{ name: 'a' }] })).toMatch(/Each field/);
  });
});

describe('a Request to the Data Team, in a request (FR-CV-08, MSG-QRY-01)', () => {
  const fields = { type: 'MSG-QRY-01', subjectId: '7C0B5A52-3F4A-4BF0-9A49-2F3F5C1D9A10', subject: ' Partner leads ', reads: 4_800_000_000, threshold: 1_000_000_000, text: ' Once. ' };

  it('takes a query that reads more than the threshold, with an optional word', () => {
    expect(parseRequest(fields)).toEqual({ ...fields, subjectId: '7c0b5a52-3f4a-4bf0-9a49-2f3f5c1d9a10', subject: 'Partner leads', text: 'Once.' });
    expect(parseRequest({ ...fields, text: undefined })).toMatchObject({ text: '' });
  });

  it('refuses what does not fit', () => {
    expect(parseRequest([])).toMatch(/JSON object/);
    expect(parseRequest({ ...fields, type: 'MSG-LEN-03' })).toBe('The type of a Request is one of MSG-QRY-01, MSG-LEN-01.');
    expect(parseRequest({ ...fields, type: 'MSG-LEN-01', partitions: 312 })).toMatchObject({ type: 'MSG-LEN-01', partitions: 312 });
    expect(parseRequest({ ...fields, subjectId: 'q-20261029-4c2e1a' })).toBe('A query or a Lens is named by its ID.');
    expect(parseRequest({ ...fields, subject: ' ' })).toMatch(/1 to 120/);
    expect(parseRequest({ ...fields, reads: '4.8 GB' })).toMatch(/numbers of bytes/);
    expect(parseRequest({ ...fields, reads: 900_000_000 })).toBe('A query or a Lens that reads no more than the threshold needs no Request.');
    expect(parseRequest({ ...fields, text: 'x'.repeat(501) })).toMatch(/at most 500/);
    expect(parseRequest({ ...fields, state: 'accepted' })).toBe('A Request has no field state.');
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
  let registryDown = false;

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
        // The lineage around `cards`: `decks` and a staging model upstream, a mart downstream.
        registry: {
          async lineage(nodeId, direction) {
            if (registryDown) {
              throw new RegistryUnavailable('registry answered 503');
            }
            if (!nodeId.endsWith('.cards')) {
              return undefined;
            }
            const node = (name: string, layer: string, distance: number) => ({
              uniqueId: `model.immoscoop_dataplatform_sql.${name}`,
              name,
              resourceType: 'model',
              layer,
              projectId: '9367',
              projectName: 'dbt-prod',
              distance,
            });
            const near = direction === 'upstream' ? [node('decks', 'marts', 1), node('stg_cards', 'staging', 2)] : [node('card_share', 'marts', 1)];
            return { direction, nodes: [node('cards', 'marts', 0), ...near], edges: [], truncated: false };
          },
        },
        requests: createRequests(database.db),
        messages: createMessages(database.db),
        // query tells about its Lenses with its own Google ID token (DEC-PF-30).
        lensCallers: {
          async verify(token) {
            if (token !== 'query-token') {
              throw new TokenError('Service token rejected: ERR_JWS_INVALID');
            }
            return 'datahub-query@project.iam.gserviceaccount.com';
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

    it('lets the Owner Unit and the Data Team keep the Resource Card, and shows what it relates to (FR-RC-15, FR-RC-09, FR-SR-54)', async () => {
      const an = await user('An', [DIGIKOM]);
      const bert = await user('Bert', [SALES]);
      const dirk = await user('Dirk', [], ['datateam']);
      const described = (name: string, description: string) => ({
        ...update('6', [name]).tables[0]!,
        description,
        columns: [
          { name: `${name}_id`, position: 1, dataType: 'STRING', description: description && 'The ID.' },
          { name: 'listing_id', position: 2, dataType: 'STRING', description: '' },
        ],
      });
      await fromRegistry({ ...update('6', []), tables: [described('cards', 'Cards per week.'), described('decks', 'Decks.'), described('drafts', '')] });
      const waiting = (await dirk('GET', '/resources?collection=none')).json().resources as { id: string; name: string }[];
      const [cards, decks, drafts] = ['cards', 'decks', 'drafts'].map((name) => waiting.find((resource) => resource.name === name)!.id);
      // Without a Collection it has no Owner yet: the rest follows once it has one.
      expect((await dirk('PATCH', `/resources/${cards}`, { intendedUse: 'Trends.' })).json().error).toBe('no_collection');

      const collection = (await an('POST', '/collections', { name: 'Cards', description: 'Cards.', icon: 'cards', ownerUnit: DIGIKOM.id })).json();
      const mapped = (field: string) => ({
        partition: null,
        clusterBy: [],
        partitionFilter: 'none',
        grain: [],
        grainSentence: '',
        modelType: 'fact',
        origins: {},
        release: '0.0.70',
        mappings: [{ field, kind: 'relation', relationType: 'basedOn', identity: 'listing.listingId', subject: null, origin: 'name', inDomainModel: true }],
      });
      const added = await dirk('POST', `/collections/${collection.id}/resources`, {
        resources: [{ id: cards, ...mapped('listing_id') }, { id: decks, ...mapped('listing_id') }, drafts],
      });
      expect(added.statusCode).toBe(200);

      // Its Owner Unit edits in place; every change goes into the Log, by name (FR-SR-28).
      expect((await an('PATCH', `/resources/${cards}`, { keyFields: ['nope'] })).json().message).toBe('cards has no field nope.');
      const edited = await an('PATCH', `/resources/${cards}`, {
        businessDescription: 'The cards we send each week.',
        intendedUse: 'Trends.',
        knownGaps: ['No cards before March.'],
        reliableSince: '2025-01-01',
        keyFields: ['cards_id'],
        parameters: ['listing_id'],
      });
      expect(edited.statusCode).toBe(200);
      expect(edited.json().resource.card).toEqual({
        businessDescription: 'The cards we send each week.',
        intendedUse: 'Trends.',
        pitfalls: '',
        knownGaps: ['No cards before March.'],
        reliableSince: '2025-01-01',
        keyFields: ['cards_id'],
        parameters: ['listing_id'],
      });
      // Only what changed goes into the Log.
      expect((await dirk('PATCH', `/resources/${cards}`, { intendedUse: 'Trends.', pitfalls: 'Weeks overlap.' })).statusCode).toBe(200);
      expect((await an('GET', `/resources/${cards}/log`)).json().entries.slice(0, 7).map((entry: { text: string }) => entry.text)).toEqual([
        'Pitfalls updated by Dirk',
        'Parameters updated by An',
        'Key fields updated by An',
        'Reliable since updated by An',
        'Known Gaps updated by An',
        'Intended use updated by An',
        'Business Description updated by An',
      ]);
      expect((await bert('PATCH', `/resources/${cards}`, { intendedUse: 'Mine.' })).statusCode).toBe(404);
      // A Business Description from 2 · Described on (DEC-MR-10); the rest of the card before that.
      expect((await an('PATCH', `/resources/${drafts}`, { businessDescription: 'Drafts.' })).json().error).toBe('not_described');
      expect((await an('PATCH', `/resources/${drafts}`, { intendedUse: 'Not yet.' })).statusCode).toBe(200);

      // The Business Descriptions of the fields, next to those from dbt (FR-RC-16).
      const fields = await an('PUT', `/resources/${cards}/fields`, { fields: [{ name: 'cards_id', businessDescription: 'One card.' }] });
      expect(fields.json().resource.fields).toEqual([
        { name: 'cards_id', position: 1, dataType: 'STRING', description: 'The ID.', businessDescription: 'One card.' },
        { name: 'listing_id', position: 2, dataType: 'STRING', description: '', businessDescription: '' },
      ]);
      expect((await an('PUT', `/resources/${cards}/fields`, { fields: [{ name: 'cards_id', businessDescription: '' }] })).json().resource.fields[0].businessDescription).toBe('');
      expect((await an('PUT', `/resources/${drafts}/fields`, { fields: [{ name: 'drafts_id', businessDescription: 'A draft.' }] })).json().error).toBe('not_described');
      expect((await an('GET', `/resources/${cards}/log`)).json().entries.slice(0, 2).map((entry: { text: string }) => entry.text)).toEqual([
        'Business Description of the field cards_id updated by An',
        'Business Description of the field cards_id updated by An',
      ]);

      // Edit relations, for a Data Admin only (DEC-UX-107).
      expect((await an('PUT', `/resources/${cards}/details`, mapped('listing_id'))).statusCode).toBe(403);
      expect((await dirk('PUT', `/resources/${cards}/details`, { ...mapped('listing_id'), grain: ['nope'] })).json().message).toBe('cards: it has no field nope.');
      const related = await dirk('PUT', `/resources/${cards}/details`, { ...mapped('listing_id'), grain: ['cards_id'], grainSentence: 'one card' });
      expect(related.json().resource.details).toMatchObject({ grain: ['cards_id'], grainSentence: 'one card' });

      // What it relates to: the Resources that carry the same identity, as far as the User sees them.
      expect((await an('GET', `/resources/${cards}/related`)).json().related).toEqual([
        {
          field: 'listing_id',
          kind: 'relation',
          relationType: 'basedOn',
          identity: 'listing.listingId',
          inDomainModel: true,
          resources: [{ id: decks, displayName: 'decks', level: 2, field: 'listing_id' }],
        },
      ]);

      // The lineage around it, with the Resources on it that the User sees (DEC-AR-06).
      const lineage = (await an('GET', `/resources/${cards}/lineage`)).json();
      expect(lineage.nodeId).toBe('model.immoscoop_dataplatform_sql.cards');
      expect(lineage.upstream.nodes.map((node: { name: string; layer: string }) => `${node.name} · ${node.layer}`)).toEqual(['cards · marts', 'decks · marts', 'stg_cards · staging']);
      expect(lineage.downstream.nodes.map((node: { name: string }) => node.name)).toEqual(['cards', 'card_share']);
      expect(lineage.resources.map((resource: { displayName: string }) => resource.displayName).sort()).toEqual(['cards', 'decks']);
      expect((await bert('GET', `/resources/${cards}/lineage`)).statusCode).toBe(404);
      expect((await an('GET', `/resources/${drafts}/lineage`)).json()).toMatchObject({ upstream: null, downstream: null });
      registryDown = true;
      expect((await an('GET', `/resources/${cards}/lineage`)).statusCode).toBe(503);
      registryDown = false;
    });

    it('publishes a Resource as its first Confirmation, warns of what changes after, and deprecates it (FR-SR-49, FR-MR-12, FR-SR-50)', async () => {
      const an = await user('An', [DIGIKOM]);
      const bert = await user('Bert', [SALES]);
      const dirk = await user('Dirk', [], ['datateam']);
      // The Collection of the previous test, public, with cards, decks and drafts in it.
      const run = (runId: string, cards: { description?: string; columns?: { name: string; dataType: string; description: string }[] } = {}) =>
        fromRegistry({
          ...update(runId, []),
          tables: ['cards', 'decks', 'drafts'].map((name) => ({
            ...update(runId, [name]).tables[0]!,
            description: name === 'cards' ? (cards.description ?? 'Cards per week.') : name === 'decks' ? 'Decks.' : '',
            columns:
              name === 'cards' && cards.columns
                ? cards.columns.map((column, index) => ({ ...column, position: index + 1 }))
                : [
                    { name: `${name}_id`, position: 1, dataType: 'STRING', description: name === 'drafts' ? '' : 'The ID.' },
                    { name: 'listing_id', position: 2, dataType: 'STRING', description: '' },
                  ],
          })),
        });
      expect((await run('7')).statusCode).toBe(200);
      const collection = (await an('GET', '/collections')).json().collections.find((one: { name: string }) => one.name === 'Cards');
      await an('PATCH', `/collections/${collection.id}`, { visibility: 'public' });
      const ids = Object.fromEntries(collection.resources.map((resource: { id: string; displayName: string }) => [resource.displayName, resource.id]));
      const [cards, decks, drafts] = [ids.cards, ids.decks, ids.drafts];

      // Not published, someone else who sees the Collection does not see it (FR-SR-31).
      expect((await bert('GET', `/resources/${cards}`)).statusCode).toBe(404);
      // Only the Owner publishes, from Described (FR-SR-16, FR-SR-17).
      expect((await dirk('POST', `/resources/${cards}/publication`)).statusCode).toBe(403);
      expect((await an('POST', `/resources/${drafts}/publication`)).json().error).toBe('not_described');
      const published = await an('POST', `/resources/${cards}/publication`);
      expect(published.statusCode).toBe(200);
      expect(published.json().resource).toMatchObject({ level: 3, published: true, publication: { publishedBy: 'An', confirmedBy: 'An' } });
      expect((await an('POST', `/resources/${cards}/publication`)).json().error).toBe('already_published');
      expect((await an('GET', `/resources/${cards}/log`)).json().entries.slice(0, 2).map((entry: { text: string }) => entry.text)).toEqual([
        'Confirmed by An',
        'Published by An',
      ]);

      // Published, everyone who sees its Collection sees it, and does not change it.
      expect((await bert('GET', `/resources/${cards}`)).statusCode).toBe(200);
      expect((await bert('GET', `/collections/${collection.id}`)).json().resources.map((resource: { displayName: string; published: boolean }) => [resource.displayName, resource.published])).toEqual([
        ['cards', true],
      ]);
      expect((await bert('GET', `/collections/${collection.id}/resources`)).json().resources.map((resource: { name: string }) => resource.name)).toEqual(['cards']);
      expect((await bert('PATCH', `/resources/${cards}`, { intendedUse: 'Mine.' })).statusCode).toBe(403);

      // A field added, removed and retyped, and a description changed, after the Confirmation (FR-MR-12, FR-RC-17).
      await run('8', {
        description: 'Cards sent per week.',
        columns: [
          { name: 'cards_id', dataType: 'INT64', description: 'The number of the card.' },
          { name: 'week', dataType: 'DATE', description: '' },
        ],
      });
      const changed = (await bert('GET', `/resources/${cards}`)).json().resource;
      expect(changed.level).toBe(3);
      expect(changed.changes.map((change: { field: string; change: string }) => `${change.field} ${change.change}`)).toEqual(['week added', 'listing_id removed', 'cards_id retyped']);
      expect(changed.descriptionChanges.map((change: { field: string | null; before: string }) => [change.field, change.before])).toEqual([
        [null, 'Cards per week.'],
        ['cards_id', 'The ID.'],
      ]);
      expect((await an('GET', `/resources/${cards}/log`)).json().entries.slice(0, 4).map((entry: { text: string }) => entry.text)).toEqual([
        'Description changed in cards',
        'Type of cards_id changed from STRING to INT64',
        'Structural change: field listing_id removed',
        'Structural change: field week added',
      ]);
      const told = await database.db.selectFrom('messages').select(['type', 'params']).where('subjectId', '=', cards).where('type', 'in', ['MSG-RES-02', 'MSG-RES-03']).orderBy('type').execute();
      expect(told.map((message) => [message.type, message.params.count])).toEqual([
        ['MSG-RES-02', '2'],
        ['MSG-RES-03', '3'],
      ]);
      expect(JSON.parse(told[1]!.params.changes!)).toContainEqual({ field: 'cards_id', change: 'retyped', old: 'STRING', new: 'INT64' });

      // Seen by the Owner Unit or the Data Team, the warning goes; the changes stay in the Log.
      expect((await bert('POST', `/resources/${cards}/changes/seen`)).statusCode).toBe(403);
      expect((await an('POST', `/resources/${cards}/changes/seen`)).json().resource.changes).toEqual([]);
      expect((await an('GET', `/resources/${cards}/log`)).json().entries[0].text).toBe('Changes since the last Confirmation marked seen by An');

      // Without a description in dbt it drops to Available and its Owner is told; it stays published,
      // and the Confirmation holds when the description is back (DEC-MR-08, FR-SR-19).
      await run('9', { description: '', columns: [{ name: 'cards_id', dataType: 'INT64', description: 'The number of the card.' }] });
      expect((await an('GET', `/resources/${cards}`)).json().resource).toMatchObject({ level: 1, published: true });
      const dropped = await database.db.selectFrom('messages').select('params').where('subjectId', '=', cards).where('type', '=', 'MSG-RES-05').executeTakeFirstOrThrow();
      expect(dropped.params).toEqual({ from: '3', to: '1', cause: 'description', published: 'yes' });
      await run('10', { columns: [{ name: 'cards_id', dataType: 'INT64', description: 'The number of the card.' }] });
      expect((await an('GET', `/resources/${cards}`)).json().resource.level).toBe(3);

      // Deprecated, with why and what to use instead, and taken away again (FR-SR-50).
      expect((await an('PUT', `/resources/${drafts}/deprecation`, { reason: 'Old.' })).json().error).toBe('not_published');
      expect((await an('PUT', `/resources/${cards}/deprecation`, { reason: ' ' })).statusCode).toBe(400);
      expect((await bert('PUT', `/resources/${cards}/deprecation`, { reason: 'Mine.' })).statusCode).toBe(403);
      const deprecated = await dirk('PUT', `/resources/${cards}/deprecation`, { reason: 'Use the decks.', insteadOf: decks });
      expect(deprecated.json().resource).toMatchObject({ deprecated: true, deprecation: { by: 'Dirk', reason: 'Use the decks.', insteadOf: { id: decks, displayName: 'decks' } } });
      expect((await bert('GET', `/collections/${collection.id}`)).json().resources[0].deprecated).toBe(true);
      expect((await an('DELETE', `/resources/${cards}/deprecation`)).json().resource.deprecation).toBeNull();
      expect((await an('DELETE', `/resources/${cards}/deprecation`)).json().error).toBe('not_deprecated');
      expect((await an('GET', `/resources/${cards}/log`)).json().entries.slice(0, 2).map((entry: { text: string }) => entry.text)).toEqual([
        'Deprecation taken away by An',
        'Marked deprecated by Dirk',
      ]);
    });

    it('finds the Collections and Resources the User sees by the words of a question (FR-CO-37, DEC-UX-127)', async () => {
      const ruth = await user('Ruth', [SALES]);
      const an = await user('An', [DIGIKOM]);
      const dirk = await user('Dirk', [], ['datateam']);
      const tables = update('20', ['broker_reviews']);
      tables.tables[0]!.description = 'How agencies rate their brokers, per review.';
      await fromRegistry(tables);
      const review = ((await dirk('GET', '/resources?collection=none')).json().resources as { id: string; name: string }[]).find((resource) => resource.name === 'broker_reviews')!;
      const collection = (await ruth('POST', '/collections', { name: 'Broker ratings', description: 'What agencies say about their brokers.', icon: 'handshake', ownerUnit: SALES.id })).json();
      expect((await dirk('POST', `/collections/${collection.id}/resources`, { resources: [review.id] })).statusCode).toBe(200);

      const found = (await ruth('GET', `/search?question=${encodeURIComponent('How do agencies rate their brokers?')}`)).json();
      expect(found.collections).toMatchObject([{ id: collection.id, resources: 1, shared: 3 }]);
      expect(found.collections[0].description).toEqual([
        { text: 'What ', shared: false },
        { text: 'agencies', shared: true },
        { text: ' say about their ', shared: false },
        { text: 'brokers', shared: true },
        { text: '.', shared: false },
      ]);
      expect(found.resources).toMatchObject([{ id: review.id, collectionId: collection.id, collectionName: 'Broker ratings', shared: 3 }]);
      // An does not see Ruth's private Collection; a question of common words finds nothing.
      expect((await an('GET', '/search?question=brokers')).json()).toEqual({ collections: [], resources: [] });
      expect((await ruth('GET', '/search?question=the')).json()).toEqual({ collections: [], resources: [] });
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

  it('keeps a Request to run a very large query, one waiting per query and writer (MSG-QRY-01)', async () => {
    const karel = await user('Karel', [DIGIKOM]);
    const els = await user('Els', [SALES]);
    const team = await user('Toon', [], ['datateam']);
    const query = '2b1f3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
    const body = { type: 'MSG-QRY-01', subjectId: query, subject: 'Partner leads since 2019', reads: 4_800_000_000, threshold: 1_000_000_000, text: 'For the five-year review.' };

    const sent = await karel('POST', '/requests', body);
    expect(sent.statusCode).toBe(201);
    expect(sent.json().request).toMatchObject({ type: 'MSG-QRY-01', subjectKind: 'query', subjectId: query, writerId: 'u-Karel', writerName: 'Karel', reads: 4_800_000_000, text: 'For the five-year review.', state: 'waiting' });
    // While it waits, sending again gives the same Request back, as it was.
    const again = await karel('POST', '/requests', { ...body, text: 'Please.' });
    expect(again.statusCode).toBe(200);
    expect(again.json().request).toMatchObject({ id: sent.json().request.id, text: 'For the five-year review.' });
    expect((await els('POST', '/requests', body)).statusCode).toBe(201);

    // Each sees their own; the Data Team sees everyone's on a query.
    expect((await karel('GET', '/requests?subjectKind=query')).json().requests.map((request: { writerName: string }) => request.writerName)).toEqual(['Karel']);
    expect((await karel('GET', `/requests?subjectKind=query&subjectId=${query}`)).json().requests).toHaveLength(1);
    expect((await team('GET', `/requests?subjectKind=query&subjectId=${query}`)).json().requests).toHaveLength(2);
    expect((await team('GET', '/requests?subjectKind=query')).json().requests).toEqual([]);
    expect((await karel('GET', '/requests')).statusCode).toBe(400);
    expect((await karel('GET', '/requests?subjectKind=query&subjectId=nope')).statusCode).toBe(400);

    // Once answered, a new one can be sent.
    await sql`update messages set state = 'refused' where id = ${sent.json().request.id}`.execute(database.db);
    const after = await karel('POST', '/requests', body);
    expect(after.statusCode).toBe(201);
    expect(after.json().request.id).not.toBe(sent.json().request.id);
    expect((await karel('POST', '/requests', { ...body, reads: 10 })).statusCode).toBe(400);
  });

  it('keeps a Request to accept a very large Lens apart from those on queries (MSG-LEN-01, FR-LE-09)', async () => {
    const mia = await user('Mia', [DIGIKOM]);
    const team = await user('Toon', [], ['datateam']);
    const lens = '7c1f3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
    const body = { type: 'MSG-LEN-01', subjectId: lens, subject: 'Leads per source, all weeks', reads: 6_200_000_000, threshold: 1_000_000_000, text: 'For the yearly review.', partitions: 312 };

    const sent = await mia('POST', '/requests', body);
    expect(sent.statusCode).toBe(201);
    expect(sent.json().request).toMatchObject({ type: 'MSG-LEN-01', subjectKind: 'lens', subjectId: lens, writerName: 'Mia', partitions: 312, state: 'waiting' });
    expect((await mia('GET', '/requests?subjectKind=lens')).json().requests).toHaveLength(1);
    expect((await mia('GET', '/requests?subjectKind=query')).json().requests).toEqual([]);
    expect((await team('GET', `/requests?subjectKind=lens&subjectId=${lens}`)).json().requests).toHaveLength(1);
    expect((await mia('POST', '/requests', { ...body, partitions: 'all' })).statusCode).toBe(400);
  });

  describe('Messages', () => {
    // A group of its own, so that what earlier tests told DigiKom does not count here.
    const CREDIT: Group = { id: 'g-credit', email: 'credit@thenextimmoscoop.be', name: 'Credit' };
    const BROKERS: Group = { id: 'g-brokers', email: 'brokers@thenextimmoscoop.be', name: 'Brokers' };
    const AGENTS: Group = { id: 'g-agents', email: 'agents@thenextimmoscoop.be', name: 'Agents' };
    const fromQuery = (method: 'PUT' | 'POST', url: string, payload: object, token = 'query-token') =>
      app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload });

    it('places a Question on its object, for everyone who sees it, and tells its Owner Unit (FR-CV-03, FR-CV-05, FR-CV-06)', async () => {
      const an = await user('Ann', [CREDIT]);
      const bert = await user('Bert', [BROKERS]);
      const els = await user('Eva', [AGENTS]);
      const dirk = await user('Dirk', [], ['datateam']);
      const talk = (await an('POST', '/collections', { name: 'Talk', description: 'To talk about.', icon: 'chat-circle', ownerUnit: CREDIT.id, visibility: 'public' })).json();
      const secret = (await els('POST', '/collections', { name: 'Secret', description: 'Not for all.', icon: 'lock', ownerUnit: AGENTS.id })).json();

      const asked = await bert('POST', '/messages', { subjectKind: 'collection', subjectId: talk.id, kind: 'question', text: ' Will it be published this month? ' });
      expect(asked.statusCode).toBe(201);
      const question = asked.json().message;
      expect(question).toMatchObject({
        type: 'MSG-CNV-01',
        kind: 'question',
        state: 'open',
        subject: { kind: 'collection', id: talk.id, name: 'Talk', exists: true },
        writer: { id: 'u-Bert', name: 'Bert', as: null },
        params: { text: 'Will it be published this month?' },
        unread: false,
        mine: true,
        replies: [],
      });
      // A Collection takes no Signal; a Message has words; nobody writes on what they do not see.
      expect((await bert('POST', '/messages', { subjectKind: 'collection', subjectId: talk.id, kind: 'signal', text: 'Odd.' })).statusCode).toBe(400);
      expect((await bert('POST', '/messages', { subjectKind: 'collection', subjectId: talk.id, kind: 'remark', text: ' ' })).statusCode).toBe(400);
      expect((await an('POST', '/messages', { subjectKind: 'collection', subjectId: secret.id, kind: 'remark', text: 'Hi.' })).statusCode).toBe(404);

      // For its Owner Unit, unread until opened; not for someone else who only sees it.
      expect((await an('GET', '/messages/unread')).json()).toEqual({ unread: 1 });
      expect((await bert('GET', '/messages/unread')).json()).toEqual({ unread: 0 });
      const centre = (await an('GET', '/messages')).json();
      expect(centre.messages.map((message: { id: string; unread: boolean }) => [message.id, message.unread])).toEqual([[question.id, true]]);
      expect(centre.counts).toMatchObject({ forYou: 1, unread: 1, written: 0, kinds: { question: 1, remark: 0 }, on: { collection: 1, lens: 0 } });
      expect((await els('GET', '/messages')).json().messages).toEqual([]);
      expect((await els('GET', '/messages?view=everything')).json().messages.map((message: { id: string }) => message.id)).toContain(question.id);
      expect((await an('GET', '/messages?view=secret')).statusCode).toBe(400);

      // Opened and read, then answered by the Owner: answered, and unread again for whoever asked.
      expect((await an('GET', `/messages/${question.id}`)).json().message).toMatchObject({ id: question.id, unread: true });
      expect((await an('POST', `/messages/${question.id}/read`)).statusCode).toBe(204);
      expect((await an('GET', '/messages/unread')).json()).toEqual({ unread: 0 });
      const answered = await an('POST', `/messages/${question.id}/replies`, { text: 'Yes, next week.' });
      expect(answered.statusCode).toBe(201);
      expect(answered.json().message).toMatchObject({ state: 'answered', replyCount: 1, replies: [{ type: 'MSG-CNV-04', kind: 'reply', writer: { name: 'Ann', as: 'owner' }, params: { text: 'Yes, next week.' } }] });
      expect((await bert('GET', '/messages?view=unread')).json().messages.map((message: { id: string }) => message.id)).toEqual([question.id]);
      expect((await bert('GET', '/messages?view=written')).json().counts).toMatchObject({ written: 1 });
      expect((await bert('GET', `/messages/on/collection/${talk.id}`)).json().messages).toHaveLength(1);
      expect((await an('GET', `/messages/on/collection/${secret.id}`)).statusCode).toBe(404);
      expect((await an('GET', `/messages/${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}`)).statusCode).toBe(404);

      // Searched by its words, the words of a reply or the name of its object.
      expect((await bert('GET', '/messages?view=everything&search=next%20week')).json().messages.map((message: { id: string }) => message.id)).toEqual([question.id]);
      expect((await bert('GET', '/messages?view=everything&search=Talk')).json().messages.map((message: { id: string }) => message.id)).toContain(question.id);
      expect((await bert('GET', '/messages?view=everything&search=nothing%20like%20it')).json().messages).toEqual([]);

      // A Remark on a private Collection: for its Owner Unit and the Data Team only.
      const remark = (await els('POST', '/messages', { subjectKind: 'collection', subjectId: secret.id, kind: 'remark', text: 'Only for sales.' })).json().message;
      expect(remark.state).toBeNull();
      expect((await an('GET', `/messages/${remark.id}`)).statusCode).toBe(404);
      expect((await an('POST', `/messages/${remark.id}/replies`, { text: 'Me too.' })).statusCode).toBe(404);
      expect((await dirk('GET', `/messages/${remark.id}`)).statusCode).toBe(200);
    });

    it('knows the Lenses from query, and shows the Messages on one only to who sees it (FR-CV-05, DEC-CO-16)', async () => {
      const an = await user('Ann', [CREDIT]);
      const bert = await user('Bert', [BROKERS]);
      const dirk = await user('Dirk', [], ['datateam']);
      const talk = (await an('GET', '/collections')).json().collections.find((one: { name: string }) => one.name === 'Talk');
      const lens = '3d1f3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
      const facts = { name: 'Leads per source', collectionId: talk.id, resourceIds: [], state: 'published', authorId: 'u-Mia', authorName: 'Mia' };
      expect((await fromQuery('PUT', `/internal/lenses/${lens}`, facts, 'someone-else')).statusCode).toBe(401);
      expect((await an('PUT', `/internal/lenses/${lens}`, facts)).statusCode).toBe(401);
      expect((await fromQuery('PUT', `/internal/lenses/${lens}`, { ...facts, state: 'gone' })).statusCode).toBe(400);
      expect((await fromQuery('PUT', `/internal/lenses/${lens}`, facts)).statusCode).toBe(204);

      const signal = await bert('POST', '/messages', { subjectKind: 'lens', subjectId: lens, kind: 'signal', text: 'Mailing dropped to zero.' });
      expect(signal.statusCode).toBe(201);
      expect(signal.json().message).toMatchObject({ kind: 'signal', state: 'open', subject: { kind: 'lens', name: 'Leads per source', collection: { id: talk.id, name: 'Talk' } } });
      // A Signal tells the Owner Unit and the Data Team (MSG-CNV-03).
      const forAn = (await an('GET', '/messages?kind=signal')).json();
      expect(forAn.messages.map((message: { id: string }) => message.id)).toEqual([signal.json().message.id]);
      expect(forAn.counts.on).toMatchObject({ lens: 1 });
      expect((await dirk('GET', '/messages?kind=signal&on=lens')).json().messages).toHaveLength(1);

      // Renamed in query, it shows by its new name; waiting for the Data Team, only its author and the Data Team see it.
      await fromQuery('PUT', `/internal/lenses/${lens}`, { ...facts, name: 'Leads per source name', state: 'waiting' });
      expect((await bert('GET', `/messages/${signal.json().message.id}`)).statusCode).toBe(404);
      expect((await bert('POST', '/messages', { subjectKind: 'lens', subjectId: lens, kind: 'remark', text: 'Hm.' })).statusCode).toBe(404);
      expect((await dirk('GET', `/messages/on/lens/${lens}`)).json().messages[0].subject.name).toBe('Leads per source name');
    });

    it('lets the Data Team decide on a Request: on a query here, on a Lens through query (FR-CV-08, MSG-CNV-05)', async () => {
      const karel = await user('Karel', [DIGIKOM]);
      const mia = await user('Mia', [DIGIKOM]);
      const an = await user('An', [DIGIKOM]);
      const team = await user('Toon', [], ['datateam']);
      const query = '4b1f3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
      const sent = (await karel('POST', '/requests', { type: 'MSG-QRY-01', subjectId: query, subject: 'Partner leads', reads: 4_800_000_000, threshold: 1_000_000_000, text: '' })).json().request;
      // Sent, it is read by its writer, and waits in the Message Centre of the Data Team.
      expect((await karel('GET', `/messages/${sent.id}`)).json().message).toMatchObject({ kind: 'request', state: 'waiting', unread: false, subject: { kind: 'query', name: 'Partner leads' } });
      expect((await an('GET', `/messages/${sent.id}`)).statusCode).toBe(404);
      expect((await team('GET', '/messages?kind=request')).json().messages.map((message: { id: string }) => message.id)).toContain(sent.id);

      expect((await karel('POST', `/messages/${sent.id}/decision`, { outcome: 'accepted' })).statusCode).toBe(403);
      expect((await team('POST', `/messages/${sent.id}/decision`, { outcome: 'refused' })).json().message).toBe('A refusal needs a reason.');
      expect((await team('POST', `/messages/${sent.id}/replies`, { text: 'Hm.' })).statusCode).toBe(409);
      const decided = await team('POST', `/messages/${sent.id}/decision`, { outcome: 'accepted', text: 'Once, for the review.' });
      expect(decided.statusCode).toBe(200);
      expect(decided.json().message).toMatchObject({ state: 'accepted', replies: [{ type: 'MSG-CNV-05', kind: 'decision', writer: { name: 'Toon', as: 'dataTeam' }, params: { outcome: 'accepted', text: 'Once, for the review.' } }] });
      expect((await team('POST', `/messages/${sent.id}/decision`, { outcome: 'accepted' })).json().error).toBe('not_waiting');
      expect((await karel('GET', '/messages/unread')).json().unread).toBeGreaterThanOrEqual(1);
      expect((await karel('GET', `/requests?subjectKind=query&subjectId=${query}`)).json().requests[0]).toMatchObject({ state: 'accepted', decision: { outcome: 'accepted', writerName: 'Toon' } });

      // A Request on a Lens is decided on the Lens: query records the decision with its own token.
      const lens = '5e1f3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
      const onLens = (await mia('POST', '/requests', { type: 'MSG-LEN-01', subjectId: lens, subject: 'All weeks', reads: 6_200_000_000, threshold: 1_000_000_000, text: 'Yearly.' })).json().request;
      expect((await team('POST', `/messages/${onLens.id}/decision`, { outcome: 'accepted' })).json().error).toBe('decided_on_the_lens');
      expect((await fromQuery('POST', `/internal/messages/${onLens.id}/decision`, { outcome: 'refused', text: 'Too big.' })).statusCode).toBe(400);
      const refused = await fromQuery('POST', `/internal/messages/${onLens.id}/decision`, { outcome: 'refused', text: 'Too big.', decider: { id: 'u-Toon', name: 'Toon' } });
      expect(refused.json().message).toMatchObject({ state: 'refused', replies: [{ writer: { id: 'u-Toon', name: 'Toon' }, params: { outcome: 'refused', text: 'Too big.' } }] });
      expect((await team('GET', `/requests?subjectKind=lens&subjectId=${lens}`)).json().requests[0].decision).toMatchObject({ outcome: 'refused', text: 'Too big.' });

      // Data Hub sends its own Request when a Lens grew into very large, one at a time (MSG-LEN-03).
      const grew = await fromQuery('POST', `/internal/lenses/${lens}/requests`, { reads: 1_400_000_000, threshold: 1_000_000_000, partitions: 104 });
      expect(grew.statusCode).toBe(201);
      const again = await fromQuery('POST', `/internal/lenses/${lens}/requests`, { reads: 1_500_000_000, threshold: 1_000_000_000 });
      expect(again.statusCode).toBe(200);
      expect(again.json().request.id).toBe(grew.json().request.id);
      expect((await fromQuery('POST', `/internal/lenses/${lens}/requests`, { reads: 1 }, 'nope')).statusCode).toBe(401);
      expect((await team('GET', `/requests?subjectKind=lens&subjectId=${lens}`)).json().requests[0]).toMatchObject({ type: 'MSG-LEN-03', writerId: '', state: 'waiting' });
    });

    it('enters a Signal on a Resource in its Log (CNV-050)', async () => {
      const dirk = await user('Dirk', [], ['datateam']);
      const cards = (await dirk('GET', '/collections')).json().collections.find((one: { name: string }) => one.name === 'Cards');
      const resource = cards.resources[0].id;
      const signal = (await dirk('POST', '/messages', { subjectKind: 'resource', subjectId: resource, kind: 'signal', text: 'Zero last week.' })).json().message;
      expect(signal.writer.as).toBe('dataTeam');
      const log = (await dirk('GET', `/resources/${resource}/log`)).json().entries;
      expect(log[0]).toMatchObject({ logId: 'CNV-050', text: 'Signal raised by Dirk', params: { conversation: signal.id } });
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

import { randomBytes } from 'node:crypto';
import { TokenError } from '@datahub/auth';
import { createTestIssuer } from '@datahub/auth/testing';
import type { StartingGroup } from '@datahub/contracts';
import { createDatabase, migrate, type Database } from '@datahub/db';
import type { FastifyInstance } from 'fastify';
import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { IdentityDatabase } from './database.js';
import { migrations } from './migrations/index.js';
import { createPermissionGroups } from './permission-groups.js';
import { createStore } from './store.js';
import { createLocalKeyService } from './testing.js';
import { createTokenIssuer } from './tokens.js';

const url = process.env.DATAHUB_TEST_DATABASE_URL;
if (!url && process.env.CI) {
  throw new Error('DATAHUB_TEST_DATABASE_URL must be set in CI');
}

const catalogue = {
  async verify(token: string) {
    if (token !== 'catalogue') throw new TokenError('Service token rejected: not a service account that may call');
    return 'datahub-catalogue@project.iam.gserviceaccount.com';
  },
};

describe.skipIf(!url)('Groups kept in Data Hub (FR-UM-12 to FR-UM-20, TR-UM-02)', () => {
  const schema = `identity_dh_groups_${randomBytes(4).toString('hex')}`;
  let database: Database<IdentityDatabase>;
  let app: FastifyInstance;
  let issuer: Awaited<ReturnType<typeof createTestIssuer>>;
  let store: ReturnType<typeof createStore>;
  /** What catalogue says each Group owns, as its Owner Unit (TR-UM-05). */
  const owned = new Map<string, string[]>();

  beforeAll(async () => {
    database = createDatabase<IdentityDatabase>({ connectionString: url }, schema);
    await migrate({ db: database.db as Kysely<unknown>, schema, migrations, serviceUser: 'postgres' });
    store = createStore(database.db);
    for (const [sub, name] of [
      ['an', 'An Claes'],
      ['jan', 'Jan Peeters'],
      ['dirk', 'Dirk Vos'],
    ] as const) {
      await store.saveUser({ sub, email: `${sub}@immoscoop.be`, name });
    }
    issuer = await createTestIssuer();
    const tokens = createTokenIssuer({ keys: createLocalKeyService(['v1']), signingKey: 'v1', publicKeys: ['v1'], issuer: 'https://identity.test', audience: 'datahub' });
    app = await buildApp({
      verifier: issuer.verifier,
      tokens,
      logger: false,
      peopleCallers: catalogue,
      owners: { collectionsOf: async (id) => ({ count: owned.get(id)?.length ?? 0, names: owned.get(id) ?? [] }) },
      signIn: {
        store,
        google: async () => Promise.reject(new Error('Not used')),
        workspace: { isActive: async () => true },
        tokens,
        issuer: 'https://identity.test',
        domains: ['immoscoop.be', 'thenextimmoscoop.be'],
        mcpRedirectUris: [],
        groups: createPermissionGroups(database.db),
      },
    });
  });

  afterAll(async () => {
    await app?.close();
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(database.db);
    await database.close();
  });

  async function as(sub: string, group: StartingGroup = 'businessAnalyst') {
    const names: Record<string, string> = { an: 'An Claes', jan: 'Jan Peeters', dirk: 'Dirk Vos', mia: 'Mia' };
    const authorization = `Bearer ${await issuer.sign({ sub, email: `${sub}@immoscoop.be`, name: names[sub] ?? sub, as: group })}`;
    return (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, payload?: object) =>
      app.inject({ method, url: path, headers: { authorization }, ...(payload ? { payload } : {}) });
  }

  let sales = '';
  let broker = '';

  it('makes a Group that manages itself, with its maker as first member (FR-UM-13)', async () => {
    const an = await as('an');
    const made = await an('POST', '/groups', { name: 'Sales management', sentence: 'Who leads sales.', managedBy: 'itself' });
    expect(made.statusCode).toBe(201);
    const group = made.json().group;
    sales = group.id;
    expect(group).toMatchObject({
      name: 'Sales management',
      sentence: 'Who leads sales.',
      managedBy: { id: sales, name: 'Sales management', isMember: true },
      memberCount: 1,
      isMember: true,
      mayChange: true,
      createdBy: { id: 'an', name: 'An Claes' },
    });
    expect(group.members).toEqual([expect.objectContaining({ email: 'an@immoscoop.be', name: 'An Claes', signedIn: true, active: true })]);
    expect(group.log.map((entry: { kind: string }) => entry.kind).sort()).toEqual(['added', 'made']);

    // A Lens user may not make groups; a name is unique.
    expect((await (await as('jan', 'lensUser'))('POST', '/groups', { name: 'Mine', managedBy: 'itself' })).json().permission).toBe('groups.manage');
    expect((await an('POST', '/groups', { name: 'sales MANAGEMENT', managedBy: 'itself' })).statusCode).toBe(409);
    expect((await an('POST', '/groups', { name: '', managedBy: 'itself' })).statusCode).toBe(400);
  });

  it('lets a User choose only a Group they are in to manage a new one (DEC-UX-201)', async () => {
    const an = await as('an');
    const made = await an('POST', '/groups', { name: 'Broker team', managedBy: sales });
    expect(made.statusCode).toBe(201);
    broker = made.json().group.id;
    expect(made.json().group.managedBy).toEqual({ id: sales, name: 'Sales management', isMember: true });

    const jan = await as('jan');
    expect((await jan('POST', '/groups', { name: 'Not mine', managedBy: sales })).statusCode).toBe(403);
    expect((await jan('POST', '/groups', { name: 'Unknown', managedBy: 'nope' })).statusCode).toBe(400);
  });

  it('adds colleagues by address of an own domain, also who has not signed in yet (FR-UM-15)', async () => {
    const an = await as('an');
    expect((await an('PUT', `/groups/${broker}/members`, { email: 'Jan@immoscoop.be' })).statusCode).toBe(201);
    const again = await an('PUT', `/groups/${broker}/members`, { email: 'jan@immoscoop.be' });
    expect(again.statusCode).toBe(200);
    const added = await an('PUT', `/groups/${broker}/members`, { email: 'mia@thenextimmoscoop.be' });
    expect(added.json().group.members).toEqual([
      expect.objectContaining({ email: 'an@immoscoop.be', name: 'An Claes' }),
      expect.objectContaining({ email: 'jan@immoscoop.be', name: 'Jan Peeters', signedIn: true, addedBy: { id: 'an', name: 'An Claes' } }),
      expect.objectContaining({ email: 'mia@thenextimmoscoop.be', name: null, signedIn: false }),
    ]);
    expect((await an('PUT', `/groups/${broker}/members`, { email: 'someone@gmail.com' })).json().error).toBe('invalid_email');
    expect((await an('PUT', `/groups/${broker}/members`, { email: 'not an address' })).statusCode).toBe(400);
    // The claim of Jan holds the Group from their next token (TR-UM-03).
    expect(await store.groupsOf('JAN@immoscoop.be')).toEqual([broker]);
  });

  it('lists the Groups a User is in or manages, each with how they stand to it (FR-UM-18)', async () => {
    const mine = (await (await as('an'))('GET', '/me/groups')).json().groups;
    expect(mine.map((group: { name: string; isMember: boolean; mayChange: boolean; memberCount: number }) => [group.name, group.isMember, group.mayChange, group.memberCount])).toEqual([
      ['Broker team', true, true, 3],
      ['Sales management', true, true, 1],
    ]);
    const jans = (await (await as('jan'))('GET', '/me/groups')).json().groups;
    expect(jans).toEqual([expect.objectContaining({ name: 'Broker team', isMember: true, mayChange: false, managedBy: { id: sales, name: 'Sales management', isMember: false } })]);
    // Every Group, only for a Data Admin or who may give a Collection to any Group.
    expect((await (await as('jan'))('GET', '/groups')).statusCode).toBe(403);
    const every = (await (await as('dirk', 'admin'))('GET', '/groups?q=broker')).json().groups;
    expect(every.map((group: { name: string; mayChange: boolean }) => [group.name, group.mayChange])).toEqual([['Broker team', true]]);
  });

  it('shows a Group to any signed-in User, read-only to who does not manage it (FR-UM-18)', async () => {
    const seen = await (await as('dirk'))('GET', `/groups/${broker}`);
    expect(seen.statusCode).toBe(200);
    expect(seen.json().group).toMatchObject({ name: 'Broker team', isMember: false, mayChange: false });
    expect((await (await as('dirk'))('GET', '/groups/nope')).statusCode).toBe(404);
    const jan = await as('jan');
    expect((await jan('PATCH', `/groups/${broker}`, { name: 'Brokers' })).json()).toMatchObject({ error: 'forbidden', managedBy: { name: 'Sales management' } });
    expect((await jan('DELETE', `/groups/${broker}/members/an@immoscoop.be`)).statusCode).toBe(403);
  });

  it('renames a Group, changes its sentence and who manages it, and keeps it in its history (FR-UM-14, FR-UM-17)', async () => {
    const an = await as('an');
    const changed = await an('PATCH', `/groups/${broker}`, { name: 'Brokers', sentence: 'The brokers of Antwerp.', managedBy: 'itself' });
    expect(changed.statusCode).toBe(200);
    expect(changed.json().group).toMatchObject({ name: 'Brokers', sentence: 'The brokers of Antwerp.', managedBy: { id: broker, name: 'Brokers' } });
    expect(changed.json().group.log.slice(0, 3).map((entry: { kind: string }) => entry.kind).sort()).toEqual(['managedBy', 'renamed', 'sentence']);
    expect((await an('PATCH', `/groups/${broker}`, { name: 'Sales management' })).statusCode).toBe(409);
    // Jan, a member of Brokers, now manages it, but cannot hand it to a Group they are not in.
    const jan = await as('jan');
    expect((await jan('PATCH', `/groups/${broker}`, { managedBy: sales })).statusCode).toBe(403);
    // A Data Admin changes every Group, also one they are not in (DEC-UX-201).
    const dirk = await as('dirk', 'admin');
    expect((await dirk('PATCH', `/groups/${broker}`, { managedBy: sales })).json().group.managedBy.name).toBe('Sales management');
  });

  it('takes a member out', async () => {
    const an = await as('an');
    const out = await an('DELETE', `/groups/${broker}/members/${encodeURIComponent('mia@thenextimmoscoop.be')}`);
    expect(out.json().group.members.map((member: { email: string }) => member.email)).toEqual(['an@immoscoop.be', 'jan@immoscoop.be']);
    expect(out.json().group.log[0]).toMatchObject({ kind: 'removed', detail: { email: 'mia@thenextimmoscoop.be' }, by: { id: 'an' } });
  });

  it('suggests colleagues by name or address while adding one (FR-UM-15)', async () => {
    const people = (await (await as('an'))('GET', '/people?q=pee')).json().people;
    expect(people).toEqual([{ email: 'jan@immoscoop.be', name: 'Jan Peeters' }]);
    expect((await (await as('an'))('GET', '/people?q=p')).json().people).toEqual([]);
  });

  it('deletes a Group only once it manages no Group and owns no Collection (FR-UM-16)', async () => {
    const an = await as('an');
    const blocked = await an('DELETE', `/groups/${sales}`);
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toMatchObject({ error: 'still_owns', manages: ['Brokers'] });
    owned.set(broker, ['Leads']);
    expect((await an('DELETE', `/groups/${broker}`)).json()).toMatchObject({ error: 'still_owns', collections: { count: 1, names: ['Leads'] } });
    owned.delete(broker);
    expect((await an('DELETE', `/groups/${broker}`)).statusCode).toBe(204);
    expect((await an('GET', `/groups/${broker}`)).statusCode).toBe(404);
    expect(await store.groupsOf('jan@immoscoop.be')).toEqual([]);
    // Its name is free again.
    expect((await an('POST', '/groups', { name: 'Brokers', managedBy: sales })).statusCode).toBe(201);
  });

  it('moves the Owner Units of Google once, with their members of that day, managing themselves (FR-UM-20, TR-UM-04)', async () => {
    await sql`update users set workspace_groups = '{g-credit}' where google_id in ('jan', 'dirk')`.execute(database.db);
    const move = (payload: object, token = 'catalogue') =>
      app.inject({ method: 'POST', url: '/internal/groups/move', headers: { authorization: `Bearer ${token}` }, payload });
    const first = await move({ groups: [{ id: 'g-credit', name: 'Credit team' }, { id: 'g-empty', name: 'Sales management' }] });
    expect(first.json()).toEqual({ moved: ['g-credit', 'g-empty'] });
    expect((await move({ groups: [{ id: 'g-credit', name: 'Credit team' }] })).json()).toEqual({ moved: [] });
    expect((await move({ groups: 'g-credit' })).statusCode).toBe(400);
    expect((await move({ groups: [] }, 'someone')).statusCode).toBe(401);

    const credit = (await (await as('dirk'))('GET', '/groups/g-credit')).json().group;
    expect(credit).toMatchObject({ name: 'Credit team', managedBy: { id: 'g-credit' }, isMember: true, mayChange: true });
    expect(credit.members.map((member: { email: string }) => member.email)).toEqual(['dirk@immoscoop.be', 'jan@immoscoop.be']);
    expect(credit.log).toEqual([expect.objectContaining({ kind: 'moved', by: { id: null, name: null } })]);
    // A name already taken gets a number.
    expect((await (await as('dirk'))('GET', '/groups/g-empty')).json().group.name).toBe('Sales management (2)');
    expect(await store.groupsOf('jan@immoscoop.be')).toEqual(['g-credit']);
  });
});

import { randomBytes } from 'node:crypto';
import { type ServiceCallerVerifier, TokenError } from '@datahub/auth';
import { createTestIssuer } from '@datahub/auth/testing';
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

// A Postgres to run against: CI starts one; locally, set DATAHUB_TEST_DATABASE_URL.
const url = process.env.DATAHUB_TEST_DATABASE_URL;
if (!url && process.env.CI) {
  throw new Error('DATAHUB_TEST_DATABASE_URL must be set in CI');
}

/** catalogue, as Google would vouch for it. */
const catalogue: ServiceCallerVerifier = {
  async verify(token) {
    if (token !== 'catalogue') throw new TokenError('Service token rejected: not a service account that may call');
    return 'datahub-catalogue@project.iam.gserviceaccount.com';
  },
};

describe.skipIf(!url)('who catalogue notifies (DEC-LN-07)', () => {
  const schema = `identity_people_${randomBytes(4).toString('hex')}`;
  let database: Database<IdentityDatabase>;
  let app: FastifyInstance;
  let caller: Awaited<ReturnType<typeof createTestIssuer>>;
  let store: ReturnType<typeof createStore>;

  beforeAll(async () => {
    database = createDatabase<IdentityDatabase>({ connectionString: url }, schema);
    await migrate({ db: database.db as Kysely<unknown>, schema, migrations, serviceUser: 'postgres' });
    store = createStore(database.db);
    await store.saveUser({ sub: 'jan', email: 'jan@thenextimmoscoop.be', name: 'Jan Peeters' });
    await store.saveUser({ sub: 'an', email: 'an@immoscoop.be', name: 'An Claes' });
    await store.saveUser({ sub: 'dirk', email: 'dirk@immoscoop.be', name: 'Dirk Vos' });
    // Credit has Jan, An and Mia, who has not signed in yet; Sales has Jan.
    await sql`insert into groups (id, name, managed_by) values ('g-credit', 'Credit', 'g-credit'), ('g-sales', 'Sales', 'g-sales')`.execute(database.db);
    await sql`insert into group_members (group_id, email) values ('g-credit', 'jan@thenextimmoscoop.be'), ('g-credit', 'an@immoscoop.be'),
      ('g-credit', 'mia@immoscoop.be'), ('g-sales', 'jan@thenextimmoscoop.be')`.execute(database.db);
    // Dirk is of Admin, the others of the default; only Admin has the Messages for the Data Team.
    await sql`update users set permission_group_id = (select id from permission_groups where starting = 'admin') where google_id = 'dirk'`.execute(database.db);
    await store.saveSetting('an', 'language', 'en');
    caller = await createTestIssuer();
    const tokens = createTokenIssuer({ keys: createLocalKeyService(['v1']), signingKey: 'v1', publicKeys: ['v1'], issuer: 'https://identity.test', audience: 'datahub' });
    app = await buildApp({
      verifier: caller.verifier,
      tokens,
      logger: false,
      peopleCallers: catalogue,
      signIn: {
        store,
        google: async () => {
          throw new Error('Not used');
        },
        workspace: { isActive: async () => true },
        tokens,
        issuer: 'https://identity.test',
        domains: ['thenextimmoscoop.be', 'immoscoop.be'],
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

  const ask = (payload: unknown, token = 'catalogue') => app.inject({ method: 'POST', url: '/internal/people', headers: { authorization: `Bearer ${token}` }, payload: payload as object });

  it('names the members of a Group it knows, the Users with a Permission and the Users asked, each once, in their language (TR-PL-08)', async () => {
    const response = await ask({ users: ['nobody'], groups: ['g-credit'], permissions: ['messages.dataTeam'] });
    expect(response.statusCode).toBe(200);
    expect(response.json().people).toEqual([
      { id: 'an', email: 'an@immoscoop.be', name: 'An Claes', language: 'en', groups: ['g-credit'], permissions: [] },
      { id: 'dirk', email: 'dirk@immoscoop.be', name: 'Dirk Vos', language: 'nl', groups: [], permissions: ['messages.dataTeam'] },
      { id: 'jan', email: 'jan@thenextimmoscoop.be', name: 'Jan Peeters', language: 'nl', groups: ['g-credit'], permissions: [] },
      { id: null, email: 'mia@immoscoop.be', name: '', language: 'nl', groups: ['g-credit'], permissions: [] },
    ]);
    expect((await ask({})).json()).toEqual({ people: [] });
    expect((await ask({ permissions: ['datateam'] })).statusCode).toBe(400);
  });

  it('does not reach a User whose account is no longer active by a Permission or a Group (FR-UM-10)', async () => {
    await store.markInactive('dirk');
    await store.markInactive('an');
    expect((await ask({ permissions: ['messages.dataTeam'] })).json()).toEqual({ people: [] });
    expect((await ask({ groups: ['g-credit'] })).json().people.map((person: { email: string }) => person.email)).toEqual(['jan@thenextimmoscoop.be', 'mia@immoscoop.be']);
    await sql`update users set active = true`.execute(database.db);
  });

  it('answers catalogue only, never an Access Token, and refuses what is no list of IDs', async () => {
    expect((await ask({ groups: ['g-credit'] }, 'someone')).statusCode).toBe(401);
    const user = await caller.sign({ sub: 'jan', as: 'admin' });
    expect((await app.inject({ method: 'POST', url: '/internal/people', headers: { authorization: `Bearer ${user}` }, payload: { groups: ['g-credit'] } })).statusCode).toBe(401);
    expect((await ask({ groups: 'g-credit' })).statusCode).toBe(400);
    expect((await ask({ users: [''] })).statusCode).toBe(400);
  });
});

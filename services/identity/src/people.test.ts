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

  beforeAll(async () => {
    database = createDatabase<IdentityDatabase>({ connectionString: url }, schema);
    await migrate({ db: database.db as Kysely<unknown>, schema, migrations, serviceUser: 'postgres' });
    const store = createStore(database.db);
    await store.saveUser({ sub: 'jan', email: 'jan@thenextimmoscoop.be', name: 'Jan Peeters' });
    await store.saveUser({ sub: 'an', email: 'an@immoscoop.be', name: 'An Claes' });
    await store.saveUser({ sub: 'dirk', email: 'dirk@immoscoop.be', name: 'Dirk Vos' });
    await store.saveGroups('jan', ['g-credit', 'g-sales'], []);
    await store.saveGroups('an', ['g-credit'], []);
    await store.saveGroups('dirk', ['g-datateam'], ['datateam']);
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
        workspace: { isActive: async () => true, groups: async () => [], domainGroups: async () => [] },
        tokens,
        issuer: 'https://identity.test',
        domains: ['thenextimmoscoop.be', 'immoscoop.be'],
        mcpRedirectUris: [],
      },
    });
  });

  afterAll(async () => {
    await app?.close();
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(database.db);
    await database.close();
  });

  const ask = (payload: unknown, token = 'catalogue') => app.inject({ method: 'POST', url: '/internal/people', headers: { authorization: `Bearer ${token}` }, payload: payload as object });

  it('names the members of a Group it knows, the holders of a role and the Users asked, each once, in their language', async () => {
    const response = await ask({ users: ['dirk', 'nobody'], groups: ['g-credit'], roles: ['datateam'] });
    expect(response.statusCode).toBe(200);
    expect(response.json().people).toEqual([
      { id: 'an', email: 'an@immoscoop.be', name: 'An Claes', language: 'en', groups: ['g-credit'], roles: [] },
      { id: 'dirk', email: 'dirk@immoscoop.be', name: 'Dirk Vos', language: 'nl', groups: [], roles: ['datateam'] },
      { id: 'jan', email: 'jan@thenextimmoscoop.be', name: 'Jan Peeters', language: 'nl', groups: ['g-credit'], roles: [] },
    ]);
    expect((await ask({})).json()).toEqual({ people: [] });
  });

  it('answers catalogue only, never an Access Token, and refuses what is no list of IDs', async () => {
    expect((await ask({ groups: ['g-credit'] }, 'someone')).statusCode).toBe(401);
    const user = await caller.sign({ sub: 'jan', roles: ['datateam'] });
    expect((await app.inject({ method: 'POST', url: '/internal/people', headers: { authorization: `Bearer ${user}` }, payload: { groups: ['g-credit'] } })).statusCode).toBe(401);
    expect((await ask({ groups: 'g-credit' })).statusCode).toBe(400);
    expect((await ask({ users: [''] })).statusCode).toBe(400);
  });
});

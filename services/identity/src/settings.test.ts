import { randomBytes } from 'node:crypto';
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

describe.skipIf(!url)('the settings of a User (DEC-UX-96)', () => {
  const schema = `identity_settings_${randomBytes(4).toString('hex')}`;
  let database: Database<IdentityDatabase>;
  let app: FastifyInstance;
  let caller: Awaited<ReturnType<typeof createTestIssuer>>;
  const tokens = createTokenIssuer({
    keys: createLocalKeyService(['v1']),
    signingKey: 'v1',
    publicKeys: ['v1'],
    issuer: 'https://identity.test',
    audience: 'datahub',
  });

  beforeAll(async () => {
    database = createDatabase<IdentityDatabase>({ connectionString: url }, schema);
    await migrate({ db: database.db as Kysely<unknown>, schema, migrations, serviceUser: 'postgres' });
    const store = createStore(database.db);
    // Users exist once they signed in (FR-UM-03).
    await store.saveUser({ sub: 'jan', email: 'jan@thenextimmoscoop.be', name: 'Jan Peeters' });
    await store.saveUser({ sub: 'an', email: 'an@immoscoop.be', name: 'An Claes' });
    caller = await createTestIssuer();
    app = await buildApp({
      verifier: caller.verifier,
      tokens,
      logger: false,
      signIn: {
        store,
        google: async () => {
          throw new Error('Not used');
        },
        workspace: {
          isActive: async () => true,
          groups: async () => [],
        },
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

  const as = async (sub: string) => ({ authorization: `Bearer ${await caller.sign({ sub })}` });

  it('keeps a setting per User, and changes it in place', async () => {
    const jan = await as('jan');
    expect((await app.inject({ url: '/me/settings', headers: jan })).json()).toEqual({ settings: {} });

    for (const [key, value] of [['language', 'en'], ['theme', 'dark'], ['background.dark', 'aurora'], ['panel.open', false], ['intro.collections', 2]] as const) {
      const saved = await app.inject({ method: 'PUT', url: `/me/settings/${key}`, headers: jan, payload: { value } });
      expect(saved.statusCode).toBe(204);
    }
    await app.inject({ method: 'PUT', url: '/me/settings/language', headers: jan, payload: { value: 'nl' } });

    expect((await app.inject({ url: '/me/settings', headers: jan })).json().settings).toEqual({
      language: 'nl',
      theme: 'dark',
      'background.dark': 'aurora',
      'panel.open': false,
      'intro.collections': 2,
    });
    // Another User sees only their own.
    expect((await app.inject({ url: '/me/settings', headers: await as('an') })).json()).toEqual({ settings: {} });
  });

  it('forgets a setting, so that its default applies again', async () => {
    const an = await as('an');
    await app.inject({ method: 'PUT', url: '/me/settings/theme', headers: an, payload: { value: 'light' } });
    expect((await app.inject({ method: 'DELETE', url: '/me/settings/theme', headers: an })).statusCode).toBe(204);
    expect((await app.inject({ url: '/me/settings', headers: an })).json()).toEqual({ settings: {} });
  });

  it('refuses a key it does not keep and a value that does not fit', async () => {
    const jan = await as('jan');
    expect((await app.inject({ method: 'PUT', url: '/me/settings/password', headers: jan, payload: { value: 'x' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PUT', url: '/me/settings/language', headers: jan, payload: { value: 'fr' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: '/me/settings/panel.open', headers: jan, payload: { value: 'yes' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: '/me/settings/intro.collections', headers: jan, payload: {} })).statusCode).toBe(400);
  });

  it('needs an Access Token', async () => {
    expect((await app.inject({ url: '/me/settings' })).statusCode).toBe(401);
  });
});

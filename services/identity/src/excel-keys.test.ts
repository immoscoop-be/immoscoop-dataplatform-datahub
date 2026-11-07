import { randomBytes } from 'node:crypto';
import { type ServiceCallerVerifier, TokenError } from '@datahub/auth';
import { createTestIssuer } from '@datahub/auth/testing';
import { type Permissions, type StartingGroup, startingPermissions } from '@datahub/contracts';
import { createDatabase, migrate, type Database } from '@datahub/db';
import type { FastifyInstance } from 'fastify';
import { decodeJwt } from 'jose';
import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { IdentityDatabase } from './database.js';
import { createExcelKeys, type KeyNotice } from './excel-keys.js';
import { migrations } from './migrations/index.js';
import { createPermissionGroups } from './permission-groups.js';
import { createStore } from './store.js';
import { createLocalKeyService } from './testing.js';
import { createTokenIssuer } from './tokens.js';

const url = process.env.DATAHUB_TEST_DATABASE_URL;
if (!url && process.env.CI) {
  throw new Error('DATAHUB_TEST_DATABASE_URL must be set in CI');
}

/** A service account, as Google would vouch for it. */
const only = (name: string): ServiceCallerVerifier => ({
  async verify(token) {
    if (token !== name) throw new TokenError('Service token rejected: not a service account that may call');
    return `datahub-${name}@project.iam.gserviceaccount.com`;
  },
});

describe.skipIf(!url)('Excel keys (FR-PL-01 to FR-PL-03, TR-PF-07)', () => {
  const schema = `identity_keys_${randomBytes(4).toString('hex')}`;
  let database: Database<IdentityDatabase>;
  let app: FastifyInstance;
  let issuer: Awaited<ReturnType<typeof createTestIssuer>>;
  const told: KeyNotice[] = [];
  const active = new Set(['an', 'dirk']);
  let clock = new Date('2026-10-31T09:00:00Z');

  beforeAll(async () => {
    database = createDatabase<IdentityDatabase>({ connectionString: url }, schema);
    await migrate({ db: database.db as Kysely<unknown>, schema, migrations, serviceUser: 'postgres' });
    const store = createStore(database.db);
    await store.saveUser({ sub: 'an', email: 'an@immoscoop.be', name: 'An Claes' });
    await store.saveUser({ sub: 'dirk', email: 'dirk@immoscoop.be', name: 'Dirk Vos' });
    issuer = await createTestIssuer();
    const tokens = createTokenIssuer({ keys: createLocalKeyService(['v1']), signingKey: 'v1', publicKeys: ['v1'], issuer: 'https://identity.test', audience: 'datahub' });
    const workspace = {
      isActive: async (googleId: string) => active.has(googleId),
      groups: async (email: string) => (email.startsWith('an') ? [{ id: 'g-credit', email: 'credit@immoscoop.be', name: 'Credit' }] : []),
      domainGroups: async () => [],
    };
    app = await buildApp({
      verifier: issuer.verifier,
      tokens,
      logger: false,
      signIn: { store, google: async () => Promise.reject(new Error('Not used')), workspace, tokens, issuer: 'https://identity.test', domains: ['immoscoop.be'], mcpRedirectUris: [], groups: createPermissionGroups(database.db) },
      excelKeys: {
        keys: createExcelKeys(database.db, () => clock),
        exchangers: only('query'),
        schedulers: only('scheduler'),
        notices: { tell: async (notice) => void told.push(notice) },
      },
    });
  });

  afterAll(async () => {
    await app?.close();
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(database.db);
    await database.close();
  });

  async function as(sub: string, group: StartingGroup = 'businessAnalyst', permissions?: Permissions) {
    const authorization = `Bearer ${await issuer.sign({ sub, name: sub === 'an' ? 'An Claes' : 'Dirk Vos', groups: [], as: group, ...(permissions ? { permissions } : {}) })}`;
    return (method: 'GET' | 'POST' | 'DELETE', path: string, payload?: object) => app.inject({ method, url: path, headers: { authorization }, ...(payload ? { payload } : {}) });
  }
  const exchange = (key: string, token = 'query') => app.inject({ method: 'POST', url: '/internal/excel-keys/exchange', headers: { authorization: `Bearer ${token}` }, payload: { key } });

  it('shows a key once, keeps only its hash, and exchanges it for an Access Token of its User', async () => {
    const an = await as('an');
    const made = await an('POST', '/me/excel-keys', { name: ' Excel on my laptop ' });
    expect(made.statusCode).toBe(201);
    const { key, secret } = made.json();
    expect(secret).toMatch(/^dhx_[\w-]{32}$/);
    expect(key).toMatchObject({ name: 'Excel on my laptop', lastUsedAt: null, revokedAt: null, expiresAt: '2027-10-31T09:00:00.000Z' });
    const stored = await sql<{ keyHash: string }>`select key_hash from ${sql.table('excel_keys')}`.execute(database.db);
    expect(JSON.stringify(stored.rows)).not.toContain(secret);

    const exchanged = await exchange(secret);
    expect(exchanged.statusCode).toBe(200);
    expect(decodeJwt(exchanged.json().accessToken)).toMatchObject({ sub: 'an', email: 'an@immoscoop.be', groups: ['g-credit'] });
    expect((await an('GET', '/me/excel-keys')).json().keys[0].lastUsedAt).toBe('2026-10-31T09:00:00.000Z');

    // Only query exchanges a key, and a key that is not known is refused.
    expect((await exchange(secret, 'catalogue')).statusCode).toBe(401);
    expect((await exchange('dhx_not-a-key')).json().error).toBe('invalid_key');
    expect((await an('POST', '/me/excel-keys', { name: '' })).statusCode).toBe(400);
  });

  it('stops a key once revoked, expired, or when its User can no longer sign in (FR-PL-02, FR-PL-03)', async () => {
    const an = await as('an');
    const dirk = await as('dirk', 'admin');
    const first = (await an('POST', '/me/excel-keys', { name: 'Sales dashboard' })).json();
    // Nobody revokes the key of someone else on My page.
    expect((await dirk('DELETE', `/me/excel-keys/${first.key.id}`)).statusCode).toBe(404);
    expect((await an('DELETE', `/me/excel-keys/${first.key.id}`)).statusCode).toBe(204);
    expect((await exchange(first.secret)).statusCode).toBe(401);
    expect((await an('GET', '/me/excel-keys')).json().keys.find((key: { id: string }) => key.id === first.key.id)).toMatchObject({ revokedBy: 'An Claes', revokedById: 'an' });

    const second = (await an('POST', '/me/excel-keys', { name: 'Monthly KBC report' })).json();
    active.delete('an');
    expect((await exchange(second.secret)).statusCode).toBe(401);
    active.add('an');
    expect((await exchange(second.secret)).statusCode).toBe(200);
    clock = new Date('2027-11-01T09:00:00Z');
    expect((await exchange(second.secret)).statusCode).toBe(401);
    clock = new Date('2026-10-31T09:00:00Z');
  });

  it('lets the Data Team list and revoke any key, and tells its User (FR-PL-03, MSG-KEY-02)', async () => {
    const an = await as('an');
    const dirk = await as('dirk', 'admin');
    const made = (await an('POST', '/me/excel-keys', { name: 'Old laptop' })).json();
    expect((await an('GET', '/excel-keys')).statusCode).toBe(403);
    expect((await an('DELETE', `/excel-keys/${made.key.id}`)).statusCode).toBe(403);
    const all = (await dirk('GET', '/excel-keys')).json().keys;
    expect(all.find((key: { id: string }) => key.id === made.key.id)).toMatchObject({ name: 'Old laptop', user: { id: 'an', name: 'An Claes', email: 'an@immoscoop.be' } });
    expect((await dirk('DELETE', `/excel-keys/${made.key.id}`)).statusCode).toBe(204);
    expect(told).toContainEqual({ type: 'MSG-KEY-02', keyId: made.key.id, userId: 'an', name: 'Old laptop', actor: 'Dirk Vos' });
    expect((await exchange(made.secret)).statusCode).toBe(401);
    // Revoked twice tells nobody twice.
    expect((await dirk('DELETE', `/excel-keys/${made.key.id}`)).statusCode).toBe(204);
    expect(told.filter((notice) => notice.keyId === made.key.id)).toHaveLength(1);
  });

  it('tells a User once that their key expires within a month (FR-PL-03, MSG-KEY-01)', async () => {
    const an = await as('an');
    const made = (await an('POST', '/me/excel-keys', { name: 'Expiring' })).json();
    const ask = (token = 'scheduler') => app.inject({ method: 'POST', url: '/internal/excel-keys/expiring', headers: { authorization: `Bearer ${token}` } });
    expect((await ask('query')).statusCode).toBe(401);
    expect((await ask()).json()).toEqual({ expiring: 0, told: 0 });
    clock = new Date('2027-10-10T09:00:00Z');
    const first = (await ask()).json();
    expect(first.told).toBeGreaterThan(0);
    expect(told).toContainEqual({ type: 'MSG-KEY-01', keyId: made.key.id, userId: 'an', name: 'Expiring', expires: '2027-10-31' });
    expect((await ask()).json()).toEqual({ expiring: 0, told: 0 });
    clock = new Date('2026-10-31T09:00:00Z');
  });

  it('makes keys only with excel.keys, below its number, for the life it gives (EC-PL-04)', async () => {
    const without = startingPermissions('businessAnalyst');
    without['excel.keys'] = { on: false, values: without['excel.keys'].values };
    expect((await (await as('an', 'businessAnalyst', without))('POST', '/me/excel-keys', { name: 'Not allowed' })).statusCode).toBe(403);

    const one = startingPermissions('businessAnalyst');
    one['excel.keys'] = { on: true, values: { most: 1, lifetimeDays: 30 } };
    const before = (await (await as('dirk', 'businessAnalyst', one))('GET', '/me/excel-keys')).json().keys.filter((key: { revokedAt: string | null }) => !key.revokedAt).length;
    const dirk = await as('dirk', 'businessAnalyst', one);
    if (before === 0) {
      const made = await dirk('POST', '/me/excel-keys', { name: 'Thirty days' });
      expect(made.statusCode).toBe(201);
      const days = (new Date(made.json().key.expiresAt).getTime() - new Date(made.json().key.createdAt).getTime()) / 86_400_000;
      expect(Math.round(days)).toBe(30);
    }
    expect((await dirk('POST', '/me/excel-keys', { name: 'One too many' })).json().error).toBe('too_many');
  });

  it('gives Excel nothing for a User whose Permission group does not use Excel keys (EC-PL-04)', async () => {
    const made = (await (await as('an'))('POST', '/me/excel-keys', { name: 'Stopped by the group' })).json();
    expect((await exchange(made.secret)).statusCode).toBe(200);
    await sql`update permission_groups set permissions = jsonb_set(permissions, '{excel.keys,on}', 'false') where is_default`.execute(database.db);
    expect((await exchange(made.secret)).statusCode).toBe(401);
    await sql`update permission_groups set permissions = jsonb_set(permissions, '{excel.keys,on}', 'true') where is_default`.execute(database.db);
  });

  it('carries the Permissions of the Permission group of its User in the Access Token of a key (TR-PL-05)', async () => {
    const made = (await (await as('an'))('POST', '/me/excel-keys', { name: 'With Permissions' })).json();
    const claims = decodeJwt((await exchange(made.secret)).json().accessToken);
    expect(claims).toMatchObject({ permissionGroup: { name: 'Lens user' } });
    expect((claims.permissions as Permissions)['queries.make'].on).toBe(false);
  });
});

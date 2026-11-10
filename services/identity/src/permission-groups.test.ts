import { randomBytes } from 'node:crypto';
import { createTestIssuer } from '@datahub/auth/testing';
import { startingPermissions, type StartingGroup } from '@datahub/contracts';
import { createDatabase, migrate, type Database } from '@datahub/db';
import type { FastifyInstance } from 'fastify';
import { type Kysely, sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { IdentityDatabase } from './database.js';
import { migrations } from './migrations/index.js';
import { changesBetween, createPermissionGroups, type UserNotice } from './permission-groups.js';
import { createStore } from './store.js';
import { createLocalKeyService } from './testing.js';
import { createTokenIssuer } from './tokens.js';

const url = process.env.DATAHUB_TEST_DATABASE_URL;
if (!url && process.env.CI) {
  throw new Error('DATAHUB_TEST_DATABASE_URL must be set in CI');
}

describe('what a User gains and loses between two Permission groups (FR-PL-07, FR-PL-12)', () => {
  it('names the Permissions turned on, turned off, and changed', () => {
    const { gains, losses } = changesBetween(startingPermissions('lensUser'), startingPermissions('businessAnalyst'));
    expect(gains).toContain('Make and run queries');
    expect(gains).toContain('How a result reaches Claude, changed');
    expect(losses).toEqual([]);
    expect(changesBetween(startingPermissions('businessAnalyst'), startingPermissions('lensUser')).losses).toContain('Make and run queries');
  });
});

describe.skipIf(!url)('Users and Permission groups in Admin (FR-PL-06 to FR-PL-11, TR-PL-07)', () => {
  const schema = `identity_groups_${randomBytes(4).toString('hex')}`;
  let database: Database<IdentityDatabase>;
  let app: FastifyInstance;
  let issuer: Awaited<ReturnType<typeof createTestIssuer>>;
  const told: UserNotice[] = [];

  beforeAll(async () => {
    database = createDatabase<IdentityDatabase>({ connectionString: url }, schema);
    await migrate({ db: database.db as Kysely<unknown>, schema, migrations, serviceUser: 'postgres' });
    const store = createStore(database.db);
    for (const [sub, name] of [
      ['max', 'Max Passenier'],
      ['an', 'An Claes'],
      ['ruth', 'Ruth Aerts'],
    ]) {
      await store.saveUser({ sub: sub!, email: `${sub}@immoscoop.be`, name: name! });
      await createPermissionGroups(database.db).noteFirstSignIn(sub!);
    }
    await sql`update users set permission_group_id = (select id from permission_groups where starting = 'admin') where google_id = 'max'`.execute(database.db);
    issuer = await createTestIssuer();
    const tokens = createTokenIssuer({ keys: createLocalKeyService(['v1']), signingKey: 'v1', publicKeys: ['v1'], issuer: 'https://identity.test', audience: 'datahub' });
    app = await buildApp({
      verifier: issuer.verifier,
      tokens,
      logger: false,
      signIn: {
        store,
        google: async () => Promise.reject(new Error('Not used')),
        workspace: { isActive: async () => true },
        tokens,
        issuer: 'https://identity.test',
        domains: ['immoscoop.be'],
        mcpRedirectUris: [],
        groups: createPermissionGroups(database.db),
        userNotices: { tellUser: async (notice) => void told.push(notice) },
      },
    });
  });

  afterAll(async () => {
    await app?.close();
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(database.db);
    await database.close();
  });

  async function as(sub: string, group: StartingGroup = 'admin') {
    const authorization = `Bearer ${await issuer.sign({ sub, name: sub, as: group })}`;
    return (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, payload?: object) =>
      app.inject({ method, url: path, headers: { authorization }, ...(payload ? { payload } : {}) });
  }
  const groupNamed = async (name: string) => {
    const max = await as('max');
    return ((await max('GET', '/permission-groups')).json().groups as { id: string; name: string }[]).find((group) => group.name === name)!;
  };

  it('lists every User with their Permission group, only to who may open Users (FR-PL-06)', async () => {
    const analyst = await as('an', 'businessAnalyst');
    const refused = await analyst('GET', '/users');
    expect(refused.statusCode).toBe(403);
    expect(refused.json().permission).toBe('admin.open');
    const users = (await (await as('max'))('GET', '/users')).json().users;
    expect(users.map((user: { googleId: string; permissionGroup: { name: string } }) => [user.googleId, user.permissionGroup.name]).sort()).toEqual([
      ['an', 'Lens user'],
      ['max', 'Admin'],
      ['ruth', 'Lens user'],
    ]);
    expect(users[0]).toMatchObject({ uses: { web: false, claude: false, excel: false }, active: true });
  });

  it('lists the groups with their Users, the default and Admin locked (FR-PL-09)', async () => {
    const groups = (await (await as('max'))('GET', '/permission-groups')).json().groups;
    expect(groups.map((group: { name: string; users: number; isDefault: boolean; locked: boolean }) => [group.name, group.users, group.isDefault, group.locked])).toEqual([
      ['Admin', 1, false, true],
      ['Business analyst', 0, false, false],
      ['Lens user', 2, true, false],
    ]);
  });

  it('moves a User, keeps it in their history, and tells them what changed (FR-PL-07, FR-PL-12)', async () => {
    const analyst = await groupNamed('Business analyst');
    const moved = await (await as('max'))('PUT', '/users/an/permission-group', { groupId: analyst.id });
    expect(moved.statusCode).toBe(200);
    expect(moved.json().user.permissionGroup.name).toBe('Business analyst');
    const one = (await (await as('max'))('GET', '/users/an')).json();
    expect(one.history[0]).toMatchObject({ from: 'Lens user', to: 'Business analyst', by: 'max' });
    expect(one.history.at(-1)).toMatchObject({ to: 'Lens user', from: null });
    expect(told.at(-1)).toMatchObject({ type: 'MSG-USR-01', userId: 'an', from: 'Lens user', to: 'Business analyst', deleted: false });
    expect((told.at(-1) as { gains: string[] }).gains).toContain('Make and run queries');
  });

  it('keeps anyone from changing their own group, and Admin from losing its last User (FR-PL-08)', async () => {
    const lens = await groupNamed('Lens user');
    expect((await (await as('max'))('PUT', '/users/max/permission-group', { groupId: lens.id })).json().error).toBe('own_group');
    await sql`update users set permission_group_id = (select id from permission_groups where starting = 'admin') where google_id = 'ruth'`.execute(database.db);
    const ruth = await as('ruth');
    // Ruth moves Max out: Admin keeps Ruth; then Max, back as Admin in the token, cannot move Ruth, its last User.
    expect((await ruth('PUT', '/users/max/permission-group', { groupId: lens.id })).statusCode).toBe(200);
    expect((await (await as('max'))('PUT', '/users/ruth/permission-group', { groupId: lens.id })).json().error).toBe('last_admin');
    await sql`update users set permission_group_id = (select id from permission_groups where starting = 'admin') where google_id = 'max'`.execute(database.db);
  });

  it('changes the Permissions of a group, checked against the catalogue, and never those of Admin (FR-PL-05, FR-PL-09)', async () => {
    const max = await as('max');
    const analyst = await groupNamed('Business analyst');
    const permissions = startingPermissions('businessAnalyst');
    permissions['runs.ranges'].values = { freeMb: 50, approveGb: 2, above: 'refuse' };
    const changed = await max('PATCH', `/permission-groups/${analyst.id}`, { permissions, sentence: 'Queries up to 2 GB' });
    expect(changed.statusCode).toBe(200);
    expect(changed.json().group.permissions['runs.ranges'].values.freeMb).toBe(50);
    permissions['catalogue.see'].values = { see: 'everyone' };
    expect((await max('PATCH', `/permission-groups/${analyst.id}`, { permissions })).json().error).toBe('invalid_permissions');
    const admin = await groupNamed('Admin');
    expect((await max('PATCH', `/permission-groups/${admin.id}`, { name: 'Gods' })).json().error).toBe('locked');
    expect((await (await as('an', 'businessAnalyst'))('PATCH', `/permission-groups/${analyst.id}`, { name: 'Mine' })).statusCode).toBe(403);
  });

  it('makes a group as a copy, makes it the default, and deletes it with a move of its Users (FR-PL-10)', async () => {
    const max = await as('max');
    const lens = await groupNamed('Lens user');
    const made = await max('POST', '/permission-groups', { name: 'Sales leads', sentence: 'Lenses on leads', from: lens.id });
    expect(made.statusCode).toBe(201);
    const sales = made.json().group;
    expect(sales.permissions['claude.results'].values.show).toBe('card');
    expect((await max('POST', '/permission-groups', { name: 'sales LEADS', from: null })).json().error).toBe('name_taken');
    expect((await max('PUT', `/permission-groups/${sales.id}/default`)).json().group.isDefault).toBe(true);
    await max('PUT', '/users/ruth/permission-group', { groupId: sales.id });
    const admin = await groupNamed('Admin');
    expect((await max('DELETE', `/permission-groups/${sales.id}`, { moveTo: admin.id })).json().error).toBe('invalid_move');
    const deleted = await max('DELETE', `/permission-groups/${sales.id}`, { moveTo: lens.id });
    expect(deleted.statusCode).toBe(204);
    const groups = (await max('GET', '/permission-groups')).json().groups as { name: string; isDefault: boolean }[];
    expect(groups.find((group) => group.isDefault)?.name).toBe('Lens user');
    expect(told.at(-1)).toMatchObject({ type: 'MSG-USR-01', userId: 'ruth', from: 'Sales leads', to: 'Lens user', deleted: true });
    expect((await max('DELETE', `/permission-groups/${admin.id}`, { moveTo: lens.id })).json().error).toBe('locked');
  });

  it('gives the token of a User the Permissions of their group as it is now (TR-PL-05)', async () => {
    const claims = await createPermissionGroups(database.db).claimsOf('an');
    expect(claims.permissionGroup.name).toBe('Business analyst');
    expect(claims.permissions['runs.ranges'].values).toEqual({ freeMb: 50, approveGb: 2, above: 'refuse' });
  });
});

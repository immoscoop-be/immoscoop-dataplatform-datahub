import { randomBytes } from 'node:crypto';
import { startingPermissions } from '@datahub/contracts';
import { createDatabase, migrate, type Database } from '@datahub/db';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Catalogue, CatalogueUnavailable, type ProjectNotice } from './catalogue.js';
import type { QueryDatabase } from './database.js';
import { migrations } from './migrations/index.js';
import { projectRoutes } from './project-api.js';
import { createProjects } from './projects.js';
import { createQueries, type Viewer } from './queries.js';

const url = process.env.DATAHUB_TEST_DATABASE_URL;
if (!url && process.env.CI) {
  throw new Error('DATAHUB_TEST_DATABASE_URL must be set in CI');
}

const PEOPLE: Record<string, string> = { '101': 'An Claes', '102': 'Karel Leys', '103': 'Lotte Dewulf' };

describe.skipIf(!url)('who is told about a Project (MSG-QRY-03 to MSG-QRY-05, OP-UX-100, OP-UX-101)', () => {
  const schema = `query_projects_${randomBytes(4).toString('hex')}`;
  let admin: Database<unknown>;
  let database: Database<QueryDatabase>;
  let app: FastifyInstance;
  /** What query told catalogue; while down, catalogue does not answer. */
  let told: ProjectNotice[] = [];
  let down = false;

  beforeAll(async () => {
    admin = createDatabase<unknown>({ connectionString: url }, schema);
    await migrate({ db: admin.db, schema, migrations, serviceUser: 'postgres' });
    database = createDatabase<QueryDatabase>({ connectionString: url }, schema);
    const projects = createProjects(database.db);
    const queries = createQueries(database.db);
    const catalogue = {
      async resource() {
        return null;
      },
      async projectNotice(notice: ProjectNotice) {
        if (down) throw new CatalogueUnavailable('down');
        told.push(notice);
      },
    } as unknown as Catalogue;
    app = Fastify();
    // Who calls, by the header of the test, as the Access Token would say; a Business analyst makes queries.
    app.addHook('onRequest', async (request) => {
      const id = String(request.headers['x-user'] ?? '');
      request.user = { sub: id, name: PEOPLE[id] ?? '', email: `${id}@immoscoop.be`, groups: [], permissions: startingPermissions('businessAnalyst') } as unknown as NonNullable<FastifyRequest['user']>;
    });
    const viewer = (request: FastifyRequest): Viewer => ({ id: request.user?.sub ?? '', name: request.user?.name ?? '' });
    await projectRoutes(app, {
      projects,
      queries,
      catalogue,
      viewer,
      authorization: () => 'Bearer test',
      writable: async (request, query) => query.ownerId === viewer(request).id || (await projects.ofQuery(query.id, viewer(request).id))?.member === true,
      unavailable: (error) => {
        throw error;
      },
    });
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    await database?.close();
    await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(admin.db);
    await admin?.close();
  });

  beforeEach(() => {
    told = [];
    down = false;
  });

  const call = (user: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, payload?: object) =>
    app.inject({ method, url: path, headers: { 'x-user': user }, ...(payload === undefined ? {} : { payload }) });

  /** A Project of An with two of her queries and one of Karel's, Karel and Lotte in it. */
  async function project(): Promise<string> {
    const queries = createQueries(database.db);
    const mine = await Promise.all(['Leads per source', 'Weekly leads'].map((name) => queries.create({ owner: { id: '101', name: 'An Claes' }, name, question: '', resources: [], sql: '' })));
    const made = await call('101', 'POST', '/projects', { name: 'Credit leads Q4', queries: mine.map((query) => query.id) });
    expect(made.statusCode).toBe(201);
    const id = made.json().project.id as string;
    expect((await call('101', 'PUT', `/projects/${id}/members/102`, { name: 'Karel Leys' })).statusCode).toBe(201);
    expect((await call('101', 'PUT', `/projects/${id}/members/103`, { name: 'Lotte Dewulf', canQuery: false })).statusCode).toBe(201);
    const karels = await queries.create({ owner: { id: '102', name: 'Karel Leys' }, name: 'Karel per week', question: '', resources: [], sql: '' });
    expect((await call('102', 'PUT', `/projects/${id}/queries/${karels.id}`)).statusCode).toBe(200);
    return id;
  }

  it('tells a colleague added that it was shared with them, how many queries it holds and whether they may run them (MSG-QRY-03)', async () => {
    const id = await project();
    expect(told).toEqual([
      { type: 'MSG-QRY-03', recipient: { id: '102', name: 'Karel Leys' }, projectId: id, project: 'Credit leads Q4', actor: 'An Claes', queries: 2, canRun: true },
      { type: 'MSG-QRY-03', recipient: { id: '103', name: 'Lotte Dewulf' }, projectId: id, project: 'Credit leads Q4', actor: 'An Claes', queries: 2, canRun: false },
    ]);
    told = [];
    // Added again, or adding oneself, tells nobody; whether one may run queries is true or false.
    expect((await call('102', 'PUT', `/projects/${id}/members/103`, { name: 'Lotte Dewulf' })).statusCode).toBe(200);
    expect((await call('101', 'PUT', `/projects/${id}/members/104`, { name: 'Mo', canQuery: 'no' })).statusCode).toBe(400);
    expect(told).toEqual([]);
  });

  it('tells a colleague taken out, and nobody when someone leaves (MSG-QRY-04)', async () => {
    const id = await project();
    told = [];
    expect((await call('102', 'DELETE', `/projects/${id}/members/103`)).json()).toEqual({ left: 2, deleted: false });
    expect(told).toEqual([{ type: 'MSG-QRY-04', recipient: { id: '103', name: 'Lotte Dewulf' }, projectId: id, project: 'Credit leads Q4', actor: 'Karel Leys' }]);
    told = [];
    expect((await call('102', 'DELETE', `/projects/${id}/members/102`)).json()).toEqual({ left: 1, deleted: false });
    // Someone not in it, taken out, tells nobody either.
    expect((await call('101', 'DELETE', `/projects/${id}/members/999`)).statusCode).toBe(200);
    expect(told).toEqual([]);
  });

  it('tells everyone else in a deleted Project, why, and how many of its queries they made (MSG-QRY-05)', async () => {
    const id = await project();
    told = [];
    expect((await call('101', 'DELETE', `/projects/${id}`, { reason: ' The quarter is closed. ' })).statusCode).toBe(204);
    expect(told).toEqual([
      { type: 'MSG-QRY-05', recipient: { id: '102', name: 'Karel Leys' }, projectId: id, project: 'Credit leads Q4', actor: 'An Claes', mine: 1, reason: 'The quarter is closed.' },
      { type: 'MSG-QRY-05', recipient: { id: '103', name: 'Lotte Dewulf' }, projectId: id, project: 'Credit leads Q4', actor: 'An Claes', mine: 0, reason: 'The quarter is closed.' },
    ]);
  });

  it('archives a Project for one User only, out of their panel, and puts it back; nobody is told (DEC-UX-354, DEC-UX-355, DEC-UX-356)', async () => {
    const id = await project();
    told = [];
    const listed = async (user: string) => (await call(user, 'GET', '/projects')).json().projects.find((one: { id: string }) => one.id === id) as { archivedAt: string | null; updatedAt: string };
    const before = await listed('101');
    expect(before.archivedAt).toBeNull();
    const archived = await call('101', 'PUT', `/projects/${id}/archive`);
    expect(archived.statusCode).toBe(200);
    expect(archived.json().archivedAt).toEqual(expect.any(String));
    // Archived for An, listed with when; still in the panel of Karel, and the Project itself did not change.
    expect((await listed('101')).archivedAt).toBe(archived.json().archivedAt);
    expect((await listed('101')).updatedAt).toBe(before.updatedAt);
    expect((await listed('102')).archivedAt).toBeNull();
    // Archived again keeps when it was first archived; its page says so to An only.
    expect((await call('101', 'PUT', `/projects/${id}/archive`)).json().archivedAt).toBe(archived.json().archivedAt);
    expect((await call('101', 'GET', `/projects/${id}`)).json().project.archivedAt).toBe(archived.json().archivedAt);
    expect((await call('102', 'GET', `/projects/${id}`)).json().project.archivedAt).toBeNull();
    // Back in her panel.
    expect((await call('101', 'DELETE', `/projects/${id}/archive`)).json()).toEqual({ archivedAt: null });
    expect((await listed('101')).archivedAt).toBeNull();
    // Only who is in it archives it.
    expect((await call('999', 'PUT', `/projects/${id}/archive`)).statusCode).toBe(404);
    expect(told).toEqual([]);
  });

  it('changes the Project all the same when catalogue does not answer', async () => {
    const id = await project();
    told = [];
    down = true;
    expect((await call('101', 'DELETE', `/projects/${id}/members/103`)).statusCode).toBe(200);
    expect((await call('101', 'DELETE', `/projects/${id}`)).statusCode).toBe(204);
    expect((await call('102', 'GET', `/projects/${id}`)).json().project.deleted).toMatchObject({ by: 'An Claes' });
    expect(told).toEqual([]);
  });
});

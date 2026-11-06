import { readFileSync } from 'node:fs';
import { createTestIssuer, type TestIssuer } from '@datahub/auth/testing';
import { type Permissions, type StartingGroup, startingPermissions } from '@datahub/contracts';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { VIEW_URI } from './context.js';
import { VIEW_PAGE } from './view-page.js';

const RESOURCE = 'https://mcp.test/mcp';
const IDENTITY = 'https://identity.test';
const CATALOGUE = 'https://catalogue.test';
const QUERY = 'https://query.test';
const WEB = 'https://datahub.test';

let issuer: TestIssuer;
let app: FastifyInstance;

/** What the fake catalogue and query were asked, and what they answer: `METHOD path` to [status, body]. */
interface Asked {
  method: string;
  url: string;
  authorization: string | null;
  body: unknown;
}
let asked: Asked[] = [];
let answers: Record<string, (body: unknown) => [number, unknown]> = {};

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input));
  const method = init?.method ?? 'GET';
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
  asked.push({ method, url: url.toString(), authorization: new Headers(init?.headers).get('authorization'), body });
  const handler = answers[`${method} ${url.origin}${url.pathname}`];
  if (!handler) return new Response(JSON.stringify({ error: 'not_found', message: 'No such thing.' }), { status: 404 });
  const [status, answer] = handler(body);
  return new Response(status === 204 ? null : JSON.stringify(answer), { status, headers: { 'content-type': 'application/json' } });
}

beforeAll(async () => {
  issuer = await createTestIssuer();
  app = await buildApp({
    verifier: issuer.verifier,
    resource: RESOURCE,
    authorizationServer: IDENTITY,
    services: { catalogueUrl: CATALOGUE, queryUrl: QUERY, webUrl: WEB, fetch: fakeFetch as typeof fetch },
    logger: false,
  });
});

afterAll(() => app.close());

beforeEach(() => {
  asked = [];
  answers = {};
});

/** One JSON-RPC call over Streamable HTTP, as Claude makes it. */
async function call(method: string, params: Record<string, unknown>, token?: string) {
  return app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    payload: { jsonrpc: '2.0', id: 1, method, params },
  });
}

/** A tool called as Claude calls it, with its result. */
async function tool(name: string, args: Record<string, unknown>, token: string) {
  return (await call('tools/call', { name, arguments: args }, token)).json().result as {
    content: { text: string }[];
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  };
}

interface Listed {
  name: string;
  inputSchema: { properties: Record<string, { enum?: string[] }> };
  _meta?: { ui?: { visibility?: string[]; resourceUri?: string } };
}

/** The tools Claude is offered with this token. */
async function toolsOf(token: string): Promise<Listed[]> {
  return (await call('tools/list', {}, token)).json().result.tools;
}
const names = (tools: Listed[]) => tools.map((item) => item.name).sort();
const appOnly = (tools: Listed[]) => names(tools.filter((item) => item._meta?.ui?.visibility?.join() === 'app'));

/** The Permissions of a starting group, changed for a test. */
function permissionsOf(group: StartingGroup, change: (permissions: Permissions) => void): Permissions {
  const permissions = startingPermissions(group);
  change(permissions);
  return permissions;
}

/** A Business analyst whose results reach Claude as `show` says (claude.results). */
const showing = (show: 'claude' | 'card' | 'none') =>
  issuer.sign({ permissions: permissionsOf('businessAnalyst', (permissions) => (permissions['claude.results'].values = { show })) });

const RESOURCE_ID = '0b9f6c2e-4a51-4f8e-9d3a-1c2b3d4e5f60';
const QUERY_ID = '7a1e2d3c-4b5a-4c6d-8e7f-9a0b1c2d3e4f';
const detail = (overrides: Record<string, unknown> = {}) => ({
  resource: {
    id: RESOURCE_ID,
    key: 'p.d.weekly_lead_volume',
    displayName: 'Weekly lead volume',
    level: 4,
    published: true,
    deprecated: false,
    withdrawn: false,
    description: 'One row per week and lead source.',
    collectionId: 'c-1',
    fields: [{ name: 'week_start', dataType: 'DATE', description: 'Monday of the week', businessDescription: '' }],
    card: { businessDescription: 'Credit leads per week.', intendedUse: '', pitfalls: 'The current week is incomplete.', knownGaps: [], reliableSince: null, keyFields: [], parameters: [] },
    deprecation: null,
    ...overrides,
  },
});
const collection = { id: 'c-1', name: 'Credit leads', visibility: 'public', canManage: true, ownerUnit: { id: 'g-credit', name: 'Credit team' }, resources: [] };

describe('mcp', () => {
  it('tells MCP clients that identity is where they sign in', async () => {
    for (const url of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
      const response = await app.inject({ url });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ resource: RESOURCE, authorization_servers: [IDENTITY] });
    }
  });

  it('answers without a token with where to find that', async () => {
    const response = await call('tools/list', {});
    expect(response.statusCode).toBe(401);
    expect(response.headers['www-authenticate']).toBe('Bearer resource_metadata="https://mcp.test/.well-known/oauth-protected-resource/mcp"');
  });

  it('starts an MCP conversation with the concepts and rules of Data Hub (FR-CL-14, FR-CL-24)', async () => {
    const response = await call(
      'initialize',
      { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } },
      await issuer.sign(),
    );
    expect(response.statusCode).toBe(200);
    const { result } = response.json();
    expect(result.serverInfo).toMatchObject({ name: 'datahub' });
    expect(result.instructions).toContain('Level: how far a Resource is documented and confirmed');
    expect(result.instructions).toContain('never publish a Resource');
    // Claude analyses the rows it gets, in SQL; no exports keeps whole tables from leaving, not Claude from reading (DEC-CL-14).
    expect(result.instructions).toContain('Analyse the rows you get');
    expect(result.instructions).toContain('never whole tables to copy elsewhere');
  });

  it('offers who_am_i, which answers as the User of the token, with their Permission group and what it lets them do (TR-PL-09)', async () => {
    const token = await issuer.sign({ name: 'Jan Peeters', email: 'jan@thenextimmoscoop.be', groups: ['g1'], as: 'admin' });
    const result = await tool('who_am_i', {}, token);
    const me = result.structuredContent as { mayDo: string[] };
    expect(me).toMatchObject({ name: 'Jan Peeters', email: 'jan@thenextimmoscoop.be', groups: ['g1'], permissionGroup: 'Admin', inClaude: true });
    expect(me).not.toHaveProperty('roles');
    expect(me.mayDo).toContain('See every query, with who ran it');
    expect(me.mayDo).toContain('Results of queries and Previews reach Claude: it reads their rows and works on them');

    // A Lens user: what their group gives, from its Permissions.
    const lens = (await tool('who_am_i', {}, await issuer.sign({ as: 'lensUser' }))).structuredContent as { permissionGroup: string; mayDo: string[] };
    expect(lens.permissionGroup).toBe('Lens user');
    expect(lens.mayDo).toContain('Write Questions and Signals');
    expect(lens.mayDo).toContain('Results of queries and Previews show in a card only: you see their rows, Claude does not read them');
    expect(lens.mayDo).not.toContain('Make and run queries of your own');
  });

  it('has no sessions to open with GET or close with DELETE', async () => {
    const token = await issuer.sign();
    for (const method of ['GET', 'DELETE'] as const) {
      const response = await app.inject({ method, url: '/mcp', headers: { authorization: `Bearer ${token}` } });
      expect(response.statusCode).toBe(405);
    }
  });

  it('keeps the buttons of the User from Claude: those tools are for the MCP App only (DEC-CL-07)', async () => {
    const tools: { name: string; _meta?: { ui?: { visibility?: string[]; resourceUri?: string } } }[] = (await call('tools/list', {}, await issuer.sign())).json().result.tools;
    const appOnly = tools.filter((item) => item._meta?.ui?.visibility?.join() === 'app').map((item) => item.name);
    expect(appOnly.sort()).toEqual(['confirm_publication', 'run_preview_approved', 'run_query_approved', 'send_preview_request', 'send_query_request']);
    const shows = tools.filter((item) => item._meta?.ui?.resourceUri === VIEW_URI && !item._meta.ui.visibility).map((item) => item.name);
    expect(shows.sort()).toEqual(['preview_resource', 'publish_resource', 'run_query', 'show_query', 'show_resource']);
  });

  it('serves the MCP App as one self-contained page (FR-CL-01)', async () => {
    const { contents } = (await call('resources/read', { uri: VIEW_URI }, await issuer.sign())).json().result;
    expect(contents[0].mimeType).toBe('text/html;profile=mcp-app');
    expect(contents[0].text).toContain('const McpApps={');
    expect(contents[0].text).not.toContain('/*BUNDLE*/');
    expect(contents[0]._meta.ui.domain).toMatch(/^[0-9a-f]{32}\.claudemcpcontent\.com$/);
  });

  it('offers its how-to-use as a prompt and a tool, by what the Permission group of the User lets them do (FR-CL-16, TR-PL-09)', async () => {
    const token = await issuer.sign({ as: 'admin' });
    const prompts = (await call('prompts/list', {}, token)).json().result.prompts;
    expect(prompts.map((prompt: { name: string }) => prompt.name)).toContain('start_with_data_hub');
    const text = (await tool('how_to_use', {}, token)).content[0]?.text ?? '';
    expect(text).toContain('your Permission group, Admin');
    expect(text).toContain('"What did everyone query this week?"');
    expect(text).toContain('- Open Admin: webhooks, Excel keys, users and Permission groups');

    // A Business analyst sees only the queries on the Resources of their Owner Units; a Lens user makes none.
    const analyst = (await tool('how_to_use', {}, await issuer.sign())).content[0]?.text ?? '';
    expect(analyst).toContain('"Which queries ran on this Resource?"');
    expect(analyst).not.toContain('What did everyone query');
    const lens = (await tool('how_to_use', {}, await issuer.sign({ as: 'lensUser' }))).content[0]?.text ?? '';
    expect(lens).toContain('"Is there a Lens on the share of partner leads?"');
    expect(lens).not.toContain('Claude opens the Preview');
    expect(lens).not.toContain('"Publish it"');
  });
});

describe('Resources through Claude', () => {
  it('lists every Resource the User sees by Collection, asking catalogue with their own token (FR-CL-04)', async () => {
    const token = await issuer.sign();
    answers[`GET ${CATALOGUE}/collections`] = () => [
      200,
      { collections: [{ ...collection, resources: [{ id: RESOURCE_ID, key: 'k', displayName: 'Weekly lead volume', level: 4, published: true, deprecated: true, withdrawn: false }] }] },
    ];
    const result = await tool('list_resources', {}, token);
    expect(asked[0]?.authorization).toBe(`Bearer ${token}`);
    expect(result.structuredContent).toMatchObject({
      collections: [{ name: 'Credit leads', owner: 'Credit team', resources: [{ displayName: 'Weekly lead volume', level: '4 · Explored', deprecated: true, page: `${WEB}/resources/${RESOURCE_ID}` }] }],
    });
  });

  it('reads a Resource with its Level, its size and whether the User may publish it (FR-CL-05, FR-CL-07)', async () => {
    answers[`GET ${CATALOGUE}/resources/${RESOURCE_ID}`] = () => [200, detail()];
    answers[`GET ${CATALOGUE}/collections/c-1`] = () => [200, collection];
    answers[`GET ${QUERY}/resources/${RESOURCE_ID}/storage`] = () => [200, { storage: { bytes: 6_200_000_000, partitions: 312 } }];
    const result = await tool('get_resource', { id: RESOURCE_ID }, await issuer.sign({ groups: ['g-credit'] }));
    expect(result.content[0]?.text).toMatch(/^Weekly lead volume is at 4 · Explored\./);
    expect(result.structuredContent).toMatchObject({ levelName: '4 · Explored', storage: { size: '6.2 GB' }, mayPublish: true, collection: { owner: 'Credit team' } });
  });

  it('gives Claude the Summary first, in its order and with its weights, the Q&A of the Owner among them (FR-CL-25, DEC-RC-18)', async () => {
    answers[`GET ${CATALOGUE}/resources/${RESOURCE_ID}`] = () => [
      200,
      detail({ card: { businessDescription: '### Leads\nCredit leads per **week**.', intendedUse: 'Weekly trends.', pitfalls: 'The current week is incomplete.', knownGaps: [{ id: '1', text: 'No partner leads before March.', scope: { period: { from: null, to: '2025-02-28' }, rows: { field: 'lead_source', is: 'oneOf', values: ['partner'] } }, addedBy: 'An', addedAt: '2026-11-01T10:00:00Z' }], reliableSince: null, keyFields: [], parameters: [] } }),
    ];
    answers[`GET ${CATALOGUE}/collections/c-1`] = () => [200, collection];
    const said = (kind: string, name: string, as: string | null, text: string, state: string | null, replies: object[] = []) => ({
      kind,
      state,
      writer: { id: name, name, as },
      params: { text },
      createdAt: '2026-11-02T10:00:00Z',
      replies,
    });
    answers[`GET ${CATALOGUE}/messages/on/resource/${RESOURCE_ID}`] = () => [
      200,
      {
        messages: [
          said('question', 'Jan', null, 'Per province?', 'open'),
          said('question', 'Mia', null, 'Twice in a week?', 'answered', [{ kind: 'reply', writer: { id: 'an', name: 'An', as: 'owner' }, params: { text: 'Every request counts.' }, createdAt: '2026-11-03T10:00:00Z' }]),
        ],
      },
    ];
    const result = await tool('get_resource', { id: RESOURCE_ID }, await issuer.sign({ groups: ['g-credit'] }));
    const text = result.content[0]?.text ?? '';
    expect(text).toContain('- When interpreting results: It decides what a result may be taken to say.');
    const order = ['## 1. What it is (read first)', '## 2. Use it for (read first)', '## 3. Its fields (before you query)', '## 4. Watch out (when interpreting results)', '## 5. Known Gaps', '## 6. Q&A of the Owner and the Data Team', '## 7. Where it stands (context)', '## 8. What colleagues noted (context)'];
    expect(order.map((heading) => text.indexOf(heading))).toEqual([...order.map((heading) => text.indexOf(heading))].sort((a, b) => a - b));
    expect(order.filter((heading) => !text.includes(heading))).toEqual([]);
    expect(text).toContain('Credit leads per **week**.');
    // A Known Gap with where it holds, as data (FR-RC-25).
    expect(text).toContain('- No partner leads before March. [period: until 2025-02-28; rows: lead_source = partner]');
    expect(text).toContain('  - An, Owner, 2026-11-03: Every request counts.');
    expect(text).toMatch(/What colleagues noted \(context\)\n- Question, open, Jan, 2026-11-02: Per province\?/);
    // A part with nothing in it is left out.
    expect(text).not.toContain('What it joins');
    // First in its data too, before the card (DEC-CL-16).
    expect(Object.keys(result.structuredContent ?? {})[0]).toBe('summary');

    // Shown to the User, Claude reads the same Summary first, and the window gets its parts to draw (FR-CL-26).
    const shown = await tool('show_resource', { id: RESOURCE_ID }, await issuer.sign({ groups: ['g-credit'] }));
    const reads = shown.content[0]?.text ?? '';
    expect(reads).toMatch(/^Weekly lead volume is at 4 · Explored\..*on its Summary\.\n\n# Weekly lead volume/s);
    expect(reads).toContain('## 6. Q&A of the Owner and the Data Team (when interpreting results)');
    const data = shown.structuredContent as { summary: string; view: string; parts: { part: string; number: number | null; weightName: string; rank: number; title: string; lines: { text: string; kind?: string; shown?: string }[] }[] };
    expect(Object.keys(data)[0]).toBe('summary');
    expect(data.view).toBe('resource');
    expect(data.parts.map((part) => [part.number, part.title, part.weightName, part.rank])).toEqual([
      [1, 'What it is', 'Read first', 1],
      [2, 'Use it for', 'Read first', 1],
      [3, 'Its fields', 'Before you query', 2],
      [4, 'Watch out', 'When interpreting results', 3],
      [5, 'Known Gaps', 'When interpreting results', 3],
      [6, 'Q&A of the Owner and the Data Team', 'When interpreting results', 3],
      [7, 'Where it stands', 'Context', 4],
      [8, 'What colleagues noted', 'Context', 4],
    ]);
    expect(data.parts[0]?.lines).toContainEqual({ kind: 'markdown', text: '### Leads\nCredit leads per **week**.' });
    expect(data.parts[0]?.lines).toContainEqual({ kind: 'label', text: 'Business Description, from the Owner, in Markdown:', shown: 'From the Owner' });
    expect(data.parts[5]?.lines).toEqual([
      { kind: 'item', text: 'Question, answered, Mia, 2026-11-02: Twice in a week?' },
      { kind: 'reply', text: 'An, Owner, 2026-11-03: Every request counts.' },
    ]);
  });

  it('gives the cards of one Collection the drawing of its icon, as the MCP App loads nothing from outside (DEC-UX-164)', async () => {
    answers[`GET ${CATALOGUE}/resources/${RESOURCE_ID}`] = () => [200, detail()];
    answers[`GET ${CATALOGUE}/collections/c-1`] = () => [200, { ...collection, icon: 'coins' }];
    const shown = await tool('show_resource', { id: RESOURCE_ID }, await issuer.sign({ groups: ['g-credit'] }));
    const { resource } = shown.structuredContent as { resource: { collection: { name: string; icon: string } } };
    expect(resource.collection.name).toBe('Credit leads');
    expect(resource.collection.icon).toMatch(/^<svg[^>]*viewBox="0 0 256 256"/);

    // A query whose Resources sit in one Collection carries it too; an icon it may not carry draws nothing.
    answers[`GET ${CATALOGUE}/collections/c-1`] = () => [200, { ...collection, icon: '../../package' }];
    answers[`GET ${QUERY}/queries/${QUERY_ID}`] = () => [200, { query: { id: QUERY_ID, name: 'q', question: '', sql: 'select 1', parameters: [], lastRun: null, resources: [{ id: RESOURCE_ID, displayName: 'Weekly lead volume', level: 4, collectionId: 'c-1' }] } }];
    const query = await tool('show_query', { id: QUERY_ID }, await issuer.sign());
    expect(query.structuredContent).toMatchObject({ view: 'query', collection: { name: 'Credit leads', icon: '' } });

    // Resources in several Collections: no Collection at all.
    answers[`GET ${QUERY}/queries/${QUERY_ID}`] = () => [200, { query: { id: QUERY_ID, name: 'q', question: '', sql: 'select 1', parameters: [], lastRun: null, resources: [{ id: RESOURCE_ID, displayName: 'Weekly lead volume', level: 4, collectionId: 'c-1' }, { id: 'r-2', displayName: 'Listings', level: 2, collectionId: 'c-2' }] } }];
    expect((await tool('show_query', { id: QUERY_ID }, await issuer.sign())).structuredContent).toMatchObject({ collection: null });
  });

  it('answers what it may not see as not found, without saying which (FR-CL-02)', async () => {
    const result = await tool('get_resource', { id: RESOURCE_ID }, await issuer.sign());
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('it does not exist, or it is not shown to you');
  });

  it('says so when Data Hub does not answer, and never answers from memory (EC-CL-01)', async () => {
    answers[`GET ${CATALOGUE}/collections`] = () => [503, { error: 'temporarily_unavailable' }];
    const result = await tool('list_resources', {}, await issuer.sign());
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('could not answer just now');
  });

  it('does not overwrite a description a colleague changed since Claude showed it (EC-CL-03)', async () => {
    answers[`GET ${CATALOGUE}/resources/${RESOURCE_ID}`] = () => [200, detail()];
    answers[`PATCH ${CATALOGUE}/resources/${RESOURCE_ID}`] = () => [200, detail()];
    const result = await tool('update_resource_card', { id: RESOURCE_ID, pitfalls: 'Mind the current week.', before: { pitfalls: '' } }, await issuer.sign());
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('pitfalls is now "The current week is incomplete."');
    expect(asked.some((call) => call.method === 'PATCH')).toBe(false);

    const written = await tool('update_resource_card', { id: RESOURCE_ID, pitfalls: 'Mind the current week.', before: { pitfalls: 'The current week is incomplete.' } }, await issuer.sign());
    expect(written.isError).toBeUndefined();
    expect(asked.find((call) => call.method === 'PATCH')?.body).toEqual({ pitfalls: 'Mind the current week.' });
  });

  it('runs a Preview up to 100 MB, and above leaves it to the User in the MCP App (FR-CL-09, DEC-CL-07)', async () => {
    const preflight = (bytes: number, range: string) => ({ preflight: { runnable: true, bytes, range, partitions: 4, problems: [], warnings: [] }, queryId: null, request: null });
    answers[`GET ${CATALOGUE}/resources/${RESOURCE_ID}`] = () => [200, detail()];
    answers[`POST ${QUERY}/resources/${RESOURCE_ID}/preview/choices`] = () => [200, { window: null, choices: [] }];
    answers[`POST ${QUERY}/resources/${RESOURCE_ID}/preview/runs`] = () => [201, { run: { ref: 'q-1' }, page: { number: 1, size: 100, totalRows: 1, columns: [], rows: [] } }];
    answers[`POST ${QUERY}/resources/${RESOURCE_ID}/preview/preflight`] = () => [200, preflight(80_000_000, 'free')];
    const free = await tool('preview_resource', { id: RESOURCE_ID }, await issuer.sign());
    expect(free.structuredContent).toMatchObject({ view: 'preview', outcome: 'ran', run: { ref: 'q-1' } });
    expect(asked.find((call) => call.url.endsWith('/preview/runs'))?.body).toMatchObject({ approve: false });

    asked = [];
    answers[`POST ${QUERY}/resources/${RESOURCE_ID}/preview/preflight`] = () => [200, preflight(480_000_000, 'approve')];
    const large = await tool('preview_resource', { id: RESOURCE_ID, window: 4 }, await issuer.sign());
    expect(large.structuredContent).toMatchObject({ outcome: 'approve', reads: '480 MB' });
    expect(large.content[0]?.text).toContain('Only the User approves it');
    expect(asked.some((call) => call.url.endsWith('/preview/runs'))).toBe(false);

    const approved = await tool('run_preview_approved', { id: RESOURCE_ID, window: 4 }, await issuer.sign());
    expect(approved.structuredContent).toMatchObject({ outcome: 'ran' });
    expect(asked.find((call) => call.url.endsWith('/preview/runs'))?.body).toMatchObject({ approve: true });
  });
});

describe('queries through Claude', () => {
  const query = { id: QUERY_ID, name: 'Partner share per week', question: 'What share came from partners?', sql: 'select 1', parameters: [], resources: [{ id: RESOURCE_ID, displayName: 'Weekly lead volume', level: 4 }], lastRun: null };

  it('looks for a Lens on the Resources of the question first (FR-CL-17)', async () => {
    answers[`GET ${QUERY}/lenses/suggestions`] = () => [200, { exact: [{ id: 'l-1', name: 'Leads per source name' }], more: [] }];
    const result = await tool('suggest_lenses', { resources: [RESOURCE_ID], question: 'leads per source' }, await issuer.sign());
    expect(asked[0]?.url).toBe(`${QUERY}/lenses/suggestions?resources=${RESOURCE_ID}&question=leads%20per%20source`);
    expect(result.structuredContent).toMatchObject({ exact: [{ name: 'Leads per source name', page: `${WEB}/lenses/l-1` }] });
  });

  it('runs a query up to 100 MB, and above never approves it itself (FR-CL-20, DEC-CL-07)', async () => {
    answers[`GET ${QUERY}/queries/${QUERY_ID}`] = () => [200, { query }];
    answers[`POST ${QUERY}/queries/${QUERY_ID}/runs`] = (body) =>
      (body as { approve: boolean }).approve
        ? [201, { run: { ref: 'q-2', processedBytes: 522_000_000 }, page: { number: 1, size: 100, totalRows: 0, columns: [], rows: [] } }]
        : [409, { error: 'approval_needed', message: 'This query reads enough to need your approval.', preflight: { runnable: true, bytes: 522_000_000, range: 'approve', partitions: 26, problems: [], warnings: [] } }];
    const waiting = await tool('run_query', { id: QUERY_ID }, await issuer.sign());
    expect(waiting.structuredContent).toMatchObject({ view: 'query', outcome: 'approve', reads: '522 MB', resources: [{ levelName: '4 · Explored' }] });
    expect(waiting.content[0]?.text).toContain('Only the User approves it');
    expect(asked.find((call) => call.method === 'POST')?.body).toMatchObject({ sql: 'select 1', approve: false });

    const approved = await tool('run_query_approved', { id: QUERY_ID }, await issuer.sign());
    expect(approved.structuredContent).toMatchObject({ outcome: 'ran', run: { ref: 'q-2' } });
  });

  it('lists the queries of everyone only for a User who may see every query (DEC-CL-12, TR-PL-09)', async () => {
    answers[`GET ${QUERY}/queries`] = () => [200, { queries: [] }];
    const refused = await tool('list_queries', { everyone: true }, await issuer.sign());
    expect(refused.isError).toBe(true);
    expect(asked).toHaveLength(0);
    await tool('list_queries', { everyone: true, words: 'partner' }, await issuer.sign({ as: 'admin' }));
    expect(asked[0]?.url).toBe(`${QUERY}/queries?all=true&q=partner&limit=50`);
  });
});

describe('the Permissions of the User in Claude (TR-PL-09)', () => {
  const READS = ['explain', 'get_messages', 'get_related_resources', 'get_resource', 'get_resource_lineage', 'get_resource_log', 'how_to_use', 'list_resources', 'search', 'show_resource', 'suggest_lenses', 'who_am_i'];
  const QUERY_TOOLS = ['check_query', 'create_query', 'get_query', 'get_result_page', 'list_queries', 'run_query', 'run_query_approved', 'send_query_request', 'show_query', 'update_query'];
  const PREVIEW_TOOLS = ['preview_resource', 'run_preview_approved', 'send_preview_request'];
  const WRITES = ['deprecate_resource', 'describe_fields', 'mark_changes_seen', 'reply_to_message', 'undeprecate_resource', 'update_resource_card', 'write_message'];

  it('offers an Admin every tool, the queries of others included', async () => {
    const tools = names(await toolsOf(await issuer.sign({ as: 'admin' })));
    expect(tools).toEqual([...READS, ...QUERY_TOOLS, ...PREVIEW_TOOLS, ...WRITES, 'confirm_publication', 'get_resource_queries', 'publish_resource'].sort());
  });

  it('offers a Lens user no query tools and no Preview, and lets Claude write only their Questions and Signals', async () => {
    const tools = await toolsOf(await issuer.sign({ as: 'lensUser' }));
    expect(names(tools)).toEqual([...READS, 'reply_to_message', 'write_message'].sort());
    for (const name of [...QUERY_TOOLS, ...PREVIEW_TOOLS, 'read_result_rows', 'read_preview_choices', 'publish_resource', 'get_resource_queries']) expect(names(tools)).not.toContain(name);
    expect(tools.find((item) => item.name === 'write_message')?.inputSchema.properties.kind?.enum).toEqual(['question', 'signal']);
    // The instructions tell Claude from the start that they make no queries and see results in a card only.
    const { result } = (await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } }, await issuer.sign({ as: 'lensUser' }))).json();
    expect(result.instructions).toContain('This User, of the Permission group Lens user');
    expect(result.instructions).toContain('They do not make queries');
    expect(result.instructions).toContain('do not ask the User to paste or read out rows');
  });

  it('registers a write only when claude.use writes its kind and the other Permissions of the User allow it', async () => {
    // Claude writes only Messages for them: no descriptions or deprecations, though they may describe and deprecate in Data Hub.
    const messagesOnly = permissionsOf('businessAnalyst', (permissions) => (permissions['claude.use'].values = { writes: ['messages'], note: '' }));
    const tools = names(await toolsOf(await issuer.sign({ permissions: messagesOnly })));
    expect(tools).toEqual(expect.arrayContaining(['write_message', 'reply_to_message', 'publish_resource', 'create_query', 'preview_resource']));
    for (const name of ['update_resource_card', 'describe_fields', 'mark_changes_seen', 'deprecate_resource', 'undeprecate_resource']) expect(tools).not.toContain(name);

    // Only the attributes they may describe: pitfalls, so no Business Descriptions of fields and no changes marked seen.
    const pitfalls = permissionsOf('businessAnalyst', (permissions) => (permissions['resources.describe'].values = { reach: 'theirs', attributes: ['pitfalls'] }));
    const described = await toolsOf(await issuer.sign({ permissions: pitfalls }));
    expect(Object.keys(described.find((item) => item.name === 'update_resource_card')?.inputSchema.properties ?? {}).sort()).toEqual(['before', 'id', 'pitfalls']);
    expect(names(described)).not.toContain('describe_fields');
    expect(names(described)).not.toContain('mark_changes_seen');

    // Without resources.publish, no publication; without resources.preview, no Preview.
    const noPublish = permissionsOf('businessAnalyst', (permissions) => {
      permissions['resources.publish'].on = false;
      permissions['resources.preview'].on = false;
    });
    const narrow = names(await toolsOf(await issuer.sign({ permissions: noPublish })));
    for (const name of ['publish_resource', 'confirm_publication', ...PREVIEW_TOOLS]) expect(narrow).not.toContain(name);
    expect(narrow).toContain('get_result_page');
  });

  it('offers only who_am_i and how_to_use without claude.use, which say Claude is not allowed for them', async () => {
    const token = await issuer.sign({ permissions: permissionsOf('businessAnalyst', (permissions) => (permissions['claude.use'].on = false)) });
    expect(names(await toolsOf(token))).toEqual(['how_to_use', 'who_am_i']);
    const me = await tool('who_am_i', {}, token);
    expect(me.structuredContent).toMatchObject({ permissionGroup: 'Business analyst', inClaude: false });
    expect(me.content[0]?.text).toContain('does not let them work with Data Hub in Claude');
    expect((await tool('how_to_use', {}, token)).content[0]?.text).toMatch(/^Your Permission group, Business analyst, does not let you work with Data Hub in Claude: .* https:\/\/datahub\.test\/collections/);
    expect((await call('tools/call', { name: 'search', arguments: { question: 'leads' } }, token)).json().result.isError).toBe(true);
    expect(asked).toHaveLength(0);
  });

  it('gives Claude the note of the Permission group with the how-to-use', async () => {
    const permissions = permissionsOf('businessAnalyst', (given) => (given['claude.use'].values = { writes: ['messages'], note: 'The credit team calls a lead a "kredietlead". Answer in Dutch.' }));
    const token = await issuer.sign({ permissionGroup: { id: 'pg-credit', name: 'Credit analysts' }, permissions });
    const text = (await tool('how_to_use', {}, token)).content[0]?.text ?? '';
    expect(text).toContain('A note for Claude from the Permission group Credit analysts: The credit team calls a lead a "kredietlead". Answer in Dutch.');
    expect(text).toContain('Work with Data Hub in Claude; Claude writes for you Messages, as far as your other Permissions go');
    // No note, no line.
    expect((await tool('how_to_use', {}, await issuer.sign())).content[0]?.text).not.toContain('A note for Claude');
  });

  it('names the Permission when a service refuses by one', async () => {
    answers[`POST ${QUERY}/queries`] = () => [403, { error: 'forbidden', message: 'Only who may make queries writes and runs one.', permission: 'queries.make' }];
    const refused = await tool('create_query', { name: 'Mine', resources: [RESOURCE_ID] }, await issuer.sign());
    expect(refused.isError).toBe(true);
    expect(refused.content[0]?.text).toContain('does not allow it (queries.make)');
  });
});

describe('results in Claude, in a card only, or not in Claude (FR-CL-28)', () => {
  const SECRET = 'kept-from-claude';
  const page = (totalRows = 2) => ({
    number: 1,
    size: 100,
    totalRows,
    columns: [{ name: 'week_start', type: 'DATE' }, { name: 'lead_source', type: 'STRING' }, { name: 'partner_leads', type: 'INT64' }],
    rows: [['2026-10-19', SECRET, 4242], ['2026-10-12', SECRET, 4243]],
  });
  const ran = { ref: 'q-9', number: 3, state: 'done', rowCount: 2, processedBytes: 82_000_000, sql: 'select 1', parameters: [], columns: [] };
  const query = { id: QUERY_ID, name: 'Partner share per week', question: 'What share?', sql: 'select 1', parameters: [], resources: [{ id: RESOURCE_ID, displayName: 'Weekly lead volume', level: 4 }], lastRun: ran };
  const noValues = (result: unknown) => {
    const all = JSON.stringify(result);
    expect(all).not.toContain(SECRET);
    expect(all).not.toContain('4242');
  };

  beforeEach(() => {
    answers[`GET ${QUERY}/queries/${QUERY_ID}`] = () => [200, { query }];
    answers[`POST ${QUERY}/queries/${QUERY_ID}/runs`] = () => [201, { run: ran, page: page() }];
    answers[`GET ${QUERY}/runs/q-9/rows`] = () => [200, { page: page() }];
    answers[`GET ${CATALOGUE}/resources/${RESOURCE_ID}`] = () => [200, detail()];
    answers[`POST ${QUERY}/resources/${RESOURCE_ID}/preview/choices`] = () => [200, { window: { field: 'week_start', unit: 'week', window: 4 }, choices: [{ field: 'lead_source', role: 'parameter', values: [SECRET] }] }];
    answers[`POST ${QUERY}/resources/${RESOURCE_ID}/preview/preflight`] = () => [200, { preflight: { runnable: true, bytes: 80_000_000, range: 'free', partitions: 4, problems: [], warnings: [] }, request: null }];
    answers[`POST ${QUERY}/resources/${RESOURCE_ID}/preview/runs`] = () => [201, { run: { ...ran, ref: 'p-1' }, page: page() }];
  });

  it('in Claude, gives Claude the rows and the choices, as before (DEC-CL-06)', async () => {
    const token = await showing('claude');
    expect(JSON.stringify(await tool('run_query', { id: QUERY_ID }, token))).toContain(SECRET);
    expect(JSON.stringify(await tool('preview_resource', { id: RESOURCE_ID }, token))).toContain(SECRET);
    expect((await tool('get_result_page', { run: 'q-9', page: 1 }, token)).structuredContent).toMatchObject({ page: { rows: [['2026-10-19', SECRET, 4242], ['2026-10-12', SECRET, 4243]] } });
  });

  it('in a card only, answers Claude the head of a query result without a value, while the MCP App reads the rows itself', async () => {
    const token = await showing('card');
    const shown = await tool('run_query', { id: QUERY_ID }, token);
    noValues(shown);
    expect(shown.structuredContent).toMatchObject({
      view: 'query',
      results: 'card',
      outcome: 'ran',
      query: { id: QUERY_ID, page: `${WEB}/query/${QUERY_ID}` },
      resources: [{ displayName: 'Weekly lead volume', levelName: '4 · Explored' }],
      run: { ref: 'q-9', rowCount: 2 },
      result: { rows: 2, columns: [{ name: 'week_start', type: 'DATE' }, { name: 'lead_source', type: 'STRING' }, { name: 'partner_leads', type: 'INT64' }] },
      reads: '82 MB',
    });
    expect(shown.structuredContent).not.toHaveProperty('page');
    // The words first, which the MCP App may pass on: the shape, the Levels, and what Claude may not do.
    expect(shown.content[0]?.text).toContain('in the card only: 2 rows, with the columns week_start (DATE), lead_source (STRING), partner_leads (INT64); it read 82 MB');
    expect(shown.content[0]?.text).toContain('Weekly lead volume (4 · Explored)');
    expect(shown.content[0]?.text).toContain('do not ask the User to paste or read out rows');

    // The run the User approves in the MCP App answers the same, and the last run shown again too.
    noValues(await tool('run_query_approved', { id: QUERY_ID }, token));
    const again = await tool('show_query', { id: QUERY_ID }, token);
    noValues(again);
    expect(again.structuredContent).toMatchObject({ results: 'card', outcome: 'ran', result: { rows: 2 } });

    // Claude cannot read another page; the MCP App reads them through a tool Claude does not see.
    asked = [];
    const refused = await tool('get_result_page', { run: 'q-9', page: 1 }, token);
    expect(refused.isError).toBe(true);
    expect(refused.content[0]?.text).toContain('The rows of this result show in the card only.');
    expect(asked).toHaveLength(0);
    const rows = await tool('read_result_rows', { run: 'q-9', page: 1 }, token);
    expect(rows.structuredContent).toMatchObject({ page: { rows: [['2026-10-19', SECRET, 4242], ['2026-10-12', SECRET, 4243]] } });
    expect(rows.content[0]?.text).not.toContain(SECRET);

    const tools = await toolsOf(token);
    expect(appOnly(tools)).toEqual(['confirm_publication', 'read_preview_choices', 'read_result_rows', 'run_preview_approved', 'run_query_approved', 'send_preview_request', 'send_query_request']);
    expect(tools.find((item) => item.name === 'run_query')?._meta?.ui?.resourceUri).toBe(VIEW_URI);
  });

  it('in a card only, answers Claude a Preview without its rows and without the values of its choices', async () => {
    const token = await showing('card');
    const shown = await tool('preview_resource', { id: RESOURCE_ID }, token);
    noValues(shown);
    expect(shown.structuredContent).toMatchObject({ view: 'preview', results: 'card', outcome: 'ran', choices: null, run: { ref: 'p-1' }, result: { rows: 2 }, resource: { levelName: '4 · Explored' } });
    expect(asked.some((call) => call.url.endsWith('/preview/choices'))).toBe(false);
    expect(shown.content[0]?.text).toContain('The Preview of Weekly lead volume (4 · Explored) ran and is shown to the User, in the card only: 2 rows');

    // The MCP App reads the values of the choices, and the rows, itself.
    const choices = await tool('read_preview_choices', { id: RESOURCE_ID, window: 4 }, token);
    expect(choices.structuredContent).toMatchObject({ choices: { choices: [{ field: 'lead_source', values: [SECRET] }] } });
    answers[`GET ${QUERY}/runs/p-1/rows`] = () => [200, { page: page() }];
    expect(JSON.stringify((await tool('read_result_rows', { run: 'p-1', page: 1 }, token)).structuredContent)).toContain(SECRET);

    // Above 100 MB, approved in the MCP App: still no value for Claude.
    answers[`POST ${QUERY}/resources/${RESOURCE_ID}/preview/preflight`] = () => [200, { preflight: { runnable: true, bytes: 480_000_000, range: 'approve', partitions: 4, problems: [], warnings: [] }, request: null }];
    const waiting = await tool('preview_resource', { id: RESOURCE_ID }, token);
    expect(waiting.structuredContent).toMatchObject({ results: 'card', outcome: 'approve' });
    noValues(await tool('run_preview_approved', { id: RESOURCE_ID }, token));
  });

  it('not in Claude, opens no MCP App and answers the link to open it in Data Hub', async () => {
    const token = await showing('none');
    const result = await tool('run_query', { id: QUERY_ID }, token);
    noValues(result);
    expect(result.structuredContent).toMatchObject({ results: 'none', page: `${WEB}/query/${QUERY_ID}` });
    expect(result.content[0]?.text).toContain(`Open in Data Hub: ${WEB}/query/${QUERY_ID}`);
    expect(asked.some((call) => call.method === 'POST')).toBe(false);
    expect((await tool('show_query', { id: QUERY_ID }, token)).structuredContent).toMatchObject({ results: 'none', page: `${WEB}/query/${QUERY_ID}` });
    const preview = await tool('preview_resource', { id: RESOURCE_ID }, token);
    expect(preview.structuredContent).toMatchObject({ results: 'none', resource: { levelName: '4 · Explored' }, page: `${WEB}/resources/${RESOURCE_ID}` });
    expect(asked.some((call) => call.url.includes('/preview/'))).toBe(false);
    expect((await tool('get_result_page', { run: 'q-9', page: 1 }, token)).isError).toBe(true);

    // No result opens the MCP App, and its buttons for a result are not there; a Resource and its publication still show.
    const tools = await toolsOf(token);
    const shows = names(tools.filter((item) => item._meta?.ui?.resourceUri === VIEW_URI && !item._meta.ui.visibility));
    expect(shows).toEqual(['publish_resource', 'show_resource']);
    expect(appOnly(tools)).toEqual(['confirm_publication']);
  });

  it('says a run too large for the Permission group of the User cannot run, and offers no Request', async () => {
    const preflight = { runnable: false, bytes: 4_800_000_000, range: 'request', partitions: 312, problems: [{ kind: 'tooLarge', bytes: 4_800_000_000, limit: 1_000_000_000 }], warnings: [] };
    answers[`POST ${QUERY}/queries/${QUERY_ID}/runs`] = () => [422, { error: 'not_runnable', message: 'It cannot run.', preflight }];
    const result = await tool('run_query', { id: QUERY_ID }, await showing('claude'));
    expect(result.structuredContent).toMatchObject({ outcome: 'blocked', problem: 'Too large for your Permission group: it reads 4.8 GB, and at most 1 GB runs. Narrow it: a filter on the partition column reads less.' });
    expect(result.content[0]?.text).toContain('no Request can be sent to the Data Team, so do not offer one');

    answers[`POST ${QUERY}/resources/${RESOURCE_ID}/preview/preflight`] = () => [200, { preflight, request: null }];
    const preview = await tool('preview_resource', { id: RESOURCE_ID }, await showing('card'));
    expect(preview.structuredContent).toMatchObject({ outcome: 'blocked', problem: expect.stringContaining('a narrower window or a Parameter reads less') });
    expect(asked.some((call) => call.url.endsWith('/preview/runs'))).toBe(false);
  });
});

describe('concepts through Claude', () => {
  it('explains a concept with the Learning Cards that are written (FR-CL-15)', async () => {
    const result = await tool('explain', { term: 'Level' }, await issuer.sign());
    const cards = (result.structuredContent as { cards: { number: string; page: string }[] }).cards;
    expect(cards[0]).toMatchObject({ number: 'K5.2', page: `${WEB}/learning/K5.2` });
  });
});

describe('the MCP App', () => {
  it('opens a Resource on its Summary, fits a phone and folds (FR-CL-26, FR-CL-27, DEC-UX-180, DEC-UX-181)', () => {
    expect(VIEW_PAGE).toContain('data-tab="summary">Summary</button>');
    expect(VIEW_PAGE).toContain("let tab = 'summary';");
    // On a phone: one column, the fields as cards, buttons and tabs at least 44 px.
    const phone = VIEW_PAGE.slice(VIEW_PAGE.indexOf('@media (max-width: 520px)'));
    expect(phone).toContain('.sum-part { grid-template-columns: minmax(0, 1fr);');
    expect(phone).toContain('table.stack thead { display: none; }');
    expect(phone).toMatch(/button\.primary, button\.quiet \{ width: 100%; min-height: 44px; \}/);
    expect(phone).toContain('.tab { min-height: 44px; }');
    // Every window has the button that folds it to its head.
    expect(VIEW_PAGE).toContain('data-fold aria-label="Fold"');
    expect(VIEW_PAGE).toContain('#root.folded > :not(.head) { display: none; }');
  });

  it('in a card only, says under the grid that Claude does not read the rows, reads them itself, and tells Claude none (FR-CL-28, DEC-UX-193)', () => {
    // The line under the foot of the grid, muted, with the crossed eye, as mcp-query draws it.
    expect(VIEW_PAGE).toContain(`const PRIVATE = '<p class="result-private">' + EYE_SLASH + 'Claude does not read these rows.</p>';`);
    expect(VIEW_PAGE).toMatch(/\.result-private \{[^}]*font-size: var\(--text-meta\); color: var\(--text-muted\);/);
    expect(VIEW_PAGE).toContain("const privately = (v) => (v.results === 'card' ? PRIVATE : '');");
    expect(VIEW_PAGE).toContain("v.outcome === 'ran' ? rowsOf(v) + privately(v)");
    // The rows and the choices come through tools only the MCP App calls, and so does every other page.
    expect(VIEW_PAGE).toContain("read('read_result_rows', { run: shown.run.ref, page: 1 })");
    expect(VIEW_PAGE).toContain("read('read_preview_choices', { id: shown.resource.id, window: shown.window })");
    expect(VIEW_PAGE).toContain("const name = view.results === 'card' ? 'read_result_rows' : 'get_result_page';");
    // What the MCP App tells Claude goes through one function only.
    expect(VIEW_PAGE.match(/updateModelContext\(/g)).toHaveLength(1);
    expect(VIEW_PAGE).toContain("app.updateModelContext({ content: [{ type: 'text', text: toldClaude(result, told, cardOnly) }] })");

    const source = VIEW_PAGE.slice(VIEW_PAGE.indexOf('function toldClaude('), VIEW_PAGE.indexOf('// end toldClaude'));
    const toldClaude = new Function(`${source}\nreturn toldClaude;`)() as (result: unknown, told: string, card: boolean) => string;
    const approved = 'The User approved and ran the query in Data Hub.';
    // In a card only: what the User did, and the words Data Hub put first for Claude, which hold no value.
    const card = { content: [{ text: 'The query ran, in the card only: 2 rows.' }, { text: '{"results":"card"}' }], structuredContent: { view: 'query', results: 'card', choices: null } };
    expect(toldClaude(card, approved, true)).toBe(`${approved}\nThe query ran, in the card only: 2 rows.`);
    // A result that carries rows, or the values of choices, passes on nothing of it in a card only; in Claude, all of it as before.
    const rows = { content: [{ text: 'ran {"page":{"rows":[["kept-from-claude"]]}}' }], structuredContent: { view: 'query', page: { rows: [['kept-from-claude']] } } };
    const choices = { content: [{ text: '{"choices":{"choices":[{"values":["kept-from-claude"]}]}}' }], structuredContent: { view: 'preview', choices: { choices: [{ values: ['kept-from-claude'] }] } } };
    expect(toldClaude(rows, approved, true)).toBe(approved);
    expect(toldClaude(choices, approved, true)).toBe(approved);
    expect(toldClaude(rows, approved, false)).toContain('kept-from-claude');
  });

  it('takes its values from docs/design/tokens.css (DEC-PF-28)', () => {
    const tokens = readFileSync(new URL('../../../docs/design/tokens.css', import.meta.url), 'utf8');
    const block = (css: string, selector: string) => {
      const start = css.indexOf(`${selector} {`);
      return new Map([...css.slice(start, css.indexOf('}', start)).matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2]?.trim()]));
    };
    for (const selector of [':root', '[data-theme="dark"]']) {
      const ours = block(VIEW_PAGE, selector);
      const theirs = block(tokens, selector);
      expect(ours.size).toBeGreaterThan(5);
      for (const [name, value] of ours) expect([name, value]).toEqual([name, theirs.get(name)]);
    }
  });
});

import { readFileSync } from 'node:fs';
import { journeyOf } from '@datahub/contracts/journey';
import {
  appliesTo,
  bestNext,
  coverage,
  type EdaResource,
  type EdaView,
  isComplete,
  isNeeded,
  levelOf,
  neededOf,
  PROBES,
  type ProbeKey,
  probesFor,
  type ResultView,
  type RunCover,
} from '@datahub/contracts/eda';
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
const EDA = 'https://eda.test';
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
    services: { catalogueUrl: CATALOGUE, queryUrl: QUERY, edaUrl: EDA, webUrl: WEB, fetch: fakeFetch as typeof fetch },
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
  description?: string;
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
    card: { businessDescription: 'Credit leads per week.', intendedUse: '', pitfalls: 'The current week is incomplete.', knownGaps: [], reliableSince: null, keyFields: [] },
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
    // Whoever wants to publish is led into the Owner Journey, and the Owner stands for every text (DEC-CL-17, OP-CL-12).
    expect(result.instructions).toContain('call guide_owner_journey first and follow it, one step at a time');
    expect(result.instructions).toContain('The Owner is the reference of the truth');
    // An analysis of many queries may get a Project; a query moves only once the User knows (DEC-SR-49).
    expect(result.instructions).toContain('you may set up a Project for it with create_project');
    expect(result.instructions).toContain('putting it in another moves it out of the one it is in, so say so to the User first');
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
    expect(appOnly.sort()).toEqual(['confirm_publication', 'run_lens_approved', 'run_preview_approved', 'run_query_approved', 'save_fields', 'send_preview_request', 'send_query_request']);
    const shows = tools.filter((item) => item._meta?.ui?.resourceUri === VIEW_URI && !item._meta.ui.visibility).map((item) => item.name);
    expect(shows.sort()).toEqual(['guide_owner_journey', 'preview_resource', 'publish_resource', 'run_lens', 'run_query', 'show_learning_card', 'show_query', 'show_resource', 'suggest_fields']);
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
    expect(text).toContain('"Help me publish it": Claude takes you through the Owner Journey, one step at a time');
    expect(text).toContain('- Open Admin: webhooks, Excel keys, users, Permission groups and the withdrawn Resources');

    // A Business analyst sees only the queries on the Resources of their Owner Units; a Lens user makes none.
    const analyst = (await tool('how_to_use', {}, await issuer.sign())).content[0]?.text ?? '';
    expect(analyst).toContain('"Which queries ran on this Resource?"');
    expect(analyst).not.toContain('What did everyone query');
    expect(analyst).toContain('"Set up a Project for the review of the credit leads."');
    const lens = (await tool('how_to_use', {}, await issuer.sign({ as: 'lensUser' }))).content[0]?.text ?? '';
    expect(lens).toContain('"Is there a Lens on the share of partner leads?"');
    expect(lens).not.toContain('Claude opens the Preview');
    expect(lens).not.toContain('"Publish it"');
    expect(lens).not.toContain('Set up a Project');
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
      detail({ card: { businessDescription: '### Leads\nCredit leads per **week**.', intendedUse: 'Weekly trends.', pitfalls: 'The current week is incomplete.', knownGaps: [{ id: '1', text: 'No partner leads before March.', scope: { period: { from: null, to: '2025-02-28' }, rows: { field: 'lead_source', is: 'oneOf', values: ['partner'] } }, addedBy: 'An', addedAt: '2026-11-01T10:00:00Z' }], reliableSince: { from: 'day', day: '2025-01-01', why: '2024 was loaded once from the old CRM export.', setBy: 'An', setAt: '2026-11-15T10:00:00Z' }, dateField: 'week_start', keyFields: [] } }),
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
    const order = ['## 1. What it is (read first)', '## 2. Use it for (read first)', '## 3. Its fields (before you query)', '## 4. Watch out (when interpreting results)', '## 5. Reliable since, Known Gaps (when interpreting results)', '## 6. Q&A of the Owner and the Data Team', '## 7. Where it stands (context)', '## 8. What colleagues noted (context)'];
    expect(order.map((heading) => text.indexOf(heading))).toEqual([...order.map((heading) => text.indexOf(heading))].sort((a, b) => a - b));
    expect(order.filter((heading) => !text.includes(heading))).toEqual([]);
    expect(text).toContain('Credit leads per **week**.');
    // A Known Gap with where it holds, as data (FR-RC-25); Reliable since first in its part, on its Date Field, no longer under Watch out (DEC-UX-296).
    expect(text).toContain(
      '## 5. Reliable since, Known Gaps (when interpreting results)\nReliable since: from 2025-01-01 on week_start; not earlier because: 2024 was loaded once from the old CRM export. Do not read earlier data as reliable.\n- No partner leads before March. [period: until 2025-02-28; rows: lead_source = partner]',
    );
    expect(text).not.toMatch(/Watch out[^#]*Reliable since/);
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
      [5, 'Reliable since, Known Gaps', 'When interpreting results', 3],
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

  it('guides the Owner Journey from the journey Data Hub gives: the next step, what is open, its Learning Cards, and who goes no further (OP-CL-12, DEC-CL-17)', async () => {
    const journey = journeyOf({
      level: 2,
      inCollection: true,
      published: false,
      businessDescription: '',
      keyFields: [],
      fields: [{ name: 'week_start', businessDescription: '' }],
      intendedUse: 'Weekly trends.',
      pitfalls: '',
      knownGaps: 0,
      reliableSince: null,
      modelType: null,
      grain: [],
      mappings: 0,
      openMessages: 1,
      records: [{ step: 'data', answer: 'goneThrough', by: 'An', at: '2026-11-15T09:00:00Z' }],
    });
    answers[`GET ${CATALOGUE}/resources/${RESOURCE_ID}`] = () => [200, detail({ level: 2, published: false, journey })];
    answers[`GET ${CATALOGUE}/collections/c-1`] = () => [200, collection];
    answers[`GET ${QUERY}/resources/${RESOURCE_ID}/storage`] = () => [200, { storage: null }];
    const owner = await issuer.sign({ groups: ['g-credit'] });
    const guided = await tool('guide_owner_journey', { id: RESOURCE_ID }, owner);
    expect(guided.structuredContent).toMatchObject({
      ready: false,
      open: ['businessDescription', 'keyFields', 'fields', 'pitfalls', 'since', 'gaps'],
      you: { mayPublish: true, mayDescribe: true },
      next: { number: 2, step: 'businessDescription', mark: 'required to publish', writes: 'update_resource_card' },
    });
    // A card not written yet goes by its number, so that Claude never makes one up (FR-CL-15).
    // Its Learning Card goes with it as a strip: number, title, core idea and gain (DEC-UX-261).
    const window = guided.structuredContent as { view: string; next: { cards: unknown }; window: { held: unknown } };
    expect(window.view).toBe('journey');
    expect(window.next.cards).toEqual([expect.objectContaining({ number: 'K5.14', title: 'The Business Description', coreIdea: expect.stringContaining('**Business Description**') })]);
    // The window shows what the step holds now: the text on the card from the Owner, beside the description from dbt.
    expect(window.window.held).toEqual([
      expect.objectContaining({ label: 'On the card now', origin: 'From the Owner', text: 'Credit leads per week.' }),
      expect.objectContaining({ label: 'Next to it', origin: 'From dbt' }),
    ]);
    // The window keeps the overview at hand, the definitions of the terms of the step behind the ⓘ after its title, and
    // links to its spot (FR-CL-33, FR-LR-44, DEC-CL-19).
    const shown = guided.structuredContent as { window: { overview: { steps: { number: number; state: string; mark: string; says: string }[]; done: number; open: number }; terms: { name: string; definition: string }[]; link: { url: string; label: string } } };
    expect(shown.window.overview.open).toBe(6);
    expect(shown.window.overview.steps.find((step) => step.number === 1)).toMatchObject({ state: 'done', says: 'Done' });
    expect(shown.window.overview.steps.find((step) => step.number === 2)).toMatchObject({ state: 'now', mark: 'Required' });
    expect(shown.window.overview.steps.find((step) => step.number === 10)).toMatchObject({ state: 'optional', mark: 'Optional' });
    expect(shown.window.terms).toEqual([{ name: 'Business Description', definition: expect.stringContaining('the description from dbt, which says how the data is made') }]);
    expect(shown.window).not.toHaveProperty('purpose');
    expect(shown.window.link).toEqual({ url: `${WEB}/resources/${RESOURCE_ID}/description`, label: 'Open the Description in Data Hub' });
    expect(guided.content[0]?.text).toContain('Step 2 of 12 is next: Business Description, required to publish.');
    expect(guided.content[0]?.text).toContain('Still open before it can be published: Business Description, Key Fields, Fields, Pitfalls, Reliable since, Known Gaps.');

    // The publication shows what is open, and sends Claude back to the journey: no declaration to tick yet (DEC-MR-15).
    const publish = await tool('publish_resource', { id: RESOURCE_ID }, owner);
    expect(publish.structuredContent).toMatchObject({ view: 'publish', ready: false, checks: { ready: false, done: ['Intended use'] } });
    expect(publish.content[0]?.text).toContain('take them through these steps with guide_owner_journey first');

    // Outside the Owner Unit, and without describing it: who publishes it, and no further (FR-CL-03).
    const outside = await tool('guide_owner_journey', { id: RESOURCE_ID }, await issuer.sign({ as: 'lensUser' }));
    expect(outside.content[0]?.text).toContain('Only Credit team, the Owner Unit of Credit leads, describes and publishes Weekly lead volume.');

    // "Nothing to add", kept by Data Hub with the name of the User; only where none is an answer (DEC-MR-16).
    answers[`POST ${CATALOGUE}/resources/${RESOURCE_ID}/journey/pitfalls`] = () => [200, { journey }];
    expect((await tool('record_journey_step', { id: RESOURCE_ID, step: 'pitfalls', answer: 'nothing' }, owner)).isError).toBeUndefined();
    expect(asked.find((call) => call.method === 'POST')?.body).toEqual({ answer: 'nothing' });
    expect((await tool('record_journey_step', { id: RESOURCE_ID, step: 'pitfalls', answer: 'goneThrough' }, owner)).isError).toBe(true);
  });

  it('keeps the declaration the User ticked with the Confirmation (DEC-MR-17)', async () => {
    answers[`POST ${CATALOGUE}/resources/${RESOURCE_ID}/publication`] = () => [200, detail()];
    answers[`GET ${CATALOGUE}/resources/${RESOURCE_ID}`] = () => [200, detail()];
    answers[`GET ${CATALOGUE}/collections/c-1`] = () => [200, collection];
    answers[`GET ${QUERY}/resources/${RESOURCE_ID}/storage`] = () => [200, { storage: null }];
    const declaration = 'For Credit team, I have read this card and confirm that this Resource is correct.';
    await tool('confirm_publication', { id: RESOURCE_ID, declaration }, await issuer.sign({ groups: ['g-credit'] }));
    expect(asked.find((call) => call.method === 'POST')?.body).toEqual({ declaration });
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

  it('writes Reliable since as from its first row or a later day with why, and its Date Field, never over a colleague (FR-RC-31, FR-RC-32)', async () => {
    const set = { from: 'day', day: '2025-01-01', why: '2024 was loaded once from the old CRM export.', setBy: 'An', setAt: '2026-11-15T10:00:00Z' };
    answers[`GET ${CATALOGUE}/resources/${RESOURCE_ID}`] = () => [200, detail({ card: { ...detail().resource.card, reliableSince: set, dateField: null } })];
    answers[`PATCH ${CATALOGUE}/resources/${RESOURCE_ID}`] = () => [200, detail()];
    const owner = await issuer.sign();
    const card = (await toolsOf(owner)).find((item) => item.name === 'update_resource_card');
    expect(Object.keys(card?.inputSchema.properties ?? {})).toEqual(expect.arrayContaining(['reliableSince', 'dateField']));
    expect(card?.description).toContain('never set it by default');

    // A bare day, as before, or a later day without why, is refused before it is sent.
    expect((await tool('update_resource_card', { id: RESOURCE_ID, reliableSince: '2025-01-01' }, owner)).isError).toBe(true);
    expect((await tool('update_resource_card', { id: RESOURCE_ID, reliableSince: { from: 'day', day: '2025-01-01', why: ' ' } }, owner)).isError).toBe(true);
    expect(asked.some((call) => call.method === 'PATCH')).toBe(false);

    // What Claude showed is compared without who set it and when: From its first row, on another Date Field.
    const written = await tool('update_resource_card', { id: RESOURCE_ID, reliableSince: { from: 'firstRow' }, dateField: 'week_start', before: { reliableSince: { from: 'day', day: '2025-01-01', why: '2024 was loaded once from the old CRM export.' }, dateField: null } }, owner);
    expect(written.isError).toBeUndefined();
    expect(asked.find((call) => call.method === 'PATCH')?.body).toEqual({ reliableSince: { from: 'firstRow' }, dateField: 'week_start' });

    // A colleague set it meanwhile: not written over.
    asked.length = 0;
    const stale = await tool('update_resource_card', { id: RESOURCE_ID, reliableSince: { from: 'firstRow' }, before: { reliableSince: null } }, owner);
    expect(stale.isError).toBe(true);
    expect(stale.content[0]?.text).toContain('reliableSince is now');
    expect(asked.some((call) => call.method === 'PATCH')).toBe(false);
  });

  it('takes the Owner through Reliable since as a step of its own, before the Known Gaps, on the Date Field its table type gives (DEC-MR-18, FR-RC-32)', async () => {
    const said = { by: 'An', at: '2026-11-15T09:00:00Z' };
    const journey = journeyOf({
      level: 2,
      inCollection: true,
      published: false,
      businessDescription: 'Credit leads per week.',
      keyFields: ['week_start'],
      fields: [{ name: 'week_start', businessDescription: 'The Monday of the week.' }],
      intendedUse: 'Weekly trends.',
      pitfalls: 'The current week is incomplete.',
      knownGaps: 0,
      reliableSince: null,
      modelType: 'aggregate',
      grain: ['week_start'],
      mappings: 0,
      openMessages: 0,
      records: [{ step: 'data', answer: 'goneThrough', ...said }],
    });
    const fields = [
      { name: 'week_start', dataType: 'DATE', description: 'Monday of the week', businessDescription: 'The Monday of the week.' },
      { name: 'loaded_at', dataType: 'TIMESTAMP', description: '', businessDescription: '' },
      { name: 'lead_count', dataType: 'INT64', description: '', businessDescription: '' },
    ];
    const details = { partition: null, clusterBy: [], grain: ['week_start'], grainSentence: '', modelType: 'aggregate', typeFields: [{ field: 'week_start', role: 'period', origin: 'here' }] };
    answers[`GET ${CATALOGUE}/resources/${RESOURCE_ID}`] = () => [200, detail({ level: 2, published: false, journey, fields, details, card: { ...detail().resource.card, intendedUse: 'Weekly trends.', keyFields: ['week_start'] } })];
    answers[`GET ${CATALOGUE}/collections/c-1`] = () => [200, collection];
    const guided = await tool('guide_owner_journey', { id: RESOURCE_ID }, await issuer.sign({ groups: ['g-credit'] }));
    const data = guided.structuredContent as { next: { number: number; step: string; writes: string; ask: string }; open: string[]; window: { held: { label: string; text?: string; chips?: string[]; none?: string }[]; link: { label: string; url: string }; total: number } };
    expect(data.next).toMatchObject({ number: 7, step: 'since', writes: 'update_resource_card' });
    expect(data.next.ask).toContain('Never choose one for the Owner');
    expect(data.open).toEqual(['since', 'gaps']);
    expect(data.window.total).toBe(12);
    expect(data.window.held).toEqual([
      { label: 'Reliable since', text: undefined, none: expect.stringContaining('neither from its first row nor from a later day') },
      { label: 'Read on', text: 'week_start, from its table type: period of an aggregate.', none: expect.any(String) },
      { label: 'Its date fields', chips: ['week_start', 'loaded_at'], none: expect.any(String) },
    ]);
    expect(data.window.link).toEqual({ url: `${WEB}/resources/${RESOURCE_ID}/gaps`, label: 'Open Reliable since in Data Hub' });
    expect(guided.content[0]?.text).toContain('Step 7 of 12 is next: Reliable since, required to publish.');

    // Another Date Field than its table type gives is unusual, and the window says so.
    answers[`GET ${CATALOGUE}/resources/${RESOURCE_ID}`] = () => [
      200,
      detail({ level: 2, published: false, journey, fields, details, card: { ...detail().resource.card, reliableSince: { from: 'firstRow', day: null, why: '', setBy: 'An', setAt: said.at }, dateField: 'loaded_at' } }),
    ];
    const odd = (await tool('guide_owner_journey', { id: RESOURCE_ID }, await issuer.sign({ groups: ['g-credit'] }))).structuredContent as typeof data;
    expect(odd.window.held[0]?.text).toBe('From its first row: the whole table can be relied on, as far back as it goes.');
    expect(odd.window.held[1]?.text).toMatch(/^loaded_at, chosen\. Unusual: its table type gives week_start/);
  });

  it('writes a Known Gap of one day on another date field, and reads it as data (FR-RC-33, FR-RC-34)', async () => {
    const owner = await issuer.sign();
    const scope = { period: { from: '2026-10-21', to: '2026-10-21', dateField: 'loaded_at' } };
    answers[`POST ${CATALOGUE}/resources/${RESOURCE_ID}/gaps`] = () => [201, { gap: { id: '8', text: 'Fair leads entered a week late.', scope, addedBy: 'An', addedAt: '2026-11-03T10:00:00Z' } }];
    expect((await tool('add_known_gap', { id: RESOURCE_ID, text: 'Fair leads entered a week late.', scope }, owner)).isError).toBeUndefined();
    expect(asked.find((call) => call.method === 'POST')?.body).toEqual({ text: 'Fair leads entered a week late.', scope });
    answers[`GET ${CATALOGUE}/resources/${RESOURCE_ID}`] = () => [200, detail({ card: { ...detail().resource.card, knownGaps: [{ id: '8', text: 'Fair leads entered a week late.', scope, addedBy: 'An', addedAt: '2026-11-03T10:00:00Z' }] } })];
    answers[`GET ${CATALOGUE}/collections/c-1`] = () => [200, collection];
    const text = (await tool('get_resource', { id: RESOURCE_ID }, owner)).content[0]?.text ?? '';
    expect(text).toContain('- Fair leads entered a week late. [period: on 2026-10-21 on loaded_at]');
  });

  it('shows the fields Claude suggests in a card, and writes only what the User saves there, never over a colleague (FR-CL-38, DEC-CL-22)', async () => {
    const owner = await issuer.sign();
    const fields = [
      { name: 'week_start', dataType: 'DATE', description: 'Monday of the week', businessDescription: '' },
      { name: 'lead_source', dataType: 'STRING', description: 'Where the lead came from', businessDescription: 'The website, the app or a partner.' },
      { name: 'lead_count', dataType: 'INT64', description: 'Number of leads', businessDescription: '' },
    ];
    const card = { ...detail().resource.card, keyFields: ['lead_source'] };
    answers[`GET ${CATALOGUE}/resources/${RESOURCE_ID}`] = () => [200, detail({ fields, card, details: { partition: { field: 'week_start' }, clusterBy: ['lead_source'] } })];
    answers[`GET ${CATALOGUE}/collections/c-1`] = () => [200, collection];
    // Only the MCP App saves: Claude is not offered save_fields.
    expect(appOnly(await toolsOf(owner))).toContain('save_fields');

    const shown = await tool('suggest_fields', {
      id: RESOURCE_ID,
      keyFields: ['week_start', 'lead_count', 'no_such_field'],
      descriptions: [
        { name: 'week_start', text: 'The Monday of the week the lead came in.' },
        { name: 'lead_source', text: 'Where it came in.' },
      ],
      basedOn: 'the names and the descriptions from dbt',
    }, owner);
    const view = shown.structuredContent as { view: string; rows: { name: string; text: string; mark: string; key: boolean; wasKey: boolean; pills: string[] }[]; before: { keyFields: string[] }; mayKey: boolean; mayText: boolean };
    expect(view).toMatchObject({ view: 'fields', mayKey: true, mayText: true, before: { keyFields: ['lead_source'] } });
    expect(view.rows).toEqual([
      expect.objectContaining({ name: 'week_start', text: 'The Monday of the week the lead came in.', mark: 'suggested', key: true, wasKey: false, pills: ['Partition'] }),
      // A text on the card is kept: Claude's suggestion never replaces it.
      expect.objectContaining({ name: 'lead_source', text: 'The website, the app or a partner.', mark: 'card', key: true, wasKey: true, pills: ['Cluster 1'] }),
      expect.objectContaining({ name: 'lead_count', text: '', mark: 'empty', key: true }),
    ]);
    expect(shown.content[0]?.text).toContain('Nothing is written');
    expect(shown.content[0]?.text).toContain('Kept the text already on the card for lead_source.');
    expect(shown.content[0]?.text).toContain('Not fields of this Resource, left out: no_such_field.');
    expect(asked.some((call) => call.method !== 'GET')).toBe(false);

    // The User saves; a colleague described lead_count since the card opened, which stays theirs.
    answers[`GET ${CATALOGUE}/resources/${RESOURCE_ID}`] = () => [200, detail({ fields: fields.map((field) => (field.name === 'lead_count' ? { ...field, businessDescription: 'Leads sent to KBC.' } : field)), card })];
    answers[`GET ${CATALOGUE}/resources/${RESOURCE_ID}/log`] = () => [200, { entries: [{ logId: 'RES-010', params: { field: 'lead_count', actor: 'An Claes' }, at: '2026-11-18T12:38:00.000Z' }] }];
    answers[`PATCH ${CATALOGUE}/resources/${RESOURCE_ID}`] = () => [200, detail()];
    answers[`PUT ${CATALOGUE}/resources/${RESOURCE_ID}/fields`] = () => [200, {}];
    const saved = await tool('save_fields', {
      id: RESOURCE_ID,
      keyFields: ['lead_source', 'week_start'],
      fields: [{ name: 'week_start', businessDescription: 'The Monday of the week the lead came in.' }, { name: 'lead_count', businessDescription: 'How many leads.' }],
      before: { keyFields: ['lead_source'], fields: fields.map(({ name, businessDescription }) => ({ name, businessDescription })) },
    }, owner);
    expect(asked.find((call) => call.method === 'PATCH')?.body).toEqual({ keyFields: ['lead_source', 'week_start'] });
    expect(asked.find((call) => call.method === 'PUT')?.body).toEqual({ fields: [{ name: 'week_start', businessDescription: 'The Monday of the week the lead came in.' }] });
    expect(saved.structuredContent).toMatchObject({ view: 'fields', saved: { descriptions: ['week_start'] }, conflicts: [{ name: 'lead_count', theirs: 'Leads sent to KBC.', mine: 'How many leads.', by: 'An Claes' }] });
    expect(saved.content[0]?.text).toContain('Not saved, as a colleague described it after the card opened: lead_count, by An Claes.');
  });

  it('writes a Known Gap one at a time, with its scope, and never through the card (DEC-CL-20, FR-CL-34)', async () => {
    const owner = await issuer.sign();
    // The card tool no longer takes the Known Gaps as a list of texts.
    const card = (await toolsOf(owner)).find((item) => item.name === 'update_resource_card');
    expect(Object.keys(card?.inputSchema.properties ?? {})).not.toContain('knownGaps');

    const scope = { rows: { field: 'query', is: 'empty' } };
    answers[`POST ${CATALOGUE}/resources/${RESOURCE_ID}/gaps`] = () => [201, { gap: { id: '7', text: 'Anonymised queries have no text.', scope, addedBy: 'An', addedAt: '2026-11-17T10:00:00Z' } }];
    const added = await tool('add_known_gap', { id: RESOURCE_ID, text: 'Anonymised queries have no text.', scope }, owner);
    expect(added.isError).toBeUndefined();
    expect(asked.find((call) => call.method === 'POST')?.body).toEqual({ text: 'Anonymised queries have no text.', scope });
    // Its link opens the Known Gaps of the Resource in Data Hub (DEC-CL-19).
    expect(added.structuredContent).toMatchObject({ page: expect.stringMatching(new RegExp(`/resources/${RESOURCE_ID}/gaps$`)) });
    // A scope Data Hub cannot read is refused before it is sent.
    expect((await tool('add_known_gap', { id: RESOURCE_ID, text: 'A gap.', scope: { period: { from: 'last week', to: null } } }, owner)).isError).toBe(true);

    // Changing only the scope keeps the text, and who added it stays with Data Hub.
    const gap = { id: '1', text: 'No partner leads before March.', scope: { period: { from: null, to: '2025-02-28' } }, addedBy: 'An', addedAt: '2026-11-01T10:00:00Z' };
    answers[`GET ${CATALOGUE}/resources/${RESOURCE_ID}`] = () => [200, detail({ card: { businessDescription: '', intendedUse: '', pitfalls: '', knownGaps: [gap], reliableSince: null, keyFields: [] } })];
    answers[`PATCH ${CATALOGUE}/resources/${RESOURCE_ID}/gaps/1`] = () => [200, { gap: { ...gap, scope: { fields: ['lead_source'] } } }];
    asked.length = 0;
    const changed = await tool('change_known_gap', { id: RESOURCE_ID, gap: '1', scope: { fields: ['lead_source'] }, before: { text: gap.text, scope: gap.scope } }, owner);
    expect(changed.isError).toBeUndefined();
    expect(asked.find((call) => call.method === 'PATCH')?.body).toEqual({ text: gap.text, scope: { fields: ['lead_source'] } });
    // Not over what a colleague changed since Claude showed it (EC-CL-03).
    asked.length = 0;
    const stale = await tool('change_known_gap', { id: RESOURCE_ID, gap: '1', text: 'Something else.', before: { text: 'An older text.', scope: null } }, owner);
    expect(stale.isError).toBe(true);
    expect(asked.some((call) => call.method === 'PATCH')).toBe(false);

    answers[`DELETE ${CATALOGUE}/resources/${RESOURCE_ID}/gaps/1`] = () => [204, null];
    expect((await tool('remove_known_gap', { id: RESOURCE_ID, gap: '1', before: gap.text }, owner)).isError).toBeUndefined();
    expect(asked.some((call) => call.method === 'DELETE' && call.url.endsWith('/gaps/1'))).toBe(true);
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

describe('Projects through Claude (FR-SR-63 to FR-SR-68, DEC-SR-49)', () => {
  const PROJECT_ID = '5c2d1e0f-3a4b-4c5d-8e6f-7a8b9c0d1e2f';
  const OTHER_ID = '6d3e2f10-4b5c-4d6e-9f70-8b9c0d1e2f30';
  const PAGE = `${WEB}/query/projects/${PROJECT_ID}`;
  const mine = { id: QUERY_ID, name: 'Partner share per week', owner: { id: '101', name: 'An Claes' }, lastRun: null, position: 0, locked: false, question: '', resources: [{ id: RESOURCE_ID, displayName: 'Weekly lead volume' }], broken: null };
  const project = (queries: object[] = [mine]) => ({
    id: PROJECT_ID,
    name: 'Credit leads Q4',
    description: 'The quarterly review.',
    madeBy: { id: '101', name: 'An Claes' },
    members: [{ id: '101', name: 'An Claes', addedBy: null, queriesMade: 1 }],
    queries,
  });
  /** A query of the User, in the Project given, or in none. */
  const queryIn = (inProject: { id: string; name: string } | null) => () => [200, { query: { id: QUERY_ID, name: 'Partner share per week', project: inProject } }] as [number, unknown];

  it('lists the Projects of the User, each with its page (FR-SR-63)', async () => {
    answers[`GET ${QUERY}/projects`] = () => [
      200,
      { projects: [{ id: PROJECT_ID, name: 'Credit leads Q4', description: 'The quarterly review.', updatedAt: '2026-11-19T10:00:00Z', queries: 51, members: [{ id: '101', name: 'An Claes' }, { id: '102', name: 'Karel Leys' }] }] },
    ];
    const result = await tool('list_projects', {}, await issuer.sign());
    expect(result.structuredContent).toEqual({
      projects: [{ id: PROJECT_ID, name: 'Credit leads Q4', description: 'The quarterly review.', updatedAt: '2026-11-19T10:00:00Z', queries: 51, members: [{ id: '101', name: 'An Claes' }, { id: '102', name: 'Karel Leys' }], page: PAGE }],
    });
    answers[`GET ${QUERY}/projects`] = () => [200, { projects: [] }];
    expect((await tool('list_projects', {}, await issuer.sign())).content[0]?.text).toContain('The User is in no Project');
  });

  it('reads a Project with its queries in their order, a locked one without its SQL, and says when it was deleted (OP-UX-97, OP-UX-100)', async () => {
    const locked = { id: 'q-2', name: 'Salaries per team', owner: { id: '102', name: 'Karel Leys' }, lastRun: null, position: 1, locked: true, notSeen: ['Salaries'] };
    answers[`GET ${QUERY}/projects/${PROJECT_ID}`] = () => [200, { project: project([mine, locked]) }];
    const read = await tool('get_project', { id: PROJECT_ID }, await issuer.sign());
    expect(read.structuredContent).toMatchObject({ project: { page: PAGE, queries: [{ id: QUERY_ID, page: `${WEB}/query/${QUERY_ID}` }, { id: 'q-2', locked: true, page: `${WEB}/query/q-2` }] } });
    expect(read.content[0]?.text).toContain('Salaries per team reads Salaries, which they may not see. Say so; never guess at their SQL.');

    answers[`GET ${QUERY}/projects/${PROJECT_ID}`] = () => [200, { project: { id: PROJECT_ID, name: 'Credit leads Q4', deleted: { at: '2026-11-19T10:00:00Z', by: 'Karel Leys', reason: 'The quarter is closed.' } } }];
    const deleted = await tool('get_project', { id: PROJECT_ID }, await issuer.sign());
    expect(deleted.content[0]?.text).toMatch(/^The Project Credit leads Q4 was deleted by Karel Leys on 2026-11-19T10:00:00Z, because: The quarter is closed\./);
  });

  it('makes a Project with queries of the User, says which moved out of another, and that only the User is in it (FR-SR-63, OP-UX-93)', async () => {
    let sent: unknown;
    answers[`GET ${QUERY}/queries/${QUERY_ID}`] = queryIn({ id: OTHER_ID, name: 'Old review' });
    answers[`POST ${QUERY}/projects`] = (body) => ((sent = body), [201, { project: project() }]);
    const made = await tool('create_project', { name: 'Credit leads Q4', description: 'The quarterly review.', queries: [QUERY_ID] }, await issuer.sign());
    expect(sent).toEqual({ name: 'Credit leads Q4', description: 'The quarterly review.', queries: [QUERY_ID] });
    expect(made.structuredContent).toMatchObject({ project: { id: PROJECT_ID, page: PAGE, queries: [{ id: QUERY_ID, page: `${WEB}/query/${QUERY_ID}` }] }, movedFrom: [{ query: QUERY_ID, project: { id: OTHER_ID, name: 'Old review' } }] });
    expect(made.content[0]?.text).toContain(`The Project Credit leads Q4 is made, with 1 query: ${PAGE}.`);
    expect(made.content[0]?.text).toContain('Partner share per week (from Old review)');
    expect(made.content[0]?.text).toContain('Only the User is in it: they share it with colleagues themselves, on its page in Data Hub.');

    // Without queries, nothing to read first.
    asked = [];
    await tool('create_project', { name: 'Empty' }, await issuer.sign());
    expect(asked.map((call) => `${call.method} ${call.url}`)).toEqual([`POST ${QUERY}/projects`]);
    expect(sent).toEqual({ name: 'Empty', queries: [] });
  });

  it('puts a query in a Project: not again when it is in it, and says from which Project it moved (OP-UX-93)', async () => {
    const token = await issuer.sign();
    const put = `${QUERY}/projects/${PROJECT_ID}/queries/${QUERY_ID}`;
    answers[`PUT ${put}`] = () => [200, { added: true }];

    answers[`GET ${QUERY}/queries/${QUERY_ID}`] = queryIn({ id: PROJECT_ID, name: 'Credit leads Q4' });
    const already = await tool('add_query_to_project', { id: PROJECT_ID, query: QUERY_ID }, token);
    expect(already.content[0]?.text).toContain('is in this Project already: nothing changed');
    expect(asked.some((call) => call.method === 'PUT')).toBe(false);

    answers[`GET ${QUERY}/queries/${QUERY_ID}`] = queryIn(null);
    const added = await tool('add_query_to_project', { id: PROJECT_ID, query: QUERY_ID }, token);
    expect(asked.filter((call) => call.method === 'PUT').map((call) => call.url)).toEqual([put]);
    expect(added.structuredContent).toMatchObject({ added: true, movedFrom: null, project: { page: PAGE } });
    expect(added.content[0]?.text).toBe(`The query Partner share per week is in the Project now, at the end of its row.\n${JSON.stringify(added.structuredContent)}`);

    answers[`GET ${QUERY}/queries/${QUERY_ID}`] = queryIn({ id: OTHER_ID, name: 'Old review' });
    const moved = await tool('add_query_to_project', { id: PROJECT_ID, query: QUERY_ID }, token);
    expect(moved.structuredContent).toMatchObject({ added: true, movedFrom: { id: OTHER_ID, name: 'Old review', page: `${WEB}/query/projects/${OTHER_ID}` } });
    expect(moved.content[0]?.text).toContain('moved out of the Project Old review into this one');
  });

  it('takes a query out of a Project, where it stays with whoever made it (FR-SR-66)', async () => {
    let removed = true;
    answers[`DELETE ${QUERY}/projects/${PROJECT_ID}/queries/${QUERY_ID}`] = () => [200, { removed }];
    const out = await tool('remove_query_from_project', { id: PROJECT_ID, query: QUERY_ID }, await issuer.sign());
    expect(out.content[0]?.text).toContain('The query stays with whoever made it, in their history of Query.');
    removed = false;
    expect((await tool('remove_query_from_project', { id: PROJECT_ID, query: QUERY_ID }, await issuer.sign())).content[0]?.text).toContain('was not in this Project');
  });

  it('changes a Project and the order of its queries, one for everyone in it (OP-UX-95)', async () => {
    const token = await issuer.sign();
    const second = { ...mine, id: 'q-2', name: 'Leads per source', position: 1 };
    let order: unknown;
    answers[`PUT ${QUERY}/projects/${PROJECT_ID}/order`] = (body) => ((order = body), [200, { queries: ['q-2', QUERY_ID] }]);
    answers[`PATCH ${QUERY}/projects/${PROJECT_ID}`] = () => [200, { project: { id: PROJECT_ID, name: 'Credit leads, Q4' } }];
    answers[`GET ${QUERY}/projects/${PROJECT_ID}`] = () => [200, { project: project([second, mine]) }];

    expect((await tool('update_project', { id: PROJECT_ID }, token)).isError).toBe(true);
    expect(asked).toHaveLength(0);

    const ordered = await tool('update_project', { id: PROJECT_ID, order: ['q-2', 'q-gone'] }, token);
    expect(order).toEqual({ queries: ['q-2', 'q-gone'] });
    expect(asked.some((call) => call.method === 'PATCH')).toBe(false);
    expect(ordered.structuredContent).toMatchObject({ project: { page: PAGE, queries: [{ id: 'q-2' }, { id: QUERY_ID }] } });
    expect(ordered.content[0]?.text).toContain('its first ten queries have the keys Cmd+1 to Cmd+0');
    expect(ordered.content[0]?.text).toContain('Not in this Project, so passed over: q-gone.');

    asked = [];
    await tool('update_project', { id: PROJECT_ID, name: 'Credit leads, Q4' }, token);
    expect(asked.find((call) => call.method === 'PATCH')?.body).toEqual({ name: 'Credit leads, Q4' });
    expect(asked.some((call) => call.url.endsWith('/order'))).toBe(false);
  });

  it('makes a query in a Project, also an empty one without Resources, and none without either (FR-SR-68)', async () => {
    let made: unknown;
    answers[`POST ${QUERY}/queries`] = (body) => ((made = body), [201, { query: { id: QUERY_ID, name: 'New query', resources: [], project: { id: PROJECT_ID, name: 'Credit leads Q4' } } }]);
    const token = await issuer.sign();
    const empty = await tool('create_query', { name: 'New query', resources: [], project: PROJECT_ID }, token);
    expect(made).toEqual({ name: 'New query', resources: [], project: PROJECT_ID });
    expect(empty.content[0]?.text).toContain(`It is in the Project Credit leads Q4, at the end of its row: ${PAGE}.`);
    expect(empty.content[0]?.text).toContain('It has no Resources yet: they come later, added by the User in Data Hub, or with a new query on them');
    expect(empty.content[0]?.text).not.toContain('check_query');
    expect(empty.structuredContent).toMatchObject({ query: { page: `${WEB}/query/${QUERY_ID}` }, project: { id: PROJECT_ID, page: PAGE } });

    // Without a Project, a query of a User who is no power user needs a Resource: refused before Data Hub is asked.
    made = undefined;
    const refused = await tool('create_query', { name: 'New query', resources: [] }, token);
    expect(refused).toMatchObject({ isError: true });
    expect(refused.content[0]?.text).toContain('Only an empty query in a Project, made with project, starts without them.');
    expect(made).toBeUndefined();
  });

  it('offers the Project tools only to a User who may make queries (queries.make)', async () => {
    const PROJECT_TOOLS = ['add_query_to_project', 'create_project', 'get_project', 'list_projects', 'remove_query_from_project', 'update_project'];
    expect(names(await toolsOf(await issuer.sign()))).toEqual(expect.arrayContaining(PROJECT_TOOLS));
    const noQueries = names(await toolsOf(await issuer.sign({ permissions: permissionsOf('businessAnalyst', (permissions) => (permissions['queries.make'].on = false)) })));
    for (const name of PROJECT_TOOLS) expect(noQueries).not.toContain(name);
    // Sharing, leaving and deleting a Project stay in Data Hub.
    expect(names(await toolsOf(await issuer.sign({ as: 'admin' }))).filter((name) => /project/.test(name))).toEqual(PROJECT_TOOLS);
  });
});

describe('the Permissions of the User in Claude (TR-PL-09)', () => {
  const READS = ['explain', 'get_lens', 'get_messages', 'get_related_resources', 'get_resource', 'get_resource_lineage', 'get_resource_log', 'guide_owner_journey', 'how_to_use', 'list_resources', 'search', 'show_learning_card', 'show_resource', 'suggest_lenses', 'who_am_i'];
  // Every User who sees a Lens may run it, through Claude too (FR-CL-36).
  const LENS_RUNS = ['run_lens', 'run_lens_approved'];
  const QUERY_TOOLS = ['check_query', 'create_query', 'get_query', 'get_result_page', 'list_queries', 'run_query', 'run_query_approved', 'send_query_request', 'show_query', 'update_query'];
  // A Project holds queries, so its tools come with queries.make (DEC-SR-49).
  const PROJECT_TOOLS = ['add_query_to_project', 'create_project', 'get_project', 'list_projects', 'remove_query_from_project', 'update_project'];
  const PREVIEW_TOOLS = ['preview_resource', 'run_preview_approved', 'send_preview_request'];
  const WRITES = ['add_known_gap', 'change_known_gap', 'deprecate_resource', 'describe_fields', 'mark_changes_seen', 'record_journey_step', 'remove_known_gap', 'reply_to_message', 'undeprecate_resource', 'update_resource_card', 'write_message'];
  // The fields suggested by Claude, decided by the User in a card: only for who may describe them (FR-CL-38).
  const FIELDS = ['save_fields', 'suggest_fields'];
  // The EDA, for who may explore Resources (DEC-ED-25, DEC-ED-29).
  const EDA_TOOLS = ['get_eda', 'give_eda_reading', 'run_eda_probe', 'run_eda_probe_approved', 'show_eda'];

  it('offers an Admin every tool, the queries of others included', async () => {
    const tools = names(await toolsOf(await issuer.sign({ as: 'admin' })));
    expect(tools).toEqual([...READS, ...LENS_RUNS, ...QUERY_TOOLS, ...PROJECT_TOOLS, ...PREVIEW_TOOLS, ...WRITES, ...FIELDS, ...EDA_TOOLS, 'confirm_publication', 'get_resource_queries', 'publish_resource'].sort());
  });

  it('offers a Lens user no query tools and no Preview, and lets Claude write only their Questions and Signals', async () => {
    const tools = await toolsOf(await issuer.sign({ as: 'lensUser' }));
    // They run the Lenses they see, in a card only, whose rows the MCP App reads itself (FR-CL-28, FR-CL-36).
    expect(names(tools)).toEqual([...READS, ...LENS_RUNS, 'read_result_rows', 'reply_to_message', 'write_message'].sort());
    for (const name of [...QUERY_TOOLS, ...PROJECT_TOOLS, ...PREVIEW_TOOLS, 'read_preview_choices', 'publish_resource', 'get_resource_queries']) expect(names(tools)).not.toContain(name);
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
    for (const name of ['update_resource_card', 'describe_fields', ...FIELDS, 'add_known_gap', 'change_known_gap', 'remove_known_gap', 'mark_changes_seen', 'deprecate_resource', 'undeprecate_resource', 'record_journey_step']) expect(tools).not.toContain(name);

    // Only the attributes they may describe: pitfalls, so no Business Descriptions of fields and no changes marked seen.
    const pitfalls = permissionsOf('businessAnalyst', (permissions) => (permissions['resources.describe'].values = { reach: 'theirs', attributes: ['pitfalls'] }));
    const described = await toolsOf(await issuer.sign({ permissions: pitfalls }));
    expect(Object.keys(described.find((item) => item.name === 'update_resource_card')?.inputSchema.properties ?? {}).sort()).toEqual(['before', 'id', 'pitfalls']);
    expect(names(described)).not.toContain('describe_fields');
    for (const name of FIELDS) expect(names(described)).not.toContain(name);
    expect(names(described)).not.toContain('mark_changes_seen');
    expect(names(described)).not.toContain('add_known_gap');

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

  it('lets a power user make a query on SQL alone and says what it reads outside Data Hub, as the web app does (FR-SR-56)', async () => {
    let made: unknown;
    answers[`POST ${QUERY}/queries`] = (body) => ((made = body), [201, { query: { id: QUERY_ID, name: 'Raw leads', resources: [] } }]);
    const tables = [{ key: 'immoscoop-dataplatform.dbt_prod_staging.stg_oltp__leads', fullName: 'immoscoop-dataplatform.dbt_prod_staging.stg_oltp__leads', name: 'stg_oltp__leads', layer: 'staging' }];
    answers[`POST ${QUERY}/queries/${QUERY_ID}/preflight`] = () => [200, { preflight: { runnable: true, bytes: 1_000_000, range: 'free', partitions: null, problems: [], warnings: [], tables }, broken: null }];
    // Without the Permission, a query needs a Resource.
    expect((await tool('create_query', { name: 'Raw leads', resources: [] }, await issuer.sign())).isError).toBe(true);
    expect(made).toBeUndefined();

    const admin = await issuer.sign({ as: 'admin' });
    expect((await tool('create_query', { name: 'Raw leads', resources: [] }, admin)).isError).toBeFalsy();
    expect(made).toMatchObject({ name: 'Raw leads', resources: [] });
    const checked = await tool('check_query', { id: QUERY_ID, sql: 'select lead_id from `dbt_prod_staging.stg_oltp__leads`' }, admin);
    expect(checked.content[0]?.text).toContain('It reads stg_oltp__leads (staging) outside Data Hub: no Resource, so no Level, Owner or Publication, and this query cannot become a Lens.');
    const me = (await tool('who_am_i', {}, admin)).structuredContent as { mayDo: string[] };
    expect(me.mayDo).toContain('Query tables outside Data Hub: every table Data Hub knows from the dbt projects it follows, also without Resources; such a query never becomes a Lens');
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
    expect(appOnly(tools)).toEqual(['confirm_publication', 'read_preview_choices', 'read_result_rows', 'run_lens_approved', 'run_preview_approved', 'run_query_approved', 'save_fields', 'send_preview_request', 'send_query_request']);
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

    // No result opens the MCP App, and its buttons for a result are not there; a Resource, its publication, its journey,
    // a Learning Card and the fields Claude suggests still show, as they hold no rows.
    const tools = await toolsOf(token);
    const shows = names(tools.filter((item) => item._meta?.ui?.resourceUri === VIEW_URI && !item._meta.ui.visibility));
    expect(shows).toEqual(['guide_owner_journey', 'publish_resource', 'show_learning_card', 'show_resource', 'suggest_fields']);
    expect(appOnly(tools)).toEqual(['confirm_publication', 'save_fields']);
  });

  it('says a run too large for the Permission group of the User cannot run, and offers no Request', async () => {
    const preflight = { runnable: false, bytes: 4_800_000_000, range: 'request', partitions: 312, problems: [{ kind: 'tooLarge', bytes: 4_800_000_000, limit: 1_000_000_000 }], warnings: [] };
    answers[`POST ${QUERY}/queries/${QUERY_ID}/runs`] = () => [422, { error: 'not_runnable', message: 'It cannot run.', preflight }];
    const result = await tool('run_query', { id: QUERY_ID }, await showing('claude'));
    expect(result.structuredContent).toMatchObject({ outcome: 'blocked', problem: 'Too large for your Permission group: it reads 4.8 GB, and at most 1 GB runs. Narrow it: a filter on the partition column reads less.' });
    expect(result.content[0]?.text).toContain('no Request can be sent to the Data Team, so do not offer one');

    answers[`POST ${QUERY}/resources/${RESOURCE_ID}/preview/preflight`] = () => [200, { preflight, request: null }];
    const preview = await tool('preview_resource', { id: RESOURCE_ID }, await showing('card'));
    expect(preview.structuredContent).toMatchObject({ outcome: 'blocked', problem: expect.stringContaining('a narrower window or a choice reads less') });
    expect(asked.some((call) => call.url.endsWith('/preview/runs'))).toBe(false);
  });
});

describe('Lenses through Claude (FR-CL-36, FR-CL-37)', () => {
  const LENS_ID = 'l-1';
  const SECRET = 'kept-from-claude';
  const lens = (overrides: Record<string, unknown> = {}) => ({
    id: LENS_ID,
    name: 'Leads per source name',
    question: 'Which sources brought the credit leads in?',
    shows: 'The leads of each source, by its name.',
    steps: ['Takes the weekly lead volume.'],
    collectionId: 'c-1',
    state: 'published',
    broken: null,
    resources: [{ id: RESOURCE_ID, displayName: 'Weekly lead volume', level: 4 }],
    parameters: [
      { name: 'dateFrom', label: 'From', kind: 'date', value: 'DATE_TRUNC(CURRENT_DATE(), MONTH)' },
      { name: 'channel', label: 'Lead channel', kind: 'choice', value: 'Form', list: ['Form', 'Phone', 'Partner'] },
    ],
    fields: [{ name: 'leads', type: 'INT64', description: 'The number of leads that came in through this source.', from: null }],
    ...overrides,
  });
  const page = { number: 1, size: 100, totalRows: 1, columns: [{ name: 'source_name', type: 'STRING' }, { name: 'leads', type: 'INT64' }], rows: [[SECRET, 4242]] };
  const ran = { ref: 'q-7', number: 1, state: 'done', rowCount: 1, processedBytes: 24_000_000 };

  beforeEach(() => {
    answers[`GET ${QUERY}/lenses/${LENS_ID}`] = () => [200, { lens: lens() }];
    answers[`GET ${CATALOGUE}/collections/c-1`] = () => [200, collection];
    answers[`POST ${QUERY}/lenses/${LENS_ID}/runs`] = () => [201, { run: ran, page }];
  });

  it('reads a Lens with its Parameters, the day a date function gives today, its fields and its Levels', async () => {
    const result = await tool('get_lens', { id: LENS_ID }, await issuer.sign());
    const today = new Date();
    const first = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-01`;
    expect(result.structuredContent).toMatchObject({
      lens: {
        runs: true,
        parameters: [
          { name: 'dateFrom', label: 'From', kind: 'date', default: 'DATE_TRUNC(CURRENT_DATE(), MONTH)', gives: first },
          { name: 'channel', label: 'Lead channel', kind: 'choice', default: 'Form', list: ['Form', 'Phone', 'Partner'] },
        ],
        fields: [{ name: 'leads', description: 'The number of leads that came in through this source.' }],
        resources: [{ displayName: 'Weekly lead volume', levelName: '4 · Explored' }],
        page: `${WEB}/lenses/${LENS_ID}`,
      },
    });
  });

  it('runs a Lens with the values of the question and shows it with its Parameters to change (DEC-CL-21)', async () => {
    const result = await tool('run_lens', { id: LENS_ID, values: { dateFrom: '2026-11-09', channel: 'Phone' } }, await showing('claude'));
    expect(asked.find((call) => call.method === 'POST')?.body).toEqual({ values: { dateFrom: '2026-11-09', channel: 'Phone' }, approve: false });
    expect(result.structuredContent).toMatchObject({
      view: 'lens',
      outcome: 'ran',
      lens: { id: LENS_ID, name: 'Leads per source name', page: `${WEB}/lenses/${LENS_ID}` },
      collection: { name: 'Credit leads' },
      resources: [{ levelName: '4 · Explored' }],
      parameters: [
        { name: 'dateFrom', value: '2026-11-09', changed: true, default: { value: 'DATE_TRUNC(CURRENT_DATE(), MONTH)' } },
        { name: 'channel', value: 'Phone', changed: true, list: ['Form', 'Phone', 'Partner'] },
      ],
      fields: [{ name: 'leads', description: 'The number of leads that came in through this source.' }],
      run: { ref: 'q-7' },
      reads: '24 MB',
    });
    expect((result.structuredContent as { dateFunctions: { label: string }[] }).dateFunctions.map((fn) => fn.label)).toContain('Start of this week');
    expect(result.content[0]?.text).toContain('name the Levels: Weekly lead volume (4 · Explored)');
    expect(JSON.stringify(result)).toContain(SECRET);
  });

  it('above 100 MB waits for the button of the User, and above 1 GB does not run and sends nothing to the Data Team', async () => {
    const preflight = (bytes: number, range: string) => ({ runnable: true, bytes, range, partitions: 46, problems: [], warnings: [] });
    answers[`POST ${QUERY}/lenses/${LENS_ID}/runs`] = (body) =>
      (body as { approve: boolean }).approve
        ? [201, { run: { ...ran, processedBytes: 840_000_000 }, page }]
        : [409, { error: 'approval_needed', message: 'This query reads enough to need your approval.', preflight: preflight(840_000_000, 'approve') }];
    const token = await showing('claude');
    const waiting = await tool('run_lens', { id: LENS_ID, values: { dateFrom: 'DATE_TRUNC(CURRENT_DATE(), YEAR)' } }, token);
    expect(waiting.structuredContent).toMatchObject({ view: 'lens', outcome: 'approve', reads: '840 MB', given: { dateFrom: 'DATE_TRUNC(CURRENT_DATE(), YEAR)' } });
    expect(waiting.content[0]?.text).toContain('Only the User approves it');
    const approved = await tool('run_lens_approved', { id: LENS_ID, values: { dateFrom: 'DATE_TRUNC(CURRENT_DATE(), YEAR)' } }, token);
    expect(approved.structuredContent).toMatchObject({ outcome: 'ran' });
    expect(asked.filter((call) => call.method === 'POST').map((call) => (call.body as { approve: boolean }).approve)).toEqual([false, true]);

    answers[`POST ${QUERY}/lenses/${LENS_ID}/runs`] = () => [409, { error: 'request_needed', message: 'Too large.', preflight: preflight(2_400_000_000, 'request') }];
    const large = await tool('run_lens', { id: LENS_ID, values: { dateFrom: '2024-01-01' } }, token);
    expect(large.structuredContent).toMatchObject({ outcome: 'large', reads: '2.4 GB' });
    expect(large.content[0]?.text).toContain('nothing goes to the Data Team');
    expect(asked.some((call) => call.url.includes('/requests'))).toBe(false);
  });

  it('says why a Lens that stopped or is Broken does not run, and runs nothing', async () => {
    answers[`GET ${QUERY}/lenses/${LENS_ID}`] = () => [200, { lens: lens({ state: 'stopped' }) }];
    const stopped = await tool('run_lens', { id: LENS_ID }, await showing('claude'));
    expect(stopped.structuredContent).toMatchObject({ view: 'lens', outcome: 'halted', reason: expect.stringContaining('it stopped until the Data Team accepts it again') });
    answers[`GET ${QUERY}/lenses/${LENS_ID}`] = () => [200, { lens: lens({ broken: { kind: 'column', name: 'first_reply_at', since: '2026-11-16' } }) }];
    expect((await tool('get_lens', { id: LENS_ID }, await issuer.sign())).structuredContent).toMatchObject({ lens: { runs: false, why: expect.stringContaining('first_reply_at') } });
    expect(asked.some((call) => call.method === 'POST')).toBe(false);
  });

  it('in a card only gives Claude the shape of the result, and not in Claude only the link (FR-CL-28)', async () => {
    const shown = await tool('run_lens', { id: LENS_ID }, await showing('card'));
    expect(JSON.stringify(shown)).not.toContain(SECRET);
    expect(JSON.stringify(shown)).not.toContain('4242');
    expect(shown.structuredContent).toMatchObject({ view: 'lens', results: 'card', outcome: 'ran', run: { ref: 'q-7' }, result: { rows: 1 } });

    asked = [];
    const none = await tool('run_lens', { id: LENS_ID }, await showing('none'));
    expect(none.structuredContent).toMatchObject({ results: 'none', page: `${WEB}/lenses/${LENS_ID}` });
    expect(asked.some((call) => call.method === 'POST')).toBe(false);
  });

  it('says a deleted Lens no longer runs', async () => {
    answers[`GET ${QUERY}/lenses/${LENS_ID}`] = () => [410, { error: 'deleted', message: 'This Lens was deleted.' }];
    const result = await tool('run_lens', { id: LENS_ID }, await issuer.sign());
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('This Lens was deleted');
  });
});

describe('concepts through Claude', () => {
  it('explains a concept with the Learning Cards that are written (FR-CL-15)', async () => {
    const result = await tool('explain', { term: 'Level' }, await issuer.sign());
    const cards = (result.structuredContent as { cards: { number: string; page: string }[] }).cards;
    expect(cards[0]).toMatchObject({ number: 'K5.2', page: `${WEB}/learning/K5.2` });
  });
});

describe('a Learning Card in Claude (FR-LR-26, DEC-UX-261)', () => {
  it('shows a whole written card in its five steps, in the language asked', async () => {
    const result = await tool('show_learning_card', { number: 'K5.2', language: 'nl' }, await issuer.sign());
    expect(result.structuredContent).toMatchObject({
      view: 'card',
      card: { number: 'K5.2', title: 'Het Level van een Resource', language: 'nl', why: { promise: expect.any(String) }, core: { rule: expect.stringContaining('**') } },
      page: `${WEB}/learning/K5.2`,
    });
    const card = (result.structuredContent as { card: { questions: { options: { right: boolean }[] }[]; can: { choices: { page: string }[] } } }).card;
    expect(card.questions.length).toBeGreaterThan(0);
    expect(card.questions.every((question) => question.options.filter((option) => option.right).length === 1)).toBe(true);
    expect(card.can.choices.every((choice) => choice.page.startsWith(WEB))).toBe(true);
    expect(result.content[0]?.text).toContain('Retell its core idea');
  });

  it('never makes up a card that is not written', async () => {
    const result = await tool('show_learning_card', { number: 'K9.99' }, await issuer.sign());
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('never make up what it would say');
  });

  it('opens the whole card only when the User asks: Read the card asks Claude in their name', () => {
    expect(VIEW_PAGE).toContain("app.sendMessage({ role: 'user', content: [{ type: 'text', text: 'Show me the Learning Card '");
    expect(VIEW_PAGE).toContain("else if (view.view === 'journey') renderJourney(view);");
    expect(VIEW_PAGE).toContain("else if (view.view === 'card') renderCard(view);");
  });

  it('draws the fields Claude suggests to tick and edit, and saves only on the button of the User (FR-CL-38, DEC-UX-281)', () => {
    expect(VIEW_PAGE).toContain("else if (view.view === 'fields') renderFields(view);");
    expect(VIEW_PAGE).toContain('<input type="checkbox" data-key="');
    expect(VIEW_PAGE).toContain('<textarea rows="3" data-text="');
    expect(VIEW_PAGE).toContain("call('save_fields', fieldsArgs(), 'The User saved the fields in the card.');");
    // A colleague's text stays until the User chooses: keep it, or save theirs over it.
    expect(VIEW_PAGE).toContain('data-theirs="');
    expect(VIEW_PAGE).toContain('data-mine="');
  });

  it('unfolds the definitions of the terms of a step under its title with a tap on the ⓘ, folded at first (FR-LR-44, DEC-UX-279)', () => {
    expect(VIEW_PAGE).toContain('<button class="term" type="button" data-term aria-expanded="');
    expect(VIEW_PAGE).toContain('<div class="term-def" id="term-def"');
    expect(VIEW_PAGE).toContain("(shownTerms ? '' : ' hidden')");
    expect(VIEW_PAGE).toContain("root.querySelector('#term-def')?.toggleAttribute('hidden', !shown);");
    expect(VIEW_PAGE).not.toContain('class="purpose"');
  });
});

describe('the MCP App', () => {
  it('opens a Resource on its Summary, fits a phone and folds (FR-CL-26, FR-CL-27, DEC-UX-180, DEC-UX-181)', () => {
    expect(VIEW_PAGE).toContain('data-tab="summary">Summary</button>');
    expect(VIEW_PAGE).toContain("let tab = 'summary';");
    // Its Columns mark the Key Fields first, as Data Hub does (DEC-UX-266).
    expect(VIEW_PAGE).toContain(`(card.keyFields ?? []).includes(name) ? '<span class="pill">Key Field</span>'`);
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

  it('tells the browser its theme, so no white shows behind the rounded card in dark mode', () => {
    // A frame whose colour scheme differs from the page around it is painted white behind it by the browser.
    expect(VIEW_PAGE).toContain(':root { color-scheme: light; }');
    expect(VIEW_PAGE).toContain('[data-theme="dark"] { color-scheme: dark; }');
    expect(VIEW_PAGE).toMatch(/html, body \{[^}]*background: transparent;/);
  });
});

describe('the EDA through Claude (FR-ED-15, FR-ED-16, DEC-ED-29, TR-ED-10)', () => {
  const EDA_PATH = `${EDA}/resources/${RESOURCE_ID}/eda`;
  const AN = { id: 'u-an', name: 'An Claes' };
  const resource: EdaResource = {
    id: RESOURCE_ID,
    displayName: 'Weekly lead volume',
    modelType: 'aggregate',
    level: 3,
    fields: [
      { name: 'week_start', dataType: 'DATE', keyField: true, role: 'period', grain: true, mapped: false },
      { name: 'lead_source', dataType: 'STRING', keyField: true, role: 'groupedBy', grain: true, mapped: false },
      { name: 'lead_count', dataType: 'INT64', keyField: true, role: 'addsUp', grain: false, mapped: false },
      { name: 'lead_channel', dataType: 'STRING', keyField: true, role: null, grain: false, mapped: false },
    ],
  };
  interface Ran {
    probe: ProbeKey;
    fields: string[];
    results: ResultView[];
    params?: Record<string, unknown>;
  }
  const result = (subject: string, data: unknown, reading: ResultView['reading'], yours: ResultView['yours'] = null): ResultView => ({ subject, data: data as ResultView['data'], reading, yours });
  /** The EDA as eda answers it, computed from the contracts as eda computes it (services/eda/src/view.ts). */
  function edaView(runs: Ran[]): EdaView {
    const covers: RunCover[] = runs.map((run) => ({ probe: run.probe, fields: run.fields }));
    return {
      resource: { ...resource, collection: { id: 'c-1', name: 'Credit leads' } },
      status: 'inProgress',
      startedBy: AN,
      startedAt: '2026-11-21T08:00:00.000Z',
      exploredAt: null,
      needed: neededOf(resource, covers),
      probes: probesFor(resource.modelType).map((key) => {
        const run = runs.find((one) => one.probe === key);
        return {
          key,
          level: levelOf(key, resource.modelType) ?? 'could',
          runs: PROBES[key].runs,
          needed: isNeeded(key, resource),
          added: run !== undefined,
          complete: isComplete(key, resource, covers),
          applies: appliesTo(key, resource),
          fields: run?.fields ?? [],
          params: run?.params ?? {},
          lastRun: run ? { id: `run-${key}`, ranAt: '2026-11-21T09:00:00.000Z', ranBy: AN, bytes: 300_000, fields: run.fields, params: run.params ?? {}, results: run.results } : null,
        };
      }),
      coverage: coverage(resource, covers),
      next: bestNext(resource, covers),
    };
  }
  const grain: Ran = {
    probe: 'grainHolds',
    fields: ['week_start', 'lead_source'],
    results: [result('', { rows: 16224, values: 16224, onMoreThanOne: 0, rowsCovered: 0, emptyGrain: 0, buckets: [16224, 0, 0, 0], examples: [] }, 'expected')],
  };
  const week = { days: 7, average: 2061, sd: 210, p25: 1950, median: 2070, p75: 2180, lowest: { value: 1890, start: '2025-03-03' }, highest: { value: 2410, start: '2025-06-02' } };
  const periods = [{ start: '2025-09-01', rows: 40, sum: 2100 }, { start: '2025-09-08', rows: 0, sum: null }, { start: '2025-09-15', rows: 0, sum: null }, { start: '2025-09-22', rows: 41, sum: 2033 }];
  const volume: Ran = {
    probe: 'volumeOverTime',
    fields: ['week_start'],
    results: [result('week_start', { unit: 'week', measure: 'lead_count', periods, empty: ['2025-09-08', '2025-09-15'], current: null, units: [week] }, 'look')],
  };
  const nulls = (leadSource: number, yours: ResultView['yours'] = null): Ran => ({
    probe: 'nullsPerKeyField',
    fields: ['week_start', 'lead_source', 'lead_count', 'lead_channel'],
    results: [
      result('week_start', { rows: 16224, empty: 0, role: 'period' }, 'expected'),
      result('lead_source', { rows: 16224, empty: leadSource, role: 'groupedBy' }, leadSource ? 'look' : 'expected', yours),
      result('lead_count', { rows: 16224, empty: 0, role: 'addsUp' }, 'expected'),
      result('lead_channel', { rows: 16224, empty: 1947, role: null }, 'judge'),
    ],
  });
  const distribution: Ran = {
    probe: 'distributionOfNumbers',
    fields: ['lead_count'],
    results: [result('lead_count', { rows: 16224, low: 0, p25: 12, median: 25, p75: 48, p95: 120, high: 900, mean: 38, width: 10, tailFrom: 120, start: 0, bins: [900, 800], tail: 780 }, 'judge')],
  };
  const stub = (view: EdaView) => {
    answers[`GET ${EDA_PATH}`] = () => [200, view];
    answers[`GET ${CATALOGUE}/collections/c-1`] = () => [200, collection];
  };
  const admin = () => issuer.sign({ as: 'admin' });
  const posted = () => asked.filter((one) => one.method === 'POST').map((one) => one.body);
  /** The card of the EDA as the MCP App draws it, from its own functions in the page (view-page.ts). */
  const draw = (view: unknown): string => {
    const helpers = VIEW_PAGE.slice(VIEW_PAGE.indexOf('const esc = '), VIEW_PAGE.indexOf('/** The rows of a run'));
    const block = VIEW_PAGE.slice(VIEW_PAGE.indexOf('// begin eda'), VIEW_PAGE.indexOf('// end eda'));
    return (new Function(`${helpers}\n${block}\nreturn edaHtml;`)() as (view: unknown) => string)(view);
  };
  const EDA_TOOLS = ['get_eda', 'give_eda_reading', 'run_eda_probe', 'run_eda_probe_approved', 'show_eda'];

  it('offers the EDA tools only to a User who may explore Resources, and its buttons to the MCP App only (DEC-ED-25)', async () => {
    const analyst = names(await toolsOf(await issuer.sign()));
    for (const name of EDA_TOOLS) expect(analyst).not.toContain(name);
    const tools = await toolsOf(await admin());
    expect(names(tools)).toEqual(expect.arrayContaining(EDA_TOOLS));
    expect(appOnly(tools).filter((name) => /eda/.test(name))).toEqual(['give_eda_reading', 'run_eda_probe_approved']);
    const shows = tools.filter((item) => item._meta?.ui?.resourceUri === VIEW_URI && !item._meta.ui.visibility).map((item) => item.name);
    expect(shows.filter((name) => /eda/.test(name)).sort()).toEqual(['run_eda_probe', 'show_eda']);
    // Only the EDA-Probes Data Hub runs, in the order of the table (DEC-ED-26).
    expect(tools.find((item) => item.name === 'run_eda_probe')?.inputSchema.properties.probe?.enum).toEqual(['grainHolds', 'volumeOverTime', 'nullsPerKeyField', 'distributionOfNumbers']);
    // Explore Resources brings them to any Permission group; without claude.use there is nothing of Data Hub in Claude.
    const exploring = names(await toolsOf(await issuer.sign({ permissions: permissionsOf('businessAnalyst', (permissions) => (permissions['eda.use'].on = true)) })));
    expect(exploring).toEqual(expect.arrayContaining(EDA_TOOLS));
    expect(names(await toolsOf(await issuer.sign({ permissions: permissionsOf('admin', (permissions) => (permissions['claude.use'].on = false)) })))).toEqual(['how_to_use', 'who_am_i']);
    // The rule of the EDA is in the instructions of who has its tools, and only theirs: Claude never approves nor reads for the User.
    const instructions = async (token: string) => (await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } }, token)).json().result.instructions as string;
    expect(await instructions(await admin())).toContain('You never approve a run above 100 MB and never give the reading of a result');
    expect(await instructions(await issuer.sign())).not.toContain('get_eda');
    const howTo = (await tool('how_to_use', {}, await admin())).content[0]?.text ?? '';
    expect(howTo).toContain('Explore a Resource');
    expect(howTo).toContain('- Explore Resources: start the EDA of a Resource you see at 3 · Confirmed or above');
  });

  it('reads the EDA in words, what to look at first, and shows it as a card of its own (FR-ED-15)', async () => {
    stub(edaView([grain, volume, nulls(130), distribution]));
    const token = await admin();
    const read = await tool('get_eda', { id: RESOURCE_ID }, token);
    expect(asked[0]).toMatchObject({ method: 'GET', url: EDA_PATH, authorization: `Bearer ${token}` });
    const text = read.content[0]?.text ?? '';
    expect(text).toContain('The EDA of Weekly lead volume (3 · Confirmed) is in progress: 4 of 9 needed EDA-Probes complete, and it becomes 4 · Explored once all are.');
    // The rows of the table are a fact of the EDA, from the last run that counted them (DEC-ED-32).
    expect(text).toContain('Started on 2026-11-21 by An Claes. The table has 16,224 rows, counted by The grain holds on 2026-11-21.');
    // The needed ones Data Hub does not run yet are named once, and still count (DEC-ED-27).
    expect(text).toContain('5 needed ones are Coming: Date range in Basis, Disguised nulls in Gaps, Distribution of categories and Spread in Weight, Impossible values in Correctness.');
    expect(text.indexOf('Look at this, first:')).toBeLessThan(text.indexOf('For the User to judge:'));
    expect(text).toContain('- Nulls per Key Field, `lead_source`: 130 of 16,224 rows empty (0.8%). Data Hub: its role, grouped by, needs it on every row. No reading of the User yet.');
    expect(text).toMatch(/2 periods have no rows at all, the first from 8 Sept? 2025, between periods of about 2,061 per week\./);
    expect(text).toContain('- Distribution of numbers: For you to judge. ');
    expect(text).toContain('Most rows bring little, a few bring much: the median of `lead_count` is 25, the mean 38.');
    expect(text).toContain('- The grain holds: As expected. One row per `week_start` and `lead_source`: none twice in 16,224 rows. Set on `week_start` and `lead_source`; ran 2026-11-21.');
    expect(text).toContain('Never give one yourself');
    expect(text).toContain(`${WEB}/eda/${RESOURCE_ID}`);
    expect(read.structuredContent).not.toHaveProperty('view');
    // The periods of Volume over time stay in Data Hub, with its chart.
    expect(JSON.stringify(read.structuredContent)).not.toContain('"sum":2100');

    const shown = await tool('show_eda', { id: RESOURCE_ID }, token);
    expect(shown.content[0]?.text).toContain('The EDA is shown to the User in the conversation.');
    expect(shown.structuredContent).toMatchObject({
      view: 'eda',
      mode: 'eda',
      resource: { displayName: 'Weekly lead volume', levelName: '3 · Confirmed', collection: { name: 'Credit leads' }, page: `${WEB}/resources/${RESOURCE_ID}` },
      eda: {
        statusName: 'In progress',
        startedBy: 'An Claes',
        needed: { total: 9, complete: 4 },
        rows: { count: 16224, probe: 'grainHolds', probeName: 'The grain holds', text: '16,224 rows, counted by The grain holds' },
        page: `${WEB}/eda/${RESOURCE_ID}`,
      },
      attention: { ran: 7, look: 2, judge: 2, read: 0 },
      coming: { count: 5 },
    });
    const view = shown.structuredContent as { bar: { state: string }[]; steps: { name: string; needed: unknown; probes: { name: string }[] }[] };
    expect(view.bar.map((part) => part.state)).toEqual(['done', 'coming', 'done', 'done', 'coming', 'done', 'coming', 'coming', 'coming']);
    expect(view.steps.map((step) => [step.name, step.needed, step.probes.map((one) => one.name)])).toEqual([
      ['Basis', { total: 3, complete: 2 }, ['The grain holds', 'Volume over time, with empty periods']],
      ['Gaps', { total: 2, complete: 1 }, ['Nulls per Key Field']],
      ['Weight', { total: 3, complete: 1 }, ['Distribution of numbers']],
    ]);

    // The card: what needs a look first, then per EDA-Step, the Coming ones once, and no chart.
    const html = draw(shown.structuredContent);
    expect(html).toContain('<b>2 results to look at</b>, 2 for you to judge. No reading of yours yet.');
    expect(html).toContain('Its EDA, started on 21 Nov 2026 by An Claes');
    expect(html).toContain('4 of 9 needed EDA-Probes complete');
    expect(html).toContain('<span class="status" title="Counted by The grain holds on 21 Nov 2026">16,224 rows, counted by The grain holds</span>');
    expect(html.match(/<i class="ed-(done|open|coming)"/g)).toHaveLength(9);
    expect(html).toContain('<code>lead_source</code> is empty on 130 rows, though its role, grouped by, needs it on every row.');
    expect(html).toContain('Basis<small class="ed-open">2 of 3 needed complete</small>');
    expect(html).toContain('Coming<small>5 needed, which count already</small>');
    expect(html).toContain(`data-open="${WEB}/eda/${RESOURCE_ID}"`);
    expect(html).not.toContain('data-reading');
    expect(html).not.toMatch(/<canvas|<svg class="chart/);
  });

  it('says the rows of the table only once The grain holds or Nulls per Key Field counted them (DEC-ED-32)', async () => {
    stub(edaView([volume]));
    const token = await admin();
    expect((await tool('get_eda', { id: RESOURCE_ID }, token)).content[0]?.text).not.toContain('The table has');
    const shown = await tool('show_eda', { id: RESOURCE_ID }, token);
    expect(shown.structuredContent).toMatchObject({ eda: { rows: null } });
    expect(draw(shown.structuredContent)).not.toContain('Counted by');
  });

  it('says a Resource without an EDA has none: starting one stays in Data Hub', async () => {
    answers[`GET ${CATALOGUE}/resources/${RESOURCE_ID}`] = () => [200, detail({ level: 3 })];
    answers[`GET ${CATALOGUE}/collections/c-1`] = () => [200, collection];
    const token = await admin();
    const read = await tool('get_eda', { id: RESOURCE_ID }, token);
    expect(read.isError).toBeFalsy();
    expect(read.content[0]?.text).toContain(`Weekly lead volume (3 · Confirmed) has no EDA yet. Starting it stays in Data Hub: the User starts it on the Maturity of the Resource: ${WEB}/resources/${RESOURCE_ID}/maturity`);
    const shown = await tool('show_eda', { id: RESOURCE_ID }, token);
    expect(shown.structuredContent).toMatchObject({ view: 'eda', mode: 'none', maturity: `${WEB}/resources/${RESOURCE_ID}/maturity` });
    expect(draw(shown.structuredContent)).toContain('Open Maturity in Data Hub');
    const run = await tool('run_eda_probe', { id: RESOURCE_ID, probe: 'grainHolds' }, token);
    expect(run.structuredContent).toMatchObject({ mode: 'none' });
    expect(posted()).toHaveLength(0);

    // A Resource the User does not see is not found, without saying which.
    answers = {};
    const hidden = await tool('get_eda', { id: RESOURCE_ID }, token);
    expect(hidden.isError).toBe(true);
    expect(hidden.content[0]?.text).toContain('Data Hub found nothing you may see there');
  });

  it('runs an EDA-Probe as the User on what it is set on, and shows its result per field with the buttons of their reading (FR-ED-16)', async () => {
    stub(edaView([grain, volume, nulls(130), distribution]));
    answers[`POST ${EDA_PATH}/probes/nullsPerKeyField/runs`] = () => [200, { state: 'ran', eda: edaView([grain, volume, nulls(12), distribution]) }];
    const token = await admin();
    const ran = await tool('run_eda_probe', { id: RESOURCE_ID, probe: 'nullsPerKeyField' }, token);
    // Run again, it keeps the fields it is set on, and it runs with the token of the User.
    expect(asked.find((one) => one.method === 'POST')).toMatchObject({ authorization: `Bearer ${token}`, body: { fields: ['week_start', 'lead_source', 'lead_count', 'lead_channel'], approve: false } });
    expect(ran.structuredContent).toMatchObject({ view: 'eda', mode: 'run', run: { probe: 'nullsPerKeyField', name: 'Nulls per Key Field', readingName: 'Look at this', reads: '300 KB', page: `${WEB}/eda/${RESOURCE_ID}/probes/nullsPerKeyField` } });
    const rows = (ran.structuredContent?.run as { rows: { subject: string; cells: string[]; readingName: string; asks: boolean }[] }).rows;
    expect(rows.map((row) => [row.subject, row.cells[0], row.readingName, row.asks])).toEqual([
      ['week_start', '0', 'As expected', false],
      ['lead_source', '12 · < 0.1%', 'Look at this', true],
      ['lead_count', '0', 'As expected', false],
      ['lead_channel', '1,947 · 12%', 'For you to judge', true],
    ]);
    const text = ran.content[0]?.text ?? '';
    expect(text).toContain('Nulls per Key Field on Weekly lead volume (3 · Confirmed) ran and its result is shown to the User: Look at this. `lead_source` is empty on 12 rows');
    expect(text).toContain('- `lead_source`: Look at this (its role, grouped by, needs it on every row). 12 of 16,224 rows empty (< 0.1%). No reading of the User yet.');
    expect(text).toContain('Never give one yourself');

    // The card: its conclusion, a row per field, and the reading only where there is something to read.
    const html = draw(ran.structuredContent);
    expect(html).toContain('Your reading of <code>lead_source</code>');
    expect(html).toContain('data-reading="known" data-subject="lead_source" aria-pressed="false"');
    expect(html).toContain('data-subject="lead_channel"');
    expect(html).not.toContain('data-subject="week_start"');
    expect(html).toContain('You give it here, or in Data Hub; Claude does not give it for you.');
    expect(html).toContain(`data-open="${WEB}/eda/${RESOURCE_ID}/probes/nullsPerKeyField"`);

    // Other fields named are what it runs on, without the parameters it kept.
    asked = [];
    await tool('run_eda_probe', { id: RESOURCE_ID, probe: 'nullsPerKeyField', fields: ['lead_channel'] }, token);
    expect(posted()).toEqual([{ fields: ['lead_channel'], approve: false }]);
  });

  it('leaves a run above what runs freely to the User, who approves it in the frame; Claude cannot (FR-ED-16, DEC-ED-29)', async () => {
    stub(edaView([grain, volume]));
    answers[`POST ${EDA_PATH}/probes/volumeOverTime/runs`] = (body) =>
      (body as { approve: boolean }).approve ? [200, { state: 'ran', eda: edaView([grain, volume]) }] : [200, { state: 'approve', bytes: 240_000_000 }];
    const token = await admin();
    const waiting = await tool('run_eda_probe', { id: RESOURCE_ID, probe: 'volumeOverTime', fields: ['week_start'] }, token);
    expect(waiting.structuredContent).toMatchObject({
      view: 'eda',
      mode: 'approve',
      approve: { probe: 'volumeOverTime', fields: ['week_start'], setOn: ['week_start'], reads: '240 MB', thresholds: { approve: 100_000_000, request: 1_000_000_000 }, free: '100 MB', large: '1 GB' },
    });
    expect(waiting.content[0]?.text).toContain('reads 240 MB, more than the 100 MB Data Hub runs freely');
    expect(waiting.content[0]?.text).toContain('Only the User approves it, in the window; you cannot.');
    const html = draw(waiting.structuredContent);
    expect(html).toContain('data-act="approve-eda"');
    expect(html).toContain('Approve and run · 240 MB');
    expect(html).toContain('<span class="ed-gfill" style="width:24%"></span><span class="ed-mark" style="left:10%"></span>');
    expect(html).toContain('you approve this run yourself; Claude cannot do it for you');

    const approved = await tool('run_eda_probe_approved', { id: RESOURCE_ID, probe: 'volumeOverTime', fields: ['week_start'] }, token);
    expect(posted()).toEqual([
      { fields: ['week_start'], approve: false },
      { fields: ['week_start'], approve: true },
    ]);
    expect(approved.structuredContent).toMatchObject({ mode: 'run', run: { probe: 'volumeOverTime', readingName: 'Look at this' } });
    expect(approved.content[0]?.text).toContain('ran, approved by the User, and its result is shown to the User');
  });

  it('says why a run does not run, and what eda refuses, without trying another way', async () => {
    stub(edaView([grain]));
    const reason = 'It reads 2.4 GB, more than one run of yours may read (1 GB), so it does not run.';
    answers[`POST ${EDA_PATH}/probes/distributionOfNumbers/runs`] = () => [200, { state: 'refused', bytes: 2_400_000_000, reason }];
    const token = await admin();
    const refused = await tool('run_eda_probe', { id: RESOURCE_ID, probe: 'distributionOfNumbers' }, token);
    expect(refused.structuredContent).toMatchObject({ mode: 'refused', refused: { probe: 'distributionOfNumbers', reason, setOn: ['lead_count'] } });
    expect(refused.content[0]?.text).toContain(`did not run: ${reason} Say so to the User, and do not try another way around it.`);
    expect(draw(refused.structuredContent)).toContain('<b>It does not run.</b> ');

    answers[`POST ${EDA_PATH}/probes/grainHolds/runs`] = () => [422, { error: 'cannot_run', message: 'The grain of this Resource is not recorded yet: the Data Team records its grain first (FR-ED-07).' }];
    const blocked = await tool('run_eda_probe', { id: RESOURCE_ID, probe: 'grainHolds' }, token);
    expect(blocked.isError).toBe(true);
    expect(blocked.content[0]?.text).toContain('The grain of this Resource is not recorded yet');
  });

  it('keeps the reading the User gives with the buttons of the frame; Claude has no tool to give one (DEC-ED-29)', async () => {
    const READINGS_PATH = `${EDA_PATH}/probes/nullsPerKeyField/readings`;
    answers[`PUT ${READINGS_PATH}`] = () => [200, edaView([grain, nulls(130, { reading: 'known', by: AN, at: '2026-11-21T10:00:00.000Z' })])];
    answers[`GET ${CATALOGUE}/collections/c-1`] = () => [200, collection];
    const token = await admin();
    const given = await tool('give_eda_reading', { id: RESOURCE_ID, probe: 'nullsPerKeyField', subject: 'lead_source', reading: 'known' }, token);
    expect(asked.find((one) => one.method === 'PUT')).toMatchObject({ url: READINGS_PATH, authorization: `Bearer ${token}`, body: { subject: 'lead_source', reading: 'known' } });
    expect(given.content[0]?.text).toContain("The User's reading of `lead_source` in Nulls per Key Field is kept in Data Hub: Known.");
    const rows = (given.structuredContent?.run as { rows: { subject: string; yours: unknown }[] }).rows;
    expect(rows.find((row) => row.subject === 'lead_source')?.yours).toEqual({ reading: 'known', readingName: 'Known', by: 'An Claes', at: '2026-11-21T10:00:00.000Z' });
    const html = draw(given.structuredContent);
    expect(html).toContain('<button class="quiet on" type="button" data-reading="known" data-subject="lead_source" aria-pressed="true">');
    expect(html).toContain('Read by An Claes on 21 Nov 2026');

    // A result that is not there is said in the words of eda.
    answers[`PUT ${READINGS_PATH}`] = () => [404, { error: 'not_found', message: 'This EDA-Probe has no result for lead_x to read.' }];
    const none = await tool('give_eda_reading', { id: RESOURCE_ID, probe: 'nullsPerKeyField', subject: 'lead_x', reading: 'problem' }, token);
    expect(none.isError).toBe(true);
    expect(none.content[0]?.text).toBe('This EDA-Probe has no result for lead_x to read.');

    // show_eda with an EDA-Probe shows its last result with the buttons, without running it again.
    stub(edaView([grain, nulls(130)]));
    asked = [];
    const again = await tool('show_eda', { id: RESOURCE_ID, probe: 'nullsPerKeyField' }, token);
    expect(again.structuredContent).toMatchObject({ view: 'eda', mode: 'run', run: { probe: 'nullsPerKeyField' } });
    expect(again.content[0]?.text).toContain('The last result of Nulls per Key Field on Weekly lead volume (3 · Confirmed) is shown to the User, with the buttons of their reading');
    expect(posted()).toHaveLength(0);
  });

  it('draws the EDA as a kind of its own in the one page, and passes the buttons of the User to the tools only it calls', () => {
    expect(VIEW_PAGE).toContain("else if (view.view === 'eda') renderEda(view);");
    expect(VIEW_PAGE).toContain("call('give_eda_reading', { id: view.resource.id, probe: view.run.probe, subject, reading: target.dataset.reading }");
    expect(VIEW_PAGE).toContain("call('run_eda_probe_approved', { id: view.resource.id, probe: a.probe");
  });
});

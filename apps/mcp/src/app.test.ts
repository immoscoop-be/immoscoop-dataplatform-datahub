import { readFileSync } from 'node:fs';
import { createTestIssuer, type TestIssuer } from '@datahub/auth/testing';
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

  it('starts an MCP conversation with the concepts and rules of Data Hub (FR-CL-14)', async () => {
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
  });

  it('offers who_am_i, which answers as the User of the token', async () => {
    const token = await issuer.sign({ name: 'Jan Peeters', email: 'jan@thenextimmoscoop.be', groups: ['g1'], roles: ['datateam'] });
    const result = await tool('who_am_i', {}, token);
    expect(result.structuredContent).toEqual({ name: 'Jan Peeters', email: 'jan@thenextimmoscoop.be', groups: ['g1'], roles: ['datateam'] });
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

  it('offers its how-to-use as a prompt and a tool (FR-CL-16)', async () => {
    const token = await issuer.sign({ roles: ['datateam'] });
    const prompts = (await call('prompts/list', {}, token)).json().result.prompts;
    expect(prompts.map((prompt: { name: string }) => prompt.name)).toContain('start_with_data_hub');
    const result = await tool('how_to_use', {}, token);
    expect(result.content[0]?.text).toContain('For the Data Team');
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

  it('lists the queries of everyone for the Data Team only (DEC-CL-12)', async () => {
    answers[`GET ${QUERY}/queries`] = () => [200, { queries: [] }];
    const refused = await tool('list_queries', { everyone: true }, await issuer.sign());
    expect(refused.isError).toBe(true);
    expect(asked).toHaveLength(0);
    await tool('list_queries', { everyone: true, words: 'partner' }, await issuer.sign({ roles: ['datateam'] }));
    expect(asked[0]?.url).toBe(`${QUERY}/queries?all=true&q=partner&limit=50`);
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

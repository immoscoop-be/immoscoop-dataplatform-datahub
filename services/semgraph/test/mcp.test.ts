import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { runPipeline } from '../src/core/pipeline.ts';
import { mcpAuthFromEnv, type McpAuth, type OAuthConfig } from '../src/mcp/auth.ts';
import { example, mcpCall, NOW, svgOfResult, testRegistry } from './helpers.ts';

async function appWith(mcp: McpAuth, fetchJson?: (url: string) => Promise<unknown>): Promise<FastifyInstance> {
  return buildApp({ registry: await testRegistry(), now: () => NOW, logger: false, mcp, ...(fetchJson ? { fetchJson } : {}) });
}

const text = (result: { content: { text: string }[] }) => result.content[0]!.text;
const reportOf = (result: { content: { text: string }[] }) => JSON.parse(text(result).split('\n').at(-1)!);

describe('MCP server (REQ-090)', () => {
  let app: FastifyInstance;
  before(async () => {
    app = await appWith({ mode: 'open' });
  });
  after(() => app.close());

  it('initializes without a session and gives instructions that ask for meta (REQ-093)', async () => {
    const { response, result } = await mcpCall(app, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['mcp-session-id'], undefined);
    assert.equal(result.serverInfo.name, 'semgraph');
    assert.match(result.instructions, /render_semgraph/);
    for (const field of ['question', 'query', 'askedBy', 'compiledOn']) assert.match(result.instructions, new RegExp(`\`${field}\``));
  });

  it('offers four read-only tools; render_semgraph shows its chart in the app', async () => {
    const { result } = await mcpCall(app, 'tools/list');
    const tools = result.tools as { name: string; annotations: { readOnlyHint: boolean }; _meta?: { ui?: { resourceUri?: string } } }[];
    assert.deepEqual(tools.map((tool) => tool.name), ['list_semgraphs', 'describe_semgraph', 'validate_semgraph', 'render_semgraph']);
    assert.ok(tools.every((tool) => tool.annotations.readOnlyHint));
    assert.equal(tools.find((tool) => tool.name === 'render_semgraph')!._meta?.ui?.resourceUri, 'ui://semgraph/chart.html');
  });

  it('list_semgraphs and describe_semgraph give what the REST API gives', async () => {
    const list = await mcpCall(app, 'tools/call', { name: 'list_semgraphs', arguments: { locale: 'nl-BE' } });
    assert.deepEqual(JSON.parse(text(list.result)), (await app.inject('/semgraphs?locale=nl-BE')).json());

    const described = JSON.parse(text((await mcpCall(app, 'tools/call', { name: 'describe_semgraph', arguments: { id: 'kpiTile' } })).result));
    const { exampleRequest, ...rest } = described;
    assert.deepEqual(rest, (await app.inject('/semgraphs/kpiTile')).json());
    const [first] = (await testRegistry()).semgraphs.get('kpiTile')!.examples.values();
    assert.deepEqual(exampleRequest, first);
  });

  it('describe_semgraph says when a semgraph is only planned', async () => {
    const { result } = await mcpCall(app, 'tools/call', { name: 'describe_semgraph', arguments: { id: 'funnel' } });
    assert.equal(result.isError, true);
    assert.equal(JSON.parse(text(result)).issues[0].code, 'plannedSemgraph');
  });

  it('validate_semgraph gives the report of POST /validate, with the deviations and versions', async () => {
    const request = await example('basic');
    const { result } = await mcpCall(app, 'tools/call', { name: 'validate_semgraph', arguments: { request } });
    const rest = (await app.inject({ method: 'POST', url: '/validate', payload: request })).json();
    const registry = await testRegistry();
    assert.deepEqual(JSON.parse(text(result)), { ...rest, deviations: [], languageVersion: registry.tokens.languageVersion, tokensVersion: registry.tokens.version });
  });

  it('render_semgraph: a refusal is an answer with its alternative, an invalid request an error to fix', async () => {
    const refused = (await mcpCall(app, 'tools/call', { name: 'render_semgraph', arguments: { request: await example('unique-without-aggregation') } })).result;
    assert.notEqual(refused.isError, true);
    assert.equal(svgOfResult(refused), undefined);
    assert.equal(reportOf(refused).outcome, 'refused');
    assert.ok(reportOf(refused).issues[0].alternative);
    assert.equal(refused._meta['semgraph/report'].outcome, 'refused');

    const invalid = (await mcpCall(app, 'tools/call', { name: 'render_semgraph', arguments: { request: { semgraph: 'movingWindowAverage' } } })).result;
    assert.equal(invalid.isError, true);
    assert.equal(reportOf(invalid).outcome, 'invalid');
  });

  it('REQ-094 and REQ-096: the app gets the chart dark too, for a dark conversation; the download stays light', async () => {
    const request = await example('basic');
    const { result } = await mcpCall(app, 'tools/call', { name: 'render_semgraph', arguments: { request } });
    const packed = (key: string) => (typeof result._meta[key] === 'string' ? gunzipSync(Buffer.from(result._meta[key], 'base64')).toString('utf8') : undefined);
    const registry = await testRegistry();
    assert.equal(packed('semgraph/svg'), (await runPipeline(registry, request, { now: NOW })).svg, 'the chart as asked: light');
    assert.equal(packed('semgraph/svgDark'), (await runPipeline(registry, { ...request, theme: 'dark' }, { now: NOW })).svg, 'and dark');
    // A request that chooses its theme gets that one only, for the conversation and the download alike.
    const chosen = (await mcpCall(app, 'tools/call', { name: 'render_semgraph', arguments: { request: { ...request, theme: 'dark' } } })).result;
    assert.equal(chosen._meta['semgraph/svgDark'], undefined);
    assert.match(svgOfResult(chosen)!, /data-theme="dark"/);
    const { result: init } = await mcpCall(app, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
    assert.match(init.instructions, /Leave `theme` out/);
  });

  it('serves the app as one self-contained page, with its labels in every locale (REQ-092)', async () => {
    const list = (await mcpCall(app, 'resources/list')).result;
    assert.deepEqual(list.resources.map((resource: { uri: string }) => resource.uri), ['ui://semgraph/chart.html']);
    const [content] = (await mcpCall(app, 'resources/read', { uri: 'ui://semgraph/chart.html' })).result.contents;
    assert.equal(content.mimeType, 'text/html;profile=mcp-app');
    assert.match(content.text, /const McpApps=\{/);
    assert.doesNotMatch(content.text, /\bexport\s*\{|<script[^>]+src=|<link /);
    assert.match(content.text, /"nl-BE":\{"download":"SVG downloaden"/);
    // Without the URL of /mcp there is no origin for Claude to serve the app from.
    assert.equal(content._meta.ui.domain, undefined);
  });

  it('answers 405 on GET and DELETE: there are no sessions and no event stream', async () => {
    for (const method of ['GET', 'DELETE'] as const) {
      const response = await app.inject({ method, url: '/mcp' });
      assert.equal(response.statusCode, 405, method);
      assert.equal(response.headers.allow, 'POST');
    }
  });
});

describe('MCP login (REQ-091)', () => {
  const config: OAuthConfig = {
    mode: 'oauth',
    issuer: 'https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_Gate',
    authorizationServer: 'https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_Gate',
    clientIds: ['claude-client'],
    resource: 'https://semgraph.example.be/mcp',
    scope: 'semgraph/mcp',
  };
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwks = { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' }] };
  const fetched: string[] = [];

  const seconds = Math.floor(NOW.getTime() / 1000);
  const claims = { iss: config.issuer, sub: 'user-1', token_use: 'access', client_id: 'claude-client', scope: 'openid semgraph/mcp', exp: seconds + 3600 };
  function token(overrides: Record<string, unknown> = {}, { key = privateKey, kid = 'k1' }: { key?: KeyObject; kid?: string } = {}): string {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const body = `${encode({ alg: 'RS256', kid })}.${encode({ ...claims, ...overrides })}`;
    return `${body}.${sign('RSA-SHA256', Buffer.from(body), key).toString('base64url')}`;
  }

  let app: FastifyInstance;
  before(async () => {
    app = await appWith(config, async (url) => {
      fetched.push(url);
      return jwks;
    });
  });
  after(() => app.close());

  const initialize = { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } };
  const bearer = (value: string) => ({ authorization: `Bearer ${value}` });

  it('without a token: 401 that points to the protected resource metadata', async () => {
    const { response } = await mcpCall(app, 'initialize', initialize);
    assert.equal(response.statusCode, 401);
    assert.equal(
      response.headers['www-authenticate'],
      'Bearer resource_metadata="https://semgraph.example.be/.well-known/oauth-protected-resource/mcp", scope="semgraph/mcp"',
    );
  });

  it('serves the protected resource metadata at both well-known paths', async () => {
    for (const path of ['/.well-known/oauth-protected-resource/mcp', '/.well-known/oauth-protected-resource']) {
      assert.deepEqual((await app.inject(path)).json(), {
        resource: 'https://semgraph.example.be/mcp',
        authorization_servers: [config.issuer],
        bearer_methods_supported: ['header'],
        scopes_supported: ['semgraph/mcp'],
        resource_name: 'semgraph',
      });
    }
  });

  it('with a valid access token of the gate pool: the tools work, and the keys come from the issuer', async () => {
    const { response, result } = await mcpCall(app, 'tools/call', { name: 'render_semgraph', arguments: { request: await example('basic') } }, bearer(token()));
    assert.equal(response.statusCode, 200);
    assert.ok(svgOfResult(result)?.startsWith('<svg'));
    assert.deepEqual(fetched, [`${config.issuer}/.well-known/jwks.json`]);
  });

  it('refuses a token that is expired, of another issuer or client, an ID token, without the scope, or not signed by the issuer', async () => {
    const cases: [string, string][] = [
      ['expired', token({ exp: seconds - 1 })],
      ['no expiry', token({ exp: undefined })],
      ['other issuer', token({ iss: 'https://cognito-idp.eu-central-1.amazonaws.com/other' })],
      ['other client', token({ client_id: 'someone-else' })],
      ['ID token', token({ token_use: 'id' })],
      ['without the scope', token({ scope: 'openid' })],
      ['other key', token({}, { key: other.privateKey })],
      ['unknown key id', token({}, { kid: 'k2' })],
      ['not a JWT', 'abc'],
    ];
    for (const [label, value] of cases) {
      const { response } = await mcpCall(app, 'initialize', initialize, bearer(value));
      assert.equal(response.statusCode, 401, label);
      assert.match(String(response.headers['www-authenticate']), /error="invalid_token"/, label);
    }
  });

  it('gives Claude an origin for the app, derived from the URL of /mcp (REQ-092)', async () => {
    const [content] = (await mcpCall(app, 'resources/read', { uri: 'ui://semgraph/chart.html' }, bearer(token()))).result.contents;
    const hash = createHash('sha256').update(config.resource).digest('hex').slice(0, 32);
    assert.equal(content._meta.ui.domain, `${hash}.claudemcpcontent.com`);
  });

  it('reports its mode on /healthz', async () => {
    assert.equal((await app.inject('/healthz')).json().mcp, 'oauth');
  });

  it('fails closed: without configuration /mcp refuses every request', async () => {
    const closed = await appWith({ mode: 'off' });
    const { response } = await mcpCall(closed, 'initialize', initialize);
    assert.equal(response.statusCode, 503);
    assert.equal((await closed.inject('/healthz')).json().mcp, 'off');
    assert.equal((await closed.inject('/.well-known/oauth-protected-resource')).statusCode, 404);
    await closed.close();
  });

  it('reads its configuration from the environment, and refuses to start on an incomplete one', () => {
    assert.deepEqual(mcpAuthFromEnv({}), { mode: 'off' });
    assert.deepEqual(mcpAuthFromEnv({ MCP_AUTH: 'none' }), { mode: 'open' });
    assert.deepEqual(
      mcpAuthFromEnv({ MCP_AUTH_ISSUER: `${config.issuer}/`, MCP_AUTH_CLIENT_IDS: ' a, b ', MCP_RESOURCE_URL: config.resource }),
      { mode: 'oauth', issuer: config.issuer, authorizationServer: config.issuer, clientIds: ['a', 'b'], resource: config.resource },
    );
    assert.throws(() => mcpAuthFromEnv({ MCP_AUTH_ISSUER: config.issuer }), /MCP_AUTH_CLIENT_IDS and MCP_RESOURCE_URL/);
    assert.throws(() => mcpAuthFromEnv({ MCP_AUTH: 'off' }), /MCP_AUTH must be "none"/);
    assert.throws(() => mcpAuthFromEnv({ MCP_AUTH: 'none', MCP_AUTH_ISSUER: config.issuer }), /exclude each other/);
    assert.throws(
      () => mcpAuthFromEnv({ MCP_AUTH_ISSUER: config.issuer, MCP_AUTH_CLIENT_IDS: 'a', MCP_RESOURCE_URL: 'http://semgraph.example.be/mcp' }),
      /https URL/,
    );
  });
});

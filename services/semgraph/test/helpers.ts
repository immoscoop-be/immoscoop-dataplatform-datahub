import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { FastifyInstance } from 'fastify';
import { loadRegistry, REPO_ROOT, type Registry } from '../src/core/registry.ts';

/** A fixed "now": 1 October 2026 at noon in Brussels, so the reference day 30 September is yesterday. */
export const NOW = new Date('2026-10-01T10:00:00Z');

let registry: Promise<Registry> | undefined;
export function testRegistry(): Promise<Registry> {
  registry ??= loadRegistry();
  return registry;
}

export async function example(name: string, semgraph = 'movingWindowAverage'): Promise<Record<string, unknown>> {
  const loaded = (await testRegistry()).semgraphs.get(semgraph)!;
  const request = loaded.examples.get(name);
  if (request === undefined) throw new Error(`no example ${semgraph}/${name}`);
  return structuredClone(request) as Record<string, unknown>;
}

/** A fixture from test/fixtures. */
export async function fixture<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(path.join(REPO_ROOT, 'test', 'fixtures', name), 'utf8')) as T;
}

/** Compares with test/golden/<name>; UPDATE_GOLDEN=1 rewrites the file instead. */
export async function assertGolden(name: string, actual: string): Promise<void> {
  const file = path.join(REPO_ROOT, 'test', 'golden', name);
  if (process.env.UPDATE_GOLDEN === '1' || !existsSync(file)) {
    await writeFile(file, actual);
    if (process.env.UPDATE_GOLDEN !== '1') assert.fail(`golden file ${name} did not exist and was written; check it and run again`);
    return;
  }
  assert.equal(actual, await readFile(file, 'utf8'), `output differs from test/golden/${name} (UPDATE_GOLDEN=1 to accept)`);
}

const MCP_HEADERS = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' };

/** One JSON-RPC call on POST /mcp (REQ-090); the server keeps no session, so no initialize is needed first. */
export async function mcpCall(
  app: { inject: FastifyInstance['inject'] },
  method: string,
  params: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  const response = await app.inject({ method: 'POST', url: '/mcp', headers: { ...MCP_HEADERS, ...headers }, payload: { jsonrpc: '2.0', id: 1, method, params } });
  return { response, result: response.statusCode === 200 ? response.json().result : undefined };
}

/** The SVG that render_semgraph sends to the app, gzipped in _meta (REQ-092). */
export function svgOfResult(result: { _meta?: Record<string, unknown> }): string | undefined {
  const packed = result._meta?.['semgraph/svg'];
  return typeof packed === 'string' ? gunzipSync(Buffer.from(packed, 'base64')).toString('utf8') : undefined;
}

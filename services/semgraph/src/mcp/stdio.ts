import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import type { Log } from '../core/log.ts';
import { loadRegistry } from '../core/registry.ts';
import { chartAppHtml } from './chart-app.ts';
import { createMcpServer } from './server.ts';

/**
 * REQ-090: the same MCP server on stdio, for Claude Code in a clone of this repository (.mcp.json) and for
 * the MCP Inspector. It runs on the machine of whoever starts it, so it needs no login. Claude Code shows
 * no app, so every chart is also written to out/mcp/. stdout carries the protocol: the log goes to stderr.
 */
const OUT = fileURLToPath(new URL('../../out/mcp/', import.meta.url));

const log: Log = {
  info: (object, message) => process.stderr.write(`${JSON.stringify({ level: 'info', ...object, msg: message })}\n`),
  warn: (object, message) => process.stderr.write(`${JSON.stringify({ level: 'warn', ...object, msg: message })}\n`),
};

async function saveSvg(request: Record<string, unknown>, svg: string): Promise<string> {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '');
  const file = `${OUT}${String(request.semgraph).replace(/[^\w-]/g, '')}-${stamp}.svg`;
  await mkdir(OUT, { recursive: true });
  await writeFile(file, svg);
  return file;
}

const registry = await loadRegistry();
const server = createMcpServer({ registry, now: () => new Date(), log, appHtml: await chartAppHtml(registry), saveSvg });
await server.connect(new StdioServerTransport());

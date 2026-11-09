import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { VIEW_URI } from './context.js';
import { VIEW_PAGE } from './view-page.js';

/** The type of an MCP App page, from the MCP Apps extension. */
export const RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app';

let page: Promise<string> | undefined;

/**
 * The page of the MCP App, self-contained: the MCP Apps SDK, its bundle with dependencies, is inlined, as the
 * sandbox in Claude loads nothing from outside. Built once per process.
 */
export function viewHtml(): Promise<string> {
  page ??= readFile(fileURLToPath(import.meta.resolve('@modelcontextprotocol/ext-apps/app-with-deps')), 'utf8').then((bundle) =>
    VIEW_PAGE.replace('/*BUNDLE*/', () => inlineModule(bundle)),
  );
  return page;
}

/** The bundle is an ES module whose one export statement, at its end, becomes a plain object `McpApps`. */
export function inlineModule(bundle: string): string {
  const match = /export\s*\{([^}]*)\};?\s*$/.exec(bundle);
  if (!match || bundle.indexOf('export{') !== match.index || /<\/script/i.test(bundle)) {
    throw new Error('The MCP Apps bundle no longer has the expected form: one export statement at the end');
  }
  const members = (match[1] ?? '').split(',').map((member) => {
    const [local, exported = local] = member.trim().split(/\s+as\s+/) as [string, string?];
    return `${exported}:${local}`;
  });
  return `${bundle.slice(0, match.index)}const McpApps={${members.join(',')}};`;
}

/** The origin Claude serves an MCP App from: the first 32 hex characters of the SHA-256 of the address of /mcp. */
export function claudeUiDomain(serverUrl: string): string {
  return `${createHash('sha256').update(serverUrl).digest('hex').slice(0, 32)}.claudemcpcontent.com`;
}

/** Registers the page of the MCP App, which every show tool opens (FR-CL-01). */
export function registerView(server: McpServer, html: string, serverUrl: string): void {
  const ui = { prefersBorder: false, domain: claudeUiDomain(serverUrl) };
  server.registerResource(
    'view',
    VIEW_URI,
    { title: 'Data Hub', description: 'Shows a Resource, a Preview, a publication or the result of a query of Data Hub in the conversation.', mimeType: RESOURCE_MIME_TYPE, _meta: { ui } },
    async () => ({ contents: [{ uri: VIEW_URI, mimeType: RESOURCE_MIME_TYPE, text: html, _meta: { ui } }] }),
  );
}

import type { AccessTokenClaims } from '@datahub/contracts';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DataHub } from './datahub.js';

/** What every group of tools works with: the MCP server of this request, Data Hub as the User, and the User. */
export interface Context {
  server: McpServer;
  hub: DataHub;
  user: AccessTokenClaims;
}

/** The MCP App of Data Hub, one page that shows a Resource, a Preview, a publication or the result of a query (FR-CL-01). */
export const VIEW_URI = 'ui://datahub/view.html';

/** A show tool: its result opens the MCP App in the conversation (FR-CL-01). */
export const SHOWS = { ui: { resourceUri: VIEW_URI } };

/**
 * A tool only the MCP App calls, never Claude: the buttons of the User to approve a run, send a Request and
 * publish (DEC-CL-07).
 */
export const APP_ONLY = { ui: { resourceUri: VIEW_URI, visibility: ['app'] } };

export const READ = { readOnlyHint: true, openWorldHint: false } as const;
export const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
/** A change others see at once: a Message, a deprecation, a Publication. */
export const SHARE = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false } as const;

/** A size in bytes, as the Pre-flight words it. */
export function bytes(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1000 && unit < units.length - 1) {
    size /= 1000;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
}

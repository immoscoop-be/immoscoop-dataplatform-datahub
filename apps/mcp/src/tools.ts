import type { AccessTokenClaims } from '@datahub/contracts';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * The MCP server of one request, for the User whose Access Token came with it: every tool
 * answers as that User, never as mcp itself (TR-PF-05).
 */
export function createMcpServer(user: AccessTokenClaims): McpServer {
  const server = new McpServer({ name: 'datahub', title: 'Data Hub', version: '0.1.0' });

  server.registerTool(
    'who_am_i',
    {
      title: 'Who am I',
      description:
        'Who you are in Data Hub: your name and email, your Groups by their Google ID, and the roles they give you. Useful to check that signing in worked and what you may see.',
      outputSchema: {
        name: z.string(),
        email: z.string(),
        groups: z.array(z.string()),
        roles: z.array(z.string()),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const me = { name: user.name, email: user.email, groups: user.groups, roles: user.roles };
      return { content: [{ type: 'text', text: JSON.stringify(me, null, 2) }], structuredContent: me };
    },
  );

  return server;
}

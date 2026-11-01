import type { AccessTokenClaims } from '@datahub/contracts';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { answer } from './answers.js';
import { type Context, READ } from './context.js';
import { type DataHub, pages } from './datahub.js';
import { howToUse, INSTRUCTIONS } from './guide.js';
import { explain } from './learning.js';
import { messageTools } from './messages.js';
import { queryTools } from './queries.js';
import { resourceTools } from './resources.js';
import { registerView } from './view.js';

export interface ServerOptions {
  /** Data Hub, asked with the Access Token of the User. */
  hub: DataHub;
  /** The page of the MCP App (viewHtml), built once at start-up. */
  viewHtml: string;
  /** The address of /mcp as Users enter it in Claude, from which Claude derives the origin of the MCP App. */
  serverUrl: string;
}

/**
 * The MCP server of one request, for the User whose Access Token came with it: every tool answers as that
 * User, never as mcp itself (TR-PF-05, FR-CL-02). See docs/requirements/functional/17-claude.md.
 */
export function createMcpServer(user: AccessTokenClaims, options: ServerOptions): McpServer {
  const server = new McpServer({ name: 'datahub', title: 'Data Hub', version: '0.2.0' }, { instructions: INSTRUCTIONS });
  const context: Context = { server, hub: options.hub, user };

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

  server.registerTool(
    'how_to_use',
    {
      title: 'How to use Data Hub with Claude',
      description: 'What Claude can do in Data Hub for this User, by what they may, with example questions. Call it when the User asks what you can do.',
      annotations: READ,
    },
    async () => ({ content: [{ type: 'text', text: howToUse(user) }] }),
  );

  // The how-to-use as a prompt in the menu of Claude (FR-CL-16).
  server.registerPrompt(
    'start_with_data_hub',
    { title: 'Start with Data Hub', description: 'What Claude can do for you in Data Hub, and how to ask for it.' },
    () => ({
      messages: [{ role: 'user', content: { type: 'text', text: 'What can you do for me in Data Hub? Call how_to_use and tell me, in my language, with a few examples that fit me.' } }],
    }),
  );

  server.registerTool(
    'explain',
    {
      title: 'Explain a concept of Data Hub',
      description:
        'The Learning Cards of Data Hub that explain a concept, such as Lens, Level, grain or creditLead: their core idea, what knowing it brings, and their page in the Learning Centre. Answer with the core idea rather than a definition of your own.',
      inputSchema: { term: z.string().min(1).max(200).describe('The concept, term or name to explain.') },
      annotations: READ,
    },
    async ({ term }) => {
      const found = await explain(term);
      return answer(
        { cards: found.map(({ score: _score, ...card }) => ({ ...card, page: options.hub.page(pages.learningCard(card.number)) })) },
        found.length === 0 ? 'No written Learning Card explains it yet: answer from the concepts in your instructions, and say there is no card for it.' : undefined,
      );
    },
  );

  resourceTools(context);
  messageTools(context);
  queryTools(context);
  registerView(server, options.viewHtml, options.serverUrl);
  return server;
}

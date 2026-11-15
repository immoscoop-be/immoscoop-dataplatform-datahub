import type { AccessTokenClaims } from '@datahub/contracts';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { answer, refusal } from './answers.js';
import { type Context, READ, SHOWS } from './context.js';
import { type DataHub, pages } from './datahub.js';
import { howToUse, instructionsFor, mayDo } from './guide.js';
import { cardFor, explain, topicTitle } from './learning.js';
import { messageTools } from './messages.js';
import { permitsOf } from './permits.js';
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
  /** uat or prod (DATAHUB_ENVIRONMENT): a Learning Card still in draft is offered in uat only (DEC-LR-25). */
  environment?: string;
}

/** The first page of Data Hub, where a User goes for what Claude may not do for them. */
const HOME = '/collections';

/**
 * The MCP server of one request, for the User whose Access Token came with it: every tool answers as that
 * User, never as mcp itself (TR-PF-05, FR-CL-02), and only the tools their Permissions let them use are there
 * (TR-PL-09). See docs/requirements/functional/17-claude.md.
 */
export function createMcpServer(user: AccessTokenClaims, options: ServerOptions): McpServer {
  const permits = permitsOf(user.permissions);
  const server = new McpServer({ name: 'datahub', title: 'Data Hub', version: '0.2.0' }, { instructions: instructionsFor(user, permits) });
  const context: Context = { server, hub: options.hub, user, permits, environment: options.environment };

  server.registerTool(
    'who_am_i',
    {
      title: 'Who am I',
      description:
        'Who you are in Data Hub: your name and email, the Groups of Data Hub you are in, by their identifier, your Permission group and what it lets you do. Useful to check that signing in worked and what you may see and do.',
      outputSchema: {
        name: z.string(),
        email: z.string(),
        groups: z.array(z.string()),
        permissionGroup: z.string(),
        inClaude: z.boolean(),
        mayDo: z.array(z.string()),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const me = {
        name: user.name,
        email: user.email,
        groups: user.groups,
        permissionGroup: user.permissionGroup.name,
        inClaude: permits.claude,
        mayDo: mayDo(user.permissions, permits),
      };
      const note = permits.claude ? '' : `Their Permission group, ${me.permissionGroup}, does not let them work with Data Hub in Claude: say so, and point them to Data Hub itself.\n`;
      return { content: [{ type: 'text', text: `${note}${JSON.stringify(me, null, 2)}` }], structuredContent: me };
    },
  );

  server.registerTool(
    'how_to_use',
    {
      title: 'How to use Data Hub with Claude',
      description:
        'What Claude can do in Data Hub for this User, by what their Permission group lets them do, with example questions and the note of the group for Claude. Call it when the User asks what you can do.',
      annotations: READ,
    },
    async () => ({ content: [{ type: 'text', text: howToUse(user, permits, options.hub.page(HOME)) }] }),
  );

  // The how-to-use as a prompt in the menu of Claude (FR-CL-16).
  server.registerPrompt(
    'start_with_data_hub',
    { title: 'Start with Data Hub', description: 'What Claude can do for you in Data Hub, and how to ask for it.' },
    () => ({
      messages: [{ role: 'user', content: { type: 'text', text: 'What can you do for me in Data Hub? Call how_to_use and tell me, in my language, with a few examples that fit me.' } }],
    }),
  );

  // Without claude.use, Claude has nothing of Data Hub to offer them but who they are and that it is not allowed.
  if (!permits.claude) return server;

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
      const found = await explain(term, 5, options.environment);
      return answer(
        { cards: found.map(({ score: _score, ...card }) => ({ ...card, page: options.hub.page(pages.learningCard(card.number)) })) },
        found.length === 0 ? 'No written Learning Card explains it yet: answer from the concepts in your instructions, and say there is no card for it.' : undefined,
      );
    },
  );

  // A whole card in the conversation, in its five steps, when the User asks to read it (FR-LR-26, DEC-UX-261).
  server.registerTool(
    'show_learning_card',
    {
      title: 'Show a Learning Card',
      description:
        'Shows the User a whole Learning Card of Data Hub in the conversation, in its five steps: Why now, Core idea, See it, Check your understanding and You can now. Only when the User asks to read a card, such as the one of a step of the Owner Journey; for a concept, use explain. Give the language the User writes in.',
      inputSchema: {
        number: z.string().min(1).max(20).describe('The number of the card, such as K5.15, from explain or guide_owner_journey.'),
        language: z.enum(['en', 'nl']).optional().describe('en or nl: the language the User writes in. English when not given.'),
      },
      annotations: READ,
      _meta: SHOWS,
    },
    async ({ number, language = 'en' }) => {
      const found = await cardFor(number, language, options.environment);
      if (!found) {
        return refusal(`No written Learning Card ${number} is shown here: it is not written yet, or still a draft that this Learning Centre does not show. Say so, and never make up what it would say.`);
      }
      const { card, title } = found;
      const page = options.hub.page(pages.learningCard(card.number));
      const choices = card.can.choices.map((choice) =>
        choice.kind === 'apply'
          ? { kind: 'apply', label: choice.label, text: choice.text, page: options.hub.page(choice.href) }
          : { kind: choice.kind, number: choice.card, title: topicTitle(choice.card, language) ?? choice.card, page: options.hub.page(pages.learningCard(choice.card)) },
      );
      const shown = {
        view: 'card',
        card: {
          number: card.number,
          title,
          language,
          minutes: card.minutes,
          gain: card.gain,
          why: card.why,
          core: card.core,
          // The chart of See it is drawn on the page of the card in Data Hub; here its words, with the link (DEC-LR-26).
          see: card.see ? { lookAt: card.see.lookAt, youSee: card.see.youSee } : null,
          questions: card.questions.map((question) => ({ text: question.text, options: question.options, why: question.why })),
          can: { now: card.can.now, choices },
        },
        page,
      };
      return answer(shown, `The User sees ${card.number} ${title} in its five steps. Retell its core idea in a sentence or two, in their language, and tie it to what they are doing; do not repeat the whole card. Link: ${page}`);
    },
  );

  resourceTools(context);
  messageTools(context);
  queryTools(context);
  registerView(server, options.viewHtml, options.serverUrl);
  return server;
}

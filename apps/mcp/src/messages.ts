import { MESSAGE_CATALOGUE } from '@datahub/contracts/message-catalogue';
import { renderMessage } from '@datahub/contracts/messages';
import { z } from 'zod';
import { answer, attempt } from './answers.js';
import { type Context, READ, SHARE } from './context.js';
import { pages } from './datahub.js';

interface Shown {
  id: string;
  type: string;
  kind: string;
  subject: { kind: string; id: string; name?: string };
  writer: { name: string } | null;
  params: Record<string, string>;
  state: string | null;
  createdAt: string;
  replies?: Shown[];
  [key: string]: unknown;
}

/** The laid-out text of a Message, as a person reads it (FR-CV-15); its own words when its type cannot be filled in. */
function textOf(message: Shown): string {
  const type = MESSAGE_CATALOGUE.find((candidate) => candidate.id === message.type);
  if (type) {
    try {
      return renderMessage(type, 'en', 'rich', message.params);
    } catch {
      // A parameter the catalogue names but the Message lacks: its own words still say what it is.
    }
  }
  return message.params.text ?? '';
}

/** The Messages on a Resource, and writing one, through Claude (FR-CL-13). */
export function messageTools({ server, hub }: Context): void {
  const enc = encodeURIComponent;
  const shown = (message: Shown): Record<string, unknown> => ({
    id: message.id,
    kind: message.kind,
    state: message.state,
    writer: message.writer?.name ?? 'Data Hub',
    at: message.createdAt,
    text: textOf(message),
    page: hub.page(pages.message(message.id)),
    ...(message.replies ? { replies: message.replies.map(shown) } : {}),
  });

  server.registerTool(
    'get_messages',
    {
      title: 'Read the Messages on a Resource',
      description: 'The Messages on a Resource, newest first, with their state; or one conversation with its replies, by the ID of its Message.',
      inputSchema: {
        resource: z.string().optional().describe('The ID of the Resource.'),
        message: z.string().optional().describe('The ID of one Message, to read it with its replies.'),
      },
      annotations: READ,
    },
    ({ resource, message }) =>
      attempt(async () => {
        if (message) return answer({ message: shown((await hub.get<{ message: Shown }>('catalogue', `/messages/${enc(message)}`)).message) });
        if (!resource) return answer({ messages: [] }, 'Name a Resource, or a Message.');
        const { messages } = await hub.get<{ messages: Shown[] }>('catalogue', `/messages/on/resource/${enc(resource)}`);
        return answer({ messages: messages.map(shown), page: hub.page(`${pages.resource(resource)}/messages`) });
      }),
  );

  server.registerTool(
    'write_message',
    {
      title: 'Write a Message on a Resource',
      description:
        'Places a Question, Remark or Signal on a Resource, under the name of the User: never private, it reaches the Owner, and a Signal the Data Team too. Show the User the kind and the exact text first, and call this only once they agree.',
      inputSchema: {
        resource: z.string().describe('The ID of the Resource.'),
        kind: z.enum(['question', 'remark', 'signal']).describe('A Question; a Remark, a tip for others; or a Signal, that something seems wrong in the data.'),
        text: z.string().min(1).max(4000).describe('The text, as the User agreed to it.'),
      },
      annotations: SHARE,
    },
    ({ resource, kind, text }) =>
      attempt(async () => {
        const { message } = await hub.send<{ message: Shown }>('catalogue', 'POST', '/messages', { subjectKind: 'resource', subjectId: resource, kind, text });
        return answer({ message: shown(message) }, 'Posted under the name of the User.');
      }),
  );

  server.registerTool(
    'reply_to_message',
    {
      title: 'Reply to a Message',
      description: 'Replies in the conversation of a Question, Remark or Signal, under the name of the User. Show the User the exact text first, and call this only once they agree.',
      inputSchema: {
        message: z.string().describe('The ID of the Message to reply to.'),
        text: z.string().min(1).max(4000).describe('The reply, as the User agreed to it.'),
      },
      annotations: SHARE,
    },
    ({ message, text }) =>
      attempt(async () => {
        const replied = await hub.send<{ message: Shown }>('catalogue', 'POST', `/messages/${enc(message)}/replies`, { text });
        return answer({ message: shown(replied.message) }, 'Replied under the name of the User.');
      }),
  );
}

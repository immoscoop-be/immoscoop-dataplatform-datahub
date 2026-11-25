import { MESSAGE_CATALOGUE } from '@datahub/contracts/message-catalogue';
import { renderMessage } from '@datahub/contracts/messages';
import { z } from 'zod';
import { answer, attempt, refusal } from './answers.js';
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

/** The Messages on a Resource, and writing one, through Claude (FR-CL-13), as far as the Permissions of the User go (TR-PL-09). */
export function messageTools({ server, hub, permits }: Context): void {
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

  // Only the kinds of Message the Permission group lets Claude place for the User (claude.use, messages.write).
  const [first, ...rest] = permits.messageKinds.filter((kind): kind is Kind => kind in KINDS);
  if (first) {
    server.registerTool(
      'write_message',
      {
        title: 'Write a Message on a Resource',
        description: `Places ${[first, ...rest].map((kind) => KINDS[kind].name).join(', ')} on a Resource, under the name of the User: never private, it reaches the Owner, and a Signal the Data Team too. Show the User the kind and the exact text first, and call this only once they agree.`,
        inputSchema: {
          resource: z.string().describe('The ID of the Resource.'),
          kind: z.enum([first, ...rest]).describe([first, ...rest].map((kind) => KINDS[kind].means).join('; ')),
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
  }

  // A User always replies in their own Questions and Signals; in those of others only with messages.reply.
  if (permits.reply) {
    server.registerTool(
      'reply_to_message',
      {
        title: 'Reply to a Message',
        description: `Replies in the conversation of ${permits.replyToOthers ? 'a Question, Remark or Signal' : 'a Question or Signal of the User themselves; their Permission group does not let them reply to those of others'}, under the name of the User. Show the User the exact text first, and call this only once they agree.`,
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

    // Deleting a Message, for everyone (FR-CV-18), only after the User agreed to exactly that (DEC-CV-17).
    server.registerTool(
      'delete_message',
      {
        title: 'Delete a Message',
        description:
          'Deletes a Message for everyone: a first Message with its whole conversation, a reply alone. The User may delete their own Messages; the Owner Unit and the Data Team every Message on their objects. What Data Hub wrote and a decided Request stay. Show the User what goes, the Message and how many replies with it, and call this only once they agree; pass in before its text as you showed it.',
        inputSchema: {
          message: z.string().describe('The ID of the Message to delete: a first Message or a reply.'),
          before: z.string().optional().describe('The text of the Message as you showed it to the User.'),
        },
        annotations: SHARE,
      },
      ({ message, before }) =>
        attempt(async () => {
          if (before !== undefined) {
            const { message: found } = await hub.get<{ message: Shown }>('catalogue', `/messages/${enc(message)}`);
            const text = textOf(found);
            if (text !== before && (found.params.text ?? '') !== before) return refusal(`Changed since you showed it: it now reads ${JSON.stringify(text)}. Show the User the Message as it is, and ask again.`);
          }
          const deleted = await hub.send<{ deleted: 'conversation' | 'reply'; conversation: string }>('catalogue', 'DELETE', `/messages/${enc(message)}`);
          return answer(deleted, deleted.deleted === 'conversation' ? 'Deleted, with its replies, for everyone; the Log of the Resource keeps that the User did.' : 'The reply is deleted, for everyone.');
        }),
    );
  }
}

type Kind = 'question' | 'remark' | 'signal';
const KINDS: Record<Kind, { name: string; means: string }> = {
  question: { name: 'a Question', means: 'A Question' },
  remark: { name: 'a Remark', means: 'a Remark, a tip for others' },
  signal: { name: 'a Signal', means: 'a Signal, that something seems wrong in the data' },
};

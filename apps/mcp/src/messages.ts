import { MESSAGE_CATALOGUE } from '@datahub/contracts/message-catalogue';
import { MESSAGE_MARKS, renderMessage } from '@datahub/contracts/messages';
import { z } from 'zod';
import { answer, attempt, refusal } from './answers.js';
import { type Context, READ, SHARE, WRITE } from './context.js';
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
  /** The marks of the User on it (FR-CV-19). */
  marks?: string[];
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
    ...(message.marks ? { marks: message.marks } : {}),
    ...(message.replies ? { replies: message.replies.map(shown) } : {}),
  });

  server.registerTool(
    'get_messages',
    {
      title: 'Read the Messages on a Resource',
      description:
        'The Messages on a Resource, newest first, with their state; or one conversation with its replies, by the ID of its Message; or the Messages the User marked with one of their marks, read or not, such as what they still have to follow up. Each Message says the marks of the User on it: followUp, important, starred; theirs alone.',
      inputSchema: {
        resource: z.string().optional().describe('The ID of the Resource.'),
        message: z.string().optional().describe('The ID of one Message, to read it with its replies.'),
        mark: z.enum(MESSAGE_MARKS).optional().describe('A mark of the User: followUp (Follow up), important (Important) or starred (Starred); gives the Messages that hold it.'),
      },
      annotations: READ,
    },
    ({ resource, message, mark }) =>
      attempt(async () => {
        if (message) return answer({ message: shown((await hub.get<{ message: Shown }>('catalogue', `/messages/${enc(message)}`)).message) });
        if (mark) {
          const { messages } = await hub.get<{ messages: Shown[] }>('catalogue', `/messages?view=everything&mark=${mark}`);
          return answer({ messages: messages.map(shown), page: hub.page('/messages') }, messages.length ? undefined : 'No Message holds this mark of the User.');
        }
        if (!resource) return answer({ messages: [] }, 'Name a Resource, or a Message.');
        const { messages } = await hub.get<{ messages: Shown[] }>('catalogue', `/messages/on/resource/${enc(resource)}`);
        return answer({ messages: messages.map(shown), page: hub.page(`${pages.resource(resource)}/messages`) });
      }),
  );

  // A mark of the User on a Message, theirs alone (FR-CL-40, DEC-UX-367): it changes nothing for anyone else, so their
  // asking is their agreement, and every User who sees the Message has it.
  server.registerTool(
    'mark_message',
    {
      title: 'Mark a Message for the User',
      description:
        'Sets or takes off a mark of the User on a Message: followUp (Follow up), important (Important) or starred (Starred). A mark is theirs alone: nobody else sees it or is told, and it changes nothing of the Message. Call this only when the User asks for it; their words are their agreement, so there is nothing to show them first.',
      inputSchema: {
        message: z.string().describe('The ID of the Message.'),
        mark: z.enum(MESSAGE_MARKS).describe('The mark: followUp, important or starred.'),
        on: z.boolean().describe('true to set the mark, false to take it off.'),
      },
      annotations: WRITE,
    },
    ({ message, mark, on }) =>
      attempt(async () => {
        const { marks } = await hub.send<{ marks: string[] }>('catalogue', on ? 'PUT' : 'DELETE', `/messages/${enc(message)}/marks/${mark}`);
        return answer({ marks, page: hub.page(pages.message(message)) }, on ? 'Marked, for the User alone.' : 'The mark is taken off.');
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

  // A description from dbt that seems wrong, to the Data Team (FR-CV-17), for who may write Messages on a Resource, only
  // after the User agreed to exactly that (DEC-CV-17).
  if (first) {
    server.registerTool(
      'report_description',
      {
        title: 'Report a description from dbt as wrong',
        description:
          'Tells the Data Team that a description from dbt seems wrong: that of a Resource, or of one of its fields. It is a Request to the Data Team on the Resource that quotes the description as dbt has it now; its Owner Unit is told too, and every reader sees at the description that it is reported until the Data Team decides. When one already waits on the same description, the User joins it, with their words. Show the User the description, what is wrong and what it should say, and call this only once they agree; pass in before the description as you showed it.',
        inputSchema: {
          resource: z.string().describe('The ID of the Resource.'),
          field: z.string().optional().describe('The field whose description it is; leave it out for the description of the Resource itself.'),
          text: z.string().min(1).max(4000).describe('What is wrong with it, as the User agreed to it.'),
          should: z.string().max(4000).optional().describe('What it should say, as the User agreed to it.'),
          before: z.string().optional().describe('The description from dbt as you showed it to the User.'),
        },
        annotations: SHARE,
      },
      ({ resource, field, text, should, before }) =>
        attempt(async () => {
          if (before !== undefined) {
            const { resource: found } = await hub.get<{ resource: { description: string; fields: { name: string; description: string }[] } }>('catalogue', `/resources/${enc(resource)}`);
            const now = field === undefined ? found.description : found.fields.find((one) => one.name === field)?.description;
            if (now !== undefined && now !== before) return refusal(`Changed in dbt since you showed it: it now reads ${JSON.stringify(now)}. Show the User the description as it is, and ask again.`);
          }
          const reported = await hub.send<{ outcome: 'sent' | 'joined' | 'already'; message: Shown }>('catalogue', 'POST', `/resources/${enc(resource)}/description-reports`, {
            field: field ?? null,
            text,
            should: should ?? '',
          });
          const said = {
            sent: 'Sent to the Data Team as a Request; the Owner Unit is told too, and every reader sees at the description that it is reported.',
            joined: 'A colleague had reported it already: the User joined that Request, and hears its decision and when it is corrected.',
            already: 'The User had reported it already; nothing changed.',
          }[reported.outcome];
          return answer({ outcome: reported.outcome, message: shown(reported.message) }, said);
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

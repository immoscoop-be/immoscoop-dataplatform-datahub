import { MESSAGE_CATALOGUE } from '@datahub/contracts/message-catalogue';
import { type Language, MESSAGE_MARKS, type MessageKind, type MessageMark, type MessageType, type MessageValues, messageValues, renderMessage, type SubjectKind } from '@datahub/contracts/messages';

export { MESSAGE_MARKS, type MessageMark };
import { createCall } from './api.js';
import type { Config } from './config.js';
import type { Session } from './session.js';

/** The views of the Message Centre (FR-CV-06). */
export type View = 'forYou' | 'unread' | 'written' | 'everything';
export const VIEWS: readonly View[] = ['forYou', 'unread', 'written', 'everything'];
/** The name of each view, and what it holds, as sentences (NFR-LOC-02). */
export const VIEW_TEXTS: Readonly<Record<View, { name: string; about: string }>> = {
  forYou: { name: 'messages.view.forYou', about: 'messages.about.forYou' },
  unread: { name: 'messages.view.unread', about: 'messages.about.unread' },
  written: { name: 'messages.view.written', about: 'messages.about.written' },
  everything: { name: 'messages.view.everything', about: 'messages.about.everything' },
};
/** The states a Message shows, as sentences. */
export const STATE_TEXTS: Readonly<Record<string, string>> = {
  open: 'messages.state.open',
  answered: 'messages.state.answered',
  waiting: 'messages.state.waiting',
  accepted: 'messages.state.accepted',
  refused: 'messages.state.refused',
  broken: 'messages.state.broken',
  worksAgain: 'messages.state.worksAgain',
  closed: 'messages.state.closed',
  // A Request on a Lens that was deleted (FR-LE-18).
  withdrawn: 'messages.state.withdrawn',
  // A description reported as wrong that dbt changed: Data Hub closed it (FR-CV-17, MSG-RES-11).
  corrected: 'messages.state.corrected',
};

/** A Request about a description from dbt that seems wrong (FR-CV-17), by its Message ID. */
export const REPORT = 'MSG-RES-10';

/** A colleague who joined a Request about a description from dbt, with their words if they wrote any (FR-CV-17). */
export interface Joiner {
  id: string;
  name: string;
  text?: string;
  should?: string;
  at: string;
}

/** Who joined a Request about a description from dbt, in the order they joined. */
export function joinersOf(params: Readonly<Record<string, string>>): Joiner[] {
  try {
    const joins = JSON.parse(params.joins ?? '[]') as unknown;
    return Array.isArray(joins) ? joins.filter((joiner): joiner is Joiner => typeof (joiner as Joiner | null)?.id === 'string') : [];
  } catch {
    return [];
  }
}

/** A description from dbt reported as wrong while the Data Team decides, or once it accepted (FR-CV-17). */
export interface Reported {
  id: string;
  state: 'waiting' | 'accepted';
  /** When it was reported. */
  at: string;
  /** The Request, opened in context (FR-CV-09). */
  href: string;
}

/** "Seems wrong?" next to a description from dbt, and what every reader sees while it is reported (FR-CV-17, DEC-UX-338). */
export interface Reporting {
  /** Opens the form on the Resource, for the description of the table (null) or of a field; absent for who may not write Messages. */
  report?: (field: string | null) => void;
  /** The waiting or accepted Request about each description, by its field; '' for that of the table. */
  reported: ReadonlyMap<string, Reported>;
}

/** What a User reports about a description from dbt: that of the table, or of a field, with their words (FR-CV-17). */
export interface DescriptionReport {
  field: string | null;
  text: string;
  should: string;
}
/** The kinds it filters on: what a person writes, and what Data Hub tells. */
export type FilterKind = 'question' | 'remark' | 'signal' | 'request' | 'dataHub';
export const FILTER_KINDS: readonly FilterKind[] = ['question', 'remark', 'signal', 'request', 'dataHub'];
/** The kinds of object it filters on. */
export type FilterOn = 'collection' | 'resource' | 'lens' | 'query';
export const FILTER_ON: readonly FilterOn[] = ['collection', 'resource', 'lens', 'query'];

/** What a User writes on an object from its page; a Collection and a Learning Card take no Signal, which is about data (FR-CV-07). */
export type WrittenKind = 'question' | 'remark' | 'signal';
export type WrittenOn = 'collection' | 'resource' | 'lens' | 'learningCard';
export const WRITTEN_ON: Readonly<Record<WrittenOn, readonly WrittenKind[]>> = {
  collection: ['question', 'remark'],
  resource: ['question', 'remark', 'signal'],
  lens: ['question', 'remark', 'signal'],
  // A Learning Card takes a Question or a Remark, for the Data Team, which writes the cards (FR-LR-06).
  learningCard: ['question', 'remark'],
};

/** How a writer stands to the object: in its Owner Unit, the Data Team, or neither. */
export type Standing = 'owner' | 'dataTeam' | null;

export interface MessageSubject {
  kind: SubjectKind;
  id: string;
  /** Its current name, or the name it had once it no longer exists (FR-CV-02, EC-CV-01). */
  name: string;
  collection: { id: string; name: string } | null;
  exists: boolean;
}

export interface Writer {
  id: string;
  name: string;
  as: Standing;
}

/** A Message, the first of a conversation, as the Message Centre lists it (FR-CV-06). */
export interface Message {
  id: string;
  /** Its Message ID in the Message Catalogue. */
  type: string;
  kind: MessageKind;
  subject: MessageSubject;
  /** Who wrote it; null for Data Hub itself. */
  writer: Writer | null;
  /** The values of its parameters; the words of whoever wrote it are `text`. */
  params: Record<string, string>;
  /** Open or answered, waiting, accepted or refused; null for a Message that asks nothing. */
  state: string | null;
  createdAt: string;
  lastAt: string;
  replyCount: number;
  unread: boolean;
  mine: boolean;
  /** Whether the User may close it, or reopen it once closed: its writer, the Owner Unit and the Data Team (FR-CV-16). */
  mayClose: boolean;
  /** Whether the User may reply in it (`messages.reply`, DEC-PL-04); left out by an older catalogue. */
  mayReply?: boolean;
  /** Whether the User may delete it with its replies: its writer, the Owner Unit and the Data Team (FR-CV-18). */
  mayDelete?: boolean;
  /** Whether the User may join it: a Request about a description from dbt that waits, not theirs yet (FR-CV-17). */
  mayJoin?: boolean;
  /** The marks the User put on it, theirs alone, in their order (FR-CV-19); left out by an older catalogue. */
  marks?: MessageMark[];
}

export interface Reply {
  id: string;
  type: string;
  kind: MessageKind;
  writer: Writer | null;
  params: Record<string, string>;
  createdAt: string;
  mine: boolean;
  /** Whether the User may delete this reply alone (FR-CV-18). */
  mayDelete?: boolean;
}

/** A Message with its replies, the decision on a Request among them. */
export interface Conversation extends Message {
  replies: Reply[];
}

export interface Counts {
  forYou: number;
  unread: number;
  written: number;
  kinds: Record<FilterKind, number>;
  on: Record<FilterOn, number>;
  /** How many Messages hold each mark of the User, whatever is chosen besides (DEC-UX-360); left out by an older catalogue. */
  marks?: Record<MessageMark, number>;
}

/** The name of each mark and what its view holds, as sentences (DEC-UX-363). */
export const MARK_TEXTS: Readonly<Record<MessageMark, { name: string; about: string }>> = {
  followUp: { name: 'messages.mark.followUp', about: 'messages.mark.followUp.about' },
  important: { name: 'messages.mark.important', about: 'messages.mark.important.about' },
  starred: { name: 'messages.mark.starred', about: 'messages.mark.starred.about' },
};

export interface Filter {
  view: View;
  /** A mark of the User opened as a view, in place of the view (DEC-UX-360). */
  mark?: MessageMark;
  kind?: FilterKind;
  on?: FilterOn;
  search?: string;
}

/** Messages, in catalogue, asked with the Access Token of the User (TR-CV-01). */
export function createMessages(config: Config, session: Pick<Session, 'accessToken'>, request?: typeof fetch) {
  const call = createCall('catalogue', config.catalogueUrl, session, request);
  const one = (id: string) => `/messages/${encodeURIComponent(id)}`;
  const conversation = async (response: Response) => ((await response.json()) as { message: Conversation }).message;

  return {
    /** The conversations of a view of the Message Centre, newest first, with its counts. */
    async list({ view, mark, kind, on, search }: Filter): Promise<{ messages: Message[]; counts: Counts }> {
      const query = new URLSearchParams({ view, ...(mark ? { mark } : {}), ...(kind ? { kind } : {}), ...(on ? { on } : {}), ...(search ? { search } : {}) });
      return (await (await call(`/messages?${query}`)).json()) as { messages: Message[]; counts: Counts };
    },
    /** How many conversations for the User moved since they read them, for the rail. */
    async unread(): Promise<number> {
      return ((await (await call('/messages/unread')).json()) as { unread: number }).unread;
    },
    async conversation(id: string): Promise<Conversation> {
      return conversation(await call(one(id)));
    },
    /** The conversations on a Collection, a Resource or a Lens (FR-CV-07). */
    /** What is written on an object, and the kinds of Message the User may write on it (`messages.write`, DEC-PL-04). */
    async on(kind: WrittenOn, id: string): Promise<{ messages: Conversation[]; kinds?: WrittenKind[] }> {
      return (await (await call(`/messages/on/${kind}/${encodeURIComponent(id)}`)).json()) as { messages: Conversation[]; kinds?: WrittenKind[] };
    },
    async write(subject: { kind: WrittenOn; id: string }, kind: WrittenKind, text: string): Promise<Conversation> {
      return conversation(await call('/messages', { method: 'POST', body: { subjectKind: subject.kind, subjectId: subject.id, kind, text } }));
    },
    async reply(id: string, text: string): Promise<Conversation> {
      return conversation(await call(`${one(id)}/replies`, { method: 'POST', body: { text } }));
    },
    async read(id: string): Promise<void> {
      await call(`${one(id)}/read`, { method: 'POST' });
    },
    /** Sets or takes off a mark of the User on a Message, theirs alone (FR-CV-19); gives their marks on it. */
    async mark(id: string, mark: MessageMark, on: boolean): Promise<MessageMark[]> {
      return ((await (await call(`${one(id)}/marks/${mark}`, { method: on ? 'PUT' : 'DELETE' })).json()) as { marks: MessageMark[] }).marks;
    },
    /** Closes an open Question or Signal, with an optional line why (FR-CV-16, MSG-CNV-07). */
    async close(id: string, text: string): Promise<Conversation> {
      return conversation(await call(`${one(id)}/close`, { method: 'POST', body: { text } }));
    },
    /** Deletes a Message for everyone: a first Message with its conversation, a reply alone (FR-CV-18). */
    async remove(id: string): Promise<{ deleted: 'conversation' | 'reply'; conversation: string }> {
      return (await (await call(one(id), { method: 'DELETE' })).json()) as { deleted: 'conversation' | 'reply'; conversation: string };
    },
    /** Opens a closed Question or Signal again (FR-CV-16). */
    async reopen(id: string): Promise<Conversation> {
      return conversation(await call(`${one(id)}/reopen`, { method: 'POST' }));
    },
    /**
     * Reports a description from dbt as wrong (FR-CV-17): a Request to the Data Team on the Resource, or joins the one that
     * waits on the same description.
     */
    async report(resourceId: string, report: DescriptionReport): Promise<{ outcome: 'sent' | 'joined' | 'already'; message: Conversation }> {
      const answer = (await (await call(`/resources/${encodeURIComponent(resourceId)}/description-reports`, { method: 'POST', body: report })).json()) as { outcome: 'sent' | 'joined' | 'already'; message: Conversation };
      return answer;
    },
    /** "Join it" on a waiting Request about a description from dbt (FR-CV-17). */
    async join(id: string): Promise<Conversation> {
      return conversation(await call(`${one(id)}/join`, { method: 'POST' }));
    },
    /** The decision of the Data Team on a Request to run a query (FR-CV-08); one on a Lens is decided on the Lens. */
    async decide(id: string, outcome: 'accepted' | 'refused', text: string): Promise<Conversation> {
      return conversation(await call(`${one(id)}/decision`, { method: 'POST', body: { outcome, text } }));
    },
  };
}

export type MessagesClient = ReturnType<typeof createMessages>;

const TYPES = new Map<string, MessageType>(MESSAGE_CATALOGUE.map((type) => [type.id, type]));

/** The kind of an object as the interface names it in a sentence: a name, never translated (NFR-LOC-01). */
export { SUBJECT_TITLES } from '@datahub/contracts/messages';

/** The buttons of a type of Message in the Message Catalogue, such as "Accept" (FR-CV-13). */
export function buttonsOf(type: string): MessageType['action']['buttons'] {
  return TYPES.get(type)?.action.buttons ?? [];
}

/** The Learning Card that explains what Data Hub writes, as the Message Catalogue names it (FR-LR-38, DEC-LR-29). */
export function cardOfType(type: string): string | null {
  const fit = TYPES.get(type)?.learningCard;
  return fit?.fit === 'named' ? fit.card.number : null;
}

/** "Open in context", which every Message has, as the Message Catalogue names it (FR-CV-09). */
export const CONTEXT_BUTTON = MESSAGE_CATALOGUE.flatMap((type) => type.action.buttons).find((button) => button.label.en === 'Open in context');

/** The values of a Message as its texts take them: catalogue keeps them as text, a list as JSON (DEC-CV-07). */
export function valuesOf(message: Pick<Message, 'type' | 'params' | 'subject' | 'writer'>): MessageValues {
  return messageValues(TYPES.get(message.type), message);
}

/**
 * A text of a Message from the Message Catalogue (FR-CV-15): the first line of its plain text in a list,
 * its laid-out text when it is opened. A value cannot lay itself out: its marks are escaped. Null when the
 * catalogue has no text for it, or a value it needs is missing.
 */
export function messageText(message: Pick<Message, 'type' | 'params' | 'subject' | 'writer'>, language: Language, layout: 'plain' | 'rich'): string | null {
  const type = TYPES.get(message.type);
  if (!type) return null;
  try {
    const text = renderMessage(type, language, layout, valuesOf(message), layout === 'rich' ? { value: (value) => value.replace(/[\\*~`]/g, (mark) => `\\${mark}`) } : {});
    return layout === 'plain' ? (text.split('\n')[0] ?? '') : text;
  } catch (error) {
    console.error(`The text of ${message.type} could not be made`, error);
    return null;
  }
}

/** Whether a Message asks something that is still open: a Question or Signal not answered, a Request that waits. */
export const isOpen = (message: Pick<Message, 'state'>) => message.state === 'open' || message.state === 'waiting';
/** Whether it was answered or decided. */
export const isAnswered = (message: Pick<Message, 'state'>) => message.state === 'answered' || message.state === 'accepted' || message.state === 'refused';
export const isClosed = (message: Pick<Message, 'state'>) => message.state === 'closed';

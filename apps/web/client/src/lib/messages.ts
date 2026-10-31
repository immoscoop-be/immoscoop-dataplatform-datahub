import { MESSAGE_CATALOGUE } from '@datahub/contracts/message-catalogue';
import { type Language, type MessageKind, type MessageType, type MessageValues, messageValues, renderMessage, type SubjectKind } from '@datahub/contracts/messages';
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
};
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
}

export interface Reply {
  id: string;
  type: string;
  kind: MessageKind;
  writer: Writer | null;
  params: Record<string, string>;
  createdAt: string;
  mine: boolean;
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
}

export interface Filter {
  view: View;
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
    async list({ view, kind, on, search }: Filter): Promise<{ messages: Message[]; counts: Counts }> {
      const query = new URLSearchParams({ view, ...(kind ? { kind } : {}), ...(on ? { on } : {}), ...(search ? { search } : {}) });
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
    async on(kind: WrittenOn, id: string): Promise<Conversation[]> {
      return ((await (await call(`/messages/on/${kind}/${encodeURIComponent(id)}`)).json()) as { messages: Conversation[] }).messages;
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

import type { Language } from './messages.js';

/**
 * The frame of a notification outside Data Hub, by e-mail and in Slack (DEC-UX-129): the sentences around
 * the text of a Message, in both languages (NFR-LOC-02). The text of the Message itself, and "Open in
 * context", come from the Message Catalogue (FR-CV-15).
 */

/**
 * Why a notification reaches whoever gets it (FR-CV-03): as a member of the Owner Unit of its object or of
 * the Data Team (DEC-LN-03, DEC-LN-07), as the writer of the Request it decides, as who started the
 * conversation it answers or wrote in it, or as the author of its Lens.
 */
export type NotificationReason = 'owner' | 'dataTeam' | 'request' | 'started' | 'participant' | 'author';

export interface NotificationTexts {
  /** Why it came: `{group}` is the Owner Unit, by name, and `{kind}` the kind of the object, as a Defined Term. */
  readonly why: Readonly<Record<NotificationReason, string>>;
  /** The way to the Message Centre, whose name is a link in an e-mail. */
  readonly centre: string;
  /** That a reply to the e-mail is not read, as its address takes none (DEC-PF-31). */
  readonly noReplies: string;
}

export const NOTIFICATION_TEXTS: Readonly<Record<Language, NotificationTexts>> = {
  nl: {
    why: {
      owner: 'Je krijgt dit als lid van {group}, de Owner Unit van deze {kind}.',
      dataTeam: 'Je krijgt dit als lid van het Data Team.',
      request: 'Je krijgt dit omdat je de aanvraag stuurde.',
      started: 'Je krijgt dit omdat je dit gesprek begon.',
      participant: 'Je krijgt dit omdat je in dit gesprek schreef.',
      author: 'Je krijgt dit als auteur van deze {kind}.',
    },
    centre: 'Elk bericht staat in je Message Centre.',
    noReplies: 'Antwoorden op deze e-mail worden niet gelezen: antwoord in Data Hub.',
  },
  en: {
    why: {
      owner: 'You get this as a member of {group}, the Owner Unit of this {kind}.',
      dataTeam: 'You get this as a member of the Data Team.',
      request: 'You get this because you sent the request.',
      started: 'You get this because you started this conversation.',
      participant: 'You get this because you wrote in this conversation.',
      author: 'You get this as the author of this {kind}.',
    },
    centre: 'Every Message is in your Message Centre.',
    noReplies: 'Replies to this e-mail are not read: answer in Data Hub.',
  },
};

/** The name of the Message Centre, which the sentence about it holds and an e-mail makes a link. */
export const MESSAGE_CENTRE = 'Message Centre';

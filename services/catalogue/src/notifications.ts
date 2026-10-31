import { MESSAGE_CATALOGUE } from '@datahub/contracts/message-catalogue';
import {
  contextPath,
  type Language,
  type MarkedPiece,
  type MessageType,
  messageValues,
  renderMessage,
  renderText,
  SUBJECT_TITLES,
  type SubjectKind,
  textBlocks,
} from '@datahub/contracts/messages';
import { MESSAGE_CENTRE, NOTIFICATION_TEXTS, type NotificationReason } from '@datahub/contracts/notifications';
import { topicOf } from '@datahub/learning';
import { type Kysely, type Selectable, sql } from 'kysely';
import type { CatalogueDatabase } from './database.js';

/**
 * Notifications (DEC-LN-02, DEC-UX-129): every Message notifies at once, outside Data Hub by e-mail and as
 * a direct message in Slack, with its texts from the Message Catalogue (FR-CV-15). Who it reaches follows
 * the recipients of its type (FR-CV-03): an Owner Unit by the address of its Google group and, in Slack,
 * each member Data Hub knows (DEC-LN-03, DEC-LN-07); the Data Team the same way; a person by their own
 * address. Whoever wrote the Message is not notified of it. The outbox holds every Message from the moment
 * it is written; what went out is kept, so that trying again never sends twice.
 */

const TYPES = new Map<string, MessageType>(MESSAGE_CATALOGUE.map((type) => [type.id, type]));

/** A User as identity knows them from their last sign-in (DEC-LN-07). */
export interface Person {
  id: string;
  email: string;
  name: string;
  language: Language;
  /** Which of the Groups and roles asked for they hold. */
  groups: string[];
  roles: string[];
}

/** identity: the Users asked for, and the members of Groups and holders of roles it knows. */
export interface People {
  find(asked: { users: string[]; groups: string[]; roles: string[] }): Promise<Person[]>;
}

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** The SMTP relay of Workspace (DEC-PF-31). */
export interface Mail {
  send(email: Email): Promise<void>;
}

export interface SlackMessage {
  /** The plain text, which Slack shows where it cannot lay the message out. */
  text: string;
  blocks: unknown[];
}

/** Slack, through the app of Data Hub (DEC-LN-05): `absent` when the User is not in Slack, `off` without a token yet. */
export interface Slack {
  send(email: string, message: SlackMessage): Promise<'sent' | 'absent' | 'off'>;
}

export interface NotificationOptions {
  people: People;
  mail: Mail;
  slack: Slack;
  /** The address of the web app, which "Open in context" leads to. */
  webUrl: string;
  /** The address of the Google group of the Data Team, and the role its members hold. */
  dataTeam: { email: string; role: string };
  now?: () => Date;
}

/** What one delivery round did. */
export interface Delivered {
  /** Notifications that went out wholly. */
  sent: number;
  /** Notifications with a part that failed, tried again later. */
  failed: number;
  /** Notifications given up after the last try. */
  abandoned: number;
  /** What went wrong, per Message, for the log. */
  failures: { messageId: string; failure: string }[];
}

export interface Notifications {
  /** Sends what is due, oldest first, as many as fit within the time given. */
  deliver(options?: { within?: number; limit?: number }): Promise<Delivered>;
}

/** After a failure it is tried again later, a little later each time; after the last try it is given up and logged. */
const RETRY_MINUTES = [1, 5, 15, 60, 240];
/** A notification taken by one delivery round, which no other round takes while it is being sent. */
const LEASE_MS = 2 * 60 * 1000;
/** An e-mail subject stays readable in a list. */
const SUBJECT_LENGTH = 140;
/** Slack takes at most 3000 characters in one section. */
const SLACK_SECTION = 2900;

type MessageRow = Selectable<CatalogueDatabase['messages']>;

/** One thing to send: an e-mail to an address, or a direct message to a User in Slack. */
interface Delivery {
  channel: 'email' | 'slack';
  /** The e-mail address, or the fixed Google ID of the User for Slack. */
  address: string;
  /** For Slack, the e-mail address it finds the User by. */
  email: string;
  language: Language;
  reason: NotificationReason;
}

/** The object of a Message as a notification shows it: its kind, its name and its Collection. */
interface Subject {
  kind: SubjectKind;
  id: string;
  name: string;
  collection: string | null;
  exists: boolean;
  /** The Owner Unit that answers for it, if any: a Collection's, also for its Resources and Lenses. */
  owner: { id: string; email: string; name: string } | null;
  /** Who made it, for a Lens. */
  authorId: string | null;
}

/** Laid-out text as e-mail takes it: HTML with only the marks of the Message Catalogue, every value escaped. */
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

function htmlLine(pieces: MarkedPiece[]): string {
  return pieces
    .map((piece) => {
      let html = escapeHtml(piece.text);
      if (piece.code) html = `<code style="font-family:Menlo,Consolas,monospace;font-size:13px;">${html}</code>`;
      if (piece.struck) html = `<del style="color:#8a867f;">${html}</del>`;
      if (piece.strong) html = `<b style="font-weight:600;">${html}</b>`;
      return html;
    })
    .join('');
}

export function htmlOf(rich: string): string {
  return textBlocks(rich)
    .map((block) => {
      if (block.kind === 'items') return `<ul style="margin:0 0 10px;padding-left:18px;">${block.items.map((item) => `<li>${htmlLine(item)}</li>`).join('')}</ul>`;
      const lines = block.lines.map(htmlLine).join('<br>');
      return block.kind === 'quote'
        ? `<blockquote style="margin:0 0 10px;padding-left:12px;border-left:2px solid #dedad3;">${lines}</blockquote>`
        : `<p style="margin:0 0 10px;">${lines}</p>`;
    })
    .join('');
}

/** Laid-out text in the mark-up of Slack: `*strong*`, `~struck~`, `` `code` ``, `>` for a quote, a bullet per item. */
const escapeSlack = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function slackLine(pieces: MarkedPiece[]): string {
  return pieces
    .map((piece) => {
      let text = escapeSlack(piece.text);
      if (piece.code) text = `\`${text}\``;
      if (piece.struck) text = `~${text}~`;
      if (piece.strong) text = `*${text}*`;
      return text;
    })
    .join('');
}

export function slackOf(rich: string): string {
  return textBlocks(rich)
    .map((block) => {
      if (block.kind === 'items') return block.items.map((item) => `• ${slackLine(item)}`).join('\n');
      return block.lines.map((line) => (block.kind === 'quote' ? `> ${slackLine(line)}` : slackLine(line))).join('\n');
    })
    .join('\n\n');
}

/** The first line of the plain text, short enough for the subject of an e-mail; a quote cut short is closed. */
export function subjectLine(plain: string): string {
  const line = (plain.split('\n')[0] ?? '').trim();
  if (line.length <= SUBJECT_LENGTH) return line;
  const cut = line.slice(0, SUBJECT_LENGTH - 1);
  const words = cut.slice(0, Math.max(cut.lastIndexOf(' '), SUBJECT_LENGTH / 2)).trimEnd();
  const open = words.lastIndexOf('“') > words.lastIndexOf('”');
  return `${words}…${open ? '”' : ''}`;
}

/** The text of a Message in both layouts, with the escaped values the laid-out text needs (FR-CV-15). */
function textsOf(row: MessageRow, subject: Subject, language: Language): { plain: string; rich: string } | null {
  const type = TYPES.get(row.type);
  if (!type) return null;
  const values = messageValues(type, {
    params: row.params,
    subject: { kind: subject.kind, name: subject.name },
    writer: row.writerId === null ? null : { name: row.params.writer ?? '' },
  });
  return {
    plain: renderMessage(type, language, 'plain', values),
    rich: renderMessage(type, language, 'rich', values, { value: (value) => value.replace(/[\\*~`]/g, (mark) => `\\${mark}`) }),
  };
}

/** "Open in context", as the Message Catalogue names it (FR-CV-09). */
const OPEN_IN_CONTEXT = MESSAGE_CATALOGUE.flatMap((type) => type.action.buttons).find((button) => button.label.en === 'Open in context')?.label ?? {
  nl: 'Openen in context',
  en: 'Open in context',
};

/** The mark of Data Hub, two rings, drawn without an image so that every e-mail client shows it. */
const MARK =
  '<span style="display:inline-block;width:12px;height:12px;border:2px solid #1d1d1b;border-radius:50%;vertical-align:middle;"></span>' +
  '<span style="display:inline-block;width:12px;height:12px;border:2px solid #1d1d1b;border-radius:50%;vertical-align:middle;margin-left:-6px;"></span>';

export function createNotifications(db: Kysely<CatalogueDatabase>, options: NotificationOptions): Notifications {
  const { people, mail, slack, webUrl, dataTeam } = options;
  const now = options.now ?? (() => new Date());

  /** The object of a Message with its Owner Unit, as it is now, or as the Message named it once it is gone. */
  async function subjectOf(row: MessageRow): Promise<Subject> {
    const named = { kind: row.subjectKind, id: row.subjectId, name: row.params.subject ?? '', collection: null, exists: false, owner: null, authorId: null };
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.subjectId);
    if (!uuid) return { ...named, exists: true };
    const collection = async (id: string | null) =>
      id ? db.selectFrom('collections').select(['id', 'name', 'ownerUnitId', 'ownerUnitEmail', 'ownerUnitName', 'dissolvedAt']).where('id', '=', id).executeTakeFirst() : undefined;
    const ownerOf = (found: Awaited<ReturnType<typeof collection>>) =>
      found && found.dissolvedAt === null ? { id: found.ownerUnitId, email: found.ownerUnitEmail, name: found.ownerUnitName } : null;
    switch (row.subjectKind) {
      case 'collection': {
        const found = await collection(row.subjectId);
        return found ? { ...named, name: found.name, exists: found.dissolvedAt === null, owner: ownerOf(found) } : named;
      }
      case 'resource': {
        const resource = await db.selectFrom('resources').select(['displayName', 'collectionId']).where('id', '=', row.subjectId).executeTakeFirst();
        if (!resource) return named;
        const found = await collection(resource.collectionId);
        return { ...named, name: resource.displayName, collection: found?.name ?? null, exists: true, owner: ownerOf(found) };
      }
      case 'lens': {
        const lens = await db.selectFrom('lenses').select(['name', 'collectionId', 'authorId']).where('id', '=', row.subjectId).executeTakeFirst();
        if (!lens) return named;
        const found = await collection(lens.collectionId);
        return { ...named, name: lens.name, collection: found?.name ?? null, exists: true, owner: ownerOf(found), authorId: lens.authorId };
      }
      case 'learningCard': {
        const topic = topicOf(row.subjectId);
        return topic ? { ...named, name: `${topic.number} ${topic.title.en}`, exists: true } : named;
      }
      // The User of an Excel key gets the Messages about it, as the one who made it (MSG-KEY-01, MSG-KEY-02).
      case 'excelKey':
        return { ...named, exists: true, authorId: row.params.user ?? null };
      default:
        return { ...named, exists: true };
    }
  }

  /**
   * Who a Message notifies, by the recipients of its type in that order, so that each gets it once and for
   * the first reason that holds (FR-CV-03): the Owner Unit by its group address and its known members, the
   * Data Team likewise, the writer of what it answers, who wrote in its conversation, the author of its
   * Lens. Never whoever wrote it.
   */
  async function deliveriesOf(row: MessageRow, subject: Subject): Promise<Delivery[]> {
    const type = TYPES.get(row.type);
    if (!type) return [];
    const parent = row.parentId ? await db.selectFrom('messages').selectAll().where('id', '=', row.parentId).executeTakeFirst() : undefined;
    const root = parent ?? row;
    const earlier = row.parentId
      ? await db.selectFrom('messages').select(['writerId']).where('parentId', '=', row.parentId).where('createdAt', '<=', row.createdAt).where('id', '<>', row.id).execute()
      : [];

    const groups: NonNullable<Subject['owner']>[] = [];
    let team = false;
    const users: { id: string; reason: NotificationReason }[] = [];
    const addUser = (id: string | null, reason: NotificationReason) => {
      if (id) users.push({ id, reason });
    };
    for (const recipient of type.to) {
      // A Resource without a Collection, and a Learning Card, answer to the Data Team (MessageRecipient).
      if (recipient === 'owner') {
        if (subject.owner) groups.push(subject.owner);
        else if (subject.kind === 'resource' || subject.kind === 'learningCard') team = true;
      }
      if (recipient === 'dataTeam') team = true;
      if (recipient === 'writer' && parent) addUser(parent.writerId, TYPES.get(parent.type)?.kind === 'request' ? 'request' : 'started');
      if (recipient === 'participants') {
        addUser(root.writerId, 'started');
        for (const reply of earlier) addUser(reply.writerId, 'participant');
      }
      if (recipient === 'author') addUser(subject.authorId, 'author');
      // The Owners of the Resources under a Lens, and the Consumers of a Resource, come with the Messages that need them.
    }

    const known = await people.find({ users: [...new Set(users.map((user) => user.id))], groups: groups.map((group) => group.id), roles: team ? [dataTeam.role] : [] });
    const byId = new Map(known.map((person) => [person.id, person]));
    const writer = row.writerId;
    const out: Delivery[] = [];
    const mailed = new Set<string>();
    const messaged = new Set<string>();
    const email = (address: string, language: Language, reason: NotificationReason) => {
      const key = address.toLowerCase();
      if (mailed.has(key)) return;
      mailed.add(key);
      out.push({ channel: 'email', address, email: address, language, reason });
    };
    const direct = (person: Person, reason: NotificationReason) => {
      if (person.id === writer || messaged.has(person.id)) return;
      messaged.add(person.id);
      out.push({ channel: 'slack', address: person.id, email: person.email, language: person.language, reason });
    };

    // An Owner Unit and the Data Team by the address of their group, in Dutch, which reaches every member,
    // also who never signed in (DEC-LN-03); in Slack each member Data Hub knows (DEC-LN-07).
    for (const group of groups) {
      email(group.email, 'nl', 'owner');
      for (const person of known) if (person.groups.includes(group.id)) direct(person, 'owner');
    }
    if (team) {
      email(dataTeam.email, 'nl', 'dataTeam');
      for (const person of known) if (person.roles.includes(dataTeam.role)) direct(person, 'dataTeam');
    }
    // A person by their own address, unless a group they are known to be in has it already.
    for (const user of users) {
      const person = byId.get(user.id);
      if (!person || person.id === writer) continue;
      const inGroup = person.groups.some((group) => groups.some((owner) => owner.id === group)) || (team && person.roles.includes(dataTeam.role));
      if (!inGroup) email(person.email, person.language, user.reason);
      direct(person, user.reason);
    }
    return out;
  }

  /** Why it came, in the language of its receiver. */
  function why(delivery: Delivery, subject: Subject): string {
    return renderText(NOTIFICATION_TEXTS[delivery.language].why[delivery.reason], delivery.language, {
      group: subject.owner?.name ?? '',
      kind: SUBJECT_TITLES[subject.kind],
    });
  }

  function linkOf(row: MessageRow, subject: Subject): string {
    const conversation = row.parentId ?? row.id;
    return `${webUrl}${subject.exists ? contextPath(subject, conversation) : `/messages/${encodeURIComponent(conversation)}`}`;
  }

  /** The e-mail of a Message (DEC-UX-129): always light, the object on top, the text, "Open in context", why it came. */
  function emailOf(row: MessageRow, subject: Subject, delivery: Delivery): Email | null {
    const texts = textsOf(row, subject, delivery.language);
    if (!texts) return null;
    const words = NOTIFICATION_TEXTS[delivery.language];
    const link = linkOf(row, subject);
    const centre = `${webUrl}/messages`;
    const label = OPEN_IN_CONTEXT[delivery.language];
    const kind = [SUBJECT_TITLES[subject.kind], subject.collection].filter(Boolean).join(' · ');
    const reason = why(delivery, subject);
    const subjectText = subjectLine(texts.plain);
    const foot = `${escapeHtml(reason)} ${escapeHtml(words.centre).replace(MESSAGE_CENTRE, `<a href="${escapeHtml(centre)}" style="color:#1d1d1b;">${MESSAGE_CENTRE}</a>`)} ${escapeHtml(words.noReplies)}`;
    const html = `<!doctype html>
<html lang="${delivery.language}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"><title>${escapeHtml(subjectText)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="max-width:600px;margin:0 auto;padding:28px 24px 32px;font:14px/1.6 Poppins,Arial,sans-serif;color:#1d1d1b;background:#ffffff;">
<div style="font-weight:500;font-size:15px;">${MARK}<span style="vertical-align:middle;margin-left:10px;">Data Hub</span></div>
<div style="margin-top:24px;padding-top:18px;border-top:1px solid #ece9e4;">
<div style="font-size:12px;color:#8a867f;">${escapeHtml(kind)}</div>
<div style="font-size:18px;font-weight:500;">${escapeHtml(subject.name)}</div>
</div>
<div style="margin-top:14px;">${htmlOf(texts.rich)}</div>
<a href="${escapeHtml(link)}" style="display:inline-block;margin-top:8px;padding:10px 20px;border-radius:999px;background:#1d1d1b;color:#ffffff;text-decoration:none;font-weight:500;font-size:14px;">${escapeHtml(label)}</a>
<div style="margin-top:28px;padding-top:16px;border-top:1px solid #ece9e4;font-size:12px;color:#8a867f;line-height:1.6;">${foot}</div>
</div>
</body>
</html>`;
    const text = [texts.plain, '', `${label}: ${link}`, '', '—', `${reason} ${words.centre} ${centre}`, words.noReplies].join('\n');
    return { to: delivery.address, subject: subjectText, text, html };
  }

  /** The direct message of a Message in Slack (DEC-UX-129): the laid-out text, "Open in context", the object and why it came. */
  function slackMessageOf(row: MessageRow, subject: Subject, delivery: Delivery): SlackMessage | null {
    const texts = textsOf(row, subject, delivery.language);
    if (!texts) return null;
    const laid = slackOf(texts.rich);
    const context = [SUBJECT_TITLES[subject.kind], subject.collection, why(delivery, subject)].filter(Boolean).join(' · ');
    return {
      text: texts.plain,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: laid.length > SLACK_SECTION ? `${laid.slice(0, SLACK_SECTION)}…` : laid } },
        { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: OPEN_IN_CONTEXT[delivery.language] }, url: linkOf(row, subject) }] },
        { type: 'context', elements: [{ type: 'mrkdwn', text: escapeSlack(context) }] },
      ],
    };
  }

  /** Takes what is due, so that no other round sends it at the same time. */
  async function claim(limit: number): Promise<{ messageId: string; attempts: number }[]> {
    return db.transaction().execute(async (trx) => {
      const due = await trx
        .selectFrom('notifications')
        .select('messageId')
        .where('doneAt', 'is', null)
        .where('nextAt', '<=', now())
        .orderBy('nextAt')
        .limit(limit)
        .forUpdate()
        .skipLocked()
        .execute();
      if (due.length === 0) return [];
      return trx
        .updateTable('notifications')
        .set({ nextAt: new Date(now().getTime() + LEASE_MS), attempts: sql`attempts + 1` })
        .where('messageId', 'in', due.map((row) => row.messageId))
        .returning(['messageId', 'attempts'])
        .execute();
    });
  }

  /** Sends one notification, what did not go out yet; the error of the first part that failed. */
  async function send(messageId: string): Promise<string | null> {
    const row = await db.selectFrom('messages').selectAll().where('id', '=', messageId).executeTakeFirst();
    if (!row) return null;
    const subject = await subjectOf(row);
    const done = new Set((await db.selectFrom('notificationDeliveries').select(['channel', 'address']).where('messageId', '=', messageId).execute()).map((sent) => `${sent.channel} ${sent.address}`));
    let failure: string | null = null;
    for (const delivery of await deliveriesOf(row, subject)) {
      if (done.has(`${delivery.channel} ${delivery.address}`)) continue;
      try {
        if (delivery.channel === 'email') {
          const email = emailOf(row, subject, delivery);
          if (!email) continue;
          await mail.send(email);
        } else {
          const message = slackMessageOf(row, subject, delivery);
          if (!message) continue;
          // Without a token yet, Data Hub notifies by e-mail alone (DEC-LN-05); nothing is kept, so that a token added later is used.
          if ((await slack.send(delivery.email, message)) === 'off') continue;
        }
        await db.insertInto('notificationDeliveries').values({ messageId, channel: delivery.channel, address: delivery.address }).onConflict((conflict) => conflict.doNothing()).execute();
      } catch (error) {
        failure ??= `${delivery.channel}: ${error instanceof Error ? error.message : String(error)}`.slice(0, 1000);
      }
    }
    return failure;
  }

  return {
    async deliver({ within = 4_000, limit = 25 } = {}) {
      const until = Date.now() + within;
      const outcome: Delivered = { sent: 0, failed: 0, abandoned: 0, failures: [] };
      while (Date.now() < until) {
        const claimed = await claim(Math.min(limit, 5));
        if (claimed.length === 0) break;
        for (const { messageId, attempts } of claimed) {
          let failure: string | null;
          try {
            failure = await send(messageId);
          } catch (error) {
            failure = `who to notify: ${error instanceof Error ? error.message : String(error)}`.slice(0, 1000);
          }
          if (failure !== null) outcome.failures.push({ messageId, failure });
          const last = attempts > RETRY_MINUTES.length;
          if (failure === null || last) {
            await db.updateTable('notifications').set({ doneAt: now(), failure }).where('messageId', '=', messageId).execute();
            outcome[failure === null ? 'sent' : 'abandoned'] += 1;
          } else {
            const wait = RETRY_MINUTES[attempts - 1] ?? RETRY_MINUTES[RETRY_MINUTES.length - 1]!;
            await db.updateTable('notifications').set({ nextAt: new Date(now().getTime() + wait * 60_000), failure }).where('messageId', '=', messageId).execute();
            outcome.failed += 1;
          }
        }
        limit -= claimed.length;
        if (limit <= 0) break;
      }
      return outcome;
    },
  };
}

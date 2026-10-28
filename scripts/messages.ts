/**
 * Generate the page of the Message Catalogue in docs from the catalogue in the source code
 * (DEC-CV-07).
 *
 * Usage:
 *   node scripts/messages.ts build   # rewrite docs/requirements/functional/message-catalogue.md
 *   node scripts/messages.ts check   # fail when that page is not what build would write
 *
 * Both run as part of `pnpm docs:build` and `pnpm docs:check`. The catalogue imports nothing at run
 * time, so Node 24 runs it as it is, stripping its types. Node built-ins only.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { MESSAGE_CATALOGUE } from '../packages/contracts/src/messageCatalogue.ts';
import {
  LANGUAGES,
  renderMessage,
  type Language,
  type LearningCardFit,
  type MessageParameter,
  type MessageRecipient,
  type MessageSender,
  type MessageTexts,
  type MessageType,
} from '../packages/contracts/src/messages.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const OUT = path.join(DOCS, 'requirements/functional/message-catalogue.md');
const SOURCE = 'packages/contracts/src/messageCatalogue.ts';

const SENDERS: Record<MessageSender, string> = { user: 'User', owner: 'Owner', dataTeam: 'Data Team', dataHub: 'Data Hub' };
const RECIPIENTS: Record<MessageRecipient, string> = {
  owner: 'Owner',
  resourceOwners: 'Owners of its Resources',
  dataTeam: 'Data Team',
  writer: 'its writer',
  participants: 'who wrote in the conversation',
  author: 'its author',
  consumers: 'Consumers',
};
/** The four actors of the overview: whoever receives a Message is one of them. */
const ACTOR_OF: Record<MessageRecipient, MessageSender> = {
  owner: 'owner',
  resourceOwners: 'owner',
  dataTeam: 'dataTeam',
  writer: 'user',
  participants: 'user',
  author: 'user',
  consumers: 'user',
};
const SUBJECTS: Record<string, string> = {
  collection: 'Collection',
  resource: 'Resource',
  lens: 'Lens',
  query: 'query',
  report: 'Report',
  learningCard: 'Learning Card',
};
const KINDS: Record<string, string> = {
  question: 'Question',
  remark: 'Remark',
  signal: 'Signal',
  request: 'Request',
  reply: 'reply',
  decision: 'decision',
  notice: 'notice',
  dataHub: 'Data Hub',
};
const ASKS: Record<string, string> = { nothing: 'Nothing', answer: 'An answer', decide: 'A decision', act: 'Something to do' };
const FITS: Record<LearningCardFit['fit'], string> = { named: 'Named', proposed: 'Proposed', toWrite: 'To write', byWriter: 'By the writer' };
const LANGUAGE_NAMES: Record<Language, string> = { nl: 'Dutch', en: 'English' };

/** Where every anchor in docs is, to link the IDs the catalogue mentions. */
function anchors(): Map<string, string> {
  const found = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.md') && full !== OUT) {
        for (const match of readFileSync(full, 'utf8').matchAll(/<a id="([^"]+)"><\/a>/g)) {
          found.set(match[1] as string, full);
        }
      }
    }
  };
  walk(DOCS);
  return found;
}

const where = anchors();
const missing: string[] = [];

/** A link to a requirement, decision or open point, or to a type of Message on this page. */
function link(id: string): string {
  const anchor = id.toLowerCase();
  if (id.startsWith('MSG-')) {
    if (!MESSAGE_CATALOGUE.some((type) => type.id === id)) {
      missing.push(id);
    }
    return `[${id}](#${anchor})`;
  }
  const file = where.get(anchor);
  if (!file) {
    missing.push(id);
    return id;
  }
  return `[${id}](${path.relative(path.dirname(OUT), file).split(path.sep).join('/')}#${anchor})`;
}

/** Links every ID in a sentence of the catalogue. */
const linked = (text: string): string => text.replace(/\b(?:MSG-[A-Z]{3}-\d{2}|(?:FR|TR|NFR|DEC|EC|OP)-[A-Z]{2,3}-\d{2,3})\b/g, link);

const list = (items: readonly string[], conjunction = 'and'): string =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} ${conjunction} ${items.at(-1)}`;

const subjects = (type: MessageType): string => list(type.subjects.map((s) => SUBJECTS[s] as string), 'or');

const recipients = (to: readonly MessageRecipient[]): string => list(to.map((r) => RECIPIENTS[r]));

const fence = (language: string, text: string): string[] => [`\`\`\`${language}`, text, '```'];

const quote = (text: string): string[] => text.split('\n').map((line) => (line ? `> ${line}` : '>'));

function card(fit: LearningCardFit): string {
  switch (fit.fit) {
    case 'named':
    case 'proposed':
      return `${FITS[fit.fit]}: **${fit.card.number} ${fit.card.title}**. ${linked(fit.why)}`;
    case 'toWrite': {
      const nearest = fit.nearest ? ` The nearest card today is ${fit.nearest.number} ${fit.nearest.title}.` : '';
      return `${FITS.toWrite}: *${fit.topic}*. ${linked(fit.why)}${nearest}`;
    }
    case 'byWriter':
      return `${FITS.byWriter}. ${linked(fit.why)}`;
  }
}

function parameterRows(parameters: readonly MessageParameter[], prefix = ''): string[] {
  return parameters.flatMap((p) => {
    const type = p.values ? `${p.type}: ${p.values.map((v) => `\`${v}\``).join(', ')}` : p.type;
    const row = `| \`${prefix}${p.name}\` | ${type}${p.optional ? ', optional' : ''} | ${linked(p.about)} |`;
    return [row, ...(p.item ? parameterRows(p.item.fields, `${prefix}${p.name}[].`) : [])];
  });
}

function templates(texts: MessageTexts, title: string): string[] {
  return LANGUAGES.flatMap((language) => [
    `${title}, ${LANGUAGE_NAMES[language]}, plain:`,
    '',
    ...fence('text', texts[language].plain),
    '',
    `${title}, ${LANGUAGE_NAMES[language]}, laid out:`,
    '',
    ...fence('markdown', texts[language].rich),
    '',
  ]);
}

function section(type: MessageType): string[] {
  const { action } = type;
  const [start, ...ends] = (action.states ?? []).map((s) => `\`${s}\``);
  const states = start ? ` It starts ${start} and ends ${list(ends, 'or')}.` : '';
  const of = action.of ? `, of the ${recipients(action.of)}` : '';
  return [
    `<a id="${type.id.toLowerCase()}"></a>`,
    '',
    `### ${type.id} · ${type.title}`,
    '',
    '| | |',
    '| --- | --- |',
    `| Kind | ${KINDS[type.kind]} |`,
    `| About | ${subjects(type)} |`,
    `| From → to | ${SENDERS[type.from]} → ${recipients(type.to)} |`,
    `| When | ${linked(type.when)} |`,
    ...(type.per ? [`| How many | ${linked(type.per)} |`] : []),
    `| Status | ${type.status} |`,
    `| Comes from | ${type.sources.map(link).join(', ')} |`,
    ...(type.openPoints ? [`| Open points | ${type.openPoints.map(link).join(', ')} |`] : []),
    '',
    `**What it asks:** ${ASKS[action.asks]}${of}. ${linked(action.what)}`,
    '',
    `**How it ends:** ${linked(action.done)}${states}`,
    '',
    ...(action.buttons.length
      ? [
          '| Button | Opens | For |',
          '| --- | --- | --- |',
          ...action.buttons.map((b) => `| ${b.label.en} · *${b.label.nl}* | ${linked(b.opens)} | ${b.for ? recipients(b.for) : 'every recipient'} |`),
          '',
        ]
      : []),
    `**Learning Card:** ${card(type.learningCard)}`,
    '',
    ...LANGUAGES.flatMap((language) => [
      `**${LANGUAGE_NAMES[language]}, laid out**, with the example:`,
      '',
      ...quote(renderMessage(type, language, 'rich', type.example)),
      '',
      `**${LANGUAGE_NAMES[language]}, plain:**`,
      '',
      ...fence('text', renderMessage(type, language, 'plain', type.example)),
      '',
    ]),
    '<details>',
    '<summary>Parameters and templates</summary>',
    '',
    ...(type.parameters.length
      ? ['| Parameter | Type | Holds |', '| --- | --- | --- |', ...parameterRows(type.parameters), '']
      : ['Only the parameters every Message of its sender has.', '']),
    ...templates(type.text, 'Template'),
    ...type.parameters.flatMap((p) => (p.item ? templates(p.item.text, `One item of \`${p.name}\``) : [])),
    '</details>',
    '',
  ];
}

function overview(types: readonly MessageType[]): string[] {
  return [
    '| Message ID | Message | About | From → to | Asks | Learning Card | Status |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...types.map((t) => {
      const fit = t.learningCard;
      const cardText = fit.fit === 'named' || fit.fit === 'proposed' ? `${FITS[fit.fit]}: ${fit.card.number}` : FITS[fit.fit];
      return `| ${link(t.id)} | ${t.title} | ${subjects(t)} | ${SENDERS[t.from]} → ${recipients(t.to)} | ${ASKS[t.action.asks]} | ${cardText} | ${t.status} |`;
    }),
  ];
}

function whoTellsWhom(): string[] {
  const actors: MessageSender[] = ['user', 'owner', 'dataTeam'];
  const senders: MessageSender[] = ['user', 'owner', 'dataTeam', 'dataHub'];
  const cell = (from: MessageSender, to: MessageSender): string =>
    MESSAGE_CATALOGUE.filter((t) => t.from === from && t.to.some((r) => ACTOR_OF[r] === to))
      .map((t) => link(t.id))
      .join(', ') || '–';
  return [
    `| From ↓ to → | ${actors.map((a) => SENDERS[a]).join(' | ')} |`,
    `| --- | ${actors.map(() => '---').join(' | ')} |`,
    ...senders.map((from) => `| ${SENDERS[from]} | ${actors.map((to) => cell(from, to)).join(' | ')} |`),
  ];
}

function page(): string {
  const byPeople = MESSAGE_CATALOGUE.filter((t) => t.from !== 'dataHub');
  const byDataHub = MESSAGE_CATALOGUE.filter((t) => t.from === 'dataHub');
  return [
    '# Message catalogue',
    '',
    '| | |',
    '| --- | --- |',
    `| Status | First version, 2026-10-28; its texts are proposals to review (${link('OP-CV-09')}) |`,
    `| Owned by | [Conversations](14-conversations.md) |`,
    `| Source of truth | [\`${SOURCE}\`](../../../${SOURCE}) |`,
    '| Generated by | `pnpm docs:build`, with [`scripts/messages.ts`](../../../scripts/messages.ts). Never edit this page by hand: change the catalogue in the source code and build. |',
    '',
    `Every type of Message in Data Hub, between the four actors: a User, the Owner of an object, the Data Team, and Data Hub itself (${link('DEC-CV-07')}, ${link('FR-CV-10')}). For each, the catalogue says who sends it to whom and when; its texts, plain and laid out, in Dutch and English (${link('FR-CV-11')}, ${link('FR-CV-12')}); the Learning Card that explains it (${link('FR-CV-14')}); and what it asks of whoever receives it, with the buttons that link the Message to that action (${link('FR-CV-13')}).`,
    '',
    `The catalogue itself is code, in [\`${SOURCE}\`](../../../${SOURCE}): the web app takes its texts from there, and so will Slack and the MCP server (${link('FR-CV-15')}). A test checks it: the same parameters in both languages and both layouts, a value for every placeholder, and every example filled in. A Message ID, such as \`MSG-RES-02\`, is fixed: never renumbered or reused. It is neither a requirement ID nor a Log ID of the [Log catalogue](log-catalogue.md).`,
    '',
    '## How to read it',
    '',
    `- **From and to.** A Message is placed on its object, never sent to a person (${link('FR-CV-03')}); "to" are those who get a notification of it. The Owner is who answers for the object: the Owner Unit of a Collection, a Resource or a Lens, who made a query, the Data Team for a Learning Card.`,
    `- **Kind.** What the Message Centre filters on (${link('FR-CV-06')}): a Question, Remark, Signal or Request, a reply, a decision on a Request, a notice the Owner sends through a form, or what Data Hub writes itself.`,
    '- **Plain** has no formatting at all, for a notification, the fallback of a Slack message or a screen reader; its first line stands alone, as the line of the Message in a list. **Laid out** uses a small part of Markdown that every channel can render: paragraphs, `**strong**`, `~~struck~~` for a text that was replaced, `` `code` `` for a name, `- ` for an item and `> ` for the words of a person.',
    '- **Placeholders** are `{name}`, filled in when the Message shows, so that a name is always current. Every Message has `{subject}` and `{subjectKind}`, its object; one written by a person also `{writer}` and `{text}`, their words. `{name, select, …}` and `{name, plural, …}` choose words, as in the ICU message format. A line that holds an empty optional value is left out. Counts, sizes and dates are written as each language writes them; a name is never translated ([NFR-LOC-01](../non-functional/localisation.md#nfr-loc-01)).',
    `- **The object** is not a parameter of the text alone: wherever a Message shows, it carries its object with its icon and current name, and links to it, opening in context (${link('FR-CV-02')}, ${link('FR-CV-09')}). What Data Hub writes itself shows its Learning Card under its text, in "Understand what is happening here" (${link('FR-LR-38')}).`,
    `- **Learning Card.** *Named* by a requirement or a decision; *Proposed*, a card of the master learning plan that fits, to confirm; *To write*, no card fits yet, and one is written before the Message is built (${link('FR-LR-38')}); *By the writer*, a person writes the Message and may add a card to it (${link('FR-LR-07')}).`,
    '- **What it asks.** Nothing, an answer, a decision, or something to do; of whom; the buttons that take the receiver there; what ends it; and the states of the Message while it asks something, where it starts and where it can end.',
    '',
    '## Who tells whom',
    '',
    'Every type of Message, by who sends it and which of the actors receive it. Data Hub receives none: it writes them.',
    '',
    ...whoTellsWhom(),
    '',
    '## Overview',
    '',
    ...overview(MESSAGE_CATALOGUE),
    '',
    '## Messages a person writes',
    '',
    'The words are theirs. The catalogue holds the frame of them wherever the Message shows outside its object, such as in a notification, and for a Request or a notice the facts Data Hub adds.',
    '',
    ...byPeople.flatMap(section),
    '## Messages Data Hub writes itself',
    '',
    'System text with placeholders, in Dutch and English, each with its Learning Card.',
    '',
    ...byDataHub.flatMap(section),
    '## Still to come',
    '',
    `The domains that are not specified yet will add their types of Message: [Checks and monitoring](08-checks-and-monitoring.md), when a check fails; [Reports](10-reports.md); [Beta and promotion](11-beta-and-promotion.md); and [EDA](15-eda.md). Which channel carries a notification, and how often, is open (${link('OP-DH-20')}).`,
  ]
    .join('\n')
    .concat('\n');
}

function main(command: string | undefined): number {
  if (command !== 'build' && command !== 'check') {
    console.log('usage: node scripts/messages.ts build|check');
    return 2;
  }
  const text = page();
  if (missing.length > 0) {
    console.log(`error: the Message Catalogue names IDs that do not exist: ${[...new Set(missing)].join(', ')}`);
    return 1;
  }
  const rel = path.relative(ROOT, OUT);
  if (command === 'check') {
    if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== text) {
      console.log(`error: ${rel} is not up to date with ${SOURCE}; run: pnpm docs:build`);
      return 1;
    }
    console.log(`ok: ${rel}, ${MESSAGE_CATALOGUE.length} types of Message`);
    return 0;
  }
  writeFileSync(OUT, text, 'utf8');
  console.log(`wrote ${rel}: ${MESSAGE_CATALOGUE.length} types of Message`);
  return 0;
}

process.exitCode = main(process.argv[2]);

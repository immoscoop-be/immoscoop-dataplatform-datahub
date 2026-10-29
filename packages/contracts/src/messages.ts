/**
 * Messages: what a type of Message holds in the Message Catalogue, and how its texts are filled in
 * (DEC-CV-07). The types themselves are in `messageCatalogue.ts`.
 *
 * This file and the catalogue import nothing at run time, so that `scripts/messages.ts` can import
 * them as they are, with Node.js, to generate the page of the catalogue in docs.
 */

/** The languages of the sentences of Data Hub: Dutch by default, English available (DEC-DH-65). */
export type Language = 'nl' | 'en';

export const LANGUAGES: readonly Language[] = ['nl', 'en'];

/** How each language writes numbers and dates: as in Flanders, and in British English. */
const LOCALES: Readonly<Record<Language, string>> = { nl: 'nl-BE', en: 'en-GB' };

/** The kinds of object a Message can be about (DEC-CV-03). */
export type SubjectKind = 'collection' | 'resource' | 'lens' | 'query' | 'report' | 'learningCard';

/**
 * The kind of a Message, what the Message Centre filters on (FR-CV-06): what a person writes, or
 * `dataHub` for what Data Hub writes itself. A `notice` is a Message a person sends with a form
 * Data Hub fills in, such as the Owner telling the Consumers of a Resource about a Change.
 */
export type MessageKind = 'question' | 'remark' | 'signal' | 'request' | 'reply' | 'decision' | 'notice' | 'dataHub';

/** Who writes a Message: any User who may see its object, its Owner, the Data Team, or Data Hub itself. */
export type MessageSender = 'user' | 'owner' | 'dataTeam' | 'dataHub';

/**
 * Who gets a notification of a Message. A Message is placed on its object, never sent to a person
 * (FR-CV-03): these are the people its notification reaches.
 *
 * - `owner`: who answers for its object: the Owner Unit of a Collection, a Resource or a Lens, who
 *   made a query, the Data Team for a Learning Card or for a Resource without a Collection
 * - `resourceOwners`: the Owners of the Resources a Lens builds on
 * - `writer`: who wrote the Message this one answers or decides
 * - `participants`: who already wrote in the conversation
 * - `author`: who made the Lens or the query
 * - `consumers`: the Consumers of a Resource (FR-LN-03)
 */
export type MessageRecipient = 'owner' | 'resourceOwners' | 'dataTeam' | 'writer' | 'participants' | 'author' | 'consumers';

/** The status of a type of Message: that of the requirement it comes from (docs/requirements/README.md). */
export type MessageStatus = 'Proposed' | 'Specified' | 'Implemented' | 'Verified' | 'Withdrawn';

/**
 * What a parameter holds. A `name` is a name in the sense of the language principle, such as a
 * field, a Node or an exposure: never translated (NFR-LOC-01). A `choice` is one of a fixed set of
 * values, chosen with `{name, select, …}`; a `count` can choose its words with `{name, plural, …}`.
 */
export type ParameterType = 'object' | 'person' | 'group' | 'name' | 'level' | 'text' | 'count' | 'size' | 'date' | 'choice' | 'list';

export interface MessageParameter {
  readonly name: string;
  readonly type: ParameterType;
  /** What it holds, in English. */
  readonly about: string;
  /** An optional value may be empty: a line that holds it is then left out. */
  readonly optional?: boolean;
  /** The values of a `choice`. */
  readonly values?: readonly string[];
  /** For a `list`: the fields of an item, and how one item reads. */
  readonly item?: MessageItem;
}

export interface MessageItem {
  readonly fields: readonly MessageParameter[];
  readonly text: MessageTexts;
}

/**
 * The two layouts of a text (FR-CV-11). `plain` has no formatting at all: a notification, the
 * fallback of a Slack message, a screen reader; its first line stands alone, as the line of the
 * Message in a list. `rich` is laid out in a small part of Markdown that every channel can render:
 * paragraphs, `**strong**`, `~~struck~~` for a text that was replaced, `` `code` `` for a name,
 * `- ` for an item and `> ` for the words of a person.
 */
export interface MessageText {
  readonly plain: string;
  readonly rich: string;
}

export type MessageTexts = Readonly<Record<Language, MessageText>>;

export interface LearningCardRef {
  /** Its number in the master learning plan, such as `K3.4` or `4.3.2`. */
  readonly number: string;
  readonly title: string;
}

/**
 * The Learning Card of a type of Message (FR-CV-14). What Data Hub writes itself carries the card
 * that explains it, under "Understand what is happening here" (FR-LR-38):
 *
 * - `named`: a requirement or a decision names the card
 * - `proposed`: a card of the master learning plan fits; to confirm
 * - `toWrite`: no card fits yet; one is written before the Message is built (FR-LR-38)
 * - `byWriter`: a person writes the Message, and may add a card to it (FR-LR-07)
 */
export type LearningCardFit =
  | { readonly fit: 'named'; readonly card: LearningCardRef; readonly why: string }
  | { readonly fit: 'proposed'; readonly card: LearningCardRef; readonly why: string }
  | { readonly fit: 'toWrite'; readonly topic: string; readonly nearest?: LearningCardRef; readonly why: string }
  | { readonly fit: 'byWriter'; readonly why: string };

/**
 * What a Message asks of whoever receives it (FR-CV-13): nothing, an answer, a decision, or
 * something to do.
 */
export type MessageAsks = 'nothing' | 'answer' | 'decide' | 'act';

export interface MessageButton {
  readonly label: Readonly<Record<Language, string>>;
  /** Where it takes the receiver, in English. */
  readonly opens: string;
  /** Who sees it, when not every recipient does. */
  readonly for?: readonly MessageRecipient[];
}

export interface MessageAction {
  readonly asks: MessageAsks;
  /** Of whom, when not of every recipient. */
  readonly of?: readonly MessageRecipient[];
  /** What the receiver does, in English. */
  readonly what: string;
  /** The buttons of the Message, which link it to the action. */
  readonly buttons: readonly MessageButton[];
  /** The states of the Message while it asks something, as names: the first is where it starts, the others where it can end. */
  readonly states?: readonly string[];
  /** What ends what it asks, and what the Message then shows. */
  readonly done: string;
}

/** One type of Message in the Message Catalogue (FR-CV-10). */
export interface MessageType {
  /** Its Message ID: fixed, never reused or renumbered. */
  readonly id: string;
  /** Its name in the catalogue, in English. */
  readonly title: string;
  readonly kind: MessageKind;
  readonly subjects: readonly SubjectKind[];
  readonly from: MessageSender;
  readonly to: readonly MessageRecipient[];
  /** When it is written, in English. */
  readonly when: string;
  /** How many there are, when not one per event, in English. */
  readonly per?: string;
  readonly status: MessageStatus;
  /** The requirements and decisions it comes from. */
  readonly sources: readonly string[];
  /** The open points about it. */
  readonly openPoints?: readonly string[];
  /** Its parameters, besides those every Message of its sender has (`implicitParameters`). */
  readonly parameters: readonly MessageParameter[];
  /**
   * Its texts. What Data Hub writes itself is system text with placeholders (FR-CV-12); for what a
   * person writes, it is the frame of their words wherever the Message shows outside its object.
   */
  readonly text: MessageTexts;
  readonly learningCard: LearningCardFit;
  readonly action: MessageAction;
  /** Values for every parameter, which the page of the catalogue shows filled in. */
  readonly example: MessageValues;
}

/**
 * The parameters every Message has: its object, by name and kind (FR-CV-02). A Message by a person
 * also has its writer and their words, which a Request may leave out.
 */
export function implicitParameters(type: Pick<MessageType, 'from' | 'kind'>): readonly MessageParameter[] {
  const subject: MessageParameter[] = [
    { name: 'subject', type: 'object', about: 'The object the Message is about, by its current name; laid out as a link to it, with its icon' },
    { name: 'subjectKind', type: 'name', about: 'The kind of that object: collection, resource, lens, query, report or learning card' },
  ];
  if (type.from === 'dataHub') {
    return subject;
  }
  return [
    ...subject,
    { name: 'writer', type: 'person', about: 'Who wrote it' },
    // A Request may go without a word of its writer: its facts say what it asks (FR-LE-09).
    { name: 'text', type: 'text', about: 'What they wrote', ...(type.kind === 'request' ? { optional: true } : {}) },
  ];
}

export type ParameterValue = string | number | readonly Readonly<Record<string, string | number>>[];

export type MessageValues = Readonly<Record<string, ParameterValue>>;

export interface RenderOptions {
  /** How a value goes into the text, for example escaped for Slack, or an object as a link. */
  readonly value?: (value: string, parameter: string) => string;
}

/**
 * Fills in a text of a type of Message. A line that holds an empty optional value is left out, and
 * so are the blank lines that leaves; a list is one item per line, or one block per item when an
 * item has several lines, and in plain text a list of single lines reads as one, joined by "; ".
 */
export function renderMessage(
  type: MessageType,
  language: Language,
  layout: keyof MessageText,
  values: MessageValues,
  options: RenderOptions = {},
): string {
  const parameters = new Map([...implicitParameters(type), ...type.parameters].map((p) => [p.name, p]));
  return renderTemplate(type.text[language][layout], { language, layout, values, parameters, options });
}

/**
 * Fills in a sentence of the interface, from a translation file (NFR-LOC-02): `{name}` takes its
 * value, a number written as its language writes it, and `{name, select|plural, …}` chooses, as in
 * the texts of a Message. A name goes in as a value and is never translated (NFR-LOC-01).
 */
export function renderText(template: string, language: Language, values: Readonly<Record<string, string | number>> = {}): string {
  const walk = (nodes: readonly TemplateNode[], count: number | undefined): string =>
    nodes
      .map((node) => {
        if (typeof node === 'string') {
          return count === undefined ? node : node.replaceAll('#', new Intl.NumberFormat(LOCALES[language]).format(count));
        }
        const value = values[node.name];
        if (value === undefined) {
          throw new Error(`no value for {${node.name}} in "${template}"`);
        }
        if (node.form) {
          return walk(chooseBranch(node, value, language), node.form === 'plural' ? Number(value) : count);
        }
        return typeof value === 'number' ? new Intl.NumberFormat(LOCALES[language]).format(value) : value;
      })
      .join('');
  return walk(parseTemplate(template), undefined);
}

interface Scope {
  readonly language: Language;
  readonly layout: keyof MessageText;
  readonly values: MessageValues;
  readonly parameters: ReadonlyMap<string, MessageParameter>;
  readonly options: RenderOptions;
}

function renderTemplate(template: string, scope: Scope): string {
  const lines: string[] = [];
  for (const line of template.split('\n')) {
    const state = { empty: false };
    const text = renderNodes(parseTemplate(line), scope, state, undefined);
    if (!state.empty) {
      lines.push(text);
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function renderNodes(nodes: readonly TemplateNode[], scope: Scope, state: { empty: boolean }, count: number | undefined): string {
  let out = '';
  for (const node of nodes) {
    if (typeof node === 'string') {
      out += count === undefined ? node : node.replaceAll('#', new Intl.NumberFormat(LOCALES[scope.language]).format(count));
      continue;
    }
    const parameter = scope.parameters.get(node.name);
    if (!parameter) {
      throw new Error(`unknown parameter {${node.name}}`);
    }
    const value = scope.values[node.name];
    if (value === undefined || value === '' || (typeof value === 'object' && value.length === 0)) {
      if (!parameter.optional) {
        throw new Error(`no value for {${node.name}}`);
      }
      state.empty = true;
      continue;
    }
    if (node.form) {
      out += renderNodes(chooseBranch(node, value, scope.language), scope, state, node.form === 'plural' ? Number(value) : count);
    } else if (typeof value === 'object') {
      out += renderList(parameter, value, scope);
    } else {
      const text = formatValue(parameter.type, value, scope.language);
      out += scope.options.value ? scope.options.value(text, node.name) : text;
    }
  }
  return out;
}

const SIZE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB'];

/** A count and a size, in bytes, are numbers; a date is `YYYY-MM-DD`. Each is written as its language writes it. */
function formatValue(type: ParameterType, value: string | number, language: Language): string {
  if (type === 'size' && typeof value === 'number') {
    const unit = Math.min(SIZE_UNITS.length - 1, Math.max(0, Math.floor(Math.log10(Math.max(value, 1)) / 3)));
    const amount = value / 1000 ** unit;
    return `${new Intl.NumberFormat(LOCALES[language], { maximumFractionDigits: amount < 10 ? 1 : 0 }).format(amount)} ${SIZE_UNITS[unit]}`;
  }
  if (type === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat(LOCALES[language], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
  }
  return typeof value === 'number' ? new Intl.NumberFormat(LOCALES[language]).format(value) : value;
}

function chooseBranch(node: Choice, value: ParameterValue, language: Language): readonly TemplateNode[] {
  const branches = node.branches;
  if (node.form === 'plural') {
    const n = Number(value);
    return branches[`=${n}`] ?? branches[new Intl.PluralRules(LOCALES[language]).select(n)] ?? branches['other'] ?? [];
  }
  return branches[String(value)] ?? branches['other'] ?? [];
}

function renderList(parameter: MessageParameter, items: readonly Readonly<Record<string, string | number>>[], scope: Scope): string {
  if (!parameter.item) {
    throw new Error(`{${parameter.name}} is not a list`);
  }
  const template = parameter.item.text[scope.language][scope.layout];
  const fields = new Map(parameter.item.fields.map((p) => [p.name, p]));
  const rendered = items.map((values) => renderTemplate(template, { ...scope, values, parameters: fields }));
  if (template.includes('\n')) {
    return rendered.join('\n\n');
  }
  return rendered.join(scope.layout === 'plain' ? '; ' : '\n');
}

/** A part of a template: text, a placeholder `{name}`, or a choice `{name, select|plural, key {…} …}`. */
export type TemplateNode = string | Placeholder | Choice;

interface Placeholder {
  readonly name: string;
  readonly form?: undefined;
}

interface Choice {
  readonly name: string;
  readonly form: 'select' | 'plural';
  readonly branches: Readonly<Record<string, readonly TemplateNode[]>>;
}

/** Parses a template, in the part of the ICU message format that Data Hub uses. */
export function parseTemplate(template: string): readonly TemplateNode[] {
  let i = 0;
  const fail = (what: string): never => {
    throw new Error(`${what} at ${i} in "${template}"`);
  };
  const nodes = (inBranch: boolean): TemplateNode[] => {
    const out: TemplateNode[] = [];
    let text = '';
    while (i < template.length) {
      const c = template[i] as string;
      if (c === '}') {
        if (!inBranch) {
          fail('unexpected }');
        }
        break;
      }
      if (c !== '{') {
        text += c;
        i++;
        continue;
      }
      if (text) {
        out.push(text);
        text = '';
      }
      const head = /^\{\s*(\w+)\s*(?:,\s*(select|plural)\s*,\s*)?/.exec(template.slice(i));
      if (!head) {
        return fail('a placeholder without a name');
      }
      i += head[0].length;
      const name = head[1] as string;
      const form = head[2] as 'select' | 'plural' | undefined;
      if (!form) {
        if (template[i] !== '}') {
          fail(`{${name} not closed`);
        }
        i++;
        out.push({ name });
        continue;
      }
      const branches: Record<string, TemplateNode[]> = {};
      for (;;) {
        const key = /^\s*(?:(\})|(=\d+|\w+)\s*\{)/.exec(template.slice(i));
        if (!key) {
          return fail(`a branch of {${name}} without a key`);
        }
        i += key[0].length;
        if (key[1]) {
          break;
        }
        branches[key[2] as string] = nodes(true);
        if (template[i] !== '}') {
          fail(`a branch of {${name}} not closed`);
        }
        i++;
      }
      out.push({ name, form, branches });
    }
    if (text) {
      out.push(text);
    }
    return out;
  };
  return nodes(false);
}

/** The names of every placeholder and choice in a template, in the order they first appear. */
export function templateParameters(template: string): string[] {
  const names = new Set<string>();
  const walk = (nodes: readonly TemplateNode[]): void => {
    for (const node of nodes) {
      if (typeof node === 'string') {
        continue;
      }
      names.add(node.name);
      if (node.form) {
        Object.values(node.branches).forEach(walk);
      }
    }
  };
  walk(parseTemplate(template));
  return [...names];
}

/**
 * A Learning Card as a file (DEC-LR-12, DEC-LR-24): Markdown in a fixed shape, one file per language, so that
 * whoever writes a card writes text, and Data Hub reads its five steps from it (DEC-LR-10). The headings and the
 * small labels are the same English keys in both languages; everything else is the text of the card.
 *
 *     ---
 *     number: 1.2.2
 *     status: draft                 draft until the Data Team reviewed it (DEC-LR-25), then reviewed
 *     minutes: 5
 *     added: 2026-10-29
 *     changed: 2026-10-29
 *     gain: What knowing it brings, one sentence, the same wherever the card shows (FR-LR-31, FR-LR-36)
 *     translatedFrom: 3f2a9c1b7d4e  only in a translation: the version of the English it follows
 *     ---
 *
 *     # Why now
 *     > What a colleague says.
 *     > — Who says it
 *
 *     The situation, in at most three sentences.
 *
 *     Promise: what this card is about.
 *
 *     # Core idea
 *     The decision rule, in one sentence.
 *
 *     ## <the metaphor, as its title>
 *     The metaphor.
 *
 *     ## <the example, as its title>
 *     The example.
 *
 *     # See it                       optional for a minimal card (DEC-LR-23)
 *     ```chart
 *     { "semgraph": "categoryComparison", … }     a request of the Chart Server, from the figures of the card
 *     ```
 *     Look at: the part that matters.
 *     You see: what it shows.
 *
 *     # Check your understanding      optional for a minimal card
 *     ## <a question>
 *     Try it: [Open Query](/query/new)     only for a try-it question
 *     - [ ] a misconception
 *     - [x] the answer
 *     Why: why, without a verdict (DEC-LR-19).
 *
 *     # You can now
 *     What the reader can do now, starting with a verb.
 *
 *     ## Where to next
 *     - Deeper: 3.2.4
 *     - Next to it: 1.2.3
 *     - Apply: [Open Query](/query/new) What to look at there.
 *
 * Text may hold the marks of the Message Catalogue: `**strong**` and `` `a name` ``.
 */

export type CardStatus = 'draft' | 'reviewed';

/** A request of the Chart Server, as the card holds it; it is drawn as it is (DEC-LR-26). */
export type ChartRequest = { readonly semgraph: string } & Readonly<Record<string, unknown>>;

export interface Question {
  readonly text: string;
  /** A try-it question names where to look, with a link into Data Hub (FR-LR-30). */
  readonly tryIt: { readonly label: string; readonly href: string } | null;
  readonly options: readonly { readonly text: string; readonly right: boolean }[];
  readonly why: string;
}

export type Choice =
  | { readonly kind: 'deeper' | 'next'; readonly card: string }
  | { readonly kind: 'apply'; readonly label: string; readonly href: string; readonly text: string };

export interface Card {
  readonly number: string;
  readonly status: CardStatus;
  readonly minutes: number;
  readonly added: string;
  readonly changed: string;
  readonly gain: string;
  /** In a translation, the version of the English it was made from (DEC-LR-24). */
  readonly translatedFrom: string | null;
  readonly why: { readonly quote: string; readonly by: string; readonly situation: string; readonly promise: string };
  readonly core: { readonly rule: string; readonly metaphor: { readonly title: string; readonly text: string }; readonly example: { readonly title: string; readonly text: string } };
  readonly see: { readonly chart: ChartRequest; readonly lookAt: string; readonly youSee: string } | null;
  readonly questions: readonly Question[];
  readonly can: { readonly now: string; readonly choices: readonly Choice[] };
}

/** What is wrong with a card file, with the line it is on. */
export class CardError extends Error {}

const STEPS = ['Why now', 'Core idea', 'See it', 'Check your understanding', 'You can now'] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER = /^(K\d+\.\d+|R\d+|[1-4]\.\d+\.\d+)$/;
const LINK = /^\[([^\]]+)\]\((\/[^)\s]*)\)\s*(.*)$/;

interface Block {
  heading: string;
  line: number;
  lines: { text: string; line: number }[];
}

/** The blocks under the headings of one level, each with the lines up to the next. */
function blocks(lines: { text: string; line: number }[], level: 1 | 2): { before: Block['lines']; blocks: Block[] } {
  const mark = `${'#'.repeat(level)} `;
  const out: Block[] = [];
  const before: Block['lines'] = [];
  for (const entry of lines) {
    if (entry.text.startsWith(mark)) out.push({ heading: entry.text.slice(mark.length).trim(), line: entry.line, lines: [] });
    else (out.at(-1)?.lines ?? before).push(entry);
  }
  return { before, blocks: out };
}

/** The paragraphs of some lines: runs of lines without a blank one, joined by a space. */
function paragraphs(lines: Block['lines']): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = [];
  let current: { parts: string[]; line: number } | null = null;
  for (const { text, line } of lines) {
    if (!text.trim()) {
      if (current) out.push({ text: current.parts.join(' '), line: current.line });
      current = null;
      continue;
    }
    if (current) current.parts.push(text.trim());
    else current = { parts: [text.trim()], line };
  }
  if (current) out.push({ text: current.parts.join(' '), line: current.line });
  return out;
}

/** Reads a card file; a CardError names what does not fit the shape, and where. */
export function parseCard(source: string): Card {
  const all = source.replace(/\r\n/g, '\n').split('\n').map((text, index) => ({ text, line: index + 1 }));
  const fail = (line: number, message: string): never => {
    throw new CardError(`line ${line}: ${message}`);
  };

  // The facts on top, between two lines of three dashes.
  if (all[0]?.text !== '---') fail(1, 'a card starts with its facts between two lines "---"');
  const end = all.findIndex((entry, index) => index > 0 && entry.text === '---');
  if (end < 0) fail(1, 'the facts on top are not closed with "---"');
  const facts = new Map<string, { value: string; line: number }>();
  for (const { text, line } of all.slice(1, end)) {
    const found = /^([a-zA-Z]+):\s*(.*)$/.exec(text);
    if (!found) fail(line, `"${text}" is no fact of the form "name: value"`);
    facts.set(found![1]!, { value: found![2]!.trim(), line });
  }
  const fact = (name: string, test?: RegExp): string => {
    const found = facts.get(name);
    if (!found || !found.value) return fail(1, `the fact "${name}" is missing`);
    if (test && !test.test(found.value)) fail(found.line, `"${found.value}" is no valid ${name}`);
    return found.value;
  };
  const known = new Set(['number', 'status', 'minutes', 'added', 'changed', 'gain', 'translatedFrom']);
  for (const [name, { line }] of facts) if (!known.has(name)) fail(line, `"${name}" is no fact of a card`);

  const { before, blocks: steps } = blocks(all.slice(end + 1), 1);
  const stray = before.find((entry) => entry.text.trim());
  if (stray) fail(stray.line, 'text before the first step');
  const names = steps.map((step) => step.heading);
  for (const step of steps) if (!(STEPS as readonly string[]).includes(step.heading)) fail(step.line, `"${step.heading}" is no step; the steps are ${STEPS.join(', ')}`);
  const order = names.map((name) => (STEPS as readonly string[]).indexOf(name));
  if (order.some((at, index) => index > 0 && at <= order[index - 1]!)) fail(steps[0]?.line ?? 1, `the steps come once each, in the order ${STEPS.join(', ')}`);
  const step = (name: (typeof STEPS)[number]) => steps.find((found) => found.heading === name);
  const required = (name: (typeof STEPS)[number]) => step(name) ?? fail(end + 2, `the step "${name}" is missing`);

  // Why now: what a colleague says, who says it, the situation, and "Promise:".
  const whyBlock = required('Why now');
  const quoteLines = whyBlock.lines.filter((entry) => entry.text.startsWith('>'));
  const by = quoteLines.at(-1)?.text.replace(/^>\s*/, '') ?? '';
  if (!by.startsWith('— ')) fail(whyBlock.line, 'Why now opens with a quote whose last line is "> — who says it"');
  const quote = quoteLines.slice(0, -1).map((entry) => entry.text.replace(/^>\s*/, '')).join(' ').trim();
  if (!quote) fail(whyBlock.line, 'the quote of Why now is empty');
  const whyRest = paragraphs(whyBlock.lines.filter((entry) => !entry.text.startsWith('>')));
  const promise = whyRest.find((entry) => entry.text.startsWith('Promise:'));
  if (!promise) fail(whyBlock.line, 'Why now ends with "Promise: …"');
  const situation = whyRest.filter((entry) => entry !== promise).map((entry) => entry.text).join(' ');
  if (!situation) fail(whyBlock.line, 'Why now tells the situation after its quote');

  // Core idea: the rule, then the metaphor and the example under their own titles.
  const coreBlock = required('Core idea');
  const core = blocks(coreBlock.lines, 2);
  const rule = paragraphs(core.before).map((entry) => entry.text).join(' ');
  if (!rule) fail(coreBlock.line, 'Core idea opens with its rule');
  if (core.blocks.length !== 2) fail(coreBlock.line, 'Core idea has two parts under "## ": the metaphor and the example');
  const part = (index: number) => ({ title: core.blocks[index]!.heading, text: paragraphs(core.blocks[index]!.lines).map((entry) => entry.text).join(' ') });

  // See it: the request of the Chart Server, "Look at:" and "You see:".
  let see: Card['see'] = null;
  const seeBlock = step('See it');
  if (seeBlock) {
    const open = seeBlock.lines.findIndex((entry) => entry.text.trim() === '```chart');
    const close = seeBlock.lines.findIndex((entry, index) => index > open && entry.text.trim() === '```');
    if (open < 0 || close < 0) fail(seeBlock.line, 'See it holds a request of the Chart Server in a block "```chart" … "```"');
    let chart: unknown;
    try {
      chart = JSON.parse(seeBlock.lines.slice(open + 1, close).map((entry) => entry.text).join('\n'));
    } catch (error) {
      fail(seeBlock.lines[open]!.line, `the chart is no JSON: ${(error as Error).message}`);
    }
    if (typeof chart !== 'object' || chart === null || typeof (chart as { semgraph?: unknown }).semgraph !== 'string') fail(seeBlock.lines[open]!.line, 'the chart names its "semgraph"');
    const rest = paragraphs([...seeBlock.lines.slice(0, open), ...seeBlock.lines.slice(close + 1)]);
    const labelled = (label: string) => rest.find((entry) => entry.text.startsWith(`${label}:`))?.text.slice(label.length + 1).trim() ?? fail(seeBlock.line, `See it has "${label}: …"`);
    see = { chart: chart as ChartRequest, lookAt: labelled('Look at'), youSee: labelled('You see') };
  }

  // Check your understanding: a question per "## ", its options, the right one checked, and "Why:".
  const questions: Question[] = [];
  const checkBlock = step('Check your understanding');
  if (checkBlock) {
    const asked = blocks(checkBlock.lines, 2);
    if (asked.blocks.length === 0) fail(checkBlock.line, 'Check your understanding has at least one question under "## "');
    for (const question of asked.blocks) {
      const options = question.lines.filter((entry) => /^- \[[ x]\] /.test(entry.text)).map((entry) => ({ text: entry.text.slice(6).trim(), right: entry.text[3] === 'x' }));
      if (options.length < 2) fail(question.line, 'a question has at least two answers "- [ ] …"');
      if (options.filter((option) => option.right).length !== 1) fail(question.line, 'a question has exactly one answer checked "- [x] …"');
      const rest = paragraphs(question.lines.filter((entry) => !/^- \[[ x]\] /.test(entry.text)));
      const why = rest.find((entry) => entry.text.startsWith('Why:'))?.text.slice(4).trim() ?? fail(question.line, 'a question ends with "Why: …"');
      const tried = rest.find((entry) => entry.text.startsWith('Try it:'));
      let tryIt: Question['tryIt'] = null;
      if (tried) {
        const link = LINK.exec(tried.text.slice(7).trim());
        if (!link) fail(tried.line, 'a try-it question links into Data Hub: "Try it: [label](/path)"');
        tryIt = { label: link![1]!, href: link![2]! };
      }
      questions.push({ text: question.heading, tryIt, options, why });
    }
  }

  // You can now: what the reader can do now, and the choices of "## Where to next".
  const canBlock = required('You can now');
  const can = blocks(canBlock.lines, 2);
  const now = paragraphs(can.before).map((entry) => entry.text).join(' ');
  if (!now) fail(canBlock.line, 'You can now opens with what the reader can do now');
  const next = can.blocks.find((found) => found.heading === 'Where to next') ?? fail(canBlock.line, 'You can now ends with "## Where to next"');
  const choices: Choice[] = [];
  for (const { text, line } of next.lines.filter((entry) => entry.text.startsWith('- '))) {
    const found = /^- (Deeper|Next to it|Apply):\s*(.+)$/.exec(text);
    if (!found) fail(line, 'a choice is "- Deeper: <card>", "- Next to it: <card>" or "- Apply: [label](/path) text"');
    if (found![1] === 'Apply') {
      const link = LINK.exec(found![2]!);
      if (!link || !link[3]) fail(line, 'Apply links into Data Hub and says what to look at there: "- Apply: [label](/path) text"');
      choices.push({ kind: 'apply', label: link![1]!, href: link![2]!, text: link![3]! });
    } else {
      const card = found![2]!.trim();
      if (!NUMBER.test(card)) fail(line, `"${card}" is no number of a card`);
      choices.push({ kind: found![1] === 'Deeper' ? 'deeper' : 'next', card });
    }
  }
  if (choices.length < 2 || choices.length > 3) fail(next.line, 'Where to next offers two or three choices (FR-LR-31)');

  return {
    number: fact('number', NUMBER),
    status: fact('status', /^(draft|reviewed)$/) as CardStatus,
    minutes: Number(fact('minutes', /^[1-9]\d?$/)),
    added: fact('added', DATE),
    changed: fact('changed', DATE),
    gain: fact('gain'),
    translatedFrom: facts.get('translatedFrom')?.value || null,
    why: { quote, by: by.slice(2).trim(), situation, promise: promise!.text.slice(8).trim() },
    core: { rule, metaphor: part(0), example: part(1) },
    see,
    questions,
    can: { now, choices },
  };
}

/**
 * The version of a card's English text that a translation follows: a short hash of the file, without its
 * status, so that reviewing a card does not mark its translation as to update (DEC-LR-24).
 */
export async function versionOf(source: string): Promise<string> {
  const text = source.replace(/\r\n/g, '\n').replace(/^status: .*$/m, '');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)]
    .slice(0, 6)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

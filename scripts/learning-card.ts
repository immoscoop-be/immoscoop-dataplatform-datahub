/**
 * List the Learning Cards that are open, check a card before it goes into a pull request, and stamp its translation.
 *
 * Usage:
 *   node scripts/learning-card.ts list [open | draft | reviewed] [section]   # the plan, with where each card stands
 *   node scripts/learning-card.ts check <number | folder>   # the card in both languages, its plan, its chart, its interview record
 *   node scripts/learning-card.ts stamp <number | folder>   # write into nl.md the translatedFrom the English asks for, then check
 *
 * A card is open while it has no folder, a draft until the Data Team reviewed it, and reviewed after (DEC-LR-25);
 * prod shows only reviewed cards. A section such as 2.1 or K5 narrows the list.
 *
 * A number is a folder of packages/learning/cards; a folder may be anywhere, such as the examples of the
 * learning-card skill. It reads the card with the parser of Data Hub, so that what passes here is what the web app
 * and the MCP server read (TR-LR-01). Besides problems, which fail it, it prints notes on how the card is written
 * (FR-LR-27, FR-LR-31, DEC-LR-19). It does not draw the chart of See it: the test of semgraph does, in
 * `pnpm vitest run packages/learning services/semgraph/test/learning-cards.test.ts`. It uses only Node built-ins
 * and the sources of the repository, and runs directly on Node 24, which strips the TypeScript types itself.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { type Card, parseCard, versionOf } from '../packages/learning/src/card.ts';
import { interviewMisfits } from '../packages/learning/src/interview.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const CARDS = path.join(ROOT, 'packages', 'learning', 'cards');
const SEMGRAPHS = path.join(ROOT, 'services', 'semgraph', 'semgraphs');

interface PlanFile {
  readonly levels: readonly { readonly id: string; readonly name: string }[];
  readonly sections: readonly { readonly level: string; readonly number: string; readonly title: { readonly en: string } }[];
  readonly topics: readonly { readonly number: string; readonly section: string; readonly title: { readonly en: string }; readonly priority?: string }[];
}

interface ChartSchema {
  readonly required?: readonly string[];
  readonly properties: Readonly<Record<string, { readonly enum?: readonly unknown[] }>>;
  readonly additionalProperties?: boolean;
}

const plan = JSON.parse(readFileSync(path.join(CARDS, 'plan.json'), 'utf8')) as PlanFile;
const [command, target, narrow] = process.argv.slice(2);

// The plan, with where each card stands: open, draft or reviewed.
if (command === 'list') {
  const states = ['open', 'draft', 'reviewed'];
  const only = target && states.includes(target) ? target : undefined;
  const within = only ? narrow : target;
  const stateOf = (number: string): string => {
    const card = path.join(CARDS, number, 'en.md');
    if (!existsSync(card)) return 'open';
    try {
      return parseCard(readFileSync(card, 'utf8')).status;
    } catch {
      return 'broken';
    }
  };
  const count: Record<string, number> = {};
  for (const level of plan.levels) {
    const lines: string[] = [];
    for (const section of plan.sections.filter((one) => one.level === level.id && (!within || one.number === within))) {
      const rows = plan.topics
        .filter((topic) => topic.section === section.number)
        .map((topic) => ({ topic, state: stateOf(topic.number) }))
        .filter((row) => !only || row.state === only);
      if (rows.length === 0) continue;
      lines.push(`  ${section.number} ${section.title.en}`);
      for (const { topic, state } of rows) {
        count[state] = (count[state] ?? 0) + 1;
        const record = existsSync(path.join(CARDS, topic.number, 'interview.md')) ? ' · interview record' : '';
        lines.push(`    ${topic.number.padEnd(7)} ${state.padEnd(9)} ${(topic.priority ?? '').padEnd(12)} ${topic.title.en}${record}`);
      }
    }
    if (lines.length) console.log(`${level.name}\n${lines.join('\n')}\n`);
  }
  const total = Object.values(count).reduce((sum, value) => sum + value, 0);
  console.log(`${total} topic(s): ${states.concat('broken').filter((state) => count[state]).map((state) => `${count[state]} ${state}`).join(', ') || 'none'}. Prod shows only the reviewed ones.`);
  process.exit(0);
}

if ((command !== 'check' && command !== 'stamp') || !target) {
  console.error('Usage: node scripts/learning-card.ts list [open | draft | reviewed] [section] | check <number | folder> | stamp <number | folder>');
  process.exit(2);
}

const folder = existsSync(path.join(CARDS, target)) ? path.join(CARDS, target) : path.resolve(target);
const file = (name: string): string | null => (existsSync(path.join(folder, name)) ? readFileSync(path.join(folder, name), 'utf8') : null);
const problems: string[] = [];
const notes: string[] = [];

const enSource = file('en.md');
if (enSource === null) {
  console.error(`No en.md in ${folder}: a card is written in English first (DEC-LR-24).`);
  process.exit(1);
}
const version = await versionOf(enSource);

let nlSource = file('nl.md');
if (command === 'stamp' && nlSource !== null) {
  const stamped = /^translatedFrom: .*$/m.test(nlSource)
    ? nlSource.replace(/^translatedFrom: .*$/m, `translatedFrom: ${version}`)
    : nlSource.replace(/^(gain: .*)$/m, `$1\ntranslatedFrom: ${version}`);
  if (stamped !== nlSource) {
    writeFileSync(path.join(folder, 'nl.md'), stamped);
    nlSource = stamped;
    notes.push(`nl.md now follows the English ${version}`);
  }
}

const parse = (language: 'en' | 'nl', source: string): Card | null => {
  try {
    return parseCard(source);
  } catch (error) {
    problems.push(`${language}.md ${(error as Error).message}`);
    return null;
  }
};
const en = parse('en', enSource);
const nl = nlSource === null ? null : parse('nl', nlSource);

// How the English is written: notes, never a failure.
if (en) {
  if (en.translatedFrom) problems.push('en.md carries translatedFrom; only the Dutch names the English it follows');
  if (!/\*\*[^*]+\*\*/.test(en.core.rule)) notes.push('the Core idea names no term in **bold**');
  const hedge = /\b(can|sometimes|usually|often|mostly)\b/i.exec(en.core.rule);
  if (hedge) notes.push(`the Core idea says "${hedge[0]}"; a decision rule says what is, without "can", "sometimes" or "usually" (FR-LR-27)`);
  if (/^[A-Z]/.test(en.can.now)) notes.push('You can now reads on from "You can now": start it with a verb in lowercase, such as "recognise …"');
  if (en.gain.split(/[.!?]\s/).length > 1) notes.push('the gain is more than one sentence; it shows in every pop-out (FR-LR-31)');
  const situation = en.why.situation.split(/(?<=[.!?])\s+/).filter(Boolean).length;
  if (situation > 3) notes.push(`the situation of Why now has ${situation} sentences; keep it to three at most (FR-LR-27)`);
  if (en.questions.length === 0) notes.push('no questions: only a minimal card for a name goes without (DEC-LR-23)');
  if (!en.see) notes.push('no See it: fine for a minimal card, or when the example is a screen and not a chart; say why in the interview record');
  for (const question of en.questions) {
    if (/^(right|wrong|correct|incorrect|not quite|exactly|indeed|yes|no)\b/i.test(question.why)) notes.push(`the Why of "${question.text}" sounds like a verdict (DEC-LR-19)`);
  }
}

// The Dutch follows the English.
if (nlSource === null) notes.push(`no nl.md yet; its translatedFrom will be ${version}`);
if (en && nl) {
  if (nl.number !== en.number) problems.push(`nl.md has number ${nl.number}, en.md ${en.number}`);
  if (nl.status !== en.status) problems.push(`nl.md has status ${nl.status}, en.md ${en.status}`);
  if (nl.translatedFrom !== version) problems.push(`nl.md follows ${nl.translatedFrom ?? 'no version'}, the English is ${version}: translate what changed, then stamp`);
  if ((nl.see === null) !== (en.see === null)) problems.push('See it is in one language and not in the other');
  const rights = (card: Card) => JSON.stringify(card.questions.map((question) => question.options.map((option) => option.right)));
  if (rights(nl) !== rights(en)) problems.push('the questions differ: the same questions and answers, the same right one, in the same order');
  const targets = (card: Card) => JSON.stringify(card.can.choices.map((choice) => (choice.kind === 'apply' ? choice.href : choice.card)));
  if (targets(nl) !== targets(en)) problems.push('the choices of Where to next differ between the languages');
}

// The plan: the number is a topic, and the choices go to written cards.
const written = new Set(readdirSync(CARDS, { withFileTypes: true }).filter((entry) => entry.isDirectory() && existsSync(path.join(CARDS, entry.name, 'en.md'))).map((entry) => entry.name));
if (en) {
  const topic = plan.topics.find((one) => one.number === en.number);
  if (!topic) problems.push(`${en.number} is no topic of packages/learning/cards/plan.json: add it there first, with its title`);
  else notes.push(`${en.number} is "${topic.title.en}" in the plan`);
  for (const choice of en.can.choices) {
    if (choice.kind === 'apply') continue;
    if (!plan.topics.some((one) => one.number === choice.card)) problems.push(`Where to next offers ${choice.card}, which is no topic of the plan`);
    else if (!written.has(choice.card)) problems.push(`Where to next offers ${choice.card}, which is not written yet: put it on the to-do of the interview record`);
  }
}

// The chart of See it, against the schema of its kind in the Chart Server.
const checkChart = (language: 'en' | 'nl', card: Card | null) => {
  if (!card?.see) return;
  const chart = card.see.chart as Record<string, unknown> & { semgraph: string };
  const at = `${language}.md See it`;
  const schemaFile = path.join(SEMGRAPHS, chart.semgraph, 'schema.json');
  if (!existsSync(schemaFile)) {
    problems.push(`${at}: "${chart.semgraph}" is no chart of the Chart Server (services/semgraph/semgraphs)`);
    return;
  }
  const schema = JSON.parse(readFileSync(schemaFile, 'utf8')) as ChartSchema;
  for (const name of schema.required ?? []) if (chart[name] === undefined) problems.push(`${at}: a ${chart.semgraph} needs "${name}"`);
  for (const [name, value] of Object.entries(chart)) {
    const property = schema.properties[name];
    if (!property) problems.push(`${at}: "${name}" is no field of a ${chart.semgraph}`);
    else if (property.enum && !property.enum.includes(value)) problems.push(`${at}: "${name}" is ${JSON.stringify(value)}, a ${chart.semgraph} takes ${property.enum.join(', ')}`);
  }
  const context = chart.context as { reliability?: unknown } | undefined;
  if (!context?.reliability) notes.push(`${at}: say in context.reliability what the figures are, such as "example figures" or "rounded figures"`);
  const locale = language === 'en' ? 'en' : 'nl-BE';
  if (chart.locale !== locale) notes.push(`${at}: the locale of this chart is "${locale}"`);
};
checkChart('en', en);
checkChart('nl', nl);

// The interview record: a card written from an interview keeps it (DEC-LR-31).
const interview = file('interview.md');
if (interview === null) notes.push('no interview.md: a card written from an interview keeps its input there (DEC-LR-31)');
else if (en) for (const misfit of interviewMisfits(interview, en.number)) problems.push(`interview.md: ${misfit}`);

for (const note of notes) console.log(`note: ${note}`);
for (const problem of problems) console.log(`PROBLEM: ${problem}`);
console.log(problems.length ? `${problems.length} problem(s): the card does not fit Data Hub yet.` : `The card fits Data Hub. The Dutch follows the English ${version}.`);
process.exit(problems.length ? 1 : 0);

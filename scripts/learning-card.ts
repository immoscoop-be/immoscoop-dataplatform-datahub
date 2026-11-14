/**
 * List the Learning Cards that are open, check a card before it goes into a pull request, and stamp its translation.
 *
 * Usage:
 *   node scripts/learning-card.ts list [open | draft | reviewed | wanted] [section]   # the plan, where each card stands, who wants it
 *   node scripts/learning-card.ts check <number | folder>   # the card in both languages, its plan, its chart, its interview record
 *   node scripts/learning-card.ts stamp <number | folder>   # write into nl.md the translatedFrom the English asks for, then check
 *   node scripts/learning-card.ts links <number | folder> ["words a reader uses" …]   # where Data Hub links the card, and what Claude finds
 *
 * `links` says where a reader meets the card: under a Message Data Hub writes (the Message Catalogue), on a marker of a
 * screen (markers.ts), under Where to next of another card, and in Claude, where it runs the search of `explain` of the
 * MCP server for the title, the term in bold, the quote of Why now and the words given. It is worked out afresh each
 * time, as the places change with every release.
 *
 * A card is open while it has no folder, a draft until the Data Team reviewed it, and reviewed after (DEC-LR-25);
 * prod shows only reviewed cards. `wanted` lists the open topics that a Message or a marker of Data Hub already wants,
 * and the cards the Message Catalogue asks for that are no topic yet. A section such as 2.1 or K5 narrows the list.
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
import { MESSAGE_CATALOGUE } from '../packages/contracts/src/messageCatalogue.ts';
import { renderMessage } from '../packages/contracts/src/messages.ts';
import { type Card, parseCard, versionOf } from '../packages/learning/src/card.ts';
import { type ExplainSource, explainWith } from '../packages/learning/src/explain.ts';
import { interviewMisfits } from '../packages/learning/src/interview.ts';
import { MARKER_PLACES, MARKERS, type MarkerPlace } from '../packages/learning/src/markers.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const CARDS = path.join(ROOT, 'packages', 'learning', 'cards');
const SEMGRAPHS = path.join(ROOT, 'services', 'semgraph', 'semgraphs');

interface PlanFile {
  readonly levels: readonly { readonly id: string; readonly name: string }[];
  readonly sections: readonly { readonly level: string; readonly number: string; readonly title: { readonly en: string } }[];
  readonly topics: readonly { readonly number: string; readonly section: string; readonly title: { readonly en: string; readonly nl: string }; readonly priority?: string }[];
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
  const states = ['open', 'draft', 'reviewed', 'wanted'];
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
  // The places in the web app that already want a card: the Messages that name or propose it, the markers that list it.
  const wantedBy = new Map<string, string[]>();
  const want = (number: string, place: string): void => void wantedBy.set(number, [...(wantedBy.get(number) ?? []), place]);
  const notInPlan = new Map<string, string[]>();
  for (const type of MESSAGE_CATALOGUE) {
    if (type.status === 'Withdrawn') continue;
    const fit = type.learningCard;
    if (fit.fit === 'named') want(fit.card.number, type.id);
    if (fit.fit === 'proposed') want(fit.card.number, `${type.id} (proposed)`);
    if (fit.fit === 'toWrite') notInPlan.set(fit.topic, [...(notInPlan.get(fit.topic) ?? []), type.id]);
  }
  for (const [place, numbers] of Object.entries(MARKERS)) for (const number of numbers) want(number, `marker ${place}`);
  const count: Record<string, number> = {};
  for (const level of plan.levels) {
    const lines: string[] = [];
    for (const section of plan.sections.filter((one) => one.level === level.id && (!within || one.number === within))) {
      const rows = plan.topics
        .filter((topic) => topic.section === section.number)
        .map((topic) => ({ topic, state: stateOf(topic.number) }))
        .filter((row) => !only || (only === 'wanted' ? row.state === 'open' && wantedBy.has(row.topic.number) : row.state === only));
      if (rows.length === 0) continue;
      lines.push(`  ${section.number} ${section.title.en}`);
      for (const { topic, state } of rows) {
        count[state] = (count[state] ?? 0) + 1;
        const record = existsSync(path.join(CARDS, topic.number, 'interview.md')) ? ' · interview record' : '';
        const places = state === 'open' && wantedBy.has(topic.number) ? `  ← ${wantedBy.get(topic.number)?.join(', ')}` : '';
        lines.push(`    ${topic.number.padEnd(7)} ${state.padEnd(9)} ${(topic.priority ?? '').padEnd(12)} ${topic.title.en}${record}${places}`);
      }
    }
    if (lines.length) console.log(`${level.name}\n${lines.join('\n')}\n`);
  }
  const total = Object.values(count).reduce((sum, value) => sum + value, 0);
  const wantedOpen = plan.topics.filter((topic) => stateOf(topic.number) === 'open' && wantedBy.has(topic.number)).length;
  console.log(`${total} topic(s): ${states.concat('broken').filter((state) => count[state]).map((state) => `${count[state]} ${state}`).join(', ') || 'none'}. Prod shows only the reviewed ones.`);
  console.log(`${wantedOpen} open topic(s) are wanted by a place in Data Hub (← the Message or marker that wants it): write those first; \`list wanted\` lists only them.`);
  if (notInPlan.size) {
    console.log('\nWanted by Data Hub, not yet a topic of the plan (the Message Catalogue asks for them):');
    for (const [topic, ids] of notInPlan) console.log(`  ${topic}  ← ${ids.join(', ')}`);
  }
  process.exit(0);
}

// Where Data Hub links the card: its screens and Messages in the web app, other cards, and what Claude finds.
if (command === 'links' && target) {
  const own = existsSync(path.join(CARDS, target)) ? path.join(CARDS, target) : path.resolve(target);
  const card = existsSync(path.join(own, 'en.md')) ? parseCard(readFileSync(path.join(own, 'en.md'), 'utf8')) : null;
  const number = card?.number ?? target;
  const topic = plan.topics.find((one) => one.number === number);
  if (!card && !topic) {
    console.error(`${target} is no topic of packages/learning/cards/plan.json, and ${own} holds no en.md.`);
    process.exit(1);
  }
  const writtenCards = readdirSync(CARDS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== number && existsSync(path.join(CARDS, entry.name, 'en.md')))
    .map((entry) => parseCard(readFileSync(path.join(CARDS, entry.name, 'en.md'), 'utf8')));
  const titleOf = (one: string): string => plan.topics.find((topic) => topic.number === one)?.title.en ?? one;
  const pad = (label: string): string => label.padEnd(9);
  let places = 0;

  const state = card ? `${card.status}${card.status === 'draft' ? ': shows in uat only, not in prod (DEC-LR-25)' : ''}` : 'open: not written yet, so no place shows it (DEC-LR-28)';
  console.log(`${number} ${titleOf(number)} · ${state}\n`);
  console.log(card ? 'In the web app' : 'In the web app, once it is written');
  const messages = MESSAGE_CATALOGUE.flatMap((type): { type: (typeof MESSAGE_CATALOGUE)[number]; fit: 'named' | 'proposed' | 'nearest'; why: string }[] => {
    const fit = type.learningCard;
    if (type.status === 'Withdrawn') return [];
    if ((fit.fit === 'named' || fit.fit === 'proposed') && fit.card.number === number) return [{ type, fit: fit.fit, why: fit.why }];
    if (fit.fit === 'toWrite' && fit.nearest?.number === number) return [{ type, fit: 'nearest', why: `${fit.why} The card it asks for: ${fit.topic}.` }];
    return [];
  });
  for (const { type, fit, why } of messages) {
    if (fit === 'named') places += 1;
    const shows = fit === 'named' ? 'named: shows under the Message, "Understand what is happening here"' : fit === 'proposed' ? 'proposed: does not show; only a card the Message Catalogue names shows (FR-LR-38)' : 'the nearest card to one still to write: does not show';
    console.log(`  ${pad('Message')}${type.id} ${type.title} · ${shows}`);
    console.log(`  ${pad('')}to: ${type.to.join(', ')} · the reader reads, for example: "${renderMessage(type, 'en', 'plain', type.example).replace(/\s+/g, ' ')}"`);
    console.log(`  ${pad('')}what it expects: ${why}`);
    const catalogued = type.learningCard;
    const kept = catalogued.fit === 'named' || catalogued.fit === 'proposed' ? catalogued.card.title : undefined;
    if (kept && topic && kept !== topic.title.en) console.log(`  ${pad('')}PROBLEM: the Message Catalogue calls the card "${kept}", the plan "${topic.title.en}": change it in packages/contracts/src/messageCatalogue.ts and run pnpm docs:build`);
  }
  if (messages.length === 0) console.log(`  ${pad('Message')}none: no Message Data Hub writes names it (packages/contracts/src/messageCatalogue.ts)`);
  const markers = (Object.entries(MARKERS) as [MarkerPlace, readonly string[]][]).filter(([, numbers]) => numbers.includes(number));
  for (const [place, numbers] of markers) {
    places += 1;
    const beside = numbers.filter((one) => one !== number);
    console.log(`  ${pad('Marker')}${place}: ${MARKER_PLACES[place]}${beside.length ? ` · with ${beside.join(', ')}` : ''}`);
  }
  if (markers.length === 0) console.log(`  ${pad('Marker')}none: no ⓘ lists it (packages/learning/src/markers.ts)`);
  const pointing = writtenCards.filter((one) => one.can.choices.some((choice) => choice.kind !== 'apply' && choice.card === number));
  places += pointing.length;
  const outgoing = card ? ` · it points to ${card.can.choices.map((choice) => (choice.kind === 'apply' ? `Apply ${choice.href}` : `${choice.kind === 'deeper' ? 'Deeper' : 'Next to it'} ${choice.card}`)).join(', ')}` : '';
  console.log(`  ${pad('Cards')}${pointing.length ? `pointed to by ${pointing.map((one) => `${one.number} ${titleOf(one.number)}`).join(', ')}` : 'no written card points to it'}${outgoing}`);
  const section = plan.sections.find((one) => one.number === topic?.section);
  console.log(`  ${pad('Centre')}the Learning Centre lists it under ${section ? `${section.number} ${section.title.en}` : 'no section: it is no topic of the plan'}${card ? '' : ', as a card to be written'}`);

  if (!card) {
    console.log('\nIn Claude: explain offers written cards only, so Claude finds it once it is written.');
    const wanted = messages.length + markers.length;
    console.log(`\nWanted by ${wanted} place(s) in the web app.${wanted ? ' Read what each expects: the card answers the reader who arrives from there.' : ''}`);
    process.exit(0);
  }

  console.log('\nIn Claude, through the MCP server: only when Claude calls explain');
  const phrases: { text: string; what: string }[] = [
    { text: titleOf(number), what: 'the title' },
    ...[...card.core.rule.matchAll(/\*\*([^*]+)\*\*/g)].map((match) => ({ text: match[1] ?? '', what: 'the term in bold' })),
    { text: card.why.quote, what: 'the quote of Why now' },
    ...process.argv.slice(4).map((text) => ({ text, what: 'your words' })),
  ];
  // What Claude searches: every written card in English and Dutch, this one as it stands in its folder.
  const sourceOf = (one: Card, folder: string): ExplainSource => {
    const dutch = existsSync(path.join(folder, 'nl.md')) ? parseCard(readFileSync(path.join(folder, 'nl.md'), 'utf8')) : null;
    const title = plan.topics.find((topic) => topic.number === one.number)?.title;
    return { card: one, title: title?.en ?? one.number, ...(dutch ? { translation: { card: dutch, title: title?.nl ?? one.number } } : {}) };
  };
  const all = [...writtenCards.map((one) => sourceOf(one, path.join(CARDS, one.number))), sourceOf(card, own)];
  let found = 0;
  for (const phrase of phrases) {
    const results = explainWith(phrase.text, all);
    const rank = results.findIndex((one) => one.number === number);
    if (rank >= 0) found += 1;
    const where = (rank < 0 ? 'missed' : `${rank + 1} of ${results.length}`).padEnd(8);
    const ahead = rank > 0 ? ` · after ${results.slice(0, rank).map((one) => one.number).join(', ')}` : rank < 0 ? ` · Claude gets ${results.length ? results.map((one) => one.number).join(', ') : 'no card'}` : '';
    console.log(`  ${where} ${JSON.stringify(phrase.text)}, ${phrase.what}${ahead}`);
  }

  console.log(`\nLinked from ${places} place(s) in the web app besides the Learning Centre; Claude finds it for ${found} of ${phrases.length} phrase(s).`);
  if (places === 0) console.log('Nobody meets this card where its topic comes up: propose a place on the to-do of the interview record (a Message, a marker, Where to next of a neighbour).');
  if (!topic) console.log(`${number} is no topic of the plan yet: add it to packages/learning/cards/plan.json.`);
  process.exit(0);
}

if ((command !== 'check' && command !== 'stamp') || !target) {
  console.error('Usage: node scripts/learning-card.ts list [open | draft | reviewed | wanted] [section] | check <number | folder> | stamp <number | folder> | links <number | folder> ["words a reader uses" …]');
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
  if (!en.core.metaphor) notes.push('no metaphor in Core idea: only for a card whose topic the reader sees on a screen of Data Hub (DEC-LR-36); say why in the interview record');
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
  if ((nl.core.metaphor === null) !== (en.core.metaphor === null)) problems.push('the metaphor of Core idea is in one language and not in the other');
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

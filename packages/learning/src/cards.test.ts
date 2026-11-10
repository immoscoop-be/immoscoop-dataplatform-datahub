import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCard, versionOf } from './card.js';
import { interviewMisfits } from './interview.js';
import { MARKERS } from './markers.js';
import { LEVELS, SECTIONS, TOPICS, topicOf } from './plan.js';

const CARDS = join(import.meta.dirname, '..', 'cards');
const written = readdirSync(CARDS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const read = (number: string, language: 'en' | 'nl') => readFileSync(join(CARDS, number, `${language}.md`), 'utf8');
const json = (file: string): unknown => JSON.parse(readFileSync(join(CARDS, file), 'utf8'));

/** The part of JSON Schema that `cards/plan.schema.json` uses, enough to hold the plan to it without a library. */
interface Schema {
  readonly $ref?: string;
  readonly type?: 'object' | 'array' | 'string';
  readonly enum?: readonly unknown[];
  readonly required?: readonly string[];
  readonly properties?: Readonly<Record<string, Schema>>;
  readonly additionalProperties?: boolean;
  readonly items?: Schema;
  readonly uniqueItems?: boolean;
  readonly pattern?: string;
  readonly minLength?: number;
}

/** What in a value does not fit a schema, each with where it is. */
function misfits(value: unknown, schema: Schema, root: Schema & { $defs?: Record<string, Schema> }, at: string): string[] {
  if (schema.$ref) return misfits(value, root.$defs?.[schema.$ref.replace('#/$defs/', '')] ?? {}, root, at);
  if (schema.enum) return schema.enum.includes(value) ? [] : [`${at}: ${JSON.stringify(value)} is none of ${schema.enum.join(', ')}`];
  if (schema.type === 'string') {
    if (typeof value !== 'string') return [`${at}: not a text`];
    if (schema.minLength && value.length < schema.minLength) return [`${at}: empty`];
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) return [`${at}: "${value}" does not match ${schema.pattern}`];
    return [];
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return [`${at}: not a list`];
    const out = value.flatMap((item, index) => (schema.items ? misfits(item, schema.items, root, `${at}[${index}]`) : []));
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) out.push(`${at}: an item twice`);
    return out;
  }
  if (schema.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return [`${at}: not an object`];
    const record = value as Record<string, unknown>;
    const out = (schema.required ?? []).filter((name) => !(name in record)).map((name) => `${at}: "${name}" is missing`);
    for (const [name, item] of Object.entries(record)) {
      const property = schema.properties?.[name];
      if (property) out.push(...misfits(item, property, root, `${at}.${name}`));
      else if (schema.additionalProperties === false) out.push(`${at}: "${name}" is no field of the plan`);
    }
    return out;
  }
  return [];
}

describe('the plan of the Learning Cards (DEC-LR-02)', () => {
  it('is the data of cards/plan.json, in the shape of cards/plan.schema.json (TR-LR-01)', () => {
    const schema = json('plan.schema.json') as Schema & { $defs?: Record<string, Schema> };
    expect(misfits(json('plan.json'), schema, schema, 'plan')).toEqual([]);
    expect(new Set(LEVELS.map((level) => level.id)).size, 'every Learning Level once').toBe(LEVELS.length);
    expect(new Set(SECTIONS.map((section) => section.number)).size, 'every section once').toBe(SECTIONS.length);
  });

  it('holds its schema to what it checks: a field it does not know, or a priority it does not have, does not fit', () => {
    const schema = json('plan.schema.json') as Schema & { $defs?: Record<string, Schema> };
    const plan = json('plan.json') as { topics: Record<string, unknown>[] };
    const wrong = { ...plan, topics: [{ ...plan.topics[0], level: 'compass' }, { ...plan.topics[20], priority: 'urgent' }] };
    expect(misfits(wrong, schema, schema, 'plan')).toEqual(['plan.topics[0]: "level" is no field of the plan', 'plan.topics[1].priority: "urgent" is none of required, recommended, inDepth']);
  });

  it('places every topic once, in a section of its own Learning Level, building on topics it has', () => {
    expect(new Set(TOPICS.map((topic) => topic.number)).size).toBe(TOPICS.length);
    for (const topic of TOPICS) {
      expect(SECTIONS.some((section) => section.number === topic.section && section.level === topic.level), topic.number).toBe(true);
      expect(LEVELS.some((level) => level.id === topic.level), topic.number).toBe(true);
      for (const earlier of topic.buildsOn) expect(topicOf(earlier), `${topic.number} builds on ${earlier}`).toBeDefined();
      expect(topic.title.en && topic.title.nl, topic.number).toBeTruthy();
    }
  });

  it('gives the four Learning Levels a priority and a thinking level for every card, as the master learning plan does', () => {
    for (const topic of TOPICS.filter((one) => ['1', '2', '3', '4'].includes(one.level))) {
      expect(topic.priority, topic.number).not.toBeNull();
      expect(topic.thinking, topic.number).not.toBeNull();
    }
  });
});

describe.each(written)('the Learning Card %s (DEC-LR-24)', (number) => {
  it('is a topic of the plan, written in English with a Dutch translation of the same shape', async () => {
    expect(topicOf(number), 'a card is a topic of the plan').toBeDefined();
    const en = parseCard(read(number, 'en'));
    const nl = parseCard(read(number, 'nl'));
    expect(en.number).toBe(number);
    expect(nl.number).toBe(number);
    expect(en.translatedFrom).toBeNull();
    expect(nl.translatedFrom, 'the Dutch names the version of the English it follows').toMatch(/^[0-9a-f]{12}$/);
    expect(nl.status).toBe(en.status);
    // The two languages hold the same steps, questions and choices; only the words differ.
    expect(nl.see === null).toBe(en.see === null);
    expect(nl.questions.map((question) => question.options.map((option) => option.right))).toEqual(en.questions.map((question) => question.options.map((option) => option.right)));
    expect(nl.can.choices.map((choice) => (choice.kind === 'apply' ? choice.href : choice.card))).toEqual(en.can.choices.map((choice) => (choice.kind === 'apply' ? choice.href : choice.card)));
    if (nl.translatedFrom !== (await versionOf(read(number, 'en')))) {
      // A change to the English marks the Dutch as to update (DEC-LR-24); it does not stop a build.
      console.warn(`The Dutch of Learning Card ${number} is to update: its English changed since it was translated.`);
    }
  });

  it('offers only written cards as choices, and a Chart Server request for See it', () => {
    const card = parseCard(read(number, 'en'));
    for (const choice of card.can.choices) if (choice.kind !== 'apply') expect(written, `${number} offers ${choice.card}`).toContain(choice.card);
    if (card.see) expect(card.see.chart.semgraph).toMatch(/^[a-zA-Z]+$/);
  });

  it('keeps the input of its interview in the shape of an interview record, when it has one (DEC-LR-31)', () => {
    const record = join(CARDS, number, 'interview.md');
    if (existsSync(record)) expect(interviewMisfits(readFileSync(record, 'utf8'), number)).toEqual([]);
  });
});

// The examples of the learning-card skill are cards of the plan that are not written: they keep the shape of a card,
// so that the skill changes with the format it writes (TR-LR-01).
const EXAMPLES = join(import.meta.dirname, '..', '..', '..', '.claude', 'skills', 'learning-card', 'examples');
const examples = existsSync(EXAMPLES)
  ? readdirSync(EXAMPLES, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  : [];

describe.each(examples)('the example %s of the learning-card skill', (number) => {
  const example = (file: string) => readFileSync(join(EXAMPLES, number, file), 'utf8');

  it('is a card of the plan with its interview record, offering only written cards', async () => {
    expect(topicOf(number), 'an example is a topic of the plan').toBeDefined();
    expect(written, 'an example is no written card').not.toContain(number);
    const en = parseCard(example('en.md'));
    expect(en.number).toBe(number);
    for (const choice of en.can.choices) if (choice.kind !== 'apply') expect(written, `${number} offers ${choice.card}`).toContain(choice.card);
    expect(interviewMisfits(example('interview.md'), number)).toEqual([]);
    if (existsSync(join(EXAMPLES, number, 'nl.md'))) {
      const nl = parseCard(example('nl.md'));
      expect(nl.translatedFrom).toBe(await versionOf(example('en.md')));
      expect(nl.questions.map((question) => question.options.map((option) => option.right))).toEqual(en.questions.map((question) => question.options.map((option) => option.right)));
    }
  });
});

describe('the interview record (DEC-LR-31)', () => {
  it('names what does not fit: another card, a missing fact, a section out of order', () => {
    const record = readFileSync(join(EXAMPLES, '2.1.3', 'interview.md'), 'utf8');
    expect(interviewMisfits(record, '2.1.3')).toEqual([]);
    expect(interviewMisfits(record, '1.2.2')[0]).toMatch(/opens with "# Interview record · 1\.2\.2/);
    expect(interviewMisfits(record.replace('| Fact check |', '| Checked by |'), '2.1.3')).toEqual(['its table names "Fact check"']);
    expect(interviewMisfits(record.replace('## 3. The aha', '## The aha'), '2.1.3')).toHaveLength(1);
  });
});

describe('the markers on system text (FR-LR-35, DEC-LR-22)', () => {
  it('list cards of the plan, each once, and every marker of the Resource page has a written card (DEC-LR-28)', () => {
    for (const [place, cards] of Object.entries(MARKERS)) {
      expect(new Set(cards).size, place).toBe(cards.length);
      for (const card of cards) expect(topicOf(card), `${place} lists ${card}`).toBeDefined();
      expect(cards.some((card) => written.includes(card)), `${place} has a written card`).toBe(true);
    }
  });
});

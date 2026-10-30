import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCard, versionOf } from './card.js';
import { MARKERS } from './markers.js';
import { LEVELS, SECTIONS, TOPICS, topicOf } from './plan.js';

const CARDS = join(import.meta.dirname, '..', 'cards');
const written = readdirSync(CARDS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const read = (number: string, language: 'en' | 'nl') => readFileSync(join(CARDS, number, `${language}.md`), 'utf8');

describe('the plan of the Learning Cards (DEC-LR-02)', () => {
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

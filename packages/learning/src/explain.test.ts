import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCard } from './card.js';
import { type ExplainSource, explainWith, stem, stems } from './explain.js';
import { topicOf } from './plan.js';

const CARDS = join(import.meta.dirname, '..', 'cards');
const sources: ExplainSource[] = readdirSync(CARDS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(CARDS, entry.name, 'en.md')))
  .map((entry) => {
    const card = parseCard(readFileSync(join(CARDS, entry.name, 'en.md'), 'utf8'));
    const title = topicOf(card.number)?.title;
    const dutch = existsSync(join(CARDS, entry.name, 'nl.md')) ? parseCard(readFileSync(join(CARDS, entry.name, 'nl.md'), 'utf8')) : null;
    return { card, title: title?.en ?? card.number, ...(dutch ? { translation: { card: dutch, title: title?.nl ?? card.number } } : {}) };
  });
const first = (term: string): string | undefined => explainWith(term, sources)[0]?.number;
const numbers = (term: string): string[] => explainWith(term, sources).map((card) => card.number);

describe('the search of explain, shared by the MCP server and the checks of a card (FR-CL-15)', () => {
  it('puts the card whose title holds the term first', () => {
    expect(first('Level')).toBe('K5.2');
    expect(first('owner')).toBe('4.7.1');
  });

  it('lets word forms meet through a light stem', () => {
    expect(['ownership', 'owning', 'owner', 'owners'].map(stem)).toEqual(['own', 'own', 'own', 'own']);
    expect(stem('confirmation')).toBe(stem('confirmed'));
    expect(stem('eigenaars')).toBe(stem('eigenaar'));
    expect(stem('users')).toBe('user');
    expect(first('ownership')).toBe('4.7.1');
    expect(numbers('Confirmation')).toContain('K5.2');
  });

  it('finds a card by the question of its reader, in English or in Dutch, past the common words', () => {
    expect(stems('What do I need to do with this message?')).toEqual(['messag']);
    expect(first('What do I need to do with this message?')).toBe('4.7.1');
    expect(first('Wat moet ik met dit bericht doen?')).toBe('4.7.1');
  });

  it('splits a name into its words, and finds nothing on common words alone', () => {
    expect(numbers('uniqueCount')).toContain('1.2.2');
    expect(explainWith('the data of a week', sources)).toEqual([]);
    expect(explainWith('data arrival', sources)).toEqual([]);
  });

  it('gives at most as many cards as asked, each with its core idea and gain in English', () => {
    const found = explainWith('Resource', sources, 2);
    expect(found).toHaveLength(2);
    for (const card of found) expect(card.coreIdea.length * card.gain.length).toBeGreaterThan(0);
  });
});

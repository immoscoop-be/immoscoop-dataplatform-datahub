import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCard } from './card.js';
import { explainWith } from './explain.js';
import { topicOf } from './plan.js';

const CARDS = join(import.meta.dirname, '..', 'cards');
const cards = readdirSync(CARDS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(CARDS, entry.name, 'en.md')))
  .map((entry) => parseCard(readFileSync(join(CARDS, entry.name, 'en.md'), 'utf8')));
const titleOf = (number: string): string => topicOf(number)?.title.en ?? number;

describe('the search of explain, shared by the MCP server and the checks of a card (FR-CL-15)', () => {
  it('puts the card whose title holds the term first', () => {
    expect(explainWith('Level', cards, titleOf)[0]?.number).toBe('K5.2');
    expect(explainWith('owner', cards, titleOf)[0]?.number).toBe('4.7.1');
  });

  it('splits a name into its words, and skips words of two letters', () => {
    expect(explainWith('uniqueCount', cards, titleOf).map((card) => card.number)).toContain('1.2.2');
    expect(explainWith('of a', cards, titleOf)).toEqual([]);
  });

  it('gives at most as many cards as asked, each with its core idea and gain', () => {
    const found = explainWith('data', cards, titleOf, 2);
    expect(found.length).toBeLessThanOrEqual(2);
    for (const card of found) expect(card.coreIdea.length * card.gain.length).toBeGreaterThan(0);
  });
});

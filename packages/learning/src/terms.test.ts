import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MARKERS } from './markers.js';
import { TERMS, termOf } from './terms.js';

const DEFINITIONS = readFileSync(join(import.meta.dirname, '..', '..', '..', 'docs', 'definitions.md'), 'utf8');
/** The Defined Terms of docs/definitions.md, as the first column of its table writes them in bold. */
const defined = new Set([...DEFINITIONS.matchAll(/^\| <a id="[^"]+"><\/a>\*\*([^*]+)\*\* \|/gm)].map((match) => match[1]));

describe('the terms of the dictionary on a screen (DEC-UX-279, TR-LR-10)', () => {
  it('are each a Defined Term of docs/definitions.md, with a marker that lists its cards', () => {
    expect(defined.size).toBeGreaterThan(50);
    for (const [key, term] of Object.entries(TERMS)) {
      expect(defined.has(term.term), `${key}: ${term.term} is a Defined Term`).toBe(true);
      expect(Object.hasOwn(MARKERS, key), `${key} is a place in MARKERS`).toBe(true);
    }
  });

  it('have a name and a definition in both languages, the English name the Defined Term', () => {
    for (const [key, term] of Object.entries(TERMS)) {
      expect(term.text.en.name, key).toBe(term.term);
      for (const language of ['en', 'nl'] as const) {
        expect(term.text[language].name.trim(), `${key} ${language}`).not.toBe('');
        expect(term.text[language].definition, `${key} ${language}`).toMatch(/^[A-Z].{40,}\.$/s);
      }
    }
  });

  it('tell a term from a marker of system text', () => {
    expect(termOf('knownGap')?.term).toBe('Known Gap');
    expect(termOf('grain')?.term).toBe('Grain');
    expect(termOf('level')).toBeNull();
    expect(termOf('toString')).toBeNull();
  });
});

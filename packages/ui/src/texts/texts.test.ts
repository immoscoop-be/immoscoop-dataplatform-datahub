import { templateParameters } from '@datahub/contracts/messages';
import { describe, expect, it } from 'vitest';
import en from './en.js';
import nl from './nl.js';

/**
 * A translation file of the interface holds the same sentences in both languages, with the same
 * values in them (NFR-LOC-02, NFR-LOC-06). Any file of sentences is checked with this.
 */
export function checkTranslations(files: { nl: Readonly<Record<string, string>>; en: Readonly<Record<string, string>> }): void {
  expect(Object.keys(files.en).sort()).toEqual(Object.keys(files.nl).sort());
  for (const [key, dutch] of Object.entries(files.nl)) {
    expect([key, templateParameters(files.en[key] ?? '').sort()]).toEqual([key, templateParameters(dutch).sort()]);
  }
}

describe('the sentences of the shared components', () => {
  it('are there in Dutch and English, with the same values', () => {
    checkTranslations({ nl, en });
  });
});

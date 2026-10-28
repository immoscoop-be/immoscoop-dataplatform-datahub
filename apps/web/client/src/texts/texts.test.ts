import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import uiEn from '../../../../../packages/ui/src/texts/en.js';
import uiNl from '../../../../../packages/ui/src/texts/nl.js';
import { checkTranslations } from '../../../../../packages/ui/src/texts/texts.test.js';
import en from './en.js';
import nl from './nl.js';

const ROOT = path.resolve(import.meta.dirname, '../../../../..');

function sources(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'texts' ? [] : sources(full);
    }
    return /\.(svelte|ts)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [full] : [];
  });
}
const CODE = ['packages/ui/src', 'apps/web/client/src'].flatMap((folder) => sources(path.join(ROOT, folder))).map((file) => readFileSync(file, 'utf8'));

describe('the sentences of the web app (NFR-LOC-02, NFR-LOC-06)', () => {
  it('are there in Dutch and English, with the same values', () => {
    checkTranslations({ nl, en });
  });

  it('are asked for by keys that exist', () => {
    const keys = new Set([...Object.keys(nl), ...Object.keys(uiNl)]);
    const asked = CODE.flatMap((text) => [...text.matchAll(/\bt\(\s*'([^']+)'/g)].map((m) => m[1] as string));
    expect(asked.length).toBeGreaterThan(20);
    expect(asked.filter((key) => !keys.has(key))).toEqual([]);
  });

  it('are each used somewhere, so that no sentence is left behind', () => {
    const all = CODE.join('\n');
    const unused = [...Object.keys(nl), ...Object.keys(uiNl)].filter((key) => !all.includes(`'${key}'`));
    expect(unused).toEqual([]);
    expect(Object.keys(uiEn).length).toBe(Object.keys(uiNl).length);
  });
});

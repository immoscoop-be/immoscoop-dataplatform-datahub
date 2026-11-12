import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Data Hub asks for no password (DEC-UX-211): every field where one types tells password managers to keep away,
// with NO_PASSWORD_MANAGER of fields.ts. A check box or a radio button is no such field.

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const FOLDERS = ['packages/ui/src', 'apps/web/client/src'];

function files(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return files(full);
    return entry.name.endsWith('.svelte') ? [full] : [];
  });
}

/** Every start tag of an input or a text area in a component, to its closing `>`, past braces and quotes. */
export function fieldTags(text: string): string[] {
  const tags: string[] = [];
  for (const match of text.matchAll(/<(input|textarea)(?=[\s/>])/g)) {
    let depth = 0;
    let quote: string | null = null;
    let end = match.index + match[0].length;
    for (; end < text.length; end += 1) {
      const char = text[end];
      if (quote) {
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'" || char === '`') {
        quote = char;
      } else if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
      } else if (char === '>' && depth === 0) {
        break;
      }
    }
    tags.push(text.slice(match.index, end + 1));
  }
  return tags;
}

const typed = (tag: string): boolean => !/\btype="(checkbox|radio|hidden)"/.test(tag);

describe('no password manager offers itself on a field of Data Hub (DEC-UX-211)', () => {
  const sources = FOLDERS.flatMap((folder) => files(path.join(ROOT, folder)));

  it('finds the fields of the components', () => {
    expect(sources.some((file) => fieldTags(readFileSync(file, 'utf8')).some(typed))).toBe(true);
  });

  it('marks every field where one types', () => {
    const unmarked = sources.flatMap((file) =>
      fieldTags(readFileSync(file, 'utf8'))
        .filter((tag) => typed(tag) && !tag.includes('{...NO_PASSWORD_MANAGER}'))
        .map((tag) => `${path.relative(ROOT, file)}: ${tag.split('\n')[0]}`),
    );
    expect(unmarked).toEqual([]);
  });

  it('reads a tag past the arrows and braces in it', () => {
    expect(fieldTags('<input value={a > b} onclick={() => go()} type="text" /> rest')).toEqual(['<input value={a > b} onclick={() => go()} type="text" />']);
  });
});
